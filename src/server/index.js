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
const app = express();
const compression = require('compression');
const PORT = process.env.PORT || 8080;
const compressResponse = req => {
  if (req.headers['x-no-compression']) {
    return false;
  }

  return true;
};

// Init all the global middleware.
app.use(require('./middleware/session'));
app.use(require('./middleware/https-redirect'));
app.use(require('./middleware/hash-removal'));
app.use(compression({filter: compressResponse}));

// Start up passport so that it's available to every app.
const passport = require('passport');
app.use(passport.initialize());
app.use(passport.session());

// And now the routes.
app.all('/_ah/health', (req, res) => res.sendStatus(200));
app.use('/static', require('./apps/static'));
// app.use('/auth', require('./apps/authentication').app);
// app.use('/admin', require('./apps/admin'));
app.use('/sw.js', require('./apps/service-worker'));
app.use('/downloads/?', require('./apps/downloads'));
app.use('/settings/?', require('./apps/settings'));
app.use('/', require('./apps/dynamic'));

app.listen(PORT, _ => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
