/* Videos and guides: caption backup and print buttons. Everything else on the page is plain HTML. */
(function () {
  'use strict';
  // If a captions file can't load, build the same captions from js/captions.js.
  function toSec(s) { var p = s.trim().split(':'); return (+p[0]) * 3600 + (+p[1]) * 60 + parseFloat(p[2]); }
  function addCues(video, track, text) {
    if (video.getAttribute('data-cap-built') || !window.VTTCue || !video.addTextTrack) return;
    video.setAttribute('data-cap-built', '1');
    var tt = video.addTextTrack('captions', track.label || 'English', track.srclang || 'en');
    text.split(/\n\s*\n/).forEach(function (block) {
      var lines = block.trim().split('\n'), i = 0;
      while (i < lines.length && lines[i].indexOf('-->') < 0) i++;
      if (i >= lines.length) return;
      var tm = lines[i].split('-->');
      tt.addCue(new window.VTTCue(toSec(tm[0]), toSec(tm[1]), lines.slice(i + 1).join('\n')));
    });
    tt.mode = 'showing';
  }
  Array.prototype.forEach.call(document.querySelectorAll('video track'), function (track) {
    var video = track.parentNode, text = (window.VOICE_CAPTIONS || {})[track.getAttribute('src')];
    if (!text) return;
    track.addEventListener('error', function () { addCues(video, track, text); });
    // Some hosts fail before this script runs: check the track's state too.
    setTimeout(function () { if (track.readyState === 3) addCues(video, track, text); }, 1500);
  });
})();

(function () {
  'use strict';
  var bar = document.getElementById('v-printbar');
  var all = document.getElementById('v-print-all');
  var quick = document.getElementById('v-print-quick');
  if (!bar || !all || !quick || typeof window.print !== 'function') return;
  bar.hidden = false;
  function go(cls) {
    document.body.classList.add(cls);
    window.print();
  }
  function reset() {
    document.body.classList.remove('v-print-all', 'v-print-quick');
  }
  all.addEventListener('click', function () { go('v-print-all'); });
  quick.addEventListener('click', function () { go('v-print-quick'); });
  window.addEventListener('afterprint', reset);
})();
