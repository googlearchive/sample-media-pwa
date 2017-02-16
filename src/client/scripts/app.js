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

import ServiceWorkerInstaller from './helpers/sw-install';
import VideoPlayer from './video-player/video-player';
import Toast from './helpers/toast';
import LazyLoadImages from './helpers/lazy-load-images';
import OfflineCache from './helpers/offline-cache';

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

    // TODO: Restore the user preference here.
    this._appConnectivityState = navigator.onLine ?
        App.CONNECTIVITY_STATES.ONLINE :
        App.CONNECTIVITY_STATES.OFFLINE;
    this._offlineCache = new OfflineCache();
    this._videoPlayer = new VideoPlayer(document.querySelector('video'));
    this._offlineDownloadState = App.VIDEO_DOWNLOAD_STATES.IDLE;
    this._onOnline = this._onOnline.bind(this);
    this._onOffline = this._onOffline.bind(this);
    this._onOfflineToggle = this._onOfflineToggle.bind(this);

    this._videoPlayer.init().then(_ => {
      this._videoPlayer.update();
      this._addEventListeners();
    });

    this._toggleLinkStates().then(_ => {
      LazyLoadImages.init();
    });
  }

  _toggleLinkStates () {
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
      const path = href
          .replace(`${root}/`, '')
          .replace(/\/$/, '')
          .replace(/\//, '-');

      return this._offlineCache.has(path).then(isCached => {
        link.classList.toggle('item--disabled', !isCached);
        if (isCached) {
          return;
        }

        link.addEventListener('click', this._cancel);
      });
    }));
  }

  _cancel (evt) {
    evt.stopImmediatePropagation();
    evt.preventDefault();
  }

  _addEventListeners () {
    this._addStatusChangeListeners();
    this._addOfflineToggleListeners();
  }

  _addStatusChangeListeners () {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker.ready.then(_ => {
      console.log('Adding off/online event handlers.');
      window.addEventListener('online', this._onOnline);
      window.addEventListener('offline', this._onOffline);
    });
  }

  _addOfflineToggleListeners () {
    if (!VideoPlayer.SUPPORTS_OFFLINE) {
      return;
    }

    document.addEventListener('toggle-offline', this._onOfflineToggle);
  }

  _checkForOffline ({manifestPath}={}) {
    return Promise.all([
      this._videoPlayer.isAvailableOffline(manifestPath),
      Promise.resolve(true)
    ]).then(values => {
      return values.every(v => v);
    });
  }

  _onOnline () {
    // TODO: Hide banner;
    this._appConnectivityState = App.CONNECTIVITY_STATES.ONLINE;
    console.log('Online');
    this._toggleLinkStates();
  }

  _onOffline () {
    // TODO: Show banner;
    this._appConnectivityState = App.CONNECTIVITY_STATES.OFFLINE;
    console.log('Offline');
    this._toggleLinkStates();
  }

  _onOfflineToggle (evt) {
    if (!(evt && evt.detail)) {
      console.warn('Unable to locate file to remove');
      return;
    }

    const pagePath = `/${evt.detail.pagePath}`;
    const name = evt.detail.pagePath.replace(/\//, '-');
    const assetPath = evt.detail.assetPath;
    const manifestPath = `${assetPath}/mp4/dash.mpd`;

    if (this._offlineDownloadState === App.VIDEO_DOWNLOAD_STATES.ADDING) {
      if (confirm('Do you want to cancel this download?')) {
        return this._videoPlayer.cancelOfflineFiles(manifestPath);
      }
      return;
    }

    if (this._offlineDownloadState === App.VIDEO_DOWNLOAD_STATES.REMOVING) {
      Toast.create('Removing file. Please wait.', {tag: 'offline'});
      return;
    }

    this._checkForOffline({
      // TODO: check for HTML & other assets.
      manifestPath
    }).then(videoIsAvailableOffline => {
      let job = Promise.resolve();
      if (videoIsAvailableOffline) {
        // TODO: prompt the user to confirm removal properly.
        if (!confirm('Are you sure you wish to remove this video?')) {
          return;
        }

        this._offlineDownloadState = App.VIDEO_DOWNLOAD_STATES.REMOVING;
        Toast.create('Deleting video.', {tag: 'offline'});
        job = job.then(_ => Promise.all([
          this._offlineCache.remove(name),
          this._videoPlayer.removeOfflineFiles(manifestPath)
        ]));
      } else {
        this._offlineDownloadState = App.VIDEO_DOWNLOAD_STATES.ADDING;
        Toast.create('Caching video for offline.', {tag: 'offline'});
        job = job.then(_ => Promise.all([
          this._offlineCache.add(name, assetPath, pagePath),
          this._videoPlayer.addOfflineFiles(manifestPath)
        ]));
      }

      return job.then(_ => {
        switch (this._offlineDownloadState) {
          case App.VIDEO_DOWNLOAD_STATES.ADDING:
              Toast.create('Downloaded file.', {tag: 'offline'});
              break;

          case App.VIDEO_DOWNLOAD_STATES.REMOVING:
              Toast.create('Removed file.', {tag: 'offline'});
              break;
        }

        this._offlineDownloadState = App.VIDEO_DOWNLOAD_STATES.IDLE;
        this._videoPlayer.update();
      }).catch(_ => {
        Toast.create('Cancelled download.', {tag: 'offline'});
        this._offlineDownloadState = App.VIDEO_DOWNLOAD_STATES.IDLE;
      });
    });
  }
}

window.biograf = window.biograf || {};
window.biograf.app = window.biograf.app || new App();
