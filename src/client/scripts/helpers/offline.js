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
    this._inflight = new Map();
  }

  _op (cb, tag) {
    const offline = new shaka.offline.Storage(this._player);

    if (tag) {
      this._inflight.set(tag, offline);
    }

    return cb(offline).then(value => {
      return offline.destroy().then(_ => {
        this._inflight.delete(tag);
        return value;
      });
    });
  }

  destroy () {
    const jobs = [];
    for (const key of this._inflight.keys()) {
      jobs.push(this._inflight.get(key).destroy());
    }

    return Promise.all(jobs);
  }

  cancel (manifestPath) {
    if (!this._inflight.has(manifestPath)) {
      return Promise.resolve();
    }

    return this._inflight.get(manifestPath).destroy();
  }

  remove (manifestPath) {
    return this.find(manifestPath).then(item => {
      if (!item) {
        console.warn(`Unable to find item with path ${manifestPath}`);
        return Promise.resolve();
      }

      return this._op(offline => {
        return offline.remove(item);
      }, manifestPath);
    });
  }

  find (manifestPath) {
    return this.list().then(items => {
      return items.find(i => (i.originalManifestUri === manifestPath));
    });
  }

  list () {
    return this._op(offline => {
      return offline.list();
    });
  }

  cacheForOffline ({
      manifestPath,
      progressCallback,
      trackSelectionCallback
    }={}) {
    return this._op(offline => {
      offline.configure({
        progressCallback,
        trackSelectionCallback
      });

      return offline.store(manifestPath);
    }, manifestPath);
  }
};

export default OfflineManager;
