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

const path = require('path');
const adaro = require('adaro');
const helpersPath = path.join(__dirname, '..', 'helpers');
const options = {
  cache: (process.env.NODE_ENV === 'production' ? true : false),
  helpers: [
    require(`${helpersPath}/hash`)
  ]
};

const init = app => {
  if (options.cache) {
    console.log('Templating is cached.');
  }

  app.engine('dust', adaro.dust(options));
  app.set('view engine', 'dust');

  const viewPath = path.join(__dirname, '..', '..', 'views');
  app.set('views', viewPath);

  console.log('Templating initialized.');
};

module.exports = {
  init
};
