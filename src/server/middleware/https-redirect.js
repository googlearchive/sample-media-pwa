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

const HTTPSRedirect = (req, res, next) => {
  if (req.hostname === 'localhost') {
    return next();
  }

  // For non-localhost hosts, check the header for the protocol used.
  if (typeof req.headers['x-forwarded-proto'] === 'undefined') {
    return next();
  }

  if (req.headers['x-forwarded-proto'].toLowerCase() === 'http') {
    res.redirect(`https://${req.hostname}${req.url}`);
    return;
  }

  next();
};

console.log('[Middleware: HTTPS Redirect] initialized.');
module.exports = HTTPSRedirect;
