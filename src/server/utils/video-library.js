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

const fs = require('fs');

class VideoLibrary {
  static load (path) {
    return JSON.parse(fs.readFileSync(path, 'utf-8'));
  }

  static getAllEpisodes (library) {
    const allEpisodes = [];
    const showNames = Object.keys(library);
    showNames.forEach(showName => {
      allEpisodes.push(
        ...library[showName].episodes.map(e => {
          const eCopy = Object.assign({}, e);
          eCopy.title = `${library[showName].title}: ${e.title}`;
          eCopy.slug = `${library[showName].slug}/${e.slug}`;
          return eCopy;
        }));
    });

    return allEpisodes;
  }

  static getNewest (library, count) {
    if (typeof count === 'undefined') {
      count = 4;
    }

    return VideoLibrary.getAllEpisodes(library)
        .sort((a, b) => {
          return Date.parse(b.released) - Date.parse(a.released);
        })
        .slice(0, count);
  }

  static find (library, path) {
    let breadcrumbs = [];
    let items = library;
    let title;

    if (!Array.isArray(library)) {
      throw new Error('library should be an array of shows');
    }

    if (!Array.isArray(path)) {
      throw new Error('path should be an array of parts');
    }

    for (let p = 0; p < path.length; p++) {
      const item = items.find(i => {
        return i.slug === path[p];
      });

      if (!item) {
        return {
          items: []
        };
      }

      title = item.title;
      items = item.episodes || item;
      breadcrumbs.push(title);
    }

    return {
      title,
      items,
      breadcrumbs
    };
  }
}

module.exports = VideoLibrary;
