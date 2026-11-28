/* DIBS Movie Maker: the editor screen. Shot strip, timeline, tool tabs, key editing and the export dialog.
   It builds its own panel and reuses photo mode's scene functions (App.*). ui.js is not loaded on this page. */
(function () {
  'use strict';
  var DP = window.DP, App = DP.app, MM = DP.movie, A = window.DIBS_ASSETS;
  var $ = function (id) { return document.getElementById(id); };
  var UI = App.ui = {};
  UI.ext = { act: {} };       // movie-quick.js adds the Quick tab here
  var S = function () { return App.state; };
  var FPS = MM.FPS;
  var COARSE = window.matchMedia && matchMedia('(pointer:coarse)').matches;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function svgData(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
  function isPhone() { return window.matchMedia('(max-width:820px)').matches; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function fmt(v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
  function secs(t) { return fmt(t, 2) + ' sec'; }
  /* drawn icons, in the same ink stroke as the photo mode tabs */
  var ICON = {
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    undo: '<path d="M9 4L4 9l5 5"/><path d="M4 9h10a6 6 0 0 1 0 12h-4"/>', redo: '<path d="M15 4l5 5-5 5"/><path d="M20 9H10a6 6 0 0 0 0 12h4"/>',
    quick: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    shot: '<rect x="3" y="9" width="18" height="11" rx="1.5"/><path d="M3 9l2.5-5 4 1.2L7 9M10 5.2l4 1.2L11.5 9M14.5 6.4L18.5 7.6 16 9"/>',
    item: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-4.2 3-6.5 7-6.5s7 2.3 7 6.5z"/>',
    camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.6"/><path d="M8 7l1.5-3h5L16 7"/>',
    look: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
    text: '<path d="M5 7V4.5h14V7M12 4.5V20M9 20h6"/>',
    sound: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/>',
    movie: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5"/>'
  };
  function svgi(id) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[id] + '</svg>'; }

  var tab = 'item', selKey = null, dirty = {}, lastUndoAt = 0, activeField = null;
  var content = $('mmContent'), panel = $('mmPanel');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;

  function selItem() { return App.sel ? App.findItem(App.sel) : null; }
  function itemName(it) {
    var n = DP.kindInfo(it.kind) ? DP.kindInfo(it.kind).name : it.kind, same = S().items.filter(function (o) { return o.kind === it.kind; });
    return same.length > 1 ? n + ' ' + (same.indexOf(it) + 1) : n;
  }
  function puppets() { return S().items.filter(function (i) { return DP.isPuppet(i.kind); }); }
  function undoBurst() { if (Date.now() - lastUndoAt > 900) { MM.pushUndo(); } lastUndoAt = Date.now(); }

  /* ---------- live values of every target (what the scene shows right now) ---------- */
  function live(target) {
    var d = MM.describe(target), st = S(), it, rg = App.rig.s;
    if (!d) return undefined;
    if (d.group === 'camera') {
      if (d.field === 'pos') return MM.camToPT(rg).pos;
      if (d.field === 'target') return MM.camToPT(rg).target;
      if (d.field === 'mm') return st.lens.mm;
      if (d.field === 'fstop') return st.lens.fnum;
      if (d.field === 'focus') return App.focusDistance();
      if (d.field === 'roll') return rg.roll || 0;
      if (d.field === 'exposure') return st.lens.exposure;
    } else if (d.group === 'item') {
      it = App.findItem(d.id); if (!it) return undefined;
      if (d.field === 'pos') return [it.x, it.z];
      if (d.field === 'rot') return it.yaw;
      if (d.field === 'height') return it.y;
      if (d.param) return it.pose ? it.pose[d.param] : 0;
    } else if (d.group === 'light' && d.field === 'warmth') return st.light.k;
    return undefined;
  }
  function markDirty(target) { dirty[target] = true; }
  /* an edit was made to a live value. If the playhead sits on a key of that target the key follows. */
  function edited(target) {
    markDirty(target);
    var shot = MM.cur(), tr = MM.getTrack(shot, target);
    if (!tr || !tr.keys.length) return;
    if (MM.keyAt(tr, MM.t) >= 0) { MM.setKey(shot, target, MM.t, live(target)); MM.touch(); renderTimeline(true); }
    else App.msg('Tap Set key to keep this change at ' + secs(MM.t) + '.', 2600);
  }

  /* ---------- top bar, transport ---------- */
  function buildTop() {
    $('mmPlatform').innerHTML = MM.PLATFORMS.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('');
    $('mmPlatform').addEventListener('change', function () { MM.setPlatform(this.value).then(refreshAll); });
    $('mmTitle').addEventListener('input', function () { MM.setTitle(this.value); });
    $('mmPlay').addEventListener('click', function () { MM.togglePlay(); });
    $('mmUndo').addEventListener('click', function () { UI.undo(); });
    $('mmRedo').addEventListener('click', function () { UI.redo(); });
    $('mmSetKey').addEventListener('click', function () { setKeyHere(); });
    $('mmExport').addEventListener('click', openExport);
    $('mmTools').addEventListener('click', function () { if (isOpen()) closeSheet(); else openSheet(); });
  }
  var lastTimeText = '';
  function updateTime() {
    var tot = MM.total(), cur = MM.absTime(), txt = MM.fmtTime(cur) + ' of ' + MM.fmtTime(tot);
    if (txt !== lastTimeText) { lastTimeText = txt; $('mmTime').innerHTML = MM.fmtTime(cur) + ' <span class="tot">of ' + MM.fmtTime(tot) + '</span>'; }
  }
  function updatePlay(playing) {
    var b = $('mmPlay');
    b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    $('mmPlayText').textContent = playing ? 'Pause' : 'Play';
    $('mmPlayIcon').setAttribute('d', playing ? 'M6 4h4v16H6zM14 4h4v16h-4z' : 'M7 4l13 8-13 8z');
    b.setAttribute('aria-pressed', playing ? 'true' : 'false');
  }
  function updateHistory() { $('mmUndo').disabled = !MM.canUndo(); $('mmRedo').disabled = !MM.canRedo(); }
  /* undo and redo bring the shot back with nothing picked, so remember what was picked (and which sheet was open) and give it back */
  UI.undo = function () { if (MM.canUndo()) { UI.wantSel = App.sel; UI.wantCtx = UI.ctxNow ? UI.ctxNow() : null; } return MM.undo(); };
  UI.redo = function () { if (MM.canRedo()) { UI.wantSel = App.sel; UI.wantCtx = UI.ctxNow ? UI.ctxNow() : null; } return MM.redo(); };

  /* ---------- shot strip ---------- */
  function renderShots() {
    var m = MM.movie, el = $('mmShots'); if (!m) return;
    var h = '<div class="shothead"><strong>Shot ' + (MM.shotIdx + 1) + ' of ' + m.shots.length + '</strong><span class="small">' + Math.round(MM.cur().duration * 10) / 10 + ' sec, movie ' + MM.fmtTime(MM.total()) + ' of 1:00</span></div><div class="shotrow" id="shotRow">';
    m.shots.forEach(function (sh, i) {
      h += '<button type="button" class="shot" data-i="' + i + '" aria-pressed="' + (i === MM.shotIdx) + '" aria-label="Shot ' + (i + 1) + ', ' + esc(sh.name) + ', ' + Math.round(sh.duration * 10) / 10 + ' seconds">' +
        (sh.thumb ? '<img alt="" draggable="false" src="' + sh.thumb + '">' : '<span class="noimg"></span>') + '<span class="num">' + (i + 1) + '</span><span class="dur">' + Math.round(sh.duration * 10) / 10 + ' sec</span></button>';
    });
    h += '<button type="button" class="shot add" data-add="1" aria-label="Add a shot"><span class="plus" aria-hidden="true">' + svgi('plus') + '</span><span class="dur">Add shot</span></button></div>';
    el.innerHTML = h;
  }
  function wireShots() {
    var el = $('mmShots'), drag = null;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button.shot'); if (!b || drag && drag.moved) return;
      if (b.getAttribute('data-add')) { openSheet('shot'); return; }
      MM.pause();
      MM.selectShot(parseInt(b.getAttribute('data-i'), 10));
    });
    // drag to reorder: a mouse drags at once, a finger presses and holds first
    el.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('button.shot'); if (!b || b.getAttribute('data-add')) return;
      drag = { i: parseInt(b.getAttribute('data-i'), 10), x: e.clientX, y: e.clientY, moved: false, armed: e.pointerType === 'mouse', pid: e.pointerId, b: b };
      if (!drag.armed) drag.timer = setTimeout(function () { if (drag) { drag.armed = true; b.classList.add('lift'); try { b.setPointerCapture(drag.pid); } catch (x) {} } }, 380);
    });
    el.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.pid) return;
      var dx = e.clientX - drag.x;
      if (!drag.armed) { if (Math.abs(dx) > 8 || Math.abs(e.clientY - drag.y) > 8) { clearTimeout(drag.timer); drag = null; } return; }
      if (Math.abs(dx) > 6) drag.moved = true;
      if (!drag.moved) return;
      drag.b.classList.add('lift');
      var tiles = Array.prototype.slice.call(el.querySelectorAll('button.shot:not(.add)')), over = -1;
      tiles.forEach(function (t, k) { var r = t.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right) over = k; });
      if (over >= 0 && over !== drag.i) {
        MM.moveShot(drag.i, over); drag.i = over; renderShots();
        drag.b = el.querySelector('button.shot[data-i="' + over + '"]'); if (drag.b) { drag.b.classList.add('lift'); try { drag.b.setPointerCapture(drag.pid); } catch (x) {} }
      }
    });
    function end() { if (!drag) return; clearTimeout(drag.timer); var m = drag.moved; if (drag.b) drag.b.classList.remove('lift'); setTimeout(function () { drag = null; }, 0); if (m) { renderShots(); renderTimeline(); } }
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  /* ---------- timeline ---------- */
  var FIELD_LABEL = { pos: 'Position', rot: 'Turn', height: 'Height', 'pose.preset': 'Pose', 'pose.head': 'Head', 'pose.wingA': 'Left wing', 'pose.wingB': 'Right wing', 'pose.lean': 'Lean', 'pose.bend': 'Bend', 'pose.hop': 'Hop', 'pose.look': 'Look', emote: 'Emote', bubble: 'Bubble', visible: 'Show or hide', wear: 'Costume' };
  var CAM_LABEL = { pos: 'Position', target: 'Aim', mm: 'Lens', fstop: 'F-stop', focus: 'Focus', roll: 'Tilt', exposure: 'Exposure' };
  function laneGroups(shot) {
    var groups = [], by = {};
    function grp(key, title, order) { if (!by[key]) { by[key] = { key: key, title: title, order: order, lanes: [] }; groups.push(by[key]); } return by[key]; }
    var items = S().items;
    shot.tracks.forEach(function (tr) {
      var d = MM.describe(tr.target); if (!d || !tr.keys.length) return;
      if (d.group === 'camera') grp('camera', 'Camera', 0).lanes.push({ tr: tr, label: CAM_LABEL[d.field] });
      else if (d.group === 'item') {
        var it = App.findItem(d.id); if (!it) return;
        grp('item:' + d.id, itemName(it), 1 + items.indexOf(it)).lanes.push({ tr: tr, label: FIELD_LABEL[d.field] || d.field });
      }
      else if (d.group === 'caption') grp('caption', 'Captions', 900).lanes.push({ tr: tr, label: 'Caption' });
      else grp('look', 'Light and look', 800).lanes.push({ tr: tr, label: d.group === 'light' ? (d.field === 'warmth' ? 'Warmth' : 'Light') : 'Filter' });
    });
    groups.sort(function (a, b) { return a.order - b.order; });
    return groups;
  }
  function keyTitle(tr, k) {
    var d = MM.describe(tr.target), v = k.v;
    if (d.field === 'emote') return v ? 'Emote ' + v.id : 'Emote off';
    if (d.field === 'bubble') return v ? 'Says: ' + v.text : 'Bubble off';
    if (d.field === 'visible') return v ? 'Show' : 'Hide';
    if (d.field === 'wear') return v ? 'Puts on ' + v.id : 'Takes off';
    if (d.field === 'caption') return v ? 'Caption: ' + v.text : 'Caption off';
    if (d.preset) return 'Pose ' + v;
    if (d.field === 'preset') return 'Light ' + v;
    if (d.field === 'filter') return 'Filter ' + (App.FILTERS[v] ? App.FILTERS[v].name : v);
    return Array.isArray(v) ? v.map(function (x) { return fmt(x, 2); }).join(', ') : fmt(v, 2);
  }
  var tlDur = 4;
  function renderTimeline(keep) {
    var shot = MM.cur(), el = $('mmTimeline'); if (!shot) return;
    var dur = tlDur = shot.duration, groups = laneGroups(shot);
    var prevScroll = keep && $('tlScroll') ? $('tlScroll').scrollTop : 0;
    var h = '<div class="tl"><div class="tl-ruler" id="tlRuler" aria-label="Timeline. Drag to move the playhead." role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="' + dur + '" aria-valuenow="' + fmt(MM.t, 2) + '">';
    var step = dur <= 6 ? 1 : dur <= 20 ? 2 : 5;
    for (var s = 0; s <= dur + 1e-6; s += step) h += '<span class="tick" style="left:' + (s / dur * 100) + '%">' + s + '</span>';
    h += '<span class="ph-head" id="phHead" aria-hidden="true"></span></div>';
    h += '<div class="tl-scroll" id="tlScroll"><div class="tl-in">';
    if (!groups.length) h += '<p class="tl-empty">No keys in this shot yet. Pick a character or the camera, change something, then tap Set key.</p>';
    groups.forEach(function (g) {
      h += '<div class="tl-group">' + esc(g.title) + '</div>';
      g.lanes.forEach(function (ln) {
        h += '<div class="tl-row"><span class="tl-lab">' + esc(ln.label) + '</span><div class="tl-lane" data-target="' + esc(ln.tr.target) + '">';
        ln.tr.keys.forEach(function (k, i) {
          var sel = selKey && selKey.target === ln.tr.target && Math.abs(selKey.t - k.t) < 0.5 / FPS;
          h += '<button type="button" class="tl-key' + (sel ? ' sel' : '') + (k.v === null || k.v === false ? ' off' : '') + (k.gen ? ' gen' : '') + '" data-target="' + esc(ln.tr.target) + '" data-t="' + k.t + '" style="left:' + (k.t / dur * 100) + '%" aria-label="' + esc(ln.label + ' key at ' + fmt(k.t, 2) + ' sec. ' + keyTitle(ln.tr, k)) + '" aria-pressed="' + sel + '"><i></i></button>';
        });
        h += '</div></div>';
      });
    });
    h += '<div class="tl-plane" aria-hidden="true"><span class="ph-line" id="phLine"></span></div></div></div></div>';
    el.innerHTML = h;
    if (keep) $('tlScroll').scrollTop = prevScroll;
    updatePlayhead();
  }
  function updatePlayhead() {
    var f = tlDur ? clamp(MM.t / tlDur, 0, 1) * 100 : 0, a = $('phHead'), b = $('phLine');
    if (a) a.style.left = f + '%';
    if (b) b.style.left = f + '%';
    var r = $('tlRuler'); if (r) r.setAttribute('aria-valuenow', fmt(MM.t, 2));
  }
  function wireTimeline() {
    var el = $('mmTimeline'), scrub = null, kdrag = null;
    function laneRect() {
      var r = $('tlRuler'); return r ? r.getBoundingClientRect() : null;
    }
    function frac(e) { var r = laneRect(); return r ? clamp((e.clientX - r.left) / r.width, 0, 1) : 0; }
    el.addEventListener('pointerdown', function (e) {
      var key = e.target.closest('.tl-key');
      if (key) {
        kdrag = { target: key.getAttribute('data-target'), t: parseFloat(key.getAttribute('data-t')), x: e.clientX, moved: false, pid: e.pointerId, el: key, idx: -1 };
        var tr = MM.getTrack(MM.cur(), kdrag.target); kdrag.idx = MM.keyAt(tr, kdrag.t);
        try { key.setPointerCapture(e.pointerId); } catch (x) {}
        e.preventDefault(); return;
      }
      if (e.target.closest('.tl-ruler') || e.target.closest('.tl-lane') || e.target.closest('.tl-plane')) {
        if (e.target.closest('.tl-key')) return;
        MM.pause();
        scrub = { pid: e.pointerId, target: e.target.closest('.tl-ruler') ? 'ruler' : 'lane' };
        try { el.setPointerCapture(e.pointerId); } catch (x) {}
        MM.seek(frac(e) * tlDur); e.preventDefault();
      }
    });
    el.addEventListener('pointermove', function (e) {
      if (kdrag && e.pointerId === kdrag.pid) {
        if (!kdrag.moved && Math.abs(e.clientX - kdrag.x) > 5) { kdrag.moved = true; MM.pushUndo(); }
        if (kdrag.moved) {
          var shot = MM.cur(), tr = MM.getTrack(shot, kdrag.target); if (!tr) return;
          var i = MM.keyAt(tr, kdrag.t);
          var ni = MM.moveKey(shot, kdrag.target, i, frac(e) * tlDur);
          kdrag.t = tr.keys[ni].t; selKey = { target: kdrag.target, t: kdrag.t };
          kdrag.el.style.left = (kdrag.t / tlDur * 100) + '%';
          kdrag.el.setAttribute('data-t', kdrag.t);
          MM.seek(kdrag.t); renderKeyBar();
        }
      } else if (scrub && e.pointerId === scrub.pid) { MM.seek(frac(e) * tlDur); }
    });
    function up(e) {
      if (kdrag && e.pointerId === kdrag.pid) {
        var k = kdrag; kdrag = null;
        if (k.moved) { MM.touch(); renderTimeline(true); MM.seek(MM.t); }
        else selectKey(k.target, k.t);
      }
      if (scrub && e.pointerId === scrub.pid) scrub = null;
    }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('keydown', function (e) {
      if (e.target.id !== 'tlRuler') return;
      var d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      if (d) { MM.pause(); MM.seek(MM.t + d / FPS); e.preventDefault(); }
    });
  }

  /* ---------- keys: selecting, editing ---------- */
  function selectKey(target, t) {
    selKey = { target: target, t: t };
    MM.pause(); MM.seek(t);
    renderTimeline(true); renderKeyBar();
    var d = MM.describe(target);
    if (d && d.group === 'item' && App.findItem(d.id) && App.sel !== d.id) App.select(d.id);
  }
  function curKey() {
    if (!selKey) return null;
    var tr = MM.getTrack(MM.cur(), selKey.target); if (!tr) return null;
    var i = MM.keyAt(tr, selKey.t); if (i < 0) return null;
    return { tr: tr, i: i, k: tr.keys[i], d: MM.describe(selKey.target) };
  }
  function trackTitle(target) {
    var d = MM.describe(target); if (!d) return target;
    if (d.group === 'camera') return 'Camera ' + CAM_LABEL[d.field].toLowerCase();
    if (d.group === 'item') { var it = App.findItem(d.id); return (it ? itemName(it) : 'Item') + ' ' + (FIELD_LABEL[d.field] || d.field).toLowerCase(); }
    if (d.group === 'caption') return 'Caption';
    return d.group === 'light' ? (d.field === 'warmth' ? 'Light warmth' : 'Light') : 'Filter';
  }
  function renderKeyBar() {
    var el = $('mmKeyBar'), c = curKey();
    if (!c) { el.hidden = true; el.innerHTML = ''; selKey = null; return; }
    var d = c.d, k = c.k, h = '<div class="kb-top"><strong>' + esc(trackTitle(selKey.target)) + '</strong>';
    h += '<button type="button" class="btn small" data-kb="close" aria-label="Close key editor">Close</button></div>';
    h += '<div class="kb-row"><span class="kb-lab">Time</span><button type="button" class="btn sq small" data-kb="back" aria-label="One frame earlier">' + svgi('minus') + '</button><span class="kb-val" id="kbTime">' + secs(k.t) + '</span><button type="button" class="btn sq small" data-kb="fwd" aria-label="One frame later">' + svgi('plus') + '</button>';
    if (d.mode !== 'discrete') {
      h += '<span class="kb-lab sp">Ease</span><div class="seg" role="group" aria-label="Easing">' + [['linear', 'Linear'], ['easeInOut', 'Smooth'], ['back', 'Pop']].map(function (e) { return '<button type="button" data-kb="ease" data-v="' + e[0] + '" aria-pressed="' + (k.ease === e[0]) + '">' + e[1] + '</button>'; }).join('') + '</div>';
    }
    h += '</div>';
    if (d.mode !== 'discrete' && !d.preset) {
      var vals = Array.isArray(k.v) ? k.v : [k.v], names = d.n === 3 ? ['x', 'y', 'z'] : d.n === 2 ? ['x', 'z'] : [''];
      h += '<div class="kb-row"><span class="kb-lab">Value</span>' + vals.map(function (v, i) { return '<label class="kb-num">' + (names[i] ? '<span>' + names[i] + '</span>' : '') + '<input type="number" step="0.05" data-kb="val" data-i="' + i + '" value="' + fmt(v, 2) + '" aria-label="Value ' + names[i] + '"></label>'; }).join('') + '</div>';
    } else {
      h += '<div class="kb-row"><span class="kb-lab">Value</span><span class="kb-val wide">' + esc(keyTitle(c.tr, k)) + '</span></div>';
    }
    if (k.gen) h += '<p class="hint">This key comes from the Quick list. Change the list to change it. If you change it here, it becomes yours and the list leaves it alone.</p>';
    h += '<div class="kb-row"><button type="button" class="btn danger small" data-kb="del">Delete key</button></div>';
    el.hidden = false; el.innerHTML = h;
  }
  function wireKeyBar() {
    var el = $('mmKeyBar');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-kb]'); if (!b) return;
      var a = b.getAttribute('data-kb'), c = curKey(); if (!c && a !== 'close') return;
      if (a === 'close') { selKey = null; renderKeyBar(); renderTimeline(true); return; }
      if (a === 'del') { MM.pushUndo(); MM.removeKey(MM.cur(), selKey.target, c.i); selKey = null; MM.touch(); renderKeyBar(); renderTimeline(true); MM.seek(MM.t); return; }
      if (a === 'ease') { MM.pushUndo(); c.k.ease = b.getAttribute('data-v'); delete c.k.gen; MM.touch(); renderKeyBar(); MM.seek(MM.t); return; }
      if (a === 'back' || a === 'fwd') {
        MM.pushUndo();
        var ni = MM.moveKey(MM.cur(), selKey.target, c.i, c.k.t + (a === 'fwd' ? 1 : -1) / FPS);
        selKey.t = c.tr.keys[ni].t; MM.touch(); MM.seek(selKey.t); renderTimeline(true); renderKeyBar();
      }
    });
    el.addEventListener('change', function (e) {
      var b = e.target.closest('[data-kb="val"]'); if (!b) return;
      var c = curKey(); if (!c) return;
      MM.pushUndo();
      var inputs = el.querySelectorAll('[data-kb="val"]'), v = [];
      for (var i = 0; i < inputs.length; i++) v.push(parseFloat(inputs[i].value) || 0);
      MM.setKey(MM.cur(), selKey.target, c.k.t, c.d.n > 1 ? v : v[0]);
      MM.touch(); MM.seek(MM.t); renderTimeline(true);
    });
  }

  /* ---------- Set key ---------- */
  function trackedOrDirty(target) { return dirty[target] || MM.hasTrack(MM.cur(), target); }
  function setItemKey(it) {
    var shot = MM.cur(), id = it.id, t = MM.t, n = 0;
    MM.pushUndo();
    function put(target) { var v = live(target); if (v !== undefined) { MM.setKey(shot, target, t, v); n++; } }
    put('item:' + id + '.pos');
    ['rot', 'height'].forEach(function (f) { if (trackedOrDirty('item:' + id + '.' + f)) put('item:' + id + '.' + f); });
    paramsFor(it).concat(['look']).forEach(function (p) { if (trackedOrDirty('item:' + id + '.pose.' + p)) put('item:' + id + '.pose.' + p); });
    clearDirtyFor('item:' + id + '.');
    return n;
  }
  function setCameraKey() {
    var shot = MM.cur(), t = MM.t;
    MM.pushUndo();
    ['pos', 'target'].forEach(function (f) { MM.setKey(shot, 'camera.' + f, t, live('camera.' + f)); });
    ['mm', 'fstop', 'focus', 'roll', 'exposure'].forEach(function (f) {
      var tg = 'camera.' + f; if (trackedOrDirty(tg)) MM.setKey(shot, tg, t, live(tg));
    });
    clearDirtyFor('camera.');
  }
  function clearDirtyFor(prefix) { Object.keys(dirty).forEach(function (k) { if (k.indexOf(prefix) === 0) delete dirty[k]; }); }
  function setKeyHere() {
    if (MM.loading) return;
    MM.pause();
    var it = selItem();
    var forCamera = tab === 'camera' || (!it && tab !== 'look');
    if (tab === 'look') {
      MM.pushUndo(); MM.setKey(MM.cur(), 'light.warmth', MM.t, S().light.k); App.msg('Warmth key set at ' + secs(MM.t) + '.', 1800);
    } else if (forCamera) { setCameraKey(); App.msg('Camera key set at ' + secs(MM.t) + '.', 1800); }
    else if (it) { setItemKey(it); App.msg(itemName(it) + ' key set at ' + secs(MM.t) + '.', 1800); }
    MM.touch(); renderTimeline(true); MM.seek(MM.t); syncFields();
  }

  /* ---------- tool tabs ---------- */
  /* The pages of the Tools sheet, grouped like the settings in the VOICE app. icon names a drawn icon (ICON above) on a colored tile. */
  var PAGES = [
    { id: 'quick', title: 'Quick', sub: 'Commands, script, draw path', icon: 'quick', color: '#4f46e5', group: 'Make it fast' },
    { id: 'shot', title: 'Shot', sub: 'Name, length, add a shot', icon: 'shot', color: '#2563eb', group: 'This shot' },
    { id: 'item', title: 'Characters', sub: 'Pose, bubble, costume', icon: 'item', color: '#ea580c', group: 'This shot' },
    { id: 'camera', title: 'Camera', sub: 'Moves, lens, focus', icon: 'camera', color: '#0f766e', group: 'This shot' },
    { id: 'look', title: 'Look', sub: 'Light and filter', icon: 'look', color: '#ca8a04', group: 'This shot' },
    { id: 'text', title: 'Text', sub: 'Captions', icon: 'text', color: '#db2777', group: 'This shot' },
    { id: 'sound', title: 'Sound', sub: 'Your own music or voice', icon: 'sound', color: '#16a34a', group: 'Movie' },
    { id: 'movie', title: 'Movie', sub: 'Save, open, showcase', icon: 'movie', color: '#475569', group: 'Movie' }
  ];
  function pageInfo(id) { return PAGES.filter(function (p) { return p.id === id; })[0] || PAGES[0]; }
  function chip(act, v, label, extra) { return '<button type="button" class="chip" data-act="' + act + '" data-v="' + esc(v) + '" aria-pressed="false"' + (extra || '') + '>' + label + '</button>'; }
  function seg(act, list, label) { return '<div class="seg" role="group" aria-label="' + label + '">' + list.map(function (o) { return '<button type="button" data-act="' + act + '" data-v="' + o[0] + '" aria-pressed="false">' + o[1] + '</button>'; }).join('') + '</div>'; }
  function field(id, label, min, max, step) { return '<div class="field"><label for="f-' + id + '">' + label + '</label><output id="o-' + id + '" for="f-' + id + '"></output><input type="range" id="f-' + id + '" data-f="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '"></div>'; }
  function tog(act, label) { return '<button type="button" class="tog" data-act="' + act + '" aria-pressed="false"><span>' + label + '</span><span class="track" aria-hidden="true"></span></button>'; }

  /* ---------- back button and Escape: one history entry while any layer (sheet, draw mode, dialog) is open ---------- */
  var layers = [], marker = false, ignorePop = 0;
  function pushLayer(close) {
    var l = { close: close };
    layers.push(l);
    if (!marker) { try { history.pushState({ dibsMM: 1 }, ''); marker = true; } catch (e) {} }
    return l;
  }
  function dropLayer(l) {
    var i = layers.indexOf(l); if (i < 0) return;
    layers.splice(i, 1);
    if (!layers.length) setTimeout(function () { if (!layers.length && marker) { marker = false; ignorePop++; try { history.back(); } catch (e) { ignorePop--; } } }, 0);
  }
  window.addEventListener('popstate', function () {
    if (ignorePop) { ignorePop--; return; }
    marker = false;
    var top = layers.pop();
    if (top) top.close();
    if (layers.length && !marker) { try { history.pushState({ dibsMM: 1 }, ''); marker = true; } catch (e) {} }
  });

  /* ---------- the Tools sheet ---------- */
  var WIDE = window.matchMedia('(min-width:1100px)');
  var view = 'list', used = false, sheetLayer = null, wasPhone = isPhone();
  function isWide() { return WIDE.matches; }
  function isOpen() { return panel.getAttribute('data-open') === 'true'; }
  function pageValue(id) {
    var shot = MM.cur(), st = S(); if (!shot) return '';
    if (id === 'quick') { var n = 0; puppets().forEach(function (p) { n += (MM.getList(shot, p.id) || []).length; }); return n ? n + (n === 1 ? ' command' : ' commands') : 'None yet'; }
    if (id === 'shot') return shot.name || 'Shot ' + (MM.shotIdx + 1);
    if (id === 'item') { var it = selItem(); return it ? itemName(it) : 'None picked'; }
    if (id === 'camera') return Math.round(st.lens.mm) + ' mm f/' + st.lens.fnum;
    if (id === 'look') { var L = App.LIGHTS.filter(function (l) { return l.id === st.light.preset; })[0]; return L ? L.name : 'Custom light'; }
    if (id === 'text') return capText.length > 22 ? capText.slice(0, 21) + '...' : capText;
    if (id === 'sound') { var a = MM.movie.audio; return a && a.dataUrl ? (MM.muted ? 'Muted' : 'On') : 'None'; }
    if (id === 'movie') { var c = MM.movie.shots.length; return c + (c === 1 ? ' shot' : ' shots'); }
    return '';
  }
  function renderList() {
    var h = '', group = '';
    PAGES.forEach(function (p) {
      if (p.group !== group) { if (group) h += '</div>'; group = p.group; h += '<h3 class="set-group-title">' + esc(group) + '</h3><div class="set-group">'; }
      var on = isWide() && p.id === tab;
      h += '<button type="button" class="set-row' + (on ? ' on' : '') + '" data-page="' + p.id + '"' + (on ? ' aria-current="page"' : '') + '><span class="set-icon" style="background:' + p.color + '" aria-hidden="true">' + svgi(p.icon) + '</span>' +
        '<span class="set-row-text"><span class="set-row-title">' + esc(p.title) + '</span><span class="set-row-sub">' + esc(p.sub) + '</span></span>' +
        '<span class="set-row-value">' + esc(pageValue(p.id)) + '</span></button>';
    });
    $('shList').innerHTML = h + '</div>';
  }
  function applyView() {
    var wide = isWide();
    panel.setAttribute('data-view', wide ? 'page' : view);
    $('shTitle').textContent = !wide && view === 'page' ? pageInfo(tab).title : 'Tools';
    $('mmTools').setAttribute('aria-expanded', isOpen() ? 'true' : 'false');
    renderList();
  }
  /* a fixed layer over the picture can leave the canvas showing a stale frame, so draw it again */
  function redraw() { setTimeout(function () { App.invalidate(); }, 40); }
  function relayout() { setTimeout(function () { App.layout(); MM.paintCaption(); }, 30); }
  function openSheet(page) {
    if (page) { tab = page; used = true; }
    view = (isWide() || page || used) ? 'page' : 'list';
    var was = isOpen();
    if (UI.toolsOpened) UI.toolsOpened();
    panel.setAttribute('data-open', 'true'); $('mm').setAttribute('data-tools', '1');
    $('mmScrim').hidden = !isPhone();
    if (isPhone() && !sheetLayer) sheetLayer = pushLayer(function () { sheetLayer = null; hideSheet(); });
    applyView(); renderPanel();
    $('shPage').scrollTop = 0;
    if (!was) { try { $('shTitle').focus({ preventScroll: true }); } catch (e) {} }
    redraw();
    if (UI.ext.sheetChanged) UI.ext.sheetChanged();
  }
  function hideSheet() {
    panel.setAttribute('data-open', 'false'); $('mm').setAttribute('data-tools', '0');
    $('mmScrim').hidden = true;
    $('mmTools').setAttribute('aria-expanded', 'false');
    redraw();
    if (UI.ext.sheetChanged) UI.ext.sheetChanged();
  }
  function closeSheet() {
    if (!isOpen()) return;
    if (sheetLayer) { var l = sheetLayer; sheetLayer = null; dropLayer(l); }
    hideSheet();
  }
  function showPage(id) {
    tab = id; used = true; view = 'page';
    applyView(); renderPanel();
    $('shPage').scrollTop = 0;
    try { $('shTitle').focus({ preventScroll: true }); } catch (e) {}
    if (UI.ext.sheetChanged) UI.ext.sheetChanged();
  }
  function showList() { view = 'list'; applyView(); try { $('shTitle').focus({ preventScroll: true }); } catch (e) {} }
  function buildSheet() {
    $('shList').addEventListener('click', function (e) { var b = e.target.closest('[data-page]'); if (b) showPage(b.getAttribute('data-page')); });
    $('shBack').addEventListener('click', showList);
    $('shDone').addEventListener('click', closeSheet);
    $('mmScrim').addEventListener('click', closeSheet);
    var onMode = function () {
      var phone = isPhone();
      if (phone !== wasPhone) { wasPhone = phone; if (phone) closeSheet(); else openSheet(); relayout(); return; }
      if (isOpen()) { if (isWide()) view = 'page'; applyView(); }
    };
    window.addEventListener('resize', onMode);
  }
  var FSTOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
  var bubState = { text: 'Hello from Chicago!', style: 'speech', tail: 'down' };
  var capText = 'Made with DIBS Movie Maker';
  function paramsFor(it) {
    var def = DP.PUPPETS[it.kind]; if (!def) return [];
    var p = ['head']; if (def.wings >= 1) p.push('wingA'); if (def.wings >= 2) p.push('wingB');
    return p.concat(['lean', 'bend', 'hop']);
  }
  function paramLabel(it, p) {
    var def = DP.PUPPETS[it.kind];
    return { head: 'Head turn', wingA: def.wings === 1 ? 'Wing' : 'Left wing', wingB: 'Right wing', lean: 'Lean', bend: 'Bend', hop: 'Hop height' }[p];
  }
  var PRANGE = { head: [-60, 60, 1], wingA: [0, 170, 1], wingB: [0, 170, 1], lean: [-40, 40, 1], bend: [-40, 40, 1], hop: [0, 1, 0.01] };

  var fieldDefs = {};   // id -> {get, set(v), text(v)}
  function defField(id, get, set, text) { fieldDefs[id] = { get: get, set: set, text: text || function (v) { return fmt(v, 2); } }; }

  function renderPanel() {
    if (!isOpen()) return;
    fieldDefs = {};
    var h = '', it = selItem(), shot = MM.cur();
    if (!shot) { content.innerHTML = ''; return; }
    applyView();
    if (tab === 'quick') h = UI.ext.quickPanel ? UI.ext.quickPanel() : '';
    else if (tab === 'shot') h = panelShot(shot);
    else if (tab === 'item') h = panelItem(it);
    else if (tab === 'camera') h = panelCamera();
    else if (tab === 'look') h = panelLook();
    else if (tab === 'text') h = panelText();
    else if (tab === 'sound') h = panelSound();
    else h = panelMovie();
    content.innerHTML = h;
    panel.setAttribute('data-tab', tab);
    syncFields();
    if (tab === 'movie') refreshSaved();
    if (tab === 'quick' && UI.ext.quickAfter) UI.ext.quickAfter();
  }

  /* ---- Shot ---- */
  function panelShot(shot) {
    return '<div class="group"><h3>This shot</h3>' +
      '<div class="field"><label for="shName">Name</label></div><input type="text" id="shName" maxlength="40" value="' + esc(shot.name) + '" aria-label="Shot name">' +
      '<h3 class="gap">Length</h3><div class="row"><button type="button" class="btn sq" data-act="dur" data-v="-0.5" aria-label="Half a second shorter">' + svgi('minus') + '</button><span class="kb-val" id="durText">' + shot.duration + ' sec</span><button type="button" class="btn sq" data-act="dur" data-v="0.5" aria-label="Half a second longer">' + svgi('plus') + '</button></div>' +
      '<p class="hint" id="durHint">The whole movie can be 60 sec. Now it is ' + MM.fmtTime(MM.total()) + '.</p>' +
      '<div class="row"><button type="button" class="btn" data-act="shotleft">Move earlier</button><button type="button" class="btn" data-act="shotright">Move later</button><button type="button" class="btn danger" data-act="shotdel">Delete shot</button></div></div>' +
      '<div class="group"><h3>Add a shot after this one</h3>' +
      '<div class="row"><button type="button" class="btn" data-act="addblank">Blank starter</button><button type="button" class="btn" data-act="adddup">Copy of this shot</button></div>' +
      '<div class="row"><button type="button" class="btn" data-act="addfile">Import a scene file</button><button type="button" class="btn" data-act="addauto">From photo mode</button></div>' +
      '<p class="hint">A scene file is a .dibsscene.json saved from photo mode. From photo mode uses the scene you were last working on there. Drag a shot in the strip to reorder it.</p></div>';
  }

  /* ---- Item ---- */
  function panelItem(it) {
    var h = '<div class="group"><h3>Characters in this shot</h3><div class="chips">' + S().items.map(function (o) {
      var ob = App.objs[o.id];
      return '<button type="button" class="chip thumb" data-act="pick" data-v="' + o.id + '" aria-pressed="' + (o.id === App.sel) + '">' + (ob && ob.thumb ? '<img alt="" src="' + ob.thumb + '">' : '') + esc(itemName(o)) + '</button>';
    }).join('') + '</div>' + (it ? '' : '<p class="hint">Tap a character here or in the picture to pick it.</p>') + '</div>';
    if (!it) return h;
    var puppet = DP.isPuppet(it.kind), id = it.id;
    h += '<div class="group"><div class="row"><button type="button" class="btn primary-lite" data-act="setkey">Set key for ' + esc(itemName(it)) + '</button></div><p class="hint">Move or pose the character, then tap Set key to keep it at ' + secs(MM.t) + '. Pose chips set their own key.</p></div>';
    if (puppet) {
      h += '<div class="group"><h3>Pose</h3><div class="chips">' + DP.POSES.map(function (p) { return chip('pose', p.id, p.name); }).join('') + '</div>' +
        '<p class="hint">Poses step on twos, like stop motion. Tap one at the playhead and the character moves into it over a third of a second.</p>' +
        '<div class="row"><button type="button" class="btn" data-act="hop1">Hop once</button><button type="button" class="btn" data-act="hop3">Hop three times</button></div></div>';
    }
    h += '<div class="group"><h3>Place</h3>' + field('x', 'Left and right', -6, 6, 0.05) + field('z', 'Toward the camera', -6, 4, 0.05) + field('yaw', 'Turn', -180, 180, 1) + field('y', 'Height off the ground', 0, 4, 0.05) + '</div>';
    defField('x', function () { return it.x; }, function (v) { it.x = v; App.applyItem(id); edited('item:' + id + '.pos'); });
    defField('z', function () { return it.z; }, function (v) { it.z = v; App.applyItem(id); edited('item:' + id + '.pos'); });
    defField('yaw', function () { return it.yaw; }, function (v) { it.yaw = v; App.applyItem(id); edited('item:' + id + '.rot'); }, function (v) { return Math.round(v) + ' deg'; });
    defField('y', function () { return it.y; }, function (v) { it.y = v; App.applyItem(id); edited('item:' + id + '.height'); });
    if (puppet) {
      h += '<div class="group"><h3>Body</h3>';
      paramsFor(it).forEach(function (p) {
        var r = PRANGE[p];
        h += field('p-' + p, paramLabel(it, p), r[0], r[1], r[2]);
        defField('p-' + p, function () { return it.pose[p]; }, function (v) { it.pose[p] = v; it.pose.preset = 'custom'; App.applyItem(id); edited('item:' + id + '.pose.' + p); }, function (v) { return p === 'hop' ? fmt(v, 2) : Math.round(v) + ' deg'; });
      });
      h += '<p class="small gap">Looking</p>' + seg('look', [['-1', 'Left'], ['0', 'Ahead'], ['1', 'Right']], 'Look direction') + '</div>';
    }
    h += '<div class="group"><h3>Emote</h3><div class="chips">' + chip('emote', 'none', 'None') + DP.EMOTES.map(function (e) { return '<button type="button" class="chip thumb" data-act="emote" data-v="' + e.id + '" aria-pressed="false" aria-label="' + e.name + '"><img alt="" src="' + svgData(e.svg) + '">' + e.name + '</button>'; }).join('') + '</div>' +
      '<p class="hint">The emote pops in at the playhead and does its body move. Tap None to take it away.</p></div>';
    h += '<div class="group"><h3>Speech bubble</h3><textarea id="bubText" maxlength="160" aria-label="What it says" rows="2">' + esc(bubState.text) + '</textarea>' +
      '<p class="small gap">Kind</p>' + seg('bubstyle', DP.BUBBLES.map(function (b) { return [b.id, b.name.replace(' on a stick', '').replace(' bubble', '')]; }), 'Bubble kind') +
      '<p class="small">Tail</p>' + seg('bubtail', [['left', 'Left'], ['right', 'Right'], ['down', 'Down'], ['none', 'None']], 'Bubble tail') +
      '<div class="row"><button type="button" class="btn" data-act="addline">Add line at playhead</button><button type="button" class="btn" data-act="endline">End line here</button></div>' +
      '<p class="hint" id="bubHint">The bubble pops in and stays about 2.5 sec plus a little for each letter.</p></div>';
    if (puppet) {
      h += '<div class="group"><h3>Costume and props</h3><div class="chips">' + chip('wear', 'none', 'None') + DP.COSTUMES.map(function (c) { return '<button type="button" class="chip thumb" data-act="wear" data-v="' + c.id + '" aria-pressed="false"><img alt="" src="' + svgData(A.costumes[c.id]) + '">' + c.name + '</button>'; }).join('') + '</div>' +
        '<p class="hint">A costume pops on at the playhead.</p>' +
        '<div class="field"><label for="holdSel">Hold a prop all shot</label></div><select id="holdSel" aria-label="Hold a prop"><option value="">Nothing</option>' + Object.keys(A.symbols).map(function (n) { return '<option value="' + n + '">' + esc(n.replace(/-/g, ' ')) + '</option>'; }).join('') + '</select></div>';
    }
    h += '<div class="group"><h3>Show or hide</h3><div class="row"><button type="button" class="btn" data-act="vis" data-v="1">Show at playhead</button><button type="button" class="btn" data-act="vis" data-v="0">Hide at playhead</button></div></div>';
    return h;
  }

  /* ---- Camera ---- */
  function panelCamera() {
    var ch = puppets(), h = '';
    h += '<div class="group"><div class="row"><button type="button" class="btn primary-lite" data-act="camkey">Set camera key</button></div><p class="hint">Drag the picture to place the camera, then tap Set key. Moves below write keys from the playhead to the end of the shot.</p></div>';
    h += '<div class="group"><h3>Camera moves</h3><div class="chips">' + [['dolly', 'Dolly in'], ['orbit', 'Slow orbit'], ['craneup', 'Crane up'], ['cranedown', 'Crane down'], ['hold', 'Hold']].map(function (m) { return chip('cammove', m[0], m[1]); }).join('') + '</div>' +
      '<p class="hint">Every move eases in and out. No whip pans.</p></div>';
    if (ch.length >= 2) {
      h += '<div class="group"><h3>Rack focus</h3><div class="field"><label for="rfA">From</label></div><select id="rfA" aria-label="Focus from">' + ch.map(function (o) { return '<option value="' + o.id + '">' + esc(itemName(o)) + '</option>'; }).join('') + '</select>' +
        '<div class="field gap"><label for="rfB">To</label></div><select id="rfB" aria-label="Focus to">' + ch.map(function (o, i) { return '<option value="' + o.id + '"' + (i === 1 ? ' selected' : '') + '>' + esc(itemName(o)) + '</option>'; }).join('') + '</select>' +
        '<div class="row gap"><button type="button" class="btn" data-act="rack">Rack focus over 1 sec</button></div></div>';
    }
    h += '<div class="group"><h3>Lens</h3>' + field('mm', 'Lens', 14, 200, 1) + field('fs', 'Aperture', 0, FSTOPS.length - 1, 1) + '</div>';
    defField('mm', function () { return S().lens.mm; }, function (v) { S().lens.mm = Math.round(v); App.applyLens(); App.showReticle(); App.invalidate(); edited('camera.mm'); }, function (v) { return Math.round(v) + ' mm'; });
    defField('fs', function () { var f = S().lens.fnum, b = 0; FSTOPS.forEach(function (x, i) { if (Math.abs(x - f) < Math.abs(FSTOPS[b] - f)) b = i; }); return b; },
      function (v) { S().lens.fnum = FSTOPS[Math.round(v)]; App.invalidate(); App.showReticle(); edited('camera.fstop'); }, function (v) { return 'f/' + FSTOPS[Math.round(v)]; });
    h += '<div class="group"><h3>Focus</h3><div class="row"><button type="button" class="btn" data-act="tapfocus" aria-pressed="false">Tap to focus</button><button type="button" class="btn" data-act="focussel">Focus on picked character</button></div>' + field('fd', 'Focus distance', 0.5, 20, 0.05) + '</div>';
    defField('fd', function () { return App.focusDistance(); }, function (v) { App.setFocusDist(v); edited('camera.focus'); }, function (v) { return fmt(v, 1) + ' units'; });
    h += '<div class="group"><h3>Picture</h3>' + field('roll', 'Tilt', -30, 30, 0.5) + field('exp', 'Exposure', -2, 2, 0.05) + '</div>';
    defField('roll', function () { return App.rig.s.roll || 0; }, function (v) { App.rig.s.roll = v; App.invalidate(); edited('camera.roll'); }, function (v) { return fmt(v, 1) + ' deg'; });
    defField('exp', function () { return S().lens.exposure; }, function (v) { S().lens.exposure = v; App.invalidate(); edited('camera.exposure'); });
    return h;
  }

  /* ---- Look ---- */
  function panelLook() {
    var h = '<div class="group"><h3>Light</h3><div class="chips">' + App.LIGHTS.map(function (l) { return chip('light', l.id, l.name); }).join('') + '</div>' +
      '<p class="hint">A light changes at the playhead. At the start of the shot it sets the light for the whole shot.</p>' + field('warm', 'Warmth', 2000, 9500, 100) +
      '<div class="row"><button type="button" class="btn" data-act="warmkey">Set warmth key</button></div></div>';
    defField('warm', function () { return S().light.k; }, function (v) { S().light.k = v; App.applyLight(); edited('light.warmth'); }, function (v) { return Math.round(v) + ' K'; });
    h += '<div class="group"><h3>Filter</h3><div class="chips">' + App.FILTERS.map(function (f) { return '<button type="button" class="chip" data-act="filter" data-v="' + f.id + '" aria-pressed="false"><i class="fdot" style="background:' + f.c + '"></i>' + f.name + '</button>'; }).join('') + '</div></div>';
    return h;
  }

  /* ---- Text ---- */
  function panelText() {
    return '<div class="group"><h3>Caption</h3><input type="text" id="capText" maxlength="120" aria-label="Caption words" value="' + esc(capText) + '">' +
      '<div class="row gap"><button type="button" class="btn" data-act="addcap">Add caption at playhead</button><button type="button" class="btn" data-act="endcap">End caption here</button></div>' +
      '<p class="hint" id="capHint">Captions sit in an L sign bar inside the safe area, away from the buttons of the app that plays the video.</p></div>';
  }

  /* ---- Sound ---- */
  function panelSound() {
    var a = MM.movie.audio, h = '<div class="group"><h3>Sound</h3>';
    if (a && a.dataUrl) {
      h += '<p class="sizeline">' + esc(a.name) + '</p>' + tog('mute', 'Sound on') +
        field('vol', 'Volume', 0, 1, 0.05) + field('soff', 'Starts at', 0, Math.max(1, Math.floor(MM.total())), 0.5) +
        '<div class="row"><button type="button" class="btn" data-act="pickaudio">Choose another file</button><button type="button" class="btn danger" data-act="rmaudio">Remove sound</button></div>';
      defField('vol', function () { return a.volume; }, function (v) { a.volume = v; MM.audioVolume(); MM.touch(); }, function (v) { return Math.round(v * 100) + '%'; });
      defField('soff', function () { return a.offset; }, function (v) { a.offset = v; MM.touch(); }, function (v) { return fmt(v, 1) + ' sec'; });
    } else {
      h += '<p class="hint">Add your own music or voice. It stays on this device and is not uploaded.</p><div class="row"><button type="button" class="btn" data-act="pickaudio">Add sound</button></div>';
    }
    return h + '<p class="hint">Sound is off until you turn it on. Use an mp3, m4a, wav or ogg file.</p></div>';
  }

  /* ---- Movie ---- */
  function panelMovie() {
    return '<div class="group"><h3>This movie</h3><div class="row"><button type="button" class="btn" data-act="poster">Save poster picture</button><button type="button" class="btn" data-act="safe" aria-pressed="false">Show safe area</button></div>' +
      '<p class="hint">The poster is the picture you see now, at full size. The safe area marks where apps put their buttons.</p></div>' +
      '<div class="group"><h3>Typed script</h3><div class="row"><button type="button" class="btn" data-act="openscript">Script</button></div><p class="hint">Type lines like Dibs: Hey Chicago! and build the commands for a shot.</p></div>' +
      '<div class="group"><h3>Saved movies</h3><div class="row"><input type="text" id="mvName" maxlength="60" aria-label="Name for the saved movie" placeholder="Name"><button type="button" class="btn" data-act="savemovie">Save a copy</button></div><ul class="scenes" id="mvList"></ul>' +
      '<p class="hint">The movie also saves itself on this device.</p></div>' +
      '<div class="group"><h3>Files</h3><div class="row"><button type="button" class="btn" data-act="expfile">Export movie file</button><button type="button" class="btn" data-act="impfile">Import movie file</button></div></div>' +
      '<div class="group"><h3>Which hand</h3>' + seg('hand', [['right', 'Right-handed'], ['left', 'Left-handed']], 'Which hand holds the phone') +
      '<p class="hint">Left-handed moves Play, Set key, Undo, Redo and Tools to the left. It is the same setting as in photo mode.</p></div>' +
      '<div class="group"><h3>Start over</h3><div class="row"><button type="button" class="btn" data-act="newmovie">New movie</button><button type="button" class="btn" data-act="showcase">Open the showcase</button></div>' +
      '<p class="hint">Your current movie is saved first. <a class="inlink" href="index.html">Go to photo mode</a> to stage new scenes.</p></div>';
  }
  function refreshSaved() {
    var ul = $('mvList'); if (!ul) return;
    MM.listMovies().then(function (list) {
      ul = $('mvList'); if (!ul) return;
      ul.innerHTML = list.length ? '' : '<li><span class="nm small">Nothing saved yet.</span></li>';
      list.forEach(function (r) {
        var li = document.createElement('li');
        li.innerHTML = '<span class="nm">' + esc(r.name || 'Movie') + '</span><button type="button" class="btn small" data-act="openmovie" data-v="' + esc(r.id) + '">Open</button><button type="button" class="btn small danger" data-act="delmovie" data-v="' + esc(r.id) + '">Delete</button>';
        ul.appendChild(li);
      });
    });
  }

  /* ---------- keeping fields in step with the scene ---------- */
  function syncFields() {
    var it = selItem(), shot = MM.cur();
    Object.keys(fieldDefs).forEach(function (id) {
      var f = fieldDefs[id], inp = $('f-' + id), out = $('o-' + id);
      if (!inp || activeField === id) return;
      var v = f.get(); if (v === undefined || v === null || isNaN(v)) return;
      inp.value = v; if (out) out.textContent = f.text(v);
    });
    var q = function (sel, fn) { Array.prototype.forEach.call(content.querySelectorAll(sel), fn); };
    var press = function (b, on) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); };
    if (!shot) return;
    var st = S();
    if (tab === 'item' && it) {
      q('[data-act="pose"]', function (b) { var tr = MM.getTrack(shot, 'item:' + it.id + '.pose.preset'); var v = tr ? presetAt(tr) : (it.pose && it.pose.preset); press(b, b.getAttribute('data-v') === v); });
      q('[data-act="look"]', function (b) { press(b, it.pose && String(it.pose.look) === b.getAttribute('data-v')); });
      q('[data-act="emote"]', function (b) { var v = it.emote ? it.emote.id : 'none'; press(b, b.getAttribute('data-v') === v); });
      q('[data-act="wear"]', function (b) { var tr = MM.getTrack(shot, 'item:' + it.id + '.wear'), cur = 'none'; if (tr) { var i = lastKeyIdx(tr, MM.t); if (i >= 0 && tr.keys[i].v) cur = tr.keys[i].v.id; } else { var a = (it.attach || []).filter(function (x) { return x.kind.indexOf('costume:') === 0; })[0]; if (a) cur = a.kind.slice(8); } press(b, b.getAttribute('data-v') === cur); });
      q('[data-act="bubstyle"]', function (b) { press(b, b.getAttribute('data-v') === bubState.style); });
      q('[data-act="bubtail"]', function (b) { press(b, b.getAttribute('data-v') === bubState.tail); });
      var hs = $('holdSel'); if (hs) { var held = (it.attach || []).filter(function (x) { return x.kind.indexOf('symbol:') === 0 && x.slot === 'handR'; })[0]; hs.value = held ? held.kind.slice(7) : ''; }
    }
    if (tab === 'camera') {
      q('[data-act="tapfocus"]', function (b) { press(b, !!App.tapFocus); });
    }
    if (tab === 'look') {
      q('[data-act="light"]', function (b) { press(b, st.light.preset === b.getAttribute('data-v')); });
      q('[data-act="filter"]', function (b) { press(b, String(st.look.filter) === b.getAttribute('data-v')); });
    }
    if (tab === 'sound') q('[data-act="mute"]', function (b) { press(b, !MM.muted); });
    if (tab === 'movie') { q('[data-act="safe"]', function (b) { press(b, !!MM.safeGuides); }); q('[data-act="hand"]', function (b) { press(b, b.getAttribute('data-v') === (App.hand || 'right')); }); }
    var dt = $('durText'); if (dt) dt.textContent = shot.duration + ' sec';
  }
  function lastKeyIdx(tr, t) { var r = -1; for (var i = 0; i < tr.keys.length; i++) { if (tr.keys[i].t <= t + 1e-6) r = i; } return r; }
  function presetAt(tr) { var i = lastKeyIdx(tr, MM.t); return i >= 0 ? tr.keys[i].v : null; }

  /* ---------- actions ---------- */
  function keyNow(target, v, ease) { MM.setKey(MM.cur(), target, MM.t, v, ease); MM.touch(); }
  function afterKeys() { renderTimeline(true); MM.seek(MM.t); syncFields(); }
  function rangeFromHere() {
    var shot = MM.cur(), t0 = MM.t, t1 = shot.duration;
    if (t1 - t0 < 0.5) { App.msg('Move the playhead earlier to start a camera move.'); return null; }
    return [t0, t1];
  }
  var act = {
    hand: function (v) { if (UI.setHand) UI.setHand(v); syncFields(); },
    pick: function (v) { if (App.edit) App.edit.quiet = false; App.select(v); },
    setkey: function () { setKeyHere(); },
    camkey: function () { tab = 'camera'; setKeyHere(); },
    warmkey: function () { tab = 'look'; setKeyHere(); },
    pose: function (v) {
      var it = selItem(); if (!it) return;
      MM.pushUndo();
      var shot = MM.cur(), tg = 'item:' + it.id + '.pose.preset', tr = MM.getTrack(shot, tg), t = MM.t;
      if (!tr) {
        if (t > 0.05) { var bp = MM.base.items[it.id] && MM.base.items[it.id].pose, pid = bp && DP.POSES.some(function (p) { return p.id === bp.preset; }) ? bp.preset : 'stand'; MM.setKey(shot, tg, Math.max(0, t - 0.3), pid); }
      } else {
        var i = lastKeyIdx(tr, t - 0.02);
        if (i >= 0 && t - tr.keys[i].t > 0.36) MM.setKey(shot, tg, t - 0.3, tr.keys[i].v);
      }
      MM.setKey(shot, tg, t, v);
      clearDirtyFor('item:' + it.id + '.pose.');
      MM.touch(); renderTimeline(true); MM.seek(MM.t); syncFields();
    },
    look: function (v) {
      var it = selItem(); if (!it || !it.pose) return;
      undoBurst(); it.pose.look = parseInt(v, 10); it.pose.preset = 'custom'; App.applyItem(it.id); edited('item:' + it.id + '.pose.look'); syncFields();
    },
    hop1: function () { hop(1); }, hop3: function () { hop(3); },
    emote: function (v) {
      var it = selItem(); if (!it) return;
      MM.pushUndo();
      keyNow('item:' + it.id + '.emote', v === 'none' ? null : { id: v, x: 0, s: 1 }, 'linear');
      afterKeys();
    },
    bubstyle: function (v) { bubState.style = v; bubbleEdited(); syncFields(); },
    bubtail: function (v) { bubState.tail = v; bubbleEdited(); syncFields(); },
    addline: function () {
      var it = selItem(); if (!it) return;
      var text = ($('bubText').value || '').trim(); if (!text) { App.msg('Type the words first.'); return; }
      bubState.text = text;
      MM.pushUndo();
      var shot = MM.cur(), tg = 'item:' + it.id + '.bubble', t = MM.t;
      MM.setKey(shot, tg, t, { text: text, style: bubState.style, tail: bubState.tail }, 'linear');
      var end = MM.snapT(t + 2.5 + 0.06 * text.length), tr = MM.getTrack(shot, tg);
      if (end < shot.duration - 0.05 && !tr.keys.some(function (k) { return k.t > t + 0.02 && k.t <= end + 0.02; })) MM.setKey(shot, tg, end, null, 'linear');
      MM.touch(); afterKeys();
    },
    endline: function () { var it = selItem(); if (!it) return; MM.pushUndo(); keyNow('item:' + it.id + '.bubble', null, 'linear'); afterKeys(); },
    wear: function (v) {
      var it = selItem(); if (!it) return;
      MM.pushUndo();
      keyNow('item:' + it.id + '.wear', v === 'none' ? null : { id: v }, 'linear');
      afterKeys();
    },
    vis: function (v) { var it = selItem(); if (!it) return; MM.pushUndo(); keyNow('item:' + it.id + '.visible', v === '1', 'linear'); afterKeys(); },
    cammove: function (v) {
      var r = rangeFromHere(); if (!r) return;
      MM.pushUndo();
      var shot = MM.cur(), b = MM.base, M = MM.motions;
      if (v === 'dolly') M.dollyIn(shot, b, r[0], r[1], 0.3);
      else if (v === 'orbit') M.orbit(shot, b, r[0], r[1], 30);
      else if (v === 'craneup') M.crane(shot, b, r[0], r[1], 1.8);
      else if (v === 'cranedown') M.crane(shot, b, r[0], r[1], -1.8);
      else M.hold(shot, b, r[0], r[1]);
      MM.touch(); renderTimeline(true); MM.seek(MM.t);
      App.msg('Camera move from ' + secs(r[0]) + ' to ' + secs(r[1]) + '.', 2400);
    },
    rack: function () {
      var a = $('rfA').value, b = $('rfB').value; if (a === b) { App.msg('Pick two different characters.'); return; }
      var shot = MM.cur(), t0 = MM.t, t1 = Math.min(shot.duration, t0 + 1);
      if (t1 - t0 < 0.3) { App.msg('Move the playhead earlier to start a rack focus.'); return; }
      MM.pushUndo(); MM.motions.rackFocus(shot, MM.base, t0, t1, a, b); MM.touch(); renderTimeline(true); MM.seek(MM.t);
      App.msg('Focus moves from ' + itemName(App.findItem(a)) + ' to ' + itemName(App.findItem(b)) + '.', 2400);
    },
    tapfocus: function () { App.tapFocus = !App.tapFocus; syncFields(); if (App.tapFocus) App.msg('Tap the picture where you want it sharp.', 4000); },
    focussel: function () { if (App.sel) { undoBurst(); App.focusOnItem(App.sel); edited('camera.focus'); syncFields(); } else App.msg('Pick a character first, then focus on it.'); },
    light: function (v) { MM.pushUndo(); keyNow('light.preset', v, 'linear'); afterKeys(); },
    filter: function (v) { MM.pushUndo(); keyNow('look.filter', parseInt(v, 10), 'linear'); afterKeys(); },
    addcap: function () {
      var text = ($('capText').value || '').trim(); if (!text) { App.msg('Type the caption first.'); return; }
      capText = text; MM.pushUndo();
      var shot = MM.cur(), t = MM.t;
      MM.setKey(shot, 'caption', t, { text: text }, 'linear');
      var end = MM.snapT(t + 3), tr = MM.getTrack(shot, 'caption');
      if (end < shot.duration - 0.05 && !tr.keys.some(function (k) { return k.t > t + 0.02 && k.t <= end + 0.02; })) MM.setKey(shot, 'caption', end, null, 'linear');
      MM.touch(); afterKeys();
    },
    endcap: function () { MM.pushUndo(); keyNow('caption', null, 'linear'); afterKeys(); },
    mute: function () { MM.muted = !MM.muted; MM.audioVolume(); if (MM.playing) { if (MM.muted) MM.audioStop(); else MM.audioStart(MM.absTime()); } syncFields(); },
    pickaudio: function () { $('fileAudio').click(); },
    rmaudio: function () { MM.removeAudio(); },
    dur: function (v) { MM.setDuration(MM.cur().duration + parseFloat(v)); renderShots(); renderTimeline(); var dh = $('durHint'); if (dh) dh.textContent = 'The whole movie can be 60 sec. Now it is ' + MM.fmtTime(MM.total()) + '.'; syncFields(); updateTime(); },
    shotleft: function () { MM.moveShot(MM.shotIdx, MM.shotIdx - 1); renderShots(); },
    shotright: function () { MM.moveShot(MM.shotIdx, MM.shotIdx + 1); renderShots(); },
    shotdel: function () { MM.deleteShot().then(function (ok) { if (ok) App.msg('Shot deleted. Tap Undo to bring it back.', 4000); }); },
    addblank: function () { MM.addShot(App.starterScene()); },
    adddup: function () { MM.duplicateShot(); },
    addfile: function () { $('fileScene').click(); },
    addauto: function () {
      DP.Store.get('auto', 'current').then(function (rec) {
        if (!rec || !rec.data) { App.msg('Photo mode has no saved scene yet. Open photo mode and stage one first.', 4200); return; }
        MM.addShot(rec.data, 'From photo mode');
      });
    },
    poster: function () {
      MM.posterBlob(false).then(function (b) { if (b) MM.download(b, 'dibs-' + MM.slug(MM.movie.title) + '-' + MM.movie.platform + '-poster.png'); });
    },
    safe: function () { MM.safeGuides = !MM.safeGuides; S().frame.safe = MM.safeGuides; App.updateGuides(); syncFields(); },
    savemovie: function () { var n = ($('mvName').value || '').trim() || MM.movie.title; MM.saveNamed(n).then(function () { $('mvName').value = ''; refreshSaved(); App.msg('Saved as ' + n + '.', 2400); }); },
    openmovie: function (v) {
      MM.saveCurrent().then(function () { return DP.Store.get('movies', v); }).then(function (rec) { if (rec) return MM.openRecord(rec).then(function () { afterMovieLoaded(); }); });
    },
    delmovie: function (v) { MM.deleteMovie(v).then(refreshSaved); },
    expfile: function () {
      var blob = new Blob([MM.exportFileText()], { type: 'application/json' });
      MM.download(blob, 'dibs-' + MM.slug(MM.movie.title) + '.dibsmovie.json');
    },
    impfile: function () { $('fileMovie').click(); },
    newmovie: function () { $('confirmModal').hidden = false; $('cfYes').focus(); },
    showcase: function () { MM.saveCurrent().then(function () { return MM.setMovie(MM.clean(DP.movieShowcase())); }).then(afterMovieLoaded); }
  };
  function afterMovieLoaded() {
    $('mmTitle').value = MM.movie.title; $('mmPlatform').value = MM.movie.platform;
    pickFirst(); selKey = null; dirty = {};
    renderShots(); renderTimeline(); renderKeyBar(); renderPanel(); updateTime(); updateHistory();
  }
  function hop(n) {
    var it = selItem(); if (!it || !DP.isPuppet(it.kind)) return;
    var shot = MM.cur(), left = shot.duration - MM.t;
    if (left < 0.6) { App.msg('Move the playhead earlier to add a hop.'); return; }
    MM.pushUndo();
    var each = 0.55, count = Math.max(1, Math.min(n, Math.floor(left / each)));
    MM.motions.hop(shot, MM.base, it.id, MM.t, count, each);
    MM.touch(); renderTimeline(true); MM.seek(MM.t);
  }
  /* editing the bubble words or look while the playhead sits on a bubble key changes that key */
  function bubbleEdited() {
    var it = selItem(); if (!it) return;
    var tr = MM.getTrack(MM.cur(), 'item:' + it.id + '.bubble'); if (!tr) return;
    var i = MM.keyAt(tr, MM.t);
    if (i >= 0 && tr.keys[i].v) {
      undoBurst();
      MM.setKey(MM.cur(), tr.target, MM.t, { text: bubState.text, style: bubState.style, tail: bubState.tail });
      MM.touch(); renderTimeline(true); MM.seek(MM.t);
    }
  }
  var bubTimer = 0;

  function wireContent() {
    content.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      var name = b.getAttribute('data-act'), a = act[name] || UI.ext.act[name]; if (a) a(b.getAttribute('data-v'), b);
    });
    content.addEventListener('input', function (e) {
      var t = e.target;
      if (t.getAttribute && t.getAttribute('data-f')) {
        var id = t.getAttribute('data-f'), f = fieldDefs[id]; if (!f) return;
        activeField = id; undoBurst();
        var v = parseFloat(t.value); f.set(v);
        var out = $('o-' + id); if (out) out.textContent = f.text(v);
        App.bump();
      } else if (t.id === 'bubText') {
        bubState.text = t.value;
        clearTimeout(bubTimer); bubTimer = setTimeout(bubbleEdited, 300);
      } else if (t.id === 'capText') {
        capText = t.value;
        var tr = MM.getTrack(MM.cur(), 'caption'), i = tr ? MM.keyAt(tr, MM.t) : -1;
        if (i >= 0 && tr.keys[i].v) { undoBurst(); MM.setKey(MM.cur(), 'caption', MM.t, { text: capText }); MM.touch(); MM.seek(MM.t); MM.paintCaption(); renderTimeline(true); }
      } else if (t.id === 'shName') { MM.cur().name = t.value.slice(0, 40); MM.touch(); }
    });
    content.addEventListener('change', function (e) {
      var t = e.target;
      if (t.getAttribute && t.getAttribute('data-f')) { activeField = null; MM.touch(); }
      if (t.id === 'holdSel') {
        var it = selItem(); if (!it) return;
        MM.pushUndo();
        (it.attach || []).filter(function (a) { return a.kind.indexOf('symbol:') === 0 && a.slot === 'handR'; }).forEach(function (a) { App.detach(it.id, a.id); });
        if (t.value) App.attachTo(it.id, { kind: 'symbol:' + t.value, slot: 'handR' });
        MM.base = MM.baseFromScene(App.clean(App.serialize())); MM.touch();
      }
    });
    content.addEventListener('pointerup', function () { activeField = null; });
  }

  /* ---------- files ---------- */
  function wireFiles() {
    $('fileScene').addEventListener('change', function () {
      var f = this.files[0]; this.value = ''; if (!f) return;
      if (f.size > 60 * 1024 * 1024) { App.msg('That file is too big to be a scene.'); return; }
      var fr = new FileReader();
      fr.onload = function () {
        var obj; try { obj = JSON.parse(fr.result); } catch (e) { App.msg('That file is not a scene file.'); return; }
        var sc = obj && obj.scene ? obj.scene : obj;
        if (!sc || !Array.isArray(sc.items)) { App.msg('That file is not a scene file.'); return; }
        MM.addShot(sc, (f.name || 'Scene').replace(/\.dibsscene\.json$|\.json$/i, '').slice(0, 40));
      };
      fr.readAsText(f);
    });
    $('fileMovie').addEventListener('change', function () {
      var f = this.files[0]; this.value = ''; if (!f) return;
      if (f.size > 120 * 1024 * 1024) { App.msg('That file is too big to be a movie.'); return; }
      var fr = new FileReader();
      fr.onload = function () { MM.saveCurrent().then(function () { return MM.importFileText(fr.result); }).then(function () { afterMovieLoaded(); App.msg('Movie imported.'); }, function (e) { App.msg(e.message || 'That file is not a movie file.'); }); };
      fr.readAsText(f);
    });
    $('fileAudio').addEventListener('change', function () {
      var f = this.files[0]; this.value = ''; if (!f) return;
      MM.setAudioFile(f).then(function (ok) { if (ok) { App.msg('Sound added. Sound is on. Tap Play to hear it.', 3600); renderPanel(); } });
    });
    $('cfYes').addEventListener('click', function () {
      $('confirmModal').hidden = true;
      MM.saveCurrent().then(function () { return MM.setMovie(MM.newMovie('My movie')); }).then(afterMovieLoaded);
    });
    $('cfNo').addEventListener('click', function () { $('confirmModal').hidden = true; });
    $('cfTop').addEventListener('click', function () { $('confirmModal').hidden = true; });
  }

  /* ---------- export ---------- */
  var exResult = null, exUrl = '';
  function openExport() {
    if (MM.loading) return;
    MM.pause(); MM.commit();
    var m = MM.movie;
    if (!MM.canExport()) { App.msg('This browser cannot record video. Try a recent Chrome, Edge, Firefox or Safari.', 6000); return; }
    $('exSetup').hidden = false; $('exBusy').hidden = true; $('exDone').hidden = true;
    var fastOn = COARSE;
    $('exFast').setAttribute('aria-pressed', fastOn ? 'true' : 'false');
    $('exSound').hidden = !MM.hasSound();
    $('exSound').setAttribute('aria-pressed', MM.hasSound() ? 'true' : 'false');
    updateExSummary();
    $('exportModal').hidden = false; $('exStart').focus();
  }
  function updateExSummary() {
    var fast = $('exFast').getAttribute('aria-pressed') === 'true', sz = MM.exportSize(fast), tot = MM.total();
    $('exSummary').textContent = MM.platformInfo(MM.movie.platform).name + ', ' + sz.w + ' x ' + sz.h + ', ' + Math.round(tot * 10) / 10 + ' sec, ' + MM.frameCount() + ' frames';
    $('exNote').textContent = 'The video is saved as ' + (window.MediaRecorder && MediaRecorder.isTypeSupported('video/webm') ? 'a .webm file' : 'an .mp4 file') + ' at ' + MM.FPS + ' frames each second.';
  }
  function closeExport() { $('exportModal').hidden = true; if (exUrl) { URL.revokeObjectURL(exUrl); exUrl = ''; } $('exVideo').removeAttribute('src'); }
  function wireExport() {
    $('exFast').addEventListener('click', function () { this.setAttribute('aria-pressed', this.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); updateExSummary(); });
    $('exSound').addEventListener('click', function () { this.setAttribute('aria-pressed', this.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); });
    $('exClose').addEventListener('click', closeExport);
    $('exTop').addEventListener('click', function () { if (MM.exporting) { MM.cancelExport(); $('exHelp').textContent = 'Stopping'; } else closeExport(); });
    $('exBack').addEventListener('click', closeExport);
    $('exCancel').addEventListener('click', function () { MM.cancelExport(); $('exHelp').textContent = 'Stopping'; });
    $('exStart').addEventListener('click', function () {
      var fast = $('exFast').getAttribute('aria-pressed') === 'true', sound = !$('exSound').hidden && $('exSound').getAttribute('aria-pressed') === 'true';
      $('exSetup').hidden = true; $('exBusy').hidden = false; $('exDone').hidden = true;
      $('exHelp').textContent = 'Keep this page open. Each frame is drawn one at a time, then the video is recorded at normal speed.';
      $('mmExport').disabled = true;
      var t0 = Date.now();
      MM.exportVideo({ fast: fast, sound: sound }, function (p) {
        var pct = Math.round(p.frame / p.total * 100);
        $('exPhase').textContent = p.phase === 'draw' ? 'Frame ' + p.frame + ' of ' + p.total : 'Recording the video, ' + Math.round(p.frame / FPS) + ' of ' + Math.round(p.total / FPS) + ' sec';
        $('exBar').setAttribute('aria-valuenow', pct); $('exBarFill').style.width = pct + '%';
      }).then(function (res) {
        $('mmExport').disabled = false;
        exResult = res;
        if (exUrl) URL.revokeObjectURL(exUrl);
        exUrl = URL.createObjectURL(res.blob);
        $('exVideo').src = exUrl;
        $('exBusy').hidden = true; $('exDone').hidden = false;
        $('exInfo').textContent = Math.round(res.seconds * 10) / 10 + ' sec, ' + res.w + ' x ' + res.h + ', ' + (res.blob.size / 1048576).toFixed(1) + ' MB' + (res.sound ? ', with sound' : '') + '. Made in ' + Math.round((Date.now() - t0) / 1000) + ' sec.';
        $('exSave').focus();
      }, function (e) {
        $('mmExport').disabled = false;
        if (e && e.cancelled) { closeExport(); App.msg('Export stopped.'); return; }
        $('exBusy').hidden = true; $('exSetup').hidden = false;
        $('exNote').textContent = (e && e.message) ? e.message : 'The video could not be made. Try Fast, half size.';
        console.warn('export', e);
      });
    });
    $('exSave').addEventListener('click', function () {
      if (!exResult) return;
      MM.download(exResult.blob, 'dibs-' + MM.slug(MM.movie.title) + '-' + MM.movie.platform + '.' + exResult.ext);
    });
  }

  /* ---------- hooks that app.js calls ---------- */
  var refreshTimer = 0;
  function refreshSoon() { clearTimeout(refreshTimer); refreshTimer = setTimeout(function () { if (!MM.loading) { if (tab === 'item' || tab === 'camera' || tab === 'quick') renderPanel(); } }, 60); }
  UI.afterRender = function () {};
  UI.cameraChanged = function () { edited('camera.focus'); syncFields(); };
  UI.cameraMoved = function () {
    if (MM.playing || MM.loading) return;
    markDirty('camera.pos'); markDirty('camera.target');
    var shot = MM.cur(), tr = MM.getTrack(shot, 'camera.pos');
    if (tr && MM.keyAt(tr, MM.t) >= 0) { MM.setKey(shot, 'camera.pos', MM.t, live('camera.pos')); MM.setKey(shot, 'camera.target', MM.t, live('camera.target')); MM.touch(); }
    else if (tr) { if (!UI._hinted) { UI._hinted = true; App.msg('This shot has camera keys. Tap Set key to keep this view at ' + secs(MM.t) + '.', 3200); setTimeout(function () { UI._hinted = false; }, 6000); } }
  };
  UI.closeModals = function () { if (!$('exportModal').hidden && !MM.exporting) closeExport(); $('confirmModal').hidden = true; };
  UI.itemMoved = function () {
    var it = selItem(); if (!it) return;
    markDirty('item:' + it.id + '.pos'); markDirty('item:' + it.id + '.height');
    var shot = MM.cur();
    ['pos', 'height'].forEach(function (f) { var tg = 'item:' + it.id + '.' + f, tr = MM.getTrack(shot, tg); if (tr && MM.keyAt(tr, MM.t) >= 0) { MM.setKey(shot, tg, MM.t, live(tg)); MM.touch(); } });
    syncFields();
  };
  UI.itemsChanged = function () { if (!MM.loading) refreshSoon(); };
  UI.photoChanged = function () {};
  UI.rollChanged = function () {};
  UI.selectionChanged = function () { if (!MM.loading) { if (!MM.playing) renderPanel(); } };
  UI.stateLoaded = function () {};
  UI.stickerSelected = function () {};
  UI.stickersChanged = function () {};
  UI.tapFocusChanged = function () { edited('camera.focus'); syncFields(); };
  UI.ready = function () {
    MM.adopt(); pickFirst();
    MM._ready();
    $('mmTitle').value = MM.movie.title; $('mmPlatform').value = MM.movie.platform;
    renderShots(); renderTimeline(); renderKeyBar(); renderPanel(); updateTime(); updateHistory();
    if (document.body) document.body.setAttribute('data-mm', '1');
    loadingText('Getting your shots ready', true);
    MM.warmUp(function (i, n) { loadingText('Getting your shots ready, ' + (i + 1) + ' of ' + n, true); }).then(function () {
      pickFirst(); loadingText('', false); renderShots(); renderTimeline(); renderPanel();
      document.body.setAttribute('data-mm-ready', '1');
    });
  };
  function pickFirst() {
    if (UI.wantSel && App.findItem(UI.wantSel)) {            // after Undo or Redo: the same character is picked again, with its bar
      var w = UI.wantSel, c = UI.wantCtx; UI.wantSel = null; UI.wantCtx = null;
      if (App.edit) App.edit.quiet = false;
      App.select(w); if (c && UI.openCtx) UI.openCtx(c);
      return;
    }
    UI.wantSel = null;
    if (!App.sel || !App.findItem(App.sel)) {
      var p = puppets()[0];
      if (p) { if (App.edit) App.edit.quiet = true; App.select(p.id); }   // picked for you: its ring shows, its bar waits until you touch the picture
    }
  }

  /* ---------- loading note ---------- */
  var loadTimer = 0, warming = false;
  function loadingText(txt, on) {
    warming = on && !!txt;
    var el = $('mmLoading'); $('mmLoadingText').textContent = txt || 'Loading the shot';
    el.hidden = !on;
  }
  MM.on('loading', function (on) {
    clearTimeout(loadTimer);
    if (warming) return;
    if (on) loadTimer = setTimeout(function () { if (MM.loading) loadingText('Loading the shot', true); warming = false; }, 250);
    else loadingText('', false);
  });

  /* ---------- engine events ---------- */
  var tickAt = 0;
  MM.on('time', function () {
    updatePlayhead(); updateTime();
    var now = Date.now();
    if (!MM.playing || now - tickAt > 120) { tickAt = now; syncFields(); }
  });
  MM.on('play', updatePlay);
  MM.on('loaded', function () {
    pickFirst();
    selKey = selKey && curKey() ? selKey : null;
    renderShots(); renderTimeline(); renderKeyBar();
    if (!MM.playing) renderPanel();
    updateTime();
  });
  MM.on('shots', function () { renderShots(); updateTime(); });
  MM.on('tracks', function () { renderTimeline(true); renderKeyBar(); });
  MM.on('history', updateHistory);
  MM.on('title', function () { if (document.activeElement !== $('mmTitle')) $('mmTitle').value = MM.movie.title; $('mmPlatform').value = MM.movie.platform; });
  MM.on('audio', function () { if (tab === 'sound') renderPanel(); });

  /* ---------- keyboard ---------- */
  function wireKeys() {
    App.keysOff = true;
    window.addEventListener('keydown', function (e) {
      var tg = e.target;
      if (e.key === 'Escape' && !document.querySelector('.modal:not([hidden])') && UI.ctxNow && UI.ctxNow() && !(UI.isDrawing && UI.isDrawing())) { e.preventDefault(); UI.closeCtx(); return; }
      if (e.key === 'Escape' && !document.querySelector('.modal:not([hidden])') && isOpen() && !(UI.isDrawing && UI.isDrawing())) { e.preventDefault(); closeSheet(); return; }
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT') && tg.type !== 'range' && tg.type !== 'button') return;
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
          var ck = e.key.toLowerCase();
          if (ck === 'z') { e.preventDefault(); if (e.shiftKey) UI.redo(); else UI.undo(); }
          else if (ck === 'y') { e.preventDefault(); UI.redo(); }
          else if (ck === 'd' && App.sel && !MM.loading && !MM.playing) { e.preventDefault(); App.duplicateItem(App.sel); }
        }
        return;
      }
      if (document.querySelector('.modal:not([hidden])')) { if (e.key === 'Escape') UI.closeModals(); return; }
      if (tg && tg.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
      if (e.key === ' ') { e.preventDefault(); MM.togglePlay(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { if (tg && tg.type === 'range') return; e.preventDefault(); MM.pause(); MM.seek(MM.t + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1) / FPS); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { var c = curKey(); if (c) { e.preventDefault(); MM.pushUndo(); MM.removeKey(MM.cur(), selKey.target, c.i); selKey = null; MM.touch(); renderKeyBar(); renderTimeline(true); MM.seek(MM.t); } }
      else if (e.key === 'k' || e.key === 'K') { setKeyHere(); }
    });
  }

  /* ---------- start ---------- */
  buildTop(); buildSheet(); wireShots(); wireTimeline(); wireKeyBar(); wireContent(); wireFiles(); wireExport(); wireKeys();
  App.pad = { t: isPhone() ? 8 : 14, b: isPhone() ? 10 : 14, s: isPhone() ? 10 : 16 };
  window.addEventListener('resize', function () { App.pad = { t: isPhone() ? 8 : 14, b: isPhone() ? 10 : 14, s: isPhone() ? 10 : 16 }; });
  UI.h = { esc: esc, svgData: svgData, isPhone: isPhone, secs: secs, itemName: itemName, puppets: puppets, selItem: selItem, openSheet: openSheet, closeSheet: closeSheet, isOpen: isOpen, showPage: showPage, pushLayer: pushLayer, dropLayer: dropLayer, renderPanel: renderPanel, renderTimeline: renderTimeline, renderShots: renderShots, renderKeyBar: renderKeyBar, updateTime: updateTime, afterMovieLoaded: function () { afterMovieLoaded(); }, getTab: function () { return tab; }, undoBurst: undoBurst, act: act, clearDirty: function (target) { delete dirty[target]; }, svgi: svgi, syncFields: syncFields };
  if (DP.movieEdit) DP.movieEdit.setup(UI);
  tab = isPhone() ? 'quick' : 'item';
  if (!isPhone()) openSheet(); else applyView();
  MM.start().then(function () {
    if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) window.addEventListener('load', function () { var hadSw = !!navigator.serviceWorker.controller, reloaded = false; navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadSw && !reloaded) { reloaded = true; location.reload(); } }); navigator.serviceWorker.register('sw.js').catch(function () {}); });
  });
  window.addEventListener('resize', function () { MM.paintCaption(); });
  if (window.ResizeObserver) new ResizeObserver(function () { MM.paintCaption(); }).observe($('frameBox'));
})();
