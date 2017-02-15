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

class App {

  static get OFFLINE_STATES () {
    return {
      IDLE: 1,
      REMOVING: 2,
      ADDING: 3
    };
  }

  constructor () {
    ServiceWorkerInstaller.init();

    this._videoPlayer = new VideoPlayer(document.querySelector('video'));
    this._offlineDownloadState = App.OFFLINE_STATES.IDLE;
    this._onOnline = this._onOnline.bind(this);
    this._onOffline = this._onOffline.bind(this);
    this._onOfflineToggle = this._onOfflineToggle.bind(this);

    this._videoPlayer.init().then(_ => {
      this._videoPlayer.update();
      this._addEventListeners();
    });
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

  _addOfflineFiles () {
    return Promise.resolve();
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

  _removeOfflineFiles () {
    return Promise.resolve();
  }

  _onOnline () {
    console.log('Is online.');
  }

  _onOffline () {
    console.log('Is offline.');
  }

  _onOfflineToggle (evt) {
    if (!(evt && evt.detail)) {
      console.warn('Unable to locate file to remove');
      return;
    }

    const manifestPath = evt.detail;
    if (this._offlineDownloadState === App.OFFLINE_STATES.ADDING) {
      if (confirm('Do you want to cancel this download?')) {
        return this._videoPlayer.cancelOfflineFiles(manifestPath);
      }
      return;
    }

    if (this._offlineDownloadState === App.OFFLINE_STATES.REMOVING) {
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

        this._offlineDownloadState = App.OFFLINE_STATES.REMOVING;
        Toast.create('Deleting video.', {tag: 'offline'});
        job = job.then(_ => Promise.all([
          this._removeOfflineFiles(),
          this._videoPlayer.removeOfflineFiles(manifestPath)
        ]));
      } else {
        this._offlineDownloadState = App.OFFLINE_STATES.ADDING;
        Toast.create('Caching video for offline.', {tag: 'offline'});
        job = job.then(_ => Promise.all([
          this._addOfflineFiles(),
          this._videoPlayer.addOfflineFiles(manifestPath)
        ]));
      }

      return job.then(_ => {
        switch (this._offlineDownloadState) {
          case App.OFFLINE_STATES.ADDING:
              Toast.create('Downloaded file.', {tag: 'offline'});
              break;

          case App.OFFLINE_STATES.REMOVING:
              Toast.create('Removed file.', {tag: 'offline'});
              break;
        }

        this._offlineDownloadState = App.OFFLINE_STATES.IDLE;
        this._videoPlayer.update();
      }).catch(_ => {
        Toast.create('Cancelled download.', {tag: 'offline'});
        this._offlineDownloadState = App.OFFLINE_STATES.IDLE;
      });
    });
  }
}

window.biograf = window.biograf || {};
window.biograf.app = window.biograf.app || new App();
