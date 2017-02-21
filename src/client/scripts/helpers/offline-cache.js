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

class OfflineCache {

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
    if (!Constants.SUPPORTS_CACHING) {
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
    if (!Constants.SUPPORTS_CACHING) {
      return;
    }

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

    return download(name, assets, callbacks);
  }

  prefetch (manifestPath, prefetchLimit=30) {
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
              const chunk = true;
              const headers = new Headers();
              headers.set('range', `bytes=${start}-${end}`);
              const response = fetch(path, {
                headers
              });

              console.log(path, headers.get('range'));

              return {
                request: path,
                response,
                chunk
              };
            });

            return this.download('prefetch', fetches, {
              onProgressCallback () {},
              onCompleteCallback () {
                console.log(`Prefetched ${prefetchLimit}s.`);
              }
            }).catch(_ => {
              console.log('Unable to prefetch video.');
            });
          });
        });
  }

  download (name, fetches, callbacks) {
    name = OfflineCache.convertPathToName(name);

    const downloads = Promise.all(fetches.map(r => r.response));
    return downloads.then(responses => {
      this._trackDownload(responses, callbacks);

      return caches.open(name).then(cache => {
        if (this._cancel.has(name)) {
          this._cancel.delete(name);
          return Promise.reject();
        }

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
            endByte: file.bytes.start - 1,
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
      }
    };

    Array.from(doc.querySelectorAll('AdaptationSet')).forEach(adaptation => {
      const segment = adaptation.querySelector('SegmentBase');
      const baseURL = adaptation.querySelector('BaseURL');
      const type = adaptation.getAttribute('contentType');

      if (!(segment && baseURL)) {
        return;
      }

      const path = baseURL.textContent;
      const range = segment.getAttribute('indexRange');

      if (!range) {
        return;
      }

      const rangeVals = range.split('-');

      ranges[type].path = `${manifestParentPath}/${path}`;
      ranges[type].bytes.start = parseInt(rangeVals[0], 10);
      ranges[type].bytes.end = parseInt(rangeVals[1], 10);
    });

    return ranges;
  }

  _cacheInChunks (cache, response) {
    const clone = response.clone();
    const reader = clone.body.getReader();

    let total = parseInt(response.headers.get('Content-Length'), 10);
    let i = 0;
    let buffer = new Uint8Array(Math.min(total, Constants.CHUNK_SIZE));
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

  _trackDownload (responses, {
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
