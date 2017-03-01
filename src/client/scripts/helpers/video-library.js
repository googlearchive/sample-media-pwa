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

class VideoLibrary {
  static load () {
    return fetch(Constants.PATHS.VIDEOS).then(r => r.json());
  }

  static getAllEpisodes (library, sorted=false, ignore=null) {
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

    if (sorted) {
      allEpisodes.sort((a, b) => {
        return Date.parse(b.released) - Date.parse(a.released);
      });
    }

    if (ignore) {
      allEpisodes.splice(allEpisodes.findIndex(e => {
        return e.slug === ignore;
      }), 1);
    }

    return allEpisodes;
  }

  static inflate (videoPath, library) {
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
}

export default VideoLibrary;
