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
const app = express();

const hashRemoval = require('./utils/hash-removal');
const httpsRedirect = require('./utils/https-redirect');
const session = require('./utils/session');
const authentication = require('./utils/authentication');
const templating = require('./utils/templating');
const headers = require('./utils/headers');

const PORT = process.env.PORT || 8080;
const STATIC_PATH = path.join(__dirname, '..', 'client');
const STATIC_OPTS = {
  maxAge: 31536000000 // One year
};

// Init all the helpers for the server.
session.init(app);
authentication.init(app);
httpsRedirect.init(app);
hashRemoval.init(app);
templating.init(app);

// Set up static hosting for client assets, like the manifest, SW, etc.
app.use('/static', express.static(STATIC_PATH, STATIC_OPTS));

app.get('/', (req, res) => {
  res.render('index', {
    name: 'Paul'
  });

  headers.noCache(res);
});

// app.get('/admin', authentication.required, (req, res) => {
//   res.status(200).send('Logged in!');
//   headers.noCache(res);
// });

app.listen(PORT, _ => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
