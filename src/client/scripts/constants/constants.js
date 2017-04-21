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

  APP_NAME: 'Biograf',

  // Half a meg chunks.
  CHUNK_SIZE: 1024 * 512,

  SUPPORTS_CACHING: ('caches' in self),
  SUPPORTS_BACKGROUND_FETCH: ('BackgroundFetchManager' in self),

  // TODO: Make these based on user preference.
  PREFETCH_VIDEO_HEIGHT: 480,
  PREFETCH_MANIFEST: 'mp4/dash.mpd',
  PREFETCH_VIDEO_PATH: 'mp4/v-0480p-0750k-libvpx-vp9.webm',
  PREFETCH_AUDIO_PATH: 'mp4/a-eng-0128k-libvorbis.webm',
  PREFETCH_DEFAULT_BUFFER_GOAL: 60,
  PREFETCH_MIME_TYPE: 'webm',

  OFFLINE_VIDEO_HEIGHT: 720,
  OFFLINE_VIDEO_PATH: 'mp4/v-0720p-2500k-libx264.mp4',
  OFFLINE_AUDIO_PATH: 'mp4/a-eng-0128k-aac.mp4',
  OFFLINE_MIME_TYPE: 'mp4',

  OFFLINE_ASSET_LIST: [
    'artwork@256.jpg',
    'artwork@512.jpg',
    'poster-tiny.jpg',
    'poster-small.jpg',
    'poster.jpg',
    'thumbnail-strip.jpg',
    {
      // TODO: Make this based on user preference.
      src: 'mp4/offline-720p.mpd',
      dest: 'mp4/dash.mpd'
    }
  ],

  PATHS: {
    VIDEOS: '{@hash path="dist/client/videos.json"}{/hash}',
    SHAKA: '{@hash path="dist/client/third_party/libs/shaka-player.compiled.js"}{/hash}'
  }
};

export default constants;
