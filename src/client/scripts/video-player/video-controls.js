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
import DownloadProgress from './download-progress';

class VideoControls {

  static get THUMBNAIL_HEIGHT () {
    return 81;
  }

  static get OFFLINE_BUTTON_SELECTOR () {
    return 'js-offline-button';
  }

  static get HIDE_TIMEOUT () {
    return 500;
  }

  constructor (videoControls) {
    this._videoControls = videoControls;
    this._playPauseBig =
        this._videoControls.querySelector('.js-play-pause-big');
    this._playPauseStandard =
        this._videoControls.querySelector('.js-play-pause-standard');
    this._playerControls =
        document.querySelector('.js-play-controls');
    this._requestVideoStart =
        document.querySelector('.js-request-video-start');
    this._fullscreen = this._videoControls.querySelector('.js-fullscreen');
    this._chromecast = this._videoControls.querySelector('.js-chromecast');
    this._volume = this._videoControls.querySelector('.js-volume');
    this._timeTrack = this._videoControls.querySelector('.js-time-track');
    this._timeUsed = this._videoControls.querySelector('.js-time-used');
    this._playhead = this._videoControls.querySelector('.js-playhead');
    this._duration = this._videoControls.querySelector('.js-duration');
    this._close = this._videoControls.querySelector('.js-close');
    this._replay = document.querySelector('.js-replay');
    this._offline = document.querySelectorAll('.js-offline');
    this._thumbnail = document.querySelector('.js-thumbnail');
    this._thumbnailImage = this._thumbnail.querySelector('.js-thumbnail-image');
    this._thumbnailImageInner =
        this._thumbnail.querySelector('.js-thumbnail-image-inner');
    this._thumbnailImageInnerContent = undefined;

    this._enabled = false;
    this._pendingHide = undefined;
    this._thumbnailHeight = undefined;
    this._castConnected = false;
    this._trackDrag = false;
    this._trackBCR = null;
    this._lockedFocus = false;
    this._lastPlaybackState = null;

    this._firstTabStop = this._close;
    this._lastTabStop = this._videoControls.querySelector('.js-offline');

    this.toggleControls = this.toggleControls.bind(this);
    this.showControls = this.showControls.bind(this);
    this.hideControls = this.hideControls.bind(this);
    this.updateTimeTrack = this.updateTimeTrack.bind(this);

    this._onClick = this._onClick.bind(this);
    this._onFullscreenChange = this._onFullscreenChange.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onInputDown = this._onInputDown.bind(this);
    this._onInputMove = this._onInputMove.bind(this);
    this._onInputUp = this._onInputUp.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onFocus = this._onFocus.bind(this);
    this._onBlur = this._onBlur.bind(this);

    this._addEventListeners();
  }

  get castConnected () {
    return this._castConnected;
  }

  set castConnected (_castConnected) {
    const connectedClass = 'player__controls-standard-chromecast--connected';

    this._castConnected = _castConnected;
    this._chromecast.classList.toggle(connectedClass, _castConnected);
  }

  get enabled () {
    return this._enabled;
  }

  set enabled (_enabled) {
    this._enabled = _enabled;

    if (!this._enabled) {
      this.hideControls(0);
      this._disableKeyboard();
      this._videoControls.classList.remove('player__controls--active');
      this._playerControls.setAttribute('aria-hidden', 'true');
      return;
    }

    this._enableKeyboard();
    this._videoControls.classList.add('player__controls--active');
    this._playerControls.removeAttribute('aria-hidden');
    this._playPauseBig.focus();
  }

  showChromecastButton () {
    this._chromecast.hidden = false;
  }

  hideChromecastButton () {
    this._chromecast.hidden = true;
  }

  _toggleChromecastButtonVisibility (isVisible) {
    const chromeCastButton = this._videoControls
        .querySelector('.player__controls-standard-chromecast');

    chromeCastButton.hidden = isVisible;
  }

  _addEventListeners () {
    this._videoControls.addEventListener('mousemove', _ => this.showControls());
    this._videoControls.addEventListener('mouseout', _ => this.hideControls());

    this._videoControls.addEventListener('mousedown', this._onInputDown);
    this._videoControls.addEventListener('mousemove', this._onInputMove);
    this._videoControls.addEventListener('mouseup', this._onInputUp);
    this._videoControls.addEventListener('touchstart', this._onInputDown, {
      passive: false
    });
    this._videoControls.addEventListener('touchmove', this._onInputMove, {
      passive: false
    });
    this._videoControls.addEventListener('touchend', this._onInputUp, {
      passive: false
    });

    this._videoControls.addEventListener('click', this._onClick);
    this._replay.addEventListener('click', this._onClick);
    this._requestVideoStart.addEventListener('click', this._onClick);

    Array.from(this._offline).forEach(offline => {
      offline.addEventListener('click', this._onClick);
    });

    this._timeTrack.addEventListener('focus', this._onFocus);
    this._timeTrack.addEventListener('blur', this._onBlur);

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('fullscreenchange', this._onFullscreenChange);
    document.addEventListener('webkitfullscreenchange',
        this._onFullscreenChange);

    window.addEventListener('resize', this._onResize);
  }

  _cancelPendingHide () {
    if (!this._pendingHide) {
      return;
    }

    clearTimeout(this._pendingHide);
    this._pendingHide = undefined;
  }

  showControls (cancelHide=false) {
    this._cancelPendingHide();

    if (!this._enabled) {
      return;
    }

    this._videoControls.classList.add('player__controls--visible');

    if (cancelHide) {
      return;
    }

    this.hideControls(VideoControls.HIDE_TIMEOUT * 5);
  }

  hideControls (timeout=VideoControls.HIDE_TIMEOUT) {
    if (!Number.isFinite(timeout)) {
      timeout = VideoControls.HIDE_TIMEOUT;
    }

    this._cancelPendingHide();
    this._pendingHide = setTimeout(_ => {
      this._onBlur();
      this._videoControls.classList.remove('player__controls--visible');
    }, timeout);
  }

  toggleControls () {
    if (this._videoControls.classList.contains('player__controls--visible')) {
      this.hideControls();
      return;
    }

    this.showControls();
  }

  updateTimeTrack (time, duration) {
    if (this._trackDrag) {
      return;
    }

    if (Number.isNaN(duration)) {
      duration = 1;
    }

    const normalizedTime = time / duration;
    this._setTimeTrackPosition(normalizedTime);
    this._setThumbnailPosition(normalizedTime);
    this._setThumbnailImagePosition(normalizedTime);
  }

  updateOfflineProgress (percentage, isBackground=false) {
    Array.from(this._offline).forEach(offline => {
      if (isBackground) {
        offline.classList.add('toggle-offline--indeterminate');
        return;
      }

      offline.classList.remove('toggle-offline--indeterminate');
      DownloadProgress.update(offline, percentage);
    });
  }

  update (state) {
    const pausedBigClass = 'player__controls-big-play-pause--paused';
    const pausedStandardClass = 'player__controls-standard-play-pause--paused';
    const fsClass = 'player__controls-standard-toggle-fullscreen--active';
    const volumeClass = 'player__controls-standard-toggle-volume--muted';
    const offlineHiddenClass =
        'player__controls-standard-toggle-offline--hidden';
    const offlineClass = 'offline--available';

    this._videoControls.dataset.title = state.title + (state.encrypted ?
        ' (Protected)' : '');
    this._playPauseBig.classList.toggle(pausedBigClass, state.paused);
    this._playPauseStandard.classList.toggle(pausedStandardClass, state.paused);
    this._fullscreen.classList.toggle(fsClass, state.fullscreen);
    this._volume.classList.toggle(volumeClass, state.volume === 0);
    this._duration.textContent = this._formatDuration(state.duration);
    this.updateTimeTrack(state.currentTime, state.duration);

    Array.from(this._offline).forEach(offline => {
      if (!state.offlineSupported) {
        offline.classList.add(offlineHiddenClass);
        return;
      }

      offline.classList.toggle(offlineClass, state.offline);
      offline.classList.add('fade-in');
    });

    if (state.paused === this._lastPlaybackState) {
      return;
    }

    this._lastPlaybackState = state.paused;
    if (state.paused) {
      this._unlockFocus();
    } else {
      this._lockFocus();
    }
  }

  _enableKeyboard () {
    const buttons = this._videoControls.querySelectorAll('button');
    Array.from(buttons).forEach(button => {
      button.setAttribute('tabindex', 0);
    });

    this._timeTrack.setAttribute('tabindex', 0);
  }

  _disableKeyboard () {
    const buttons = this._videoControls.querySelectorAll('button');
    Array.from(buttons).forEach(button => {
      button.setAttribute('tabindex', -1);
    });

    this._timeTrack.setAttribute('tabindex', -1);
  }

  _lockFocus () {
    this._lockedFocus = true;
  }

  _unlockFocus () {
    this._lockedFocus = false;
  }

  _setTimeTrackPosition (normalizedPosition) {
    this._timeUsed.style.transform = `
      translate(-50%, -50%)
      scaleX(${normalizedPosition})
    `;

    this._playhead.style.transform =
        `translateX(${(normalizedPosition - 1) * 100}%)`;
  }

  _setThumbnailPosition (normalizedPosition) {
    if (!this._thumbnailImage) {
      return;
    }

    if (!this._trackBCR) {
      return;
    }

    const playheadPosition =
        this._trackBCR.left + normalizedPosition * this._trackBCR.width;

    // If the playhead button is to the left of 80px then the thumbnail image
    // will be off the screen, so transform it by that amount to the right.
    if (playheadPosition < 80) {
      const x = 80 - playheadPosition;
      this._thumbnailImage.style.transform = `translateX(${x}px)`;
    }
  }

  _setThumbnailImagePosition (normalizedPosition) {
    if (!this._thumbnailImageInnerContent) {
      this._thumbnailImageInnerContent =
          document.querySelector('.js-thumbnail-image-inner-content');
    }

    if (!this._thumbnailImageInnerContent) {
      return;
    }

    if (!this._thumbnailHeight) {
      this._thumbnailHeight = this._thumbnailImageInnerContent.offsetHeight;
    }

    const availableHeight =
        this._thumbnailHeight - VideoControls.THUMBNAIL_HEIGHT;
    const index = Math.floor((normalizedPosition * availableHeight) /
        VideoControls.THUMBNAIL_HEIGHT);
    const offset = index * VideoControls.THUMBNAIL_HEIGHT;
    this._thumbnailImageInnerContent.style.transform =
        `translateY(-${offset}px)`;
  }

  _formatDuration (secs) {
    if (Number.isNaN(secs)) {
      return '00:00';
    }

    const lPad = num => {
      return (num < 10 ? '0' : '') + num.toString();
    };

    const hours = Math.floor(secs / 3600);
    secs -= hours * 3600;

    const mins = Math.floor(secs / 60);
    secs -= mins * 60;

    secs = Math.floor(secs);

    return `${(hours > 0 ? hours + ':' : '')}${lPad(mins)}:${lPad(secs)}`;
  }

  _onClick (evt) {
    const type = evt.target.dataset.type;
    const detail = {};

    evt.stopImmediatePropagation();
    if (!type) {
      this.showControls();
      return;
    }

    switch (type) {
      case 'close':
        this._requestVideoStart.removeAttribute('aria-hidden');
        this._requestVideoStart.focus();
        break;

      case 'request-video-start':
        this._requestVideoStart.setAttribute('aria-hidden', 'true');
        break;
    }

    for (const data in evt.target.dataset) {
      if (!data.startsWith('detail')) {
        continue;
      }

      if (data === 'detail') {
        detail.value = evt.target.dataset.detail;
        continue;
      }

      let detailName = data.replace(/^detail/, '');
      detailName = detailName.substr(0, 1).toLowerCase() +
          detailName.substr(1);

      detail[detailName] = evt.target.dataset[data];
    }

    // Fire off whatever the button says as a custom event, which the player
    // can pick up and use to control the playback.
    Utils.fire(this._videoControls, type, detail);
  }

  _onFullscreenChange () {
    const isFullscreen = (document.fullscreenElement ||
        document.webkitFullscreenElement);
    const fsClass = 'player__controls-standard-toggle-fullscreen--active';

    this._fullscreen.classList.toggle(fsClass, isFullscreen);
  }

  _onKeyDown (evt) {
    switch (evt.keyCode) {
      case 9: // Tab
        this.showControls(true);

        if (!this._lockedFocus) {
          return;
        }

        if (document.activeElement === this._firstTabStop) {
          if (!evt.shiftKey) {
            return;
          }

          this._lastTabStop.focus();
          evt.preventDefault();
        } else if (document.activeElement === this._lastTabStop) {
          if (evt.shiftKey) {
            return;
          }

          this._firstTabStop.focus();
          evt.preventDefault();
        }

        return;

      case 37: // Left arrow
        if (document.activeElement !== this._timeTrack) {
          return;
        }

        Utils.fire(this._videoControls, 'back-30');
        return;

      case 39: // Right arrow
        if (document.activeElement !== this._timeTrack) {
          return;
        }

        Utils.fire(this._videoControls, 'fwd-30');
        return;

      case 27: // Escape
        evt.preventDefault();
        this._close.focus();
        return;

      case 32: // Space
        if (document.activeElement !== document.body) {
          return;
        }

        evt.preventDefault();
        evt.stopImmediatePropagation();
        Utils.fire(this._videoControls, 'play-pause');
        return;
    }
  }

  _onInputDown (evt) {
    const controlsVisible =
        this._videoControls.classList.contains('player__controls--visible');

    if (!controlsVisible) {
      return;
    }

    this._trackDrag = ('timeTrack' in evt.target.dataset);
    if (!this._trackDrag) {
      return;
    }

    // The focus event won't necessarily fire for touch, so force the onFocus
    // behavior here.
    if (evt.touches) {
      this._onFocus();
    }

    // Lazily pick up a read on how wide the track is.
    if (!this._trackBCR) {
      this._trackBCR = evt.target.getBoundingClientRect();
    }

    this._evtToTrackPosition(evt);
  }

  _onFocus () {
    this._thumbnail.classList.add('player__thumbnail--visible');
  }

  _onBlur () {
    this._thumbnail.classList.remove('player__thumbnail--visible');
  }

  _onInputMove (evt) {
    if (!this._trackDrag) {
      return;
    }

    evt.preventDefault();
    this.showControls(true);
    this._evtToTrackPosition(evt);
  }

  _onInputUp (evt) {
    const controlsVisible =
        this._videoControls.classList.contains('player__controls--visible');

    if (!controlsVisible) {
      evt.preventDefault();
      evt.stopImmediatePropagation();
      this.showControls();
      return;
    }

    if (!this._trackDrag) {
      return;
    }

    this._trackDrag = false;
    const newTime = this._evtToTrackPosition(evt);

    Utils.fire(this._videoControls, 'seek', {newTime});
    this.hideControls();
  }

  _evtToTrackPosition (evt) {
    const findCandidate = evt => {
      if (evt.touches && evt.touches.length) {
        return evt.touches[0];
      }

      if (evt.changedTouches && evt.changedTouches.length) {
        return evt.changedTouches[0];
      }

      return evt;
    };

    const absX = findCandidate(evt).pageX;
    const normalizedPosition = Utils.clamp(
        (absX - this._trackBCR.left) / this._trackBCR.width,
        0,
        1);

    this._setTimeTrackPosition(normalizedPosition);
    this._setThumbnailPosition(normalizedPosition);
    this._setThumbnailImagePosition(normalizedPosition);
    return normalizedPosition;
  }

  _onResize () {
    this._trackBCR = null;
  }
}

export default VideoControls;
