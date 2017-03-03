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

const crypto = require('crypto');
const etag = (req, html) => {
  const hash = crypto
        .createHash('sha256')
        .update(html);

  // Use the x-no-compression header to establish a new etag.
  if (req.headers['x-no-compression']) {
    console.log('Requested without compression, updating etag...');
    hash.update('x-no-compression');
  }

  return hash.digest('hex');
};

module.exports = etag;
