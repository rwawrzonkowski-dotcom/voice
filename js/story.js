// "Dibs's First Day": a six-scene tap-through story at the top of Get started.
// Plain JS. Nothing is saved or sent. Sound is off until the visitor turns it on, and speech uses only on-device voices.
(function () {
  'use strict';
  var sec = document.getElementById('first-day'); if (!sec) return;
  var mount = document.getElementById('s-mount'); if (!mount) return;
  var staticBox = sec.querySelector('.s-static');

  // ---------- The story ----------
  // ok: the best choice. why: what Dibs says. tap: which tile is tapped when the choice is right (and by whom).
  var SCENES = [
    { title: 'The talker arrives',
      nar: 'Sam’s new talker is here. It’s V.O.I.C.E. on the iPad.',
      wk: 'A pigeon teaching talking? This I gotta see.',
      dibs: 'Hi! I’m Dibs. Let’s do your first day together.',
      q: 'Where do you start?',
      opts: [
        { t: 'Teach all 1,700 words today.', why: 'Whoa! That’s a lot. V.O.I.C.E. starts small on purpose.' },
        { t: 'Wait until Sam seems ready.', why: 'There’s no test to pass first. Kids learn a talker by seeing it used. Today is a great day to start.' },
        { t: 'Start with the six first words.', ok: 1, why: 'Yes! Help, stop, eat, drink, bathroom and more. Words Sam needs every day.' }] },
    { title: 'Snack time',
      nar: 'Sam sits down for crackers.',
      wk: 'He’s not even looking at the iPad. Told ya.',
      dibs: 'Your turn!',
      q: 'How do you show Sam the word “eat”?',
      opts: [
        { t: 'Hold the crackers until Sam taps “eat.”', why: 'Don’t make Sam copy you yet. That turns snack into a test. Show first.' },
        { t: 'Tap “eat” while you say, “Time to eat!”', ok: 1, tap: 3, who: 'adult', why: 'That’s modeling. You talk with the talker, just like you talk to a baby long before they talk back.',
          after: 'He doesn’t have to look. Kids learn by watching, even out of the corner of their eye.' },
        { t: 'Put the iPad away so snack isn’t messy.', why: 'A voice only helps if it’s close. Keep the iPad within reach.' }] },
    { title: 'More, more, more',
      nar: 'Sam reaches over and taps “more.” Then again. And again. More! More! More!',
      wk: 'He’s just pushing buttons. Take it away.',
      wk2: '…Okay, that was a little impressive.',
      dibs: 'Whoa, he’s on a roll!',
      enterTap: { tile: 2, times: 3 },
      q: 'What do you do?',
      opts: [
        { t: 'Take the iPad away. Sam is just playing.', why: 'Exploring is how kids learn, like babies babble. Each tap teaches what the button says.' },
        { t: 'Turn the sound off.', why: 'The sound is the point! If it’s too loud, turn the volume down, not off.' },
        { t: 'Treat it like talking: “More! Here’s more.”', ok: 1, tap: 2, who: 'adult', why: 'Every tap is talking. Sam just learned that “more” gets more.' }] },
    { title: 'Stop!',
      nar: 'Later, you try to brush Sam’s hair. Sam pushes your hand away and taps “stop.”',
      wk: 'Ha! Brushing is not up for a vote. That tap won’t do a thing.',
      dibs: 'Oh, a tricky one.',
      enterTap: { tile: 1, times: 1 },
      q: 'What do you do?',
      opts: [
        { t: 'Pause and say, “Stop. Okay, we stopped.”', ok: 1, tap: 1, why: 'Sam’s word worked. When words work, kids use them again. You can try again in a minute, or brush for just a few seconds.' },
        { t: 'Keep brushing. It only takes a minute.', why: 'If “stop” does nothing, Sam learns the talker doesn’t matter. Show that the word works.' },
        { t: 'Tell Sam to use nice words.', why: '“Stop” IS a nice word! Sam used the talker instead of pushing. That’s a win.' }] },
    { title: 'Help!',
      nar: 'Sam can’t open the juice box. Sam starts to get upset.',
      wk: 'Juice box emergency! Just open it already, pigeon.',
      dibs: 'Uh oh. Juice box trouble.',
      q: 'What do you do?',
      opts: [
        { t: 'Open it fast so Sam won’t get upset.', why: 'Helping is good. Show the word first, then help.' },
        { t: 'Tap “help” as you say, “Help? I can help!” Then open it.', ok: 1, tap: 0, who: 'adult', why: 'You showed Sam a word for this exact moment. Next time, Sam might tap it first.' },
        { t: 'Wait until Sam taps “help” alone.', why: 'It’s day one. Show it many times before you expect it.' }] },
    { title: 'The end of day one', end: 1,
      nar: 'Bedtime. Sam didn’t say a lot today. But you showed six words in real moments, and Sam tapped “more” all by himself.',
      wk: 'Fine. FINE. The pigeon was right. …See you at lunch, Dibs.',
      dibs: 'Day one, done. Proud of you!' }
  ];
  var N = SCENES.length;
  var TILES = [['help', 'social'], ['stop', 'social'], ['more', 'social'], ['eat', 'action'], ['drink', 'action'], ['bathroom', 'place']];
  var LESSONS = [
    'Start with the six first words.',
    'Show, don’t test. Tap the word as you say it.',
    'Keep the iPad close, all day.',
    'Every tap is talking. Answer it.',
    'Make the words work. “Stop” means stop.',
    'Show words in real moments: snack, bath, play, getting dressed.'];
  var CONF = ['#ffd84d', '#f9cddd', '#c9edc2', '#c6e0f7', '#e0d0f3', '#fddcb2', '#3b2f9e', '#2e7d32'];
  var CHECK = '<svg class="s-chk" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#2e7d32" stroke="#2a2350" stroke-width="1.5"/><path d="M6.5 12.5l4 4 7-8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  // ---------- Sound (off until switched on) ----------
  var snd = false, ac = null;
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
  // Dibs: the site's higher voice. Wacker: the same on-device voices, lower (as in Figure 4). queue=true keeps what is already being said.
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
  function dibsSay(t, queue) { talk(t, 1.3, queue); }
  function wackerSay(t, queue) { talk(t, 0.6, queue); }
  function wordSay(w) { if (snd && window.VOICE_SAY) window.VOICE_SAY(w); }
  function stopSpeech() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} }
  function tones(list, type, vol) {
    if (!snd) return;
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
  function fanfare() { tones([[523.25, 0, 0.2], [659.25, 0.12, 0.2], [783.99, 0.24, 0.2], [1046.5, 0.36, 0.6]], 'triangle', 0.18); }
  function whoosh() {
    if (!snd) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ac = ac || new AC(); if (ac.resume) ac.resume();
      var t0 = ac.currentTime + 0.02, len = Math.floor(ac.sampleRate * 0.42);
      var buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var src = ac.createBufferSource(); src.buffer = buf;
      var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(450, t0); f.frequency.exponentialRampToValueAtTime(2400, t0 + 0.22); f.frequency.exponentialRampToValueAtTime(700, t0 + 0.4);
      var g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      src.connect(f); f.connect(g); g.connect(ac.destination); src.start(t0); src.stop(t0 + 0.43);
    } catch (e) {}
  }

  // ---------- Markup ----------
  var HAND = '<svg viewBox="0 0 48 64" aria-hidden="true"><g stroke="#2a2350" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">' +
    '<rect x="19" y="3" width="10" height="32" rx="5" fill="var(--skin)"/>' +
    '<path d="M11 36Q11 29 18 29H37Q44 29 44 36V50H11Z" fill="var(--skin)"/>' +
    '<path d="M11 36Q3 36 5 44Q7 49 14 47" fill="var(--skin)"/>' +
    '<path d="M25 33v9M32 33v9M39 33v9" fill="none" stroke-width="2"/>' +
    '<path d="M9 50H46V62H9Z" fill="var(--sleeve)"/></g></svg>';

  function bgSvg() {
    return '<svg class="s-bg" viewBox="0 0 600 400" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g stroke="#2a2350" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">' +
      '<rect class="s-wall" x="0" y="0" width="600" height="400" stroke="none"/>' +
      '<rect class="s-floor" x="0" y="338" width="600" height="62" stroke="none"/><path d="M0 338H600" fill="none"/>' +
      // window with the city and a rooftop
      '<rect x="392" y="228" width="191" height="14" rx="3" fill="#e2d8c2"/>' +
      '<rect class="s-sky" x="400" y="30" width="175" height="198" rx="6"/>' +
      '<g stroke-width="2.5"><rect class="s-bld" x="408" y="140" width="42" height="70"/><rect class="s-bld" x="454" y="108" width="34" height="102"/><rect class="s-bld" x="492" y="150" width="30" height="60"/><rect class="s-bld" x="526" y="122" width="42" height="88"/></g>' +
      '<g stroke="none" fill="#fffdf8" opacity=".8"><rect x="416" y="152" width="8" height="8"/><rect x="430" y="152" width="8" height="8"/><rect x="416" y="170" width="8" height="8"/><rect x="462" y="120" width="8" height="8"/><rect x="474" y="120" width="8" height="8"/><rect x="462" y="140" width="8" height="8"/><rect x="500" y="164" width="8" height="8"/><rect x="536" y="136" width="8" height="8"/><rect x="550" y="136" width="8" height="8"/><rect x="536" y="156" width="8" height="8"/></g>' +
      '<rect x="400" y="206" width="175" height="22" rx="3" fill="#8b86a8"/><path d="M400 214H575" fill="none" stroke-width="2"/>' +
      '<g class="s-night"><circle cx="437" cy="66" r="14" fill="#fff3a8"/><circle cx="445" cy="61" r="12" fill="#2f2a66" stroke="none"/><path d="M500 52l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM545 84l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff3a8" stroke-width="1.5"/></g>' +
      // table
      '<path d="M44 326V400M492 326V400" fill="none" stroke-width="9"/><path d="M44 326V400M492 326V400" fill="none" stroke="#b98a52" stroke-width="3"/>' +
      '<rect x="16" y="306" width="520" height="20" rx="4" fill="#d9a766"/><rect x="10" y="290" width="532" height="18" rx="5" fill="#f0c88a"/>' +
      // iPad stand
      '<path d="M271 276H311L321 290H261Z" fill="#8b86a8"/>' +
      // props
      '<g class="s-prop s-p2"><ellipse cx="478" cy="288" rx="36" ry="7" fill="#fffdf8"/><rect x="452" y="266" width="26" height="22" rx="3" fill="#f2c97a" transform="rotate(-8 465 277)"/><rect x="474" y="262" width="26" height="22" rx="3" fill="#f2c97a" transform="rotate(7 487 273)"/><path d="M460 273h.1M468 279h.1M482 268h.1M490 275h.1" fill="none" stroke-width="3.5"/></g>' +
      '<g class="s-prop s-p4"><ellipse cx="462" cy="280" rx="22" ry="9" fill="#e98aa8"/><rect x="480" y="276" width="46" height="9" rx="4" fill="#7d62b8"/><path d="M452 277h.1M460 281h.1M468 277h.1M456 284h.1M466 284h.1" fill="none" stroke-width="3"/></g>' +
      '<g class="s-prop s-p5"><path d="M486 250V232H500" fill="none" stroke="#2a2350" stroke-width="3"/><rect x="466" y="250" width="40" height="40" rx="4" fill="#ffb347"/><circle cx="486" cy="270" r="9" fill="#fffdf8"/><path d="M486 261v18M477 270h18" fill="none" stroke-width="2"/></g>' +
      '</g></svg>';
  }

  var html = '<div class="s-stage" id="s-stage" data-scene="1">' +
    '<div class="s-top"><div class="s-ttl"><span class="s-kick" id="s-kick"></span><h3 class="s-title" id="s-title" tabindex="-1"></h3></div>' +
    '<ol class="s-prog" id="s-prog" aria-hidden="true">' + SCENES.map(function () { return '<li></li>'; }).join('') + '</ol>' +
    '<div class="togs s-snd"><button type="button" class="tog" id="s-snd" role="switch" aria-checked="false"><span>Sound: Off</span><span class="track" aria-hidden="true"><span class="knob"></span></span></button></div></div>' +
    '<div class="s-left">' +
      '<div class="s-scene" aria-hidden="true">' + bgSvg() +
        '<img class="s-dibs" id="s-dibs" src="img/dibs/dibs.svg" alt="Dibs the pigeon">' +
        '<div class="s-wk" id="s-wk"><img class="wk-p" src="img/wacker/wacker.svg" alt="Wacker the falcon"><img class="wk-f" src="img/wacker/wacker-fly.svg" alt="Wacker the falcon, flying"></div>' +
        '<div class="s-ipad"><div class="s-screen"><div class="s-tiles" id="s-tiles">' + TILES.map(function (t) {
          return '<div class="s-tile k-' + t[1] + ' off"><img src="img/symbols/' + t[0] + '.svg" alt=""><span>' + t[0] + '</span></div>';
        }).join('') + '</div></div><div class="s-hand" id="s-hand">' + HAND + '</div></div>' +
        '<div class="s-conf" id="s-conf"></div>' +
      '</div>' +
      '<div class="s-says"><div class="s-bub dibs"><span class="s-who">Dibs</span><span id="s-dibs-t"></span></div>' +
      '<div class="s-bub wk"><span class="s-who">Wacker</span><span id="s-wk-t"></span></div></div>' +
      '<p class="s-cap" id="s-cap"></p>' +
    '</div>' +
    '<div class="s-right">' +
      '<div class="s-q" id="s-qbox"><p class="s-qtext" id="s-q"></p><div class="s-choices" id="s-choices" role="group" aria-labelledby="s-q"></div></div>' +
      '<div class="s-nav"><button type="button" class="btn" id="s-back">Back</button><button type="button" class="btn solid" id="s-next" hidden>Next</button><button type="button" class="btn s-over" id="s-over">Start over</button></div>' +
      '<div class="s-end" id="s-end" hidden>' +
        '<p class="s-endlead">Your first day card is ready.</p>' +
        '<div class="sticky yellow s-card" id="s-card"><span class="tape"></span><h3>Your first day</h3><ol>' + LESSONS.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ol><p class="s-from">From Dibs’s First Day, a free story by V.O.I.C.E.</p></div>' +
        '<div class="s-endbtns"><button type="button" class="btn" id="s-print">Print this card</button><a class="btn solid" href="#step-1" id="s-go">Next: put V.O.I.C.E. on the iPad</a></div>' +
        '<p class="s-endnote">This is a made-up story. Every child is different. If your child has a speech-language pathologist or BCBA, ask them which words to show next.</p>' +
      '</div>' +
    '</div>' +
    '<div class="sr" id="s-live" role="status" aria-live="polite" aria-atomic="true"></div>' +
  '</div>';
  mount.innerHTML = html;
  if (staticBox) staticBox.hidden = true;

  function $(id) { return document.getElementById(id); }
  var stage = $('s-stage'), live = $('s-live'), tiles = Array.prototype.slice.call($('s-tiles').children), hand = $('s-hand'),
    dibs = $('s-dibs'), wk = $('s-wk'), conf = $('s-conf'), choices = $('s-choices'),
    back = $('s-back'), next = $('s-next'), over = $('s-over'), sndBtn = $('s-snd'), progLi = $('s-prog').children;

  // ---------- State ----------
  var cur = 0, st = [], timers = [];
  function fresh() { st = SCENES.map(function (s) { return { wrong: [], done: false, d: s.dibs, w: s.wk, ok: false }; }); }
  fresh();
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  var liveT = 0;
  function announce(msg) { clearTimeout(liveT); liveT = setTimeout(function () { live.textContent = msg; }, 30); }

  // ---------- Small effects ----------
  function lightAll(on) { tiles.forEach(function (t) { t.classList.toggle('off', !on); }); }
  function glow(i) { var t = tiles[i]; t.classList.remove('glow'); void t.offsetWidth; t.classList.add('glow'); }
  function unglow() { tiles.forEach(function (t) { t.classList.remove('glow'); }); }
  function showHand(i, who) {
    hand.className = 's-hand at' + i + ' ' + (who === 'kid' ? 'kid' : 'adult');
    void hand.offsetWidth; hand.classList.add('on');
  }
  function hideHand() { hand.classList.remove('on'); }
  // One tap on tile i: the hand arrives, the tile glows, the word is said (with Sound on).
  function tap(i, who) {
    showHand(i, who);
    later(function () { glow(i); wordSay(TILES[i][0]); }, reduced() ? 0 : 260);
    later(function () { hideHand(); unglow(); }, 1000);
  }
  function hop() {
    dibs.classList.remove('s-hop'); void dibs.offsetWidth; dibs.classList.add('s-hop');
    later(function () { dibs.classList.remove('s-hop'); }, 700);
  }
  function confetti() {
    conf.innerHTML = '';
    if (reduced()) return;
    var h = '';
    for (var q = 0; q < 30; q++) h += '<i style="left:' + ((q * 37 + 5) % 100) + '%;background:' + CONF[q % 8] + ';animation-delay:' + ((q % 7) * 0.07).toFixed(2) + 's"></i>';
    conf.innerHTML = h;
    later(function () { conf.innerHTML = ''; }, 2800);
  }
  function resetCast() {
    unglow(); hideHand(); conf.innerHTML = '';
    wk.className = 's-wk'; dibs.classList.remove('s-hop');
  }

  // ---------- Drawing a scene ----------
  function optHtml(sc, s, i) {
    var o = sc.opts[i], isNo = s.wrong.indexOf(i) >= 0, isYes = s.done && o.ok;
    var cls = 'pchip s-opt' + (isNo ? ' no' : '') + (isYes ? ' yes' : '') + (s.done && !isYes && !isNo ? ' lock' : '');
    var tag = isNo ? '<span class="s-tag">Not this one</span>' : (isYes ? CHECK + '<span class="s-tag">Yes</span>' : '');
    return '<button type="button" class="' + cls + '" data-i="' + i + '"' + (isNo || s.done ? ' aria-disabled="true"' : '') + '><span class="s-ot">' + esc(o.t) + '</span>' + tag + '</button>';
  }
  function drawBubbles() {
    var s = st[cur];
    $('s-dibs-t').innerHTML = (s.ok ? CHECK : '') + esc(s.d);
    $('s-wk-t').textContent = s.w;
  }
  function drawChoices() {
    var sc = SCENES[cur], s = st[cur];
    if (sc.end) return;
    choices.innerHTML = sc.opts.map(function (o, i) { return optHtml(sc, s, i); }).join('');
  }
  function draw() {
    var sc = SCENES[cur], s = st[cur];
    stage.setAttribute('data-scene', String(cur + 1));
    $('s-kick').textContent = 'Scene ' + (cur + 1) + ' of ' + N;
    $('s-title').textContent = sc.title;
    for (var i = 0; i < progLi.length; i++) progLi[i].className = i < cur ? 'past' : (i === cur ? 'now' : '');
    $('s-cap').textContent = sc.nar;
    drawBubbles();
    $('s-qbox').hidden = !!sc.end;
    $('s-end').hidden = !sc.end;
    if (!sc.end) { $('s-q').textContent = sc.q; drawChoices(); }
    back.disabled = cur === 0;
    next.hidden = !(s.done && !sc.end);
    lightAll(st[0].done);
  }

  // ---------- Moving between scenes ----------
  function enter(i, byUser) {
    clearTimers(); stopSpeech(); resetCast();
    cur = i; draw();
    var sc = SCENES[cur], s = st[cur], rm = reduced();
    var wait = 0;
    if (sc.enterTap) {
      for (var k = 0; k < sc.enterTap.times; k++) (function (k) {
        later(function () { tap(sc.enterTap.tile, 'kid'); }, 500 + k * 750);
      })(k);
      wait = 500 + sc.enterTap.times * 750 + 300;
    }
    var msg = 'Scene ' + (cur + 1) + ' of ' + N + ', ' + sc.title + '. ' + sc.nar + ' Wacker says: ' + s.w + ' Dibs says: ' + s.d;
    if (sc.end) {
      msg += ' Wacker flies off the roof. Your first day card is below the story. Choose Print this card, or choose Next to put V.O.I.C.E. on the iPad.';
      later(function () { hop(); confetti(); fanfare(); }, 400);
      later(function () {
        if (rm) { wk.className = 's-wk gone'; return; }
        wk.className = 's-wk fly'; whoosh();
      }, 3200);
      if (byUser) later(function () { wackerSay(sc.wk); dibsSay(sc.dibs, true); }, 300);
    } else {
      msg += ' Question: ' + sc.q + ' ' + sc.opts.map(function (o, j) {
        var n = j + 1; return 'Choice ' + n + ': ' + o.t + (s.wrong.indexOf(j) >= 0 ? ' (not this one)' : '') + (s.done && o.ok ? ' (the right choice)' : '');
      }).join(' ');
      if (s.done) msg += ' Choose Next to go on.';
      if (byUser) later(function () { wackerSay(s.w); }, wait);
    }
    if (byUser) {
      announce(msg);
      var h = $('s-title'); h.focus({ preventScroll: true });
      var r = stage.getBoundingClientRect();
      if (r.top < 40 || r.top > window.innerHeight * 0.6) stage.scrollIntoView({ block: 'start' });
    } else {
      live.textContent = '';
    }
  }

  function pick(i) {
    var sc = SCENES[cur], s = st[cur], o = sc.opts[i];
    if (s.done || s.wrong.indexOf(i) >= 0) return;
    if (!o.ok) {
      s.wrong.push(i); s.ok = false; s.d = 'Not quite… ' + o.why;
      drawChoices(); drawBubbles();
      var btn = choices.querySelector('[data-i="' + i + '"]'); if (btn) btn.focus({ preventScroll: true });
      dibsSay(s.d);
      announce('Not this one. Dibs says: ' + s.d + ' Pick another choice.');
      return;
    }
    s.done = true; s.ok = true; s.d = o.why + (o.after ? ' ' + o.after : '');
    if (sc.wk2) s.w = sc.wk2;
    drawChoices(); drawBubbles(); next.hidden = false;
    hop();
    if (cur === 0) {
      // The six tiles light up one by one.
      if (reduced()) lightAll(true);
      else tiles.forEach(function (t, k) { later(function () { t.classList.remove('off'); }, 250 + k * 280); });
    }
    if (typeof o.tap === 'number') tap(o.tap, o.who);
    // Say the word first (it cancels any earlier speech), then Dibs, then Wacker's grumble.
    if (typeof o.tap === 'number') later(function () { dibsSay(s.d, true); if (sc.wk2) wackerSay(sc.wk2, true); }, 700);
    else { dibsSay(s.d); if (sc.wk2) wackerSay(sc.wk2, true); }
    announce('Yes! Dibs says: ' + s.d + (sc.wk2 ? ' Wacker grumbles: ' + sc.wk2 : '') + ' Choose Next to go on.');
    next.focus();
  }

  // ---------- Controls ----------
  choices.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.s-opt') : null; if (!b) return;
    pick(Number(b.getAttribute('data-i')));
  });
  next.addEventListener('click', function () { if (cur < N - 1) enter(cur + 1, true); });
  back.addEventListener('click', function () { if (cur > 0) enter(cur - 1, true); });
  over.addEventListener('click', function () { fresh(); enter(0, true); });
  sndBtn.addEventListener('click', function () {
    snd = !snd; sndBtn.setAttribute('aria-checked', String(snd)); sndBtn.firstChild.textContent = 'Sound: ' + (snd ? 'On' : 'Off');
    if (!snd) stopSpeech();
  });
  $('s-print').addEventListener('click', function () { try { window.print(); } catch (e) {} });
  // "Skip to the setup steps" and the Next button: step 1 may be hidden by the steps list, so ask it to show step 1.
  Array.prototype.forEach.call(sec.querySelectorAll('a[href="#step-1"]'), function (a) {
    a.addEventListener('click', function (e) {
      var s1 = document.getElementById('step-1'), d1 = document.querySelector('#stepnav .dot');
      if (s1 && s1.hidden && d1) { e.preventDefault(); d1.click(); }
    });
  });

  enter(0, false);
})();
