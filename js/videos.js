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

// Guide shelf: Previous and Next move one card; the mouse can drag it; a card goes to its guide.
(function () {
  'use strict';
  var shelf = document.getElementById('v-shelf'), prev = document.getElementById('v-prev'), next = document.getElementById('v-next'), btns = document.getElementById('v-shelfbtns');
  if (!shelf || !prev || !next) return;
  btns.hidden = false;
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  function step() {
    var li = shelf.querySelector('li'); if (!li) return 220;
    var gap = parseFloat(getComputedStyle(shelf).columnGap || getComputedStyle(shelf).gap) || 16;
    return li.getBoundingClientRect().width + gap;
  }
  function edges() {
    var max = shelf.scrollWidth - shelf.clientWidth - 2;
    prev.setAttribute('aria-disabled', shelf.scrollLeft <= 2 ? 'true' : 'false');
    next.setAttribute('aria-disabled', shelf.scrollLeft >= max ? 'true' : 'false');
  }
  function by(dir) {
    if ((dir < 0 ? prev : next).getAttribute('aria-disabled') === 'true') return;
    shelf.scrollBy({ left: dir * step(), behavior: reduce ? 'auto' : 'smooth' });
  }
  prev.addEventListener('click', function () { by(-1); });
  next.addEventListener('click', function () { by(1); });
  shelf.addEventListener('scroll', edges, { passive: true });
  window.addEventListener('resize', edges);
  edges();

  // Mouse drag (touch and pen already scroll by themselves). A drag never counts as a click on a card.
  var down = null, moved = false;
  shelf.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    down = { x: e.clientX, left: shelf.scrollLeft }; moved = false;
  });
  document.addEventListener('pointermove', function (e) {
    if (!down) return;
    var dx = e.clientX - down.x;
    if (!moved && Math.abs(dx) < 6) return;
    if (!moved) { moved = true; shelf.classList.add('drag'); }
    shelf.scrollLeft = down.left - dx;
  });
  function end() {
    if (!down) return;
    down = null;
    if (moved) { shelf.classList.remove('drag'); setTimeout(function () { moved = false; }, 0); }
  }
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  shelf.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  shelf.addEventListener('dragstart', function (e) { e.preventDefault(); });

  // A card that gets keyboard focus while only partly in view slides fully into view.
  shelf.addEventListener('focusin', function (e) {
    var a = e.target.closest ? e.target.closest('a.v-card') : null; if (!a) return;
    var li = a.parentNode, l = li.offsetLeft - shelf.offsetLeft, r = l + li.offsetWidth, vis = shelf.scrollLeft + shelf.clientWidth, pad = 4;
    var to = (l - pad < shelf.scrollLeft || r + pad > vis) ? l - pad : -1;   // line the card up with the start, like the snap points
    if (to >= 0) shelf.scrollTo({ left: to, behavior: reduce ? 'auto' : 'smooth' });
  });

  // A card goes to its guide; keyboard focus follows so the next Tab starts inside that guide.
  Array.prototype.forEach.call(shelf.querySelectorAll('a.v-card'), function (a) {
    a.addEventListener('click', function () {
      var g = document.querySelector(a.getAttribute('href')), h = g && g.querySelector('h3');
      // After the browser has followed the link (it clears focus when it jumps to a heading).
      if (h) setTimeout(function () { h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }, 0);
    });
  });
})();
