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

import Constants from '../constants/constants';
import LicensePersister from './license-persister';

class OfflineCache {

  static has (name) {
    if (!Constants.SUPPORTS_CACHING) {
      return Promise.resolve(false);
    }

    name = this.convertPathToName(name);

    // If the download is in flight, then assume we simply don't have it,
    // which should fall things back to the network.
    if (OfflineCache.getInFlight(name)) {
      console.log('In flight::do not have!');
      return Promise.resolve(false);
    }

    return this.purgePartialDownloads(name).then(_ => {
      return caches.has(name);
    });
  }

  static addInFlight (name) {
    if (!this._inflight) {
      this._inflight = new Set();
    }

    name = this.convertPathToName(name);
    console.log('Setting in-flight for ', name);
    return this._inflight.add(name);
  }

  static getInFlight (name) {
    if (!this._inflight) {
      this._inflight = new Set();
    }

    name = this.convertPathToName(name);
    return this._inflight.has(name);
  }

  static removeInFlight (name) {
    if (!this._inflight) {
      this._inflight = new Set();
    }

    console.log('Removing in-flight for ', name);
    name = this.convertPathToName(name);
    return this._inflight.delete(name);
  }

  static purgePartialDownloads (name) {
    name = this.convertPathToName(name);
    return caches.has(name).then(hasCacheOfName => {
      if (!hasCacheOfName) {
        return;
      }

      return caches.open(name)
          // 1. Get all the items in the cache.
          .then(cache => cache.keys())
          .then(cacheItems => {
            // 2. Locate the chunks, if there are any.
            let maxIndex = Number.NEGATIVE_INFINITY;
            let url = '';

            cacheItems.forEach(item => {
              const endsInNumber = /_(\d+)$/.exec(item.url);
              if (!endsInNumber) {
                return;
              }

              const chunkIndex = parseInt(endsInNumber[1], 10);
              if (chunkIndex < maxIndex) {
                return;
              }

              maxIndex = chunkIndex;
              url = item.url;
            });

            // No chunks stored at all - delete.
            if (maxIndex === Number.NEGATIVE_INFINITY || url === '') {
              return caches.delete(name);
            }

            // 3. Compare the largest chunk index to what we'd expect to have.
            return caches.match(url).then(chunk => {
              return parseInt(chunk.headers.get('Content-Length'), 10);
            }).then(videoSize => {
              if (isNaN(videoSize)) {
                return;
              }

              const expectedIndex =
                  Math.floor(videoSize / Constants.CHUNK_SIZE);
              if (expectedIndex == maxIndex) {
                return;
              }

              // This is a partial download - purge it.
              console.log(`Purging ${name}`);
              return Promise.all([
                caches.delete(name),
                LicensePersister.remove(name)
              ]);
            });
          });
    });
  }

  static hasPrefetched (assetPath) {
    if (!Constants.SUPPORTS_CACHING) {
      return Promise.resolve(false);
    }

    return caches.open('prefetch').then(cache => {
      return cache.match(`${assetPath}/${Constants.PREFETCH_VIDEO_PATH}_0`);
    });
  }

  static removeAllPrefetched () {
    return caches.delete('prefetch');
  }

  static getAll () {
    return caches.keys().then(caches => {
      return caches.filter(c => {
        return !(c === 'prefetch' || c.startsWith(Constants.APP_NAME));
      });
    });
  }

  static convertPathToName (path) {
    return path
        .replace(/^\//, '')
        .replace(/\/$/, '');
  }

  constructor () {
    this._cancel = new Set();
  }

  cancel (name) {
    name = OfflineCache.convertPathToName(name);
    return OfflineCache.has(name).then(hasCache => {
      // Can't cancel if the item is already cached.
      if (hasCache) {
        return Promise.reject();
      }

      console.log('Setting cancel for ' + name);
      this._cancel.add(name);
    });
  }

  add (name, assetPath, pagePath, callbacks, drmInfo) {
    if (!Constants.SUPPORTS_CACHING) {
      return;
    }

    const assets = [];
    const assetsToCache = [
      // The meta asssets.
      ...Constants.OFFLINE_ASSET_LIST,

      // The video.
      {
        src: Constants.OFFLINE_VIDEO_PATH,
        chunk: true
      },

      // The audio.
      {
        src: Constants.OFFLINE_AUDIO_PATH,
        chunk: true
      }
    ];

    // The meta assets.
    assetsToCache.forEach(asset => {
      const src = asset.src || asset;
      const dest = asset.dest || asset.src || asset;
      const chunk = asset.chunk || false;

      assets.push({
        request: `${assetPath}/${dest}`,
        response: fetch(`${assetPath}/${src}`, {mode: 'cors'}),
        chunk
      });
    });

    // Ensure that the request for the page isn't gzipped in response.
    const headers = new Headers();
    headers.set('X-No-Compression', true);

    assets.push({
      request: pagePath,
      response: fetch(pagePath, {
        headers
      })
    });

    const add = [];
    if (drmInfo) {
      console.log('Acquiring persistent license');
      add.push(LicensePersister.persist(name, drmInfo));
    }

    add.push(this._download(name, assets, callbacks));

    // Mark the download as being in-flight.
    OfflineCache.addInFlight(name);
    return Promise.all(add);
  }

  prefetch (manifestPath, prefetchLimit=30) {
    if (typeof shaka === 'undefined') {
      return;
    }

    const makeRequest = ({path, start, end, chunk}={}) => {
      const headers = new Headers();
      if (typeof start !== 'undefined' && typeof end !== 'undefined') {
        headers.set('range', `bytes=${start}-${end}`);

        if (!chunk) {
          throw new Error(`Unable to cache unchunked, ranged requests.
              (${path})`);
        }
      }

      const response = fetch(path, {
        mode: 'cors',
        headers
      });

      return {
        request: path,
        response,
        chunk
      };
    };

    return this._getManifest(manifestPath)
        .then(manifest => this._getRanges(manifestPath, manifest))
        .then(ranges => {
          return Promise.all([
            this._getFileSegments(ranges.audio),
            this._getFileSegments(ranges.video)
          ]).then(segments => {
            return [
              segments[0].filter(s => s.endTime < prefetchLimit),
              segments[1].filter(s => s.endTime < prefetchLimit)
            ];
          })
          .then(filteredSegments => {
            // One fetch for audio, another for video.
            const fetches = filteredSegments.map((segments, idx) => {
              const {start, end} = segments.reduce((prev, s) => {
                prev.start = Math.min(prev.start, s.startByte);
                prev.end = Math.max(prev.end, s.endByte);

                return prev;
              },
              {
                start: Number.POSITIVE_INFINITY,
                end: Number.NEGATIVE_INFINITY
              });

              // Create a fetch for the particular byte range we want to use.
              const path = idx === 0 ? ranges.audio.path : ranges.video.path;
              return makeRequest({path, start, end, chunk: true});
            });

            // Add on the requests for the first n bytes of the other
            // representations that equate to the headers. It means that we
            // won't need to wait for their bytes.
            ranges.extra.forEach(extra => {
              fetches.push(makeRequest({
                path: extra.path,
                start: 0,
                end: extra.end,
                chunk: true
              }));
            });

            fetches.push(makeRequest({path: manifestPath}));

            return this._download('prefetch', fetches, {
              onProgressCallback () {},
              onCompleteCallback () {
                console.log(`Prefetched ${prefetchLimit}s.`);
              }
            }).catch(e => {
              console.error(e);
            });
          })
          .catch(prefetchErr => {
            console.warn('Unable to prefetch content:', prefetchErr);
          });
        });
  }

  _download (name, fetches, callbacks) {
    name = OfflineCache.convertPathToName(name);

    const downloads = Promise.all(fetches.map(r => r.response));
    return downloads.then(responses => {
      this._trackDownload(name, responses, callbacks);

      return caches.open(name).then(cache => {
        return Promise.all(fetches.map(asset => {
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

  _getManifest (manifestPath) {
    return fetch(manifestPath).then(r => r.text()).then(dashManifest => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(dashManifest, 'application/xml');

      if (doc.querySelector('parsererror')) {
        return Promise.reject('Unable to parse manifest.');
      }

      return doc;
    });
  }

  _getFileSegments (file) {
    if (file.path.endsWith('mp4')) {
      return this._getMP4FileSegments(file);
    } else if (file.path.endsWith('webm')) {
      return this._getWebMFileSegments(file);
    }

    throw new Error(`Unsupported file type: ${file.path}`);
  }

  _getMP4FileSegments (file) {
    const headers = new Headers();
    headers.set('range', `bytes=${file.bytes.start}-${file.bytes.end}`);

    return fetch(file.path, {headers})
        .then(r => r.arrayBuffer())
        .then(sidx => {
          const refs = shaka.media.Mp4SegmentIndexParser(sidx, 0, [], 0);
          refs.forEach(ref => {
            ref.startByte += file.bytes.start;
            ref.endByte += file.bytes.start;
          });

          refs.push({
            startByte: 0,
            endByte: file.bytes.end - 1,
            startTime: 0,
            endTime: 0
          });

          return refs;
        });
  }

  _getWebMFileSegments (file) {
    // Make a request from 0 to the end index indicated in the DASH manifest.
    // This represents both the Cues and the WebM header, which can then be
    // sliced out as needed.
    const headers = new Headers();
    headers.set('range', `bytes=0-${file.bytes.end}`);

    if (file.path === null) {
      console.warn('Unable to locate file to prefetch');
      return;
    }

    return fetch(file.path, {headers})
        .then(r => r.arrayBuffer())
        .then(data => {
          const cuesData = data.slice(file.bytes.start);
          const initData = data.slice(0, file.bytes.start);
          const parser = new shaka.media.WebmSegmentIndexParser();
          const refs = parser.parse(cuesData, initData, [], 0);

          refs.forEach(ref => {
            ref.startByte += file.bytes.start;
            ref.endByte += file.bytes.start;
          });

          refs.push({
            startByte: 0,
            endByte: file.bytes.end - 1,
            startTime: 0,
            endTime: 0
          });

          return refs;
        });
  }

  _getRanges (manifestPath, doc) {
    const manifestParentPath = manifestPath.replace(/\/[^\/]*$/, '');
    const ranges = {
      video: {
        path: null,
        bytes: {
          start: null,
          end: null
        }
      },
      audio: {
        path: null,
        bytes: {
          start: null,
          end: null
        }
      },
      extra: []
    };

    Array.from(doc.querySelectorAll('AdaptationSet')).forEach(adaptation => {
      const baseURLs = adaptation.querySelectorAll('BaseURL');
      const type = adaptation.getAttribute('contentType');

      if (!baseURLs.length) {
        return;
      }

      baseURLs.forEach(baseURL => {
        const segment = baseURL.parentNode.querySelector('SegmentBase');
        const path = baseURL.textContent;
        const range = segment.getAttribute('indexRange');

        if (!segment) {
          return;
        }

        if (!range) {
          return;
        }

        const rangeVals = range.split('-');
        const prefetchPath = `mp4/${path}`;

        if (prefetchPath === Constants.PREFETCH_VIDEO_PATH ||
            prefetchPath === Constants.PREFETCH_AUDIO_PATH) {
          ranges[type].path = `${manifestParentPath}/${path}`;
          ranges[type].bytes.start = parseInt(rangeVals[0], 10);
          ranges[type].bytes.end = parseInt(rangeVals[1], 10);
        } else {
          // We can grab the bytes for any other representations as well, so that
          // when the player boots up and asks for their headers we can pass them
          // back super quickly from the cache.
          ranges.extra.push({
            path: `${manifestParentPath}/${path}`,
            end: parseInt(rangeVals[1], 10)
          });
        }
      });
    });

    return ranges;
  }

  _cacheInChunks (cache, response) {
    const clone = response.clone();
    const reader = clone.body.getReader();
    const contentRange = clone.headers.get('content-range');
    const headers = new Headers(clone.headers);

    // If we've made a range request we will now need to check the full
    // length of the video file, and update the header accordingly. This
    // will be for the case where we're prefetching the video, and we need
    // to pretend that the entire file is available despite only part
    // requesting the file.
    if (contentRange) {
      headers.set('Content-Length',
          parseInt(contentRange.split('/')[1], 10));
    }

    let total = parseInt(response.headers.get('content-length'), 10);
    let i = 0;
    let buffer = new Uint8Array(Math.min(total, Constants.CHUNK_SIZE));
    let bufferId = 0;

    const commitBuffer = bufferOut => {
      headers.set('x-chunk-size', bufferOut.byteLength);
      const cacheId = clone.url + '_' + bufferId;
      const chunkResponse = new Response(bufferOut, {
        headers
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

        if (i === Constants.CHUNK_SIZE) {
          // Commit this buffer.
          commitBuffer(buffer, bufferId);

          // Reduce the expected amount, and go again.
          total -= Constants.CHUNK_SIZE;
          i = 0;
          buffer = new Uint8Array(Math.min(total, Constants.CHUNK_SIZE));
          bufferId++;
        }
      }

      // Get the next chunk.
      return reader.read().then(onStreamData);
    };

    reader.read().then(onStreamData);
  }

  _trackDownload (name, responses, {
    onProgressCallback,
    onCompleteCallback,
    onCancelCallback
  }={
    onProgressCallback () {},
    onCompleteCallback () {},
    onCancelCallback () {}
  }) {
    let byteCount = 0;
    const byteTotal = responses.reduce((byteTotal, r) => {
      let responseLength = parseInt(r.headers.get('Content-Length'), 10);
      if (Number.isNaN(responseLength)) {
        responseLength = 0;
      }

      return byteTotal + responseLength;
    }, 0);

    Promise.all(responses.map(response => {
      return new Promise((resolve, reject) =>{
        const clone = response.clone();
        const onStreamData = result => {
          if (result.done || this._cancel.has(name)) {
            return resolve();
          }

          byteCount += result.value.length;
          onProgressCallback(byteCount, byteTotal);
          return reader.read().then(onStreamData);
        };

        const reader = clone.body.getReader();
        reader.read().then(onStreamData);
      });
    })).then(_ => {
      if (this._cancel.has(name)) {
        this._cancel.delete(name);
        OfflineCache.removeInFlight(name);
        return onCancelCallback(name);
      }

      OfflineCache.removeInFlight(name);
      onCompleteCallback(byteTotal);
    });
  }

  remove (name) {
    name = OfflineCache.convertPathToName(name);
    if (this._cancel.has(name)) {
      this._cancel.delete(name);
    }

    return Promise.all([
      caches.delete(name),
      LicensePersister.remove(name)
    ]);
  }
}

export default OfflineCache;
