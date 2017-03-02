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

import Utils from '../helpers/utils';

class DownloadProgress {

  static get DEFAULT_RADIUS () {
    return 12;
  }

  static update (target, percentage=0) {
    percentage = Utils.clamp(percentage, 0, 1);

    const START = Math.PI * 0.5;
    const TAU = Math.PI * 2;

    const path = target.querySelector('path.dial');
    if (!path) {
      return;
    }

    const radius = (path.dataset.radius || DownloadProgress.DEFAULT_RADIUS);
    const targetX = radius - Math.cos(START + (percentage * TAU)) * radius;
    const targetY = radius - Math.sin(START - percentage * TAU) * radius;
    const largeArcFlag = percentage > 0.5 ? 1 : 0;

    const points = [
      // Top center.
      `M ${radius} 0`,

      // Arc round to wherever the percentage implies.
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${targetX} ${targetY}`,

      // Back to the center.
      `L ${radius} ${radius}`
    ];

    path.setAttribute('d', points.join(' '));
  }
}

export default DownloadProgress;
