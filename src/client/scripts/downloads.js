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
import Constants from './constants/constants';
import LazyLoadImages from './helpers/lazy-load-images';
import Toast from './helpers/toast';

class Downloads {
  constructor () {
    if (!ServiceWorkerInstaller.SUPPORTS_OFFLINE) {
      this._setDownloadUnavailableContentMesssage();
      return;
    }

    this._deletingVideo = false;
    this._offlineCache = new OfflineCache();
    this._element = document.querySelector('.js-content-list');
    if (!this._element) {
      console.warn('Unable to locate download list element.');
      return;
    }

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

  _loadVideoLibrary () {
    return fetch(Constants.PATHS.VIDEOS).then(r => r.json());
  }

  _getAllStoredVideos () {
    return OfflineCache.getAll().then(names => names.sort());
  }

  _expandVideo (videoPath, library) {
    const parts = videoPath.split('/');
    let showTitle = '';
    let node = library.shows;

    parts.forEach(part => {
      node = node.find(n => n.slug === part);
      if (!node) {
        return;
      }

      if (!node.episodes) {
        return;
      }

      showTitle = node.title;
      node = node.episodes;
    });

    // Update the slug to match the path provided.
    if (node) {
      node.slug = videoPath;
      node.showTitle = showTitle;
    }

    return node;
  }

  _createMarkup (videoData) {
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
      this._loadVideoLibrary()
    ]).then(items => {
      const videos = items[0];
      const library = items[1];

      if (videos.length === 0) {
        return this._setNoDownloadedContentMesssage();
      }

      const html = videos
          .map(video => this._expandVideo(video, library))
          .map(video => this._createMarkup(video))
          .join('');

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
