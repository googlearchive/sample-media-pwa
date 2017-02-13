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

class OfflineManager {

  static get OFFLINE_SUPPORTED () {
    return shaka.offline.Storage.support();
  }

  constructor (_player) {
    this._player = _player;
    this._offline = new shaka.offline.Storage(this._player);
  }

  destroy () {
    return this._offline.destroy().then(_ => {
      this._offline = null;
    });
  }

  remove (manifestPath) {
    if (!this._offline) {
      throw new Error('This OfflineManager has been destroyed.');
    }

    return this.find(manifestPath).then(item => {
      if (!item) {
        return Promise.resolve();
      }

      return this._offline.remove(item);
    });
  }

  find (manifestPath) {
    return this.list().then(items => {
      return items.find(i => (i.originalManifestUri === manifestPath));
    });
  }

  list () {
    if (!this._offline) {
      throw new Error('This OfflineManager has been destroyed.');
    }

    return this._offline.list();
  }

  updateManifestForOfflineIfPossible (manifest) {
    if (!this._offline) {
      throw new Error('This OfflineManager has been destroyed.');
    }

    return this._offline.list().then(offlineContent => {
      console.log('offline content', offlineContent);

      return manifest;
    });
  }

  cacheForOffline ({manifestPath, progressCallback}={}) {
    if (!this._offline) {
      throw new Error('This OfflineManager has been destroyed.');
    }

    this._offline.configure({
      progressCallback
    });

    this._offline.store(manifestPath)
        .then(_ => {
          this.destroy();
        });
  }
};

export default OfflineManager;
