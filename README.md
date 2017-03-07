**Please note: This app is being developed. There may be bugs, and everything is subject to change.**

# Sample Media (VOD) App

This is a sample media app to demonstrate media functionality in the context of a Progressive Web App. The build of this site is being cataloged on YouTube as part of the
[Chrome Developers Developer Diary](https://www.youtube.com/playlist?list=PLNYkxOF6rcIBykcJ7bvTpqU7vt-oey72J) series.

![biograf_small](https://cloud.githubusercontent.com/assets/617438/22658834/5f88797c-ec93-11e6-8e9c-b4309c3da1cc.png)

## Running the site locally

1. Clone the repo
1. `cd sample-media-pwa`
1. `npm install`

### Setting up some secrets

Once the entire internet has been cloned into your `node_modules` folder you'll need to create
`src/config`, into which you will need to place a couple of files: `oauth.js` and `session.js`.
These are files which contain secrets and keys, so you can either
[create the appropriate values](https://cloud.google.com/nodejs/getting-started/authenticate-users),
or you can put some placeholder info in:

```javascript
// oauth.js - do not use in production!
// @see https://cloud.google.com/nodejs/getting-started/authenticate-users
module.exports = {
  clientID: 'lolztehclientid',
  clientSecret: 'suchhiddenmanysecretwow',
  callbackURL: 'http://localhost:8080/auth/google/callback',
  accessType: 'offline'
};
```

```javascript
// session.js - do not use in production!
// @see https://cloud.google.com/nodejs/getting-started/authenticate-users
module.exports = {
  resave: false,
  saveUninitialized: false,
  secret: 'totallyasecret',
  signed: true,
  memcacheURL: 'localhost:11211'
};
```

Finally, with that done you should be able to run: `npm run dev`.

The videos are not included in the repo, but rather are served from a Google
Cloud Storage bucket. They are served with CORS headers, meaning that
you will need to run the local copy of the server at port 8080.
