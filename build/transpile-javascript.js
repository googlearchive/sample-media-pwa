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

const intro = `/**
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
 *
 * Built: ${new Date()}
 */
`;

const rollup = require('rollup');
const hash = require('./plugins/hash').findHashes;
const babel = require('rollup-plugin-babel');
const entries = [
  'client/scripts/app.js',
  'client/scripts/downloads.js',
  'client/scripts/settings.js',
  'client/scripts/ranged-response.js',
  'client/scripts/background-fetch-helper.js'
];

let cache;
entries.forEach(entry => {
  rollup.rollup({
    entry: `src/${entry}`,
    cache,
    plugins: [
      hash(),
      babel()
    ]
  }).then(bundle => {
    cache = bundle;
    bundle.write({
      intro,
      format: 'iife',
      dest: `dist/${entry}`
    });
  });
});
