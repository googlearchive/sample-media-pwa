(function () {
  var play = document.querySelector('.player__play-button');
  console.log(play);
  if (!play) {
    return;
  }

  play.classList.add('player__play-button--active');
  play.classList.add('fade-and-scale-in-centered');
})();
