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

const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const oauthConfig = require('../../config/oauth');

const init = app => {
  console.log('Passport initialized.');
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new GoogleStrategy(oauthConfig,
    (accessToken, refreshToken, profile, cb) => {
      cb(null, profile);
    }));

  passport.serializeUser((user, cb) => {
    cb(null, user);
  });

  passport.deserializeUser((obj, cb) => {
    cb(null, obj);
  });

  createAuthRoutes(app);
};

const createAuthRoutes = app => {
  const router = express.Router();
  router.get('/auth/login',
    (req, res, next) => {
      if (req.query.return) {
        req.session.oauth2return = req.query.return;
      }
      next();
    },

    passport.authenticate('google', {
      scope: ['email', 'profile']
    })
  );

  router.get('/auth/google/callback',
    passport.authenticate('google'),

    (req, res) => {
      const redirect = req.session.oauth2return || '/';
      delete req.session.oauth2return;
      res.redirect(redirect);
    }
  );

  router.get('/auth/logout', (req, res) => {
    req.logout();
    res.redirect('/');
  });

  app.use(router);
};

const required = (req, res, next) => {
  if (!req.user) {
    req.session.oauth2return = req.originalUrl;
    return res.redirect('/auth/login');
  }

  next();
};

module.exports = {
  init,
  required
};
