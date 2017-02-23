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

const path = require('path');
const express = require('express');
const adaro = require('adaro');
const serviceWorker = express();

const packageReader = require('../utils/package-reader');
const version = packageReader.getVersion();
const viewPath = path.join(__dirname, '..', '..', 'client');
const helpersPath = path.join(__dirname, '..', 'helpers');
const dustOptions = {
  cache: false,
  whitespace: true,
  helpers: [
    require(`${helpersPath}/hash`)
  ]
};

if (process.env.NODE_ENV === 'production') {
  dustOptions.cache = true;
  console.log('[App: Service Worker] Templating is cached.');
}

serviceWorker.engine('js', adaro.dust(dustOptions));
serviceWorker.set('view engine', 'js');
serviceWorker.set('views', viewPath);
serviceWorker.use(require('../middleware/no-cache.js'));

serviceWorker.get('*', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.status(200).render('sw', {
    version
  });
});

console.log('[App: Service Worker] initialized.');
module.exports = serviceWorker;
