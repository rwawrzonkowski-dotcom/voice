// Shared by every page: top bar, footer, speech, settings from config.js, copy-link buttons, hidden words.
// Nothing here talks to a server. The only thing saved is the list of hidden words found, in this browser.
(function () {
  'use strict';
  var RAW = window.VOICE_SITE || {};
  // Only accept safe values from config.js: https links and plain email addresses.
  function safeUrl(u) { return /^https:\/\/[^\s"'<>]+$/i.test(u || '') ? u : ''; }
  function safeEmail(e) { return /^[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}$/i.test(e || '') ? e : ''; }
  var C = { appUrl: safeUrl(RAW.appUrl), donateUrl: safeUrl(RAW.donateUrl), contactEmail: safeEmail(RAW.contactEmail),
    lbaState: String(RAW.lbaState || ''), lbaLicense: String(RAW.lbaLicense || ''),
    // Facebook page: a plain link only (no Facebook scripts or widgets), and only to facebook.com.
    facebookUrl: /^https:\/\/(www\.)?facebook\.com\/[^\s"'<>]+$/i.test(RAW.facebookUrl || '') ? RAW.facebookUrl : '' };
  var APP = C.appUrl || 'https://rwawrzonkowski-dotcom.github.io/AAC-App/';
  var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (here.indexOf('.html') < 0) here = 'index.html';
  // Only the page-not-found page sets data-root ("/voice/"): it can be served at any depth, so its links start from the site root.
  var ROOT = (document.body && document.body.getAttribute('data-root')) || '';
  if (ROOT) here = '404.html';
  // Menu: Get started, Features, Learn (a group of three pages), For clinicians, then the Open button.
  // About and Privacy live in the footer. The third value names the little drawing beside each item.
  var NAV_A = [['get-started.html', 'Get started', 'start'], ['features.html', 'Features', 'features']];
  var LEARN = [['videos.html', 'Videos and guides', 'film'], ['faq.html', 'Questions', 'ask'], ['games.html', 'Practice games', 'maze']];
  var NAV_B = [['clinicians.html', 'For clinicians', 'clip']];
  // One hidden sentence per page.
  var SENTENCES = {
    'index.html': 'I want to go play',
    'get-started.html': 'you can do it',
    'features.html': 'I can do that',
    'clinicians.html': 'what do you like',
    'privacy.html': 'no not that',
    'about.html': 'who can help',
    'faq.html': 'what do you want',
    'games.html': 'I like that'
  };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // Speech uses only voices that run on the visitor's own device, so no words are sent anywhere.
  // Some browsers (for example Chrome on a computer) also list cloud voices; those are skipped.
  function pickVoice(s) {
    var all = (s.getVoices && s.getVoices()) || [];
    if (!all.length) return undefined;              // list not ready: the device's default voice is used
    var local = all.filter(function (v) { return v.localService; });
    if (!local.length) return null;                 // only cloud voices: stay silent
    var en = local.filter(function (v) { return /^en([-_]|$)/i.test(v.lang || ''); });
    var us = en.filter(function (v) { return /^en[-_]US/i.test(v.lang || ''); });
    var dflt = function (list) { return list.filter(function (v) { return v.default; })[0]; };
    return dflt(us) || us[0] || dflt(en) || en[0] || dflt(local) || local[0];
  }
  function say(text) {
    // Like V.O.I.C.E., speak the word I from a lowercase i, so voices say "eye" and not "capital I".
    if (typeof text === 'string' && text.trim() === 'I') text = 'i';
    try {
      var s = window.speechSynthesis; if (!s) return;
      var v = pickVoice(s);
      if (v === null) return;
      s.cancel();
      var u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.pitch = 1.3;
      if (v) { u.voice = v; u.lang = v.lang || 'en-US'; }
      s.speak(u);
    } catch (e) {}
  }
  try { if (window.speechSynthesis) window.speechSynthesis.getVoices(); } catch (e) {}
  window.VOICE_SAY = say;

  // ----- Top bar and footer -----
  var LOGO = '<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false"><circle cx="100" cy="100" r="90" fill="var(--bg)" stroke="currentColor" stroke-width="12"/><g transform="translate(100 100) rotate(-45) scale(1.42) translate(-50 -20)"><g fill="currentColor"><path d="M0 3 L24 12 L24 28 L0 37 Z"/><ellipse cx="46" cy="20" rx="25" ry="14.5"/><circle cx="75" cy="20" r="9.5"/><path d="M83 15.5 L95 20 L83 24.5 Z"/></g><path d="M60 11.5 Q47 12.5 35 20 Q47 27.5 60 28.5" stroke="var(--lgwing)" stroke-width="4.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
  // Tiny drawings for the menu (Dibs's style: ink outline, flat fills, rounded joins). Decorative, so hidden from screen readers.
  var MI_OPEN = '<svg class="mi" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><rect width="40" height="40" rx="9" fill="#fffdf8"/><g stroke="#2a2350" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">';
  var ICONS = {
    // Dibs beside a small iPad
    start: '<rect x="21" y="7" width="15" height="24" rx="3" fill="#fffdf8"/><rect x="24" y="11" width="4.5" height="4.5" rx="1" fill="#fff3a8" stroke-width="1.4"/><rect x="29.5" y="11" width="4.5" height="4.5" rx="1" fill="#c9edc2" stroke-width="1.4"/><rect x="24" y="17.5" width="4.5" height="4.5" rx="1" fill="#f9cddd" stroke-width="1.4"/><rect x="29.5" y="17.5" width="4.5" height="4.5" rx="1" fill="#c6e0f7" stroke-width="1.4"/><path d="M9 31v3.5M15 31v3.5" fill="none" stroke="#e58a9c"/><ellipse cx="12" cy="26" rx="8" ry="7" fill="#b9bed1"/><circle cx="11.5" cy="15" r="7" fill="#a2a9c0"/><circle cx="9.5" cy="14" r="2.6" fill="#f2903f" stroke-width="1.4"/><circle cx="9.5" cy="14" r="1" fill="#2a2350" stroke="none"/><path d="M15.5 14l4 2.5-4 2z" fill="#4b4a5e"/>',
    // A little board of four app-colored tiles
    features: '<rect x="4" y="6" width="32" height="28" rx="4" fill="#fffdf8"/><rect x="8" y="10" width="11" height="9" rx="2" fill="#fff3a8"/><rect x="21" y="10" width="11" height="9" rx="2" fill="#c9edc2"/><rect x="8" y="21" width="11" height="9" rx="2" fill="#c6e0f7"/><rect x="21" y="21" width="11" height="9" rx="2" fill="#f9cddd"/>',
    // A film strip frame
    film: '<rect x="3" y="8" width="34" height="24" rx="3" fill="#e0d0f3"/><rect x="9" y="13" width="22" height="14" rx="1.5" fill="#fffdf8"/><path d="M18 16l6 4-6 4z" fill="#c9edc2"/><path d="M6 11.5v1.5M6 18v1.5M6 24.5v1.5M34 11.5v1.5M34 18v1.5M34 24.5v1.5" fill="none" stroke-width="2.4"/>',
    // A speech bubble with a question mark
    ask: '<path d="M7 6h26a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H19l-7 6v-6H7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z" fill="#e0d0f3"/><path d="M15.5 13.5a4.5 4.5 0 1 1 6.4 4.1c-1.3.7-1.9 1.4-1.9 2.9" fill="none"/><circle cx="20" cy="24.2" r="1.2" fill="#2a2350" stroke="none"/>',
    // A tiny maze corner with a hot dog stand awning
    maze: '<rect x="4" y="5" width="32" height="30" rx="3" fill="#c6e0f7"/><path d="M4 15h14v8M18 15V9M26 9v10h10M11 23v12" fill="none" stroke-width="2.6"/><path d="M22 25h14l1.5 4.5h-17z" fill="#f9cddd"/><path d="M26.7 25l-.6 4.5M31.3 25l.6 4.5" fill="none" stroke-width="1.6"/><rect x="23" y="29.5" width="12" height="5.5" fill="#fddcb2"/>',
    // A clipboard with a data sheet
    clip: '<rect x="7" y="6" width="26" height="30" rx="3" fill="#fddcb2"/><rect x="11" y="11" width="18" height="21" rx="1.5" fill="#fffdf8"/><rect x="14" y="3" width="12" height="7" rx="2" fill="#d9d4ea"/><path d="M14 15h12M14 19h7" fill="none" stroke-width="1.6"/><path d="M14 29l4-4 3.5 2 5.5-6" fill="none" stroke-width="1.8"/>'
  };
  function mi(k) { return ICONS[k] ? MI_OPEN + ICONS[k] + '</g></svg>' : ''; }
  var learnHere = LEARN.some(function (n) { return n[0] === here; });
  function link(n, withIcon) {
    return '<a class="nav" href="' + ROOT + n[0] + '"' + (n[0] === here ? ' aria-current="page"' : '') + '>' + (withIcon ? mi(n[2]) : '') + '<span>' + n[1] + '</span></a>';
  }
  var bar = document.getElementById('site-bar');
  if (bar) {
    var links = NAV_A.map(function (n) { return link(n, true); }).join('') +
      '<div class="grp"><button type="button" class="nav learn" id="learn-btn" aria-expanded="false" aria-controls="learn-panel"' + (learnHere ? ' aria-current="true"' : '') + '><span>Learn</span><i class="caret" aria-hidden="true"></i></button>' +
      '<div class="lpanel" id="learn-panel" hidden>' + LEARN.map(function (n) { return link(n, true); }).join('') + '</div></div>' +
      NAV_B.map(function (n) { return link(n, true); }).join('');
    bar.className = 'bar';
    bar.innerHTML = '<nav class="wrap" aria-label="Main">' +
      '<a class="logo" href="' + (ROOT || 'index.html') + '"' + (here === 'index.html' ? ' aria-label="V.O.I.C.E. (say hello)"' : ' aria-label="V.O.I.C.E. home"') + '>' + LOGO + '<span class="lt">V.O.I.C.E.</span></a>' +
      '<div class="links" id="site-menu">' + links + '</div><span id="bar-egg"></span>' +
      '<a class="go" href="' + esc(APP) + '">Open V.O.I.C.E.</a>' +
      '<button type="button" class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="site-menu">Menu</button></nav>';
    var logo = bar.querySelector('.logo');
    if (here === 'index.html') logo.addEventListener('click', function (e) {
      e.preventDefault(); say('hello');
      logo.classList.remove('boing'); void logo.offsetWidth; logo.classList.add('boing');
    });

    // Learn is a disclosure button. On a computer it opens a small panel on click; on a phone the Menu button opens
    // a full-width panel and Learn's three pages sit indented inside it. Escape closes and returns focus to the button.
    var nav = bar.querySelector('nav'), menu = document.getElementById('site-menu'), mbtn = document.getElementById('menu-btn');
    var lbtn = document.getElementById('learn-btn'), lpan = document.getElementById('learn-panel'), grp = lbtn.parentNode, egg = document.getElementById('bar-egg');
    var mq = window.matchMedia ? window.matchMedia('(max-width: 820px)') : { matches: false };
    function phone() { return !!mq.matches; }
    function setLearn(open) { lbtn.setAttribute('aria-expanded', open ? 'true' : 'false'); lpan.hidden = !open; }
    function setMenu(open) {
      mbtn.setAttribute('aria-expanded', open ? 'true' : 'false'); mbtn.firstChild.nodeValue = open ? 'Close' : 'Menu';
      bar.classList.toggle('menu-open', open);
      if (open) setLearn(true); else setLearn(false);
    }
    function place() {
      // Keep the keyboard order the same as the look: on a phone the panel follows the Menu button.
      if (phone()) nav.appendChild(menu); else nav.insertBefore(menu, egg);
      setMenu(false);
    }
    lbtn.addEventListener('click', function () { setLearn(lbtn.getAttribute('aria-expanded') !== 'true'); });
    mbtn.addEventListener('click', function () { setMenu(mbtn.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      var learnOpen = lbtn.getAttribute('aria-expanded') === 'true', menuOpen = mbtn.getAttribute('aria-expanded') === 'true';
      if (learnOpen && (!phone() || grp.contains(document.activeElement))) { setLearn(false); lbtn.focus(); }
      else if (phone() && menuOpen) { setMenu(false); mbtn.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (phone()) { if (bar.classList.contains('menu-open') && !bar.contains(e.target)) setMenu(false); }
      else if (lbtn.getAttribute('aria-expanded') === 'true' && !grp.contains(e.target)) setLearn(false);
    });
    grp.addEventListener('focusout', function (e) {
      if (!phone() && e.relatedTarget && !grp.contains(e.relatedTarget)) setLearn(false);
    });
    if (mq.addEventListener) mq.addEventListener('change', place); else if (mq.addListener) mq.addListener(place);
    place();
  }
  var foot = document.getElementById('site-foot');
  if (foot) {
    var X = ' rel="noopener noreferrer"';
    foot.innerHTML = '<div class="wrap cols">' +
      '<div><strong>V.O.I.C.E.</strong> stands for Variable Output for Individualized Communication and Expression.<br>Free AAC by Richard Wawrzonkowski, M.S., LBA, BCBA' +
      (C.lbaState ? '<br>Licensed Behavior Analyst in ' + esc(C.lbaState) + (C.lbaLicense ? ', license no. ' + esc(C.lbaLicense) : '') + '.' : '') +
      '<br>No ads, no tracking, no cookies.<br><a href="' + ROOT + 'about.html"' + (here === 'about.html' ? ' aria-current="page"' : '') + '>About</a><br><a href="' + ROOT + 'privacy.html"' + (here === 'privacy.html' ? ' aria-current="page"' : '') + '>Privacy</a><br><a href="' + ROOT + 'about.html#whats-new">What’s new</a>' +
      (C.facebookUrl ? '<br><a href="' + esc(C.facebookUrl) + '"' + X + '>V.O.I.C.E. on Facebook</a>' : '') +
      '<br>© 2026 Richard Wawrzonkowski. V.O.I.C.E. and this site are provided as is, without warranty. <span id="foot-egg"></span></div>' +
      '<div><strong>Credits</strong><br>Core vocabulary: Universal Core, Center for Literacy and Disability Studies, UNC-Chapel Hill (<a href="https://project-core.com"' + X + '>Project Core</a>), <a href="https://creativecommons.org/licenses/by-sa/4.0/"' + X + '>CC BY-SA 4.0</a>.' +
      '<br>Symbols: <a href="https://mulberrysymbols.org"' + X + '>Mulberry Symbols</a> by Steve Lee, <a href="https://creativecommons.org/licenses/by-sa/4.0/"' + X + '>CC BY-SA 4.0</a>.' +
      '<br>All emojis designed by <a href="https://openmoji.org/"' + X + '>OpenMoji</a> – the open-source emoji and icon project. License: <a href="https://creativecommons.org/licenses/by-sa/4.0/"' + X + '>CC BY-SA 4.0</a>.' +
      '<br>Fonts: Lexend, Atkinson Hyperlegible and OpenDyslexic, all under the SIL Open Font License (OpenDyslexic is used unmodified; its Reserved Font Name is kept).' +
      '<br>Dibs the pigeon, V.O.I.C.E.’s mascot, Wacker the falcon and the V.O.I.C.E. logo are original drawings, © 2026 Richard Wawrzonkowski, all rights reserved.' +
      '<br>This site shows some symbols dimmed or recolored. <a href="' + ROOT + 'about.html#credits">All credits and licenses</a></div>' +
      '<div><strong>Please note</strong><br>V.O.I.C.E. supports, but doesn’t replace, an AAC assessment by a speech-language pathologist or team. It is not speech-language therapy. Using this site doesn’t make you a client.' +
      '<br>Not affiliated with or endorsed by Apple, Project Core, Mulberry Symbols or OpenMoji. iPad and Safari are trademarks of Apple Inc.</div></div>';
  }

  // ----- Settings from config.js -----
  $all('a[data-app]').forEach(function (a) { a.href = APP; });
  $all('[data-app-text]').forEach(function (el) { el.textContent = APP.replace(/^https?:\/\//, '').replace(/\/$/, ''); });
  $all('a[data-sms]').forEach(function (a) { a.href = 'sms:?&body=' + encodeURIComponent('Open V.O.I.C.E. on the iPad: ' + APP); });
  $all('[data-href]').forEach(function (a) {
    var key = a.getAttribute('data-href'), v = C[key];
    if (!v) return;
    a.href = (key === 'contactEmail' ? 'mailto:' : '') + v;
    if (key !== 'contactEmail') a.rel = 'noopener noreferrer';
    a.hidden = false;
    $all('[data-need="' + key + '"]').forEach(function (n) { n.hidden = true; });
  });
  $all('[data-text]').forEach(function (el) { var v = C[el.getAttribute('data-text')]; if (v) el.textContent = v; });

  // ----- Questions page: a link to #a-question opens that answer -----
  function openFromHash() {
    var id = decodeURIComponent((location.hash || '').slice(1));
    var d = id && document.getElementById(id);
    if (d && d.tagName === 'DETAILS') { d.open = true; d.scrollIntoView(); }
  }
  openFromHash(); window.addEventListener('hashchange', openFromHash);

  // ----- Copy the app link -----
  $all('button[data-copy]').forEach(function (b) {
    var label = b.textContent;
    b.addEventListener('click', function () {
      var done = function (ok) {
        b.textContent = ok ? 'Link copied' : 'Press and hold the link to copy it';
        setTimeout(function () { b.textContent = label; }, 2200);
      };
      try { navigator.clipboard.writeText(APP).then(function () { done(true); }, function () { done(false); }); }
      catch (e) { done(false); }
    });
  });

  // ----- Hidden words -----
  var sentence = SENTENCES[here];
  var eggs = $all('button.egg');
  if (sentence && eggs.length) {
    var words = sentence.split(' ');
    var KEY = 'voice-site-hidden-words';
    var store = {};
    try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
    var found = {};
    (store[here] || []).forEach(function (w) { if (words.indexOf(w) >= 0) found[w] = true; });
    var board = window.VOICE_BOARD || [];
    var trayClosed = false, tray = null;

    function save() {
      store[here] = words.filter(function (w) { return found[w]; });
      try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
    }
    function siteTotal() {
      var got = 0, all = 0;
      Object.keys(SENTENCES).forEach(function (p) {
        var ws = SENTENCES[p].split(' '); all += ws.length;
        (store[p] || []).forEach(function (w) { if (ws.indexOf(w) >= 0) got++; });
      });
      return got + ' of ' + all + ' across the site';
    }
    function drawTray() {
      var n = words.filter(function (w) { return found[w]; }).length;
      if (!n || trayClosed) { if (tray) { tray.remove(); tray = null; } document.body.classList.remove('has-tray'); return; }
      if (!tray) {
        tray = document.createElement('div'); tray.className = 'tray'; tray.setAttribute('role', 'status'); tray.setAttribute('aria-live', 'polite');
        document.body.appendChild(tray); document.body.classList.add('has-tray');
      }
      var all = n === words.length;
      tray.innerHTML = '<span>' + (all ? 'You found every word!' : 'Hidden words: ' + n + ' of ' + words.length) + '</span>' +
        words.map(function (w) { return '<span class="slot' + (found[w] ? ' got' : '') + '">' + (found[w] ? esc(w) : '?') + '</span>'; }).join('') +
        '<button type="button" class="sayit"' + (all ? '' : ' disabled') + '>Say it</button>' +
        '<span class="small" style="color:#d9d5ff">' + siteTotal() + '</span>' +
        '<button type="button" class="x" aria-label="Hide hidden words bar">×</button>';
      tray.querySelector('.sayit').addEventListener('click', function () { say(sentence); });
      tray.querySelector('.x').addEventListener('click', function () { trayClosed = true; drawTray(); });
    }
    eggs.forEach(function (b) {
      var w = b.getAttribute('data-egg');
      var row = board.filter(function (r) { return r[0].toLowerCase() === w.toLowerCase(); })[0];
      b.innerHTML = (row ? '<img src="img/symbols/' + row[4] + '" alt="">' : '') + '<b>' + esc(w) + '</b>';
      b.classList.add('e-' + (row ? row[2] : 'little'));
      b.setAttribute('aria-label', 'Hidden word: ' + w);
      if (found[w]) b.classList.add('found');
      b.hidden = false;
      b.addEventListener('click', function () {
        say(w);
        if (found[w]) return;
        found[w] = true; save(); b.classList.add('found');
        var p = document.createElement('span'); p.className = 'plus1'; p.textContent = '+1'; b.appendChild(p);
        setTimeout(function () { p.remove(); }, 1000);
        trayClosed = false; drawTray();
      });
    });
    // Eggs that live in the shared top bar or footer
    $all('[data-egg-slot]').forEach(function (b) {
      var slot = document.getElementById(b.getAttribute('data-egg-slot'));
      if (slot) slot.appendChild(b);
    });
    drawTray();
  }
})();
