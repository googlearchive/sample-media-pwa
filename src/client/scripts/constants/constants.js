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

const constants = {

  // Half a meg chunks.
  CHUNK_SIZE: 1024 * 512,

  SUPPORTS_CACHING: ('caches' in self),

  OFFLINE_VIDEO_HEIGHT: 720,
  OFFLINE_AUDIO_TYPE: 'avc1',
  OFFLINE_VIDEO_PATH: 'mp4/v-0720p-2500k-libx264.mp4',

  OFFLINE_ASSET_LIST: [
    'artwork@256.jpg',
    'artwork@512.jpg',
    'poster-small.jpg',
    'poster.jpg',
    {
      // TODO: Make this based on user preference.
      src: 'mp4/offline-720p.mpd',
      dest: 'mp4/dash.mpd'
    },
    // TODO: Make this based on browser support.
    {
      src: 'mp4/v-0720p-2500k-libx264.mp4',
      chunk: true
    },
    {
      src: 'mp4/a-eng-0128k-aac.mp4',
      chunk: true
    }
  ]
};

export default constants;
