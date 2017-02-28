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

const createFilter = require('rollup-pluginutils').createFilter;
const crypto = require('crypto');
const fs = require('fs');

function findHashes (options={}) {
  const filter = createFilter(options.include, options.exclude);

  return {
    transform (code, id) {
      if (!filter(id)) {
        return;
      }

      const needsHash = /{@hash\spath="([^"]+)"}{\/hash}/gim;
      let matches;
      do {
        matches = needsHash.exec(code);

        if (matches) {
          const path = matches[1];
          const hashedName = hashFileName(path).replace('dist/client', '/static');
          code = code.replace(`{@hash path="${path}"}{/hash}`, hashedName);
        }
      } while (matches);

      return {
        code,
        map: {mappings: ''}
      };
    }
  };
};

function hashFileName (path) {
  const hash = crypto
            .createHash('sha256')
            .update(fs.readFileSync(path))
            .digest('hex');

  return path.replace(/\.([^.]*?)$/, `.${hash}.$1`);
}

module.exports = {
  findHashes,
  hashFileName
};
