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

import Utils from '../utils';
import VideoControls from './video-controls';

class VideoPlayer {

  static get DEFAULT_BANDWIDTH () {
    return 5000000;
  }

  static get SHAKA_PATH () {
    return '/static/third_party/libs/shaka-player.compiled.js';
  }

  static get SUPPORTS_MEDIA_SESSION () {
    return ('mediaSession' in navigator);
  }

  static get SUPPORTS_REMOTE_PLAYBACK () {
    return ('remote' in HTMLMediaElement.prototype);
  }

  static get isFullScreen () {
    return (document.fullscreenElement || document.webkitFullscreenElement);
  }

  static init () {
    const video = document.querySelector('video');

    if (!video) {
      console.log('No video here.');
      return;
    }

    new VideoPlayer(video);
  }

  constructor (video) {
    const title = video.dataset.title;
    const manifest = video.dataset.src;
    const poster = video.dataset.poster;
    const showTitle = video.dataset.showTitle;
    const castSrc = video.dataset.castSrc;
    const artworkPath = video.dataset.artworkPath;

    if (!manifest) {
      console.log('Video without manifest. Bailing.');
      return;
    }

    if (!poster) {
      console.warn('Video without a poster. Bailing.');
      return;
    }

    // Refs to keep.
    this._manifest = manifest;
    this._poster = poster;
    this._castSrc = castSrc;
    this._title = title;
    this._showTitle = showTitle;
    this._artworkPath = artworkPath;
    this._video = video;
    this._videoContainer = this._video.parentNode;
    this._videoControls = null;
    this._castVideo = document.createElement('video');
    this._player = null;
    this._fsLocked = false;
    this._shakaLoaded = Utils.loadScript(VideoPlayer.SHAKA_PATH);

    // Handlers.
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onPlayPause = this._onPlayPause.bind(this);
    this._onPlay = this._onPlay.bind(this);
    this._onPause = this._onPause.bind(this);
    this._onBack30 = this._onBack30.bind(this);
    this._onFwd30 = this._onFwd30.bind(this);
    this._onFullScreen = this._onFullScreen.bind(this);
    this._onChromecast = this._onChromecast.bind(this);
    this._onVolumeToggle = this._onVolumeToggle.bind(this);
    this._onOrientationChanged = this._onOrientationChanged.bind(this);
    this._onBufferChanged = this._onBufferChanged.bind(this);
    this._onRemoteConnecting = this._onRemoteConnecting.bind(this);
    this._onRemoteConnect = this._onRemoteConnect.bind(this);
    this._onRemoteDisconnect = this._onRemoteDisconnect.bind(this);
    this._onTimeUpdate = this._onTimeUpdate.bind(this);
    this._startTimeTracking = this._startTimeTracking.bind(this);
    this._stopTimeTracking = this._stopTimeTracking.bind(this);
    this._onSeek = this._onSeek.bind(this);
    this._onVideoEnd = this._onVideoEnd.bind(this);

    // Setup.
    this._addEventListeners();
    Utils.preloadImage(poster).then(_ => this._createPoster(poster));
  }

  _createPoster (poster) {
    const posterElement = this._videoContainer.querySelector('.video__poster');
    posterElement.style.backgroundImage = `url(${poster})`;
  }

  _addEventListeners () {
    this._videoContainer.addEventListener('keydown', this._onKeyDown);
    this._videoContainer.addEventListener('click', this._onClick);
    this._videoContainer.addEventListener('play-pause', this._onPlayPause);
    this._videoContainer.addEventListener('back-30', this._onBack30);
    this._videoContainer.addEventListener('fwd-30', this._onFwd30);
    this._videoContainer.addEventListener('seek', this._onSeek);
    this._videoContainer.addEventListener('toggle-fullscreen',
        this._onFullScreen);
    this._videoContainer.addEventListener('toggle-chromecast',
        this._onChromecast);
    this._videoContainer.addEventListener('toggle-volume',
        this._onVolumeToggle);

    window.screen.orientation.addEventListener('change',
        this._onOrientationChanged);

    this._video.addEventListener('play', this._startTimeTracking);
    this._video.addEventListener('pause', this._stopTimeTracking);
    this._video.addEventListener('ended', this._onVideoEnd);

    if (!VideoPlayer.SUPPORTS_MEDIA_SESSION) {
      return;
    }

    this._castVideo.remote
        .addEventListener('connecting', this._onRemoteConnecting);
    this._castVideo.remote
        .addEventListener('connect', this._onRemoteConnect);
    this._castVideo.remote
        .addEventListener('disconnect', this._onRemoteDisconnect);
  }

  _onBufferChanged (evt) {
    const bufferingClass = 'video--buffering';
    this._videoContainer.classList.toggle(bufferingClass, evt.buffering);
  }

  _onKeyDown (evt) {
    if (evt.keyCode !== 32) {
      return;
    }

    evt.preventDefault();
    this._onPlayPause();
    this._videoControls.update(this._getVideoState());
  }

  _onClick (evt) {
    const target = evt.target;

    if (target.classList.contains('video__play-button')) {
      // Pre-approve the video for playback on mobile.
      this._video.play().catch(_ => {
        // The play call will probably be interrupted by Shaka loading,
        // so quietly swallow the error.
      });

      // ... then load it.
      this._loadVideo();
    }

    if (!this._videoControls) {
      return;
    }
  }

  _getVideoState () {
    return {
      paused: this._video.paused,
      currentTime: this._video.currentTime,
      duration: this._video.duration,
      volume: this._video.volume,
      fullscreen: VideoPlayer.isFullScreen
    };
  }

  _onPlayPause () {
    if (this._video.paused) {
      this._onPlay();
      return;
    }

    this._onPause();
  }

  _onPlay () {
    this._video.play();
    this._videoControls.update(this._getVideoState());
  }

  _onPause () {
    this._video.pause();
    this._videoControls.update(this._getVideoState());
  }

  _onBack30 () {
    this._video.currentTime =
        Math.max(this._video.currentTime - 30, 0);
    this._videoControls.update(this._getVideoState());
  }

  _onFwd30 () {
    if (this._video.paused) {
      return;
    }

    this._video.currentTime =
        Math.min(this._video.currentTime + 30, this._video.duration);
    this._videoControls.update(this._getVideoState());
  }

  _onSeek (evt) {
    this._video.currentTime =
        evt.detail.newTime * this._video.duration;
  }

  _onVideoEnd () {
    // TODO: put up an end card for rewatching / sharing etc.
    this._video.classList.add('video--ended');
  }

  _onOrientationChanged () {
    const isLandscape = window.screen.orientation.type.startsWith('landscape');
    if (isLandscape) {
      this._enterFullScreen();
      return;
    }

    if (this._fsLocked) {
      return;
    }

    this._exitFullScreen();
  }

  _onFullScreen () {
    if (VideoPlayer.isFullScreen) {
      this._fsLocked = false;
      this._exitFullScreen();
      return;
    }

    this._fsLocked = true;
    this._enterFullScreen();
  }

  _onVolumeToggle () {
    this._video.volume = 1 - this._video.volume;
    this._videoControls.update(this._getVideoState());
  }

  _onChromecast () {
    // To support the Remote Playback API we need to have a separate
    // video file, one which doesn't use MSE / DASH.
    this._castVideo.src = this._castSrc;
    this._castVideo.remote.prompt();
  }

  _onRemoteConnect () {
    this._videoControls.castConnected = true;
  }

  _onRemoteConnecting () {
    this._videoControls.castConnecting = true;
  }

  _onRemoteDisconnect () {
    this._videoControls.castConnected = false;
  }

  _enterFullScreen () {
    const enterFullScreenFn = this._videoContainer.requestFullscreen ||
        this._videoContainer.webkitRequestFullscreen;

    enterFullScreenFn.call(this._videoContainer);
  }

  _exitFullScreen () {
    const exitFullScreenFn = document.exitFullscreen ||
        document.webkitExitFullscreen;

    exitFullScreenFn.call(document);
  }

  _loadVideo () {
    this._shakaLoaded.then(_ => {
      this._player = new shaka.Player(this._video);
      this._player.configure({
        abr: {
          defaultBandwidthEstimate: VideoPlayer.DEFAULT_BANDWIDTH
        }
      });

      this._player.addEventListener('buffering', this._onBufferChanged);
      this._player.load(this._manifest).then(_ => {
        if (this._video.paused) {
          this._video.play();
          this._video.volume = 1;
          this._video.classList.add('video__element--active');
        }
        this._initPlayerControls();
        this._setMediaSessionData();
        this._startChromecastWatch();
      }, err => {
        console.warn(err.message);
      });
    });
  }

  _initPlayerControls () {
    const videoControls =
        this._videoContainer.querySelector('.video__controls');
    if (!videoControls) {
      console.warn('No video controls. Bailing.');
      return;
    }

    videoControls.classList.add('video__controls--active');
    videoControls.dataset.title = this._title;
    this._videoControls = new VideoControls(videoControls);
    this._videoControls.update(this._getVideoState());
  }

  _setMediaSessionData () {
    if (!VideoPlayer.SUPPORTS_MEDIA_SESSION) {
      return;
    }

    const artworkPath256 = this._artworkPath + 'artwork@256.jpg';
    const artworkPath512 = this._artworkPath + 'artwork@512.jpg';

    navigator.mediaSession.metadata = new MediaMetadata({
      title: this._title,
      album: this._showTitle,
      artwork: [
        {src: artworkPath256, sizes: '256x256', type: 'image/jpg'},
        {src: artworkPath512, sizes: '512x512', type: 'image/jpg'},
      ]
    });

    navigator.mediaSession.setActionHandler('play', this._onPlay);
    navigator.mediaSession.setActionHandler('pause', this._onPause);
    navigator.mediaSession.setActionHandler('seekbackward', this._onBack30);
    navigator.mediaSession.setActionHandler('seekforward', this._onFwd30);
  }

  _startChromecastWatch () {
    if (!VideoPlayer.SUPPORTS_REMOTE_PLAYBACK) {
      this._videoControls.hideChromecastButton();
      return;
    }

    this._castVideo.remote.watchAvailability(available => {
      if (available) {
        this._videoControls.showChromecastButton();
        return;
      }

      this._videoControls.hideChromecastButton();
    }).catch(_ => {
      if (!this._videoControls) {
        return;
      }

      this._videoControls.hideChromecastButton();
    });
  }

  _stopChromecastWatch () {
    if (!VideoPlayer.SUPPORTS_REMOTE_PLAYBACK) {
      this._videoControls.hideChromecastButton();
      return;
    }

    this._castVideo.remote.cancelWatchAvailability();
  }

  _onTimeUpdate () {
    this._videoControls.updateTimeTrack(
        this._video.currentTime, this._video.duration);

    if (!this._isTrackingTime) {
      return;
    }

    requestAnimationFrame(this._onTimeUpdate);
  }

  _startTimeTracking () {
    this._isTrackingTime = true;
    requestAnimationFrame(this._onTimeUpdate);
  }

  _stopTimeTracking () {
    this._isTrackingTime = false;
  }
}

export default VideoPlayer;
