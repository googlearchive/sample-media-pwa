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

class DownloadProgress {

  static get SIZE () {
    return 24;
  }

  constructor (target, percentage) {
    const START = Math.PI * 0.5;
    const TAU = Math.PI * 2;
    const RADIUS = 240 * 0.5;

    const path = target.querySelector('path.dial');
    const targetX = RADIUS - Math.cos(START + (percentage * TAU)) * RADIUS;
    const targetY = RADIUS - Math.sin(START - percentage * TAU) * RADIUS;
    const largeArcFlag = percentage > 0.5 ? 1 : 0;

    const points = [
      // Top center.
      `M ${RADIUS} 0`,

      // Arc round to wherever the percentage implies.
      `A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${targetX} ${targetY}`,

      // Back to the center.
      `L ${RADIUS} ${RADIUS}`
    ];

    path.setAttribute('d', points.join(' '));
  }
}

export default DownloadProgress;
