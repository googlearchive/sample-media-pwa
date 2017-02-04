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

class Linkify {
  static init (dust) {
    dust.filters.linkify = value => {
      const isLink = /https?:\/\/[^\s]+/gi;
      const matches = isLink.exec(value);
      let url;
      let suffix = '';

      if (!matches) {
        return value;
      }

      url = matches[0];
      if (url.endsWith('.')) {
        url = url.substring(0, url.length - 1);
        suffix = '.';
      }

      return value.replace(isLink, `<a href="${url}">${url}</a>${suffix}`);
    };
  }
}

module.exports = Linkify.init;
