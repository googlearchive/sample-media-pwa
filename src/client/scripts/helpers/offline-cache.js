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
      'poster.jpg'
    ];
  }

  constructor () {
    this._cancel = new Set();
  }

  cancel (name) {
    return caches.has(name).then(hasCache => {
      // Can't cancel if the item is already cached.
      if (hasCache) {
        return Promise.reject();
      }

      this._cancel.add(name);
    });
  }

  add (name, assetPath, pagePath) {
    if (!OfflineCache.SUPPORTS_CACHING) {
      return;
    }

    // Get all the individual assets for this video.
    const requests = OfflineCache.ASSET_LIST.map(asset => {
      return fetch(`${assetPath}/${asset}`, {mode: 'cors'});
    });

    // And the page itself.
    requests.push(fetch(pagePath));

    return Promise.all(requests).then(responses => {
      // Create a cache for this item
      return caches.open(name).then(cache => {
        if (this._cancel.has(name)) {
          this._cancel.delete(name);
          return Promise.reject();
        }

        return Promise.all(responses.map(response => {
          cache.put(response.url, response);
        }));
      });
    });
  }

  remove (name) {
    if (this._cancel.has(name)) {
        this._cancel.delete(name);
    }

    return caches.delete(name);
  }

  has (name) {
    return caches.has(name);
  }
}

export default OfflineCache;
