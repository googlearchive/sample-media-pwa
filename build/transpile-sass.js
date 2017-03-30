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

const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');
const inPath = path.join(__dirname, '..', 'src', 'client', 'styles');
const outPath = path.join(__dirname, '..', 'dist');
const files = [
  {
    in: path.join(inPath, 'inline.scss'),
    out: path.join(outPath, 'views', 'inlines', 'bootstrap.css')
  },
  {
    in: path.join(inPath, 'fonts.scss'),
    out: path.join(outPath, 'views', 'inlines', 'fonts.css')
  },
  {
    in: path.join(inPath, 'biograf.scss'),
    out: path.join(outPath, 'client', 'styles', 'biograf.css')
  }
];

const CleanCSS = require('clean-css');
const sass = require('node-sass');
files.forEach(file => {
  sass.render({
    file: file.in
  }, (err, result) => {
    if (err) {
      throw err;
    }

    mkdirp(path.dirname(file.out), err => {
      if (err) {
        throw err;
      }

      const output = new CleanCSS().minify(result.css);
      fs.writeFile(file.out, output.styles, 'utf-8');
    });
  });
});
