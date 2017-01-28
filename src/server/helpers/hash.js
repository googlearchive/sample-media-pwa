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

const fs = require('fs');
const crypto = require('crypto');

class Hash {
  static loadFileContents (path) {
    return new Promise((resolve, reject) => {
      fs.readFile(path, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        }

        resolve(data);
      });
    });
  }

  static createHashFromFileContents (data) {
    return crypto
        .createHash('sha256')
        .update(data)
        .digest('hex');
  };

  static init (dust) {
    dust.helpers.hash = (chunk, context, bodies, params) => {
      return chunk.map(chunk => {
        const filePath = params.path;
        Hash.loadFileContents(filePath)
            .then(fileData => Hash.createHashFromFileContents(fileData))
            .then(fileHash => {
              const newPath = filePath
                  .replace(/\/?dist\/client/, '/static')
                  .replace(/([^\.]+)\.(.+)/, `$1.${fileHash}.$2`);

              return chunk.write(newPath).end();
            });
      });
    };
  }
}

module.exports = Hash.init;
