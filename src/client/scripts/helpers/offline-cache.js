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

  static get CHUNK_SIZE () {
    // Half a meg chunks.
    return 1024 * 512;
  }

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
      {
        src: 'mp4/v-0720p-2500k-libx264.mp4',
        chunk: true
      },
      {
        src: 'mp4/a-eng-0128k-aac.mp4',
        chunk: true
      }
    ];
  }

  static has (name) {
    if (!OfflineCache.SUPPORTS_CACHING) {
      return Promise.resolve(false);
    }

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
      const dest = asset.dest || asset.src || asset;
      const chunk = asset.chunk || false;

      assets.push({
        request: `${assetPath}/${dest}`,
        response: fetch(`${assetPath}/${src}`, {mode: 'cors'}),
        chunk
      });
    });

    // And the page itself.
    assets.push({
      request: pagePath,
      response: fetch(pagePath),
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
          return asset.response.then(response => {
            if (!asset.chunk) {
              return cache.put(asset.request, response);
            }

            return this._cacheInChunks(cache, response);
          });
        }));
      });
    });
  }

  _cacheInChunks (cache, response) {
    const clone = response.clone();
    const reader = clone.body.getReader();

    let total = parseInt(response.headers.get('Content-Length'), 10);
    let i = 0;
    let buffer = new Uint8Array(Math.min(total, OfflineCache.CHUNK_SIZE));
    let bufferId = 0;

    const commitBuffer = bufferOut => {
      const cacheId = clone.url + '_' + bufferId;
      const chunkResponse = new Response(bufferOut, {
        headers: response.headers
      });

      cache.put(cacheId, chunkResponse);
    };

    const onStreamData = result => {
      if (result.done) {
        commitBuffer(buffer, bufferId);
        return;
      }

      // Copy the bytes over.
      for (let b = 0; b < result.value.length; b++) {
        buffer[i++] = result.value[b];

        if (i === OfflineCache.CHUNK_SIZE) {
          // Commit this buffer.
          commitBuffer(buffer, bufferId);

          // Reduce the expected amount, and go again.
          total -= OfflineCache.CHUNK_SIZE;
          i = 0;
          buffer = new Uint8Array(Math.min(total, OfflineCache.CHUNK_SIZE));
          bufferId++;
        }
      }

      // Get the next chunk.
      return reader.read().then(onStreamData);
    };

    reader.read().then(onStreamData);
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
