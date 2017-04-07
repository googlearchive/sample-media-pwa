#!/usr/bin/env node
/**
 * @license
 * Copyright 2016 Google Inc. All rights reserved.
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

const path = require('path');
const videoLibrary = require('../src/server/utils/video-library');
const libraryPath = path.join(__dirname, '..', 'src', 'client', 'videos.json');
const library = videoLibrary.load(libraryPath);

const hashFileName = require('./plugins/hash').hashFileName;
const walk = require('walk');
const ignore = [
  'sw.js',
  'cache-manifest.js',
  '.DS_Store',
  'home.css',
];
const fs = require('fs');
const resourceList = [];
const pathList = [
  '/?cache|/',
  '/downloads/',
  '/settings/',
  '/404/?cache|/404/'
];

const getHomePageAssets = _ => {
  const assets = [];
  const NEW_VS_MORE = 4;
  const MAX_WATCH_MORE = 18;

  const featured =
      videoLibrary.find(library.shows, library.featured.split('/'));

  assets.push(featured.items.assetPath + '/poster.jpg');

  const episodes = [...videoLibrary.getNewest(library.shows, {
        count: NEW_VS_MORE,
        ignore: library.featured
      }),

   ...videoLibrary.getMoreEpisodes(library.shows, {
        count: NEW_VS_MORE,
        limit: MAX_WATCH_MORE,
        ignore: library.featured
      })];

  episodes.forEach(e => {
    assets.push(e.assetPath + '/poster-tiny.jpg');
  });

  return assets;
};

const walkStaticFiles = _ => {
  return new Promise((resolve, reject) => {
    const walker = walk.walk('./dist/client');
    const staticFiles = [];
    walker.on('file', (root, fileStats, next) => {
      const name = fileStats.name;
      const path = `${root}/${name}`;

      if (ignore.indexOf(name) !== -1) {
        return next();
      }

      root = root.replace(/^\.\/dist\/client/, '/static');

      if (name.endsWith('.js') ||
          name.endsWith('.css') ||
          name.endsWith('.json')) {
        const hashedName =
            hashFileName(path).replace(/^\.\/dist\/client/, '/static');

        staticFiles.push(`${hashedName}`);
      } else {
        staticFiles.push(`${root}/${name}`);
      }

      next();
    });

    walker.on('end', _ => resolve(staticFiles));
  });
};

Promise.all([
  getHomePageAssets(),
  walkStaticFiles()
]).then(resources => {
  resourceList.push(...resources[0], ...resources[1]);

  const manifest = [
    `const pathManifest = ${JSON.stringify(pathList, null, 2)}\n`,
    `const cacheManifest = ${JSON.stringify(resourceList, null, 2)};\n`
  ].join('\n');

  fs.writeFile('./dist/client/cache-manifest.js', manifest);
});
