/* DIBS Movie Maker: the Quick tab (screen).
   A short list of commands for each character, a Draw path tool, Auto camera, a typed script and saved recipes.
   All of it writes ordinary keys through MM.compileActions (movie-actions.js), so the timeline, the key bar and export work as before. */
(function () {
  'use strict';
  var DP = window.DP, App = DP.app, MM = DP.movie, UI = App.ui, A = window.DIBS_ASSETS;
  var THREE = window.THREEPKG.THREE;
  var H = UI.h, $ = function (id) { return document.getElementById(id); };
  var esc = H.esc, svgData = H.svgData;

  var editing = -1, drawing = null, drawLayer = null, scriptText = '', scriptConfirm = false, undoAt = 0;
  var lastHint = '';

  /* ---------- small helpers ---------- */
  function sel() { var it = H.selItem(); return it && DP.isPuppet(it.kind) ? it : null; }
  function sym(name) { return A.symbols[name] ? svgData(A.symbols[name]) : ''; }
  function r1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function listOf(it) { return MM.getList(MM.cur(), it.id); }
  var POSE_ICON = { stand: 'calm', shrug: 'different', proud: 'good', peek: 'look', point: 'that', wave: 'happy', hop: 'up' };
  var STYLE_NAME = { speech: 'Speech', thought: 'Thought', shout: 'Shout', sign: 'Sign' };
  function poseName(id) { var p = DP.POSES.filter(function (x) { return x.id === id; })[0]; return p ? p.name : id; }
  function costumeName(id) { var c = DP.costumeInfo(id); return c ? c.name : 'Nothing'; }
  function shortText(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '...' : s; }
  function targetName(t) {
    if (t === 'left') return 'left'; if (t === 'right') return 'right'; if (!t || t === 'camera') return 'the camera';
    var it = App.findItem(t); return it ? H.itemName(it) : 'the camera';
  }
  function label(a) {
    switch (a.type) {
      case 'walk': return a.follow ? 'Walk path, camera follows' : 'Walk path';
      case 'wave': return 'Wave';
      case 'say': return 'Say: ' + shortText(a.text, 30);
      case 'emote': var e = DP.emoteInfo(a.id); return 'Emote: ' + (e ? e.name : a.id);
      case 'pose': return 'Pose: ' + poseName(a.preset);
      case 'hop': return 'Hop';
      case 'look': return 'Look at ' + targetName(a.target);
      case 'wait': return 'Wait';
      case 'wear': return a.costume === 'none' ? 'Take off costume' : 'Wear: ' + costumeName(a.costume);
      case 'enter': return 'Enter';
      case 'exit': return 'Exit';
    }
    return a.type;
  }
  function icon(a) {
    var n = '';
    switch (a.type) {
      case 'walk': n = 'go'; break; case 'wave': n = 'happy'; break; case 'say': n = 'chat'; break; case 'hop': n = 'up'; break;
      case 'look': n = a.target === 'left' ? 'left' : a.target === 'right' ? 'right' : 'look'; break; case 'wait': n = 'wait'; break;
      case 'enter': n = 'in'; break; case 'exit': n = 'finished'; break; case 'pose': n = POSE_ICON[a.preset] || 'calm'; break;
      case 'emote': var e = DP.emoteInfo(a.id); return e ? svgData(e.svg) : '';
      case 'wear': return a.costume !== 'none' && A.costumes[a.costume] ? svgData(A.costumes[a.costume]) : sym('put');
    }
    return sym(n);
  }
  var NEW = {
    wave: { type: 'wave' }, hop: { type: 'hop' }, wait: { type: 'wait', sec: 1 }, enter: { type: 'enter' }, exit: { type: 'exit' },
    pose: function (v) { return { type: 'pose', preset: v }; }, emote: function (v) { return { type: 'emote', id: v }; },
    wear: function (v) { return { type: 'wear', costume: v }; }, look: function (v) { return { type: 'look', target: v }; }
  };

  /* ---------- the panel ---------- */
  function rowHtml(a, i, tm, total) {
    var open = i === editing, ic = icon(a);
    return '<li class="qk-row' + (open ? ' open' : '') + '" data-i="' + i + '">' +
      '<div class="qk-line">' +
      '<button type="button" class="qk-handle" data-i="' + i + '" aria-label="Drag to move this command. Or use Up and Down."><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M5 12h14M5 16h14"/></svg></button>' +
      '<button type="button" class="qk-main" data-act="qk-edit" data-v="' + i + '" aria-expanded="' + open + '">' + (ic ? '<img alt="" src="' + ic + '">' : '<span class="qk-noimg"></span>') + '<span class="qk-text"><span class="qk-name">' + esc(label(a)) + '</span><span class="qk-time">' + (tm ? r1(tm.t1 - tm.t0) + ' sec' : '') + '</span></span></button>' +
      '<button type="button" class="qk-mini" data-act="qk-up" data-v="' + i + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up">Up</button>' +
      '<button type="button" class="qk-mini" data-act="qk-down" data-v="' + i + '"' + (i === total - 1 ? ' disabled' : '') + ' aria-label="Move down">Down</button>' +
      '<button type="button" class="qk-mini del" data-act="qk-del" data-v="' + i + '" aria-label="Delete this command"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '</div>' + (open ? '<div class="qk-edit">' + editorHtml(a, i) + '</div>' : '') + '</li>';
  }
  function chipRow(act, items, cur) {
    return '<div class="chips">' + items.map(function (o) { return '<button type="button" class="chip' + (o.img ? ' thumb' : '') + '" data-act="' + act + '" data-v="' + esc(o.v) + '" aria-pressed="' + (o.v === cur) + '">' + (o.img ? '<img alt="" src="' + o.img + '">' : '') + esc(o.n) + '</button>'; }).join('') + '</div>';
  }
  function segHtml(act, items, cur, aria) {
    return '<div class="seg" role="group" aria-label="' + aria + '">' + items.map(function (o) { return '<button type="button" data-act="' + act + '" data-v="' + o[0] + '" aria-pressed="' + (String(o[0]) === String(cur)) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  }
  function editorHtml(a, i) {
    var h = '', it = sel();
    if (a.type === 'walk') {
      var sp = a.speed < 0.95 ? 'slow' : a.speed > 1.6 ? 'fast' : 'normal';
      h += '<p class="small">Walking speed</p>' + segHtml('qk-speed', [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']], sp, 'Walking speed');
      h += '<button type="button" class="tog" data-act="qk-follow" aria-pressed="' + !!a.follow + '"><span>Camera follows</span><span class="track" aria-hidden="true"></span></button>';
      h += '<div class="row gap"><button type="button" class="btn small" data-act="qk-redraw" data-v="' + i + '">Draw this path again</button></div>';
    } else if (a.type === 'say') {
      h += '<label class="small" for="qkSay">What it says</label><textarea id="qkSay" rows="2" maxlength="160" aria-label="What it says">' + esc(a.text) + '</textarea>';
      h += '<p class="small gap">Kind of bubble</p>' + segHtml('qk-style', DP.BUBBLES.map(function (b) { return [b.id, STYLE_NAME[b.id] || b.name]; }), a.style, 'Kind of bubble');
    } else if (a.type === 'emote') {
      h += chipRow('qk-setemote', DP.EMOTES.map(function (e) { return { v: e.id, n: e.name, img: svgData(e.svg) }; }), a.id);
    } else if (a.type === 'pose') {
      h += chipRow('qk-setpose', DP.POSES.filter(function (p) { return p.id !== 'hop' && p.id.indexOf('look') !== 0; }).map(function (p) { return { v: p.id, n: p.name, img: sym(POSE_ICON[p.id] || 'calm') }; }), a.preset);
    } else if (a.type === 'look') {
      var opts = [{ v: 'left', n: 'Left' }, { v: 'right', n: 'Right' }, { v: 'camera', n: 'Camera' }];
      H.puppets().forEach(function (o) { if (it && o.id !== it.id) opts.push({ v: o.id, n: H.itemName(o) }); });
      h += chipRow('qk-setlook', opts, a.target);
    } else if (a.type === 'wait') {
      h += '<div class="row"><button type="button" class="btn sq" data-act="qk-wait" data-v="-0.5" aria-label="Half a second shorter">' + H.svgi('minus') + '</button><span class="kb-val" id="qkWait">' + r1(a.sec) + ' sec</span><button type="button" class="btn sq" data-act="qk-wait" data-v="0.5" aria-label="Half a second longer">' + H.svgi('plus') + '</button></div>';
    } else if (a.type === 'wear') {
      h += chipRow('qk-setwear', [{ v: 'none', n: 'Nothing' }].concat(DP.COSTUMES.map(function (c) { return { v: c.id, n: c.name, img: svgData(A.costumes[c.id]) }; })), a.costume);
    } else {
      h += '<p class="hint">Nothing to set for this one.</p>';
    }
    return h;
  }

  function panel() {
    var shot = MM.cur(), it = sel(), ps = H.puppets(), h = '';
    h += '<div class="group qk-cast"><div class="chips">' + ps.map(function (o) {
      var ob = App.objs[o.id], n = (MM.getList(shot, o.id) || []).length;
      return '<button type="button" class="chip thumb" data-act="pick" data-v="' + o.id + '" aria-pressed="' + (o.id === App.sel) + '">' + (ob && ob.thumb ? '<img alt="" src="' + ob.thumb + '">' : '') + esc(H.itemName(o)) + (n ? ' (' + n + ')' : '') + '</button>';
    }).join('') + '</div>' + (ps.length ? (it ? '' : '<p class="hint">Tap a character here or in the picture to give it commands.</p>') : '<p class="hint">This shot has no characters yet. Add one in the Item tab, or write a Script.</p>') + '</div>';
    if (it) {
      var list = listOf(it), info = MM.actionPlan(shot), tm = info.times[it.id] || [];
      h += '<div class="group"><h3>Commands for ' + esc(H.itemName(it)) + '</h3>';
      h += '<div class="qk-top"><button type="button" class="btn" data-act="qk-draw" aria-pressed="' + !!(drawing && drawing.id === it.id) + '">' + (drawing ? 'Cancel drawing' : 'Draw path') + '</button><button type="button" class="btn primary" data-act="qk-add">Add a command</button></div>';
      if (list.length) {
        h += '<ol class="qk-list" id="qkList">' + list.map(function (a, i) { return rowHtml(a, i, tm[i], list.length); }).join('') + '</ol>';
        h += '<p class="hint" id="qkRun">' + runNote(shot, info) + '</p>';
        h += '<div class="row"><button type="button" class="btn small" data-act="qk-recipe">Save as recipe</button><button type="button" class="btn small danger" data-act="qk-clear">Clear list</button></div>';
      } else {
        h += '<p class="hint" id="qkRun">No commands yet. Tap Add a command, or Draw path and drag on the floor.</p>';
      }
      h += '</div>';
    }
    h += '<div class="group"><h3>This shot</h3>';
    h += '<button type="button" class="tog" data-act="qk-auto" aria-pressed="' + !!shot.autoCamera + '"><span>Auto camera</span><span class="track" aria-hidden="true"></span></button>';
    h += '<p class="hint">Frames the whole scene, then eases in on whoever is talking. Setting a camera key by hand turns it off.</p>';
    h += '<div class="row"><button type="button" class="btn" data-act="openscript">Script</button></div>';
    h += '<p class="hint">Type lines like Dibs: Hey Chicago! and build them into commands.</p></div>';
    return h;
  }
  function runNote(shot, info) {
    var n = info.needed;
    if (!n) return '';
    if (n > MM.MAX_DUR - (MM.total() - shot.duration) + 1e-6) return 'These commands run ' + Math.round(n) + ' sec. A movie can be 60 sec, so the end is cut off.';
    return 'Commands run in order, top to bottom. This shot runs ' + r1(shot.duration) + ' sec.';
  }
  UI.ext.quickPanel = panel;
  UI.ext.quickAfter = function () { refreshViz(); };

  /* the row names and times change while typing, without redrawing the panel (that would close the keyboard) */
  function refreshRows() {
    var shot = MM.cur(), it = sel(); if (!it) return;
    var list = listOf(it), info = MM.actionPlan(shot), tm = info.times[it.id] || [];
    var rows = document.querySelectorAll('#qkList .qk-row');
    Array.prototype.forEach.call(rows, function (row, i) {
      if (!list[i]) return;
      row.querySelector('.qk-name').textContent = label(list[i]);
      row.querySelector('.qk-time').textContent = tm[i] ? r1(tm[i].t1 - tm[i].t0) + ' sec' : '';
    });
    var run = $('qkRun'); if (run) run.textContent = runNote(shot, info);
  }

  /* ---------- changing a list ---------- */
  function afterChange(opts) {
    opts = opts || {};
    var shot = MM.cur();
    MM.compileActions(shot);
    H.renderShots(); H.renderTimeline(true); H.updateTime();
    if (opts.panel !== false) H.renderPanel(); else refreshRows();
    var it = sel();
    var at = opts.at;
    if (at === undefined) at = MM.t;
    MM.seek(Math.min(at, shot.duration));
    refreshViz();
    thumbSoon();
  }
  /* the shot picture in the strip is taken again a moment after the last change */
  var thumbT = 0;
  function thumbSoon() {
    clearTimeout(thumbT);
    thumbT = setTimeout(function () {
      var sh = MM.cur();
      if (!sh || MM.loading || MM.playing || MM.exporting) return;
      MM.thumbFor(sh, true, true); H.renderShots();
    }, 700);
  }
  function seekToAction(i) {
    var it = sel(), info = MM.actionPlan(MM.cur()), tm = info.times[it.id] && info.times[it.id][i];
    return tm ? tm.t0 + Math.min(0.5, (tm.t1 - tm.t0) * 0.5) : MM.t;
  }
  function edit(fn, opts) {
    var it = sel(); if (!it) return;
    MM.pause(); MM.pushUndo();
    var list = clone(listOf(it));
    var r = fn(list);
    MM.setList(MM.cur(), it.id, r || list);
    afterChange(opts);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function addAction(a, extra) {
    var it = sel(); if (!it || !a) return;
    var c = MM.cleanAction(a); if (!c) return;
    var idx;
    edit(function (list) { list.push(c); idx = list.length - 1; return list; }, { panel: true });
    var t = seekToAction(idx); MM.seek(t);
    return idx;
  }

  function endPos(it) { var info = MM.actionPlan(MM.cur()), e = info.end[it.id]; return e ? [e.x, e.z] : [it.x, it.z]; }

  /* ---------- Draw path ---------- */
  function startDraw(redrawIdx) {
    var it = sel(); if (!it) { App.msg('Pick a character first.'); return; }
    MM.pause(); closeModal();
    if (App.drawHook) stopDraw(true);
    if (H.isPhone()) H.closeSheet();
    drawing = { id: it.id, raw: [], redraw: typeof redrawIdx === 'number' ? redrawIdx : -1 };
    drawLayer = H.pushLayer(function () { drawLayer = null; stopDraw(false, true); App.msg('Drawing stopped.', 1800); });
    App.ringOff = true; App.updateRing();
    $('drawHelp').textContent = 'Draw on the floor with your ' + (window.matchMedia('(pointer:coarse)').matches ? 'finger' : 'mouse');
    $('drawBar').hidden = false;
    App.drawHook = {
      start: function (p) { drawing.raw = p ? [[p.x, p.z]] : []; vizLive(); },
      move: function (p) {
        if (!p || !drawing) return;
        var l = drawing.raw[drawing.raw.length - 1];
        if (!l || Math.hypot(p.x - l[0], p.z - l[1]) > 0.06) { drawing.raw.push([p.x, p.z]); vizLive(); }
      },
      end: function (cancel) { finishDraw(!!cancel); }
    };
    $('stage').classList.add('drawing');
    syncDrawButton();
  }
  /* leave draw mode. reopen: go back to the Quick page (Cancel, Escape, back). */
  function stopDraw(silent, reopen) {
    var was = !!drawing;
    App.drawHook = null; drawing = null;
    if (drawLayer) { var l = drawLayer; drawLayer = null; H.dropLayer(l); }
    $('stage').classList.remove('drawing');
    $('drawBar').hidden = true;
    App.ringOff = false; App.updateRing();
    if (!silent) syncDrawButton();
    refreshViz();
    if (was && reopen) H.openSheet('quick');
  }
  UI.isDrawing = function () { return !!drawing; };
  function syncDrawButton() {
    var b = document.querySelector('[data-act="qk-draw"]');
    if (b) { b.textContent = drawing ? 'Cancel drawing' : 'Draw path'; b.setAttribute('aria-pressed', drawing ? 'true' : 'false'); }
  }
  function finishDraw(cancel) {
    var d = drawing; if (!d) return;
    var it = App.findItem(d.id);
    var pts = d.raw.length ? MM.simplifyPath(d.raw, 0.1) : [];
    var len = 0; for (var i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (cancel || !it) { stopDraw(false, true); return; }
    if (pts.length < 2 || len < 0.35) { d.raw = []; vizLive(); App.msg('That path is too short. Drag farther along the floor.', 3000); return; }
    if (pts.length > 40) pts = pts.filter(function (p, k) { return k % Math.ceil(pts.length / 40) === 0 || k === pts.length - 1; });
    var redraw = d.redraw, before = listOf(it), info = MM.actionPlan(MM.cur()), from;
    if (redraw >= 0 && before[redraw] && before[redraw].type === 'walk') {
      var nth = 0; for (i = 0; i < redraw; i++) if (before[i].type === 'walk') nth++;
      var wp = (info.paths[it.id] || [])[nth]; from = wp ? wp.pts[0] : endPos(it);
    } else { redraw = -1; from = endPos(it); }
    stopDraw(true);
    var idx, speed = redraw >= 0 ? before[redraw].speed : MM.SPEEDS.normal;
    var r3 = function (v) { return Math.round(v * 1000) / 1000; };
    MM.lastPath = pts.map(function (p) { return [r3(p[0] - from[0]), r3(p[1] - from[1])]; });
    var act = { type: 'walk', path: pts.map(function (p) { return [r3(p[0]), r3(p[1])]; }), speed: speed, follow: redraw >= 0 ? !!before[redraw].follow : false };
    edit(function (list) {
      if (redraw >= 0 && list[redraw]) { list[redraw] = MM.cleanAction(act); idx = redraw; }
      else { list.push(MM.cleanAction(act)); idx = list.length - 1; }
      return list;
    });
    editing = idx; H.openSheet('quick');
    var rowEl = document.querySelector('#qkList .qk-row.open'); if (rowEl && rowEl.scrollIntoView) rowEl.scrollIntoView({ block: 'nearest' });
    MM.seek(seekToAction(idx));
    App.msg('The path is in the list. Tap Play to watch ' + H.itemName(it) + ' walk it.', 3600);
  }

  /* ---------- the path on the floor (editor only) ---------- */
  var vizObj = null;
  function clearViz() {
    var L = App.editorLayer; if (!L) return;
    while (L.children.length) { var c = L.children.pop(); if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }
  }
  function ribbon(pts, color) {
    var pos = [], idx = [], dash = 0.2, gap = 0.12, w = 0.065, y = 0.02, on = true, left = dash, a, b, k, v = 0;
    function quad(ax, az, bx, bz, nx, nz) {
      pos.push(ax + nx * w, y, az + nz * w, ax - nx * w, y, az - nz * w, bx - nx * w, y, bz - nz * w, bx + nx * w, y, bz + nz * w);
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
    }
    for (k = 1; k < pts.length; k++) {
      a = pts[k - 1]; b = pts[k];
      var dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz); if (len < 1e-5) continue;
      var ux = dx / len, uz = dz / len, nx = -uz, nz = ux, t = 0;
      while (t < len - 1e-6) {
        var take = Math.min(left, len - t);
        if (on) quad(a[0] + ux * t, a[1] + uz * t, a[0] + ux * (t + take), a[1] + uz * (t + take), nx, nz);
        t += take; left -= take;
        if (left <= 1e-6) { on = !on; left = on ? dash : gap; }
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, depthWrite: false }));
    m.renderOrder = 4; m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false;
    return m;
  }
  function dot(p, r, color) {
    var m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(p[0], 0.022, p[1]); m.renderOrder = 4; m.castShadow = false; m.frustumCulled = false;
    return m;
  }
  function refreshViz() {
    var L = App.editorLayer; if (!L) return;
    clearViz();
    var it = sel(), shot = MM.cur();
    var show = it && shot && !MM.playing && !MM.exporting && H.getTab() === 'quick';
    L.visible = !!show;
    if (!show) { App.invalidate(); return; }
    var info = MM.actionPlan(shot), ps = info.paths[it.id] || [];
    ps.forEach(function (p) {
      L.add(ribbon(p.pts, 0x2a2350));
      L.add(dot(p.pts[0], 0.085, 0xfffdf8)); L.add(dot(p.pts[0], 0.06, 0x2a2350));
      L.add(dot(p.pts[p.pts.length - 1], 0.12, 0x3b2f9e));
    });
    App.invalidate();
  }
  function vizLive() {
    var L = App.editorLayer; if (!L || !drawing) return;
    clearViz(); L.visible = true;
    var it = App.findItem(drawing.id); if (!it) return;
    var from = drawing.redraw >= 0 ? [it.x, it.z] : endPos(it), pts = [from].concat(drawing.raw);
    if (pts.length > 1) { L.add(ribbon(pts, 0x3b2f9e)); L.add(dot(pts[pts.length - 1], 0.12, 0x3b2f9e)); }
    L.add(dot(from, 0.085, 0xfffdf8)); L.add(dot(from, 0.06, 0x2a2350));
    App.invalidate();
  }

  /* ---------- the sheet (Add, Say, Script, recipe name) ---------- */
  var modal = null, modalLayer = null;
  function buildModal() {
    modal = document.createElement('div');
    modal.id = 'qkModal'; modal.className = 'modal'; modal.hidden = true;
    modal.innerHTML = '<div class="dlg mmdlg qk-dlg" role="dialog" aria-modal="true" aria-labelledby="qkTitle"><header class="sh-head"><h2 id="qkTitle"></h2><button type="button" class="sh-done" id="qkClose">Close</button></header><div class="dlgbody" id="qkBody"></div></div>';
    document.body.appendChild(modal);
    $('qkClose').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) { closeModal(); return; }
      var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      var a = UI.ext.act[b.getAttribute('data-act')]; if (a) a(b.getAttribute('data-v'), b);
    });
    modal.addEventListener('input', function (e) {
      if (e.target.id === 'qkScript') { scriptText = e.target.value; scriptConfirm = false; syncScript(); }
      else if (e.target.getAttribute && e.target.getAttribute('data-tk')) { tplVals[e.target.getAttribute('data-tk')] = e.target.value; tplConfirm = false; var w = $('qkTplWarn'); if (w) w.innerHTML = ''; }
    });
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) { e.stopPropagation(); closeModal(); } }, true);
  }
  function openModal(title, html, noFocus) {
    if (!modal) buildModal();
    $('qkTitle').textContent = title; $('qkBody').innerHTML = html; modal.hidden = false;
    if (!modalLayer) modalLayer = H.pushLayer(function () { modalLayer = null; closeModal(true); });
    $('qkBody').scrollTop = 0; modal.querySelector('.dlg').scrollTop = 0;
    var f = noFocus ? null : modal.querySelector('textarea,input'); if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 30);
  }
  function closeModal(fromBack) {
    if (modalLayer && fromBack !== true) { var l = modalLayer; modalLayer = null; H.dropLayer(l); }
    if (modal) modal.hidden = true;
  }

  function tile(act, v, name, img, extra) {
    return '<button type="button" class="qk-tile" data-act="' + act + '" data-v="' + esc(v) + '"' + (extra || '') + '>' + (img ? '<img alt="" src="' + img + '">' : '<span class="qk-noimg"></span>') + '<span>' + esc(name) + '</span></button>';
  }
  function addGrid(recipes) {
    var it = sel(), h = '<p class="hint">Pick what ' + esc(it ? H.itemName(it) : 'the character') + ' does next. It goes at the end of the list.</p>';
    h += '<h3>Moves</h3><div class="qk-grid">' +
      tile('qk-new', 'walk', 'Walk path', sym('go')) + tile('qk-new', 'wave', 'Wave', sym('happy')) + tile('qk-new', 'say', 'Say', sym('chat')) +
      tile('qk-new', 'hop', 'Hop', sym('up')) + tile('qk-new', 'look', 'Look', sym('look')) + tile('qk-new', 'wait', 'Wait', sym('wait')) +
      tile('qk-new', 'wear', 'Wear', A.costumes['cap-blue'] ? svgData(A.costumes['cap-blue']) : '') + '</div>';
    h += '<h3>Poses</h3><div class="qk-grid">' + DP.POSES.filter(function (p) { return p.id !== 'hop' && p.id.indexOf('look') !== 0 && p.id !== 'wave'; }).map(function (p) { return tile('qk-newpose', p.id, p.name, sym(POSE_ICON[p.id] || 'calm')); }).join('') + '</div>';
    h += '<h3>Emotes</h3><div class="qk-grid">' + DP.EMOTES.map(function (e) { return tile('qk-newemote', e.id, e.name, svgData(e.svg)); }).join('') + '</div>';
    h += '<h3>Recipes</h3><div class="qk-grid" id="qkRecipes">' + recipeTiles(recipes) + '</div>';
    return h;
  }
  function recipeTiles(list) {
    if (!list) return '<p class="hint">Loading</p>';
    return list.map(function (r) {
      return '<div class="qk-rtile">' + tile('qk-recipego', r.id, r.name, sym('play')) + (r.builtin ? '' : '<button type="button" class="qk-mini wide" data-act="qk-recipedel" data-v="' + esc(r.id) + '">Delete</button>') + '</div>';
    }).join('');
  }
  var recipeCache = [];
  function openAdd() {
    var it = sel(); if (!it) { App.msg('Pick a character first.'); return; }
    MM.pause();
    openModal('Add a command', addGrid(null));
    MM.recipeList().then(function (list) {
      recipeCache = list;
      var box = $('qkRecipes'); if (box) box.innerHTML = recipeTiles(list);
    });
  }
  function sayEditor() {
    return '<label class="small" for="qkSayNew">What does ' + esc(H.itemName(sel())) + ' say?</label><textarea id="qkSayNew" rows="3" maxlength="160" placeholder="Hey Chicago!" aria-label="What it says"></textarea>' +
      '<p class="small gap">Kind of bubble</p><div class="seg" role="group" aria-label="Kind of bubble">' + DP.BUBBLES.map(function (b, i) { return '<button type="button" data-act="qk-newstyle" data-v="' + b.id + '" aria-pressed="' + (i === 0) + '">' + (STYLE_NAME[b.id] || b.name) + '</button>'; }).join('') + '</div>' +
      '<div class="row"><button type="button" class="btn primary" data-act="qk-saysave">Add the words</button></div>';
  }
  var newStyle = 'speech';

  UI.ext.act['qk-new'] = function (v) {
    var it = sel(); if (!it) return;
    if (v === 'walk') { startDraw(); return; }
    if (v === 'say') { newStyle = 'speech'; openModal('Say something', sayEditor()); return; }
    if (v === 'look') {
      var opts = [['left', 'Left', sym('left')], ['right', 'Right', sym('right')], ['camera', 'The camera', sym('look')]];
      H.puppets().forEach(function (o) { if (o.id !== it.id) opts.push([o.id, H.itemName(o), App.objs[o.id] && App.objs[o.id].thumb]); });
      openModal('Look at', '<div class="qk-grid">' + opts.map(function (o) { return tile('qk-newlook', o[0], o[1], o[2]); }).join('') + '</div>'); return;
    }
    if (v === 'wear') {
      openModal('Wear', '<div class="qk-grid">' + tile('qk-newwear', 'none', 'Nothing', sym('stop')) + DP.COSTUMES.map(function (c) { return tile('qk-newwear', c.id, c.name, svgData(A.costumes[c.id])); }).join('') + '</div>'); return;
    }
    closeModal();
    addAction(clone(NEW[v]));
  };
  UI.ext.act['qk-newpose'] = function (v) { closeModal(); addAction(NEW.pose(v)); };
  UI.ext.act['qk-newemote'] = function (v) { closeModal(); addAction(NEW.emote(v)); };
  UI.ext.act['qk-newlook'] = function (v) { closeModal(); addAction(NEW.look(v)); };
  UI.ext.act['qk-newwear'] = function (v) { closeModal(); addAction(NEW.wear(v)); };
  UI.ext.act['qk-newstyle'] = function (v) {
    newStyle = v;
    Array.prototype.forEach.call(modal.querySelectorAll('[data-act="qk-newstyle"]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === v ? 'true' : 'false'); });
  };
  UI.ext.act['qk-saysave'] = function () {
    var t = ($('qkSayNew').value || '').trim();
    if (!t) { App.msg('Type the words first.'); return; }
    closeModal(); addAction({ type: 'say', text: t, style: newStyle });
  };
  UI.ext.act['qk-recipego'] = function (v) {
    var it = sel(), r = recipeCache.filter(function (x) { return x.id === v; })[0]; if (!it || !r) return;
    closeModal();
    var acts = MM.recipeActions(MM.cur(), it.id, r), first;
    if (!acts.length) return;
    edit(function (list) { first = list.length; return list.concat(acts); });
    MM.seek(seekToAction(first));
    App.msg('Added the recipe ' + r.name + '.', 2600);
  };
  UI.ext.act['qk-recipedel'] = function (v) {
    MM.deleteRecipe(v).then(function () { return MM.recipeList(); }).then(function (list) { recipeCache = list; var box = $('qkRecipes'); if (box) box.innerHTML = recipeTiles(list); });
  };

  /* ---------- the list: edit, move, delete ---------- */
  UI.ext.act['qk-draw'] = function () { if (drawing) stopDraw(false, true); else startDraw(); };
  UI.ext.act['qk-add'] = openAdd;
  UI.ext.act['qk-redraw'] = function (v) { startDraw(parseInt(v, 10)); };
  UI.ext.act['qk-edit'] = function (v) {
    var i = parseInt(v, 10); editing = editing === i ? -1 : i;
    H.renderPanel();
    if (editing >= 0) { MM.pause(); MM.seek(seekToAction(editing)); }
  };
  UI.ext.act['qk-up'] = function (v) { var i = parseInt(v, 10); if (i < 1) return; edit(function (l) { var x = l.splice(i, 1)[0]; l.splice(i - 1, 0, x); editing = i - 1; return l; }); };
  UI.ext.act['qk-down'] = function (v) { var i = parseInt(v, 10); edit(function (l) { if (i >= l.length - 1) return l; var x = l.splice(i, 1)[0]; l.splice(i + 1, 0, x); editing = i + 1; return l; }); };
  UI.ext.act['qk-del'] = function (v) { var i = parseInt(v, 10); editing = -1; edit(function (l) { l.splice(i, 1); return l; }); App.msg('The command was deleted. Tap Undo to bring it back.', 2800); };
  UI.ext.act['qk-clear'] = function () { editing = -1; edit(function () { return []; }); App.msg('The list is empty. Tap Undo to bring it back.', 2600); };
  function setField(fn) { var i = editing; if (i < 0) return; edit(function (l) { if (l[i]) fn(l[i]); return l; }, { at: undefined }); editing = i; H.renderPanel(); MM.seek(seekToAction(i)); }
  UI.ext.act['qk-speed'] = function (v) { setField(function (a) { a.speed = MM.SPEEDS[v] || 1.2; }); };
  UI.ext.act['qk-follow'] = function () { setField(function (a) { a.follow = !a.follow; }); };
  UI.ext.act['qk-style'] = function (v) { setField(function (a) { a.style = v; }); };
  UI.ext.act['qk-setemote'] = function (v) { setField(function (a) { a.id = v; }); };
  UI.ext.act['qk-setpose'] = function (v) { setField(function (a) { a.preset = v; }); };
  UI.ext.act['qk-setlook'] = function (v) { setField(function (a) { a.target = v; }); };
  UI.ext.act['qk-setwear'] = function (v) { setField(function (a) { a.costume = v; }); };
  UI.ext.act['qk-wait'] = function (v) {
    var i = editing, d = parseFloat(v);
    edit(function (l) { if (l[i]) l[i].sec = Math.max(0.5, Math.min(30, Math.round((l[i].sec + d) * 2) / 2)); return l; }, { panel: false });
    var l = listOf(sel()), w = $('qkWait'); if (w && l[i]) w.textContent = r1(l[i].sec) + ' sec';
  };
  UI.ext.act['qk-auto'] = function () {
    var shot = MM.cur();
    if (!shot.autoCamera && MM.hasManualCamera(shot)) { App.msg('This shot has camera keys you made. Delete them in the timeline to use Auto camera.', 5200); return; }
    MM.pause(); MM.pushUndo();
    shot.autoCamera = !shot.autoCamera;
    afterChange();
    App.msg(shot.autoCamera ? 'Auto camera is on.' : 'Auto camera is off.', 2000);
  };
  MM.on('autocam', function () { var b = document.querySelector('[data-act="qk-auto"]'); if (b) b.setAttribute('aria-pressed', MM.cur() && MM.cur().autoCamera ? 'true' : 'false'); });

  /* typing in the Say box of a row */
  document.getElementById('mmContent').addEventListener('input', function (e) {
    if (e.target.id !== 'qkSay') return;
    var i = editing, txt = e.target.value;
    clearTimeout(UI._qkT);
    UI._qkT = setTimeout(function () {
      if (Date.now() - undoAt > 900) { MM.pushUndo(); } undoAt = Date.now();
      var it = sel(); if (!it) return;
      var list = clone(listOf(it)); if (!list[i]) return;
      list[i].text = txt.replace(/\s+/g, ' ').slice(0, 160) || ' ';
      if (!txt.trim()) return;
      MM.setList(MM.cur(), it.id, list);
      afterChange({ panel: false, at: seekToAction(i) });
    }, 350);
  });

  /* ---------- drag to move a row ---------- */
  (function wireDrag() {
    var drag = null, host = document.getElementById('mmContent');
    host.addEventListener('pointerdown', function (e) {
      var h = e.target.closest('.qk-handle'); if (!h) return;
      var row = h.closest('.qk-row'), rows = Array.prototype.slice.call(row.parentNode.children);
      drag = { from: rows.indexOf(row), to: rows.indexOf(row), y0: e.clientY, pid: e.pointerId, row: row, rows: rows, h: h };
      try { h.setPointerCapture(e.pointerId); } catch (x) {}
      row.classList.add('lift'); e.preventDefault();
    });
    host.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.pid) return;
      var dy = e.clientY - drag.y0; drag.row.style.transform = 'translateY(' + dy + 'px)';
      var to = drag.from;
      drag.rows.forEach(function (r, k) { if (r === drag.row) return; var b = r.getBoundingClientRect(); if (e.clientY >= b.top && e.clientY <= b.bottom) to = k; });
      drag.to = to;
      drag.rows.forEach(function (r, k) {
        if (r === drag.row) return;
        r.classList.toggle('shift-down', drag.to < drag.from && k >= drag.to && k < drag.from);
        r.classList.toggle('shift-up', drag.to > drag.from && k <= drag.to && k > drag.from);
      });
    });
    function end(e) {
      if (!drag || e.pointerId !== drag.pid) return;
      var d = drag; drag = null;
      d.row.classList.remove('lift'); d.row.style.transform = '';
      d.rows.forEach(function (r) { r.classList.remove('shift-down', 'shift-up'); });
      if (d.to !== d.from) { editing = -1; edit(function (l) { var x = l.splice(d.from, 1)[0]; l.splice(d.to, 0, x); return l; }); }
    }
    host.addEventListener('pointerup', end); host.addEventListener('pointercancel', end);
  })();

  /* ---------- Save as recipe ---------- */
  UI.ext.act['qk-recipe'] = function () {
    var it = sel(); if (!it || !listOf(it).length) return;
    openModal('Save as recipe', '<label class="small" for="qkRecipeName">Name this recipe</label><input type="text" id="qkRecipeName" maxlength="40" value="My recipe" aria-label="Recipe name" autocomplete="off">' +
      '<p class="hint">A recipe keeps these commands. Paths are saved from where ' + esc(H.itemName(it)) + ' starts, so you can use it on any character, anywhere.</p>' +
      '<div class="row"><button type="button" class="btn primary" data-act="qk-recipesave">Save</button></div>');
    var f = $('qkRecipeName'); if (f) setTimeout(function () { f.select(); }, 40);
  };
  UI.ext.act['qk-recipesave'] = function () {
    var it = sel(), name = ($('qkRecipeName').value || '').trim() || 'My recipe';
    MM.saveRecipe(MM.cur(), it.id, name).then(function (rec) { closeModal(); if (rec) App.msg('The recipe "' + name + '" is saved. Find it under Recipes in Add a command.', 4200); });
  };

  /* ---------- Script ---------- */
  var HELP = 'Scene: Hot dog stand, morning\nDibs (enter left, walk to middle): Hey Chicago!\nCamera: close on Dibs\nWacker (enter right, walk to Dibs): Pigeons can\'t make movies.\n& Dibs: shrug, question\nCaption: Wacker is wrong again.\nDibs (wave): Bye!';
  var tplId = null, tplVals = {}, tplConfirm = false;
  function tplOf(id) { return (MM.TEMPLATES || []).filter(function (t) { return t.id === id; })[0]; }
  function templatesHtml() {
    var list = MM.TEMPLATES || [];
    if (!list.length) return '';
    return '<h3>Start from a template</h3><div class="qk-tpls">' + list.map(function (t) {
      return '<button type="button" class="qk-tpl" data-act="qk-tpl" data-v="' + esc(t.id) + '"><b>' + esc(t.name) + '</b><span>' + esc(t.blurb) + '</span></button>';
    }).join('') + '</div>';
  }
  function tplFormHtml() {
    var t = tplOf(tplId); if (!t) return '';
    var h = '<p class="small"><button type="button" class="btn small" data-act="qk-tplback">Back to templates</button></p><h3>' + esc(t.name) + '</h3><p class="hint">' + esc(t.blurb) + ' Change what you like, then put it in your script.</p>';
    t.fields.forEach(function (f) {
      var cur = tplVals[f.key] !== undefined ? tplVals[f.key] : f.def, id = 'qkF-' + f.key;
      if (f.type === 'text') {
        h += '<label class="small" for="' + id + '">' + esc(f.label) + '</label><input type="text" id="' + id + '" data-tk="' + esc(f.key) + '" maxlength="160" value="' + esc(cur) + '" autocomplete="off">';
        return;
      }
      var items = [];
      if (f.type === 'cast') items = (MM.CAST_CHOICES || []).map(function (c) { return { v: c.kind, name: c.name }; });
      else if (f.type === 'place') items = Object.keys(DP.SET_INFO).filter(function (k) { return k !== 'photo'; }).map(function (k) { return { v: k, name: DP.SET_INFO[k].name }; });
      else if (f.type === 'symbol') items = Object.keys(A.symbols).map(function (k) { return { v: k, name: k.replace(/-/g, ' '), img: sym(k) }; });
      h += '<p class="small gap">' + esc(f.label) + '</p><div class="chips' + (f.type === 'symbol' ? ' qk-symbox' : '') + '" role="group" aria-label="' + esc(f.label) + '">' + items.map(function (o) {
        return '<button type="button" class="chip' + (o.img ? ' thumb' : '') + '" data-act="qk-tplpick" data-v="' + esc(f.key + '|' + o.v) + '" aria-pressed="' + (o.v === cur) + '">' + (o.img ? '<img alt="" src="' + o.img + '">' : '') + esc(o.name) + '</button>';
      }).join('') + '</div>';
    });
    h += '<div id="qkTplWarn" class="qk-notes" role="status" aria-live="polite"></div>' +
      '<div class="row"><button type="button" class="btn primary" data-act="qk-tplput">Put in my script</button><button type="button" class="btn" data-act="qk-tplbuild">Build it now</button></div>';
    return h;
  }
  function scriptHtml() {
    if (tplId) return tplFormHtml();
    return templatesHtml() +
      '<h3>Or write your own</h3><p class="hint">One line for each thing said or done. Start with a name and a colon. Add a Scene line for the place and light, Camera: and Caption: lines for the camera and words on screen, and start a line with & to do it at the same time as the line before.</p>' +
      '<pre class="qk-help" aria-label="Example script">' + esc(HELP) + '</pre>' +
      '<p class="hint">Words like shrug, hop, heart, question, wait 2, walk to Dibs, enter left, exit right, holds food and wear blue cap become actions. Anything else is spoken. A line starting with Scene: or --- starts a new shot.</p>' +
      '<details class="qk-vocab"><summary>Words the script knows</summary><ul>' +
      '<li><b>Moves:</b> walk, walk fast, run, walk left, walk right, walk to middle, walk to front, walk back, walk to Dibs, walk and follow, hop, wave, wait 2.</li>' +
      '<li><b>Coming and going:</b> enter, enter left, comes in from the right, exit, exit right, leaves left, goes off right.</li>' +
      '<li><b>Looking and posing:</b> look left, look right, look at Wacker, turns to Wacker, faces camera, shrug, proud, peek, point, stand.</li>' +
      '<li><b>Feelings:</b> heart, question, exclaim, idea, laugh, sweat, music, zzz, steam, tears, shiver.</li>' +
      '<li><b>Things:</b> wear blue cap, wear scarf, holds food, holds a drink, holds nothing, or any picture word like holds juice.</li>' +
      '<li><b>Put together:</b> use commas, and, or then: Dibs (walks to Wacker and waves).</li>' +
      '<li><b>Camera lines:</b> Camera: wide, close on Dibs, push in, pull out, orbit, auto. They turn Auto camera on.</li>' +
      '<li><b>Caption lines:</b> Caption: words to show, Caption: off to hide.</li>' +
      '<li><b>Places and light:</b> Scene: Hot dog stand, morning (also noon, golden hour, blue hour, night, studio). Scene: same keeps the place.</li>' +
      '<li><b>Same time:</b> a line that starts with & begins when the line before it begins.</li>' +
      '</ul></details>' +
      '<textarea id="qkScript" rows="8" aria-label="Your script" placeholder="Dibs: Hello!">' + esc(scriptText) + '</textarea>' +
      '<div id="qkNotes" class="qk-notes" role="status" aria-live="polite"></div>' +
      '<div class="row"><button type="button" class="btn primary" id="qkBuild" data-act="qk-build">Build</button><button type="button" class="btn small" data-act="qk-example">Use the example</button></div>';
  }
  function notesHtml(notes) { return notes.length ? '<ul>' + notes.map(function (n) { return '<li>' + esc(n.text || n) + '</li>'; }).join('') + '</ul>' : ''; }
  function syncScript() {
    var box = $('qkNotes'); if (!box) return;
    var p = MM.parseScript(scriptText);
    box.innerHTML = notesHtml(p.notes);
    var b = $('qkBuild');
    if (b) {
      b.disabled = !p.shots.length;
      b.textContent = scriptConfirm ? 'Replace the commands and build' : 'Build';
    }
  }
  function renderScript() { var b = $('qkBody'); if (!b) return; b.innerHTML = scriptHtml(); syncScript(); b.scrollTop = 0; }
  function openScript() {
    MM.pause();
    scriptConfirm = false; tplId = null; tplConfirm = false;
    openModal('Script', scriptHtml(), true);
    syncScript();
  }
  UI.ext.act['qk-tpl'] = function (v) {
    var t = tplOf(v); if (!t) return;
    tplId = v; tplVals = {}; tplConfirm = false;
    t.fields.forEach(function (f) { tplVals[f.key] = f.def; });
    renderScript();
  };
  UI.ext.act['qk-tplback'] = function () { tplId = null; tplConfirm = false; renderScript(); };
  UI.ext.act['qk-tplpick'] = function (v) {
    var i = String(v).indexOf('|'), key = String(v).slice(0, i), val = String(v).slice(i + 1);
    tplVals[key] = val; tplConfirm = false;
    Array.prototype.forEach.call(modal.querySelectorAll('[data-act="qk-tplpick"]'), function (b) {
      var bv = b.getAttribute('data-v'); if (bv.indexOf(key + '|') !== 0) return;
      b.setAttribute('aria-pressed', bv === v ? 'true' : 'false');
    });
    var w = $('qkTplWarn'); if (w) w.innerHTML = '';
  };
  /* fills the script box with the template. Asks once when the box already has words. Returns true when it went ahead. */
  function tplFill() {
    var t = tplOf(tplId); if (!t) return false;
    if (scriptText.trim() && !tplConfirm) {
      tplConfirm = true;
      var w = $('qkTplWarn'); if (w) w.innerHTML = '<ul><li>This replaces your script. Tap again to go on.</li></ul>';
      return false;
    }
    var text = t.script(tplVals);
    scriptText = text; scriptConfirm = false; tplConfirm = false; tplId = null;
    renderScript();
    return true;
  }
  UI.ext.act['qk-tplput'] = function () { tplFill(); };
  UI.ext.act['qk-tplbuild'] = function () { if (tplFill()) UI.ext.act['qk-build'](); };
  UI.ext.act['openscript'] = openScript;
  UI.ext.act['qk-example'] = function () { scriptText = HELP; scriptConfirm = false; var t = $('qkScript'); if (t) t.value = scriptText; syncScript(); };
  UI.ext.act['qk-build'] = function () {
    var p = MM.parseScript(scriptText);
    if (!p.shots.length) { $('qkNotes').innerHTML = '<ul><li>Type a line like Dibs: Hello! first.</li></ul>'; return; }
    var cur = MM.cur(), replaces = !p.shots[0].isNew && MM.hasActions(cur);
    if (replaces && !scriptConfirm) {
      scriptConfirm = true; syncScript();
      $('qkNotes').innerHTML = '<ul><li>This shot already has commands. Building replaces them. You can tap Undo afterwards. Tap the button again to go on.</li></ul>' + notesHtml(p.notes);
      return;
    }
    $('qkBuild').disabled = true; $('qkBuild').textContent = 'Building';
    editing = -1;
    MM.buildScript(scriptText).then(function (res) {
      H.afterMovieLoaded();
      refreshViz();
      if (res.ok && !res.notes.length) { closeModal(); var en = H.emptyStageText(); App.msg(res.text + (en ? ' ' + en : ''), en ? 6400 : 4200); return; }
      scriptConfirm = false;
      var box = $('qkNotes'), b = $('qkBuild');
      if (box) box.innerHTML = '<ul><li><strong>' + esc(res.text) + '</strong></li>' + res.notes.map(function (n) { return '<li>' + esc(n.text) + '</li>'; }).join('') + '</ul>';
      if (b) { b.disabled = false; b.textContent = 'Build'; }
    }, function (e) { console.warn('script build', e); App.msg('The script could not be built.'); closeModal(); });
  };

  /* ---------- keeping the screen in step ---------- */
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawing) { stopDraw(false, true); App.msg('Drawing stopped.', 1800); } });
  $('drawCancel').addEventListener('click', function () { stopDraw(false, true); App.msg('Drawing stopped.', 1800); });
  $('drawDone').addEventListener('click', function () {
    var d = drawing; if (!d) return;
    if (!d.raw.length) { stopDraw(false, true); App.msg('No path drawn.', 1800); return; }
    finishDraw(false);
  });
  MM.on('play', function (on) { if (on) { if (drawing) stopDraw(); } refreshViz(); });
  MM.on('loaded', function () { if (drawing) stopDraw(); editing = -1; refreshViz(); });
  MM.on('tracks', function () { if (H.getTab() === 'quick' && !MM.playing) refreshViz(); });
  var oldSel = UI.selectionChanged;
  UI.selectionChanged = function () { editing = -1; if (drawing && drawing.id !== App.sel) stopDraw(); oldSel(); refreshViz(); };
  var oldClose = UI.closeModals;
  UI.closeModals = function () { oldClose(); closeModal(); if (drawing) stopDraw(); };
  UI.ext.sheetChanged = function () { setTimeout(refreshViz, 0); };

  // on a wide screen the Tools panel is docked and open at the start. Draw it now that this code is here.
  if (H.isOpen()) H.renderPanel();
})();
