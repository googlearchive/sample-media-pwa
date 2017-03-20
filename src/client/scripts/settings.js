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

import Toast from './helpers/toast';
import Utils from './helpers/utils';
import Settings from './helpers/settings';

class SettingsManager {
  static get OPTIONS () {
    return [
      'prefetch',
      'downloads-only'
    ];
  }

  constructor () {
    this._onClick = this._onClick.bind(this);
    this._controls = this._getControls();
    this._addEventListeners();
    this._updateControls();
  }

  _getControls () {
    return SettingsManager.OPTIONS.map(setting => {
      return document.querySelector(`.js-${setting}`);
    });
  }

  _addEventListeners () {
    document.addEventListener('click', this._onClick);
  }

  _onClick (evt) {
    if (this._controls.indexOf(evt.target) === -1) {
      return;
    }

    const settingName = evt.target.dataset.settingName;
    if (!settingName) {
      console.warn('Control has no setting name');
      return;
    }

    Settings.set(settingName, evt.target.checked).then(_ => {
      this._updateControls();
      Utils.fire(evt.target, 'settings-updated');
      Toast.create('Settings updated.', {tag: 'settings'});
    });
  }

  _updateControls () {
    Promise.all(
      SettingsManager.OPTIONS.map(setting => {
        return Settings.get(setting);
      })
    )
    .then(values => {
      this._controls.forEach((control, idx) => {
        if (!control) {
          console.warn(`No control for ${SettingsManager.OPTIONS[idx]}`);
          return;
        }

        control.checked = values[idx];
        control.parentNode.classList.add('fade-in');
      });
    });
  }
}

window.biograf = window.biograf || {};
window.biograf.settingsManager = window.biograf.settingsManager ||
    new SettingsManager();
