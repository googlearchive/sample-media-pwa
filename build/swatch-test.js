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

const argv = require('yargs').argv;
const Swatch = require('./swatch');
const image = argv.image;
const write = argv.write;

// Get the folder of videos from the command line.
if (!image) {
  console.error('You must provide an image with the --image flag');
  process.exit(1);
}

Swatch.load(image)
    .then(pixels => Swatch.quantize(pixels))
    .then(buckets => Swatch.orderByLuminance(buckets))
    .then(swatch => {
      const primary = Swatch.getMostVariantColor(swatch);
      const colors = {
        primary,
        secondary: Swatch.darken(primary, 25),
        tertiary: Swatch.darken(primary, 50),
        quaternary: Swatch.darken(primary, 75),
        primaryLight: Swatch.lighten(primary, 100)
      };

      console.log(JSON.stringify(colors, null, 2));

      // Write out an HTML doc.
      if (!write) {
        return;
      }

      const fs = require('fs');
      const path = require('path');
      swatchHTML = `
        <!doctype html>
        <html>
          <head>
            <title>Swatch for ${image}</title>
            <style>
              html, body { width: 100%; height: 100%; margin: 0; padding: 0 }
              body { display: flex; flex-wrap: wrap; }
              .color { width: 25%; height: 25%; }
            </style>
          </head>
          <body>
            ${swatch.reduce((prev, color) => {
              return prev + `<div
                  class="color"
                  style="background-color: rgb(${color.r}, ${color.g}, ${color.b})"></div>`;
            }, '')}
          </body>
        </html>
      `;
      fs.writeFile(`${path.dirname(image)}/swatch.html`, swatchHTML);
    });
