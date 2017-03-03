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
const settings = express();
const path = require('path');
const adaro = require('adaro');

const helpersPath = path.join(__dirname, '..', 'helpers');
const viewPath = path.join(__dirname, '..', '..', 'views');

const packageReader = require('../utils/package-reader');
const version = packageReader.getVersion();

const dustOptions = {
  cache: false,
  whitespace: true,
  helpers: [
    require(`${helpersPath}/hash`)
  ]
};

const defaultViewOptions = {
  title: 'Biograf - Settings',
  version,
  scripts: [
    'dist/client/scripts/app.js',
    'dist/client/scripts/settings.js'
  ]
};

if (process.env.NODE_ENV === 'production') {
  dustOptions.cache = true;
  dustOptions.whitespace = false;
  console.log('[App: settings] Templating is cached.');
}

settings.engine('dust', adaro.dust(dustOptions));
settings.set('view engine', 'dust');
settings.set('views', viewPath);
settings.use(require('../middleware/no-cache.js'));

settings.get('/', (req, res) => {
  const viewOptions = Object.assign({}, defaultViewOptions, {
    css: [
      'dist/client/styles/biograf.css'
    ],
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
  });
  res.status(200).render('settings', viewOptions);
});


console.log('[App: Settings] initialized.');
module.exports = settings;
