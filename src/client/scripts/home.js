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

import Utils from './helpers/utils';

class Home {
  constructor () {
    this.loadNewReleaseImages();
  }

  loadNewReleaseImages () {
    const images =
        document.querySelectorAll('.home__new-releases-list-item-image');

    Array.from(images).forEach(img => {
      const src = img.dataset.src;
      Utils.preloadImage(src).then(_ => this._applyImage(img, src));
    });
  }

  _applyImage (img, src) {
    const el = img.querySelector('.home__new-releases-list-item-image-content');
    if (!el) {
      return;
    }

    el.style.backgroundImage = `url(${src})`;
    el.classList.add('image-fade-in');
  }
}

window.biograf = window.biograf || {};
window.biograf.home = window.biograf.home || new Home();

