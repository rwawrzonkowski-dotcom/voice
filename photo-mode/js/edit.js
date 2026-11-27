/* DIBS Photo Mode: editing on the picture. The contextual bar that pops up over a picked item, the turn, size and height tabs on
   its ring, pinch and twist, grabbing a part to pose it, near-miss picking, snapping and the undo history.
   The page needs #ctxBar, #trn and #siz. Photo mode (ui.js) and the Movie Maker (movie-edit.js) both call DP.edit.init(cfg):
     cfg.history  true (photo mode) keeps its own snapshot undo. false (Movie Maker) leaves undo to the page: it sets App.begin
                  (called before the first change of an edit), App.commit (called when the edit is done) and cfg.undo / cfg.redo.
     cfg.hide     bar buttons to leave out, for example ['give'].
   The page fills in what each bar button opens: it sets App.edit.onAction. Classic script, no modules. */
(function () {
  'use strict';
  var THREE = window.THREEPKG.THREE, DP = window.DP, App = DP.app;
  var D2R = Math.PI / 180;
  var $ = function (id) { return document.getElementById(id); };
  var E = App.edit = DP.edit = { on: false, onAction: null, active: null, quiet: false, cfg: {} };
  E.init = function (cfg) {
  cfg = E.cfg = cfg || {};
  var HIST = cfg.history !== false;
  var bar = $('ctxBar'), trn = $('trn'), siz = $('siz'), dotsEl = $('poseDots'), stage = $('stage');
  if (!bar || !trn || !siz || !stage || E.on) return false;
  E.on = true;
  var SLOP = 20;                 // pixels around a cutout that still count as touching it

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  function norm180(d) { while (d > 180) d -= 360; while (d < -180) d += 360; return d; }
  function sel() { return App.sel ? App.findItem(App.sel) : null; }
  function frameRect() { return App.glEl.getBoundingClientRect(); }
  function toFrame(v) { var p = v.clone().project(App.camera); return { x: (p.x + 1) / 2 * App.frame.w, y: (1 - p.y) / 2 * App.frame.h, z: p.z }; }
  function planeAt(cx, cy, y) {
    var r = frameRect(), ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    App.camera.updateMatrixWorld(true);
    App.raycaster.setFromCamera(ndc, App.camera);
    var pt = new THREE.Vector3();
    return App.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), pt) ? pt : null;
  }
  /* pre() runs before the first change of an edit (the Movie Maker pushes its undo step there). changed(what) after each change:
     what names the thing that changed (rot, scale, pos, pose.head ...) so a page that keys things can key the right ones. */
  function pre() { if (App.begin) App.begin(); }
  function changed(what, id) {
    App.bump();
    if (what && App.touch) App.touch(what, id);
    var u = App.ui;
    if (u) { if (u.itemEdited) u.itemEdited(what); else if (u.itemMoved) u.itemMoved(); }
  }

  /* ---------- where an item is on the picture ---------- */
  var _v = new THREE.Vector3();
  function itemBox(id) {
    var o = App.objs[id]; if (!o) return null;
    o.root.updateMatrixWorld(true); App.camera.updateMatrixWorld(true);
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0, W = App.frame.w, H = App.frame.h;
    o.hitMeshes().forEach(function (m) {
      var g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
      var bb = g.boundingBox;
      for (var i = 0; i < 8; i++) {
        _v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyMatrix4(m.matrixWorld).project(App.camera);
        if (_v.z > 1) continue;
        var x = (_v.x + 1) / 2 * W, y = (1 - _v.y) / 2 * H;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; n++;
      }
    });
    return n ? { x0: x0, y0: y0, x1: x1, y1: y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 } : null;
  }
  function ringPoly(it, r) {
    var pts = [], i, a;
    for (i = 0; i < 32; i++) { a = i / 32 * Math.PI * 2; pts.push(toFrame(_v.set(it.x + Math.sin(a) * r, it.y + 0.03, it.z + Math.cos(a) * r))); }
    return pts;
  }
  function inPoly(x, y, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      if (((pts[i].y > y) !== (pts[j].y > y)) && (x < (pts[j].x - pts[i].x) * (y - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x)) inside = !inside;
    }
    return inside;
  }
  function ringR() { return App.ringMesh && App.ringMesh.userData.r ? App.ringMesh.userData.r : 0.6; }
  function inSel(fx, fy) {
    var it = sel(); if (!it || !App.objs[it.id]) return false;
    var b = itemBox(it.id);
    if (b && fx >= b.x0 - SLOP && fx <= b.x1 + SLOP && fy >= b.y0 - SLOP && fy <= b.y1 + SLOP) return true;
    return inPoly(fx, fy, ringPoly(it, ringR()));
  }

  /* a near miss still picks: the cutout's box plus slop, the nearest centre wins, and the ring of the picked item counts as the item */
  App.pickSlop = SLOP;
  App.pickExtra = function (cx, cy) {
    var r = frameRect(), fx = cx - r.left, fy = cy - r.top, best = null, bd = 1e9;
    var it = sel();
    if (it && App.objs[it.id] && inPoly(fx, fy, ringPoly(it, ringR()))) return it.id;
    App.state.items.forEach(function (o) {
      if (!App.objs[o.id]) return;
      var b = itemBox(o.id); if (!b) return;
      if (fx < b.x0 - SLOP || fx > b.x1 + SLOP || fy < b.y0 - SLOP || fy > b.y1 + SLOP) return;
      var d = Math.hypot(fx - b.cx, fy - b.cy);
      if (d < bd) { bd = d; best = o.id; }
    });
    return best;
  };

  /* ---------- dragging a handle ---------- */
  function wireHandle(el, h) {
    var pid = null, st = null;
    el.addEventListener('pointerdown', function (e) {
      var it = sel(); if (!it || pid !== null) return;
      e.preventDefault(); e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      pid = e.pointerId; el.classList.add('drag'); st = h.start(it, e);
    });
    el.addEventListener('pointermove', function (e) {
      if (e.pointerId !== pid) return;
      var it = sel(); if (it && st) h.move(it, st, e);
    });
    function end(e) {
      if (e.pointerId !== pid) return;
      pid = null; el.classList.remove('drag'); st = null; App.save(); App.commit();
    }
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', function (e) {
      var it = sel(); if (!it) return;
      var d = h.key ? h.key(e.key) : 0;
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      h.nudge(it, d); App.save(); App.commitSoon();
    });
  }
  function setYaw(it, y) {
    y = norm180(y);
    if (App.snap) y = norm180(Math.round(y / 15) * 15);
    pre(); it.yaw = Math.round(y * 10) / 10; App.applyItem(it.id); changed('rot', it.id);
  }
  function setScale(it, s) { pre(); it.scale = Math.round(clamp(s, 0.2, 4) * 100) / 100; App.applyItem(it.id); changed('scale', it.id); }
  E.setYaw = function (y) { var it = sel(); if (it) setYaw(it, y); };
  E.setScale = function (s) { var it = sel(); if (it) setScale(it, s); };

  wireHandle(trn, {
    start: function (it, e) {
      var p = planeAt(e.clientX, e.clientY, it.y), a = p ? Math.atan2(p.x - it.x, p.z - it.z) : null;
      return { prev: a, total: 0, yaw0: it.yaw };
    },
    move: function (it, st, e) {
      var p = planeAt(e.clientX, e.clientY, it.y); if (!p) return;
      var a = Math.atan2(p.x - it.x, p.z - it.z);
      if (st.prev === null) { st.prev = a; return; }
      st.total += wrap(a - st.prev); st.prev = a;
      setYaw(it, st.yaw0 + st.total / D2R);
    },
    key: function (k) { return k === 'ArrowLeft' ? -15 : k === 'ArrowRight' ? 15 : 0; },
    nudge: function (it, d) { setYaw(it, it.yaw + d); }
  });
  wireHandle(siz, {
    start: function (it, e) {
      var c = toFrame(_v.set(it.x, it.y + 0.03, it.z)), r = frameRect();
      var cx = r.left + c.x, cy = r.top + c.y;
      return { cx: cx, cy: cy, d0: Math.max(30, Math.hypot(e.clientX - cx, e.clientY - cy)), s0: it.scale };
    },
    move: function (it, st, e) { setScale(it, st.s0 * Math.hypot(e.clientX - st.cx, e.clientY - st.cy) / st.d0); },
    key: function (k) { return k === 'ArrowUp' ? 0.1 : k === 'ArrowDown' ? -0.1 : 0; },
    nudge: function (it, d) { setScale(it, it.scale + d); }
  });

  /* ---------- two fingers: pinch scales, twist turns (only when they start on the picked item) ---------- */
  var G = null;
  E.gesture = function (phase, a, b) {
    if (phase === 'start') {
      var it = sel(); if (!it || !App.objs[it.id]) return false;
      var r = frameRect();
      var pa = { x: a.x - r.left, y: a.y - r.top }, pb = { x: b.x - r.left, y: b.y - r.top };
      if (!(inSel(pa.x, pa.y) || inSel(pb.x, pb.y) || inSel((pa.x + pb.x) / 2, (pa.y + pb.y) / 2))) return false;
      G = { id: it.id, d0: Math.max(24, Math.hypot(a.x - b.x, a.y - b.y)), a0: Math.atan2(b.y - a.y, b.x - a.x), s0: it.scale, y0: it.yaw };
      return true;
    }
    if (phase === 'move') {
      if (!G || !a || !b) return;
      var it2 = App.findItem(G.id); if (!it2) return;
      var d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      pre();
      it2.scale = Math.round(clamp(G.s0 * d / G.d0, 0.2, 4) * 100) / 100;
      var y = norm180(G.y0 - wrap(ang - G.a0) / D2R);
      if (App.snap) y = norm180(Math.round(y / 15) * 15);
      it2.yaw = Math.round(y * 10) / 10;
      App.applyItem(it2.id); changed('scale', it2.id); changed('rot', it2.id);
      return;
    }
    if (G) { G = null; App.save(); App.commit(); }
  };
  /* desktop: Alt and drag turns the picked item, Shift and the wheel sizes it */
  var altIt = null;
  E.altTurn = function (phase, dx) {
    if (phase === 'start') { var it = sel(); if (!it) return false; altIt = { id: it.id, yaw: it.yaw }; return true; }
    if (!altIt) return false;
    if (phase === 'move') { var it2 = App.findItem(altIt.id); if (it2) { altIt.yaw += dx * 0.6; setYaw(it2, altIt.yaw); } }
    else { altIt = null; App.save(); App.commit(); }
    return true;
  };
  E.wheelItem = function (e) {
    var it = sel(); if (!it) return false;
    var r = frameRect();
    if (!inSel(e.clientX - r.left, e.clientY - r.top)) return false;
    setScale(it, it.scale * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)));
    App.save(); App.commitSoon();
    return true;
  };

  /* ---------- the contextual bar ---------- */
  var IC = {
    pose: '<circle cx="12" cy="5" r="2.5"/><path d="M12 8v7M5 11l7-1.5L19 11M12 15l-4 6M12 15l4 6"/>',
    turn: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 3.5v4.5h-4.5"/>',
    size: '<path d="M4 20V11h9v9z"/><path d="M10 14L20 4M14.5 4H20v5.5"/>',
    wear: '<path d="M5 16a7 7 0 0 1 14 0z"/><path d="M12 9V6M3 16h18l-1 3H4z"/>',
    emote: '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1" fill="#2a2350"/><circle cx="15" cy="10" r="1" fill="#2a2350"/><path d="M8 14.5q4 4 8 0"/>',
    hold: '<circle cx="12" cy="15" r="4.5"/><circle cx="5.5" cy="10" r="2"/><circle cx="10" cy="5.5" r="2"/><circle cx="15" cy="5.5" r="2"/><circle cx="19" cy="10" r="2"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    delete: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>',
    flip: '<path d="M12 3v18"/><path d="M9 7L3 18h6zM15 7l6 11h-6z"/>',
    give: '<rect x="4" y="10" width="16" height="10" rx="1"/><path d="M12 10v10M4 14.5h16M12 10C9 4 5 7 8.5 10M12 10c3-6 7-3 3.5 0"/>',
    words: '<path d="M4 5h16v11h-8l-4.5 4v-4H4z"/><path d="M8 9h8M8 12h5"/>',
    color: '<path d="M12 3C8 8 6 11 6 14a6 6 0 0 0 12 0c0-3-2-6-6-11z"/>',
    tail: '<rect x="3" y="4" width="18" height="10" rx="3"/><path d="M8 14l-2.5 6 7.5-6"/>'
  };
  var LABEL = { pose: 'Pose', turn: 'Turn', size: 'Size', wear: 'Wear', emote: 'Emote', hold: 'Hold', copy: 'Copy', delete: 'Delete', flip: 'Flip', give: 'Give', words: 'Words', color: 'Color', tail: 'Tail' };
  E.icon = function (id) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + IC[id] + '</svg>'; };
  E.label = function (id) { return LABEL[id]; };
  E.actionsFor = function (it) {
    var hide = cfg.hide || [];
    return actionsAll(it).filter(function (a) { return hide.indexOf(a) < 0; });
  };
  function actionsAll(it) {
    var k = it.kind;
    if (DP.isPuppet(k)) return ['pose', 'turn', 'size', 'wear', 'emote', 'hold', 'copy', 'delete'];
    if (k.indexOf('bubble:') === 0) {
      var l = ['words', 'color']; if (k !== 'bubble:sign' && k !== 'bubble:shout') l.push('tail');
      return l.concat(['turn', 'size', 'copy', 'delete']);
    }
    var list = ['turn', 'size', 'flip', 'emote'];
    if (/^(symbol|upload|costume):/.test(k) && App.giveTarget) list.push('give');
    return list.concat(['copy', 'delete']);
  }
  var barSig = '';
  function buildBar(it) {
    var list = E.actionsFor(it), sig = list.join(',');
    if (sig !== barSig) {
      barSig = sig;
      bar.innerHTML = list.map(function (id) {
        return '<button type="button" class="cbtn' + (id === 'delete' ? ' danger' : '') + '" data-ctx="' + id + '" aria-pressed="false">' + E.icon(id) + '<span>' + LABEL[id] + '</span></button>';
      }).join('');
    }
    var b = bar.querySelectorAll('.cbtn');
    for (var i = 0; i < b.length; i++) b[i].setAttribute('aria-pressed', b[i].getAttribute('data-ctx') === E.active ? 'true' : 'false');
  }
  bar.addEventListener('click', function (e) {
    var b = e.target.closest('.cbtn'); if (!b) return;
    var id = b.getAttribute('data-ctx');
    if (E.onAction) E.onAction(id);
  });
  bar.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  E.setActive = function (id) {
    E.active = id || null;
    var b = bar.querySelectorAll('.cbtn');
    for (var i = 0; i < b.length; i++) b[i].setAttribute('aria-pressed', b[i].getAttribute('data-ctx') === E.active ? 'true' : 'false');
  };
  function placeBar(it) {
    var b = itemBox(it.id), W = App.frame.w, H = App.frame.h, fx = App.frame.x, fy = App.frame.y;
    buildBar(it);
    bar.hidden = false;
    var bw = bar.offsetWidth, bh = bar.offsetHeight;
    var cx = b ? (b.x0 + b.x1) / 2 : W / 2, left;
    if (bw <= W - 4) left = fx + clamp(cx - bw / 2, 2, W - bw - 2);
    else left = clamp(fx + cx - bw / 2, 3, stage.clientWidth - bw - 3);
    var top = fy + (b ? b.y0 : H / 2) - bh - 12;
    if (top < fy + 2) {
      var low = b ? b.y1 : H / 2, ring = ringPoly(it, ringR());
      ring.forEach(function (p) { if (p.y > low) low = p.y; });
      top = fy + low + 30;                                   // under the ring, clear of its tabs
      if (top + bh > fy + H - 2) top = fy + 2;               // no room above or below: sit at the top
    }
    bar.style.left = Math.round(left) + 'px'; bar.style.top = Math.round(top) + 'px';
  }

  /* ---------- tabs on the ring ---------- */
  function ringPt(it, r, a) { return toFrame(_v.set(it.x + Math.sin(a) * r, it.y + 0.03, it.z + Math.cos(a) * r)); }
  function placeTab(el, p) {
    var W = App.frame.w, H = App.frame.h;
    var x = clamp(p.x, 22, W - 22), y = clamp(p.y, 22, H - 22);
    el.hidden = false; el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px';
    return { x: x, y: y };
  }
  function placeHandles(it) {
    var r = ringR(), cyaw = App.rig.s.yaw, aRight = Math.PI / 2 + cyaw;
    var sp = placeTab(siz, ringPt(it, r, aRight + Math.PI));
    var hp = App.hgtPos || { x: -999, y: -999 };
    // the turn tab sits on the ring where the item faces. It slides along the ring if that would cover another tab.
    var offs = [0, 0.55, -0.55, 1.1, -1.1, 1.65, -1.65], tp = null, base = it.yaw * D2R, i;
    for (i = 0; i < offs.length; i++) {
      var p = ringPt(it, r, base + offs[i]);
      var px = clamp(p.x, 22, App.frame.w - 22), py = clamp(p.y, 22, App.frame.h - 22);
      if (Math.hypot(px - hp.x, py - hp.y) >= 50 && Math.hypot(px - sp.x, py - sp.y) >= 50) { tp = p; break; }
    }
    placeTab(trn, tp || ringPt(it, r, base));
  }

  /* ---------- grab a part to pose it ---------- */
  var PART_NAME = { head: 'Head', wingA: 'Left wing', wingB: 'Right wing' };
  function poseable(o) {
    var out = [];
    if (!o || !o.puppet) return out;
    var P = o.puppet.parts, def = o.puppet.def;
    if (P.head) out.push('head');
    if (P.wingA && def.wings >= 1) out.push('wingA');
    if (P.wingB && def.wings >= 2) out.push('wingB');
    return out;
  }
  function tipLocal(pp, partId) {
    var def = pp.def, P = pp.parts[partId], tip = null, slot;
    for (slot in def.anchors) { if (def.anchors[slot].part === partId && slot !== 'neck') { tip = def.anchors[slot]; if (slot === 'handL' || slot === 'handR' || slot === 'head') break; } }
    var v = tip ? pp.u(tip.x, tip.y) : new THREE.Vector3(pp.u(50, 50).x, pp.u(50, 50).y - pp.S * 0.3, 0);
    return v.sub(P.home);
  }
  function partCtl(it, partId, mode, x0, y0) {
    var o = App.objs[it.id], pp = o.puppet, P = pp.parts[partId], def = pp.def, key = partId;
    var lim = key === 'head' ? [-40, 40] : [0, 160];
    var tipL = tipLocal(pp, partId), r = frameRect();
    function cl(v) { return { x: r.left + v.x, y: r.top + v.y }; }
    function read() {
      P.grp.updateWorldMatrix(true, false);
      var pv = new THREE.Vector3(); P.grp.getWorldPosition(pv);
      var tp = tipL.clone(); P.grp.localToWorld(tp);
      App.camera.updateMatrixWorld(true);
      var a = cl(toFrame(pv)), b = cl(toFrame(tp));
      return { px: a.x, py: a.y, ang: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    function put(v) { it.pose[key] = clamp(Math.round(v * 10) / 10, lim[0], lim[1]); it.pose.preset = 'custom'; App.applyItem(it.id); }
    var start = it.pose[key], s0 = read();
    // how much the part turns on screen for a step in the pose value (this also takes care of flips and the camera angle)
    var step = start + 10 <= lim[1] ? 10 : -10;
    put(start + step); var s1 = read(); put(start);
    var dA = wrap(s1.ang - s0.ang), k = Math.abs(dA) > 0.01 ? step / dA : step / 0.17;
    k = (k < 0 ? -1 : 1) * clamp(Math.abs(k), 30, 130);
    var off = mode === 'grab' ? wrap(Math.atan2(y0 - s0.py, x0 - s0.px) - s0.ang) : 0;
    return {
      move: function (x, y) {
        var c = read();
        if (Math.hypot(x - c.px, y - c.py) < (mode === 'dot' ? 16 : 6)) return;
        pre();
        var target = Math.atan2(y - c.py, x - c.px) - off;
        for (var i = 0; i < 3; i++) {
          c = read();
          var err = wrap(target - c.ang);
          if (Math.abs(err) < 0.004) break;
          put(it.pose[key] + err * k * 0.9);
        }
        changed('pose.' + key, it.id); if (App.ui && App.ui.poseChanged) App.ui.poseChanged();
      },
      end: function () { App.save(); App.commit(); }
    };
  }
  /* pressing on a wing or the head while posing grabs that part; anything else is a normal drag of the item */
  E.press = function (e) {
    if (!App.poseMode) return null;
    var it = sel(), o = it && App.objs[it.id]; if (!o || !o.puppet) return null;
    var r = frameRect();
    var ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    App.camera.updateMatrixWorld(true); o.root.updateMatrixWorld(true);
    App.raycaster.setFromCamera(ndc, App.camera);
    var P = o.puppet.parts, okp = poseable(o), best = null, bd = 1e9;
    Object.keys(P).forEach(function (id) {
      var hits = App.raycaster.intersectObject(P[id].layer.userData.edge, false);
      for (var i = 0; i < hits.length; i++) if (DP.maskHit(hits[i])) { if (hits[i].distance < bd) { bd = hits[i].distance; best = id; } break; }
    });
    if (!best || okp.indexOf(best) < 0) return null;
    return partCtl(it, best, 'grab', e.clientX, e.clientY);
  };

  var dotKey = '';
  function buildDots(it, o) {
    var list = poseable(o), key = it.id + ':' + list.join(',');
    if (key === dotKey) return;
    dotKey = key;
    dotsEl.innerHTML = '';
    list.forEach(function (pid) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'pdot'; b.setAttribute('data-part', pid);
      b.setAttribute('aria-label', PART_NAME[pid] + '. Drag to pose it');
      b.innerHTML = '<i></i>';
      var ctl = null, pidn = null;
      b.addEventListener('pointerdown', function (e) {
        var it2 = sel(); if (!it2 || pidn !== null) return;
        e.preventDefault(); e.stopPropagation();
        try { b.setPointerCapture(e.pointerId); } catch (x) {}
        pidn = e.pointerId; b.classList.add('drag');
        ctl = partCtl(it2, pid, 'dot', e.clientX, e.clientY);
      });
      b.addEventListener('pointermove', function (e) { if (e.pointerId === pidn && ctl) ctl.move(e.clientX, e.clientY); });
      function end(e) { if (e.pointerId !== pidn) return; pidn = null; b.classList.remove('drag'); if (ctl) ctl.end(); ctl = null; }
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
      b.addEventListener('keydown', function (e) {
        var it2 = sel(); if (!it2 || !it2.pose) return;
        var d = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -5 : (e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 5 : 0); if (!d) return;
        e.preventDefault();
        var lim = pid === 'head' ? [-40, 40] : [0, 160];
        pre(); it2.pose[pid] = clamp(it2.pose[pid] + d, lim[0], lim[1]); it2.pose.preset = 'custom'; App.applyItem(it2.id); App.touch && App.touch('pose.' + pid, it2.id); App.save(); App.commitSoon();
        if (App.ui && App.ui.poseChanged) App.ui.poseChanged();
      });
      dotsEl.appendChild(b);
    });
  }
  function placeDots(it, o) {
    buildDots(it, o);
    var P = o.puppet.parts, kids = dotsEl.children;
    for (var i = 0; i < kids.length; i++) {
      var pid = kids[i].getAttribute('data-part'), g = P[pid] && P[pid].grp; if (!g) continue;
      g.updateWorldMatrix(true, false);
      var v = new THREE.Vector3(); g.getWorldPosition(v);
      var p = toFrame(v);
      kids[i].style.left = Math.round(p.x) + 'px'; kids[i].style.top = Math.round(p.y) + 'px';
    }
  }
  E.setPose = function (on) {
    on = !!on;
    if (App.poseMode === on) return;
    App.poseMode = on;
    if (!on) { dotsEl.innerHTML = ''; dotKey = ''; }
    stage.classList.toggle('posing', on);
    App.updateHandle();
  };
  E.longPress = function (id) { if (App.ui && App.ui.longPress) App.ui.longPress(id); };

  /* ---------- everything on the picture, after every draw ---------- */
  App.onHandles = function (it) {
    var o = it && App.objs[it.id];
    if (!it || !o || E.quiet) {
      bar.hidden = true; trn.hidden = true; siz.hidden = true; dotsEl.hidden = true;
      if (it && o) return;               // picked without being touched (the Movie Maker picks a character for you): no bar until the picture is touched
      if (App.poseMode) { App.poseMode = false; dotsEl.innerHTML = ''; dotKey = ''; stage.classList.remove('posing'); if (App.ui && App.ui.poseEnded) App.ui.poseEnded(); }
      return;
    }
    if (App.poseMode && !o.puppet) { App.poseMode = false; dotsEl.innerHTML = ''; dotKey = ''; stage.classList.remove('posing'); if (App.ui && App.ui.poseEnded) App.ui.poseEnded(); }
    placeHandles(it);
    placeBar(it);
    dotsEl.hidden = !App.poseMode;
    if (App.poseMode) placeDots(it, o);
  };

  /* ---------- snapping and the paper grid ---------- */
  var grid = null, gridKey = '';
  E.setSnap = function (on) {
    App.snap = !!on;
    var b = document.querySelectorAll('[data-snap]');
    for (var i = 0; i < b.length; i++) b[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    if (App.ui && App.ui.snapChanged) App.ui.snapChanged(!!on);
  };
  E.grid = function (it) {
    if (!it) { if (grid) { grid.visible = false; App.invalidate(); } return; }
    var cx = Math.round(it.x), cz = Math.round(it.z), key = cx + ',' + cz;
    if (!grid) {
      grid = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x2a2350, transparent: true, opacity: 0.2, depthWrite: false }));
      grid.renderOrder = 3; grid.position.y = 0.014; App.editorLayer.add(grid);
    }
    if (key !== gridKey) {
      gridKey = key;
      var pts = [], R = 4, i;
      for (i = -R * 4; i <= R * 4; i++) {
        pts.push(cx - R, 0, cz + i / 4, cx + R, 0, cz + i / 4);
        pts.push(cx + i / 4, 0, cz - R, cx + i / 4, 0, cz + R);
      }
      grid.geometry.dispose();
      grid.geometry = new THREE.BufferGeometry();
      grid.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    }
    grid.visible = true; App.invalidate();
  };

  /* ---------- turning helpers ---------- */
  function others(it, onlyPuppets) {
    return App.state.items.filter(function (o) { return o.id !== it.id && (!onlyPuppets || DP.isPuppet(o.kind)); });
  }
  function nearest(it, list) {
    var best = null, bd = 1e9;
    list.forEach(function (o) { var d = Math.hypot(o.x - it.x, o.z - it.z); if (d < bd) { bd = d; best = o; } });
    return best;
  }
  function facing(a, b) {          // yaw that turns a toward b, kept within 55 degrees of facing the camera (a paper card cannot turn edge on)
    var base = App.rig.s.yaw / D2R, want = Math.atan2(b.x - a.x, b.z - a.z) / D2R;
    return norm180(base + clamp(norm180(want - base), -55, 55));
  }
  function turnTo(it, y) {
    pre(); it.yaw = Math.round(norm180(App.snap ? Math.round(y / 15) * 15 : y) * 10) / 10; App.applyItem(it.id);
  }
  E.faceCamera = function () { var it = sel(); if (!it) return; turnTo(it, App.rig.s.yaw / D2R); changed('rot', it.id); App.save(); App.commit(); };
  E.faceItem = function (id) {
    var it = sel(), t = App.findItem(id); if (!it || !t) return;
    turnTo(it, facing(it, t)); changed('rot', it.id); App.save(); App.commit();
  };
  E.lineUp = function () {
    var it = sel(); if (!it) return;
    var t = nearest(it, others(it, true)) || nearest(it, others(it, false));
    if (!t) { App.msg('Add another character to line up with.'); return; }
    pre(); it.z = Math.round(t.z * 100) / 100; App.applyItem(it.id); changed('pos', it.id); App.save(); App.commit();
  };
  E.faceEachOther = function () {
    var it = sel(); if (!it) return;
    var t = nearest(it, others(it, true));
    if (!t || !DP.isPuppet(it.kind)) { App.msg('Pick a character, and add another one to face.'); return; }
    turnTo(it, facing(it, t)); turnTo(t, facing(t, it));
    App.applyItem(t.id); changed('rot', it.id); changed('rot', t.id); App.save(); App.commit();
  };
  E.others = function () { var it = sel(); return it ? others(it, true) : []; };

  /* ---------- undo and redo ---------- */
  var H = { stack: [], i: -1 }, restoring = false, MAX = 50;
  function snapshot() {
    var st = App.state, ph = {}, k;
    for (k in st.photo) ph[k] = st.photo[k];
    ph.data = '';
    return { j: JSON.stringify({ set: st.set, items: st.items, light: st.light, look: st.look, stickers: st.stickers, frame: st.frame, photo: ph }), pd: st.photo.data };
  }
  function buttons() {
    var u = document.querySelectorAll('[data-undo]'), r = document.querySelectorAll('[data-redo]'), i;
    for (i = 0; i < u.length; i++) u[i].disabled = H.i <= 0;
    for (i = 0; i < r.length; i++) r[i].disabled = H.i >= H.stack.length - 1;
  }
  if (HIST) App.commit = function () {
    clearTimeout(App._ct);
    if (restoring || !App.state) return;
    var s = snapshot(), top = H.stack[H.i];
    if (top && top.j === s.j && top.pd === s.pd) return;
    H.stack.length = H.i + 1;
    H.stack.push(s);
    if (H.stack.length > MAX + 1) H.stack.shift();
    H.i = H.stack.length - 1;
    buttons();
  };
  E.resetHistory = function () { if (!HIST) return; H.stack = [snapshot()]; H.i = 0; buttons(); };
  if (HIST) App.onLoaded = function () { E.resetHistory(); };
  E.canUndo = function () { return HIST ? H.i > 0 : (cfg.canUndo ? cfg.canUndo() : false); };
  E.canRedo = function () { return HIST ? H.i < H.stack.length - 1 : (cfg.canRedo ? cfg.canRedo() : false); };
  E.historySize = function () { return H.stack.length; };

  function restore(rec) {
    restoring = true;
    var o = JSON.parse(rec.j), st = App.state, jobs = [], k;
    // items: keep the ones that are still there (same id, same kind) so their ids and pictures stay, drop the rest, add the missing
    var want = {};
    o.items.forEach(function (n) { want[n.id] = n; });
    st.items.slice().forEach(function (c) { if (!want[c.id] || want[c.id].kind !== c.kind || !App.objs[c.id]) App.removeItem(c.id); });
    var byId = {}, list = [], fresh = [];
    st.items.forEach(function (c) { byId[c.id] = c; });
    o.items.forEach(function (n) {
      var c = byId[n.id];
      if (c) {
        var rebuild = n.kind.indexOf('bubble:') === 0 && (n.text !== c.text || n.color !== c.color || n.tail !== c.tail);
        for (k in c) delete c[k];
        for (k in n) c[k] = n[k];
        list.push(c); App.applyItem(c.id);
        if (rebuild) fresh.push(c);
      } else { list.push(n); fresh.push(n); }
    });
    st.items = list;
    fresh.forEach(function (n) { jobs.push(App.addItemObj(n)); });
    if (App.sel && !App.findItem(App.sel)) App.sel = null;
    // set, photo, light, look, stickers, frame
    var setChanged = o.set.id !== st.set.id || o.set.color !== st.set.color;
    var photoChanged = JSON.stringify(o.photo) !== JSON.stringify((function () { var p = {}; for (var q in st.photo) p[q] = st.photo[q]; p.data = ''; return p; })()) || rec.pd !== st.photo.data;
    st.photo = o.photo; st.photo.data = rec.pd;
    if (setChanged) { st.set = o.set; jobs.push(App.setBackdrop(o.set.id, o.set.color)); }
    else if (photoChanged) jobs.push(App.applyPhoto());
    st.light = o.light; App.applyLight();
    var craftChange = !!o.look.craft !== !!st.look.craft;
    st.look = o.look;
    if (craftChange) { st.look.craft = !st.look.craft; jobs.push(App.setCraft(o.look.craft)); }
    st.stickers = o.stickers; st.frame = o.frame;
    if (App.overlay) { App.overlay.selected = null; }
    App.layout(); App.updateGuides(); if (App.overlay) App.overlay.render();
    App.updateRing(); App.invalidate(); App.save();
    if (App.ui && App.ui.restored) App.ui.restored();
    restoring = false;
    return Promise.all(jobs).then(function () {
      if (App.sel && !App.objs[App.sel]) App.sel = null;
      App.applyMotion(); App.updateRing(); App.invalidate();
      if (App.ui && App.ui.restored) App.ui.restored();
    });
  }
  E.undo = function () {
    if (!HIST) return cfg.undo ? cfg.undo() : Promise.resolve();
    App.commit();                       // what is on screen now becomes a step, so Redo can bring it back
    if (H.i <= 0) return Promise.resolve();
    H.i--; buttons();
    return restore(H.stack[H.i]);
  };
  E.redo = function () {
    if (!HIST) return cfg.redo ? cfg.redo() : Promise.resolve();
    if (H.i >= H.stack.length - 1) return Promise.resolve();
    H.i++; buttons();
    return restore(H.stack[H.i]);
  };
  if (HIST) buttons();
  return true;
  };
})();
