// Features page: 16 small working figures. Plain JS, no libraries. Nothing is sent anywhere or saved.
// Each figure has a render function that builds its HTML; morph() patches the page in place, so
// focus, transitions and pointer capture survive a re-render. Clicks and presses use data-a / data-p attributes.
(function () {
  'use strict';
  var BD = window.VOICE_BOARD || [];
  var TM = { people: 'p', question: 'q', action: 'a', social: 's', describing: 'd', place: 'l', category: 'c' };
  var rows = BD.map(function (r) { return { label: r[0], t: TM[r[2]] || 'x', stage: r[3], src: 'img/symbols/' + r[4] }; });
  if (!rows.length) return;
  var src = {}, type = {}, rowOf = {};
  rows.forEach(function (r) { src[r.label] = r.src; type[r.label] = r.t; rowOf[r.label] = r; });
  var COL = { p: '#fff3a8', a: '#c9edc2', d: '#c6e0f7', l: '#c6e0f7', q: '#e0d0f3', s: '#f9cddd', c: '#fddcb2' };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // ---------- Patch the DOM in place ----------
  function same(o, n) {
    return o.nodeType === n.nodeType && o.nodeName === n.nodeName && (o.nodeType !== 1 || o.getAttribute('data-k') === n.getAttribute('data-k'));
  }
  function patchAttrs(o, n) {
    var i, a;
    for (i = 0; i < n.attributes.length; i++) { a = n.attributes[i]; if (o.getAttribute(a.name) !== a.value) o.setAttribute(a.name, a.value); }
    for (i = o.attributes.length - 1; i >= 0; i--) { a = o.attributes[i]; if (!n.hasAttribute(a.name)) o.removeAttribute(a.name); }
  }
  function patchKids(o, n) {
    var oc = o.childNodes, nc = n.childNodes, i;
    for (i = 0; i < nc.length; i++) {
      var x = nc[i], y = oc[i];
      if (!y) { o.appendChild(x.cloneNode(true)); continue; }
      if (!same(y, x)) { o.replaceChild(x.cloneNode(true), y); continue; }
      if (x.nodeType === 3 || x.nodeType === 8) { if (y.nodeValue !== x.nodeValue) y.nodeValue = x.nodeValue; }
      else if (x.nodeType === 1) { patchAttrs(y, x); patchKids(y, x); }
    }
    while (oc.length > nc.length) o.removeChild(o.lastChild);
  }
  function paint(el, html) {
    if (!el) return;
    var t = document.createElement('template'); t.innerHTML = html;
    patchKids(el, t.content);
  }

  // ---------- Speech and sound ----------
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
  // Same rule as V.O.I.C.E.: the word I is spoken from a lowercase i, so voices say "eye", not "capital I".
  function fixI(t) { t = String(t); if (t.trim() === 'I') return 'i'; return t.replace(/^I(?=\s)/, 'i'); }
  function say(t) {
    if (!t) return;
    t = fixI(t);
    if (window.VOICE_SAY) window.VOICE_SAY(t);
  }
  function sayTone(text, pitch, rate) {
    try {
      var s = window.speechSynthesis; if (!s) return;
      var v = pickVoice(s); if (v === null) return;
      s.cancel();
      var u = new SpeechSynthesisUtterance(fixI(text)); u.lang = 'en-US'; u.pitch = pitch; u.rate = rate;
      if (v) { u.voice = v; u.lang = v.lang || 'en-US'; }
      s.speak(u);
    } catch (e) {}
  }
  var ac = null;
  function tones(list, type, vol) {
    if (!S.gSound) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ac = ac || new AC(); if (ac.resume) ac.resume();
      var t0 = ac.currentTime + 0.02;
      list.forEach(function (n) {
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t0 + n[1]); g.gain.exponentialRampToValueAtTime(vol, t0 + n[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + n[2]);
        o.connect(g); g.connect(ac.destination); o.start(t0 + n[1]); o.stop(t0 + n[1] + n[2] + 0.1);
      });
    } catch (e) {}
  }
  function dingDong() { tones([[659.25, 0, 0.35], [523.25, 0.18, 0.35]], 'sine', 0.16); }
  function fanfare() { tones([[523.25, 0, 0.2], [659.25, 0.12, 0.2], [783.99, 0.24, 0.2], [1046.5, 0.36, 0.6]], 'triangle', 0.18); }
  function numWords(n) {
    var ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    return ONES[n] || String(n);
  }

  // ---------- State ----------
  var S = {
    stage: 1, walk: 0, gR: 0, gW: null, gOpen: false, gScore: 0, gSolved: false, gMsg: '', gSound: true, party: 0, gDone: {},
    dial: false, dialSaid: 'Tap eat to open its dial.', dogM: false, dogK: false, dogMood: '', dogSaid: '', lw: -1,
    twMsg: ['I', 'want', 'more'], twOpen: false, twSlide: false, twPress: false, twHover: '', twLock: 0, twMood: '', twLast: '', twSaid: '', twLocked: false,
    fx: 450, fy: 300, shot: null, keep: {}, rel: {}, plc: {}, sname: 0, used: false, usedItems: [], said: [], glow: '', flash: false,
    bb: {}, bbPreset: '', bbNote: '', bbMsg: [], bbTalking: false, bbLit: -1, bbShow: false, bbFlip: false,
    hint: 0, chain: 1, chainDone: 0, chainMsg: '', errHigh: true, errMsg: '', errBad: -1, prof: {},
    counts: {}, from: { board: 0, figs: 0, eggs: 0 }, pmMonth: 0, pmWords: { more: true, help: true, look: true },
    learner: 0, hold: 0, unlocked: false, pin: '', combos: {}, pop: null, bk: 0
  };
  var R = {};
  function draw() { for (var i = 0; i < arguments.length; i++) { try { R[arguments[i]](); } catch (e) { if (window.console) console.error('figure ' + arguments[i], e); } } }
  var timers = [];
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function bump(word, where) {
    S.counts[word] = (S.counts[word] || 0) + 1; S.from[where] = (S.from[where] || 0) + 1; draw(13);
  }
  function seg(label, items, act, cur, extra) {
    return '<div class="seg' + (extra ? ' ' + extra : '') + '" role="group" aria-label="' + esc(label) + '">' + items.map(function (it) {
      return '<button type="button" class="btn" data-a="' + act + '" data-v="' + esc(it[0]) + '" aria-pressed="' + (String(it[0]) === String(cur)) + '">' + esc(it[1]) + '</button>';
    }).join('') + '</div>';
  }
  function tile(r, cls, extra) {
    return '<div class="f-c f-c-' + r.t + (cls || '') + '"' + (extra || '') + '><img src="' + r.src + '" alt=""><span>' + esc(r.label) + '</span></div>';
  }
  function btile(label, act, cls, key) {
    var r = rowOf[label];
    return '<button type="button" class="f-c f-c-' + (r ? r.t : 'x') + (cls || '') + '" data-a="' + act + '" data-v="' + esc(label) + '" aria-label="' + esc(label) + '"' + (key ? ' data-k="' + key + '"' : '') + '><img src="' + (r ? r.src : '') + '" alt=""><span>' + esc(label) + '</span></button>';
  }
  var FACES = {"normal": {"ir": "7.28", "lx": "39.6", "ly": "30.7", "rx": "60.4", "ry": "30.7", "pr": "3.64", "pr2": "3.64", "hlx": "38.6", "hly": "29.5", "hrx": "59.4", "hry": "29.5", "hl": "1.2", "hr": "1.2", "lids": "", "brows": "", "tongue": "", "beak": "M 44.80 41.10 L 55.20 41.10 L 50.00 51.50 Z", "cheeks": "", "drop": "", "mark": ""}, "happy": {"ir": "0", "lx": "39.6", "ly": "30.7", "rx": "60.4", "ry": "30.7", "pr": "0", "pr2": "0", "hlx": "38.6", "hly": "29.5", "hrx": "59.4", "hry": "29.5", "hl": "0", "hr": "0", "lids": "", "brows": "M 33.10 32.00 Q 39.60 24.20 46.10 32.00 M 53.90 32.00 Q 60.40 24.20 66.90 32.00", "tongue": "", "beak": "M 44.80 41.10 L 55.20 41.10 L 52.60 48.90 L 50.00 47.60 L 47.40 48.90 Z", "cheeks": "M 33.10 40.45 a 3.90 2.60 0.00 1 0 7.80 0.00 a 3.90 2.60 0.00 1 0 -7.80 0.00 z M 59.10 40.45 a 3.90 2.60 0.00 1 0 7.80 0.00 a 3.90 2.60 0.00 1 0 -7.80 0.00 z", "drop": "", "mark": ""}, "excited": {"ir": "8.58", "lx": "39.6", "ly": "30.7", "rx": "60.4", "ry": "30.7", "pr": "4.68", "pr2": "4.68", "hlx": "38.6", "hly": "29.5", "hrx": "59.4", "hry": "29.5", "hl": "1.2", "hr": "1.2", "lids": "", "brows": "M 31.80 19.00 q 7.80 -5.20 15.60 0.00 M 52.60 19.00 q 7.80 -5.20 15.60 0.00", "tongue": "", "beak": "M 44.15 41.10 L 55.85 41.10 L 51.30 46.30 Z M 45.45 47.60 L 54.55 47.60 L 50.00 54.10 Z", "cheeks": "M 33.10 40.45 a 3.90 2.60 0.00 1 0 7.80 0.00 a 3.90 2.60 0.00 1 0 -7.80 0.00 z M 59.10 40.45 a 3.90 2.60 0.00 1 0 7.80 0.00 a 3.90 2.60 0.00 1 0 -7.80 0.00 z", "drop": "", "mark": "!"}, "silly": {"ir": "7.28", "lx": "42.2", "ly": "32.0", "rx": "57.8", "ry": "29.4", "pr": "3.64", "pr2": "2.6", "hlx": "41.2", "hly": "30.8", "hrx": "56.8", "hry": "28.2", "hl": "1.2", "hr": "0", "lids": "", "brows": "", "tongue": "M 47.40 45.65 q 2.60 9.10 5.20 0.00 z", "beak": "M 44.15 41.10 L 55.85 41.10 L 51.30 45.65 Z M 45.45 47.60 L 54.55 47.60 L 50.00 52.80 Z", "cheeks": "", "drop": "", "mark": ""}, "question": {"ir": "7.28", "lx": "40.9", "ly": "28.1", "rx": "61.7", "ry": "28.1", "pr": "3.64", "pr2": "3.64", "hlx": "39.9", "hly": "26.9", "hrx": "60.7", "hry": "26.9", "hl": "1.2", "hr": "1.2", "lids": "", "brows": "M 52.60 17.70 q 7.80 -6.50 15.60 -1.30", "tongue": "", "beak": "M 44.80 41.10 L 55.20 41.10 L 50.00 51.50 Z", "cheeks": "", "drop": "", "mark": "?"}, "calm": {"ir": "0", "lx": "39.6", "ly": "30.7", "rx": "60.4", "ry": "30.7", "pr": "0", "pr2": "0", "hlx": "38.6", "hly": "29.5", "hrx": "59.4", "hry": "29.5", "hl": "0", "hr": "0", "lids": "", "brows": "M 33.10 29.40 Q 39.60 35.90 46.10 29.40 M 53.90 29.40 Q 60.40 35.90 66.90 29.40", "tongue": "", "beak": "M 44.80 41.10 L 55.20 41.10 L 50.00 51.50 Z", "cheeks": "", "drop": "", "mark": ""}, "sad": {"ir": "7.28", "lx": "39.6", "ly": "33.3", "rx": "60.4", "ry": "33.3", "pr": "3.64", "pr2": "3.64", "hlx": "38.6", "hly": "32.1", "hrx": "59.4", "hry": "32.1", "hl": "1.2", "hr": "1.2", "lids": "M 32.32 30.70 A 7.28 7.28 0.00 0 1 46.88 30.70 L 32.32 26.80 Z M 53.12 30.70 A 7.28 7.28 0.00 0 1 67.68 30.70 L 67.68 26.80 Z", "brows": "M 31.80 22.90 L 46.10 19.00 M 53.90 19.00 L 68.20 22.90", "tongue": "", "beak": "M 44.80 41.10 L 55.20 41.10 L 50.00 51.50 Z", "cheeks": "", "drop": "M 34.40 42.40 q -3.90 6.50 0.00 9.10 q 3.90 -2.60 0.00 -9.10 z", "mark": ""}, "mad": {"ir": "7.28", "lx": "39.6", "ly": "30.7", "rx": "60.4", "ry": "30.7", "pr": "3.12", "pr2": "3.12", "hlx": "38.6", "hly": "29.5", "hrx": "59.4", "hry": "29.5", "hl": "1.2", "hr": "1.2", "lids": "M 32.32 30.70 A 7.28 7.28 0.00 0 1 46.88 30.70 L 46.88 25.50 Z M 53.12 30.70 A 7.28 7.28 0.00 0 1 67.68 30.70 L 53.12 25.50 Z", "brows": "M 31.80 20.30 L 46.10 26.80 M 53.90 26.80 L 68.20 20.30", "tongue": "", "beak": "M 44.80 41.10 L 55.20 41.10 L 50.00 51.50 Z", "cheeks": "", "drop": "", "mark": ""}, "scared": {"ir": "8.32", "lx": "39.6", "ly": "30.7", "rx": "60.4", "ry": "30.7", "pr": "1.95", "pr2": "1.95", "hlx": "38.6", "hly": "29.5", "hrx": "59.4", "hry": "29.5", "hl": "0", "hr": "0", "lids": "", "brows": "M 31.80 16.40 q 7.80 -3.90 15.60 0.00 M 52.60 16.40 q 7.80 -3.90 15.60 0.00", "tongue": "", "beak": "M 44.15 41.10 L 55.85 41.10 L 51.30 45.65 Z M 45.45 47.60 L 54.55 47.60 L 50.00 51.50 Z", "cheeks": "", "drop": "M 76.00 24.20 q -3.90 6.50 0.00 9.10 q 3.90 -2.60 0.00 -9.10 z", "mark": ""}};
var SCENE = "<rect x=\"0\" y=\"0\" width=\"900\" height=\"370\" fill=\"#f6efe0\" stroke=\"none\"></rect><rect x=\"0\" y=\"370\" width=\"900\" height=\"150\" fill=\"#e6d6b4\" stroke=\"none\"></rect><path d=\"M0 410H900M0 455H900M0 500H900\" stroke=\"#d6c39b\" stroke-width=\"2\" fill=\"none\"></path><path d=\"M0 370H900\" fill=\"none\"></path><rect x=\"560\" y=\"40\" width=\"210\" height=\"150\" rx=\"6\" fill=\"#dbeafe\"></rect><path d=\"M562 168Q600 160 636 167T700 165T768 166V188H562Z\" fill=\"#ffffff\" stroke=\"none\"></path><path d=\"M562 168Q600 160 636 167T700 165T768 166\" fill=\"none\" stroke-width=\"2\"></path><path d=\"M592 152L586 180M636 152L642 180M598 140L630 166\" fill=\"none\" stroke-width=\"2.5\"></path><path d=\"M600 120H630L624 142H594Z\" fill=\"#8fd18a\" stroke-width=\"2.5\"></path><path d=\"M610 120L604 142M620 120L614 142\" fill=\"none\" stroke=\"#ffffff\" stroke-width=\"3\"></path><path d=\"M594 142H624L640 152H588Z\" fill=\"#8fd18a\" stroke-width=\"2.5\"></path><path d=\"M598 118Q615 112 632 118\" fill=\"#ffffff\" stroke-width=\"2\"></path><path d=\"M665 40V190M560 115H770\" fill=\"none\"></path><rect x=\"545\" y=\"190\" width=\"300\" height=\"12\" rx=\"4\" fill=\"#d9a066\"></rect><path d=\"M812 152C790 122 786 96 800 72M812 152C816 120 834 104 856 104M812 152C808 116 814 90 826 76\" fill=\"none\" stroke=\"#3f8f45\" stroke-width=\"7\"></path><path d=\"M788 190L793 148H831L836 190Z\" fill=\"#d9a066\"></path><circle cx=\"120\" cy=\"80\" r=\"40\" fill=\"#fff\"></circle><path d=\"M120 80V54M120 80L138 92\" fill=\"none\" stroke-width=\"4\"></path><path d=\"M245 342V470M615 342V470\" fill=\"none\" stroke-width=\"10\"></path><rect x=\"220\" y=\"320\" width=\"420\" height=\"22\" rx=\"6\" fill=\"#d9a066\"></rect><path d=\"M336 274C356 276 356 302 334 304\" fill=\"none\"></path><path d=\"M290 262H340L334 320H296Z\" fill=\"#f9cddd\"></path><path d=\"M390 278C392 268 398 262 406 260\" fill=\"none\"></path><circle cx=\"390\" cy=\"298\" r=\"21\" fill=\"#ef6b5b\"></circle><path d=\"M436 300C460 318 492 316 512 290C506 314 486 320 466 320C450 320 440 312 436 300Z\" fill=\"#fde68a\"></path><path d=\"M558 238V224H578V238\" fill=\"#3b2f9e\"></path><path d=\"M558 238H578L588 254V320H548V254Z\" fill=\"#c6e0f7\"></path><path d=\"M694 320V366M782 320V366\" fill=\"none\" stroke-width=\"7\"></path><rect x=\"688\" y=\"250\" width=\"100\" height=\"70\" rx=\"8\" fill=\"#c9edc2\"></rect><path d=\"M694 378V470M782 378V470\" fill=\"none\" stroke-width=\"7\"></path><rect x=\"682\" y=\"366\" width=\"112\" height=\"12\" rx=\"4\" fill=\"#d9a066\"></rect><rect x=\"702\" y=\"344\" width=\"74\" height=\"22\" rx=\"3\" fill=\"#e0d0f3\"></rect><path d=\"M702 355H776\" fill=\"none\" stroke-width=\"2\"></path><path d=\"M200 448C226 444 236 424 228 406\" fill=\"none\" stroke-width=\"6\"></path><path d=\"M92 410L96 380L114 400Z\" fill=\"#fddcb2\"></path><path d=\"M118 398L132 378L136 404Z\" fill=\"#fddcb2\"></path><ellipse cx=\"150\" cy=\"448\" rx=\"54\" ry=\"28\" fill=\"#fddcb2\"></ellipse><circle cx=\"113\" cy=\"420\" r=\"24\" fill=\"#fddcb2\"></circle><circle cx=\"105\" cy=\"418\" r=\"3\" fill=\"#2a2350\" stroke=\"none\"></circle><circle cx=\"121\" cy=\"418\" r=\"3\" fill=\"#2a2350\" stroke=\"none\"></circle><path d=\"M108 428Q113 432 118 428\" fill=\"none\" stroke-width=\"2\"></path>";


  // ---------- Figure 1: stages ----------
  R[1] = function () {
    var n = 0;
    var g = rows.map(function (r) { var on = r.stage <= S.stage; if (on) n++; return on ? tile(r, '') : '<div class="f-c off"></div>'; }).join('');
    paint($('f1'), seg('Stage', [1, 2, 3, 4].map(function (k) { return [k, 'Stage ' + k]; }), 'stage', S.stage, 'f-mb') +
      '<div class="f-g9" role="img" aria-label="Main page at stage ' + S.stage + ', ' + n + ' of 45 buttons showing.">' + g + '</div>');
    $('f1cap').textContent = 'Stage ' + S.stage + ': ' + n + ' of 45 buttons.';
  };

  // ---------- Figure 2: Dibs rides the L ----------
  var SEQ = ['I', 'want', 'more'];
  var seqIdx = SEQ.map(function (w) { return rows.indexOf(rowOf[w]); });
  R[2] = function () {
    var at = S.walk ? seqIdx[S.walk - 1] : seqIdx[0];
    var pos = 'left:' + (((at % 9) + 0.5) / 9 * 100).toFixed(2) + '%;top:' + ((Math.floor(at / 9) + 0.15) / 5 * 100).toFixed(2) + '%;opacity:' + (S.walk ? 1 : 0.85);
    var g = rows.map(function (r, i) { var k = seqIdx.indexOf(i); return tile(r, k >= 0 && k < S.walk ? ' hit' : ''); }).join('');
    paint($('f2'), '<div class="f-g9 f-ride" role="img" aria-label="Dibs rides the L from I, top left, to want, second row left, to more, second row middle">' + g +
      '<img class="f-owl train" src="img/dibs/dibs-train.svg" alt="" style="' + pos + '"></div>' +
      '<div class="row f-mt"><button type="button" class="btn" data-a="walk">' + (S.walk ? 'Ride it again' : 'Ride the L with Dibs') + '</button>' +
      '<span class="f-live" aria-live="polite">' + esc(SEQ.slice(0, S.walk).join(' ')) + '</span></div>');
  };
  function walk() {
    timers.forEach(clearTimeout); timers = []; S.walk = 0; draw(2);
    SEQ.forEach(function (w, i) {
      later(function () { S.walk = i + 1; draw(2); dingDong(); later(function () { say(w); }, 420); }, 400 + i * 1300);
    });
  }

  // ---------- Figure 3: Forms game ----------
  var GAME = [
    ['Yesterday I', 'go', 'to the beach on the lake.', 'went', ['go', 'goes', 'going', 'went', 'gone']],
    ['She', 'go', 'to school on the L every day.', 'goes', ['go', 'goes', 'going', 'went', 'gone']],
    ['We are', 'go', 'to Navy Pier now.', 'going', ['go', 'goes', 'going', 'went', 'gone']],
    ['He', 'eat', 'a hot dog an hour ago.', 'ate', ['eat', 'eats', 'eating', 'ate', 'eaten']],
    ['I have', 'eat', 'my whole slice of deep dish.', 'eaten', ['eat', 'eats', 'eating', 'ate', 'eaten']],
    ['They are', 'eat', 'Italian beef.', 'eating', ['eat', 'eats', 'eating', 'ate', 'eaten']]
  ];
  var CONF = ['#fde68a', '#c9edc2', '#c6e0f7', '#f9cddd', '#fddcb2', '#e0d0f3', '#3b2f9e', '#e8590c'];
  R[3] = function () {
    var g = GAME[S.gR], last = S.gR === GAME.length - 1;
    var words = function (t) { return t.split(' ').map(function (w) { return '<span class="w">' + esc(w) + '</span>'; }).join(''); };
    var msg = S.gMsg || 'Hear it: tap Forms, then pick a word.';
    var conf = '';
    if (S.party) {
      conf = '<div class="f-conf" aria-hidden="true" data-k="conf' + S.party + '">';
      for (var q = 0; q < 24; q++) conf += '<i style="left:' + ((q * 37 + S.party * 11) % 100) + '%;background:' + CONF[q % 8] + ';animation-delay:' + ((q % 6) * 0.05).toFixed(2) + 's"></i>';
      conf += '</div>';
    }
    paint($('f3'),
      '<div class="row f-between" style="margin-bottom:10px"><span class="f-score">Sentence ' + (S.gR + 1) + ' of ' + GAME.length + '</span><span class="f-score" aria-live="polite">Fixed: ' + S.gScore + '</span></div>' +
      '<div class="f-sent" aria-live="polite">' + words(g[0]) + '<span class="slot' + (S.gSolved ? ' ok' : '') + '">' + esc(S.gW || g[1]) + '</span>' + words(g[2]) + '</div>' +
      '<div class="row f-mt12"><button type="button" class="btn" id="f3forms" data-a="gtoggle" aria-expanded="' + S.gOpen + '"' + (S.gSolved ? ' disabled' : '') + '>Forms</button>' +
      (S.gOpen ? g[4].map(function (w) { return '<button type="button" class="f-chip pick" data-a="gpick" data-v="' + w + '">' + w + '</button>'; }).join('') : '') + '</div>' +
      '<p class="f-live f-mt" aria-live="polite" style="margin-bottom:0"><span class="' + (S.gSolved ? 'f-cheer' : '') + '" data-k="m' + (S.gSolved ? S.gR + '-' + S.gScore + '-' + S.party : '') + '">' + esc(msg) + '</span></p>' +
      '<div class="row f-mt12"><button type="button" class="btn solid" data-a="gnext"' + (S.gSolved ? '' : ' disabled') + '>' + (last ? 'Play again' : 'Next sentence') + '</button>' +
      '<div class="togs"><button type="button" class="tog' + (S.gSound ? ' on' : '') + '" role="switch" aria-checked="' + S.gSound + '" data-a="gsound"><span>Sound: ' + (S.gSound ? 'On' : 'Off') + '</span><span class="track" aria-hidden="true"><span class="knob"></span></span></button></div></div>' + conf);
  };
  function gpick(w) {
    var g = GAME[S.gR], right = w === g[3];
    say(g[0] + ' ' + w + ' ' + g[2]);
    if (right) {
      var first = !S.gDone[S.gR]; S.gDone[S.gR] = true;
      S.gW = w; S.gOpen = false; S.gSolved = true; S.gScore += first ? 1 : 0; S.gMsg = ['Yes! That sounds right.', 'Nice fix!', 'You got it!'][S.gR % 3]; S.party++;
      fanfare(); draw(3);
      later(function () { S.party = 0; draw(3); }, 1400);
    } else {
      S.gW = w; S.gOpen = false; S.gMsg = w === g[1] ? 'That is the form it started with. Try another one.' : 'Close. Listen to it, then try another form.'; draw(3);
    }
    var b = $('f3forms'); if (b && !b.disabled) b.focus({ preventScroll: true });
  }

  // ---------- Figure 4: dial and the Chicago hot dog ----------
  var DIAL = ['ate', 'eating', 'eats', 'eaten'];
  var MUSP = 'M28 44l12 10 12-10 12 10 12-10 12 10 12-10 12 10 12-10 12 10 12-10 12 10 12-10 12 10 12-10';
  var KETP = 'M30 48c10-10 20 10 30 0s20 10 30 0 20 10 30 0 20 10 30 0 20 10 30 0';
  var dogT = 0;
  R[4] = function () {
    var armsCls = 'arm' + (S.dial ? '' : ' shut');
    paint($('f4'),
      '<div class="f-dial">' + DIAL.map(function (w, i) { return '<button type="button" class="' + armsCls + ' a' + i + '" data-a="dpick" data-v="' + i + '"' + (S.dial ? '' : ' tabindex="-1" aria-hidden="true"') + '>' + w + '</button>'; }).join('') +
      '<button type="button" class="hub" data-a="dial" aria-expanded="' + S.dial + '"><img src="' + src['eat'] + '" alt="">eat</button></div>' +
      '<p class="cap f-center" aria-live="polite">' + esc(S.dialSaid) + '</p>' +
      '<div class="f-dog"><span class="f-dogtag">Lunch break</span><div class="f-dogrow">' +
      '<svg class="f-dogsvg" viewBox="0 0 220 96" role="img" aria-label="A hot dog' + (S.dogM ? ' with mustard' : '') + (S.dogK ? ' with ketchup, for a moment' : '') + '" stroke="#2a2350" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">' +
      '<path d="M14 52Q14 84 44 84H176Q206 84 206 52Z" fill="#e9b26b"></path><path d="M8 50Q8 34 30 34H190Q212 34 212 50Q212 62 190 62H30Q8 62 8 50Z" fill="#c8553d"></path>' +
      '<path d="M14 52Q14 40 40 40" fill="none" stroke="#f3c98b" stroke-width="3"></path>' +
      '<path d="' + (S.dogM ? MUSP : '') + '" fill="none" stroke="#f2c230" stroke-width="5"></path><path d="' + (S.dogK ? KETP : '') + '" fill="none" stroke="#d62828" stroke-width="5"></path></svg>' +
      '<img class="f-dogdibs' + (S.dogMood ? ' ' + S.dogMood : '') + '" src="img/dibs/dibs.svg" alt=""></div>' +
      '<div class="row f-mid"><button type="button" class="pchip" data-a="mustard"><img src="img/symbols/mustard.svg" alt="">mustard</button><button type="button" class="pchip" data-a="ketchup"><img src="img/symbols/ketchup.svg" alt="">ketchup</button><button type="button" class="btn" data-a="dogreset">New hot dog</button></div>' +
      '<p class="cap f-center" aria-live="polite">' + esc(S.dogSaid || 'Dress the hot dog.') + '</p></div>');
  };

  // ---------- Figure 5: little words ----------
  var LWG = [['a', 'an', 'the', 'any', 'every'], ['is', 'was', 'are', 'am', 'were'], ['and', 'but', 'or', 'so', 'because'], ['to', 'of', 'for', 'with', 'from'],
    ['will', 'would', 'could', 'may', 'must'], ['has', 'had', 'does', 'did', 'been'], ['him', 'her', 'us', 'them', 'their'], ['there', 'here', 'these', 'those', 'which']];
  R[5] = function () {
    var cur = S.lw >= 0 ? LWG[S.lw] : LWG[0];
    var lw = function (k, on) { return '<button type="button" class="f-lw' + (on ? ' on' : '') + '" data-a="lwsay" data-v="' + cur[k] + '">' + cur[k] + '</button>'; };
    paint($('f5'), '<div class="f-lws" role="group" aria-label="Little words">' + LWG.map(function (g, i) {
      return '<button type="button" class="f-lw' + (i === S.lw ? ' on' : '') + '" aria-pressed="' + (i === S.lw) + '" data-a="lw" data-v="' + i + '">' + g[0] + '</button>';
    }).join('') + '</div>' +
      (S.lw >= 0 ? '<div class="f-lwd"><span></span>' + lw(1) + '<span></span>' + lw(4) + lw(0, true) + lw(2) + '<span></span>' + lw(3) + '<span></span></div>' : ''));
  };

  // ---------- Figure 6: tone wheel (tones, order and math are V.O.I.C.E.'s own) ----------
  var TONES = [
    { id: 'happy', pitch: 0.2, rate: 1.08, end: '!', src: 'img/symbols/happy.svg' },
    { id: 'excited', pitch: 0.35, rate: 1.18, end: '!', src: 'img/symbols/excited.svg' },
    { id: 'silly', pitch: 0.5, rate: 1.12, end: '!', src: 'img/symbols/silly.svg' },
    { id: 'question', pitch: 0.1, rate: 1.0, end: '?', src: src['what'] },
    { id: 'calm', pitch: -0.1, rate: 0.85, end: '.', src: 'img/symbols/calm.svg' },
    { id: 'sad', pitch: -0.35, rate: 0.75, end: '...', src: 'img/symbols/sad.svg' },
    { id: 'mad', pitch: -0.25, rate: 1.1, end: '!', src: 'img/symbols/mad.svg' },
    { id: 'scared', pitch: 0.3, rate: 1.2, end: '?', src: 'img/symbols/scared.svg' }];
  var BASE_PITCH = 1.5, BASE_RATE = 0.9;
  var twLockT = 0, twOpenT = 0, twPtr = false, twSkipClick = false;
  function toneOf(id) { return TONES.filter(function (x) { return x.id === id; })[0] || null; }
  function msgText() { return (S.twMsg.length ? S.twMsg : ['I', 'want', 'more']).join(' '); }
  function toneText(text, tn) { return tn ? text.replace(/[\s.!?…,;:]+$/, '') + tn.end : text; }
  function speakTone(tn) {
    var text = toneText(msgText(), tn);
    var pitch = tn ? Math.min(2, Math.max(0.3, BASE_PITCH + tn.pitch)) : BASE_PITCH, rate = BASE_RATE * (tn ? tn.rate : 1);
    sayTone(text, pitch, rate);
    return text;
  }
  function pickTone(id, lock) {
    clearInterval(twLockT); clearTimeout(twOpenT);
    if (id === 'normal') {
      var s0 = speakTone(null);
      S.twOpen = false; S.twHover = ''; S.twLock = 0; S.twSlide = false; S.twMood = lock ? '' : S.twMood; S.twLast = 'normal'; S.twSaid = s0; draw(6); return;
    }
    var tn = toneOf(id), said = speakTone(tn);
    S.twOpen = false; S.twHover = ''; S.twLock = 0; S.twSlide = false; if (lock) S.twMood = id; S.twLast = id; S.twSaid = said; S.twLocked = !!lock; draw(6);
  }
  function startLock(id) {
    clearInterval(twLockT);
    S.twHover = id; S.twLock = 0; draw(6);
    if (!id) return;
    var t0 = Date.now();
    twLockT = setInterval(function () {
      var p = Math.min(1, (Date.now() - t0) / 1000);
      S.twLock = p; draw(6);
      if (p >= 1) clearInterval(twLockT);
    }, 50);
  }
  function toneAt(x, y) {
    var el = document.elementFromPoint(x, y), t = el && el.closest ? el.closest('[data-tone]') : null;
    return t ? t.getAttribute('data-tone') : '';
  }
  R[6] = function () {
    var showId = S.twHover && S.twHover !== 'normal' ? S.twHover : (S.twLast && S.twLast !== 'normal' ? S.twLast : (S.twMood || 'normal'));
    var rt = toneOf(S.twHover) || toneOf(S.twLast === 'normal' ? '' : S.twLast) || toneOf(S.twMood);
    var f = FACES[showId] || FACES.normal;
    var pitchNow = rt ? Math.min(2, Math.max(0.3, BASE_PITCH + rt.pitch)) : BASE_PITCH;
    var R0 = 118;
    var spots = TONES.map(function (tn, i) {
      var a = (-90 + i * 45) * Math.PI / 180, hov = S.twHover === tn.id, deg = hov ? Math.round(S.twLock * 360) : 0;
      return '<button type="button" class="f-twspot' + (hov ? ' hover' : '') + (S.twMood === tn.id ? ' mood' : '') + '" data-p="spot" data-a="spotclick" data-v="' + tn.id + '" data-tone="' + tn.id + '" aria-label="Say it ' + tn.id + '. Hold one second to make it the mood." style="left:' + (160 + R0 * Math.cos(a)).toFixed(1) + 'px;top:' + (160 + R0 * Math.sin(a)).toFixed(1) + 'px">' +
        '<span class="lockring" style="' + (deg ? 'background:conic-gradient(#3b2f9e ' + deg + 'deg,transparent ' + deg + 'deg);-webkit-mask:radial-gradient(circle,transparent 62%,#000 63%);mask:radial-gradient(circle,transparent 62%,#000 63%)' : '') + '"></span><img src="' + tn.src + '" alt=""><span class="tl">' + tn.id + '</span></button>';
    }).join('');
    var title = S.twHover && S.twHover !== 'normal' ? 'Rest here for a mood: ' + S.twHover : (S.twLast && S.twLast !== 'normal' ? (S.twLocked ? 'Mood set: ' : 'Said once: ') + S.twLast : (S.twMood ? 'Mood: ' + S.twMood : 'Normal: the learner’s own voice'));
    var tiles = ['I', 'you', 'want', 'more', 'go', 'like', 'help', 'stop', 'finished'].map(function (w) { return btile(w, 'twadd', '').replace('aria-label="' + w + '"', 'aria-label="Add ' + w + '"'); }).join('');
    paint($('f6'),
      '<div class="f-tw"><div class="f-twleft"><div class="f-twbarwrap">' +
      '<div class="f-twbar' + (S.twPress ? ' pressing' : '') + '" role="button" tabindex="0" data-p="twbar" aria-label="Message: ' + esc(msgText()) + '. Tap to say it. Press and hold for the tone wheel.">' +
      (S.twMood ? '<span class="f-twmood" aria-hidden="true"><img src="' + toneOf(S.twMood).src + '" alt="">mood: ' + S.twMood + '</span>' : '') +
      S.twMsg.map(function (w) { return '<span class="f-chip">' + esc(w) + '</span>'; }).join('') +
      (S.twMsg.length ? '' : '<span style="color:#6b5f3a">Tap words below</span>') + '</div>' +
      (S.twOpen ? '<div class="f-twring" role="group" aria-label="Tone wheel">' + spots +
        '<button type="button" class="f-twcenter' + (S.twHover === 'normal' ? ' hover' : '') + '" data-p="spot" data-a="spotclick" data-v="normal" data-tone="normal" aria-label="Normal: my own voice">Normal</button></div>' : '') +
      '</div>' +
      '<div class="row f-mt12"><button type="button" class="btn" data-a="twopen">' + (S.twOpen ? 'Close the wheel' : 'Open the tone wheel') + '</button><button type="button" class="btn" data-a="twclear">Clear message</button></div>' +
      '<div class="f-twtiles">' + tiles + '</div></div>' +
      '<div class="f-twright"><svg class="f-twowl" viewBox="0 0 100 100" role="img" aria-label="Dibs looks ' + (showId === 'normal' ? 'calm and ready' : showId) + '">' +
      '<defs><linearGradient id="twnk" x1="0" x2="1"><stop offset="0" stop-color="#3aa58c"></stop><stop offset=".5" stop-color="#7d62b8"></stop><stop offset="1" stop-color="#3aa58c"></stop></linearGradient></defs>' +
      '<g stroke="#3d3a4f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M40 92l-5 4M40 92l0 5M40 92l5 4M60 92l-5 4M60 92l0 5M60 92l5 4" fill="none" stroke="#e58a9c" stroke-width="3.2"></path><path d="M39 86v6M61 86v6" stroke="#e58a9c" stroke-width="3.2"></path>' +
      '<ellipse cx="50" cy="66" rx="29" ry="26" fill="#b9bed1"></ellipse><path d="M22 60Q12 76 26 88Q36 86 36 74Z" fill="#a1a8c0"></path><path d="M78 60Q88 76 74 88Q64 86 64 74Z" fill="#a1a8c0"></path>' +
      '<path d="M22 72q6 3 10 1M23 79q6 3 10 1M78 72q-6 3-10 1M77 79q-6 3-10 1" fill="none" stroke="#4b4a5e" stroke-width="2.4"></path><ellipse cx="50" cy="71" rx="16" ry="17" fill="#d6d9e6" stroke="none"></ellipse>' +
      '<path d="M31 47Q50 60 69 47L68 55Q50 66 32 55Z" fill="url(#twnk)"></path><circle cx="50" cy="31" r="22" fill="#a2a9c0"></circle></g>' +
      '<circle cx="39.6" cy="30.7" r="' + f.ir + '" fill="#f2903f" stroke="#3d3a4f" stroke-width="2"></circle><circle cx="60.4" cy="30.7" r="' + f.ir + '" fill="#f2903f" stroke="#3d3a4f" stroke-width="2"></circle>' +
      '<circle cx="' + f.lx + '" cy="' + f.ly + '" r="' + f.pr + '" fill="#211d2b"></circle><circle cx="' + f.rx + '" cy="' + f.ry + '" r="' + f.pr2 + '" fill="#211d2b"></circle>' +
      '<circle cx="' + f.hlx + '" cy="' + f.hly + '" r="' + f.hl + '" fill="#fff"></circle><circle cx="' + f.hrx + '" cy="' + f.hry + '" r="' + f.hr + '" fill="#fff"></circle>' +
      '<path d="' + f.lids + '" fill="#a2a9c0" stroke="#3d3a4f" stroke-width="2.4" stroke-linejoin="round"></path><path d="' + f.brows + '" fill="none" stroke="#3d3a4f" stroke-width="3" stroke-linecap="round"></path>' +
      '<path d="' + f.tongue + '" fill="#f472b6" stroke="#3d3a4f" stroke-width="1.6"></path><path d="' + f.beak + '" fill="#4b4a5e" stroke="#3d3a4f" stroke-width="2" stroke-linejoin="round"></path>' +
      '<ellipse cx="50" cy="40.5" rx="5" ry="2.4" fill="#efecf3" stroke="#3d3a4f" stroke-width="1.4"></ellipse><path d="' + f.cheeks + '" fill="#f9a8b8" opacity="0.75"></path>' +
      '<path d="' + f.drop + '" fill="#7cc4f2" stroke="#3b82c4" stroke-width="1.3"></path><text x="74" y="18" font-family="Lexend, sans-serif" font-weight="700" font-size="16" fill="#3b2f9e">' + f.mark + '</text></svg>' +
      '<div class="f-twread" aria-live="polite"><strong>' + esc(title) + '</strong>' +
      '<div class="f-twrow"><span>Pitch</span><b>' + (rt ? (rt.pitch > 0 ? 'higher (' : 'lower (') + pitchNow.toFixed(2) + ')' : 'their own (' + BASE_PITCH.toFixed(2) + ')') + '</b></div>' +
      '<div class="f-twrow"><span>Speed</span><b>' + (rt ? (rt.rate > 1 ? 'faster' : rt.rate < 1 ? 'slower' : 'same') + ' (×' + rt.rate.toFixed(2) + ')' : 'their own') + '</b></div>' +
      '<div class="f-twrow"><span>Ending</span><b>' + (rt ? '“' + rt.end + '”' : 'unchanged') + '</b></div>' +
      '<div class="f-twsaid">“' + esc(S.twSaid || toneText(msgText(), rt)) + '”</div></div></div></div>');
  };

  // ---------- Figure 7: scene maker (names, 40% threshold and word lists follow the app's scene data) ----------
  var EXTRA = { sit: 'sit', read: 'read', yummy: 'yummy', pet: 'pet', soft: 'soft', time: 'time', wait: 'wait', hungry: 'hungry', thirsty: 'thirsty', juice: 'juice', water: 'water', cook: 'cook', table: 'table', mine: 'my', snow: 'snow' };
  var lowSrc = {}; rows.forEach(function (r) { lowSrc[r.label.toLowerCase()] = r.src; });
  function symOf(w) { return src[w] || lowSrc[w.toLowerCase()] || (EXTRA[w] ? 'img/symbols/' + EXTRA[w] + '.svg' : ''); }
  var OBJ = [
    { k: 'clock', conf: 0.81, b: [80, 40, 80, 80] }, { k: 'lawn chair', conf: 0.66, b: [582, 112, 64, 72] }, { k: 'plant', conf: 0.44, b: [776, 66, 74, 128] }, { k: 'table', conf: 0.93, b: [215, 318, 430, 155] },
    { k: 'cup', conf: 0.91, b: [286, 258, 62, 64] }, { k: 'apple', conf: 0.88, b: [364, 260, 50, 64] }, { k: 'banana', conf: 0.86, b: [432, 284, 82, 38] },
    { k: 'bottle', conf: 0.79, b: [544, 220, 48, 102] }, { k: 'chair', conf: 0.84, b: [680, 244, 128, 228] }, { k: 'book', conf: 0.72, b: [698, 340, 82, 30] },
    { k: 'cat', conf: 0.9, b: [84, 376, 150, 102] }];
  var REL = { cup: ['drink', 'more', 'finished'], bottle: ['drink', 'open', 'more'], apple: ['eat', 'more', 'yummy', 'finished'], banana: ['eat', 'more', 'yummy', 'finished'],
    table: ['eat', 'sit', 'play'], chair: ['sit', 'table'], book: ['read', 'open', 'turn', 'more'], cat: ['pet', 'soft'], clock: ['time', 'wait'], 'lawn chair': ['mine', 'wait', 'snow'] };
  var GENERIC = ['more', 'finished', 'help'];
  var FOOD = ['eat', 'drink', 'hungry', 'thirsty', 'yummy', 'more', 'finished', 'water', 'juice', 'cook'];
  var SNAMES = ['Snack time', 'Kitchen', 'Scene Nov 14, 5:20 PM'];
  var FW = 420, FH = 280;
  var SVGATTR = 'stroke="#2a2350" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  function clampF(x, y) { return { fx: Math.max(FW / 2, Math.min(900 - FW / 2, x)), fy: Math.max(FH / 2, Math.min(520 - FH / 2, y)) }; }
  function vbOf(b) { var pad = 6; return (b[0] - pad) + ' ' + (b[1] - pad) + ' ' + (b[2] + pad * 2) + ' ' + (b[3] + pad * 2); }
  function vfParts() {
    var vx = S.fx - FW / 2, vy = S.fy - FH / 2, C = 26;
    return {
      shade: 'M0 0H900V520H0Z M' + vx + ' ' + vy + 'V' + (vy + FH) + 'H' + (vx + FW) + 'V' + vy + 'Z',
      corners: ['M' + vx + ' ' + (vy + C) + 'V' + vy + 'H' + (vx + C), 'M' + (vx + FW - C) + ' ' + vy + 'H' + (vx + FW) + 'V' + (vy + C),
        'M' + vx + ' ' + (vy + FH - C) + 'V' + (vy + FH) + 'H' + (vx + C), 'M' + (vx + FW - C) + ' ' + (vy + FH) + 'H' + (vx + FW) + 'V' + (vy + FH - C)].join(' '),
      vx: vx, vy: vy
    };
  }
  function roomSvg() {
    var v = vfParts();
    return '<svg viewBox="0 0 900 520" role="img" aria-label="A drawn kitchen: a clock and a window with a plant and, outside in the snow, a lawn chair saving a parking spot, a table with a cup, an apple, a banana and a bottle, a chair with a book on it, and a cat on the floor" ' + SVGATTR + '>' + SCENE +
      '<path data-vf="shade" d="' + v.shade + '" fill="rgba(20,16,40,0.4)" fill-rule="evenodd" stroke="none"></path>' +
      '<rect data-vf="rect" x="' + v.vx + '" y="' + v.vy + '" width="420" height="280" fill="none" stroke="#ffffff" stroke-width="3"></rect>' +
      '<path data-vf="corners" d="' + v.corners + '" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="square" stroke-linejoin="miter"></path>' +
      '<circle data-vf="dot" cx="' + (v.vx + 22) + '" cy="' + (v.vy + 24) + '" r="7" fill="#ef4444" stroke="#ffffff" stroke-width="2"></circle>' +
      '<text data-vf="text" x="' + (v.vx + 36) + '" y="' + (v.vy + 30) + '" fill="#ffffff" stroke="none" font-size="18" font-weight="800" font-family="Lexend, sans-serif" letter-spacing="1.5">CAMERA</text></svg>';
  }
  // Moving the camera frame only touches the frame's own shapes, so dragging stays smooth.
  function moveFrame() {
    var room = $('f7room'); if (!room) return;
    var v = vfParts(), q = function (k) { return room.querySelector('[data-vf=' + k + ']'); };
    q('shade').setAttribute('d', v.shade); q('corners').setAttribute('d', v.corners);
    q('rect').setAttribute('x', v.vx); q('rect').setAttribute('y', v.vy);
    q('dot').setAttribute('cx', v.vx + 22); q('dot').setAttribute('cy', v.vy + 24);
    q('text').setAttribute('x', v.vx + 36); q('text').setAttribute('y', v.vy + 30);
  }
  function aimTo(x, y) { var c = clampF(x, y); S.fx = c.fx; S.fy = c.fy; moveFrame(); }
  function cropSvg(vb) { return '<svg viewBox="' + vb + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" ' + SVGATTR + '>' + SCENE + '</svg>'; }
  function sceneFound() {
    var found = [];
    if (!S.shot) return found;
    var sx = S.shot.x - FW / 2, sy = S.shot.y - FH / 2;
    OBJ.forEach(function (o) {
      var ix = Math.max(0, Math.min(o.b[0] + o.b[2], sx + FW) - Math.max(o.b[0], sx));
      var iy = Math.max(0, Math.min(o.b[1] + o.b[3], sy + FH) - Math.max(o.b[1], sy));
      if (ix * iy >= 0.6 * o.b[2] * o.b[3] && o.conf >= 0.4) found.push(o);
    });
    return found;
  }
  function sceneLists() {
    var found = sceneFound();
    var kept = found.filter(function (o) { return S.keep[o.k] !== false; });
    var names = kept.map(function (o) { return o.k; }), rel = [];
    kept.forEach(function (o) { (REL[o.k] || []).forEach(function (w) { if (rel.indexOf(w) < 0 && names.indexOf(w) < 0) rel.push(w); }); });
    if (kept.length) GENERIC.forEach(function (w) { if (rel.indexOf(w) < 0) rel.push(w); });
    var byName = S.sname < 2, byTable = names.indexOf('table') >= 0 || names.indexOf('bottle') >= 0 || names.indexOf('cup') >= 0;
    var placeOn = !!S.shot && (byName || byTable);
    return { found: found, kept: kept, names: names, rel: rel, byName: byName, placeOn: placeOn, place: FOOD.filter(function (w) { return rel.indexOf(w) < 0; }) };
  }
  function wchip(act, store, w) {
    var on = !!S[store][w];
    return '<button type="button" class="wchip' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-a="' + act + '" data-v="' + esc(w) + '"><img src="' + symOf(w) + '" alt=""><span>' + esc(w) + '</span></button>';
  }
  R[7] = function () {
    var L = sceneLists(), shot = S.shot, h = '';
    h += '<p class="f-steph"><b>1</b> Aim and take a photo</p>' +
      '<div class="f-room" id="f7room" data-p="room">' + roomSvg() + (S.flash ? '<div class="f-flash" aria-hidden="true"></div>' : '') + '</div>' +
      '<div class="row f-between f-mt12"><div class="row" role="group" aria-label="Move the camera">' +
      [['Aim left', '←', '-40,0'], ['Aim up', '↑', '0,-40'], ['Aim down', '↓', '0,40'], ['Aim right', '→', '40,0']].map(function (a) { return '<button type="button" class="btn" aria-label="' + a[0] + '" data-a="aim" data-v="' + a[2] + '">' + a[1] + '</button>'; }).join('') +
      '</div><button type="button" class="btn solid f-bigbtn" data-a="shoot">◉ Take photo</button></div>' +
      '<p class="cap">Click or drag in the room to aim, or use the arrows.</p>';
    if (shot) {
      var sx = shot.x - FW / 2, sy = shot.y - FH / 2;
      h += '<p class="f-steph"><b>2</b> V.O.I.C.E. found ' + L.found.length + (L.found.length === 1 ? ' thing' : ' things') + '</p>' +
        '<div class="f-photo"><svg viewBox="' + sx + ' ' + sy + ' ' + FW + ' ' + FH + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" ' + SVGATTR + '>' + SCENE + '</svg>' +
        L.found.map(function (o) {
          var on = S.keep[o.k] !== false;
          return '<div class="f-bx' + (on ? '' : ' off') + '" style="left:' + ((o.b[0] - sx) / FW * 100).toFixed(1) + '%;top:' + ((o.b[1] - sy) / FH * 100).toFixed(1) + '%;width:' + (o.b[2] / FW * 100).toFixed(1) + '%;height:' + (o.b[3] / FH * 100).toFixed(1) + '%"><span>' + o.k + ' ' + Math.round(o.conf * 100) + '%</span></div>';
        }).join('') + '</div>' +
        (L.found.length ? '' : '<p class="cap">Nothing was found. In V.O.I.C.E. you can draw a box around each thing by hand instead.</p>') +
        '<div class="f-things">' + L.found.map(function (o) {
          var on = S.keep[o.k] !== false;
          return '<button type="button" class="f-thing' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-a="thing" data-v="' + o.k + '"><span class="ck">' + (on ? '✓' : '') + '</span><span class="f-crop">' + cropSvg(vbOf(o.b)) + '</span><span class="tt"><strong>' + o.k + '</strong><span>' + Math.round(o.conf * 100) + '% sure</span></span></button>';
        }).join('') + '</div>' +
        '<p class="cap">Everything found is ticked. Untick what you don’t want. V.O.I.C.E. only suggests things it is at least 40% sure of.</p>' +
        (L.kept.some(function (o) { return o.k === 'lawn chair'; }) ? '<p class="f-note-dibs"><img src="img/dibs/dibs.svg" alt="">Chicago rule: a chair in a shoveled parking spot means it’s saved. Dibs!</p>' : '') +
        '<p class="f-steph"><b>3</b> Words that go with these</p><div class="row">' + L.rel.map(function (w) { return wchip('relt', 'rel', w); }).join('') + '</div>' +
        '<p class="f-steph"><b>4</b> Name the scene</p>' + seg('Scene name', SNAMES.map(function (n, i) { return [i, n]; }), 'sname', S.sname) +
        (L.placeOn ? '<p style="margin:14px 0 8px;font-weight:700">Words for ' + esc(SNAMES[S.sname]) + ' <span style="font-weight:400;color:#6b5f3a">(' + (L.byName ? 'from the name' : 'because of the table, cup or bottle') + ')</span></p><div class="row">' + L.place.map(function (w) { return wchip('plct', 'plc', w); }).join('') + '</div>' : '') +
        '<div class="row" style="margin-top:18px"><button type="button" class="btn solid f-bigbtn" data-a="usenow">Use now</button><span class="cap" style="margin:0">Nothing is saved until you choose to.</span></div>';
    }
    if (S.used) {
      var glow = S.glow.toLowerCase();
      h += '<p class="f-steph"><b>5</b> The scene strip, on the child’s screen</p><div class="f-ipad2">' +
        '<div class="f-msgbar" aria-live="polite">' + S.said.map(function (w) { return '<span class="f-chip">' + esc(w) + '</span>'; }).join('') + '</div>' +
        '<div class="f-strip" role="group" aria-label="Scene strip"><span class="sname">' + esc(SNAMES[S.sname]) + '</span>' +
        S.usedItems.map(function (it, i) {
          return '<button type="button" class="f-sbtn" aria-label="Say ' + esc(it.label) + '" data-a="strip" data-v="' + i + '">' +
            (it.kind === 'object' ? '<span class="f-crop">' + cropSvg(it.vb) + '</span>' : '<img src="' + it.src + '" alt="">') + '<span class="lb">' + esc(it.label) + '</span></button>';
        }).join('') + '</div>' +
        '<div class="f-g9 f-mb">' + rows.map(function (r) { return tile(r, glow && glow === r.label.toLowerCase() ? ' glow' : ''); }).join('') + '</div></div>' +
        '<p class="cap">Tap the strip. Photo buttons show the thing itself; other words use the board’s own picture. When a word is also on the main board, its permanent spot glows. The board never moves.</p>';
    }
    paint($('f7'), h);
  };
  var glowT = 0;
  function useNow() {
    var L = sceneLists(), items = L.kept.map(function (o) { return { kind: 'object', label: o.k, vb: vbOf(o.b) }; });
    L.rel.forEach(function (w) { if (S.rel[w]) items.push({ kind: 'related', label: w, src: symOf(w) }); });
    if (L.placeOn) L.place.forEach(function (w) { if (S.plc[w]) items.push({ kind: 'place', label: w, src: symOf(w) }); });
    S.used = true; S.usedItems = items; S.said = []; draw(7);
  }

  // ---------- Figure 8: build a board (options, defaults and presets are V.O.I.C.E.'s own) ----------
  var BBDEF = { theme: 'standard', font: 'system', labelSize: 'm', labelPos: 'bottom', labelCase: 'asis', spacing: 'normal', hidden: 'gray', listener: false, glow: false, highlight: false };
  var BBPRESETS = [
    ['lowvision', 'Low vision', 'Dark high contrast, very large labels, easy-to-read font, wider gaps, words light up as said.', { theme: 'dark', font: 'atkinson', labelSize: 'xl', spacing: 'wide', hidden: 'invisible', highlight: true, glow: true }, 'Speak on touch (hear a word before choosing it)'],
    ['cvi', 'CVI', 'Black with one bright color (yellow), simple and uncluttered, no movement.', { theme: 'cvi', font: 'atkinson', labelSize: 'l', spacing: 'wide', hidden: 'invisible' }, 'No movement'],
    ['motor', 'Motor', 'The widest gaps, choose when the finger lifts, repeated taps ignored for 1 second.', { spacing: 'wider', hidden: 'invisible' }, 'Choose when the finger lifts; repeated taps ignored for 1 second'],
    ['hearing', 'Hearing partner', 'A Show button for the listener, a glowing message bar, words light up as said.', { listener: true, glow: true, highlight: true }, ''],
    ['sensory', 'Sensory-sensitive', 'Soft, low-glare colors, no movement or flashing.', { theme: 'dim', hidden: 'invisible', glow: false }, 'No movement or flashing'],
    ['', 'Start over', 'V.O.I.C.E.’s everyday settings.', {}, '']
  ];
  var DESK = [
    ['theme', 'Look', [['standard', 'Standard'], ['dark', 'High contrast'], ['cvi', 'CVI'], ['cbsafe', 'Color-blind safe'], ['dim', 'Dim']]],
    ['font', 'Font', [['system', 'iPad font'], ['atkinson', 'Atkinson Hyperlegible'], ['lexend', 'Lexend'], ['opendyslexic', 'OpenDyslexic']]],
    ['labelSize', 'Label size', [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']]],
    ['labelPos', 'Labels at', [['bottom', 'Bottom'], ['top', 'Top']]],
    ['labelCase', 'Letters', [['asis', 'As written'], ['lower', 'lowercase'], ['upper', 'UPPERCASE']]],
    ['spacing', 'Gaps', [['normal', 'Normal'], ['wide', 'Wide'], ['wider', 'Wider']]],
    ['hidden', 'Saved spots', [['gray', 'Gray'], ['dots', 'Dotted'], ['invisible', 'Not drawn']]]
  ];
  // Single quotes only: these go inside style="..." attributes, where a double quote would cut the style off.
  var BBFONT = { system: "system-ui,-apple-system,'Segoe UI',sans-serif", atkinson: "'Atkinson Hyperlegible',sans-serif", lexend: 'Lexend,sans-serif', opendyslexic: "'OpenDyslexic',sans-serif" };
  function swh(list) { return '<span class="sws" aria-hidden="true">' + list.map(function (s) { return '<i style="' + s + '"></i>'; }).join('') + '</span>'; }
  function aah(t, st) { return '<span class="aa" aria-hidden="true" style="' + (st || '') + '">' + t + '</span>'; }
  function ich(d) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"></path></svg>'; }
  var PREV = {
    theme: { standard: swh(['background:#fff3a8', 'background:#c9edc2', 'background:#c6e0f7']), dark: swh(['background:#000;box-shadow:inset 0 0 0 2px #ffe14d', 'background:#000;box-shadow:inset 0 0 0 2px #5ee36b', 'background:#000;box-shadow:inset 0 0 0 2px #58a6ff']),
      cvi: swh(['background:#000;box-shadow:inset 0 0 0 2px #ffd600', 'background:#ffd600', 'background:#000;box-shadow:inset 0 0 0 2px #ffd600']), cbsafe: swh(['background:#fff;box-shadow:inset 0 0 0 1.5px #1f2937', 'background:#a7f3d0', 'background:#fde68a']),
      dim: swh(['background:#5c5636', 'background:#3f5a3d', 'background:#3d4f63']) },
    font: { system: aah('Aa', 'font-family:' + BBFONT.system), atkinson: aah('Aa', 'font-family:' + BBFONT.atkinson), lexend: aah('Aa', 'font-family:' + BBFONT.lexend), opendyslexic: aah('Aa', 'font-family:' + BBFONT.opendyslexic + ';font-size:13px') },
    labelSize: { s: aah('A', 'font-size:11px'), m: aah('A', 'font-size:14px'), l: aah('A', 'font-size:17px'), xl: aah('A', 'font-size:21px') },
    labelPos: { bottom: ich('M6 3h12v11H6z M7 19h10'), top: ich('M7 5h10 M6 10h12v11H6z') },
    labelCase: { asis: aah('Aa'), lower: aah('aa'), upper: aah('AA') },
    spacing: { normal: ich('M4 4h7.5v7.5H4z M12.5 4H20v7.5h-7.5z M4 12.5h7.5V20H4z M12.5 12.5H20V20h-7.5z'), wide: ich('M4 4h6.5v6.5H4z M13.5 4H20v6.5h-6.5z M4 13.5h6.5V20H4z M13.5 13.5H20V20h-6.5z'), wider: ich('M4 4h5v5H4z M15 4h5v5h-5z M4 15h5v5H4z M15 15h5v5h-5z') },
    hidden: { gray: swh(['background:#d6d3e0', 'background:#d6d3e0']), dots: swh(['background:transparent;box-shadow:inset 0 0 0 1.5px #8a84a8', 'background:transparent;box-shadow:inset 0 0 0 1.5px #8a84a8']), invisible: swh(['background:transparent', 'background:transparent']) }
  };
  var PX = { s: 10, m: 12, l: 15, xl: 18 }, GAP = { normal: 4, wide: 10, wider: 16 };
  var STAGEBG = { standard: '#ffffff', dark: '#000000', cvi: '#000000', cbsafe: '#f8fafc', dim: '#1e2128' };
  var EDGE = { p: '#ffe14d', a: '#5ee36b', d: '#58a6ff', l: '#58a6ff', q: '#c49bff', s: '#ff7ab6', c: '#ffa23a' };
  var DIMC = { p: '#5c5636', a: '#3f5a3d', d: '#3d4f63', l: '#3d4f63', q: '#4f4563', s: '#63414f', c: '#66513a' };
  var CBIMG = { p: '#fde68a', a: '#a7f3d0', d: '#bfdbfe', l: '#bfdbfe', q: '#e9d5ff', s: '#fecdd3', c: '#fed7aa' };
  // Average letter width (in ems) of the widest board word in each font, measured in a browser; capitals are wider.
  var EMW = { asis: { system: 0.7, atkinson: 0.64, lexend: 0.71, opendyslexic: 0.95 }, upper: { system: 0.86, atkinson: 0.78, lexend: 0.87, opendyslexic: 1.26 } };
  var bbT = 0;
  R[8] = function () {
    var A = Object.assign({}, BBDEF, S.bb);
    var DARK = A.theme === 'dark' || A.theme === 'cvi' || A.theme === 'dim';
    var caseOf = function (w) { if (A.labelCase === 'upper') return w.toUpperCase(); if (A.labelCase === 'lower') return w === 'I' ? 'I' : w.toLowerCase(); return w; };
    var look = function (t) {
      if (A.theme === 'dark') return ['background:#121212;color:#fff;border:3px solid ' + EDGE[t], 'background:#fff;border-radius:5px'];
      if (A.theme === 'cvi') return ['background:#000;color:#ffd600;border:3px solid #ffd600', 'background:#fff;border-radius:5px'];
      if (A.theme === 'cbsafe') return ['background:#fff;color:#111;border:2.5px solid #1f2937', 'background:' + CBIMG[t] + ';border-radius:5px'];
      if (A.theme === 'dim') return ['background:' + DIMC[t] + ';color:#e5e7eb;border:2px solid rgba(255,255,255,.12)', 'background:#d4d4d4;border-radius:5px'];
      return ['background:' + COL[t] + ';color:#111;border:2px solid rgba(0,0,0,.14)', ''];
    };
    var tiles = rows.map(function (r) {
      var shown = r.stage <= 3, lk = look(r.t), lab = caseOf(r.label);
      var st = 'font-family:' + BBFONT[A.font] + ';flex-direction:' + (A.labelPos === 'top' ? 'column-reverse' : 'column') + ';';
      if (shown) st += lk[0];
      else if (A.hidden === 'gray') st += 'background:' + (DARK ? '#2b2b2b' : '#e5e7eb') + ';border:2px solid transparent';
      else if (A.hidden === 'dots') st += 'background:transparent;border:2px dotted ' + (DARK ? '#6b7280' : '#b8b2d6');
      else st += 'visibility:hidden';
      var em = EMW[A.labelCase === 'upper' ? 'upper' : 'asis'][A.font], fit = (80 / (lab.length * em)).toFixed(1);
      return '<button type="button" class="f-bbt" style="' + st + '" aria-label="' + (shown ? 'Say ' + esc(r.label) : 'Saved spot') + '"' + (shown ? ' data-a="bbtap" data-v="' + esc(r.label) + '"' : ' disabled') + '>' +
        (shown ? '<img src="' + r.src + '" alt="" style="' + lk[1] + '"><span style="font-size:min(' + PX[A.labelSize] + 'px,' + fit + 'cqw)">' + esc(lab) + '</span>' : '') +
        (r.label === 'more' ? '<img class="bbowl" src="img/dibs/dibs.svg" alt="">' : '') + '</button>';
    }).join('');
    var msg = S.bbMsg.map(function (w, i) {
      var lit = i === S.bbLit;
      return '<span class="f-bbchip" style="font-family:' + BBFONT[A.font] + ';' + (lit ? 'background:#fde047;color:#111' : (DARK ? 'background:#2a2a2a;color:#fff' : 'background:#f1ece0;color:#111')) + '">' + esc(caseOf(w)) + '</span>';
    }).join('');
    var desk = DESK.map(function (d) {
      return '<div class="f-drow"><span class="f-dlab">' + d[1] + '</span><div class="f-dopts" role="group" aria-label="' + d[1] + '">' + d[2].map(function (o) {
        var on = A[d[0]] === o[0];
        return '<button type="button" class="f-dopt' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-a="bbopt" data-v="' + d[0] + ':' + o[0] + '">' + ((PREV[d[0]] || {})[o[0]] || '') + '<span>' + o[1] + '</span></button>';
      }).join('') + '</div></div>';
    }).join('');
    var togs = [['listener', 'Show button'], ['glow', 'Glow while talking'], ['highlight', 'Light up words']].map(function (o) {
      var on = !!A[o[0]];
      return '<button type="button" class="tog' + (on ? ' on' : '') + '" role="switch" aria-checked="' + on + '" data-a="bbtog" data-v="' + o[0] + '"><span>' + o[1] + '</span><span class="track" aria-hidden="true"><span class="knob"></span></span></button>';
    }).join('');
    var sentence = S.bbMsg.length ? S.bbMsg.map(caseOf).join(' ') : 'Tap some words first';
    paint($('f8'),
      '<div class="f-presets" role="group" aria-label="Ready-made settings">' + BBPRESETS.map(function (p, i) {
        var on = p[0] ? S.bbPreset === p[0] : !S.bbPreset;
        return '<button type="button" class="f-preset' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-a="bbpreset" data-v="' + i + '"><strong>' + p[1] + '</strong><span>' + p[2] + '</span></button>';
      }).join('') + '</div>' +
      '<div class="f-bbwrap"><div class="f-bbstage" style="background:' + STAGEBG[A.theme] + ';color:' + (DARK ? (A.theme === 'cvi' ? '#ffd600' : '#e5e7eb') : '#111') + '">' +
      '<div class="f-bbbar' + (S.bbTalking ? ' glowing' : '') + '" style="background:' + (DARK ? '#151515' : '#f7f4ec') + '" aria-live="polite"><div class="f-bbmsg">' + msg + (S.bbMsg.length ? '' : '<span style="opacity:.6;font-size:14px">Tap words below</span>') + '</div>' +
      (A.listener ? '<button type="button" class="f-bbshow" data-a="bbshow">Show</button>' : '') + '<button type="button" class="f-bbshow" aria-label="Clear the message" data-a="bbclear">✕</button></div>' +
      '<div class="f-bbgrid" style="gap:' + GAP[A.spacing] + 'px;padding:' + Math.round(GAP[A.spacing] / 2) + 'px">' + tiles + '</div>' +
      (S.bbShow ? '<div class="f-bbover" style="' + (DARK ? 'background:#000;color:#fff' : 'background:#fff;color:#111') + '" role="dialog" aria-label="Message for the listener"><div class="f-bbbig" style="font-family:' + BBFONT[A.font] + ';transform:rotate(' + (S.bbFlip ? 180 : 0) + 'deg)">' + esc(sentence) + '</div>' +
        '<div class="row f-mid"><button type="button" class="btn" data-a="bbflip">Flip to face them</button><button type="button" class="btn solid" data-a="bbclose">Close</button></div></div>' : '') +
      '</div><div class="f-desk" role="group" aria-label="Board settings">' + desk + '<div class="f-drow"><span class="f-dlab">For listeners</span><div class="togs">' + togs + '</div></div></div></div>' +
      (S.bbNote ? '<p class="cap" style="margin-top:14px"><strong>Also turns on:</strong> ' + esc(S.bbNote) + '</p>' : ''));
  };
  function bbTap(label) {
    var A = Object.assign({}, BBDEF, S.bb);
    say(label);
    S.bbMsg = S.bbMsg.concat([label]).slice(-6);
    S.bbTalking = !!A.glow; S.bbLit = A.highlight ? S.bbMsg.length - 1 : -1; draw(8);
    clearTimeout(bbT); bbT = setTimeout(function () { S.bbTalking = false; S.bbLit = -1; draw(8); }, 900);
  }

  // ---------- Figure 9: prompt fading ----------
  var LV = [100, 75, 50, 25, 0];
  R[9] = function () {
    var st = 'opacity:' + (LV[S.hint] / 100);
    paint($('f9'), '<div class="seg f-mid" role="group" aria-label="Prompt strength" style="display:flex;width:fit-content;max-width:100%;margin:0 auto">' + LV.map(function (v, i) {
      return '<button type="button" class="btn" data-a="hint" data-v="' + i + '" aria-pressed="' + (i === S.hint) + '">' + (v ? v + '%' : 'On their own') + '</button>';
    }).join('') + '</div>' +
      '<div class="f-fade"><div class="ring" style="' + st + '"></div>' + tile(rowOf['more'], '') + '<img class="cr" src="img/dibs/dibs.svg" alt="" style="' + st + '"></div>');
  };

  // ---------- Figure 10: backward chaining ----------
  var CH = ['I', 'want', 'more'], PICK = ['I', 'you', 'it', 'want', 'like', 'go', 'more', 'help', 'stop'];
  R[10] = function () {
    var given = 3 - S.chain, expect = given + S.chainDone;
    var bar = CH.map(function (w, i) {
      if (i < given) return '<span class="f-chip">' + w + '</span>';
      if (i < expect) return '<span class="f-chip pick">' + w + '</span>';
      return '<span class="f-chip ghost">___</span>';
    }).join('');
    var target = expect < 3 ? CH[expect] : '', ti = PICK.indexOf(target);
    var owl = ti >= 0 ? 'left:' + (((ti % 9) + 0.5) / 9 * 100).toFixed(2) + '%;top:0%;width:9%' : 'opacity:0;left:50%;top:0;width:9%';
    var LBL = { 1: 'Step 1: child taps “more”', 2: 'Step 2: “want more”', 3: 'Step 3: the whole sentence' };
    paint($('f10'), seg('Chain step', [1, 2, 3].map(function (k) { return [k, LBL[k]]; }), 'chain', S.chain, 'f-mb') +
      '<div class="f-bar f-mb" aria-live="polite">' + bar + '</div>' +
      '<div class="f-g9 f-ride">' + PICK.map(function (w) { return btile(w, 'chaintap', w === target ? ' hit' : ''); }).join('') + '<img class="f-owl" src="img/dibs/dibs.svg" alt="" style="' + owl + '"></div>' +
      '<p class="cap" aria-live="polite">' + esc(S.chainMsg || (given ? 'V.O.I.C.E. has put “' + CH.slice(0, given).join(' ') + '” in the message bar. Tap the rest.' : 'The child taps the whole sentence.')) + '</p>');
  };

  // ---------- Figure 11: errorless trials ----------
  R[11] = function () {
    paint($('f11'), '<div class="seg f-mb" role="group" aria-label="Prompt level"><button type="button" class="btn" data-a="errlvl" data-v="high" aria-pressed="' + S.errHigh + '">Prompt 50% or more</button><button type="button" class="btn" data-a="errlvl" data-v="low" aria-pressed="' + !S.errHigh + '">Prompt below 50%</button></div>' +
      '<div class="f-g9">' + PICK.map(function (w, i) { return btile(w, 'errtap', (w === 'more' ? ' hit' : '') + (S.errBad === i ? ' f-shake' : '')); }).join('') + '</div>' +
      '<p class="cap" aria-live="polite">' + esc(S.errMsg || 'The target is “more.”') + '</p>');
  };

  // ---------- Figure 12: next-stage rule ----------
  R[12] = function () {
    var st2 = rows.filter(function (r) { return r.stage === 2; }).map(function (r) { return r.label; });
    var np = st2.filter(function (w) { return S.prof[w]; }).length, pct = Math.round(np / st2.length * 100), need = Math.ceil(st2.length / 2) - np;
    paint($('f12'), '<div class="row f-mb" style="margin-bottom:16px">' + st2.map(function (w) {
      var on = !!S.prof[w]; return '<button type="button" class="pchip' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-a="prof" data-v="' + w + '">' + (on ? '✓' : '+') + ' ' + w + '</button>';
    }).join('') + '</div>' +
      '<div class="f-meter" role="img" aria-label="' + pct + '% of stage 2 words proficient. The rule is 50%."><b style="width:' + pct + '%"></b><i></i></div>' +
      '<div class="row f-between" style="font-size:14px;color:#6b5f3a;margin-top:6px"><span>' + pct + '% proficient</span><span>Rule: 50% (clinicians can change it)</span></div>' +
      '<p class="f-live" aria-live="polite" style="margin:16px 0 0;font-size:19px">' + (pct >= 50 ? 'V.O.I.C.E. suggests stage 3. An adult confirms before anything changes.' : 'Not yet. ' + Math.max(0, need) + ' more word' + (need === 1 ? '' : 's') + ' to go.') + '</p>');
  };

  // ---------- Figure 13: heat map (V.O.I.C.E.'s report style: deep purple = few, pale yellow = most, square-root scale) ----------
  var HEAT = ['#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4'];
  R[13] = function () {
    var hmax = 0; rows.forEach(function (r) { hmax = Math.max(hmax, S.counts[r.label] || 0); });
    var top = rows.filter(function (r) { return S.counts[r.label]; }).sort(function (a, b) { return (S.counts[b.label] - S.counts[a.label]) || (a.label < b.label ? -1 : 1); }).slice(0, 5);
    var unused = rows.filter(function (r) { return !S.counts[r.label]; }).map(function (r) { return r.label; });
    paint($('f13'),
      '<div class="f-tapb" role="group" aria-label="Tap the board">' + rows.map(function (r) { return btile(r.label, 'tap', '').replace('aria-label="' + esc(r.label) + '"', 'aria-label="Tap ' + esc(r.label) + '"'); }).join('') + '</div>' +
      '<div class="f-hwrap"><div class="f-hmain"><div class="f-hgrid" role="table" aria-label="Taps on each spot of the main board">' + rows.map(function (r) {
        var n = S.counts[r.label] || 0, k = (!n || !hmax) ? 0 : Math.min(8, Math.max(1, Math.round(Math.sqrt(n / hmax) * 8)));
        return '<div class="f-hcell" role="cell" aria-label="' + esc(r.label) + ': ' + n + ' taps" style="background:' + HEAT[k] + ';color:' + (k >= 6 ? '#111827' : '#ffffff') + '"><span class="hw">' + esc(r.label) + '</span><span class="hn">' + n + '</span></div>';
      }).join('') + '</div><div class="f-hleg"><span>0</span><span class="f-hramp" aria-hidden="true"></span><span>' + hmax + ' taps</span></div></div>' +
      '<div class="f-hside"><div class="f-hbox"><h4>Most used spots</h4>' + (top.length ? '<ol>' + top.map(function (r) { return '<li><span>' + esc(r.label) + '</span><b>' + S.counts[r.label] + '</b></li>'; }).join('') + '</ol>' : '<p style="color:#4b5563">None yet. Tap the board.</p>') + '</div>' +
      '<div class="f-hbox"><h4>Where your taps came from</h4><p>' + S.from.board + ' on the board above<br>' + S.from.figs + ' in other figures<br>' + S.from.eggs + ' from hidden words</p></div>' +
      '<div class="f-hbox"><h4>Revealed but not used yet</h4><p>' + (unused.length ? unused.length + ' of 45 words, including ' + esc(unused.slice(0, 6).join(', ')) : 'Every word has been tapped.') + '</p><p class="m">In V.O.I.C.E., these are good words to model.</p></div>' +
      '<button type="button" class="btn" data-a="hreset">Clear my taps</button></div></div>');
  };

  // ---------- Figure 14: parent summary, in V.O.I.C.E.'s own wording ----------
  var TPL = {
    'request-actions': ['Requesting actions and more', 'Start something {name} loves, then stop in the middle and wait. Look at {name} like "your turn."', 'swings, tickles, songs, bubbles, opening containers: anything {name} wants to keep going.'],
    'help-break': ['Help, break and finished', 'For "help": give {name} something they can’t do alone, like a closed snack container, and wait. For "break" or "finished": start a task {name} doesn’t love, and show the button before they get upset. Don’t ask "Do you need help?"', 'snacks, getting dressed, puzzles, clean-up, homework.'],
    'commenting': ['Commenting', 'Make something fun or surprising happen (a tower falls, a toy pops up), then pause and look at {name}. Don’t ask anything.', 'knocking down towers, funny faces, bubbles popping, silly books.'],
    'yes-no-questions': ['Yes, no and questions', 'For yes and no: hold up something {name} loves or dislikes and ask "Do you want it?" For question words: hide a favorite toy and wait for "where."', 'snack choices, hide-and-seek with toys, "what’s in the bag?"'],
    'concepts': ['Concept words', 'Hold up two of the same thing that differ in one way (a big and a little cookie). Ask "Which one?" and wait.', 'snack (big or little piece), crayons, cars, building blocks.'],
    'general': ['General word', 'Use {word} yourself on V.O.I.C.E. often while you talk and play.', 'any time {word} fits what you’re doing.']
  };
  var ASSIGN = { more: 'request-actions', want: 'request-actions', go: 'request-actions', open: 'request-actions', help: 'help-break', finished: 'help-break', stop: 'help-break', look: 'commenting', like: 'commenting', yes: 'yes-no-questions', where: 'yes-no-questions', same: 'concepts', up: 'concepts', I: 'general' };
  var PMW = ['more', 'want', 'go', 'help', 'finished', 'look', 'like', 'yes', 'where', 'same'];
  var MONTHS = [
    { label: 'Month 1', range: 'September 1 to 28 (sample)', weeks: [['Sep 1', 5], ['Sep 8', 7], ['Sep 15', 8], ['Sep 22', 10]], distinct: 13, newList: ['more', 'help', 'eat', 'drink', 'stop', 'bathroom', 'want'], fav: ['more', 'eat', 'help', 'drink', 'stop'], longest: 'want more' },
    { label: 'Month 2', range: 'September 29 to October 26 (sample)', weeks: [['Sep 29', 11], ['Oct 6', 13], ['Oct 13', 12], ['Oct 20', 16]], distinct: 22, newList: ['go', 'open', 'finished', 'yes', 'no', 'Food', 'Drinks', 'look', 'Chat'], fav: ['more', 'want', 'go', 'eat', 'yes'], longest: 'want go outside' },
    { label: 'Month 3', range: 'October 27 to November 23 (sample)', weeks: [['Oct 27', 17], ['Nov 3', 20], ['Nov 10', 22], ['Nov 17', 25]], distinct: 33, newList: ['I', 'you', 'like', 'get', 'all', 'some', 'put', 'up', 'in', 'on', 'where'], fav: ['want', 'more', 'I', 'go', 'like'], longest: 'I want go play' }
  ];
  function listOf(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  R[14] = function () {
    var M = MONTHS[S.pmMonth], chosen = PMW.filter(function (w) { return S.pmWords[w]; });
    var LINES = ['We are just getting started with this one.', 'Sam needs less help now.', 'Sam is doing this mostly alone now.'];
    var mastered = S.pmMonth === 2 && chosen.length ? chosen[0] : '';
    var fill = function (s, w) { return s.split('{name}').join('Sam').split('{word}').join(w); };
    var home = chosen.filter(function (w) { return w !== mastered; });
    var topW = Math.max.apply(null, M.weeks.map(function (x) { return x[1]; }));
    var nlen = M.longest.split(' ').length;
    paint($('f14'),
      seg('Sample month', MONTHS.map(function (m, i) { return [i, m.label]; }), 'pmmonth', S.pmMonth, 'f-mb') +
      '<p style="margin:0 0 8px;font-weight:700">Words being taught:</p><div class="row" style="margin-bottom:20px">' + PMW.map(function (w) {
        var on = !!S.pmWords[w]; return '<button type="button" class="pchip' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-a="pmword" data-v="' + w + '">' + (on ? '✓' : '+') + ' ' + w + '</button>';
      }).join('') + '</div>' +
      '<div class="f-paper"><div class="row f-between" style="align-items:baseline"><strong style="font-family:Lexend,sans-serif;font-size:22px">Sam’s communication</strong><span class="f-sample">SAMPLE</span></div>' +
      '<div style="font-size:14px;color:#6b5f3a;margin-top:2px">' + M.range + '</div>' +
      '<div class="row" style="margin:16px 0"><div class="f-stat"><b>' + M.distinct + '</b>different words used</div><div class="f-stat"><b>' + M.newList.length + '</b>new words</div><div class="f-stat"><b>' + nlen + '</b>words in the longest message</div></div>' +
      '<h4>Different words each week</h4><div class="f-bars" role="img" aria-label="' + M.weeks.map(function (x) { return 'Week of ' + x[0] + ': ' + x[1]; }).join(', ') + '">' + M.weeks.map(function (x) {
        return '<div><span style="font-weight:800;font-size:14px">' + x[1] + '</span><div style="width:100%;max-width:60px;border-radius:6px 6px 0 0;background:#3b2f9e;height:' + Math.max(4, Math.round(x[1] / topW * 100)) + '%"></div></div>';
      }).join('') + '</div><div class="f-barl">' + M.weeks.map(function (x) { return '<span>' + x[0] + '</span>'; }).join('') + '</div>' +
      '<p style="font-size:16px;line-height:1.6;margin:16px 0 6px">Sam started using ' + M.newList.length + ' new words: ' + esc(listOf(M.newList)) + '.</p>' +
      '<p style="font-size:16px;line-height:1.6;margin:0 0 6px">Sam’s favorite words were ' + esc(listOf(M.fav)) + '.</p>' +
      '<p style="font-size:16px;line-height:1.6">Sam’s longest message had ' + nlen + ' words: “' + esc(M.longest) + '”.</p>' +
      '<h4 style="margin-top:20px">Words we practiced</h4>' + (chosen.length ? '' : '<p style="font-size:16px">We did not have practice sessions in this time.</p>') +
      '<ul style="margin:0;padding-left:20px;font-size:16px;line-height:1.6">' + chosen.map(function (w) { return '<li><strong>' + esc(w) + '</strong>: ' + (w === mastered ? 'Sam knows this word now. Great work!' : LINES[S.pmMonth]) + '</li>'; }).join('') + '</ul>' +
      '<h4 style="margin-top:20px">Words to practice at home</h4>' + (home.length ? '' : '<p style="font-size:16px">There are no words to practice at home right now.</p>') +
      home.map(function (w) {
        var T = TPL[ASSIGN[w] || 'general'];
        return '<div class="f-home"><strong style="font-family:Lexend,sans-serif">' + esc(w) + '</strong> <span style="font-size:13px;color:#6b5f3a">(' + T[0] + ')</span><div style="font-size:16px;line-height:1.55;margin-top:4px">' + esc(fill(T[1], w)) + '</div><div style="font-size:14px;color:#6b5f3a;margin-top:4px">Good times: ' + esc(fill(T[2], w)) + '</div></div>';
      }).join('') +
      '<p style="font-size:16px;margin:14px 0 0">Thank you for practicing with Sam. Every word counts!</p></div>');
  };

  // ---------- Figure 15: learners, 3-second hold, 1-2-3 passcode game ----------
  var LRN = [['Learner 1', 2, 'standard'], ['Learner 2', 4, 'dark'], ['Learner 3', 1, 'cbsafe']];
  var LOOKN = { standard: 'Standard look', dark: 'High contrast look', cbsafe: 'Color-blind safe look' };
  var ANIMALS = [['🦉', 'Owl', 'hoo hoo'], ['🐶', 'Dog', 'woof woof'], ['🐱', 'Cat', 'meow'], ['🐮', 'Cow', 'moo'], ['🐷', 'Pig', 'oink oink'], ['🐸', 'Frog', 'ribbit'], ['🦆', 'Duck', 'quack quack'], ['🐑', 'Sheep', 'baa'], ['🐴', 'Horse', 'neigh'],
    ['🦁', 'Lion', 'roar'], ['🐝', 'Bee', 'buzz buzz'], ['🐍', 'Snake', 'hiss'], ['🐔', 'Chicken', 'cluck cluck'], ['🐭', 'Mouse', 'squeak'], ['🐺', 'Wolf', 'awooo'], ['🐘', 'Elephant', 'toot toot'], ['🐵', 'Monkey', 'ooh ooh ah ah'], ['🐻', 'Bear', 'grr'],
    ['🐯', 'Tiger', 'rawr'], ['🦊', 'Fox', 'yip yip'], ['🐳', 'Whale', 'splash'], ['🐧', 'Penguin', 'waddle waddle'], ['🦖', 'Dinosaur', 'stomp stomp'], ['🐢', 'Turtle', 'slow and steady'], ['🦒', 'Giraffe', 'munch munch'], ['🐙', 'Octopus', 'wiggle wiggle'], ['🦄', 'Unicorn', 'sparkle']];
  var PARTY = [['🎉', 'Hooray!'], ['🎈', 'Pop!'], ['⭐', 'Super star!'], ['🌭', 'No ketchup!'], ['🎵', 'La la la!'], ['🥳', 'Party time!'], ['👏', 'Great job!'], ['🚆', 'All aboard the L!'], ['🍦', 'Yum!'],
    ['🎤', 'Your voice!'], ['💬', 'Let’s talk!'], ['🙌', 'High five!'], ['🍕', 'Deep dish!'], ['❄️', 'Snow day!'], ['🏆', 'You did it!'], ['🌟', 'Shine bright!'], ['🎶', 'Sing it!'], ['😄', 'Hello!'],
    ['👋', 'Hi there!'], ['🤗', 'Big hug!'], ['🍪', 'Cookie!'], ['🧩', 'Puzzle time!'], ['🛝', 'Down the slide!'], ['🎨', 'Let’s paint!'], ['📚', 'Story time!'], ['🥁', 'Boom boom!'], ['🤩', 'Amazing!']];
  var holdT = 0, popT = 0;
  function foundPanel() {
    var n = Object.keys(S.combos).length;
    var groups = [[1, 'V.O.I.C.E. words', 'Codes starting with 1'], [2, 'Dibs’s friends', 'Codes starting with 2'], [3, 'Celebrations', 'Codes starting with 3']];
    return '<div class="f-found"><div class="f-foundhead"><strong>Your collection: ' + n + ' of 81 found</strong>' +
      '<span class="f-foundbar" aria-hidden="true"><b style="width:' + (n / 81 * 100).toFixed(1) + '%"></b></span>' +
      (n ? '<button type="button" class="btn f-foundclear" data-a="clearcombos">Start over</button>' : '') + '</div>' +
      '<div class="f-foundgroups">' + groups.map(function (g) {
        var got = 0, cells = '';
        for (var i = 0; i < 27; i++) {
          var c = codeOf(g[0], i), on = !!S.combos[c];
          if (on) got++;
          var inner = !on ? '' : g[0] === 1 ? '<img src="' + rows[(i * 7) % 45].src + '" alt="">' : '<span>' + (g[0] === 2 ? ANIMALS[i][0] : PARTY[i][0]) + '</span>';
          var name = !on ? 'not found yet' : g[0] === 1 ? rows[(i * 7) % 45].label : g[0] === 2 ? ANIMALS[i][1] : PARTY[i][1];
          cells += '<i class="' + (on ? 'on' : '') + '" title="' + c + ': ' + esc(name) + '">' + inner + '</i>';
        }
        return '<div class="f-foundgroup"><p><b>' + g[1] + '</b> ' + got + ' of 27<br><span>' + g[2] + '</span></p><div class="f-foundgrid" role="img" aria-label="' + g[1] + ': ' + got + ' of 27 found">' + cells + '</div></div>';
      }).join('') + '</div><p class="cap" style="margin:8px 0 0">Your collection is saved only in this browser.</p></div>';
  }
  R[15] = function () {
    var L = LRN[S.learner], deg = Math.round(S.hold / 30 * 360);
    var cells = rows.map(function (r) {
      if (r.stage > L[1]) return '<i class="off"></i>';
      if (L[2] === 'dark') return '<i style="background:#121212;box-shadow:inset 0 0 0 2px ' + EDGE[r.t] + '"></i>';
      if (L[2] === 'cbsafe') return '<i style="background:#fff;box-shadow:inset 0 0 0 2px #1f2937"></i>';
      return '<i style="background:' + COL[r.t] + '"></i>';
    }).join('');
    var cap = L[0] + ': stage ' + L[1] + ', ' + LOOKN[L[2]];
    var dots = [0, 1, 2, 3].map(function (i) { return '<span style="width:16px;height:16px;border-radius:50%;border:2px solid #2a2350;display:inline-block;' + (i < S.pin.length ? 'background:#2a2350' : '') + '"></span>'; }).join('');
    paint($('f15'), '<div class="f-flex mid f-mid" style="gap:48px"><div style="flex:1 1 300px;max-width:460px;min-width:0">' +
      seg('Learner', LRN.map(function (l, i) { return [i, l[0]]; }), 'learner', S.learner, 'f-mb') +
      '<div class="f-mini" role="img" aria-label="' + cap + '" style="padding:10px;border-radius:10px;box-sizing:border-box;background:' + (L[2] === 'dark' ? '#000' : '#f1ece0') + '">' + cells + '</div>' +
      '<p class="cap">' + cap + '. Sample learners.</p></div>' +
      '<div class="f-center" style="flex:0 1 240px;min-width:min(220px,100%)"><button type="button" class="f-hold" data-p="hold" aria-label="Adult menu: press and hold for 3 seconds" style="background:conic-gradient(#3b2f9e ' + deg + 'deg,#f1ece0 ' + deg + 'deg)"></button>' +
      '<p aria-live="polite" style="margin:10px 0 0;font-weight:700">' + (S.unlocked ? 'Now type a passcode. Every one is a surprise.' : S.hold ? 'Keep holding…' : 'Hold for 3 seconds') + '</p>' +
      (S.unlocked ? '<div class="row f-mid" style="margin-top:10px" role="img" aria-label="' + S.pin.length + ' of 4 digits entered">' + dots + '</div>' +
        '<div class="row f-mid" role="group" aria-label="Passcode keys" style="margin-top:12px">' + ['1', '2', '3'].map(function (k) { return '<button type="button" class="f-key big" data-a="pin" data-v="' + k + '">' + k + '</button>'; }).join('') + '</div>' +
        '<p style="font-size:14px;color:#6b5f3a;margin:10px 0 0">Found ' + Object.keys(S.combos).length + ' of 81 surprises</p><button type="button" class="btn" style="margin-top:8px" data-a="relock">Lock again</button>' : '') +
      '</div></div>' + foundPanel());
    var p = S.pop;
    paint($('f15pop'), p ? '<div class="f-pop-wrap" role="status" aria-live="polite" data-k="pop' + p.n + '"><div class="f-pop">' + (p.img ? '<img src="' + p.src + '" alt="">' : '<span class="emo" aria-hidden="true">' + p.e + '</span>') +
      '<strong>' + esc(p.title) + '</strong><span>' + esc(p.sub) + '</span>' + (p.isNew ? '<em>New find!</em>' : '') + '</div></div>' : '');
  };
  var popN = 0;
  // Found surprises are remembered in this browser only (like the hidden words), never sent anywhere.
  var CKEY = 'voice-site-passcode-surprises';
  try { (JSON.parse(localStorage.getItem(CKEY) || '[]') || []).forEach(function (c) { if (/^[1-3]{4}$/.test(c)) S.combos[c] = true; }); } catch (e) {}
  function saveCombos() { try { localStorage.setItem(CKEY, JSON.stringify(Object.keys(S.combos))); } catch (e) {} }
  function codeOf(first, idx) { return '' + first + (Math.floor(idx / 9) + 1) + (Math.floor(idx / 3) % 3 + 1) + (idx % 3 + 1); }
  function showPop(code) {
    var d = code.split('').map(Number), idx = (d[1] - 1) * 9 + (d[2] - 1) * 3 + (d[3] - 1), isNew = !S.combos[code], pop;
    if (d[0] === 1) { var w = rows[(idx * 7) % 45]; pop = { img: true, src: w.src, e: '', title: w.label, sub: 'A word from the V.O.I.C.E. board', speak: w.label }; }
    else if (d[0] === 2) { var a = ANIMALS[idx]; pop = { img: false, src: '', e: a[0], title: a[2], sub: a[1] + ', one of Dibs’s friends', speak: a[2] }; }
    else { var c = PARTY[idx]; pop = { img: false, src: '', e: c[0], title: c[1], sub: 'Code ' + code, speak: c[1] }; }
    pop.isNew = isNew; pop.n = ++popN;
    S.combos[code] = true; saveCombos(); S.pop = pop; S.pin = ''; draw(15);
    say(pop.speak);
    if (isNew) fanfare();
    clearTimeout(popT); popT = setTimeout(function () { S.pop = null; draw(15); }, 2400);
  }

  // ---------- Figure 16: backup ----------
  R[16] = function () {
    var cells = rows.map(function (r) { return r.stage <= 3 ? '<i style="background:' + COL[r.t] + '"></i>' : '<i class="off"></i>'; }).join('');
    paint($('f16'), '<div class="f-flex mid f-mid"><div class="f-ipad"><div class="scr"><strong>Old iPad</strong><div class="f-mini">' + cells + '</div></div></div>' +
      '<div class="f-center" style="flex:0 1 180px">' + (S.bk >= 1 ? '<span class="f-file">Backup file</span>' : '') + '<p style="font-size:14px;color:#6b5f3a;margin:8px 0 0">' + ['Nothing saved yet.', 'Saved in the Files app.', 'Restored. Same board, same data.'][S.bk] + '</p></div>' +
      '<div class="f-ipad"><div class="scr"><strong>New iPad</strong>' + (S.bk === 2 ? '<div class="f-mini">' + cells + '</div>' : '<span>No learners yet</span>') + '</div></div></div>' +
      '<div class="row f-mid f-mt"><button type="button" class="btn" data-a="bksave"' + (S.bk !== 0 ? ' disabled' : '') + '>Save a backup</button><button type="button" class="btn" data-a="bkrestore"' + (S.bk !== 1 ? ' disabled' : '') + '>Restore on the new iPad</button><button type="button" class="btn" data-a="bkreset">Start over</button></div>');
  };

  // ---------- Click actions ----------
  var ACT = {
    stage: function (v) { S.stage = +v; draw(1); },
    walk: walk,
    gtoggle: function () { S.gOpen = !S.gOpen; draw(3); },
    gpick: gpick,
    gnext: function () {
      if (S.gR === GAME.length - 1) { S.gR = 0; S.gScore = 0; S.gDone = {}; } else S.gR++;
      S.gW = null; S.gSolved = false; S.gMsg = ''; S.gOpen = false; draw(3);
      var b = $('f3forms'); if (b) b.focus({ preventScroll: true });
    },
    gsound: function () { S.gSound = !S.gSound; draw(3); },
    dial: function () { S.dial = !S.dial; S.dialSaid = S.dial ? 'Up: past. Right: -ing. Down: -s. Left: the last form.' : 'Tap eat to open its dial.'; draw(4); if (S.dial) say('eat'); },
    dpick: function (v) { S.dial = false; S.dialSaid = 'Chose “' + DIAL[+v] + '”.'; draw(4); say(DIAL[+v]); },
    mustard: function () { clearTimeout(dogT); S.dogM = true; S.dogMood = 'yum'; S.dogSaid = 'Mustard? Yes. Dibs approves.'; draw(4); say('mustard, yes!'); dogT = setTimeout(function () { S.dogMood = ''; draw(4); }, 600); },
    ketchup: function () { clearTimeout(dogT); S.dogK = true; S.dogMood = 'nope'; S.dogSaid = 'Dibs shakes his head: no ketchup on a hot dog. It’s a Chicago thing.'; draw(4); say('no ketchup!'); dogT = setTimeout(function () { S.dogK = false; S.dogMood = ''; draw(4); }, 900); },
    dogreset: function () { clearTimeout(dogT); S.dogM = S.dogK = false; S.dogMood = ''; S.dogSaid = ''; draw(4); },
    lw: function (v) { v = +v; S.lw = S.lw === v ? -1 : v; draw(5); say(LWG[v][0]); },
    lwsay: function (v) { say(v); },
    twadd: function (v) { say(v); S.twMsg = S.twMsg.concat([v]).slice(-6); draw(6); },
    twopen: function () { if (S.twOpen) { clearInterval(twLockT); S.twOpen = false; S.twHover = ''; S.twLock = 0; } else { S.twOpen = true; S.twSlide = false; S.twHover = ''; S.twLock = 0; } draw(6); },
    twclear: function () { S.twMsg = []; draw(6); },
    spotclick: function (v) { if (twSkipClick) { twSkipClick = false; return; } pickTone(v, false); },
    aim: function (v) { var p = v.split(','); aimTo(S.fx + +p[0], S.fy + +p[1]); },
    shoot: function () {
      S.shot = { x: S.fx, y: S.fy }; S.keep = {}; S.rel = {}; S.plc = {}; S.used = false; S.usedItems = []; S.flash = true; draw(7);
      later(function () { S.flash = false; draw(7); }, 450);
    },
    thing: function (v) { S.keep[v] = S.keep[v] === false; draw(7); },
    relt: function (v) { S.rel[v] = !S.rel[v]; draw(7); },
    plct: function (v) { S.plc[v] = !S.plc[v]; draw(7); },
    sname: function (v) { S.sname = +v; draw(7); },
    usenow: useNow,
    strip: function (v) {
      var it = S.usedItems[+v]; if (!it) return;
      say(it.label); S.said = S.said.concat([it.label]).slice(-4); S.glow = it.label; draw(7);
      clearTimeout(glowT); glowT = setTimeout(function () { S.glow = ''; draw(7); }, 1200);
    },
    bbpreset: function (v) { var p = BBPRESETS[+v]; S.bb = Object.assign({}, p[3]); S.bbPreset = p[0]; S.bbNote = p[4]; draw(8); },
    bbopt: function (v) { var k = v.split(':'); S.bb[k[0]] = k[1]; draw(8); },
    bbtog: function (v) { var A = Object.assign({}, BBDEF, S.bb); S.bb[v] = !A[v]; draw(8); },
    bbtap: bbTap,
    bbclear: function () { S.bbMsg = []; S.bbLit = -1; draw(8); },
    bbshow: function () { S.bbShow = true; S.bbFlip = false; draw(8); },
    bbclose: function () { S.bbShow = false; draw(8); },
    bbflip: function () { S.bbFlip = !S.bbFlip; draw(8); },
    hint: function (v) { S.hint = +v; draw(9); },
    chain: function (v) { S.chain = +v; S.chainDone = 0; S.chainMsg = ''; draw(10); },
    chaintap: function (w) {
      bump(w, 'figs');
      var given = 3 - S.chain, target = CH[given + S.chainDone];
      if (w !== target) { S.chainMsg = 'Not that one. Dibs is showing the next word.'; draw(10); return; }
      say(w); S.chainDone++;
      S.chainMsg = given + S.chainDone === 3 ? 'Trial done: “I want more.”' : 'Yes! Next word.'; draw(10);
      if (given + S.chainDone === 3) later(function () { say('I want more'); }, 500);
    },
    errlvl: function (v) { S.errHigh = v === 'high'; S.errMsg = ''; draw(11); },
    errtap: function (w) {
      bump(w, 'figs');
      var i = PICK.indexOf(w);
      if (w === 'more') { say('more'); S.errMsg = 'Correct: “more.”'; S.errBad = -1; }
      else if (S.errHigh) { S.errMsg = '“' + w + '” was blocked. Nothing was added. The blocked tap is logged for the adult.'; S.errBad = i; }
      else { say(w); S.errMsg = '“' + w + '” was spoken and counted as an error, then the trial goes on with more help.'; S.errBad = -1; }
      draw(11);
      later(function () { S.errBad = -1; draw(11); }, 400);
    },
    prof: function (v) { S.prof[v] = !S.prof[v]; draw(12); },
    tap: function (w) { say(w); bump(w, 'board'); },
    hreset: function () { S.counts = {}; S.from = { board: 0, figs: 0, eggs: 0 }; draw(13); },
    pmmonth: function (v) { S.pmMonth = +v; draw(14); },
    pmword: function (v) { S.pmWords[v] = !S.pmWords[v]; draw(14); },
    learner: function (v) { S.learner = +v; draw(15); },
    pin: function (k) { var v = S.pin + k; if (v.length < 4) { S.pin = v; draw(15); } else showPop(v); },
    clearcombos: function () { S.combos = {}; saveCombos(); draw(15); },
    relock: function () { S.unlocked = false; S.hold = 0; S.pin = ''; draw(15); },
    bksave: function () { S.bk = 1; draw(16); },
    bkrestore: function () { S.bk = 2; draw(16); },
    bkreset: function () { S.bk = 0; draw(16); }
  };
  document.addEventListener('click', function (e) {
    var egg = e.target.closest && e.target.closest('button.egg');
    if (egg) { var w = egg.getAttribute('data-egg'); if (w && rowOf[w]) bump(w, 'eggs'); return; }
    var el = e.target.closest && e.target.closest('[data-a]');
    if (!el || el.disabled || !$('main').contains(el)) return;
    var f = ACT[el.getAttribute('data-a')];
    if (f) { try { f(el.getAttribute('data-v'), el); } catch (er) { if (window.console) console.error(er); } }
  });

  // ---------- Press and hold ----------
  var roomDrag = false;
  var PTR = {
    twbar: {
      pointerdown: function (e, el) {
        try { el.setPointerCapture(e.pointerId); } catch (er) {}
        S.twPress = true; draw(6);
        clearTimeout(twOpenT);
        twOpenT = setTimeout(function () { S.twOpen = true; S.twSlide = true; S.twPress = false; S.twHover = ''; S.twLock = 0; draw(6); }, 500);
      },
      pointermove: function (e) {
        if (!S.twOpen || !S.twSlide) return;
        var id = toneAt(e.clientX, e.clientY);
        if (id !== S.twHover) startLock(id);
      },
      pointerup: function () {
        clearTimeout(twOpenT);
        if (!S.twOpen) { S.twPress = false; var tn = toneOf(S.twMood); S.twSaid = speakTone(tn); S.twLast = S.twMood || 'normal'; S.twLocked = false; draw(6); return; }
        if (S.twSlide && S.twHover) { pickTone(S.twHover, S.twLock >= 1); return; }
        clearInterval(twLockT);
        S.twSlide = false; S.twPress = false; S.twHover = ''; S.twLock = 0; draw(6);   // lifted without sliding: the wheel stays open for tapping
      },
      pointercancel: function () { clearTimeout(twOpenT); clearInterval(twLockT); S.twPress = false; S.twSlide = false; S.twHover = ''; S.twLock = 0; draw(6); }
    },
    spot: {
      pointerdown: function (e, el) { if (S.twSlide) return; twPtr = true; startLock(el.getAttribute('data-tone')); },
      pointerup: function (e, el) { if (S.twSlide || !twPtr) return; twPtr = false; twSkipClick = true; pickTone(el.getAttribute('data-tone'), S.twLock >= 1); },
      pointerleave: function () { if (S.twSlide) return; twPtr = false; clearInterval(twLockT); S.twHover = ''; S.twLock = 0; draw(6); }
    },
    room: {
      // Aim only while pressed (click or drag), so moving the mouse across the room to the button doesn't move the camera.
      pointermove: function (e, el) { if (!roomDrag) return; var r = el.getBoundingClientRect(); if (r.width) aimTo((e.clientX - r.left) / r.width * 900, (e.clientY - r.top) / r.height * 520); },
      pointerdown: function (e, el) { roomDrag = true; try { el.setPointerCapture(e.pointerId); } catch (er) {} PTR.room.pointermove(e, el); },
      pointerup: function () { roomDrag = false; },
      pointercancel: function () { roomDrag = false; }
    },
    hold: {
      pointerdown: function () {
        clearInterval(holdT); if (S.unlocked) return;
        holdT = setInterval(function () {
          var h = S.hold + 1;
          if (h >= 30) { clearInterval(holdT); S.hold = 30; S.unlocked = true; } else S.hold = h;
          draw(15);
        }, 100);
      },
      pointerup: function () { clearInterval(holdT); if (!S.unlocked) { S.hold = 0; draw(15); } },
      pointerleave: function () { PTR.hold.pointerup(); },
      pointercancel: function () { PTR.hold.pointerup(); }
    }
  };
  function route(ev) {
    return function (e) {
      var el = e.target.closest && e.target.closest('[data-p]');
      if (!el || !$('main').contains(el)) return;
      var h = PTR[el.getAttribute('data-p')]; h = h && h[ev];
      if (h) h(e, el);
    };
  }
  ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(function (ev) { document.addEventListener(ev, route(ev)); });
  document.addEventListener('pointerup', function () { roomDrag = false; }, true);
  document.addEventListener('pointerleave', route('pointerleave'), true);
  // Keyboard: the message bar says the message on Enter or Space (the wheel has its own button).
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.twOpen) { clearInterval(twLockT); S.twOpen = false; S.twHover = ''; S.twLock = 0; draw(6); return; }
    var el = e.target.closest && e.target.closest('[data-p=twbar]');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); S.twSaid = speakTone(toneOf(S.twMood)); S.twLast = S.twMood || 'normal'; S.twLocked = false; draw(6); }
  });

  for (var n = 1; n <= 16; n++) draw(n);
})();
