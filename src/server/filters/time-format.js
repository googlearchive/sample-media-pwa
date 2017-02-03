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

class TimeFormat {
  static init (dust) {
    dust.filters.timeFormat = seconds => {
      const hours = Math.floor(seconds / 3600);
      seconds -= hours * 3600;

      const minutes = Math.floor(seconds / 60);
      seconds -= minutes * 60;

      const time = [];
      let timeString;
      if (hours > 0) {
        timeString = `${hours}hr`;
        if (hours !== 1) {
          timeString += 's';
        }

        time.push(timeString);
      }

      if (minutes > 0) {
        timeString = `${minutes}min`;
        if (minutes !== 1) {
          timeString += 's';
        }

        time.push(timeString);
      }

      if (seconds > 0) {
        timeString = `${seconds}sec`;
        if (minutes != 1) {
          timeString += 's';
        }

        time.push(timeString);
      }

      return time.join(' ');
    };
  }
}

module.exports = TimeFormat.init;
