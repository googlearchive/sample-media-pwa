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

import OfflineCache from './helpers/offline-cache';

/**
 * Thanks to Jake Archibald for the code that became this helper.
 * @see https://github.com/jakearchibald/range-request-test/blob/master/static/sw.js
 */
class RangedResponse {
  static isRangeRequest (request) {
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

  static canHandle (request) {
    if (!RangedResponse.isRangeRequest(request)) {
      return Promise.resolve(false);
    }

    return Promise.all([
      caches.match(request.url),
      caches.match(request.url + '_0')
    ]).then(v => v.some(r => r));
  }

  static isOpaqueOrError (response) {
    if (response.status != 200) {
      return response;
    }
  }

  static _getStartAndEnd (rangeHeader) {
    if (!rangeHeader.startsWith('bytes=')) {
      throw new Error('Invalid range unit');
    }

    const rangeParts = /(\d*)-(\d*)/.exec(rangeHeader);
    if (!rangeParts[1] && !rangeParts[2]) {
      throw new Error('Invalid range unit');
    }

    const start = Number(rangeParts[1]);
    // Range values are inclusive, so add 1 to the value.
    const end = Number(rangeParts[2]) + 1;

    if (start < 0) {
      throw new Error('Range not satisfiable');
    }

    return {
      start,
      end
    };
  }

  static _createRangedResponse (buffer, headers, start, end, offset=0) {
    let s = start - offset;
    let e = end - offset;
    let total = parseInt(headers.get('Content-Length'), 10);

    if (Number.isNaN(total)) {
      throw new Error('Unable to create byte range: content-length not set.');
    }

    const slicedBuffer = buffer.slice(s, e);
    const slicedResponse = new Response(slicedBuffer, {
      status: 206,
      headers
    });

    slicedResponse.headers.set('X-From-Cache', 'true');
    slicedResponse.headers.set('Content-Length', slicedBuffer.byteLength);
    slicedResponse.headers.set('Content-Range',
        `bytes ${start}-${end - 1}/${total}`);
    return slicedResponse;
  }

  static create (request) {
    if (!RangedResponse.isRangeRequest(request)) {
      return response;
    }

    return caches.match(request.url + '_0').then(chunkedResponse => {
      if (chunkedResponse) {
        return RangedResponse.createFromChunks(request);
      }

      return RangedResponse.createFromEntireBuffer(request);
    });
  }

  static createFromEntireBuffer (request) {
    return caches.match(request).then(response => {
      if (RangedResponse.isOpaqueOrError(response)) {
        return response;
      }

      const header = request.headers.get('Range');
      const rangeHeader = header.trim().toLowerCase();

      try {
        const {start, end} = RangedResponse._getStartAndEnd(rangeHeader);

        return response.arrayBuffer().then(buffer => {
          return _createRangedResponse(buffer, response.headers, start, end);
        });
      } catch (e) {
        return new Response(e.message, {status: 400});
      };
    });
  }

  static createFromChunks (request) {
    try {
      const header = request.headers.get('Range');
      const rangeHeader = header.trim().toLowerCase();
      const {start, end} = RangedResponse._getStartAndEnd(rangeHeader);
      const startIndex = Math.floor(start / OfflineCache.CHUNK_SIZE);
      const endIndex = Math.floor(end / OfflineCache.CHUNK_SIZE);
      const offset = startIndex * OfflineCache.CHUNK_SIZE;

      // If the start and end come from the same chunk then pull that chunk
      // from the cache and use it directly.
      if (startIndex === endIndex) {
        return caches.match(request.url + '_' + startIndex)
            .then(response => {
              return response.arrayBuffer().then(responseBuffer => {
                return RangedResponse._createRangedResponse(responseBuffer,
                  response.headers, start, end, offset);
              });
            });
      }

      const bufferSize = (endIndex - startIndex + 1) * OfflineCache.CHUNK_SIZE;
      const responseBuffer = new ArrayBuffer(bufferSize);
      const responseView = new Uint8Array(responseBuffer);
      const cachedResponses = [];

      for (let i = startIndex; i <= endIndex; i++) {
        cachedResponses.push(
          caches.match(request.url + '_' + i)
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
            return RangedResponse._createRangedResponse(responseBuffer, headers,
                start, end, offset);
          });
    } catch (e) {
      console.log(e);
      return new Response(e.message, {status: 400});
    };
  }
}

self.RangedResponse = RangedResponse;
