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

import ServiceWorkerInstaller from './sw-install';

class App {
  constructor () {
    ServiceWorkerInstaller.init();
    this._loadPlayerIfNeeded();
  }

  _loadPlayerIfNeeded () {
    const video = document.querySelector('video');

    if (!video) {
      console.log('No video here.');
      return;
    }

    if ('shaka' in window) {
      console.log('shaka loaded');
      return Promise.resolve().then(_ => this._onShakaPlayerLoaded(video));
    }

    return new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = '/static/third_party/libs/shaka-player.compiled.js';
      script.onload = _ => {
        resolve(video);
      };
      document.body.appendChild(script);
    }).then(this._onShakaPlayerLoaded, err => {
      console.warn(err.stack);
    });
  }

  _onShakaPlayerLoaded (targetVideo) {
    const manifest = targetVideo.dataset.src;
    if (!manifest) {
      console.log('Video without manifest. Bailing.');
      return;
    }

    const player = new shaka.Player(targetVideo);

    player.load(manifest).then(_ => {
      console.log('Video loaded');
    }, err => {
      console.warn(err.message);
    });
  }
}

new App();
