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

import Constants from './constants/constants';

/**
 * Thanks to Jake Archibald for the code that became this helper.
 * @see https://github.com/jakearchibald/range-request-test/blob/master/static/sw.js
 */
class RangedResponse {
  static _isRangeRequest (request) {
    const header = request.headers.get('Range');
    if (!header) {
      return false;
    }

    const rangeHeader = header.trim().toLowerCase();
    // Not a range request
    if (!rangeHeader) {
      return false;
    }

    return true;
  }

  static getBestCacheMatch (request) {
    return caches.keys().then(cacheNames => {
      return Promise.all(cacheNames.map(cacheName => {
        return caches.match(`${request.url}_0`, {cacheName: cacheName})
            .then(response => {
              if (response) {
                return cacheName;
              }

              return null;
            });
      }));
    }).then(possibleMatches => {
      let cachesWithMatch = possibleMatches.filter(m => m !== null);
      if (cachesWithMatch.length === 0) {
        return null;
      }

      // If there's more than one match, exclude the prefetch cache.
      if (cachesWithMatch.length > 1) {
        cachesWithMatch = cachesWithMatch.filter(m => m !== 'prefetch');
      }

      // Now pick the first possible match.
      return cachesWithMatch[0];
    });
  }

  static canHandle (request) {
    if (!RangedResponse._isRangeRequest(request)) {
      return Promise.resolve(false);
    }

    return this.getBestCacheMatch(request).then(cacheName => {
      if (!cacheName) {
        return false;
      }

      // Check for the first chunk in cache storage.
      return caches.match(`${request.url}_0`, {cacheName: cacheName})
        .then(firstChunk => {
          if (!firstChunk) {
            return false;
          }

          // Failing that, look up the chunks that would be needeed, and assume
          // that if we need -- say -- chunks 1 to 10, that checking for 1 & 10
          // is sufficient for success.
          const header = request.headers.get('Range');
          const rangeHeader = header.trim().toLowerCase();
          const size = parseInt(firstChunk.headers.get('Content-Length'), 10);
          if (!size) {
            return false;
          }

          const {start, end} = this._getStartAndEnd(rangeHeader, size);
          const startIndex = Math.floor(start / Constants.CHUNK_SIZE);
          const endIndex = Math.floor(end / Constants.CHUNK_SIZE);

          return Promise.all([
            caches.match(`${request.url}_${startIndex}`, {cacheName: cacheName}),
            caches.match(`${request.url}_${endIndex}`, {cacheName: cacheName})
          ]).then(v => {
            // Start by checking that there are at least two responses.
            let hasData = v.every(r => !!r);

            if (!hasData) {
              return false;
            }

            // If both chunks exist, we need to refine the query further by
            // ensuring that the endIndex chunk has actually got sufficient
            // bytes to respond.
            const chunkSize = parseInt(v[1].headers.get('x-chunk-size'), 10);
            const finalByteInEndChunk =
                endIndex * Constants.CHUNK_SIZE + chunkSize;

            if (finalByteInEndChunk < end) {
              console.log(`${request.url}
                  Cannot handle range request because unable to find
                  final chunk byte is at ${finalByteInEndChunk}, but end
                  requires ${end}.`);
            }

            return finalByteInEndChunk >= end;
          });
        });
    });
  }

  static _isOpaqueOrError (response) {
    if (response.status != 200) {
      return response;
    }
  }

  static _getStartAndEnd (rangeHeader, size) {
    if (!rangeHeader.startsWith('bytes=')) {
      throw new Error('Invalid range unit');
    }

    const rangeParts = /(\d*)-(\d*)/.exec(rangeHeader);
    if (!rangeParts[1] && !rangeParts[2]) {
      throw new Error('Invalid range unit');
    }

    let start = 0;
    let end = 0;
    if (rangeParts[1] === '') {
      start = size - Number(rangeParts[2]);
      end = size;
    } else if (rangeParts[2] === '') {
      start = Number(rangeParts[1]);
      end = size;
    } else {
      start = Number(rangeParts[1]);
      // Range values are inclusive, so add 1 to the value.
      end = Number(rangeParts[2]) + 1;
    }

    if (start < 0) {
      throw new Error('Range not satisfiable');
    }

    return {
      start,
      end
    };
  }

  static _createRangedResponse (blob, headers, start, end, offset=0) {
    let s = start - offset;
    let e = end - offset;
    let total = parseInt(headers.get('Content-Length'), 10);

    if (Number.isNaN(total)) {
      throw new Error('Unable to create byte range: content-length not set.');
    }

    const slicedBlob = blob.slice(s, e);
    const slicedResponse = new Response(slicedBlob, {
      status: 206,
      headers
    });

    slicedResponse.headers.set('X-From-Cache', 'true');
    slicedResponse.headers.set('Content-Length', slicedBlob.size);
    slicedResponse.headers.set('Content-Range',
        `bytes ${start}-${end - 1}/${total}`);
    return slicedResponse;
  }

  static create (request) {
    if (!RangedResponse._isRangeRequest(request)) {
      return response;
    }

    return this.getBestCacheMatch(request).then(cacheName => {
      if (!cacheName) {
        return null;
      }

      return caches.match(request.url + '_0', {cacheName: cacheName})
          .then(chunkedResponse => {
            if (chunkedResponse) {
              return RangedResponse._createFromChunks(request, cacheName);
            }

            return RangedResponse._createFromEntireBuffer(request, cacheName);
          });
    });
  }

  static _createFromEntireBuffer (request, cacheName) {
    return caches.match(request, {cacheName: cacheName}).then(response => {
      if (RangedResponse._isOpaqueOrError(response)) {
        return response;
      }

      const header = request.headers.get('Range');
      const rangeHeader = header.trim().toLowerCase();

      try {
        const {start, end} = RangedResponse._getStartAndEnd(rangeHeader);

        return response.blob().then(blob => {
          return this._createRangedResponse(blob,
              response.headers, start, end);
        });
      } catch (e) {
        return new Response(e.message, {status: 400});
      };
    });
  }

  static _createFromChunks (request, cacheName) {
    try {
      const header = request.headers.get('Range');
      const rangeHeader = header.trim().toLowerCase();
      const {start, end} = RangedResponse._getStartAndEnd(rangeHeader);
      const startIndex = Math.floor(start / Constants.CHUNK_SIZE);
      const endIndex = Math.floor(end / Constants.CHUNK_SIZE);
      const offset = startIndex * Constants.CHUNK_SIZE;

      // If the start and end come from the same chunk then pull that chunk
      // from the cache and use it directly.
      if (startIndex === endIndex) {
        return caches.match(request.url + '_' + startIndex, {cacheName: cacheName})
            .then(response => {
              return response.blob().then(blob => {
                return RangedResponse._createRangedResponse(blob,
                  response.headers, start, end, offset);
              });
            });
      }

      const bufferSize = (endIndex - startIndex + 1) * Constants.CHUNK_SIZE;
      const responseBuffer = new ArrayBuffer(bufferSize);
      const responseView = new Uint8Array(responseBuffer);
      const cachedResponses = [];

      for (let i = startIndex; i <= endIndex; i++) {
        cachedResponses.push(
          caches.match(request.url + '_' + i, {cacheName: cacheName})
        );
      }

      let headers;
      return Promise.all(cachedResponses)
          .then(responses => {
            if (responses.length === 0) {
              return Promise.reject('Unable to locate chunks.');
            }

            // Take the first set of headers as representative.
            headers = responses[0].headers;
            return Promise.all(responses.map(r => r.arrayBuffer()));
          })
          .then(buffers => {
            // Copy the buffers into the response buffer for us to slice.
            let k = 0;
            buffers.forEach(buffer => {
              const view = new Uint8Array(buffer);
              for (let j = 0; j < view.length; j++) {
                responseView[k++] = view[j];
              }
            });
          }).then(_ => {
            // The start and end indexes need shifting back because we're not
            // slicing the entire array buffer, just the relevant chunks.
            const blob = new Blob([responseBuffer]);
            return RangedResponse._createRangedResponse(blob, headers,
                start, end, offset);
          });
    } catch (e) {
      console.log(e);
      return new Response(e.message, {status: 400});
    };
  }
}

self.RangedResponse = RangedResponse;
