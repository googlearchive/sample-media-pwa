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

const path = require('path');
const rollup = require('rollup');
const babel = require('rollup-plugin-babel');
const entries = [
  'client/scripts/app.js'
];

let cache;

entries.forEach(entry => {
  const fileName = path.basename(entry, '.js');

  rollup.rollup({
    entry: `src/${entry}`,
    cache,
    plugins: [
      babel()
    ]
  }).then(bundle => {
    cache = bundle;
    bundle.write({
      intro,
      format: 'iife',
      dest: `dist/${entry}`,
      sourceMap: true,
      sourceMapFile: `dist/client/scripts/${fileName}.map.js`
    });
  });
});
