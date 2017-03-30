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

const express = require('express');
const dynamic = express();
const path = require('path');
const adaro = require('adaro');
const fs = require('fs');

const libraryPath = path.join(__dirname, '..', '..', 'client', 'videos.json');
const helpersPath = path.join(__dirname, '..', 'helpers');
const filtersPath = path.join(__dirname, '..', 'filters');
const viewPath = path.join(__dirname, '..', '..', 'views');

const packageReader = require('../utils/package-reader');
const version = packageReader.getVersion();
const videoLibrary = require('../utils/video-library');
const etag = require('../utils/etag');
const library = videoLibrary.load(libraryPath);
const inlines = {
  js: fs.readFileSync(path.join(viewPath, 'inlines', 'bootstrap.js'), 'utf-8'),
  css: fs.readFileSync(path.join(viewPath, 'inlines', 'bootstrap.css'), 'utf-8'),
  fonts: fs.readFileSync(path.join(viewPath, 'inlines', 'fonts.css'), 'utf-8')
};

const dustOptions = {
  cache: false,
  whitespace: true,
  helpers: [
    require(`${helpersPath}/hash`),
    require(`${helpersPath}/star-rating`),
    require(`${filtersPath}/date-format`),
    require(`${filtersPath}/time-format`),
    require(`${filtersPath}/truncate`),
    require(`${filtersPath}/linkify`),
    dust => {
      dust.helpers.gt = require('dustjs-helpers').helpers.gt;
    }
  ]
};

const defaultViewOptions = {
  title: 'Biograf',
  shows: library.shows,
  version,
  scripts: [
    'dist/client/scripts/app.js'
  ]
};

if (process.env.NODE_ENV === 'production') {
  dustOptions.cache = true;
  console.log('[App: Dynamic] Templating is cached.');
}

dynamic.engine('dust', adaro.dust(dustOptions));
dynamic.set('view engine', 'dust');
dynamic.set('views', viewPath);
dynamic.use(require('../middleware/no-cache.js'));

dynamic.get('/', (req, res) => {
  if (req.query.cache !== undefined) {
    inlines.css += '\n' + inlines.fonts;
  }

  const NEW_VS_MORE = 4;
  const MAX_WATCH_MORE = 18;
  const viewOptions = Object.assign({}, defaultViewOptions, {
    featured: videoLibrary.find(library.shows, library.featured.split('/')),
    newest: videoLibrary.getNewest(library.shows, {
      count: NEW_VS_MORE,
      ignore: library.featured
    }),
    watchMore: videoLibrary.getMoreEpisodes(library.shows, {
      count: NEW_VS_MORE,
      limit: MAX_WATCH_MORE,
      ignore: library.featured
    }),
    inlines
  });

  res.render('home', viewOptions, (err, html) => {
    if (err) {
      return res.status(500).send('Fail');
    }

    res.set('etag', etag(req, html));
    res.status(200).send(html);
  });
});

dynamic.get('/*', (req, res) => {
  // Strip off start and end slashes from the requested URL.
  const fullPath = req.url
      .replace(/(^\/|\/$)/ig, '')
      .replace(/[^a-z0-9\-\.\/]/ig, '');

  const pathParts = fullPath.split('/');
  const search = videoLibrary.find(library.shows, pathParts);
  const watchMore =
      videoLibrary.getOtherTitlesInShow(library.shows, pathParts[0], fullPath);

  const viewOptions = Object.assign({}, defaultViewOptions, {
    title: `Biograf - ${search.title}`,
    item: search.items,
    css: [
      'dist/client/styles/biograf.css'
    ],
    inlines: {
      js: inlines.js
    },
    fullPath,
    watchMore
  });

  if (search.items.length === 0) {
    const status = req.query.cache !== undefined ? 200 : 404;
    return res.status(status).render('404',
      Object.assign({
        colors: {
          primary: {
            r: 171, g: 247, b: 226
          },
          primaryLight: {
            r: 218, g: 242, b: 245
          },
          secondary: {
            r: 25, g: 213, b: 185
          },
          tertiary: {
            r: 59, g: 85, b: 94
          },
          quaternary: {
            r: 36, g: 52, b: 57
          }
        }
      }, viewOptions));
  } else if (Array.isArray(search.items)) {
    if (search.items.length === 1) {
      return res.redirect(`${search.items[0].slug}/`);
    }

    return res.status(200).render('listing', viewOptions);
  }

  res.render('video', viewOptions, (err, html) => {
    if (err) {
      return res.status(500).send('Fail');
    }

    res.set('etag', etag(req, html));
    res.status(200).send(html);
  });
});

console.log('[App: Dynamic] initialized.');
module.exports = dynamic;
