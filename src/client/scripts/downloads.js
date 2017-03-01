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

import ServiceWorkerInstaller from './helpers/service-worker-installer';
import OfflineCache from './helpers/offline-cache';
import VideoLibrary from './helpers/video-library';
import LazyLoadImages from './helpers/lazy-load-images';
import Toast from './helpers/toast';

class Downloads {
  constructor () {
    this._element = document.querySelector('.js-content-list');
    if (!this._element) {
      console.warn('Unable to locate download list element.');
      return;
    }

    if (!ServiceWorkerInstaller.SUPPORTS_OFFLINE) {
      this._setDownloadUnavailableContentMesssage();
      return;
    }

    this._deletingVideo = false;
    this._offlineCache = new OfflineCache();

    this._onClick = this._onClick.bind(this);
    document.addEventListener('click', this._onClick);

    this._populate();
  }

  _onClick (evt) {
    if (!evt.target.dataset) {
      return;
    }

    const name = evt.target.dataset.name;
    if (!name) {
      return;
    }

    evt.preventDefault();
    evt.stopImmediatePropagation();

    if (this._deletingVideo) {
      Toast.create('Deleting video. Please wait.', {tag: 'offline'});
      return;
    }

    this._deletingVideo =
        confirm('Are you sure you wish to remove this video?');

    if (!this._deletingVideo) {
      return;
    }

    Toast.create('Deleting video.', {tag: 'offline'});
    return this._offlineCache.remove(name).then(_ => {
      this._populate();
      this._deletingVideo = false;
      Toast.create('Deleted video.', {tag: 'offline'});
    });
  }

  _getAllStoredVideos () {
    return OfflineCache.getAll().then(names => names.sort());
  }

  _createMarkup (videoData) {
    if (!videoData) {
      return '';
    }

    return `
      <div class="downloads__content-list-item">
        <a href="/${videoData.slug}/" class="downloads__content-list-item-link">
          <div class="downloads__content-list-item-image js-lazy-image"
              data-src="${videoData.assetPath}/poster-small.jpg">
            <div class="downloads__content-list-item-image-content js-lazy-image-content"></div>
          </div>
        </a>

        <div class="downloads__content-list-item-info">
          <a href="/${videoData.slug}/" class="downloads__content-list-item-info-link">
            <h3 class="downloads__content-list-item-info-link-title">${videoData.showTitle}: ${videoData.title}</h3>
            <p class="downloads__content-list-item-info-link-description">${videoData.description}</p>
          </a>

          <button class="downloads__content-list-item-info-remove" data-name="${videoData.slug}">Remove offline copy</button>
        </div>
      </div>
    `;
  }

  _populate () {
    this._element.innerHTML = 'Retrieving downloads. Please wait.';

    return Promise.all([
      this._getAllStoredVideos(),
      VideoLibrary.load()
    ]).then(items => {
      const videos = items[0];
      const library = items[1];
      const html = videos
          .map(video => VideoLibrary.inflate(video, library))
          .map(video => this._createMarkup(video))
          .join('');

      if (videos.length === 0 || html === '') {
        return this._setNoDownloadedContentMesssage();
      }

      this._element.innerHTML = html;

      LazyLoadImages.init();
    });
  }

  _setDownloadUnavailableContentMesssage () {
    this._element.innerHTML = `Downloaded content is not available in this
        browser.`;
  }

  _setNoDownloadedContentMesssage () {
    this._element.innerHTML = `You have no downloaded content. Why not
        <a href="/">check out our videos</a>?`;
  }
}

window.biograf = window.biograf || {};
window.biograf.downloads = window.biograf.downloads || new Downloads();
