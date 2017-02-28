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

import Utils from './utils';

class LazyLoadImages {

  static get SUPPORTS_INTERSECTION_OBSERVER () {
    return ('IntersectionObserver' in window);
  }

  static get THRESHOLD () {
    return 0.01;
  }

  static get HANDLED_CLASS () {
    return 'js-lazy-image--handled';
  }

  static init () {
    if (this._instance) {
      this._instance._disconnect();
    }

    this._instance = new LazyLoadImages();
  }

  constructor () {
    const images = document.querySelectorAll('.js-lazy-image');
    const config = {
      // If the image gets within 50px in the Y axis, start the download.
      rootMargin: '50px 0px',
      threshold: LazyLoadImages.THRESHOLD
    };

    if (!LazyLoadImages.SUPPORTS_INTERSECTION_OBSERVER) {
      this._loadImagesImmediately(images);
      return;
    }

    this._onIntersection = this._onIntersection.bind(this);
    this._observer = new IntersectionObserver(this._onIntersection, config);
    images.forEach(image => {
      if (image.classList.contains(LazyLoadImages.HANDLED_CLASS)) {
        return;
      }

      this._observer.observe(image);
    });
  }

  _disconnect () {
    if (!this._observer) {
      return;
    }

    this._observer.disconnect();
  }

  _onIntersection (entries) {
    entries.forEach(entry => {
      if (entry.intersectionRatio < 0) {
        return;
      }

      if (entry.target.classList.contains(LazyLoadImages.HANDLED_CLASS)) {
        return;
      }

      entry.target.classList.add('js-lazy-image--handled');
      this._preloadImage(entry.target);
    });
  }

  _preloadImage (image) {
    const src = image.dataset.src;
    if (!src) {
      return;
    }

    return Utils.preloadImage(src).then(_ => this._applyImage(image, src));
  }

  _loadImagesImmediately (images) {
    Array.from(images).forEach(image => this._preloadImage(image));
  }

  _applyImage (img, src) {
    const el = img.querySelector('.js-lazy-image-content');
    if (!el) {
      return;
    }

    el.style.backgroundImage = `url(${src})`;
    el.classList.add('fade-in');
  }
}

export default LazyLoadImages;
