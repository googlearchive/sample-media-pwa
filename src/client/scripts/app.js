/**
 *
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

import ServiceWorkerInstaller from './helpers/service-worker-installer';
import VideoPlayer from './video-player/video-player';
import Toast from './helpers/toast';
import LazyLoadImages from './helpers/lazy-load-images';
import OfflineCache from './helpers/offline-cache';
import Settings from './helpers/settings';
import VideoLibrary from './helpers/video-library';
import SideNav from './side-nav/side-nav';
import Constants from './constants/constants';
import Utils from './helpers/utils';

class App {
  static get CONNECTIVITY_STATES () {
    return {
      ONLINE: 1,
      OFFLINE: 2
    };
  }

  static get VIDEO_DOWNLOAD_STATES () {
    return {
      IDLE: 1,
      REMOVING: 2,
      ADDING: 3
    };
  }

  constructor () {
    ServiceWorkerInstaller.init();
    SideNav.init();

    // TODO: Restore the user preference here.
    this._appConnectivityState = navigator.onLine ?
        App.CONNECTIVITY_STATES.ONLINE :
        App.CONNECTIVITY_STATES.OFFLINE;
    this._offlineCache = new OfflineCache();
    this._offlineDownloadState = App.VIDEO_DOWNLOAD_STATES.IDLE;
    this._forcedOffline = false;

    this._onOnline = this._onOnline.bind(this);
    this._onOffline = this._onOffline.bind(this);
    this._onOfflineToggle = this._onOfflineToggle.bind(this);
    this._onProgressCallback = this._onProgressCallback.bind(this);
    this._onCompleteCallback = this._onCompleteCallback.bind(this);
    this._onCancelCallback = this._onCancelCallback.bind(this);
    this._processSettings = this._processSettings.bind(this);

    this._processAppConnectivityState().then(_ => {
      LazyLoadImages.init();
    });

    this._initMenuAndOffline();
    this._initVideoPlayer().then(_ => {
      if (window.location.hash !== '#autoplay') {
        return;
      }

      const reqVideoStart = document.querySelector('.js-request-video-start');
      Utils.fire(reqVideoStart, 'request-video-start');
    });
    this._addDownloadEventListeners();
  }

  _addDownloadEventListeners () {
    document.body.addEventListener('download-cancel',
        this._onCancelCallback);
    document.body.addEventListener('download-progress',
        this._onProgressCallback);
    document.body.addEventListener('download-complete',
        this._onCompleteCallback);
  }

  _initMenuAndOffline () {
    if (!ServiceWorkerInstaller.SUPPORTS_OFFLINE) {
      return;
    }

    this._addOfflineToggleListeners();
    this._processSettings();
  }

  _initVideoPlayer () {
    const video = document.querySelector('video');
    if (!video) {
      return;
    }

    this._videoPlayer = new VideoPlayer(video, {
      offlineSupported: ServiceWorkerInstaller.SUPPORTS_OFFLINE
    });

    return this._videoPlayer.init().then(_ => {
      this._videoPlayer.update();
      this._addVideoEventListeners();

      // Now check if there are active background fetches.
      this._offlineCache.getActiveBackgroundFetches().then(fetches => {
        if (fetches.length === 0) {
          return;
        }

        const href = video.parentNode.dataset.href;
        if (!href) {
          return;
        }

        const fetchingCurrentVideo = fetches.find(fetch => fetch === href);
        if (!fetchingCurrentVideo) {
          return;
        }

        console.log('Active fetch!', fetchingCurrentVideo);
        this._videoPlayer.updateOfflineProgress(0, true);
      });
    }, err => {
      console.log(err);
    });
  }

  _prefetchPopularVideos () {
    return VideoLibrary.load()
      .then(library => VideoLibrary.getAllEpisodes(library.shows))
      .then(videos => {
        return videos.reduce((prev, video) => {
          return prev.then(_ => {
            if (!video.popular) {
              return;
            }

            // TODO remove stale prefetched content.
            return OfflineCache.hasPrefetched(video.assetPath)
                .then(hasPrefetched => {
                  if (hasPrefetched) {
                    return;
                  }

                  const compositePath =
                      `${video.assetPath}/${Constants.PREFETCH_MANIFEST}`;

                  console.log('Prefetching ' + compositePath);
                  this._offlineCache.prefetch(compositePath,
                      Constants.PREFETCH_DEFAULT_BUFFER_GOAL / 2);
                });
          });
        }, Promise.resolve());
      });
  }

  _processSettings () {
    Settings.get('prefetch', true).then(shouldPrefetch => {
      if (!shouldPrefetch) {
        return OfflineCache.removeAllPrefetched();
      }

      return this._prefetchPopularVideos();
    });

    Settings.get('downloads-only').then(downloadsOnly => {
      this._forcedOffline = downloadsOnly;
      console.log('Downloads only: ' + this._forcedOffline);
      if (this._forcedOffline) {
        return this._onOffline();
      }

      this._onOnline();
    }, _ => {
      console.warn('Unable to get settings.');
    });
  }

  _processAppConnectivityState () {
    switch (this._appConnectivityState) {
      case App.CONNECTIVITY_STATES.ONLINE:
        return this._enableAllLinks();

      case App.CONNECTIVITY_STATES.OFFLINE:
        return this._disableUnavailableLinks();
    }
  }

  _enableAllLinks () {
    const links = document.querySelectorAll('.js-item-link');

    Array.from(links).forEach(link => {
      link.classList.remove('item--disabled');
      link.removeEventListener('click', this._cancel);
    });

    return Promise.resolve();
  }

  _disableUnavailableLinks () {
    const links = document.querySelectorAll('.js-item-link');

    return Promise.all(Array.from(links).map(link => {
      const root = window.location.origin.toString();
      const href = (link.href || link.dataset.href).toString();
      const path = href.replace(`${root}/`, '');

      return OfflineCache.has(path).then(isCached => {
        link.classList.toggle('item--disabled', !isCached);
        if (isCached) {
          return;
        }

        link.addEventListener('click', this._cancel);
      });
    }));
  }

  _onMenuClick (evt) {
    const menuActiveClass = 'menu__toggle--active';
    const menu = document.querySelector('.js-menu');
    if (evt.target === menu) {
      return menu.classList.toggle(menuActiveClass);
    }

    menu.classList.remove(menuActiveClass);
  }

  _cancel (evt) {
    evt.stopImmediatePropagation();
    evt.preventDefault();
  }

  _addVideoEventListeners () {
    this._addStatusChangeListeners();
  }

  _addStatusChangeListeners () {
    if (!ServiceWorkerInstaller.SUPPORTS_OFFLINE) {
      return;
    }

    navigator.serviceWorker.ready.then(_ => {
      console.log('Adding off/online event handlers.');
      window.addEventListener('online', this._onOnline);
      window.addEventListener('offline', this._onOffline);
    });
  }

  _addOfflineToggleListeners () {
    document.addEventListener('toggle-offline', this._onOfflineToggle);
    document.addEventListener('settings-updated', this._processSettings);
  }

  _onOnline () {
    if (!navigator.onLine) {
      return;
    }

    if (this._forcedOffline) {
      return;
    }

    document.body.classList.remove('offline');
    this._appConnectivityState = App.CONNECTIVITY_STATES.ONLINE;
    this._processAppConnectivityState();
  }

  _onOffline () {
    document.body.classList.add('offline');
    this._appConnectivityState = App.CONNECTIVITY_STATES.OFFLINE;
    this._processAppConnectivityState();
  }

  _onCancelCallback (evt) {
    const {name} = evt.detail;

    OfflineCache.purgePartialDownloads(name).then(_ => {
      this._videoPlayer.updateOfflineProgress(0);
      this._onCompleteCallback({detail: {name}});
    });
  }

  _onProgressCallback (evt) {
    const {bytesLoaded, bytesTotal, isBackground} = evt.detail;

    this._videoPlayer.updateOfflineProgress(bytesLoaded / bytesTotal,
        isBackground);
  }

  _onCompleteCallback (evt) {
    const {name} = evt.detail;
    console.log('Download complete: ' + name);

    switch (this._offlineDownloadState) {
      case App.VIDEO_DOWNLOAD_STATES.ADDING:
          Toast.create('Downloaded video.', {tag: 'offline'});
          break;

      case App.VIDEO_DOWNLOAD_STATES.REMOVING:
          Toast.create('Removed video.', {tag: 'offline'});
          break;
    }

    this._offlineDownloadState = App.VIDEO_DOWNLOAD_STATES.IDLE;
    this._videoPlayer.updateOfflineProgress(0);
    this._videoPlayer.update();
  }

  _ensureShakaSupport () {
    return shaka.Player.probeSupport().then(support => {
      return support.drm['com.widevine.alpha'].persistentState;
    });
  }

  _onOfflineToggle (evt) {
    if (!(evt && evt.detail)) {
      console.warn('Unable to locate file to remove');
      return;
    }

    // Assume there's no licensing to account for.
    let offlineLicenseSupport = Promise.resolve(true);
    if (evt.detail.drm) {
      offlineLicenseSupport = offlineLicenseSupport
          .then(_ => this._ensureShakaSupport())
          .catch(_ => {
            // If the user cancels the prompt, assume that persistent licensing
            // is unavailable.
            return false;
          });
    }

    return offlineLicenseSupport.then(persistentLicensing => {
      let drmInfo = null;
      if (!persistentLicensing) {
        Toast.create('Unable to download protected video.', {tag: 'offline'});
        return;
      } else if (evt.detail.drm) {
        const drmNameUrl = evt.detail.drm.split('|');
        drmInfo = {
          name: drmNameUrl[0],
          url: drmNameUrl[1],
          manifest: evt.detail.drmManifest
        };
      }

      const pagePath = `/${evt.detail.pagePath}/`;
      const name = evt.detail.pagePath;
      const assetPath = evt.detail.assetPath;

      if (this._offlineDownloadState === App.VIDEO_DOWNLOAD_STATES.ADDING) {
        if (confirm('Do you want to cancel this download?')) {
          this._offlineDownloadState = App.VIDEO_DOWNLOAD_STATES.REMOVING;
          Toast.create('Cancelling video.', {tag: 'offline'});

          return this._offlineCache.cancel(name);
        }
        return;
      }

      if (this._offlineDownloadState === App.VIDEO_DOWNLOAD_STATES.REMOVING) {
        Toast.create('Deleting video. Please wait.', {tag: 'offline'});
        return;
      }

      OfflineCache.has(name).then(videoIsAvailableOffline => {
        if (videoIsAvailableOffline) {
          // TODO: prompt the user to confirm removal properly.
          if (!confirm('Are you sure you wish to remove this video?')) {
            return;
          }

          this._offlineDownloadState = App.VIDEO_DOWNLOAD_STATES.REMOVING;
          Toast.create('Deleting video.', {tag: 'offline'});
          return this._offlineCache.remove(name).then(_ => {
            this._onCompleteCallback({detail: {name}});
          });
        } else {
          this._offlineDownloadState = App.VIDEO_DOWNLOAD_STATES.ADDING;
          Toast.create('Caching video for offline.', {tag: 'offline'});
          return this._offlineCache.add(name, assetPath, pagePath, drmInfo)
              .catch(_ => {
                console.error(_);
                Toast.create('Cancelled download.', {tag: 'offline'});
                this._offlineDownloadState = App.VIDEO_DOWNLOAD_STATES.IDLE;
              });
        }
      });
    });
  }
}

window.biograf = window.biograf || {};
window.biograf.app = window.biograf.app || new App();
