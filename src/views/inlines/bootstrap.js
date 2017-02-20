(function () {
  var play = document.querySelector('.player__play-button');
  if (!play) {
    return;
  }

  // Trigger a layout in WebKit otherwise the play button appears in the
  // wrong place on screen.
  play.offsetWidth;

  play.classList.add('player__play-button--active');
  play.classList.add('fade-and-scale-in-centered');
})();
