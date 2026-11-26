/* DIBS Movie Maker: quick scene tools (engine).
   Per character action lists live on the shot (shot.actions = { itemId: [ {type, ...} ] }, shot.autoCamera).
   MM.compileActions turns them into ordinary keys on ordinary tracks, marked gen:true, so everything stays
   editable on the timeline and exports the same way. Hand made keys are never touched.
   Also here: the automatic camera, the typed script, and saved recipes. No screen code in this file. */
(function () {
  'use strict';
  var DP = window.DP, App = DP.app, MM = DP.movie;
  var FPS = MM.FPS, MAX_DUR = MM.MAX_DUR, POSE_PARAMS = MM.POSE_PARAMS;
  var D2R = Math.PI / 180, R2D = 180 / Math.PI;
  var LEAD = 0.3;         // the shot opens for a moment before anything happens
  var END_HOLD = 0.5;     // and holds for half a second before the cut
  var SETTLE = 0.35;      // the little stop at the end of a walk
  var TYPES = ['walk', 'wave', 'say', 'emote', 'pose', 'hop', 'look', 'wait', 'wear', 'enter', 'exit'];
  MM.ACTION_TYPES = TYPES;
  MM.SPEEDS = { slow: 0.7, normal: 1.2, fast: 2.0 };
  MM.actionInfo = {};     // shot id -> what the last compile worked out (times of each action, end positions, length)

  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function r3(v) { return Math.round(v * 1000) / 1000; }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function snap(t) { return r4(Math.round(t * FPS) / FPS); }
  function ceilT(t) { return r4(Math.ceil(t * FPS - 1e-6) / FPS); }
  function dist2(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

  /* ---------- cleaning (used when a movie loads) ---------- */
  function cleanAction(a, loose) {
    if (!a || typeof a !== 'object' || TYPES.indexOf(a.type) < 0) return null;
    var o = { type: a.type };
    if (a.type === 'walk') {
      var path = [];
      (Array.isArray(a.path) ? a.path : []).slice(0, 80).forEach(function (p) {
        if (Array.isArray(p) && isNum(p[0]) && isNum(p[1])) path.push([r3(clamp(p[0], -60, 60)), r3(clamp(p[1], -60, 60))]);
      });
      if (!path.length) return null;
      o.path = path; o.speed = isNum(a.speed) ? clamp(a.speed, 0.3, 4) : MM.SPEEDS.normal; o.follow = a.follow === true;
      if (loose && a.rel === true) o.rel = true;
    } else if (a.type === 'say') {
      var tx = typeof a.text === 'string' ? a.text.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
      if (!tx) return null;
      o.text = tx; o.style = DP.BUBBLES.some(function (b) { return b.id === a.style; }) ? a.style : 'speech';
    } else if (a.type === 'emote') {
      if (!DP.emoteInfo(a.id)) return null;
      o.id = a.id;
    } else if (a.type === 'pose') {
      o.preset = DP.POSES.some(function (p) { return p.id === a.preset; }) ? a.preset : 'stand';
    } else if (a.type === 'look') {
      var tg = a.target;
      if (tg === 'left' || tg === 'right' || tg === 'camera' || (loose && tg === '@other') || (typeof tg === 'string' && /^[\w-]{1,40}$/.test(tg))) o.target = tg; else o.target = 'camera';
    } else if (a.type === 'wait') {
      o.sec = isNum(a.sec) ? r3(clamp(a.sec, 0.1, 30)) : 1;
    } else if (a.type === 'wear') {
      o.costume = a.costume === 'none' || DP.costumeInfo(a.costume) ? a.costume : 'none';
    }
    return o;
  }
  MM.cleanAction = cleanAction;
  MM.cleanActions = function (raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).slice(0, 30).forEach(function (id) {
      if (!/^[\w-]{1,40}$/.test(id) || !Array.isArray(raw[id])) return;
      var list = [];
      raw[id].slice(0, 80).forEach(function (a) { var c = cleanAction(a); if (c) list.push(c); });
      if (list.length) out[id] = list;
    });
    return out;
  };

  /* ---------- default durations ---------- */
  MM.sayDur = function (text) { return 2.5 + 0.06 * String(text || '').length; };
  var FIXED = { wave: 1.5, emote: 1.2, pose: 1.0, hop: 0.8, look: 0.8, wear: 0.6, enter: 0.4, exit: 0.4 };
  function smoothPath(pts) {
    for (var k = 0; k < 2; k++) {
      if (pts.length < 3) break;
      var out = [pts[0]];
      for (var i = 0; i < pts.length - 1; i++) {
        var p = pts[i], q = pts[i + 1];
        out.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
      }
      out.push(pts[pts.length - 1]);
      pts = out;
    }
    return pts;
  }
  /* a walk starts where the character stands. If the drawn path starts somewhere else, the character first walks to it. */
  function walkPoints(a, from) {
    var pts = [[from[0], from[1]]];
    (a.path || []).forEach(function (p) { if (dist2(pts[pts.length - 1], p) > 0.02) pts.push([p[0], p[1]]); });
    return pts;
  }
  function walkInfo(a, from) {
    var pts = walkPoints(a, from);
    if (pts.length < 2) return { pts: pts, sm: pts, len: 0, moveT: 0, dur: 0.4 };
    var sm = smoothPath(pts), len = 0, cum = [0], i;
    for (i = 1; i < sm.length; i++) { len += dist2(sm[i - 1], sm[i]); cum.push(len); }
    var sp = clamp(a.speed || MM.SPEEDS.normal, 0.3, 4), moveT = Math.max(0.4, len / sp);
    return { pts: pts, sm: sm, cum: cum, len: len, moveT: moveT, dur: moveT + SETTLE };
  }
  function atArc(w, s) {
    var sm = w.sm, cum = w.cum; s = clamp(s, 0, w.len);
    var i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
    var seg = cum[i] - cum[i - 1] || 1, u = (s - cum[i - 1]) / seg;
    return [sm[i - 1][0] + (sm[i][0] - sm[i - 1][0]) * u, sm[i - 1][1] + (sm[i][1] - sm[i - 1][1]) * u];
  }
  MM.walkLength = function (a, from) { return walkInfo(a, from).len; };
  MM.actionDur = function (a, from) {
    if (a.type === 'say') return MM.sayDur(a.text);
    if (a.type === 'wait') return a.sec || 1;
    if (a.type === 'walk') return walkInfo(a, from || [0, 0]).dur;
    return FIXED[a.type] || 1;
  };

  /* a paper puppet seen from the front cannot turn all the way round, so facing is limited to what still reads as a flat card */
  function headingYaw(dx, dz, k) {
    var h = Math.atan2(dx, dz) * R2D;
    if (Math.abs(h) > 90) h = (h < 0 ? -1 : 1) * (180 - Math.abs(h));
    return clamp(h * k, -60, 60);
  }

  /* ---------- sampling generated keys (for the camera) ---------- */
  function sampleVec(keys, t) {
    var n = keys.length;
    if (t <= keys[0].t) return keys[0].v;
    if (t >= keys[n - 1].t) return keys[n - 1].v;
    var i = 0; while (i < n - 1 && keys[i + 1].t <= t) i++;
    var a = keys[i], b = keys[i + 1], e = MM.ease(a.ease, (t - a.t) / (b.t - a.t));
    return a.v.map(function (x, j) { return x + (b.v[j] - x) * e; });
  }

  /* ---------- the plan: every key the lists ask for ---------- */
  function sizeOf(bi) { var d = DP.PUPPETS[bi.kind]; return (d ? d.size : 1.2) * (bi.scale || 1); }
  function plan(shot, base) {
    var lists = shot.actions || {}, G = {}, info = { times: {}, end: {}, start: {}, paths: {}, says: [], follows: [], needed: 0, ids: [] };
    var maxEnd = 0, aspect = (function () { var p = MM.platformInfo(MM.movie.platform); return p.w / p.h; })();

    /* key lists. Every continuous track starts with a key at 0 that holds the scene's own value. */
    function trk(target, v0, baseVal) {
      var a = G[target];
      if (!a) { a = G[target] = [{ t: 0, v: clone(v0), ease: 'easeInOut' }]; a.base = clone(baseVal === undefined ? v0 : baseVal); }
      return a;
    }
    function hold(a, t) { var l = a[a.length - 1]; if (t > l.t + 1e-6) a.push({ t: t, v: clone(l.v), ease: 'easeInOut' }); return a; }
    function put(a, t, v, ease) {
      var l = a[a.length - 1];
      if (t <= l.t + 1e-6) { l.v = clone(v); l.ease = ease || 'easeInOut'; return; }
      a.push({ t: t, v: clone(v), ease: ease || 'easeInOut' });
    }
    function seg(a, t0, t1, v, ease) {
      hold(a, t0); a[a.length - 1].ease = ease || 'easeInOut';
      put(a, Math.max(t1, t0 + 1 / FPS), v, 'easeInOut');
    }
    function disc(target, t, v) {
      var a = G[target] || (G[target] = []), l = a[a.length - 1];
      if (l && Math.abs(l.t - t) < 1e-6) { l.v = clone(v); return; }
      a.push({ t: t, v: clone(v), ease: 'linear' });
    }

    function runChar(id, list) {
      var bi = base.items[id], def = DP.PUPPETS[bi.kind], wings = def ? def.wings : 0, side = !!(def && def.side), T = 'item:' + id + '.';
      var st = { x: bi.x, z: bi.z, yaw: bi.yaw || 0, pose: {} };
      POSE_PARAMS.forEach(function (p) { st.pose[p] = bi.pose && isNum(bi.pose[p]) ? bi.pose[p] : 0; });
      var t = LEAD, times = [];
      info.start[id] = { x: bi.x, z: bi.z };
      function P(p, t0, t1, v, ease) { seg(trk(T + 'pose.' + p, bi.pose && isNum(bi.pose[p]) ? bi.pose[p] : 0), t0, t1, v, ease); }
      function setP(p, t0, t1, v, ease) { P(p, t0, t1, v, ease); st.pose[p] = v; }
      function yawTo(t0, t1, y) { seg(trk(T + 'rot', bi.yaw || 0), t0, t1, y, 'easeInOut'); st.yaw = y; }

      list.forEach(function (a) {
        var t0 = t, dur = a.type === 'walk' ? 0 : MM.actionDur(a), i;
        if (a.type === 'wait') { /* time passes */ }
        else if (a.type === 'say') {
          disc(T + 'bubble', t0, { text: a.text, style: a.style || 'speech', tail: 'down' });
          disc(T + 'bubble', t0 + dur, null);
          info.says.push({ id: id, t0: t0, t1: t0 + dur });
        } else if (a.type === 'emote') {
          disc(T + 'emote', t0, { id: a.id, x: 0, s: 1 });
          disc(T + 'emote', t0 + dur, null);
        } else if (a.type === 'wear') {
          disc(T + 'wear', t0, a.costume === 'none' ? null : { id: a.costume });
        } else if (a.type === 'enter') {
          if (!G[T + 'visible']) disc(T + 'visible', 0, false);
          disc(T + 'visible', t0, true);
        } else if (a.type === 'exit') {
          disc(T + 'visible', t0 + dur, false);
        } else if (a.type === 'pose') {
          var tp = DP.poseFromPreset(a.preset, null, bi.kind);
          POSE_PARAMS.forEach(function (p) { if (Math.abs(tp[p] - st.pose[p]) > 1e-6) setP(p, t0, t0 + 0.3, tp[p]); });
        } else if (a.type === 'wave') {
          var wp = wings >= 2 ? 'wingB' : wings === 1 ? 'wingA' : null, w0 = wp ? st.pose[wp] : 0, h0 = st.pose.head;
          if (wp) {
            P(wp, t0, t0 + 0.25, 150);
            for (i = 0; i < 4; i++) P(wp, t0 + 0.25 + i * 0.25, t0 + 0.5 + i * 0.25, i % 2 ? 150 : 112);
            P(wp, t0 + 1.25, t0 + 1.5, w0);
            P('head', t0, t0 + 0.25, 6); P('head', t0 + 1.25, t0 + 1.5, h0);
          } else {      // no wings: a happy head wobble
            for (i = 0; i < 4; i++) P('head', t0 + i * 0.3, t0 + i * 0.3 + 0.3, i % 2 ? -12 : 12);
            P('head', t0 + 1.2, t0 + 1.5, h0);
          }
        } else if (a.type === 'hop') {
          var h1 = st.pose.hop, b1 = st.pose.bend, wA = st.pose.wingA, wB = st.pose.wingB;
          P('hop', t0, t0 + 0.3, 0.55); P('hop', t0 + 0.3, t0 + 0.62, h1);
          P('bend', t0 + 0.3, t0 + 0.62, b1); P('bend', t0 + 0.62, t0 + 0.7, 11); P('bend', t0 + 0.7, t0 + 0.8, b1);
          if (wings >= 1) { P('wingA', t0, t0 + 0.3, 45); P('wingA', t0 + 0.3, t0 + 0.62, wA); }
          if (wings >= 2) { P('wingB', t0, t0 + 0.3, 45); P('wingB', t0 + 0.3, t0 + 0.62, wB); }
        } else if (a.type === 'look') {
          var lk = 0, hd = 0, yw = 0, tg = a.target;
          if (tg === 'left') { lk = -1; hd = 8; yw = -18; }
          else if (tg === 'right') { lk = 1; hd = -8; yw = 18; }
          else if (tg && tg !== 'camera' && base.items[tg] && tg !== id) {
            var o = base.items[tg], dx = o.x - st.x;
            if (Math.abs(dx) > 0.15) { lk = dx > 0 ? 1 : -1; hd = -8 * lk; yw = headingYaw(dx, o.z - st.z, 0.4) ; }
          }
          setP('look', t0, t0 + 0.3, lk); setP('head', t0, t0 + 0.3, hd); yawTo(t0, t0 + 0.4, yw);
        } else if (a.type === 'walk') {
          var w = walkInfo(a, [st.x, st.z]);
          dur = w.dur;
          if (w.len > 0.01) {
            var pa = trk(T + 'pos', [bi.x, bi.z]), ra = trk(T + 'rot', bi.yaw || 0), n = Math.max(2, Math.ceil(w.moveT * 6)), yaw = st.yaw, k, lastDx = 0;
            hold(pa, t0); hold(ra, t0);
            pa[pa.length - 1].ease = 'linear'; ra[ra.length - 1].ease = 'linear';
            for (k = 1; k <= n; k++) {
              var u = k / n, f = 0.4 * u + 0.6 * (0.5 - 0.5 * Math.cos(Math.PI * u)), s = f * w.len;
              var p = atArc(w, s), p2 = atArc(w, Math.min(w.len, s + 0.12)), p1 = atArc(w, Math.max(0, s - 0.12));
              var hx = p2[0] - p1[0], hz = p2[1] - p1[1];
              if (Math.hypot(hx, hz) > 1e-4) { yaw += (headingYaw(hx, hz, 0.65) - yaw) * 0.5; lastDx = hx; }
              put(pa, t0 + w.moveT * u, p, 'linear');
              put(ra, t0 + w.moveT * u, yaw, 'linear');
            }
            if (side) { var lkv = lastDx >= 0 ? 1 : -1; P('look', t0, t0 + 0.15, lkv); }
            // the paper waddle: a little sway and a tiny hop on every step
            var step = clamp(0.36 * 1.2 / clamp(a.speed || 1.2, 0.3, 4), 0.2, 0.6), steps = Math.floor(w.moveT / step);
            for (k = 0; k < steps; k++) {
              var ts = t0 + k * step;
              P('lean', ts, ts + step, k % 2 ? -6 : 6);
              P('hop', ts, ts + step * 0.5, 0.14); P('hop', ts + step * 0.5, ts + step, st.pose.hop);
            }
            var te = t0 + w.moveT;
            P('lean', te, te + 0.15, st.pose.lean);
            P('bend', te, te + 0.12, st.pose.bend + 10); P('bend', te + 0.12, te + SETTLE, st.pose.bend);
            if (side) P('look', te, te + 0.2, st.pose.look);
            var last = w.pts[w.pts.length - 1];
            st.x = last[0]; st.z = last[1];
            // face the camera again with the settle
            seg(ra, te, te + SETTLE, bi.yaw || 0, 'easeInOut'); st.yaw = bi.yaw || 0;
            info.paths[id] = (info.paths[id] || []).concat([{ pts: w.pts, t0: t0, t1: te }]);
            if (a.follow) info.follows.push({ id: id, t0: t0, t1: te });
          }
        }
        times.push({ t0: t0, t1: t0 + dur });
        t = t0 + dur;
      });
      info.times[id] = times; info.end[id] = { x: st.x, z: st.z };
      maxEnd = Math.max(maxEnd, t);
    }

    Object.keys(lists).forEach(function (id) {
      if (!base.items[id] || !lists[id] || !lists[id].length) return;
      info.ids.push(id);
      runChar(id, lists[id]);
    });
    info.needed = info.ids.length ? ceilT(maxEnd + END_HOLD) : 0;

    /* ---------- the camera ---------- */
    function posAt(id, t) { var a = G['item:' + id + '.pos'], bi = base.items[id]; return a ? sampleVec(a, t) : [bi.x, bi.z]; }
    var auto = !!shot.autoCamera, fol = info.follows;
    var puppetIds = Object.keys(base.items).filter(function (id) { return !!DP.PUPPETS[base.items[id].kind]; });
    if ((auto || fol.length) && puppetIds.length) {
      var cur, est = null, curFocus = 0, KP, KT, KF = null;
      var followed = {}; fol.forEach(function (f) { followed[f.id] = true; });
      if (auto) {
        var vf = DP.fovFor(base.mm, aspect) * D2R, tv = Math.tan(vf / 2), th = tv * aspect;
        var xmin = Infinity, xmax = -Infinity, zs = 0, Hm = 0;
        puppetIds.forEach(function (id) {
          var bi = base.items[id], hw = sizeOf(bi) * 0.31, xs = [bi.x];
          if (!followed[id] && G['item:' + id + '.pos']) G['item:' + id + '.pos'].forEach(function (k) { xs.push(k.v[0]); });
          xs.forEach(function (x) { xmin = Math.min(xmin, x - hw); xmax = Math.max(xmax, x + hw); });
          zs += bi.z; Hm = Math.max(Hm, sizeOf(bi));
        });
        var yaw = clamp(base.cam.yaw, -0.45, 0.45), pitch = clamp(base.cam.pitch, 0.05, 0.25);
        var tgt = [(xmin + xmax) / 2, Hm * 0.7, zs / puppetIds.length];
        var dist = Math.max(((xmax - xmin) / 2 + 0.5) / th, (Hm * 0.575 + 0.4) / tv, 3.0);
        var dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
        est = { tgt: tgt, dir: dir, dist: dist, pos: [0, 1, 2].map(function (i) { return tgt[i] + dir[i] * dist; }) };
        cur = { pos: est.pos.slice(), tgt: est.tgt.slice() };
        curFocus = dist;
      } else cur = { pos: base.camPos.slice(), tgt: base.camTarget.slice() };
      KP = trk('camera.pos', cur.pos, base.camPos); KT = trk('camera.target', cur.tgt, base.camTarget);
      if (auto) KF = trk('camera.focus', curFocus, -1);

      var focusOf = function (fr, P) {
        var fw = [fr.tgt[0] - fr.pos[0], fr.tgt[1] - fr.pos[1], fr.tgt[2] - fr.pos[2]], L = Math.hypot(fw[0], fw[1], fw[2]) || 1;
        return Math.max(0.5, ((P[0] - fr.pos[0]) * fw[0] + (P[1] - fr.pos[1]) * fw[1] + (P[2] - fr.pos[2]) * fw[2]) / L);
      };
      var speakerFrame = function (id, t) {
        var p = posAt(id, t), H = sizeOf(base.items[id]);
        var tg = [est.tgt[0] + (p[0] - est.tgt[0]) * 0.55, est.tgt[1] + (H * 0.78 - est.tgt[1]) * 0.6, est.tgt[2] + (p[1] - est.tgt[2]) * 0.55];
        var d = Math.max(est.dist * 0.90, 2.4);
        return { pos: [0, 1, 2].map(function (i) { return tg[i] + est.dir[i] * d; }), tgt: tg, P: [p[0], H * 0.62, p[1]] };
      };
      var move = function (ta, tb, fr, P, ease) {
        seg(KP, ta, tb, fr.pos, ease); seg(KT, ta, tb, fr.tgt, ease);
        if (KF && P) { seg(KF, ta, tb, focusOf(fr, P), ease); }
        cur = { pos: fr.pos.slice(), tgt: fr.tgt.slice() };
      };
      var segs = [];
      if (auto) info.says.forEach(function (s) { segs.push({ k: 'say', id: s.id, t0: s.t0, t1: s.t1 }); });
      fol.forEach(function (f) { segs.push({ k: 'follow', id: f.id, t0: f.t0, t1: f.t1 + 0.3, walkEnd: f.t1 }); });
      segs.sort(function (a, b) { return a.t0 - b.t0; });
      for (var q = 0; q < segs.length - 1; q++) if (segs[q].t1 > segs[q + 1].t0) segs[q].t1 = segs[q + 1].t0;
      var lastSp = null;
      segs.forEach(function (sg) {
        if (sg.t1 - sg.t0 < 0.1) return;
        if (sg.k === 'say') {
          if (sg.id === lastSp) return;          // the same person goes on talking: the camera stays
          lastSp = sg.id;
          var fr = speakerFrame(sg.id, sg.t0), tb = Math.min(sg.t0 + 0.8, sg.t1);
          if (dist2([fr.pos[0], fr.pos[2]], [cur.pos[0], cur.pos[2]]) > 0.04 || Math.abs(fr.pos[1] - cur.pos[1]) > 0.04 || dist2([fr.tgt[0], fr.tgt[2]], [cur.tgt[0], cur.tgt[2]]) > 0.04) {
            move(sg.t0, tb, fr, fr.P, 'easeInOut');
            // a gentle push in while the line is on screen (about 10 to 14 percent closer than the wide shot)
            if (sg.t1 - tb > 0.3) {
              var cr = { tgt: fr.tgt, pos: [0, 1, 2].map(function (i) { return fr.tgt[i] + (fr.pos[i] - fr.tgt[i]) * 0.955; }) };
              move(tb, sg.t1, cr, fr.P, 'easeInOut');
            }
          }
        } else {
          lastSp = null;
          var p0 = posAt(sg.id, sg.t0), n = Math.max(2, Math.ceil((sg.t1 - sg.t0) * 6)), lag = [0, 0], k, base0 = { pos: cur.pos.slice(), tgt: cur.tgt.slice() };
          hold(KP, sg.t0); hold(KT, sg.t0); KP[KP.length - 1].ease = 'linear'; KT[KT.length - 1].ease = 'linear';
          for (k = 1; k <= n; k++) {
            var tt = sg.t0 + (sg.t1 - sg.t0) * k / n, pp = posAt(sg.id, Math.min(tt, sg.walkEnd)), d = [pp[0] - p0[0], pp[1] - p0[1]];
            if (k === n) lag = d; else { lag[0] += (d[0] - lag[0]) * 0.45; lag[1] += (d[1] - lag[1]) * 0.45; }
            put(KP, tt, [base0.pos[0] + lag[0], base0.pos[1], base0.pos[2] + lag[1]], 'linear');
            put(KT, tt, [base0.tgt[0] + lag[0], base0.tgt[1], base0.tgt[2] + lag[1]], 'linear');
          }
          cur = { pos: KP[KP.length - 1].v.slice(), tgt: KT[KT.length - 1].v.slice() };
        }
      });
    }
    info.G = G;
    return info;
  }

  /* ---------- turning the plan into keys on the shot ---------- */
  var CAMERA_AUTO = ['camera.pos', 'camera.target', 'camera.focus'];
  function stripGen(shot, onlyCamera) {
    shot.tracks.forEach(function (tr) { if (!onlyCamera || CAMERA_AUTO.indexOf(tr.target) >= 0) tr.keys = tr.keys.filter(function (k) { return !k.gen; }); });
    shot.tracks = shot.tracks.filter(function (tr) { return tr.keys.length; });
  }
  function hasManualCamera(shot) {
    return shot.tracks.some(function (tr) { return CAMERA_AUTO.indexOf(tr.target) >= 0 && tr.keys.some(function (k) { return !k.gen; }); });
  }
  MM.hasManualCamera = hasManualCamera;
  MM.autoCameraOff = function (shot, silent) {
    if (!shot || !shot.autoCamera) return;
    shot.autoCamera = false;
    stripGen(shot, true);
    if (!silent) App.msg('Auto camera is off, because you set a camera key by hand.', 4200);
    MM.emit('autocam');
  };
  function same(a, b) { return Array.isArray(a) ? a.every(function (x, i) { return Math.abs(x - b[i]) < 1e-4; }) : Math.abs(a - b) < 1e-4; }
  function merge(shot, G, dur) {
    stripGen(shot, false);
    Object.keys(G).forEach(function (target) {
      var keys = G[target], d = MM.describe(target);
      if (!d || !keys.length) return;
      if (d.mode !== 'discrete') {
        // a track that never leaves the scene's own value adds nothing
        if (keys.every(function (k) { return same(k.v, keys.base); })) return;
      }
      var tr = MM.getTrack(shot, target, true), by = {};
      keys.forEach(function (k) { if (k.t <= dur + 1e-6) by[snap(Math.min(k.t, dur))] = k; });
      Object.keys(by).map(parseFloat).sort(function (a, b) { return a - b; }).forEach(function (t) {
        if (MM.keyAt(tr, t) >= 0) return;               // a key made by hand wins
        var k = by[t];
        tr.keys.push({ t: t, v: clone(k.v), ease: k.ease || 'easeInOut', gen: true });
        tr.keys.sort(function (a, b) { return a.t - b.t; });
      });
    });
    shot.tracks = shot.tracks.filter(function (tr) { return tr.keys.length; });
  }

  /* put the live scene back to what the shot starts as, so keys that were taken away do not leave a character where it ended */
  MM.resetToBase = function () {
    var b = MM.base, st = App.state, rig = App.rig;
    if (!b || !st || !rig) return;
    Object.keys(b.items).forEach(function (id) {
      var it = App.findItem(id), bi = b.items[id], o = App.objs[id];
      if (!it || !o) return;
      it.x = bi.x; it.z = bi.z; it.y = bi.y; it.yaw = bi.yaw;
      if (bi.pose) it.pose = clone(bi.pose);
      it.move = bi.move; it.emote = clone(bi.emote); it.attach = clone(bi.attach) || [];
      App.applyItem(id);
      o.root.visible = true;
    });
    var c = b.cam; ['tx', 'ty', 'tz', 'yaw', 'pitch', 'dist'].forEach(function (k) { rig.s[k] = c[k]; });
    rig.s.roll = b.roll || 0;
    st.lens.mm = b.mm; st.lens.fnum = b.fstop; st.lens.exposure = b.exposure; st.lens.focus = clone(b.focus);
    App.applyLens(); App.invalidate();
  };

  MM.compileActions = function (shot, opts) {
    opts = opts || {};
    shot = shot || MM.cur();
    if (!shot) return null;
    var live = MM.cur() === shot && !MM.loading && !!MM.base;
    if (live) MM.commit();
    var base = live ? MM.base : MM.baseFromScene(App.clean(shot.scene)), note = '';
    // characters that are gone
    var lists = shot.actions || {};
    Object.keys(lists).forEach(function (id) { if (!base.items[id] || !lists[id] || !lists[id].length) delete lists[id]; });
    if (!Object.keys(lists).length) delete shot.actions;
    if (shot.autoCamera && hasManualCamera(shot)) { shot.autoCamera = false; note = 'Auto camera is off, because this shot has camera keys you made.'; }
    var P = plan(shot, base);
    var others = MM.movie ? MM.total() - shot.duration : 0, allowed = Math.max(0.5, MAX_DUR - others);
    var needed = P.needed, over = needed > allowed + 1e-6, want = Math.min(needed, allowed);
    if (needed > 0) {
      // the shot grows to fit its commands, and goes back to its own length when they are taken away
      var auto = shot.actDur === undefined || Math.abs(shot.duration - shot.actDur) < 0.02;
      if (shot.actDur === undefined) shot.preDur = shot.duration;
      var wantD = r4(Math.max(shot.preDur || 0.5, want));
      if (auto || want > shot.duration) {
        var nd = auto ? Math.min(wantD, allowed) : r4(want);
        if (nd < shot.duration - 1e-6) shot.tracks.forEach(function (tr) { tr.keys = tr.keys.filter(function (k) { return k.t <= nd + 1e-6; }); });
        shot.duration = r4(Math.max(0.5, nd));
      }
      shot.actDur = shot.duration;
    } else {
      if (shot.actDur !== undefined && shot.preDur !== undefined && Math.abs(shot.duration - shot.actDur) < 0.02) {
        var back = r4(Math.max(0.5, shot.preDur));
        shot.tracks.forEach(function (tr) { tr.keys = tr.keys.filter(function (k) { return k.t <= back + 1e-6; }); });
        shot.duration = back;
      }
      delete shot.actDur; delete shot.preDur;
    }
    merge(shot, P.G, shot.duration);
    var out = { times: P.times, end: P.end, start: P.start, paths: P.paths, needed: needed, over: over, allowed: allowed, note: note };
    MM.actionInfo[shot.id] = out;
    if (note && !opts.silent) App.msg(note, 4200);
    if (live) { MM.resetToBase(); }
    if (over && !opts.silent) App.msg('These commands run ' + Math.round(needed) + ' sec. A movie can be 60 sec, so the end is cut off.', 5200);
    MM.touch(); MM.emit('autocam');
    return out;
  };
  /* what the lists mean right now (times of every command, where each character ends up, the path lines), without changing any keys */
  MM.actionPlan = function (shot) {
    shot = shot || MM.cur();
    var live = MM.cur() === shot && !!MM.base, base = live ? MM.base : MM.baseFromScene(App.clean(shot.scene));
    var P = plan(shot, base);
    return { times: P.times, end: P.end, start: P.start, paths: P.paths, needed: P.needed };
  };
  MM.actionNeeded = function (shot) { var i = shot && MM.actionInfo[shot.id]; return i ? i.needed : 0; };

  /* list edits used by the screen. Each one makes the keys again. */
  MM.getList = function (shot, id) { return (shot.actions && shot.actions[id]) || []; };
  MM.setList = function (shot, id, list) {
    shot.actions = shot.actions || {};
    if (list && list.length) shot.actions[id] = list; else delete shot.actions[id];
    if (!Object.keys(shot.actions).length) delete shot.actions;
  };

  /* ---------- recipes ---------- */
  var BUILTIN = [
    { id: 'b-walk-hi', name: 'Walk in and say hi', builtin: true, actions: [{ type: 'walk', path: [[0.55, 0.25], [1.1, 0.05], [1.6, 0.2]], speed: 1.2, follow: false, rel: true }, { type: 'wave' }, { type: 'say', text: 'Hi!', style: 'speech' }] },
    { id: 'b-reveal', name: 'Big reveal', builtin: true, actions: [{ type: 'pose', preset: 'peek' }, { type: 'emote', id: 'exclaim' }, { type: 'hop' }, { type: 'pose', preset: 'proud' }] },
    { id: 'b-heckle', name: 'Wacker heckle', builtin: true, actions: [{ type: 'look', target: '@other' }, { type: 'say', text: 'Pfft.', style: 'speech' }, { type: 'pose', preset: 'proud' }] }
  ];
  MM.recipeList = function () {
    return DP.Store.all('recipes').then(function (list) {
      list = (list || []).filter(function (r) { return r && r.name && Array.isArray(r.actions); }).sort(function (a, b) { return b.time - a.time; });
      return BUILTIN.concat(list);
    });
  };
  /* a recipe becomes ordinary actions for character `id`. Paths are shifted to where that character will stand. */
  MM.recipeActions = function (shot, id, recipe) {
    var info = MM.actionPlan(shot), bi = MM.base && MM.cur() === shot ? MM.base.items[id] : null;
    var at = info && info.end[id] ? [info.end[id].x, info.end[id].z] : bi ? [bi.x, bi.z] : [0, 0];
    var other = (MM.cur() === shot && MM.base ? Object.keys(MM.base.items) : []).filter(function (k) { return k !== id && DP.PUPPETS[MM.base.items[k].kind]; })[0];
    var out = [];
    recipe.actions.forEach(function (a0) {
      var a = cleanAction(a0, true); if (!a) return;
      if (a.type === 'walk') {
        if (a.rel) a.path = a.path.map(function (p) { return [r3(p[0] + at[0]), r3(p[1] + at[1])]; });
        delete a.rel;
        at = a.path[a.path.length - 1];
      } else if (a.type === 'look' && a.target === '@other') a.target = other || 'right';
      out.push(a);
    });
    return out;
  };
  MM.saveRecipe = function (shot, id, name) {
    var list = MM.getList(shot, id), info = MM.actionPlan(shot), st = info && info.start[id];
    if (!list.length || !st) return Promise.resolve(null);
    var acts = [];
    list.forEach(function (a0) {
      var a = clone(a0);
      if (a.type === 'walk') { a.path = a.path.map(function (p) { return [r3(p[0] - st.x), r3(p[1] - st.z)]; }); a.rel = true; }
      else if (a.type === 'look' && a.target !== 'left' && a.target !== 'right' && a.target !== 'camera') a.target = '@other';
      acts.push(a);
    });
    var rec = { id: MM.nid('r'), name: String(name || 'My recipe').slice(0, 40), time: Date.now(), actions: acts };
    return DP.Store.put('recipes', rec).then(function () { return rec; });
  };
  MM.deleteRecipe = function (id) { return DP.Store.del('recipes', id); };

  /* ---------- path tools ---------- */
  /* Ramer-Douglas-Peucker */
  MM.simplifyPath = function (pts, eps) {
    if (pts.length < 3) return pts.slice();
    function rdp(a, b, out) {
      var maxD = 0, idx = -1, A = pts[a], B = pts[b], dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz);
      for (var i = a + 1; i < b; i++) {
        var d = L < 1e-9 ? dist2(pts[i], A) : Math.abs(dz * pts[i][0] - dx * pts[i][1] + B[0] * A[1] - B[1] * A[0]) / L;
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (maxD > eps && idx > 0) { rdp(a, idx, out); out.push(pts[idx]); rdp(idx, b, out); }
    }
    var mid = [];
    rdp(0, pts.length - 1, mid);
    return [pts[0]].concat(mid, [pts[pts.length - 1]]);
  };
  MM.lastPath = null;     // the newest path drawn, relative to where its character stood (the script word "walk" uses it)

  /* ---------- the typed script ---------- */
  var NAMES = { dibs: 'dibs', wacker: 'wacker', chance: 'chance', hiram: 'hiram', ivy: 'ivy', monty: 'monty', sue: 'sue', pigeon: 'pigeon' };
  var POSE_WORDS = ['stand', 'shrug', 'proud', 'peek', 'point'];
  var EMOTE_WORDS = { heart: 'heart', hearts: 'hearts', love: 'heart', exclaim: 'exclaim', exclamation: 'exclaim', surprise: 'exclaim', question: 'question', confused: 'question', music: 'note', note: 'note', sweat: 'sweat', nervous: 'sweat', zzz: 'zzz', sleepy: 'zzz', sleep: 'zzz', steam: 'steam', angry: 'steam', idea: 'idea', laugh: 'laugh', laughing: 'laugh', tears: 'tears', cry: 'tears', crying: 'tears', shiver: 'shiver', shivering: 'shiver', cold: 'shiver' };
  var COSTUME_WORDS = { 'blue cap': 'cap-blue', 'cap blue': 'cap-blue', 'black cap': 'cap-black', 'cap black': 'cap-black', cap: 'cap-blue', horns: 'horns', scarf: 'scarf', stick: 'stick', football: 'football', ball: 'football' };
  var VOCAB = POSE_WORDS.concat(Object.keys(EMOTE_WORDS), ['wave', 'hop', 'walk', 'wait', 'enter', 'exit']);
  function lev(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 1; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function fuzzy(word, list) {
    if (word.length < 4) return null;
    var best = null, bd = word.length >= 8 ? 2 : 1;
    list.forEach(function (w) { var d = lev(word, w); if (d <= bd && (best === null || d < lev(word, best))) best = w; });
    return best;
  }
  function charKind(name) {
    var n = String(name || '').toLowerCase().replace(/[^a-z ]/g, '').trim();
    if (NAMES[n]) return NAMES[n];
    var f = fuzzy(n, Object.keys(NAMES));
    return f ? NAMES[f] : null;
  }
  function stripEnd(s) { return s.replace(/[.!?]+$/, '').trim(); }

  /* one comma separated word becomes an action, or null when it is not a command */
  function parseWord(tok, notes, fuzzyOk) {
    var w = stripEnd(tok.toLowerCase().replace(/\s+/g, ' ')), m, fixed;
    if (!w) return null;
    if ((m = /^wait(?:\s+(\d+(?:\.\d+)?))?(?:\s*(?:s|sec|secs|second|seconds))?$/.exec(w))) return { type: 'wait', sec: m[1] ? clamp(parseFloat(m[1]), 0.1, 30) : 1 };
    if ((m = /^walk(?:\s+(slow|slowly|fast|quickly|normal))?(?:\s+(follow|and follow|followed))?$/.exec(w))) {
      var sp = m[1] ? (/^s/.test(m[1]) ? MM.SPEEDS.slow : /^(f|q)/.test(m[1]) ? MM.SPEEDS.fast : MM.SPEEDS.normal) : MM.SPEEDS.normal;
      return { type: 'walk', speed: sp, follow: !!m[2], path: null };
    }
    if ((m = /^(?:wear|put on|wears)\s+(.+)$/.exec(w))) {
      if (m[1] === 'nothing' || m[1] === 'none') return { type: 'wear', costume: 'none' };
      var cs = COSTUME_WORDS[m[1]] || COSTUME_WORDS[Object.keys(COSTUME_WORDS).filter(function (k) { return m[1].indexOf(k) >= 0; })[0]];
      return cs ? { type: 'wear', costume: cs } : null;
    }
    if (w === 'lookl') return { type: 'look', target: 'left' };
    if (w === 'lookr') return { type: 'look', target: 'right' };
    if ((m = /^look(?:\s+at)?\s*(left|right|camera|us|up|(.+))?$/.exec(w))) {
      var t = m[1] || 'camera';
      if (t === 'left' || t === 'right' || t === 'camera') return { type: 'look', target: t };
      if (t === 'us') return { type: 'look', target: 'camera' };
      var k = charKind(m[2] || t);
      return k ? { type: 'look', target: '@' + k } : null;
    }
    if (w === 'wave' || w === 'waves') return { type: 'wave' };
    if (w === 'hop' || w === 'hops' || w === 'jump') return { type: 'hop' };
    if (w === 'enter' || w === 'appear') return { type: 'enter' };
    if (w === 'exit' || w === 'leave') return { type: 'exit' };
    if (POSE_WORDS.indexOf(w) >= 0) return { type: 'pose', preset: w };
    if (w === 'two hearts') return { type: 'emote', id: 'hearts' };
    if (w === 'music note') return { type: 'emote', id: 'note' };
    if (EMOTE_WORDS[w]) return { type: 'emote', id: EMOTE_WORDS[w] };
    if (fuzzyOk && w.indexOf(' ') < 0 && (fixed = fuzzy(w, VOCAB))) {
      if (notes) notes.push('I read "' + tok.trim() + '" as "' + fixed + '".');
      return parseWord(fixed);
    }
    return null;
  }
  MM.parseWord = parseWord;

  function matchSet(text) {
    var q = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean), best = null, bs = 0;
    Object.keys(DP.SET_INFO).forEach(function (id) {
      if (id === 'photo') return;
      var words = (DP.SET_INFO[id].name + ' ' + id).toLowerCase().split(/\s+/), s = 0;
      q.forEach(function (w) {
        if (words.some(function (x) { return x === w || (w.length >= 3 && x.indexOf(w) === 0); })) s += w.length > 1 ? 2 : 1;
      });
      if (s > bs) { bs = s; best = id; }
    });
    return best;
  }
  MM.matchSet = matchSet;

  /* text -> { shots: [{ isNew, setId, name, lines: [{ who, actions, line }] }], notes: [{ line, text }] } */
  MM.parseScript = function (text) {
    var notes = [], specs = [{ isNew: false, setId: null, name: '', lines: [] }];
    String(text || '').split(/\r?\n/).forEach(function (raw, i) {
      var ln = i + 1, line = raw.trim(), m;
      if (!line || /^(#|\/\/)/.test(line)) return;
      if ((m = /^-{2,}\s*(.*)$/.exec(line)) || (m = /^scene\s*[:\-]\s*(.*)$/i.exec(line))) {
        var sid = m[1].trim() ? matchSet(m[1]) : null, nm = m[1].trim().slice(0, 40);
        if (m[1].trim() && !sid) notes.push({ line: ln, text: 'Line ' + ln + ': I did not find a place called "' + nm + '", so this shot keeps the current place.' });
        var first = specs[0];
        if (specs.length === 1 && !first.lines.length && !first.isNew) specs[0] = { isNew: true, setId: sid, name: nm, lines: [] };
        else specs.push({ isNew: true, setId: sid, name: nm, lines: [] });
        return;
      }
      m = /^([A-Za-z][A-Za-z ]{0,20}?)\s*(?:\(([^)]*)\))?\s*[:：]\s*(.*)$/.exec(line);
      if (!m) { notes.push({ line: ln, text: 'Line ' + ln + ': I need a name and a colon, like Dibs: Hello.' }); return; }
      var kind = charKind(m[1]);
      if (!kind) { notes.push({ line: ln, text: 'Line ' + ln + ': I do not know "' + m[1].trim() + '". Try Dibs, Wacker, Chance, Hiram, Ivy, Monty, Sue or Pigeon.' }); return; }
      var acts = [], lineNotes = [];
      if (m[2]) {
        m[2].split(/[,;]+/).forEach(function (tk) {
          if (!tk.trim()) return;
          var a = parseWord(tk, lineNotes, true);
          if (a) acts.push(a); else lineNotes.push('I did not know "' + tk.trim() + '", so I skipped it.');
        });
      }
      var rest = m[3].trim();
      if (rest) {
        var toks = rest.split(/[,;]+/).map(function (x) { return x.trim(); }).filter(Boolean), exact = 0, cmds = [], local = [], unknown = null;
        toks.forEach(function (tk) { if (parseWord(tk, [], false)) exact++; });
        // a typo is forgiven only next to words that are surely commands
        toks.forEach(function (tk) { var a = parseWord(tk, local, exact > 0); if (a) cmds.push(a); else if (!unknown) unknown = tk; });
        if (cmds.length && !unknown) { acts = acts.concat(cmds); local.forEach(function (x) { lineNotes.push(x); }); }
        else {
          acts.push({ type: 'say', text: rest.slice(0, 160), style: 'speech' });
          if (cmds.length && !/[.!?]/.test(rest)) lineNotes.push('"' + unknown + '" is not a command, so ' + m[1].trim() + ' says all of it out loud.');
        }
      }
      lineNotes.forEach(function (x) { notes.push({ line: ln, text: 'Line ' + ln + ': ' + x }); });
      if (!acts.length) { notes.push({ line: ln, text: 'Line ' + ln + ': nothing to do for ' + m[1].trim() + '.' }); return; }
      specs[specs.length - 1].lines.push({ who: kind, actions: acts, line: ln });
    });
    specs = specs.filter(function (s) { return s.lines.length || s.isNew; });
    var cnt = 0; specs.forEach(function (s) { cnt += s.lines.length; });
    return { shots: specs.filter(function (s) { return s.lines.length; }), notes: notes, lines: cnt };
  };

  /* how many commands the current shot has now (the screen asks before a script replaces them) */
  MM.hasActions = function (shot) { return !!(shot && shot.actions && Object.keys(shot.actions).length); };

  function uniqueId(scene, want) {
    var id = want, n = 2, ids = scene.items.map(function (i) { return i.id; });
    while (ids.indexOf(id) >= 0) id = want + '-' + (n++);
    return id;
  }
  function makeItem(scene, kind, x, z) {
    var it = { id: uniqueId(scene, 'i-' + kind), kind: kind, x: x, y: 0, z: z, yaw: x < -0.1 ? 10 : x > 0.1 ? -10 : 0, tilt: 0, scale: 1, flip: false, mount: 'none', move: 'none', emote: null, attach: [] };
    if (DP.isPuppet(kind)) it.pose = DP.defaultPose();
    var kd = DP.kindDefaults(kind); for (var k in kd) it[k] = kd[k];
    return it;
  }
  /* characters named in the script but missing from the shot are added, facing the camera and spaced apart */
  function ensureCast(scene, kinds) {
    var have = {}, add = [];
    scene.items.forEach(function (it) { if (DP.isPuppet(it.kind) && !have[it.kind]) have[it.kind] = it; });
    kinds.forEach(function (k) { if (!have[k] && add.indexOf(k) < 0) add.push(k); });
    var existing = scene.items.filter(function (it) { return DP.isPuppet(it.kind); });
    add.forEach(function (k, i) {
      var x;
      if (!existing.length) x = Math.round((i - (add.length - 1) / 2) * 1.6 * 20) / 20;
      else {
        var cand = [0, -1.3, 1.3, -2.6, 2.6, -3.9, 3.9, -5.2, 5.2];
        x = cand.filter(function (c) { return existing.every(function (e) { return Math.abs(e.x - c) >= 1.1; }); })[0];
        if (x === undefined) x = existing.length * 1.2;
      }
      var it = makeItem(scene, k, x, 0.2);
      scene.items.push(it); existing.push(it);
    });
  }
  function kindId(scene, kind) { var it = scene.items.filter(function (i) { return i.kind === kind; })[0]; return it ? it.id : null; }

  /* Build: replaces the commands of the shots the script covers. Returns a promise of { ok, text, notes }. */
  MM.buildScript = function (text) {
    var parsed = MM.parseScript(text), notes = parsed.notes.slice();
    if (!parsed.shots.length) return Promise.resolve({ ok: false, text: 'There is nothing to build yet. Type a line like Dibs: Hello!', notes: notes });
    MM.pause(); MM.pushUndo();
    var m = MM.movie, curIdx = MM.shotIdx, insertAt = curIdx, touchedCur = false, firstIdx = -1, made = [], lineCount = 0, newCount = 0;
    parsed.shots.forEach(function (spec) {
      var shot;
      if (!spec.isNew) { shot = m.shots[curIdx]; touchedCur = true; }
      else {
        var left = MAX_DUR - MM.total();
        if (m.shots.length >= MM.MAX_SHOTS || left < 0.5) { notes.push({ line: spec.lines[0].line, text: 'There is no room for another shot, so "' + (spec.name || 'this scene') + '" was skipped. A movie can be 60 sec.' }); return; }
        var sc = App.starterScene();
        sc.items = []; sc.name = spec.name || 'Scene'; sc.frame.platform = m.platform;
        sc.lens.focus = { mode: 'dist', id: '', dist: 5.4, point: [0, 1, 0] };
        var curScene = m.shots[curIdx].scene;
        sc.set = { id: spec.setId || (curScene.set && curScene.set.id) || 'sweep', color: (curScene.set && curScene.set.color) || '#fbf6ea' };
        shot = MM.newShot(sc, spec.name || 'Shot ' + (m.shots.length + 1), Math.min(4, left));
        shot.autoCamera = true;
        insertAt++; m.shots.splice(insertAt, 0, shot); newCount++;
      }
      if (spec.isNew && spec.setId == null && !spec.name) { /* keeps the current place */ }
      if (!spec.isNew && spec.setId) { /* not reachable: the first shot keeps its own place */ }
      var kinds = []; spec.lines.forEach(function (l) { if (kinds.indexOf(l.who) < 0) kinds.push(l.who); });
      ensureCast(shot.scene, kinds);
      // sequence the lines: one character at a time, the others wait their turn
      var cursor = 0, endT = {}, pos = {}, lists = {};
      kinds.forEach(function (k) { var id = kindId(shot.scene, k), it = shot.scene.items.filter(function (i) { return i.id === id; })[0]; lists[id] = []; endT[id] = 0; pos[id] = [it.x, it.z]; });
      spec.lines.forEach(function (l) {
        var id = kindId(shot.scene, l.who), list = lists[id], gap = Math.round((cursor - endT[id]) * 10) / 10;
        if (gap >= 0.1) { list.push({ type: 'wait', sec: Math.min(30, gap) }); endT[id] += Math.min(30, gap); }
        l.actions.forEach(function (a0) {
          var a = clone(a0);
          if (a.type === 'walk') {
            var from = pos[id], rel = MM.lastPath;
            if (!rel) { var sgn = from[0] > 0.8 ? -1 : 1; rel = [[0.5 * sgn, 0.15], [1.0 * sgn, 0], [1.5 * sgn, 0.12]]; }
            a.path = rel.map(function (p) { return [r3(from[0] + p[0]), r3(from[1] + p[1])]; });
          } else if (a.type === 'look' && typeof a.target === 'string' && a.target.charAt(0) === '@') {
            var tid = kindId(shot.scene, a.target.slice(1)); a.target = tid && tid !== id ? tid : 'camera';
          }
          var c = cleanAction(a); if (!c) return;
          list.push(c);
          var d = MM.actionDur(c, pos[id]);
          if (c.type === 'walk') pos[id] = c.path[c.path.length - 1];
          endT[id] += d;
        });
        cursor = endT[id];
        lineCount++;
      });
      shot.actions = {};
      Object.keys(lists).forEach(function (id) { if (lists[id].length) shot.actions[id] = lists[id]; });
      delete shot.thumb; delete shot.actDur;
      var idx = m.shots.indexOf(shot);
      if (firstIdx < 0) firstIdx = idx;
      made.push(shot);
    });
    if (!made.length) return Promise.resolve({ ok: false, text: 'Nothing was built.', notes: notes });
    // new shots compile from their scene, the open shot reloads first because characters may have been added
    made.forEach(function (sh) { if (sh !== m.shots[curIdx] || !touchedCur) MM.compileActions(sh, { silent: true }); });
    var go = touchedCur ? MM.loadShot(curIdx, 0).then(function () { MM.compileActions(MM.cur(), { silent: true }); }) : MM.loadShot(firstIdx, 0);
    return go.then(function () {
      MM.touch(); MM.emit('shots'); MM.emit('tracks');
      return MM.warmUp();
    }).then(function () {
      var sh = MM.cur(), info = MM.actionInfo[sh.id];
      MM.seek(0);
      var over = made.some(function (s) { var i = MM.actionInfo[s.id]; return i && i.over; });
      if (over) notes.push({ line: 0, text: 'The script runs longer than the 60 sec a movie can hold, so the end of a shot was cut off.' });
      var txt = 'Built ' + lineCount + (lineCount === 1 ? ' line' : ' lines') + (newCount ? ' and ' + newCount + (newCount === 1 ? ' new shot' : ' new shots') : '') + '. Tap Play to watch. Undo takes it back.';
      return { ok: true, text: txt, notes: notes };
    });
  };
})();
