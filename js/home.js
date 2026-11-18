// Home page (cut-paper look): touch-the-board hero, unscrambling headline, board looks, and the "watch the board grow" demo.
(function () {
  'use strict';
  var B = window.VOICE_BOARD || [], say = window.VOICE_SAY || function () {};
  var COLS = 9;
  var calm = false;
  try { calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // ----- Hero board: tiles light under a finger and fade; tap to hear the word -----
  var board = document.getElementById('board');
  if (board) {
    var timers = {};
    board.innerHTML = B.map(function (r, i) {
      return '<button type="button" class="t t-' + r[2] + '" data-i="' + i + '" style="--r:' + ((((i * 37) % 7) - 3) * 0.6).toFixed(1) + 'deg" tabindex="' + (i ? -1 : 0) + '" aria-label="Say ' + r[0] + '"><img src="img/symbols/' + r[4] + '" alt=""><span>' + r[0] + '</span></button>';
    }).join('');
    var tiles = board.querySelectorAll('.t');
    var light = function (i) {
      var el = tiles[i]; if (!el) return;
      el.classList.add('lit');
      clearTimeout(timers[i]);
      timers[i] = setTimeout(function () { el.classList.remove('lit'); }, 180);
    };
    var over = function (e) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var t = el && el.closest ? el.closest('[data-i]') : null;
      if (t && board.contains(t)) light(Number(t.getAttribute('data-i')));
    };
    board.addEventListener('pointermove', over);
    board.addEventListener('pointerdown', over);
    board.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-i]') : null; if (!t) return;
      var i = Number(t.getAttribute('data-i')); light(i); say(B[i][1]);
    });
    // Arrow keys move around the board, so the board is one stop for keyboard users.
    board.addEventListener('keydown', function (e) {
      var t = e.target.closest ? e.target.closest('[data-i]') : null; if (!t) return;
      var i = Number(t.getAttribute('data-i')), n = i;
      if (e.key === 'ArrowRight') n = i + 1; else if (e.key === 'ArrowLeft') n = i - 1;
      else if (e.key === 'ArrowDown') n = i + COLS; else if (e.key === 'ArrowUp') n = i - COLS; else return;
      if (n < 0 || n >= tiles.length) return;
      e.preventDefault();
      tiles[i].tabIndex = -1; tiles[n].tabIndex = 0; tiles[n].focus();
    });
  }

  // ----- Headline: letters start scattered and scrambled, then settle left to right -----
  var h = document.getElementById('headline');
  if (h && !calm) {
    var text = h.textContent.replace(/\s+/g, ' ').trim();
    var glyphs = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnpqrstuvwxyz';
    h.setAttribute('aria-label', text);
    var idx = 0, chars = [];
    h.innerHTML = text.split(' ').map(function (word) {
      return '<span class="w" aria-hidden="true">' + word.split('').map(function (ch) {
        chars.push(ch); return '<span class="ch" data-c="' + (idx++) + '">' + ch + '</span>';
      }).join('') + '</span>';
    }).join(' ');
    var spans = h.querySelectorAll('.ch'), tick = null;
    var run = function () {
      clearInterval(tick);
      var start = Date.now();
      var frame = function () {
        var t = Date.now() - start, done = true;
        for (var i = 0; i < spans.length; i++) {
          var home = t >= 300 + i * 22, ch = chars[i];
          if (home) { spans[i].style.transform = 'none'; spans[i].style.opacity = '1'; spans[i].textContent = ch; continue; }
          done = false;
          var dir = i % 2 ? 1 : -1, rand = ((i * 7 + 20) % 4) - 4, wave = Math.sin(i * 17 * Math.PI / 180);
          spans[i].style.transform = 'translate3d(0,' + ((rand + wave) * dir * 14).toFixed(1) + 'px,' + (Math.abs(rand * 2 + wave) * 22).toFixed(1) + 'px) rotateX(' + (dir * 35) + 'deg)';
          spans[i].style.opacity = '.35';
          spans[i].textContent = /[^A-Za-z]/.test(ch) ? ch : glyphs[(i * 13 + Math.floor(t / 50) * 7) % glyphs.length];
        }
        if (done) clearInterval(tick);
      };
      frame(); tick = setInterval(frame, 50);
    };
    run();
    h.addEventListener('click', run);
  }

  // ----- Board looks -----
  var LOOKS = ['standard', 'dark', 'cvi', 'cbsafe', 'dim'];
  var lookBtns = document.querySelectorAll('[data-look]');
  var setLook = function (id) {
    LOOKS.forEach(function (l) { document.body.classList.remove('th-' + l); });
    document.body.classList.add('th-' + id);
    for (var i = 0; i < lookBtns.length; i++) lookBtns[i].setAttribute('aria-pressed', lookBtns[i].getAttribute('data-look') === id ? 'true' : 'false');
  };
  for (var k = 0; k < lookBtns.length; k++) (function (b) {
    b.addEventListener('click', function () {
      setLook(b.getAttribute('data-look'));
      if (b.classList.contains('look') && board) board.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    });
  })(lookBtns[k]);

  // ----- Watch the board grow: the app's real stages for the 45-button main page -----
  var grow = document.getElementById('grow');
  if (grow) {
    var NOTES = {
      1: 'Six words a child needs every day: help, stop, eat, drink, bathroom and more.',
      2: 'First requests and answers arrive: want, go, open, finished, yes and no. Four folders open up: Chat, Actions, Food and Drinks.',
      3: 'I and you arrive, with like, get and put, and the first describing and place words.',
      4: 'The page is full: question words, more actions and describing words, and the Play, People and Places folders.'
    };
    var head = document.getElementById('stage-head'), note = document.getElementById('stage-note');
    var btns = document.querySelectorAll('[data-stage]');
    var prev = 1;
    var draw = function (stage) {
      var count = 0;
      grow.innerHTML = B.map(function (r) {
        var on = r[3] <= stage; if (on) count++;
        return '<div class="g' + (on ? ' g-' + r[2] : ' hid') + (on && r[3] > prev ? ' new' : '') + '">' + (on ? '<img src="img/symbols/' + r[4] + '" alt=""><span>' + r[0] + '</span>' : '') + '</div>';
      }).join('');
      grow.setAttribute('aria-label', 'Main page at stage ' + stage + ', showing ' + count + ' of ' + B.length + ' buttons. The rest are empty saved spots.');
      head.textContent = 'Stage ' + stage + ': ' + count + ' buttons';
      note.textContent = NOTES[stage];
      for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', Number(btns[i].getAttribute('data-stage')) === stage ? 'true' : 'false');
      prev = stage;
    };
    for (var j = 0; j < btns.length; j++) (function (b) {
      b.addEventListener('click', function () { draw(Number(b.getAttribute('data-stage'))); });
    })(btns[j]);
    draw(1);
  }
})();
