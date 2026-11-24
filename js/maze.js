// "Escape Lower Wacker": a short maze game on the Practice games page.
// Plain JS. Nothing is saved or sent. Sound is off until the visitor turns it on, and speech uses only on-device voices.
// Controls are six core-word tiles (up, down, left, right, go, stop), the arrow keys and Space, or a swipe on the maze.
(function () {
  'use strict';
  var root = document.getElementById('m-game'); if (!root) return;

  var TEST = /[?&]test(=|&|$)/.test(location.search);   // a read-only look at the maze, for the site's own tests
  var C = 60, PAD = 6, STEP_MS = 180;                     // drawing units per cell, outer padding, ms per square
  var N_ = 1, E_ = 2, S_ = 4, W_ = 8;
  var DIR = {
    up: { dx: 0, dy: -1, bit: N_ }, right: { dx: 1, dy: 0, bit: E_ },
    down: { dx: 0, dy: 1, bit: S_ }, left: { dx: -1, dy: 0, bit: W_ }
  };
  var ROT = { up: 0, right: 90, down: 180, left: 270 };

  var LEVELS = [
    { name: 'Upper Wacker', cls: 'l1', n: 5, floor: '#d3ecfb', wall: '#2a2350', outline: '',
      start: 'Upper Wacker? That’s the easy part, pigeon.', win: 'Fine. You escaped. Beginner’s luck.' },
    { name: 'Lower Wacker', cls: 'l2', n: 7, floor: '#29303c', wall: '#ece9ff', outline: '#0b0d12',
      start: 'Lower Wacker. Even the delivery trucks get lost down here.', win: 'Okay… that was pretty good.' },
    { name: 'Lower Lower Wacker', cls: 'l3', n: 9, floor: '#151823', wall: '#e2deff', outline: '#05060a',
      start: 'Lower LOWER Wacker. Yes, it’s real. No, I won’t help.', win: 'Fine. FINE. You beat Lower Lower Wacker. I’m telling no one.' }
  ];
  var DEAD = ['Dead end! This is why I fly.', 'Wrong way. Classic Lower Wacker.', 'Ha! You found a wall. Congratulations.', 'Have you tried… not going this way?'];
  var WORDS = [['up', 'place'], ['down', 'place'], ['left', 'place'], ['right', 'place'], ['go', 'action'], ['stop', 'social']];
  var KIND = { up: 'place', down: 'place', left: 'place', right: 'place', go: 'action', stop: 'social' };
  var CONF = ['#ffd84d', '#f9cddd', '#c9edc2', '#c6e0f7', '#e0d0f3', '#fddcb2', '#3b2f9e', '#2e7d32'];

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function shuffle(a) { var b = a.slice(), i, j, t; for (i = b.length - 1; i > 0; i--) { j = rnd(i + 1); t = b[i]; b[i] = b[j]; b[j] = t; } return b; }

  // ---------- Sound (off until switched on) ----------
  var snd = false;
  function pickVoice(s) {
    var all = (s.getVoices && s.getVoices()) || [];
    if (!all.length) return undefined;
    var local = all.filter(function (v) { return v.localService; });
    if (!local.length) return null;
    var en = local.filter(function (v) { return /^en([-_]|$)/i.test(v.lang || ''); });
    var us = en.filter(function (v) { return /^en[-_]US/i.test(v.lang || ''); });
    var d = function (l) { return l.filter(function (v) { return v.default; })[0]; };
    return d(us) || us[0] || d(en) || en[0] || d(local) || local[0];
  }
  // Dibs: the site's higher voice (pitch 1.3). Wacker: the same on-device voices, lower (pitch 0.6). queue=true keeps what is already being said.
  function talk(text, pitch, queue) {
    if (!snd || !text) return;
    try {
      var s = window.speechSynthesis; if (!s) return;
      var v = pickVoice(s); if (v === null) return;
      if (!queue) s.cancel();
      var u = new SpeechSynthesisUtterance(String(text).replace(/…/g, ', ')); u.lang = 'en-US'; u.pitch = pitch; u.rate = pitch < 1 ? 0.95 : 1;
      if (v) { u.voice = v; u.lang = v.lang || 'en-US'; }
      s.speak(u);
    } catch (e) {}
  }
  function dibsSay(t, q) { talk(t, 1.3, q); }
  function wackerSay(t, q) { talk(t, 0.6, q); }
  function wordSay(w, queue) {
    if (!snd) return;
    if (queue) talk(w, 1.3, true); else if (window.VOICE_SAY) window.VOICE_SAY(w);
  }
  function stopSpeech() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} }

  // ---------- Markup ----------
  var ARROW = '<svg class="m-arrow" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 2L18 16H2Z" fill="#ffd84d" stroke="#2a2350" stroke-width="2.4" stroke-linejoin="round"/></svg>';
  root.innerHTML =
    '<div class="m-top">' +
      '<div class="m-lvbox"><p class="m-label" id="m-lv-label">Choose a level</p>' +
        '<div class="seg m-lv" id="m-lv" role="group" aria-labelledby="m-lv-label">' +
          LEVELS.map(function (l, i) {
            return '<button type="button" class="pill" data-lv="' + i + '" aria-pressed="false"><span class="m-pn">' + (i + 1) + '</span><span class="m-pt">' + l.name + '</span><span class="m-lock" hidden>Locked</span></button>';
          }).join('') +
        '</div></div>' +
      '<div class="togs m-snd"><button type="button" class="tog" id="m-snd" role="switch" aria-checked="false"><span>Sound: off</span><span class="track" aria-hidden="true"><span class="knob"></span></span></button></div>' +
    '</div>' +
    '<div class="m-perch">' +
      '<div class="m-wsay"><span class="m-who">Wacker</span><span id="m-wk-t"></span></div>' +
      '<div class="m-wk"><img class="m-wkimg" src="img/wacker/wacker.svg" alt="Wacker the falcon, sitting on a girder"><span class="m-girder" aria-hidden="true"></span></div>' +
    '</div>' +
    '<div class="m-board l1" id="m-board" tabindex="0" role="group" aria-label="The maze. Dibs starts on the left. The exit is on the right. After you click the maze, the arrow keys walk Dibs and the space bar stops him.">' +
      '<div class="m-field" id="m-field">' +
        '<div class="m-svgbox" id="m-svgbox"></div>' +
        '<div class="m-ov"><div class="m-dibs" id="m-dibs" data-h="right"><img src="img/dibs/dibs.svg" alt="Dibs the pigeon">' + ARROW + '</div></div>' +
        '<div class="m-conf" id="m-conf" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="m-river" aria-hidden="true"></div>' +
    '</div>' +
    '<p class="m-cap" id="m-cap" hidden>Yes, it’s real.</p>' +
    '<div class="m-tiles" id="m-tiles" role="group" aria-label="Word tiles">' +
      WORDS.map(function (w) {
        return '<button type="button" class="m-tile k-' + w[1] + '" data-w="' + w[0] + '"' + (KIND[w[0]] === 'place' ? ' aria-pressed="false"' : '') + '><img src="img/symbols/' + w[0] + '.svg" alt=""><span>' + w[0] + '</span></button>';
      }).join('') +
    '</div>' +
    '<div class="m-msg">' +
      '<p class="m-label" id="m-strip-label">Words you tapped</p>' +
      '<div class="m-strip" role="group" aria-labelledby="m-strip-label"><ol class="m-words" id="m-words"></ol><button type="button" class="btn m-clear" id="m-clear">Clear</button></div>' +
    '</div>' +
    '<p class="m-stat"><span id="m-lvname"></span> · Moves: <b id="m-moves">0</b> · No timer, no rush.</p>' +
    '<div class="m-win" id="m-win" hidden>' +
      '<div class="m-windibs"><img class="m-wdibs" src="img/dibs/dibs.svg" alt="Dibs the pigeon"><p class="m-bub" id="m-dibs-t"></p></div>' +
      '<h3 class="m-wh" id="m-win-h" tabindex="-1">You escaped!</h3>' +
      '<p class="m-wp" id="m-win-p"></p>' +
      '<div class="m-winbtns"><button type="button" class="btn solid" id="m-next">Next level</button><button type="button" class="btn" id="m-again">Play again</button></div>' +
    '</div>' +
    '<p class="m-hint">Keyboard: click or Tab to the maze, then use the arrow keys to walk. Space stops. On a touch screen, swipe on the maze.</p>' +
    '<div class="m-live" id="m-live" role="status" aria-live="polite" aria-atomic="true"></div>';

  function $(id) { return document.getElementById(id); }
  var board = $('m-board'), field = $('m-field'), svgbox = $('m-svgbox'), dibs = $('m-dibs'), conf = $('m-conf'),
    live = $('m-live'), wordsEl = $('m-words'), movesEl = $('m-moves'), winEl = $('m-win'), tiles = $('m-tiles'),
    sndBtn = $('m-snd'), pills = Array.prototype.slice.call(root.querySelectorAll('#m-lv .pill')),
    tileEls = Array.prototype.slice.call(tiles.querySelectorAll('.m-tile'));

  // ---------- State ----------
  var S = { lv: 0, n: 5, open: [], start: null, exit: null, pos: null, heading: 'right', moves: 0, words: [], walk: null, won: false, dead: rnd(DEAD.length), solution: 0 };
  var unlocked = [true, false, false];       // lives only in this page; nothing is saved
  var timers = [], liveT = 0;
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function announce(msg) { clearTimeout(liveT); live.textContent = ''; liveT = setTimeout(function () { live.textContent = msg; }, 30); }

  // ---------- Making a maze ----------
  function openCount(open, x, y) { var o = open[y][x], c = 0; if (o & 1) c++; if (o & 2) c++; if (o & 4) c++; if (o & 8) c++; return c; }
  function carve(n) {
    var open = [], seen = [], x, y, i;
    for (y = 0; y < n; y++) { open.push([]); seen.push([]); for (x = 0; x < n; x++) { open[y].push(0); seen[y].push(false); } }
    var stack = [[rnd(n), rnd(n)]]; seen[stack[0][1]][stack[0][0]] = true;
    while (stack.length) {
      var cur = stack[stack.length - 1], opts = [];
      Object.keys(DIR).forEach(function (k) {
        var nx = cur[0] + DIR[k].dx, ny = cur[1] + DIR[k].dy;
        if (nx >= 0 && ny >= 0 && nx < n && ny < n && !seen[ny][nx]) opts.push(k);
      });
      if (!opts.length) { stack.pop(); continue; }
      var d = DIR[opts[rnd(opts.length)]], nx2 = cur[0] + d.dx, ny2 = cur[1] + d.dy;
      open[cur[1]][cur[0]] |= d.bit; open[ny2][nx2] |= opposite(d.bit);
      seen[ny2][nx2] = true; stack.push([nx2, ny2]);
    }
    return open;
  }
  function opposite(b) { return b === 1 ? 4 : b === 4 ? 1 : b === 2 ? 8 : 2; }
  // Shortest way from (sx,sy) to (tx,ty): a list of cells, start first.
  function solve(open, n, sx, sy, tx, ty) {
    var prev = {}, q = [[sx, sy]], key = function (x, y) { return x + ',' + y; }, k;
    prev[key(sx, sy)] = null;
    while (q.length) {
      var c = q.shift();
      if (c[0] === tx && c[1] === ty) break;
      for (k in DIR) {
        if (!(open[c[1]][c[0]] & DIR[k].bit)) continue;
        var nx = c[0] + DIR[k].dx, ny = c[1] + DIR[k].dy;
        if (prev[key(nx, ny)] === undefined) { prev[key(nx, ny)] = c; q.push([nx, ny]); }
      }
    }
    var path = [], at = [tx, ty];
    while (at) { path.unshift(at); at = prev[key(at[0], at[1])]; }
    return path;
  }
  function makeMaze(n) {
    var tries = 0, open, sr, er, path;
    do {
      open = carve(n); sr = rnd(n); er = rnd(n);
      path = solve(open, n, 0, sr, n - 1, er);
      tries++;
    } while ((path.length < 2 * n - 1 || sr === er) && tries < 40);
    return { open: open, start: { x: 0, y: sr }, exit: { x: n - 1, y: er }, solution: path.length - 1 };
  }

  // ---------- Drawing the maze ----------
  function exitArt(x, y) {
    var X = x * C, Y = y * C, h = '<g class="m-exit">';
    h += '<rect x="' + (X + 4) + '" y="' + (Y + 4) + '" width="' + (C - 8) + '" height="' + (C - 8) + '" fill="#fff3b0"/>';
    // a little hot dog stand awning: four stripes and a scalloped edge
    var i;
    for (i = 0; i < 4; i++) h += '<rect x="' + (X + 7 + i * 11.5) + '" y="' + (Y + 7) + '" width="11.5" height="11" fill="' + (i % 2 ? '#ffffff' : '#d9453b') + '"/>';
    for (i = 0; i < 4; i++) h += '<path d="M' + (X + 7 + i * 11.5) + ' ' + (Y + 18) + 'a5.75 5.75 0 0 0 11.5 0Z" fill="' + (i % 2 ? '#ffffff' : '#d9453b') + '"/>';
    h += '<path d="M' + (X + 7) + ' ' + (Y + 18) + 'V' + (Y + 7) + 'H' + (X + 53) + 'V' + (Y + 18) + 'M' + (X + 7) + ' ' + (Y + 18) + 'a5.75 5.75 0 0 0 11.5 0a5.75 5.75 0 0 0 11.5 0a5.75 5.75 0 0 0 11.5 0a5.75 5.75 0 0 0 11.5 0" fill="none" stroke="#2a2350" stroke-width="2" stroke-linejoin="round"/>';
    // the EXIT sign
    h += '<rect x="' + (X + 8) + '" y="' + (Y + 28) + '" width="44" height="17" rx="3" fill="#2a2350"/>';
    h += '<text x="' + (X + 30) + '" y="' + (Y + 41) + '" text-anchor="middle" font-family="Lexend,Atkinson Hyperlegible,sans-serif" font-weight="700" font-size="15" fill="#ffffff">EXIT</text>';
    // the counter with a hot dog
    h += '<rect x="' + (X + 10) + '" y="' + (Y + 48) + '" width="40" height="6" rx="2" fill="#b98a52" stroke="#2a2350" stroke-width="1.6"/>';
    h += '<ellipse cx="' + (X + 30) + '" cy="' + (Y + 46) + '" rx="12" ry="3.2" fill="#e8a05a" stroke="#2a2350" stroke-width="1.4"/>';
    h += '<path d="M' + (X + 21) + ' ' + (Y + 46) + 'q4-2 8 0t8 0" fill="none" stroke="#f2c230" stroke-width="1.6" stroke-linecap="round"/>';
    return h + '</g>';
  }
  function drawMaze() {
    var n = S.n, W = n * C, L = LEVELS[S.lv], i, x, y, h;
    var vb = (-PAD) + ' ' + (-PAD) + ' ' + (W + 2 * PAD) + ' ' + (W + 2 * PAD);
    h = '<svg class="m-svg" viewBox="' + vb + '" aria-hidden="true" focusable="false">';
    if (S.lv > 0) h += '<defs>' +
      '<radialGradient id="m-pool"><stop class="m-poolstop" offset="0" stop-color="#ffb23f" stop-opacity="' + (S.lv === 1 ? '.34' : '.3') + '"/><stop offset="1" stop-color="#ffb23f" stop-opacity="0"/></radialGradient>' +
      '</defs>';
    h += '<rect class="m-floor" x="' + (-PAD) + '" y="' + (-PAD) + '" width="' + (W + 2 * PAD) + '" height="' + (W + 2 * PAD) + '" fill="' + L.floor + '"/>';
    // cells that are not the start, the exit or on the path of Dibs's first step carry the decorations
    var free = [];
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) {
      if ((x === S.start.x && y === S.start.y) || (x === S.exit.x && y === S.exit.y)) continue;
      free.push([x, y]);
    }
    free = shuffle(free);
    if (S.lv === 0) {
      // daylight: warm sun patches on a pale sky-blue floor
      for (i = 0; i < 3; i++) h += '<circle cx="' + (free[i][0] * C + 30) + '" cy="' + (free[i][1] * C + 30) + '" r="' + (C * 0.7) + '" fill="#fff6c2" opacity=".7"/>';
    } else {
      var lamps = S.lv === 1 ? 4 : 3, r = S.lv === 1 ? C * 1.2 : C * 1.05;
      for (i = 0; i < lamps; i++) {
        var lx = free[i][0] * C + 30, ly = free[i][1] * C + 30;
        h += '<circle class="m-poolc" cx="' + lx + '" cy="' + ly + '" r="' + r + '" fill="url(#m-pool)"/>';
        h += '<circle cx="' + lx + '" cy="' + (ly - 14) + '" r="4.5" fill="#ffd36b" stroke="#2a2350" stroke-width="1.6"/>';
      }
      if (S.lv === 1) for (i = lamps; i < lamps + 2; i++) {
        var px = free[i][0] * C + 30, py = free[i][1] * C + 38;
        h += '<ellipse cx="' + px + '" cy="' + py + '" rx="17" ry="7" fill="#7fa6cf" opacity=".6"/><path d="M' + (px - 8) + ' ' + (py - 1) + 'q6-3 12 0" fill="none" stroke="#e8f2ff" stroke-width="2" stroke-linecap="round" opacity=".85"/>';
      }
    }
    h += exitArt(S.exit.x, S.exit.y);
    // walls: every closed edge, with a gap for the entrance (left) and the exit (right)
    var d = '';
    function seg(x1, y1, x2, y2) { d += 'M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2; }
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) {
      var o = S.open[y][x];
      if (y === 0) seg(x * C, 0, (x + 1) * C, 0);
      if (y === n - 1) seg(x * C, W, (x + 1) * C, W);
      if (x === 0 && y !== S.start.y) seg(0, y * C, 0, (y + 1) * C);
      if (x === n - 1 && y !== S.exit.y) seg(W, y * C, W, (y + 1) * C);
      if (x < n - 1 && !(o & E_)) seg((x + 1) * C, y * C, (x + 1) * C, (y + 1) * C);
      if (y < n - 1 && !(o & S_)) seg(x * C, (y + 1) * C, (x + 1) * C, (y + 1) * C);
    }
    if (L.outline) h += '<path class="m-wallo" d="' + d + '" fill="none" stroke="' + L.outline + '" stroke-width="13" stroke-linecap="round"/>';
    h += '<path class="m-wall" d="' + d + '" fill="none" stroke="' + L.wall + '" stroke-width="8" stroke-linecap="round"/>';
    h += '</svg>';
    svgbox.innerHTML = h;
    field.style.setProperty('--n', String(n));
    field.style.setProperty('--p', (PAD / (W + 2 * PAD) * 100).toFixed(3) + '%');
    board.className = 'm-board ' + L.cls;
  }

  // ---------- Words, moves, heading ----------
  function drawWords() {
    wordsEl.innerHTML = S.words.length ? S.words.map(function (w) { return '<li class="m-w k-' + KIND[w] + '">' + w + '</li>'; }).join('')
      : '<li class="m-empty">Tap a word tile</li>';
  }
  function pushWord(w) { S.moves++; S.words.push(w); if (S.words.length > 4) S.words.shift(); movesEl.textContent = S.moves; drawWords(); }
  function drawHeading() {
    dibs.setAttribute('data-h', S.heading);
    dibs.style.setProperty('--rot', ROT[S.heading] + 'deg');
    tileEls.forEach(function (t) { if (t.hasAttribute('aria-pressed')) t.setAttribute('aria-pressed', t.getAttribute('data-w') === S.heading ? 'true' : 'false'); });
  }
  function place() {
    dibs.style.setProperty('--x', S.pos.x); dibs.style.setProperty('--y', S.pos.y);
  }
  function setLock() {
    pills.forEach(function (p, i) {
      var cur = i === S.lv;
      p.setAttribute('aria-pressed', cur ? 'true' : 'false');
      if (unlocked[i]) p.removeAttribute('aria-disabled'); else p.setAttribute('aria-disabled', 'true');
      p.querySelector('.m-lock').hidden = !!unlocked[i];
    });
  }
  function setTilesLive(on) {
    tileEls.forEach(function (t) { if (on) t.removeAttribute('aria-disabled'); else t.setAttribute('aria-disabled', 'true'); });
  }

  // Bring the top of the maze into view (no smooth scroll with reduced motion).
  function scrollToMaze() {
    try {
      var r = board.getBoundingClientRect();
      if (r.top < 0 || r.top > 80) board.scrollIntoView({ block: 'start', behavior: reduced() ? 'instant' : 'smooth' });
    } catch (e) { board.scrollIntoView(true); }
  }

  // ---------- Levels ----------
  function chooseSize(i) {
    if (i === 0) return 5; if (i === 1) return 7;
    var fw = field.clientWidth || 0, cell = fw * (9 * C) / (9 * C + 2 * PAD) / 9;   // cell width in pixels if 9 across
    return cell >= 36 ? 9 : 8;
  }
  function startLevel(i, byUser) {
    clearTimers(); stopWalk(true);
    S.lv = i; S.n = chooseSize(i);
    var m = makeMaze(S.n);
    S.open = m.open; S.start = m.start; S.exit = m.exit; S.solution = m.solution;
    S.pos = { x: m.start.x, y: m.start.y }; S.heading = 'right'; S.moves = 0; S.words = []; S.won = false;
    var L = LEVELS[i];
    conf.innerHTML = ''; dibs.classList.remove('m-hop');
    winEl.hidden = true; setTilesLive(true);
    drawMaze(); drawWords(); drawHeading(); place(); setLock();
    movesEl.textContent = '0';
    $('m-lvname').textContent = L.name + ' (' + S.n + ' by ' + S.n + ')';
    $('m-wk-t').textContent = L.start;
    $('m-cap').hidden = i !== 2;
    if (byUser) {
      stopSpeech(); scrollToMaze();
      announce('Level ' + (i + 1) + ', ' + L.name + ', a ' + S.n + ' by ' + S.n + ' maze. Wacker says: ' + L.start + ' Dibs is at the left. The exit is on the right. Tap a direction word, then go.');
      wackerSay(L.start);
    } else live.textContent = '';
    publishTest();
  }

  // ---------- Walking ----------
  function stopWalk(silent) {
    if (S.walk) { clearTimeout(S.walk.timer); S.walk = null; }
    tiles.classList.remove('m-walking');
  }
  function isStart(p) { return p.x === S.start.x && p.y === S.start.y; }
  function isExit(p) { return p.x === S.exit.x && p.y === S.exit.y; }
  function plural(n) { return n + (n === 1 ? ' square' : ' squares'); }
  function startWalk(dir) {
    if (S.walk) return;
    var w = { dir: dir, steps: 0, timer: 0 };
    S.walk = w; tiles.classList.add('m-walking');
    step(w);
  }
  function step(w) {
    if (S.walk !== w) return;
    var d = DIR[w.dir];
    if (!(S.open[S.pos.y][S.pos.x] & d.bit)) { finish(w, 'wall'); return; }
    S.pos = { x: S.pos.x + d.dx, y: S.pos.y + d.dy }; w.steps++; place();
    if (isExit(S.pos)) { finish(w, 'exit'); return; }
    var oc = openCount(S.open, S.pos.x, S.pos.y);
    if (oc > 2) { finish(w, 'crossing'); return; }
    if (oc === 1) { finish(w, 'dead'); return; }
    w.timer = setTimeout(function () { step(w); }, STEP_MS);
    publishTest();
  }
  function stopTap() {
    var w = S.walk;
    if (!w) { announce('Dibs is standing still.'); return; }
    finish(w, 'stop');
  }
  function finish(w, why) {
    if (S.walk !== w) return;
    clearTimeout(w.timer); S.walk = null; tiles.classList.remove('m-walking');
    var n = w.steps, msg, wk = '';
    if (why === 'exit') { win(n); return; }
    if (n === 0) msg = 'Dibs can’t go ' + w.dir + '. There is a wall.';
    else msg = 'Dibs walked ' + w.dir + ' ' + plural(n) + '.';
    if (why === 'crossing') msg += ' A crossing. Choose a way.';
    else if (why === 'wall' && n > 0) msg += ' A wall. Choose another way.';
    else if (why === 'stop') msg += ' Dibs stopped.';
    var atDead = openCount(S.open, S.pos.x, S.pos.y) === 1 && !isStart(S.pos);
    if (atDead && n > 0) {
      msg += ' Dead end.';
      wk = DEAD[S.dead % DEAD.length]; S.dead++;
      $('m-wk-t').textContent = wk;
      msg += ' Wacker says: ' + wk;
    } else if (n > 0 && isStart(S.pos)) msg += ' Dibs is back at the start.';
    announce(msg);
    if (wk) wackerSay(wk, true);
    publishTest();
  }
  function win(n) {
    var L = LEVELS[S.lv], moves = S.moves;
    S.won = true; setTilesLive(false);
    if (S.lv < 2) unlocked[S.lv + 1] = true;
    setLock();
    $('m-wk-t').textContent = L.win;
    $('m-dibs-t').textContent = 'Made it! Hot dog time!';
    $('m-win-h').textContent = 'You escaped ' + L.name + '!';
    $('m-win-p').innerHTML = 'Moves used: <b>' + moves + '</b>. ' + (S.lv === 2 ? 'You beat all three levels. Play again for a new maze.' : 'Next up: ' + LEVELS[S.lv + 1].name + '.');
    $('m-next').hidden = S.lv === 2;
    winEl.hidden = false;
    dibs.classList.remove('m-hop'); void dibs.offsetWidth; dibs.classList.add('m-hop');
    confetti();
    announce('Dibs walked ' + plural(n) + ' and reached the exit! You made it in ' + moves + ' moves. Dibs says: Made it! Hot dog time! Wacker says: ' + L.win + ' Choose ' + (S.lv === 2 ? 'Play again' : 'Next level or Play again') + '.');
    dibsSay('Made it! Hot dog time!', true); wackerSay(L.win, true);
    $('m-win-h').focus();
    publishTest();
  }
  function confetti() {
    conf.innerHTML = '';
    if (reduced()) return;
    var h = '', q;
    for (q = 0; q < 24; q++) h += '<i style="left:' + ((q * 37 + 5) % 100) + '%;background:' + CONF[q % 8] + ';animation-delay:' + ((q % 7) * 0.07).toFixed(2) + 's"></i>';
    conf.innerHTML = h;
    later(function () { conf.innerHTML = ''; }, 2800);
  }

  // ---------- Input ----------
  // A tile tap (or Space): one word.
  function word(w, viaKey) {
    if (S.won) return;
    pushWord(w);
    if (w === 'go') { wordSay('go', viaKey); announce(S.walk ? 'Dibs is already walking.' : 'Go!'); startWalk(S.heading); }
    else if (w === 'stop') { wordSay('stop', viaKey); stopTap(); }
    else {
      S.heading = w; drawHeading(); wordSay(w, viaKey);
      announce('Dibs faces ' + w + '. Tap go to walk.');
    }
  }
  // An arrow key or a swipe: a direction word and go, in one step.
  function dirGo(dir) {
    if (S.won) return;
    if (S.walk) { clearTimeout(S.walk.timer); S.walk = null; tiles.classList.remove('m-walking'); }
    pushWord(dir); pushWord('go');
    S.heading = dir; drawHeading();
    wordSay(dir, false); wordSay('go', true);
    startWalk(dir);
  }
  tiles.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.m-tile') : null; if (!b) return;
    if (b.getAttribute('aria-disabled') === 'true') return;
    word(b.getAttribute('data-w'), false);
  });
  var KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  root.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    var t = e.target, inPlay = t.closest && t.closest('.m-board, .m-tiles');
    if (!inPlay) return;
    if (KEYS[e.key]) { e.preventDefault(); dirGo(KEYS[e.key]); return; }
    if ((e.key === ' ' || e.key === 'Spacebar') && !(t.closest && t.closest('.m-tile'))) { e.preventDefault(); if (!S.won) { pushWord('stop'); wordSay('stop', false); stopTap(); } }
  });
  // Swipe on the maze (touch, pen or mouse drag) does the same as an arrow key.
  var sw = null;
  field.addEventListener('pointerdown', function (e) {
    sw = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { field.setPointerCapture(e.pointerId); } catch (x) {}
    board.focus({ preventScroll: true });
  });
  function swipeEnd(e) {
    if (!sw || sw.id !== e.pointerId) return;
    var dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    dirGo(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }
  field.addEventListener('pointerup', swipeEnd);
  field.addEventListener('pointercancel', function () { sw = null; });

  $('m-clear').addEventListener('click', function () { S.words = []; drawWords(); announce('Words cleared.'); });
  $('m-again').addEventListener('click', function () { startLevel(S.lv, true); board.focus({ preventScroll: true }); });
  $('m-next').addEventListener('click', function () { if (S.lv < 2) { startLevel(S.lv + 1, true); board.focus({ preventScroll: true }); } });
  pills.forEach(function (p, i) {
    p.addEventListener('click', function () {
      if (!unlocked[i]) { announce('Level ' + (i + 1) + ' is locked. Win level ' + i + ' first.'); return; }
      if (i !== S.lv || S.won) startLevel(i, true);
    });
  });
  sndBtn.addEventListener('click', function () {
    snd = !snd; sndBtn.setAttribute('aria-checked', String(snd)); sndBtn.classList.toggle('on', snd);
    sndBtn.firstChild.textContent = 'Sound: ' + (snd ? 'on' : 'off');
    if (!snd) stopSpeech();
  });

  // The adult tip follows the Parent / School staff switch (the switch itself belongs to games.js).
  var TIP = {
    parent: 'Play together. Say the word as you tap it: “Go! … Stop!” Let your child choose where Dibs goes, even the wrong way. Dead ends are part of the fun.',
    school: 'Great for a small group or whole class on a projector. Students take turns choosing the next word. Model on your own AAC or the board: “Go left.” “Stop.” “Up!”'
  };
  Array.prototype.forEach.call(document.querySelectorAll('.g-aud .pill'), function (b) {
    b.addEventListener('click', function () { var t = $('m-tip'); if (t) t.textContent = TIP[b.getAttribute('data-aud')] || TIP.parent; });
  });

  // ---------- Test hook (only with ?test in the address) ----------
  function publishTest() {
    if (!TEST) return;
    window.VOICE_MAZE_TEST = {
      n: S.n, open: S.open, start: S.start, exit: S.exit, pos: { x: S.pos.x, y: S.pos.y }, heading: S.heading,
      level: S.lv, won: S.won, walking: !!S.walk, moves: S.moves, solution: S.solution
    };
    document.body.setAttribute('data-maze-test', S.lv + ':' + S.n + ':' + S.pos.x + ',' + S.pos.y + ':' + (S.walk ? 'walking' : 'idle'));
  }

  startLevel(0, false);
})();
