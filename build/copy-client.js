var copy = require('copy');

copy(
  'src/client/**/*.*',
  'dist/client',
  {"ignore":[ "src/client/scripts/**/*.*","src/client/styles/**/*.*","src/client/videos/**/*.*"]},
  function(err, files) {
    if (err) return console.error(err);
    // files.forEach(function(file) {
    //   console.log(file.relative);
    // });
  }
);



