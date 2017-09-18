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

import idbKeyval from '../../third_party/libs/idb-keyval';
import Utils from './utils';

class LicensePersister {

  static get CONTENT_FORMAT () {
    return 'cenc';
  }

  static get CONTENT_TYPE () {
    return 'video/mp4; codecs="avc1.4d401f"';
  }

  static get ROBUSTNESS () {
    // Widevine L3
    return 'SW_SECURE_DECODE';
  }

  static get CONFIG () {
    return [{
      initDataTypes: [LicensePersister.CONTENT_FORMAT],
      videoCapabilities: [{
        contentType: LicensePersister.CONTENT_TYPE,
        robustness: LicensePersister.ROBUSTNESS
      }],
      persistentState: 'required',
      sessionTypes: ['persistent-license']
    }];
  }

  static remove (videoName) {
    return idbKeyval.delete(videoName);
  }

  static restore (session, videoName) {
    let tasks = Promise.resolve();
    if (this._activeSession) {
      console.log('Closing active session.');
      tasks = tasks
          .then(_ => this._activeSession.close())
          .then(_ => {
            this._activeSession = null;
          });
    }

    return tasks.then(_ => {
      return idbKeyval.get(videoName).then(storedSession => {
        if (!storedSession) {
          throw new Error('Unable to restore license; please download again.');
          return;
        }

        console.log('Restoring session: ', storedSession);
        return session.load(storedSession);
      });
    });
  }

  static close (session) {
    session.close();
  }

  static persist (videoName, {name, url, manifest} = drmInfo) {
    return idbKeyval.get(videoName).then(storedSession => {
      if (storedSession) {
        console.log('Already persisted license');
        return true;
      }

      const config = LicensePersister.CONFIG;
      const _onMessage = evt => {
        const session = evt.target;
        this._activeSession = session;

        return Utils.load({
          url,
          body: evt.message
        }).then(license => {
          session.update(license).then(_ => {
            console.log('4. Setting new license: ', license);
            console.log('5. Storing license for next play: ' + session.sessionId);
            return idbKeyval.set(videoName, session.sessionId);
          })
          .catch(error => {
            console.error('Failed to update the session', error);
          });
        });
      };

      return navigator.requestMediaKeySystemAccess(name, config)
          .then(keySystemAccess => {
            console.log(`1. Creating Media Keys ${name}`);
            return keySystemAccess.createMediaKeys();
          })
          .then(createdMediaKeys => {
            console.log('2. Setting Media Keys', createdMediaKeys);
            return createdMediaKeys.createSession('persistent-license');
          })
          .then(session => {
            // Get the PSSH data from the manifest.
            return fetch(manifest)
                .then(r => r.text())
                .then(manifestText => {
                  const parser = new DOMParser();
                  return parser.parseFromString(manifestText, 'text/xml');
                })
                .then(manifestDoc => {
                  if (!manifestDoc) {
                    console.log('Unable to read manifest');
                    return false;
                  }

                  const PSSH = Array
                      .from(manifestDoc.querySelectorAll('*'))
                      .find(node => node.nodeName === 'cenc:pssh');

                  if (!PSSH) {
                    console.log('No PSSH');
                    return false;
                  }

                  console.log('3. Using PSSH data: ' + PSSH.textContent);
                  const initData = Utils.base64ToUint8Array(PSSH.textContent);
                  session.addEventListener('message', _onMessage);
                  return session.generateRequest('cenc', initData);
                });
          })
          .catch(error => {
            console.error('Failed to set up MediaKeys', error);
          });
    });
  }
}

export default LicensePersister;
