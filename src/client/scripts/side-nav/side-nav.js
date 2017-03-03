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

import Detabinator from '../helpers/detabinator';

class SideNav {
  static init () {
    this._instance = this._instance || new SideNav();
    return this._instance;
  }

  constructor () {
    this._showButtonEl = document.querySelector('.js-menu-show');
    this._hideButtonEl = document.querySelector('.js-menu-hide');
    this._sideNavEl = document.querySelector('.js-side-nav');
    this._sideNavContainerEl = document.querySelector('.js-side-nav-container');

    if (!(this._showButtonEl &&
        this._hideButtonEl &&
        this._sideNavEl &&
        this._sideNavContainerEl)) {
      console.warn('No sidenav');
      return;
    }

    // Control whether the container's children can be focused
    // Set initial state to inert since the drawer is offscreen
    this._detabinator = new Detabinator(this._sideNavContainerEl);
    this._detabinator.inert = true;

    this._showSideNav = this._showSideNav.bind(this);
    this._hideSideNav = this._hideSideNav.bind(this);
    this._blockClicks = this._blockClicks.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onTransitionEnd = this._onTransitionEnd.bind(this);
    this._update = this._update.bind(this);

    this._startX = 0;
    this._currentX = 0;
    this._touchingSideNav = false;

    this._supportsPassive = undefined;
    this._addEventListeners();
  }

  // apply passive event listening if it's supported
  _applyPassive () {
    if (this._supportsPassive !== undefined) {
      return this._supportsPassive ? {passive: true} : false;
    }
    // feature detect
    let isSupported = false;
    try {
      document.addEventListener('test', null, {get passive () {
        isSupported = true;
      }});
    } catch (e) { }
    this._supportsPassive = isSupported;
    return this._applyPassive();
  }

  _addEventListeners () {
    this._showButtonEl.addEventListener('click', this._showSideNav);
    this._hideButtonEl.addEventListener('click', this._hideSideNav);
    this._sideNavEl.addEventListener('click', this._hideSideNav);
    this._sideNavContainerEl.addEventListener('click', this._blockClicks);

    this._sideNavEl.addEventListener('touchstart', this._onTouchStart,
        this._applyPassive());
    this._sideNavEl.addEventListener('touchmove', this._onTouchMove,
        this._applyPassive());
    this._sideNavEl.addEventListener('touchend', this._onTouchEnd);
  }

  _onTouchStart (evt) {
    if (!this._sideNavEl.classList.contains('side-nav--visible'))
      return;

    this._startX = evt.touches[0].pageX;
    this._currentX = this._startX;

    this._touchingSideNav = true;
    requestAnimationFrame(this._update);
  }

  _onTouchMove (evt) {
    if (!this._touchingSideNav)
      return;

    this._currentX = evt.touches[0].pageX;
  }

  _onTouchEnd () {
    if (!this._touchingSideNav)
      return;

    this._touchingSideNav = false;

    const translateX = Math.min(0, this._currentX - this._startX);
    this._sideNavContainerEl.style.transform = '';

    if (translateX < 0) {
      this._hideSideNav();
    }
  }

  _update () {
    if (!this._touchingSideNav)
      return;

    requestAnimationFrame(this._update);

    const translateX = Math.min(0, this._currentX - this._startX);
    this._sideNavContainerEl.style.transform = `translateX(${translateX}px)`;
  }

  _blockClicks (evt) {
    evt.stopPropagation();
  }

  _onTransitionEnd () {
    this._sideNavEl.classList.remove('side-nav--animatable');
    this._sideNavEl.removeEventListener('transitionend', this._onTransitionEnd);
  }

  _showSideNav () {
    this._sideNavEl.classList.add('side-nav--animatable');
    this._sideNavEl.classList.add('side-nav--visible');
    this._detabinator.inert = false;
    this._sideNavEl.addEventListener('transitionend', this._onTransitionEnd);
  }

  _hideSideNav () {
    this._sideNavEl.classList.add('side-nav--animatable');
    this._sideNavEl.classList.remove('side-nav--visible');
    this._detabinator.inert = true;
    this._sideNavEl.addEventListener('transitionend', this._onTransitionEnd);
  }
}

export default SideNav;
