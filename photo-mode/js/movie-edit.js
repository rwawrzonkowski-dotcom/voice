/* DIBS Movie Maker: editing on the picture. The same bar, handles, pinch and twist, pose dots and snapping as photo mode (edit.js),
   wired into the movie's own model. Every change goes through MM:
     - App.begin() pushes the movie's undo step (MM.pushUndo) before the first change of an edit,
     - App.commit() writes keys at the playhead for what changed (turn, position, height, pose parts) the way Set key does,
       and refreshes the shot's base for what is not keyed (size, flip, words, copies, deletes),
     - the pose chips, emotes and costumes call the same functions as the Characters page, so they write the same keys.
   movie-ui.js calls DP.movieEdit.setup(UI) once its own screen is built. Classic script, no modules. */
(function () {
  'use strict';
  var DP = window.DP, App = DP.app, MM = DP.movie, A = window.DIBS_ASSETS;
  var $ = function (id) { return document.getElementById(id); };
  var POSE_KEYS = ['head', 'wingA', 'wingB', 'lean', 'bend', 'hop', 'look'];
  var PANES = ['pose', 'turn', 'size', 'wear', 'emote', 'hold', 'words', 'color', 'tail'];

  DP.movieEdit = { setup: function (UI) {
    var H = UI.h, E, ctxOpen = null, begun = false;
    var sheet = $('ctxSheet'), body = $('ctxBody');
    if (!sheet || !body || !DP.edit) return;
    var esc = H.esc, svgData = H.svgData;
    function sel() { return App.sel ? App.findItem(App.sel) : null; }
    function r2(v) { return Math.round(v * 100) / 100; }

    /* ---------- the edit, in the movie's terms ---------- */
    App.begin = function () {
      if (begun || MM.loading || MM.playing || !MM.movie) return;
      begun = true; MM.pushUndo();
    };
    function valueAt0(shot, id, what) {
      var bi = MM.base.items[id], f = MM.evalFrame(shot, 0, MM.base), e = f.items[id];
      if (what === 'pos') return e && e.pos ? e.pos : [bi.x, bi.z];
      if (what === 'rot') return e && e.rot !== undefined ? e.rot : bi.yaw;
      if (what === 'height') return e && e.height !== undefined ? e.height : bi.y;
      var p = what.slice(5);
      if (e && e.pose && e.pose[p] !== undefined) return e.pose[p];
      return bi.pose && bi.pose[p] !== undefined ? bi.pose[p] : 0;
    }
    var LABEL = { pos: 'Position', rot: 'Turn', height: 'Height' };
    function autoKey(touched) {
      var shot = MM.cur(), n = 0, what = '';
      if (!shot || !MM.base) return;
      Object.keys(touched).forEach(function (id) {
        var it = App.findItem(id), bi = MM.base.items[id]; if (!it || !bi) return;
        var list = Object.keys(touched[id]).filter(function (w) { return w !== 'scale'; });
        var anchors = {};
        list.forEach(function (w) { anchors[w] = valueAt0(shot, id, w); });     // read before any key of this edit exists
        list.forEach(function (w) {
          var target, v;
          if (w === 'pos') { target = 'item:' + id + '.pos'; v = [it.x, it.z]; }
          else if (w === 'rot') { target = 'item:' + id + '.rot'; v = it.yaw; }
          else if (w === 'height') { target = 'item:' + id + '.height'; v = it.y; }
          else if (w.indexOf('pose.') === 0 && POSE_KEYS.indexOf(w.slice(5)) >= 0 && it.pose) { target = 'item:' + id + '.' + w; v = it.pose[w.slice(5)]; }
          else return;
          if (MM.setKey(shot, target, MM.t, v, undefined, anchors[w])) { n++; what = LABEL[w] || 'Pose'; }
          if (H.clearDirty) H.clearDirty(target);
        });
      });
      if (n) App.msg((n === 1 ? what : 'Pose') + ' key set at ' + H.secs(MM.t) + '.', 1500);
    }
    App.commit = function () {
      clearTimeout(App._ct);
      var t = App.touched; App.touched = {};
      var was = begun; begun = false;
      if (!MM.movie || MM.loading || MM.playing) return;
      if (!was && !Object.keys(t).length) return;
      autoKey(t);
      MM.commit(); MM.touch();
      H.renderTimeline(true);
      syncCtx();
    };
    /* a character that is deleted takes its keys with it (Undo brings them all back) */
    var removeItem = App.removeItem;
    App.removeItem = function (id) {
      removeItem(id);
      var shot = MM.cur(); if (!shot) return;
      var pre = 'item:' + id + '.';
      MM.clearTracks(shot, function (t) { return t.indexOf(pre) === 0; });
      if (shot.actions && shot.actions[id]) { delete shot.actions[id]; if (!Object.keys(shot.actions).length) delete shot.actions; }
      MM.touch(); H.renderTimeline(true); H.renderPanel();
    };

    E = DP.edit;
    var ok = E.init({ history: false, hide: ['give'], undo: function () { return UI.undo(); }, redo: function () { return UI.redo(); }, canUndo: MM.canUndo, canRedo: MM.canRedo });
    if (ok === false) return;
    var ohand = App.onHandles;
    App.onHandles = function (it) { ohand(it); if (!it && ctxOpen) closeCtx(); };

    /* ---------- the short sheets ---------- */
    function chip(act, v, label, extra) { return '<button type="button" class="chip" data-ce="' + act + '" data-v="' + esc(v) + '" aria-pressed="false"' + (extra || '') + '>' + label + '</button>'; }
    function seg(act, list, label) { return '<div class="seg" role="group" aria-label="' + label + '">' + list.map(function (o) { return '<button type="button" data-ce="' + act + '" data-v="' + o[0] + '" aria-pressed="false">' + o[1] + '</button>'; }).join('') + '</div>'; }
    function field(id, label, min, max, step) { return '<div class="field"><label for="cf-' + id + '">' + label + '</label><output id="co-' + id + '" for="cf-' + id + '"></output><input type="range" id="cf-' + id + '" data-cf="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '"></div>'; }
    function fmt(v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
    var FD = {
      yaw: { what: 'rot', get: function (it) { return it.yaw; }, set: function (it, v) { it.yaw = v; }, text: function (v) { return Math.round(v) + ' deg'; } },
      scale: { what: 'scale', get: function (it) { return it.scale; }, set: function (it, v) { it.scale = v; }, text: function (v) { return fmt(v, 2); } },
      y: { what: 'height', get: function (it) { return it.y; }, set: function (it, v) { it.y = v; }, text: function (v) { return fmt(v, 2); } }
    };
    var PR = { head: [-60, 60, 1, 'Head turn'], wingA: [0, 170, 1, 'Left wing'], wingB: [0, 170, 1, 'Right wing'], lean: [-40, 40, 1, 'Lean'], bend: [-40, 40, 1, 'Bend'], hop: [0, 1, 0.01, 'Hop height'] };
    Object.keys(PR).forEach(function (p) {
      FD[p] = { what: 'pose.' + p, get: function (it) { return it.pose ? it.pose[p] : 0; }, set: function (it, v) { if (it.pose) { it.pose[p] = v; it.pose.preset = 'custom'; } }, text: function (v) { return p === 'hop' ? fmt(v, 2) : Math.round(v) + ' deg'; } };
    });
    var fineBtn = function (v, label) { return '<button type="button" class="btn small finebtn" data-ce="fine" data-v="' + v + '" aria-pressed="false">' + (label || 'Fine tune') + '</button>'; };
    var panes = {};
    panes.pose =
      '<div class="strip" id="cePoses" role="group" aria-label="Poses">' + DP.POSES.map(function (p) { return chip('pose', p.id, p.name); }).join('') + '</div>' +
      '<div class="row">' + fineBtn('pose') + '<span class="small">Or drag the dots on the picture.</span></div>' +
      '<div class="fine" id="cfine-pose" hidden>' + Object.keys(PR).map(function (p) { return field(p, PR[p][3], PR[p][0], PR[p][1], PR[p][2]); }).join('') +
      '<p class="small">Looking</p>' + seg('look', [['-1', 'Left'], ['0', 'Ahead'], ['1', 'Right']], 'Look direction') + '</div>' +
      '<p class="hint">Poses and parts you move are kept as keys at the playhead.</p>';
    panes.turn =
      field('yaw', 'Turn', -180, 180, 1) +
      '<div class="strip" id="ceFace" role="group" aria-label="Face"></div>' +
      '<div class="strip"><button type="button" class="chip" data-ce="snap" data-snap aria-pressed="false">Snap</button>' +
      '<button type="button" class="chip" data-ce="lineup">Line up</button><button type="button" class="chip" data-ce="faceeach">Face each other</button></div>' +
      '<p class="hint">Turn is kept as a key at the playhead.</p>';
    panes.size =
      field('scale', 'Size', 0.2, 4, 0.05) + field('y', 'Height off the ground', 0, 4, 0.05) +
      '<div class="row"><button type="button" class="chip" data-ce="flip" aria-pressed="false">Flip left and right</button></div>' +
      '<p class="hint">Size and flip hold for the whole shot. Height is kept as a key at the playhead.</p>';
    panes.wear = '<div class="strip" role="group" aria-label="Wear">' + chip('wear', 'none', 'None') + DP.COSTUMES.map(function (c) {
      return '<button type="button" class="chip thumb" data-ce="wear" data-v="' + c.id + '" aria-pressed="false"><img alt="" src="' + svgData(A.costumes[c.id]) + '">' + c.name + '</button>';
    }).join('') + '</div><p class="hint">A costume pops on at the playhead.</p>';
    panes.emote = '<div class="strip" role="group" aria-label="Emote">' + chip('emote', 'none', 'None') + DP.EMOTES.map(function (e) {
      return '<button type="button" class="chip thumb" data-ce="emote" data-v="' + e.id + '" aria-pressed="false"><img alt="" src="' + svgData(e.svg) + '">' + e.name + '</button>';
    }).join('') + '</div><p class="hint">The emote pops in at the playhead and does its body move.</p>';
    panes.hold =
      '<div class="field"><label for="ceHold">Hold a prop all shot</label></div><select id="ceHold" aria-label="Hold a prop"><option value="">Nothing</option>' +
      Object.keys(A.symbols).map(function (n) { return '<option value="' + n + '">' + esc(n.replace(/-/g, ' ')) + '</option>'; }).join('') + '</select>';
    panes.words = '<label for="ceText" class="small">Words</label><textarea id="ceText" maxlength="160" aria-label="Bubble words"></textarea>';
    panes.color = '<div class="strip swstrip"><div class="swatches nowrap" role="group" aria-label="Bubble color">' + DP.PALETTE.map(function (p) {
      return '<button type="button" class="sw" data-ce="bubcolor" data-v="' + p.c + '" style="background:' + p.c + '" aria-label="' + esc(p.n) + '" aria-pressed="false"></button>';
    }).join('') + '</div></div>';
    panes.tail = seg('bubtail', [['left', 'Left'], ['right', 'Right'], ['down', 'Down'], ['none', 'None']], 'Tail');
    PANES.forEach(function (id) {
      var d = document.createElement('div'); d.className = 'cpane'; d.id = 'cp-' + id; d.hidden = true; d.innerHTML = panes[id]; body.appendChild(d);
    });

    function itemTitle(it) { return H.itemName(it) + ', ' + E.label(ctxOpen); }
    function closeCtx() {
      if (!ctxOpen && sheet.hidden) return;
      ctxOpen = null; sheet.hidden = true;
      E.setActive(null); E.setPose(false);
    }
    function openCtx(id) {
      var it = sel(); if (!it || PANES.indexOf(id) < 0) return;
      if (ctxOpen === id) { closeCtx(); return; }
      if (H.isPhone() && H.isOpen()) H.closeSheet();
      ctxOpen = id;
      PANES.forEach(function (p) { $('cp-' + p).hidden = p !== id; });
      sheet.hidden = false; body.scrollTop = 0; sheet.scrollTop = 0;
      E.setActive(id); E.setPose(id === 'pose' && DP.isPuppet(it.kind));
      syncCtx();
    }
    UI.openCtx = openCtx; UI.closeCtx = closeCtx; UI.ctxNow = function () { return ctxOpen; };
    UI.toolsOpened = function () { if (H.isPhone()) closeCtx(); };

    function lastIdx(tr, t) { var r = -1; for (var i = 0; i < tr.keys.length; i++) if (tr.keys[i].t <= t + 1e-6) r = i; return r; }
    function press(b, on) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    var faceSig = '';
    function renderFace(it) {
      var box = $('ceFace'), list = E.others(), shot = App.state.items, html = chip('facecam', 'cam', 'Face camera');
      list.forEach(function (o) {
        var same = shot.filter(function (z) { return z.kind === o.kind; });
        html += chip('faceitem', o.id, 'Face ' + H.itemName(o).replace(/ \d+$/, '') + (same.length > 1 ? ' ' + (same.indexOf(o) + 1) : ''));
      });
      if (html !== faceSig) { faceSig = html; box.innerHTML = html; }
    }
    function syncCtx() {
      if (!ctxOpen) return;
      var it = sel();
      if (!it || E.actionsFor(it).indexOf(ctxOpen) < 0) { closeCtx(); return; }
      $('ctxTitle').textContent = itemTitle(it);
      var shot = MM.cur(), id = it.id, puppet = DP.isPuppet(it.kind);
      var inputs = body.querySelectorAll('[data-cf]'), i;
      for (i = 0; i < inputs.length; i++) {
        var fid = inputs[i].getAttribute('data-cf'), d = FD[fid];
        if (document.activeElement === inputs[i]) continue;
        var v = d.get(it); if (v === undefined || v === null || isNaN(v)) continue;
        inputs[i].value = v; var o = $('co-' + fid); if (o) o.textContent = d.text(v);
      }
      if (puppet) {
        var def = DP.PUPPETS[it.kind];
        $('cf-wingA').parentNode.hidden = def.wings < 1; $('cf-wingB').parentNode.hidden = def.wings < 2;
        var lw = body.querySelector('label[for="cf-wingA"]'); if (lw) lw.textContent = def.wings === 1 ? 'Wing' : 'Left wing';
      }
      var q = function (sel2, fn) { Array.prototype.forEach.call(body.querySelectorAll(sel2), fn); };
      q('[data-ce="pose"]', function (b) { var tr = MM.getTrack(shot, 'item:' + id + '.pose.preset'), j = tr ? lastIdx(tr, MM.t) : -1; var v = j >= 0 ? tr.keys[j].v : (it.pose && it.pose.preset); press(b, b.getAttribute('data-v') === v); });
      q('[data-ce="look"]', function (b) { press(b, !!it.pose && String(it.pose.look) === b.getAttribute('data-v')); });
      q('[data-ce="emote"]', function (b) { press(b, b.getAttribute('data-v') === (it.emote ? it.emote.id : 'none')); });
      q('[data-ce="wear"]', function (b) {
        var tr = MM.getTrack(shot, 'item:' + id + '.wear'), cur = 'none';
        if (tr) { var j = lastIdx(tr, MM.t); if (j >= 0 && tr.keys[j].v) cur = tr.keys[j].v.id; }
        else { var a = (it.attach || []).filter(function (x) { return x.kind.indexOf('costume:') === 0; })[0]; if (a) cur = a.kind.slice(8); }
        press(b, b.getAttribute('data-v') === cur);
      });
      q('[data-ce="flip"]', function (b) { press(b, !!it.flip); });
      q('[data-ce="bubcolor"]', function (b) { press(b, it.color === b.getAttribute('data-v')); });
      q('[data-ce="bubtail"]', function (b) { press(b, it.tail === b.getAttribute('data-v')); });
      press($('mmSnap'), !!App.snap); q('[data-snap]', function (b) { press(b, !!App.snap); });
      var hs = $('ceHold'); if (hs && document.activeElement !== hs) { var held = (it.attach || []).filter(function (x) { return x.kind.indexOf('symbol:') === 0 && x.slot === 'handR'; })[0]; hs.value = held ? held.kind.slice(7) : ''; }
      var tx = $('ceText'); if (tx && document.activeElement !== tx) tx.value = it.text || '';
      if (ctxOpen === 'turn') renderFace(it);
      if (ctxOpen === 'tail') $('cp-tail').hidden = it.kind === 'bubble:sign' || it.kind === 'bubble:shout';
      var ub = $('ctxUndo'), rb = $('ctxRedo'); if (ub) ub.disabled = !MM.canUndo(); if (rb) rb.disabled = !MM.canRedo();
    }
    UI.syncCtx = syncCtx;
    UI.itemEdited = function () { syncCtx(); };
    UI.poseChanged = function () { syncCtx(); };
    UI.snapChanged = function () { syncCtx(); };
    MM.on('history', syncCtx);
    MM.on('time', function () { if (ctxOpen && !MM.playing) syncCtx(); });
    var sc = UI.selectionChanged;
    UI.selectionChanged = function () { sc(); syncCtx(); };

    var rebuildT = 0;
    function rebuildSoon(id) { clearTimeout(rebuildT); rebuildT = setTimeout(function () { App.rebuildItem(id); App.commit(); }, 260); }
    var act = {
      pose: function (v) { H.act.pose(v); syncCtx(); },
      emote: function (v) { H.act.emote(v); syncCtx(); },
      wear: function (v) { H.act.wear(v); syncCtx(); },
      look: function (v) { var it = sel(); if (!it || !it.pose) return; App.begin(); it.pose.look = parseInt(v, 10); it.pose.preset = 'custom'; App.applyItem(it.id); App.touch('pose.look', it.id); App.bump(); App.commit(); },
      fine: function (v, el) { var box = $('cfine-' + v); if (!box) return; box.hidden = !box.hidden; el.setAttribute('aria-pressed', box.hidden ? 'false' : 'true'); setTimeout(function () { sheet.scrollTop += el.getBoundingClientRect().top - sheet.getBoundingClientRect().top - 64; }, 0); },
      flip: function () { var it = sel(); if (!it) return; App.begin(); it.flip = !it.flip; App.applyItem(it.id); App.commit(); },
      snap: function () { E.setSnap(!App.snap); syncCtx(); },
      lineup: function () { E.lineUp(); },
      faceeach: function () { E.faceEachOther(); },
      facecam: function () { E.faceCamera(); },
      faceitem: function (v) { E.faceItem(v); },
      bubcolor: function (v) { var it = sel(); if (!it) return; App.begin(); it.color = v; rebuildSoon(it.id); syncCtx(); },
      bubtail: function (v) { var it = sel(); if (!it) return; App.begin(); it.tail = v; rebuildSoon(it.id); syncCtx(); }
    };
    body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ce]'); if (!b || b.disabled) return;
      var a = act[b.getAttribute('data-ce')]; if (a) a(b.getAttribute('data-v'), b);
    });
    body.addEventListener('input', function (e) {
      var t = e.target, id = t.getAttribute && t.getAttribute('data-cf'), it = sel();
      if (id && it) {
        var d = FD[id], v = parseFloat(t.value);
        App.begin(); d.set(it, v); App.applyItem(it.id); App.touch(d.what, it.id); App.bump();
        var o = $('co-' + id); if (o) o.textContent = d.text(v);
      } else if (t.id === 'ceText' && it) {
        App.begin(); it.text = t.value; rebuildSoon(it.id);
      }
    });
    body.addEventListener('change', function (e) {
      var t = e.target;
      if (t.getAttribute && t.getAttribute('data-cf')) App.commit();
      else if (t.id === 'ceHold') {
        var it = sel(); if (!it) return;
        App.begin();
        (it.attach || []).filter(function (a) { return a.kind.indexOf('symbol:') === 0 && a.slot === 'handR'; }).forEach(function (a) { App.detach(it.id, a.id); });
        if (t.value) App.attachTo(it.id, { kind: 'symbol:' + t.value, slot: 'handR' });
        App.commit();
      }
    });

    /* what the bar buttons do */
    E.onAction = function (id) {
      if (id === 'copy') { if (App.sel) App.duplicateItem(App.sel); }
      else if (id === 'delete') { if (App.sel) { var nm = H.itemName(sel()); App.removeItem(App.sel); App.msg(nm + ' deleted. Tap Undo to bring it back.', 3200); } }
      else if (id === 'flip') act.flip();
      else openCtx(id);
    };
    $('ctxDone').addEventListener('click', closeCtx);
    $('ctxUndo').addEventListener('click', function () { UI.undo(); });
    $('ctxRedo').addEventListener('click', function () { UI.redo(); });
    [$('ctxHead')].forEach(function (hd) {
      var y0 = null, done = false;
      hd.addEventListener('pointerdown', function (e) { y0 = e.clientY; done = false; });
      hd.addEventListener('pointermove', function (e) {
        if (y0 === null || done || !H.isPhone() || e.pointerType === 'mouse') return;
        if (e.clientY - y0 > 40) { done = true; y0 = null; closeCtx(); }
      });
      hd.addEventListener('pointerup', function () { y0 = null; }); hd.addEventListener('pointercancel', function () { y0 = null; });
    });

    /* taps on the picture */
    UI.pictureTapped = function (picked, was) {
      if (!picked) { closeCtx(); return; }
      var it = sel();
      if (was && !App.wasQuiet && it && DP.isPuppet(it.kind) && ctxOpen !== 'pose') openCtx('pose');   // a second tap on a picked character is Pose mode
    };
    UI.longPress = function (id) { var it = sel(); if (it && it.id === id && DP.isPuppet(it.kind) && ctxOpen !== 'pose') openCtx('pose'); };
    UI.poseEnded = function () { if (ctxOpen === 'pose') closeCtx(); };

    /* snap, in the transport row */
    $('mmSnap').addEventListener('click', function () { E.setSnap(!App.snap); syncCtx(); });

    /* left or right hand: the thumb controls move to the side your thumb is on (the same setting as photo mode) */
    App.hand = 'right';
    try { if (localStorage.getItem('dibs-photo-hand') === 'left') App.hand = 'left'; } catch (e) {}
    UI.setHand = function (v) {
      App.hand = v === 'left' ? 'left' : 'right';
      document.body.setAttribute('data-hand', App.hand);
      try { localStorage.setItem('dibs-photo-hand', App.hand); } catch (e) {}
    };
    document.body.setAttribute('data-hand', App.hand);
    syncCtx();
  } };
})();
