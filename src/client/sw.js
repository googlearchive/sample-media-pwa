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

/* global importScripts, cacheManifest, clients */
// importScripts('{{ "/devsummit/static/scripts/analytics.js" | add_hash }}');
// self.analytics.trackingId = 'UA-41980257-1';

importScripts('{@hash path="dist/client/cache-manifest.js"}{/hash}');
importScripts('{@hash path="dist/client/third_party/libs/shaka-player.compiled.js"}{/hash}');
importScripts('{@hash path="dist/client/scripts/ranged-response.js"}{/hash}');


// TODO: Hook this up to pull from Constants.

const NAME = 'Biograf';
const VERSION = '{version}';

self.oninstall = evt => {
  evt.waitUntil(
    caches
      .open(NAME + '-v' + VERSION)
      .then(cache => {
        const toCache = [
          ...pathManifest,
          ...cacheManifest
        ];

        return toCache.map(url => {
          // For each URL in the cacheManifest do a check in the current cache,
          // and copy across any existing asset (we're using hashing so we
          // shouldn't get mistaken hits).
          return caches.match(url).then(cachedResponse => {
            if (!cachedResponse || pathManifest.indexOf(url) !== -1) {
              // Anything not already cached should be pulled from the network.
              // Same is true for the home page.
              console.log('Getting ' + url + ' from network.');
              return fetch(url).then(response => cache.put(url, response));
            }

            return cache.put(url, cachedResponse);
          });
        });
      }));

  self.skipWaiting();
};

self.onactivate = _ => {
  const currentCacheName = NAME + '-v' + VERSION;
  caches.keys().then(cacheNames => {
    return Promise.all(
      cacheNames.map(cacheName => {
        if (cacheName.indexOf(NAME) === -1) {
          return null;
        }

        if (cacheName !== currentCacheName) {
          return caches.delete(cacheName);
        }

        return null;
      })
    );
  });

  self.clients.claim();
};

self.onmessage = evt => {
  switch (evt.data) {
    case 'version':
      evt.source.postMessage({
        version: VERSION
      });

    case 'offline':
      return;
  }
};

self.onfetch = evt => {
  const FETCH_TIMEOUT = 10000;
  const request = evt.request;

  evt.respondWith(
    RangedResponse.canHandle(request).then(canHandleRequest => {
      if (canHandleRequest) {
        return RangedResponse.create(request);
      }

      // Not a range request that can be handled, so try a normal cache lookup
      // followed by falling back to fetching.
      return caches.match(request)
        .then(response => {
          if (response) {
            return response;
          }

          return Promise.race([
            fetch(evt.request),
            new Promise(resolve => {
              setTimeout(resolve, FETCH_TIMEOUT);
            })
          ]).then(response => {
            if (response) {
              return response;
            }

            return caches.match('/404/');
          });
        });
    })
  );
};
