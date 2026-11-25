/* DIBS Photo Mode: camera rig (orbit and fly) and pointer gestures. Written by hand, no addons. */
(function () {
  'use strict';
  var THREE = window.THREEPKG.THREE;
  var DP = window.DP = window.DP || {};
  var D2R = Math.PI / 180;

  function Rig(camera) {
    this.camera = camera;
    this.s = { tx: 0, ty: 1.1, tz: 0, yaw: 0, pitch: 12 * D2R, dist: 6.2, roll: 0 };
    this.mode = 'orbit';
    this.keys = {};
    this.joy = { x: 0, y: 0, up: 0 };
    this._v = new THREE.Vector3(); this._r = new THREE.Vector3(); this._u = new THREE.Vector3();
  }
  Rig.prototype.dir = function () {
    var s = this.s, cp = Math.cos(s.pitch);
    return this._v.set(Math.sin(s.yaw) * cp, Math.sin(s.pitch), Math.cos(s.yaw) * cp);
  };
  Rig.prototype.apply = function () {
    var s = this.s, c = this.camera, d = this.dir();
    // keep the camera above the floor
    var minY = 0.18;
    if (this.mode === 'orbit') {
      s.pitch = Math.max(2 * D2R, Math.min(85 * D2R, s.pitch));
    } else {
      s.pitch = Math.max(-70 * D2R, Math.min(80 * D2R, s.pitch));
    }
    s.dist = Math.max(0.6, Math.min(45, s.dist));
    d = this.dir();
    var py = s.ty + d.y * s.dist;
    if (py < minY) { s.ty += (minY - py); }
    c.position.set(s.tx + d.x * s.dist, s.ty + d.y * s.dist, s.tz + d.z * s.dist);
    c.up.set(0, 1, 0);
    c.lookAt(s.tx, s.ty, s.tz);
    if (s.roll) c.rotateZ(s.roll * D2R);
    c.updateMatrixWorld(true);
  };
  Rig.prototype.rotate = function (dx, dy) {
    var s = this.s, k = 0.0055;
    if (this.mode === 'orbit') { s.yaw -= dx * k; s.pitch += dy * k; }
    else {
      // turn the view around the camera itself
      var d = this.dir(), px = s.tx + d.x * s.dist, py = s.ty + d.y * s.dist, pz = s.tz + d.z * s.dist;
      s.yaw += dx * k; s.pitch -= dy * k;
      s.pitch = Math.max(-70 * D2R, Math.min(80 * D2R, s.pitch));
      var d2 = this.dir();
      s.tx = px - d2.x * s.dist; s.ty = py - d2.y * s.dist; s.tz = pz - d2.z * s.dist;
    }
    this.apply();
  };
  Rig.prototype.dolly = function (amount) {   // amount > 0 moves closer
    var s = this.s;
    if (this.mode === 'orbit') { s.dist *= Math.exp(-amount); }
    else {
      var d = this.dir(), step = amount * s.dist * 0.9;
      s.tx -= d.x * step; s.ty -= d.y * step; s.tz -= d.z * step;
    }
    this.apply();
  };
  Rig.prototype.pan = function (dx, dy, viewH) {
    var s = this.s, c = this.camera;
    var k = 2 * s.dist * Math.tan(c.fov * D2R / 2) / viewH;
    c.updateMatrixWorld(true);
    var r = this._r.setFromMatrixColumn(c.matrixWorld, 0), u = this._u.setFromMatrixColumn(c.matrixWorld, 1);
    s.tx += (-dx * r.x + dy * u.x) * k; s.ty += (-dx * r.y + dy * u.y) * k; s.tz += (-dx * r.z + dy * u.z) * k;
    this.apply();
  };
  /* keyboard / joystick flight. Returns true while moving. */
  Rig.prototype.update = function (dt) {
    var k = this.keys, j = this.joy;
    var f = (k.w ? 1 : 0) - (k.s ? 1 : 0) + (-j.y), sx = (k.d ? 1 : 0) - (k.a ? 1 : 0) + j.x, up = (k.e ? 1 : 0) - (k.q ? 1 : 0) + j.up;
    if (!f && !sx && !up) return false;
    var sp = 3.2 * dt * (k.shift ? 2.5 : 1), s = this.s;
    var c = this.camera; c.updateMatrixWorld(true);
    var fw = this._v.set(0, 0, -1).applyQuaternion(c.quaternion);
    var r = this._r.setFromMatrixColumn(c.matrixWorld, 0);
    s.tx += (fw.x * f + r.x * sx) * sp; s.ty += (fw.y * f + r.y * sx + up) * sp; s.tz += (fw.z * f + r.z * sx) * sp;
    this.apply();
    return true;
  };
  Rig.prototype.setMode = function (m) {
    if (m === this.mode) return;
    this.mode = m;
    if (m === 'orbit') this.s.pitch = Math.max(2 * D2R, this.s.pitch);
    this.apply();
  };
  Rig.prototype.get = function () { var o = {}; for (var k in this.s) o[k] = this.s[k]; o.mode = this.mode; return o; };
  Rig.prototype.set = function (o) {
    for (var k in this.s) if (typeof o[k] === 'number' && isFinite(o[k])) this.s[k] = o[k];
    this.mode = o.mode === 'fly' ? 'fly' : 'orbit';
    this.apply();
  };

  /* ---------- pointer gestures ---------- */
  /* hooks: pick(cx,cy) -> id|null; drag(phase, id, cx, cy); tap(cx,cy, pickedId); changed(); height() */
  function Gestures(el, rig, hooks) {
    var self = this;
    this.el = el; this.rig = rig; this.h = hooks;
    this.ptrs = {}; this.n = 0;
    this.mode = null; this.dragId = null; this.moved = 0; this.t0 = 0; this.start = null;
    this.pinchD = 0; this.pinchC = null;
    el.addEventListener('pointerdown', function (e) { self.down(e); });
    el.addEventListener('pointermove', function (e) { self.move(e); });
    el.addEventListener('pointerup', function (e) { self.up(e); });
    el.addEventListener('pointercancel', function (e) { self.up(e, true); });
    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      var amt = -e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016);
      if (e.ctrlKey) amt *= 2.2;
      rig.dolly(amt); hooks.changed(true);
    }, { passive: false });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  Gestures.prototype.centroid = function () {
    var xs = 0, ys = 0, n = 0, p;
    for (var id in this.ptrs) { p = this.ptrs[id]; xs += p.x; ys += p.y; n++; }
    return { x: xs / n, y: ys / n };
  };
  Gestures.prototype.spread = function () {
    var a = [], id;
    for (id in this.ptrs) a.push(this.ptrs[id]);
    return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  };
  Gestures.prototype.down = function (e) {
    if (e.button > 2) return;
    this.el.setPointerCapture && this.el.setPointerCapture(e.pointerId);
    this.ptrs[e.pointerId] = { x: e.clientX, y: e.clientY, button: e.button };
    this.n = Object.keys(this.ptrs).length;
    if (this.n === 1) {
      this.start = { x: e.clientX, y: e.clientY }; this.moved = 0; this.t0 = Date.now();
      this.picked = null;
      if (e.button === 0) this.picked = this.h.pick(e.clientX, e.clientY);
      if (e.button === 0 && this.picked) { this.mode = 'item'; this.dragId = this.picked; this.h.drag('start', this.picked, e.clientX, e.clientY); }
      else if (e.button === 2 || e.button === 1) this.mode = 'pan';
      else this.mode = 'look';
    } else if (this.n === 2) {
      if (this.mode === 'item') this.h.drag('end', this.dragId, 0, 0);
      this.mode = 'pinch'; this.pinchD = this.spread(); this.pinchC = this.centroid(); this.moved = 999;
    }
  };
  Gestures.prototype.move = function (e) {
    var p = this.ptrs[e.pointerId]; if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    this.moved += Math.abs(dx) + Math.abs(dy);
    if (this.mode === 'item') { if (this.moved > 4) this.h.drag('move', this.dragId, e.clientX, e.clientY); }
    else if (this.mode === 'look') { if (this.moved > 3) { this.rig.rotate(dx, dy); this.h.changed(true); } }
    else if (this.mode === 'pan') { this.rig.pan(dx, dy, this.h.height()); this.h.changed(true); }
    else if (this.mode === 'pinch' && this.n >= 2) {
      var d = this.spread(), c = this.centroid();
      if (this.pinchD > 0 && d > 0) { this.rig.dolly(Math.log(d / this.pinchD) * 1.4); }
      this.rig.pan(c.x - this.pinchC.x, c.y - this.pinchC.y, this.h.height());
      this.pinchD = d; this.pinchC = c; this.h.changed(true);
    }
  };
  Gestures.prototype.up = function (e, cancel) {
    if (!this.ptrs[e.pointerId]) return;
    delete this.ptrs[e.pointerId];
    this.n = Object.keys(this.ptrs).length;
    if (this.n === 0) {
      if (this.mode === 'item') this.h.drag('end', this.dragId, e.clientX, e.clientY);
      var tap = !cancel && this.moved < 6 && Date.now() - this.t0 < 600 && this.mode !== 'pinch' && this.mode !== 'pan';
      if (tap) this.h.tap(e.clientX, e.clientY, this.picked);
      this.mode = null; this.dragId = null;
      this.h.changed(false);
    } else if (this.n === 1) {
      // one finger left after a pinch: keep orbiting from here, no tap
      this.mode = 'look'; this.moved = 999;
    }
  };

  DP.Rig = Rig;
  DP.Gestures = Gestures;
})();
