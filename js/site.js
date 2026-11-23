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
  var NAV = [['get-started.html', 'Get started'], ['features.html', 'Features'], ['videos.html', 'Videos and guides'], ['faq.html', 'Questions'], ['games.html', 'Practice games'], ['clinicians.html', 'For clinicians'], ['privacy.html', 'Privacy'], ['about.html', 'About']];
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
  var LOGO = '<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M6 4h24a4 4 0 0 1 4 4v15a4 4 0 0 1-4 4H15l-7 6v-6H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" fill="currentColor"/><path d="M12 10l6 11 6-11" stroke="var(--bg)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var bar = document.getElementById('site-bar');
  if (bar) {
    var links = NAV.map(function (n) {
      return '<a class="nav" href="' + ROOT + n[0] + '"' + (n[0] === here ? ' aria-current="page"' : '') + '>' + n[1] + '</a>';
    }).join('');
    bar.className = 'bar';
    bar.innerHTML = '<nav class="wrap" aria-label="Main">' +
      '<a class="logo" href="' + (ROOT || 'index.html') + '"' + (here === 'index.html' ? ' aria-label="V.O.I.C.E. (say hello)"' : ' aria-label="V.O.I.C.E. home"') + '>' + LOGO + 'V.O.I.C.E.</a>' +
      '<div class="links">' + links + '<span id="bar-egg"></span><a class="go" href="' + esc(APP) + '">Open V.O.I.C.E.</a></div></nav>';
    var logo = bar.querySelector('.logo');
    if (here === 'index.html') logo.addEventListener('click', function (e) {
      e.preventDefault(); say('hello');
      logo.classList.remove('boing'); void logo.offsetWidth; logo.classList.add('boing');
    });
  }
  var foot = document.getElementById('site-foot');
  if (foot) {
    var X = ' rel="noopener noreferrer"';
    foot.innerHTML = '<div class="wrap cols">' +
      '<div><strong>V.O.I.C.E.</strong> · Variable Output for Individualized Communication and Expression · Free AAC by Richard Wawrzonkowski, M.S., LBA, BCBA' +
      (C.lbaState ? '<br>Licensed Behavior Analyst in ' + esc(C.lbaState) + (C.lbaLicense ? ', license no. ' + esc(C.lbaLicense) : '') + '.' : '') +
      '<br>No ads, no tracking, no cookies. <a href="' + ROOT + 'privacy.html">Privacy</a> · <a href="' + ROOT + 'about.html#whats-new">What’s new</a>' +
      (C.facebookUrl ? ' · <a href="' + esc(C.facebookUrl) + '"' + X + '>V.O.I.C.E. on Facebook</a>' : '') +
      '<br>© 2026 Richard Wawrzonkowski. V.O.I.C.E. and this site are provided as is, without warranty. <span id="foot-egg"></span></div>' +
      '<div><strong>Credits</strong><br>Core vocabulary: Universal Core, Center for Literacy and Disability Studies, UNC-Chapel Hill (<a href="https://project-core.com"' + X + '>Project Core</a>), <a href="https://creativecommons.org/licenses/by-sa/4.0/"' + X + '>CC BY-SA 4.0</a>.' +
      '<br>Symbols: <a href="https://mulberrysymbols.org"' + X + '>Mulberry Symbols</a> by Steve Lee, <a href="https://creativecommons.org/licenses/by-sa/4.0/"' + X + '>CC BY-SA 4.0</a>.' +
      '<br>All emojis designed by <a href="https://openmoji.org/"' + X + '>OpenMoji</a> – the open-source emoji and icon project. License: <a href="https://creativecommons.org/licenses/by-sa/4.0/"' + X + '>CC BY-SA 4.0</a>.' +
      '<br>Fonts: Lexend, Atkinson Hyperlegible and OpenDyslexic, all under the SIL Open Font License (OpenDyslexic is used unmodified; its Reserved Font Name is kept).' +
      '<br>Dibs the pigeon, V.O.I.C.E.’s mascot, and Wacker the falcon are original drawings.' +
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
