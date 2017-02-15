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

console.log('Totally a Service Worker: {version}!');

/**
 *
 * Copyright 2016 Google Inc. All rights reserved.
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
// importScripts('{{ "/devsummit/static/scripts/cache-manifest.js" | add_hash }}');
// importScripts('{{ "/devsummit/static/scripts/analytics.js" | add_hash }}');

// self.analytics.trackingId = 'UA-41980257-1';

importScripts('{@hash path="dist/client/third_party/libs/shaka-player.compiled.js"}{/hash}');

const NAME = 'Biograf';
const VERSION = '{version}';
const cacheManifest = [];

self.oninstall = evt => {
  const urls = cacheManifest.map(url => {
    return new Request(url, {credentials: 'include'});
  });

  evt.waitUntil(
    caches
      .open(NAME + '-v' + VERSION)
      .then(cache => {
        return cache.addAll(urls);
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
  const cacheName = NAME + '-v' + VERSION;
  const request = evt.request;

  evt.respondWith(
    caches.match(request, {
      cacheName: cacheName
    }).then(response => {
      if (response) {
        return response;
      }
      return fetch(evt.request);
    })
  );
};
