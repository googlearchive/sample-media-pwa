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

export default {
  loadScript, removeElement, preloadImage, fire, clamp, assert, load,
  base64ToUint8Array
};
