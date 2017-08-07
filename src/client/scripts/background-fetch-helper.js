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

// import Constants from './constants/constants';
import Utils from './helpers/utils';
import idbKeyval from '../third_party/libs/idb-keyval';

class BackgroundFetchHelper {

  constructor () {
    this._onBackgroundFetched = this._onBackgroundFetched.bind(this);
    this._onBackgroundFetchFailed = this._onBackgroundFetchFailed.bind(this);

    self.addEventListener('backgroundfetchfail',
        this._onBackgroundFetchFailed);

    self.addEventListener('backgroundfetched',
        this._onBackgroundFetched);
  }

  fetch (id, assets) {
    // Store the assets that are being background fetched because there may be
    // a teardown in the SW and the responses will need to be hooked back
    // up when the responses come in.
    idbKeyval.set(`bg-${id}`, assets).then(_ => {
      const requests = assets.map(asset => {
        const {url, options} = asset.responseInfo;
        if (options.headers) {
          options.headers = new Headers(options.headers);
        }

        return new Request(url, options);
      });

      // TODO: Update these to be based on the downloaded show.
      const options = {
        title: 'Downloading show for offline.'
      };
      registration.backgroundFetch.fetch(id, requests, options);
    });
  }

  _onBackgroundFetched (evt) {
    // FIXME: `evt.tag` is deprecated in favour of `evt.id`. Remove this or
    // around the Chrome 62 stable release, which is late October 2017.
    const id = evt.id || evt.tag;

    idbKeyval.get(`bg-${id}`).then(assets => {
      if (!assets) {
        console.error('Unknown background fetch.');
        return;
      }

      console.log(assets);

      return caches.open(id).then(cache => {
        const fetches = evt.fetches;
        return Promise.all(assets.map(asset => {
          const fetch = fetches.find(r => {
            return (r.response.url === asset.responseInfo.url ||
                    r.response.url.endsWith(asset.responseInfo.url));
          });

          if (!fetch) {
            console.log(
                `Unable to find response for ${asset.responseInfo.url}`);
            return;
          }

          const response = fetch.response;
          if (!asset.chunk) {
            return cache.put(asset.request, response);
          }

          return Utils.cacheInChunks(cache, response);
        }));
      }).then(_ => {
        this._notifyAllClients({
          offline: true,
          success: true,
          name: id
        });

        this._teardown(id);
      });
    });
  }

  _notifyAllClients (msg) {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        console.log(msg, client);
        client.postMessage(msg);
      });
    });
  };

  _onBackgroundFetchFailed (evt) {
    // FIXME: `evt.tag` is deprecated in favour of `evt.id`. Remove this or
    // around the Chrome 62 stable release, which is late October 2017.
    const id = evt.id || evt.tag;

    this._notifyAllClients({
      offline: true,
      success: false,
      name: id
    });

    this._teardown(id);
  }

  _teardown (id) {
    return idbKeyval.delete(`bg-${id}`);
  }
}

self.BackgroundFetchHelper = new BackgroundFetchHelper();
