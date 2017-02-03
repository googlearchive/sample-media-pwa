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

class DateFormat {

  static get monthNames () {
    return [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
  }

  static _getSuffix (date) {
    switch (date) {
      case 1:
      case 21:
        return 'st';

      case 2:
      case 22:
        return 'nd';

      case 3:
      case 23:
        return 'rd';

      default:
        return 'th';
    }
  }

  static init (dust) {
    dust.filters.dateFormat = value => {
      const date = new Date(Date.parse(value));
      const suffix = DateFormat._getSuffix(date.getDate());
      const monthName = DateFormat.monthNames[date.getMonth()];

      return `${date.getDate()}${suffix} ${monthName}, ${date.getFullYear()}`;
    };
  }
}

module.exports = DateFormat.init;
