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
import Paths from '../helpers/paths';
import VideoControls from './video-controls';
import OfflineManager from '../helpers/offline';

class VideoPlayer {

  static get DEFAULT_BANDWIDTH () {
    return 5000000;
  }

  static get SUPPORTS_MEDIA_SESSION () {
    return ('mediaSession' in navigator);
  }

  static get SUPPORTS_REMOTE_PLAYBACK () {
    return ('remote' in HTMLMediaElement.prototype);
  }

  static get SUPPORTS_ORIENTATION_LOCK () {
    if (!VideoPlayer.SUPPORTS_ORIENTATION) {
      return false;
    }

    if (!('lock' in window.screen.orientation)) {
      return false;
    }

    return true;
  }

  static get SUPPORTS_ORIENTATION () {
    return ('orientation' in window.screen);
  }

  static get SUPPORTS_OFFLINE () {
    return OfflineManager.OFFLINE_SUPPORTED;
  }

  static get isFullScreen () {
    return (document.fullscreenElement || document.webkitFullscreenElement);
  }

  constructor (video) {
    if (!video) {
      throw new Error('No video element provided.');
    }

    const title = video.dataset.title;
    const manifest = video.dataset.src;
    const poster = video.dataset.poster;
    const showTitle = video.dataset.showTitle;
    const castSrc = video.dataset.castSrc;
    const assetPath = video.dataset.assetPath;

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
    this._originalManifest = manifest;
    this._poster = poster;
    this._castSrc = castSrc;
    this._title = title;
    this._showTitle = showTitle;
    this._assetPath = assetPath;
    this._video = video;
    this._videoContainer = this._video.parentNode;
    this._videoControls = null;
    this._castVideo = document.createElement('video');
    this._player = null;
    this._offlineManager = null;
    this._fsLocked = false;
    this._playOnSeekFinished = false;
    this._videoIsAvailableOffline = false;

    // Handlers.
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onPlayPause = this._onPlayPause.bind(this);
    this._onPlay = this._onPlay.bind(this);
    this._onClose = this._onClose.bind(this);
    this._onReplay = this._onReplay.bind(this);
    this._onPause = this._onPause.bind(this);
    this._onBack30 = this._onBack30.bind(this);
    this._onFwd30 = this._onFwd30.bind(this);
    this._onFullScreenToggle = this._onFullScreenToggle.bind(this);
    this._onChromecast = this._onChromecast.bind(this);
    this._onVolumeToggle = this._onVolumeToggle.bind(this);
    this._onOrientationChanged = this._onOrientationChanged.bind(this);
    this._onBufferChanged = this._onBufferChanged.bind(this);
    this._onRemoteConnecting = this._onRemoteConnecting.bind(this);
    this._onRemoteConnect = this._onRemoteConnect.bind(this);
    this._onRemoteDisconnect = this._onRemoteDisconnect.bind(this);
    this._onTimeUpdate = this._onTimeUpdate.bind(this);
    this._onFullScreenChanged = this._onFullScreenChanged.bind(this);
    this._startTimeTracking = this._startTimeTracking.bind(this);
    this._stopTimeTracking = this._stopTimeTracking.bind(this);
    this._onOfflineProgressCallback =
        this._onOfflineProgressCallback.bind(this);
    this._onSeek = this._onSeek.bind(this);
    this._onVideoEnd = this._onVideoEnd.bind(this);
    this._updateVideoControlsWithPlayerState =
        this._updateVideoControlsWithPlayerState.bind(this);
  }

  isAvailableOffline (manifestPath) {
    return this._offlineManager.find(manifestPath).then(item => !!item);
  }

  init () {
    Utils.preloadImage(this._poster)
        .then(_ => this._createPoster(this._poster));

    return Utils.loadScript(Paths.SHAKA_PATH)
        .then(_ => this._initPlayer())
        .then(_ => {
          this._addEventListeners();
          this._initPlayerControls();
        });
  }

  addOfflineFiles (manifestPath) {
    return this._offlineManager.cacheForOffline({
      manifestPath,
      progressCallback: this._onOfflineProgressCallback,
      trackSelectionCallback: this._onTrackSelectionCallback
    });
  }

  removeOfflineFiles (manifestPath) {
    return this._offlineManager.remove(manifestPath);
  }

  cancelOfflineFiles (manifestPath) {
    this._onOfflineProgressCallback(null, 0);
    return this._offlineManager.cancel(manifestPath);
  }

  setManifestPathFromOfflineStatus () {
    return this._offlineManager.find(this._originalManifest).then(item => {
      if (!item) {
        this._videoIsAvailableOffline = false;
        this._manifest = this._originalManifest;
        return;
      }

      this._videoIsAvailableOffline = true;
      this._manifest = item.offlineUri;
    });
  }

  update () {
    return this.setManifestPathFromOfflineStatus().then(_ => {
      this._updateVideoControlsWithPlayerState();
    });
  }

  _initPlayer () {
    let prerequisites = [Promise.resolve()];
    if (this._offlineManager) {
      prerequisites.push(this._offlineManager.destroy());
    }

    return Promise.all(prerequisites).then(_ => {
      this._player = new shaka.Player(this._video);
      this._player.configure({
        abr: {
          defaultBandwidthEstimate: VideoPlayer.DEFAULT_BANDWIDTH
        }
      });

      this._player.addEventListener('buffering', this._onBufferChanged);
      this._offlineManager = new OfflineManager(this._player);
    });
  }

  _createPoster (poster) {
    const posterElement = this._videoContainer.querySelector('.player__poster');
    posterElement.style.backgroundImage = `url(${poster})`;
    posterElement.classList.add('fade-and-scale-in');
  }

  _addEventListeners () {
    this._addVideoPlaybackEventListeners();
    this._addVideoStateEventListeners();
    this._addOrientationEventListeners();
    this._addFullscreenEventListeners();
    this._addRemotePlaybackEventListeners();
  }

  _addFullscreenEventListeners () {
    window.addEventListener('fullscreenchange', this._onFullScreenChanged);
    window.addEventListener('webkitfullscreenchange',
        this._onFullScreenChanged);
  }

  _addVideoPlaybackEventListeners () {
    this._videoContainer.addEventListener('keydown', this._onKeyDown);
    this._videoContainer.addEventListener('click', this._onClick);
    this._videoContainer.addEventListener('play-pause', this._onPlayPause);
    this._videoContainer.addEventListener('back-30', this._onBack30);
    this._videoContainer.addEventListener('fwd-30', this._onFwd30);
    this._videoContainer.addEventListener('seek', this._onSeek);
    this._videoContainer.addEventListener('replay', this._onReplay);
    this._videoContainer.addEventListener('close', this._onClose);
    this._videoContainer.addEventListener('toggle-fullscreen',
        this._onFullScreenToggle);
    this._videoContainer.addEventListener('toggle-chromecast',
        this._onChromecast);
    this._videoContainer.addEventListener('toggle-volume',
        this._onVolumeToggle);
  }

  _addVideoStateEventListeners () {
    this._video.addEventListener('play', this._startTimeTracking);
    this._video.addEventListener('pause', this._stopTimeTracking);
    this._video.addEventListener('ended', this._onVideoEnd);
    this._video.addEventListener('durationchange',
        this._updateVideoControlsWithPlayerState);
  }

  _addOrientationEventListeners () {
    if (!VideoPlayer.SUPPORTS_ORIENTATION) {
      return;
    }

    window.screen.orientation.addEventListener('change',
          this._onOrientationChanged);
  }

  _addRemotePlaybackEventListeners () {
    if (!VideoPlayer.SUPPORTS_REMOTE_PLAYBACK) {
      return;
    }

    this._castVideo.remote
        .addEventListener('connecting', this._onRemoteConnecting);
    this._castVideo.remote
        .addEventListener('connect', this._onRemoteConnect);
    this._castVideo.remote
        .addEventListener('disconnect', this._onRemoteDisconnect);
  }

  _updateVideoControlsWithPlayerState () {
    if (!this._videoControls) {
      return;
    }

    this._videoControls.update(this._getVideoState());
  }

  _getVideoState () {
    return {
      paused: this._video.paused,
      currentTime: this._video.currentTime,
      duration: (
          Number.isNaN(this._video.dura2tion) ? 0.1 : this._video.duration
      ),
      volume: this._video.volume,
      fullscreen: VideoPlayer.isFullScreen,
      offline: this._videoIsAvailableOffline,
      offlineSupported: VideoPlayer.SUPPORTS_OFFLINE,
      title: this._title
    };
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

  _loadAndPlayVideo () {
    return this._player.load(this._manifest).then(_ => {
      if (this._video.paused) {
        this._video.play();
        this._video.volume = 1;
      }
      this._enablePlayerControls();
      this._setMediaSessionData();
      this._startChromecastWatch();
    }, err => {
      console.warn(err.message);
    });
  }

  _initPlayerControls () {
    const videoControls =
        this._videoContainer.querySelector('.player__controls');
    if (!videoControls) {
      console.warn('No video controls. Bailing.');
      return;
    }

    if (!this._videoControls) {
      this._videoControls = new VideoControls(videoControls);
    }
  }

  _enablePlayerControls () {
    this._videoControls.enabled = true;
    this._updateVideoControlsWithPlayerState();
  }

  _setMediaSessionData () {
    if (!VideoPlayer.SUPPORTS_MEDIA_SESSION) {
      return;
    }

    const artworkPath256 = this._assetPath + 'artwork@256.jpg';
    const artworkPath512 = this._assetPath + 'artwork@512.jpg';

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

  _startTimeTracking () {
    this._isTrackingTime = true;
    requestAnimationFrame(this._onTimeUpdate);
  }

  _stopTimeTracking () {
    this._isTrackingTime = false;
  }

  _onBufferChanged (evt) {
    const bufferingClass = 'player--buffering';
    this._videoContainer.classList.toggle(bufferingClass, evt.buffering);
  }

  _onKeyDown (evt) {
    if (evt.keyCode !== 32) {
      return;
    }

    evt.preventDefault();
    this._onPlayPause();
  }

  _onClick (evt) {
    const target = evt.target;

    if (target.classList.contains('player__play-button')) {
      this._video.classList.add('player__element--active');

      // Pre-approve the video for playback on mobile.
      this._video.play().catch(_ => {
        // The play call will probably be interrupted by Shaka loading,
        // so quietly swallow the error.
      });

      // ... then load it.
      return this._loadAndPlayVideo();
    }
  }

  _onTrackSelectionCallback (tracks) {
    // TODO: account for user preferences.
    const audioTracks = tracks.filter(t => t.type === 'audio');
    const videoTracks = tracks.filter(t => t.type === 'video');
    const variantTracks = tracks.filter(t => t.type === 'variant');

    if (variantTracks && variantTracks.length > 0) {
      variantTracks.sort((t1, t2) => t2.bandwidth - t1.bandwidth);
      return [variantTracks[0]];
    }

    audioTracks.sort((t1, t2) => t2.bandwidth - t1.bandwidth);
    videoTracks.sort((t1, t2) => t2.height - t1.height);

    return [
      audioTracks[0],
      videoTracks[0]
    ];
  }

  _onOfflineProgressCallback (data, percent) {
    if (!this._videoControls) {
      return;
    }

    this._videoControls.updateOfflineProgress(percent);
  }

  _onFullScreenChanged () {
    if (!VideoPlayer.SUPPORTS_ORIENTATION_LOCK) {
      return;
    }

    if (VideoPlayer.isFullScreen) {
      return window.screen.orientation.lock('landscape').catch(_ => {
        // Silently swallow errors from attempting to lock the orientation.
        // This only works in the case of web apps added to home screens, but
        // we want to call it anyway.
      });
    }

    return window.screen.orientation.unlock();
  }

  _onPlayPause () {
    if (this._video.paused) {
      this._onPlay();
      return;
    }

    this._onPause();
  }

  _onPlay () {
    this._video.play().then(_ => {
      this._updateVideoControlsWithPlayerState();
    }, err => {
      console.warn(err);
    });
  }

  _onPause () {
    this._video.pause();
    this._updateVideoControlsWithPlayerState();
  }

  _onClose () {
    this._player.destroy().then(_ => {
      this._video.classList.remove('player__element--active');
      this._videoControls.enabled = false;
      this._exitFullScreen();

      // Reboot the player.
      return this._initPlayer();
    });
  }

  _onReplay () {
    this._player.destroy()
        .then(_ => this._initPlayer())
        .then(_ => this._loadAndPlayVideo())
        .then(_ => {
          this._videoContainer.classList.remove('player--ended');
        });
    ;
  }

  _onBack30 () {
    this._video.currentTime =
        Math.max(this._video.currentTime - 30, 0);
    this._updateVideoControlsWithPlayerState();
  }

  _onFwd30 () {
    if (this._video.ended) {
      return;
    }

    this._video.currentTime =
        Math.min(this._video.currentTime + 30, this._video.duration);
    this._updateVideoControlsWithPlayerState();
  }

  _onSeek (evt) {
    this._video.currentTime =
        evt.detail.newTime * this._video.duration;
  }

  _onVideoEnd () {
    this._videoContainer.classList.add('player--ended');
    this._updateVideoControlsWithPlayerState();
  }

  _onOrientationChanged () {
    // Ignore orientation changes when not playing the video.
    if (this._video.paused) {
      return;
    }

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

  _onFullScreenToggle () {
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
    this._updateVideoControlsWithPlayerState();
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

  _onTimeUpdate () {
    if (!this._isTrackingTime) {
      return;
    }
    requestAnimationFrame(this._onTimeUpdate);

    if (!this._videoControls) {
      return;
    }
    this._videoControls.updateTimeTrack(
        this._video.currentTime, this._video.duration);
  }
}

export default VideoPlayer;
