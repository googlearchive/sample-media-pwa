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

class OfflineCache {

  static get SUPPORTS_CACHING () {
    return ('caches' in window);
  }

  static get ASSET_LIST () {
    return [
      'artwork@256.jpg',
      'artwork@512.jpg',
      'poster-small.jpg',
      'poster.jpg',
      {
        // TODO: Make this based on user preference.
        src: 'mp4/offline-720p.mpd',
        dest: 'mp4/dash.mpd'
      },
      // TODO: Make this based on browser support.
      'mp4/v-0720p-2500k-libx264.mp4',
      'mp4/a-eng-0128k-aac.mp4'
    ];
  }

  static has (name) {
    name = this.convertPathToName(name);
    return caches.has(name);
  }

  static convertPathToName (path) {
    return path
        .replace(/^\//, '')
        .replace(/\/$/, '')
        .replace(/\//, '-');
  }

  constructor () {
    this._cancel = new Set();
  }

  cancel (name) {
    name = OfflineCache.convertPathToName(name);
    return this.has(name).then(hasCache => {
      // Can't cancel if the item is already cached.
      if (hasCache) {
        return Promise.reject();
      }

      this._cancel.add(name);
    });
  }

  add (name, assetPath, pagePath, callbacks) {
    if (!OfflineCache.SUPPORTS_CACHING) {
      return;
    }

    name = OfflineCache.convertPathToName(name);
    const assets = [];

    // The meta assets.
    OfflineCache.ASSET_LIST.forEach(asset => {
      const src = asset.src || asset;
      const dest = asset.dest || asset;

      assets.push({
        request: `${assetPath}/${dest}`,
        response: fetch(`${assetPath}/${src}`, {mode: 'cors'})
      });
    });

    // And the page itself.
    assets.push({
      request: pagePath,
      response: fetch(pagePath)
    });

    const downloads = Promise.all(assets.map(r => r.response));
    return downloads.then(responses => {
      // TODO: Tee the fetch stream so that we can do progress downloads.
      this.trackDownload(responses, callbacks);

      return caches.open(name).then(cache => {
        if (this._cancel.has(name)) {
          this._cancel.delete(name);
          return Promise.reject();
        }

        return Promise.all(assets.map(asset => {
          return asset.response.then(r => {
            cache.put(asset.request, r);
          });
        }));
      });
    });
  }

  trackDownload (responses, {
    onProgressCallback,
    onCompleteCallback
  }={
    onProgressCallback () {},
    onCompleteCallback () {}
  }) {
    let byteCount = 0;
    const byteTotal = responses.reduce((byteTotal, r) => {
      return byteTotal + parseInt(r.headers.get('Content-Length'), 10);
    }, 0);

    responses.forEach(response => {
      const clone = response.clone();
      const onStreamData = result => {
        if (result.done) {
          if (byteCount !== byteTotal) {
            return;
          }

          onCompleteCallback(byteTotal);
          return;
        }

        byteCount += result.value.length;
        onProgressCallback(byteCount, byteTotal);
        return reader.read().then(onStreamData);
      };

      const reader = clone.body.getReader();
      reader.read().then(onStreamData);
    });
  }

  remove (name) {
    name = OfflineCache.convertPathToName(name);
    if (this._cancel.has(name)) {
      this._cancel.delete(name);
    }

    return caches.delete(name);
  }
}

export default OfflineCache;
