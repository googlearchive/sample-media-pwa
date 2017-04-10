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

const _scriptCache = {};
const loadScript = url => {
  _scriptCache[url] = _scriptCache[url] || new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = _ => {
      resolve(script);
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });

  return _scriptCache[url];
};

const load = ({url, type, body, responseType}={}) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(type || 'POST', url);
    xhr.responseType = responseType || 'arraybuffer';
    xhr.onload = evt => {
      resolve(evt.target.response);
    };

    xhr.onerror = evt => {
      reject(evt);
    };
    xhr.send(body);
  });
};

const removeElement = el => {
  el.parentNode.removeChild(el);
};

const preloadImage = url => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = url;
    image.onload = resolve;
    image.onerror = reject;
  });
};

const fire = (el, eventName, detail=null, bubbles=true, cancelable=true) => {
  let evt = new CustomEvent(eventName, {
    detail, bubbles, cancelable
  });

  el.dispatchEvent(evt);
};

const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

const assert = (predicate, message) => {
  if (predicate) {
    return;
  }

  throw new Error(message);
};

/**
 * From: https://github.com/google/shaka-player/blob/f9fc4adbe69c108ff752323e9983a93c86c97e36/lib/util/uint8array_utils.js#L53
 */
const base64ToUint8Array = str => {
  const bytes = window.atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const result = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; ++i) {
    result[i] = bytes.charCodeAt(i);
  }
  return result;
};

const cacheInChunks = (cache, response) =>{
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

  return reader.read().then(onStreamData);
};

export default {
  loadScript, removeElement, preloadImage, fire, clamp, assert, load,
  base64ToUint8Array, cacheInChunks
};
