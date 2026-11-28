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
  var DANCE = ['bounce', 'sway', 'step', 'spin'];   // beat timed dance moves: { sec, beat?, dir? (step) }
  var TYPES = ['walk', 'wave', 'say', 'emote', 'pose', 'hop', 'look', 'wait', 'wear', 'enter', 'exit'].concat(DANCE);
  var DEF_BPM = 120;
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
      if (a.edge === true) o.edge = true;       // walks on or off the screen edge: the automatic camera does not frame them
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
    } else if (DANCE.indexOf(a.type) >= 0) {
      o.sec = isNum(a.sec) ? r3(clamp(a.sec, 0.3, 30)) : (a.type === 'bounce' || a.type === 'sway' ? 2 : 1);
      if (isNum(a.beat)) o.beat = r3(clamp(a.beat, 0.2, 2));
      if (a.type === 'step') o.dir = a.dir === 'right' ? 'right' : 'left';
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

  /* camera and caption cues made by Camera: and Caption: lines of a script. They live on the shot (shot.camCues, shot.capCues). */
  var CUE_TYPES = ['wide', 'close', 'push', 'pull', 'orbit', 'auto'];
  MM.cleanCues = function (raw) {
    var out = { camCues: [], capCues: [] };
    if (!raw || typeof raw !== 'object') return out;
    (Array.isArray(raw.camCues) ? raw.camCues : []).slice(0, 80).forEach(function (c) {
      if (!c || typeof c !== 'object' || CUE_TYPES.indexOf(c.type) < 0 || !isNum(c.t)) return;
      var o = { t: r3(clamp(c.t, 0, 60)), type: c.type };
      if (c.type === 'close') { if (typeof c.id === 'string' && /^[\w-]{1,40}$/.test(c.id)) o.id = c.id; else return; }
      out.camCues.push(o);
    });
    out.camCues.sort(function (a, b) { return a.t - b.t; }); out.camCues = out.camCues.slice(0, 40);
    (Array.isArray(raw.capCues) ? raw.capCues : []).slice(0, 80).forEach(function (c) {
      if (!c || typeof c !== 'object' || !isNum(c.t)) return;
      out.capCues.push({ t: r3(clamp(c.t, 0, 60)), text: typeof c.text === 'string' ? c.text.replace(/\s+/g, ' ').trim().slice(0, 120) : '' });
    });
    out.capCues.sort(function (a, b) { return a.t - b.t; }); out.capCues = out.capCues.slice(0, 40);
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
    if (DANCE.indexOf(a.type) >= 0) return a.sec || 1;
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
    var lists = shot.actions || {}, G = {}, info = { times: {}, end: {}, start: {}, paths: {}, says: [], follows: [], needed: 0, ids: [], xs: {}, entr: {} };
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
      var t = LEAD, times = [], seenAct = false, afterEnter = false;
      info.start[id] = { x: bi.x, z: bi.z }; info.xs[id] = [];
      function P(p, t0, t1, v, ease) { seg(trk(T + 'pose.' + p, bi.pose && isNum(bi.pose[p]) ? bi.pose[p] : 0), t0, t1, v, ease); }
      function setP(p, t0, t1, v, ease) { P(p, t0, t1, v, ease); st.pose[p] = v; }
      function yawTo(t0, t1, y) { seg(trk(T + 'rot', bi.yaw || 0), t0, t1, y, 'easeInOut'); st.yaw = y; }

      /* beat timed dance moves. A move is cut into whole beats (a.beat sec each, 0.5 when not set) that fill its time exactly. */
      function dance(a, t0, sec) {
        var beat = isNum(a.beat) ? clamp(a.beat, 0.2, 2) : 0.5, n = Math.max(1, Math.round(sec / beat)), bl = sec / n, half = bl / 2, te = t0 + sec, p = st.pose, k, ts, last, up;
        if (a.type === 'bounce') {
          // up with a small hop in the first half of the beat, knees bend in the second half, so the low point lands on the beat
          for (k = 0; k < n; k++) {
            ts = t0 + k * bl; last = k === n - 1;
            P('hop', ts, ts + half, p.hop + 0.12); P('bend', ts, ts + half, p.bend);
            P('hop', ts + half, ts + bl, p.hop); P('bend', ts + half, ts + bl, last ? p.bend : p.bend + 12);
            P('lean', ts, ts + bl, last ? p.lean : p.lean + (k % 2 ? -5 : 5));
          }
        } else if (a.type === 'sway') {
          // wing wave: the wings swing up and down in turn on every beat, the head tilts with them
          for (k = 0; k < n; k++) {
            ts = t0 + k * bl; last = k === n - 1; up = k % 2 === 0;
            if (wings >= 1) P('wingA', ts, ts + bl, last ? p.wingA : up ? 140 : 25);
            if (wings >= 2) P('wingB', ts, ts + bl, last ? p.wingB : up ? 25 : 140);
            P('head', ts, ts + bl, last ? p.head : (up ? 1 : -1) * (wings ? 10 : 16));
          }
        } else if (a.type === 'step') {
          // a side step out on one beat and back on the next. It keeps facing the camera and ends where it started.
          var d = a.dir === 'right' ? 1 : -1, pa = trk(T + 'pos', [bi.x, bi.z]), home = [st.x, st.z], out = [st.x + d * 0.35, st.z];
          if (n === 1) { seg(pa, t0, t0 + half, out); seg(pa, t0 + half, te, home); P('lean', t0, t0 + half, p.lean + d * 8); P('lean', t0 + half, te, p.lean); }
          else for (k = 0; k < n; k++) {
            ts = t0 + k * bl; last = k === n - 1;
            var go = k % 2 === 0 && !(last && n % 2 === 1);
            seg(pa, ts, ts + bl, go ? out : home);
            P('lean', ts, ts + bl, last ? p.lean : go ? p.lean + d * 8 : p.lean - d * 3);
            if (go || k % 2) { P('hop', ts, ts + half, p.hop + 0.08); P('hop', ts + half, ts + bl, p.hop); }
          }
        } else if (a.type === 'spin') {
          // a full turn on the spot (the back of the card reads fine), a hop to start and a small squash to finish.
          // The turn is keyed as +360 and wraps back to the start angle on a pose frame boundary (multiples of 1/6 sec are on both the 12 and 30 frame grids), so no frame shows a half turn.
          var y0 = st.yaw, ra = trk(T + 'rot', bi.yaw || 0), hu = Math.min(0.22, sec * 0.35), sq = Math.min(0.1, sec * 0.2), G6 = 1 / 6, tw = Math.floor((te + 1e-6) / G6) * G6;
          if (tw < t0 + 0.2) tw = Math.ceil((t0 + 0.2) / G6 - 1e-6) * G6;
          tw = r4(tw);
          P('hop', t0, t0 + hu, p.hop + 0.5); P('hop', t0 + hu, t0 + 2 * hu, p.hop);
          if (wings >= 1) { P('wingA', t0, t0 + hu, 70); P('wingA', tw - 0.2, tw, p.wingA); }
          if (wings >= 2) { P('wingB', t0, t0 + hu, 70); P('wingB', tw - 0.2, tw, p.wingB); }
          seg(ra, t0 + 0.06, tw - 1 / FPS, y0 + 360, 'easeInOut');
          put(ra, tw, y0, 'linear');
          P('bend', te - 2 * sq, te - sq, p.bend + 12); P('bend', te - sq, te, p.bend);
        }
      }

      list.forEach(function (a) {
        var t0 = t, dur = a.type === 'walk' ? 0 : MM.actionDur(a), i, wasEnter = afterEnter;
        afterEnter = a.type === 'enter';
        if (a.type === 'wait') { afterEnter = wasEnter; }
        else if (a.type !== 'enter' && !(a.type === 'walk' && a.edge && wasEnter && !seenAct)) seenAct = true;
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
        } else if (DANCE.indexOf(a.type) >= 0) {
          dance(a, t0, dur);
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
              if (!a.edge) info.xs[id].push(p[0]);
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
            if (a.edge && wasEnter && !info.entr[id] && info.xs[id].length === 0 && !seenAct) { info.entr[id] = true; info.xs[id].push(last[0]); }
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
    /* camera and caption cues (only used when the shot has Auto camera on, and for captions when nobody wrote a caption by hand) */
    var autoOn = !!shot.autoCamera && !hasManualCamera(shot);
    var camCues = autoOn && Array.isArray(shot.camCues) ? shot.camCues.filter(function (c) { return c && isNum(c.t) && CUE_TYPES.indexOf(c.type) >= 0; }).sort(function (a, b) { return a.t - b.t; }) : [];
    var capCues = Array.isArray(shot.capCues) && !hasManualCaption(shot) ? shot.capCues.filter(function (c) { return c && isNum(c.t); }) : [];
    var cueEnd = 0;
    camCues.forEach(function (c, i) {
      var last = i === camCues.length - 1;
      cueEnd = Math.max(cueEnd, (last && (c.type === 'push' || c.type === 'pull' || c.type === 'orbit')) ? c.t + 2 : c.t + 0.8);
    });
    capCues.forEach(function (c) { if (c.text) cueEnd = Math.max(cueEnd, c.t + 2); });
    maxEnd = Math.max(maxEnd, cueEnd);
    capCues.forEach(function (c) { disc('caption', c.t, c.text ? { text: c.text } : null); });
    info.needed = info.ids.length || cueEnd ? ceilT(maxEnd + END_HOLD) : 0;

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
          var bi = base.items[id], hw = sizeOf(bi) * 0.31, xs = info.entr[id] ? [] : [bi.x];
          // walks on and off the screen edge are not framed: the wide shot stays on the people in the scene
          if ((!followed[id] || info.entr[id]) && info.xs[id]) xs = xs.concat(info.xs[id]);
          if (!xs.length) xs = [bi.x];
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
      // Camera: lines. A cue lasts until the next cue (or the end), and while one other than auto lasts the speaker moves wait.
      var cueSegs = [], orbitN = 0;
      camCues.forEach(function (c, i) {
        var t1 = i < camCues.length - 1 ? camCues[i + 1].t : Math.max(info.needed, c.t + 0.5);
        cueSegs.push({ k: 'cue', cue: c, t0: c.t, t1: t1, last: i === camCues.length - 1 });
      });
      var inCue = function (t) { return cueSegs.some(function (c) { return c.cue.type !== 'auto' && t >= c.t0 - 1e-6 && t < c.t1 - 1e-6; }); };
      if (auto) info.says.forEach(function (s) { if (!inCue(s.t0)) segs.push({ k: 'say', id: s.id, t0: s.t0, t1: s.t1 }); });
      cueSegs.forEach(function (c) {
        if (c.cue.type !== 'auto') { segs.push(c); return; }
        // handing the camera back: whoever is talking right now gets it
        var talking = info.says.filter(function (s) { return s.t0 < c.t0 - 1e-6 && s.t1 > c.t0 + 0.3; })[0];
        if (talking) segs.push({ k: 'say', id: talking.id, t0: c.t0, t1: talking.t1 });
      });
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
        } else if (sg.k === 'cue') {
          lastSp = null;
          var cu = sg.cue, dd = sg.t1 - sg.t0, cp = cur.pos.slice(), ct = cur.tgt.slice(), fr2, tb2 = Math.min(sg.t0 + 0.8, sg.t1);
          if (cu.type === 'wide') {
            move(sg.t0, tb2, { pos: est.pos.slice(), tgt: est.tgt.slice() }, est.tgt.slice(), 'easeInOut');
          } else if (cu.type === 'close') {
            var ci = base.items[cu.id]; if (!ci) return;
            var cpos = posAt(cu.id, sg.t0), cH = sizeOf(ci), ctg = [cpos[0], cH * 0.9, cpos[1]], cd = Math.max(est.dist * 0.85, 3.4);     // close, but still room for the speech bubble above the head
            fr2 = { tgt: ctg, pos: [0, 1, 2].map(function (i) { return ctg[i] + est.dir[i] * cd; }) };
            move(sg.t0, tb2, fr2, ctg, 'easeInOut');
            if (sg.t1 - tb2 > 0.3) move(tb2, sg.t1, { tgt: ctg, pos: [0, 1, 2].map(function (i) { return ctg[i] + (fr2.pos[i] - ctg[i]) * 0.955; }) }, ctg, 'easeInOut');
          } else if (cu.type === 'push') {
            move(sg.t0, sg.t1, { tgt: ct, pos: [0, 1, 2].map(function (i) { return ct[i] + (cp[i] - ct[i]) * 0.72; }) }, ct, 'easeInOut');
          } else if (cu.type === 'pull') {
            move(sg.t0, sg.t1, { tgt: ct, pos: [0, 1, 2].map(function (i) { return ct[i] + est.dir[i] * est.dist * 1.12; }) }, ct, 'easeInOut');
          } else if (cu.type === 'orbit') {
            var len = sg.last ? Math.max(2, dd) : dd, sign = (orbitN++ % 2) ? -1 : 1, vx = cp[0] - ct[0], vz = cp[2] - ct[2], no = Math.max(2, Math.ceil(len * 6)), ko;
            if (len < 0.3) return;
            hold(KP, sg.t0); hold(KT, sg.t0); KP[KP.length - 1].ease = 'linear';
            for (ko = 1; ko <= no; ko++) {
              var uo = ko / no, th = sign * 22 * D2R * (0.5 - 0.5 * Math.cos(Math.PI * uo));
              put(KP, sg.t0 + len * uo, [ct[0] + vx * Math.cos(th) + vz * Math.sin(th), cp[1], ct[2] - vx * Math.sin(th) + vz * Math.cos(th)], 'linear');
            }
            cur = { pos: KP[KP.length - 1].v.slice(), tgt: ct };
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
  function hasManualCaption(shot) {
    return shot.tracks.some(function (tr) { return tr.target === 'caption' && tr.keys.some(function (k) { return !k.gen; }); });
  }
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
  /* A character as the script names it. Plain "Pigeon" is copy 1, "Pigeon 2" is copy 2. The key is the kind for copy 1 and 'kind#n' after that,
     so every script written before copies existed reads the same as it did. */
  var MAX_COPY = 6;
  function keyOf(kind, n) { return n > 1 ? kind + '#' + n : kind; }
  function keyKind(key) { return String(key).split('#')[0]; }
  function keyN(key) { var p = String(key).split('#'); return p[1] ? Math.max(1, parseInt(p[1], 10) || 1) : 1; }
  function keyName(key) { var k = keyKind(key), n = keyN(key); return k.charAt(0).toUpperCase() + k.slice(1) + (n > 1 ? ' ' + n : ''); }
  function charRef(name) {
    var s = String(name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(), n = 1, m = /^(.*?)\s*(\d{1,2})$/.exec(s);
    if (m && m[1]) { s = m[1]; n = clamp(parseInt(m[2], 10) || 1, 1, MAX_COPY); }
    var k = charKind(s);
    return k ? keyOf(k, n) : null;
  }
  MM.charKey = charRef; MM.keyName = keyName;
  function stripEnd(s) { return s.replace(/[.!?]+$/, '').trim(); }

  /* a word group is cleaned before it is read: filler words go (then, and, over, the, a, an, just) */
  function cleanTok(tok) {
    var w = stripEnd(String(tok).toLowerCase().replace(/\s+/g, ' ')).trim();
    w = w.replace(/^(?:(?:then|and|over|the|a|an|just)\s+)+/, '');
    w = w.replace(/\s+(?:the|a|an|just|over)(?=\s|$)/g, '');
    return w;
  }
  /* split on commas, semicolons and the words "and" / "then" ("and follow" stays together) */
  function splitToks(s) {
    return String(s || '').split(/\s*[,;]+\s*|\s+(?:and|then)\s+(?!follow)/i).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function speedOf(word) { return /^s/.test(word) ? MM.SPEEDS.slow : /^(f|q)/.test(word) ? MM.SPEEDS.fast : MM.SPEEDS.normal; }
  var HOLD_WORDS = { 'hot dog': 'food', 'hot dogs': 'food', hotdog: 'food', snack: 'food', snacks: 'food', pizza: 'food', sandwich: 'food', soda: 'drink', pop: 'drink' };
  function symbolsOf() { return (window.DIBS_ASSETS && window.DIBS_ASSETS.symbols) || {}; }
  /* "hot dog" -> food, any exact symbol name works too (grocery store, grocery-store). false when not known */
  function holdKey(t) {
    var syms = symbolsOf(), dash = t.replace(/\s+/g, '-');
    if (syms[t]) return t;
    if (syms[dash]) return dash;
    if (HOLD_WORDS[t] && syms[HOLD_WORDS[t]]) return HOLD_WORDS[t];
    return false;
  }
  var SIDE = /^(left|right)$/;

  /* one word group becomes an action, or null when it is not a command */
  function parseWord(tok, notes, fuzzyOk) {
    var w = cleanTok(tok), m, adv = null;
    if (!w) return null;
    if ((m = /^(slowly|quickly)\s+(.+)$/.exec(w))) { adv = m[1]; w = m[2]; }
    var a = parseCore(w, tok, notes, fuzzyOk);
    if (a && adv && (a.type === 'walk' || a.type === 'enter' || a.type === 'exit')) a.speed = adv === 'slowly' ? MM.SPEEDS.slow : MM.SPEEDS.fast;
    return a;
  }
  function parseCore(w, tok, notes, fuzzyOk) {
    var m, fixed, e;
    if ((m = /^waits?(?:\s+(\d+(?:\.\d+)?))?(?:\s*(?:s|sec|secs|second|seconds))?$/.exec(w))) return { type: 'wait', sec: m[1] ? clamp(parseFloat(m[1]), 0.1, 30) : 1 };
    if ((m = /^(exit|exits|leave|leaves|(?:go|goes|walk|walks|run|runs) (?:off|out))(?:\s+stage)?(?:\s+(?:to|via|on))?(?:\s+(left|right))?$/.exec(w))) {
      e = { type: 'exit', side: m[2] || null };
      if (/^run/.test(m[1])) e.speed = MM.SPEEDS.fast;
      return e;
    }
    if ((m = /^(?:enter|enters|appear|appears|come in|comes in|walk in|walks in|(run in|runs in))(?:\s+from)?(?:\s+(left|right))?$/.exec(w))) {
      e = { type: 'enter', side: m[2] || null };
      if (m[1]) e.speed = MM.SPEEDS.fast;
      return e;
    }
    if ((m = /^(walk|walks|go|goes|move|moves|head|heads|run|runs)(?:\s+(.*))?$/.exec(w))) {
      var rest = m[2] || '', sp = /^run/.test(m[1]) ? MM.SPEEDS.fast : MM.SPEEDS.normal, fol = false, dest = null;
      rest = rest.replace(/\b(slowly|slow|fast|quickly|normal)\b/g, function (x) { sp = speedOf(x); return ' '; });
      rest = rest.replace(/\b(?:and )?follow(?:ed|s)?\b/g, function () { fol = true; return ' '; });
      rest = rest.replace(/\s+/g, ' ').trim().replace(/^(?:up to|next to|toward|towards|to|beside|by)\s+/, '');
      if (rest) {
        if (SIDE.test(rest)) dest = { k: 'side', side: rest };
        else if (rest === 'middle' || rest === 'center' || rest === 'centre') dest = { k: 'mid' };
        else if (rest === 'front' || rest === 'forward' || rest === 'forwards' || rest === 'camera') dest = { k: 'front' };
        else if (rest === 'back' || rest === 'backward' || rest === 'backwards') dest = { k: 'back' };
        else { var who = charRef(rest); if (!who) return null; dest = { k: 'to', who: who }; }
      }
      return { type: 'walk', speed: sp, follow: fol, path: null, dest: dest };
    }
    if ((m = /^(?:wear|wears|put on|puts on)\s+(.+)$/.exec(w))) {
      if (m[1] === 'nothing' || m[1] === 'none') return { type: 'wear', costume: 'none' };
      var cs = COSTUME_WORDS[m[1]] || COSTUME_WORDS[Object.keys(COSTUME_WORDS).filter(function (k) { return m[1].indexOf(k) >= 0; })[0]];
      return cs ? { type: 'wear', costume: cs } : null;
    }
    if ((m = /^(?:hold|holds|holding|carry|carries|carrying)\s+(.+)$/.exec(w))) {
      if (m[1] === 'nothing' || m[1] === 'none') return { type: 'hold', thing: null };
      var hk = holdKey(m[1]);
      return hk ? { type: 'hold', thing: hk } : null;
    }
    if (w === 'lookl') return { type: 'look', target: 'left' };
    if (w === 'lookr') return { type: 'look', target: 'right' };
    if ((m = /^(look|looks|turn|turns|face|faces)(?:\s+(.*))?$/.exec(w))) {
      var t = (m[2] || '').replace(/^(?:at|to|toward|towards)\b\s*/, '') || 'camera';
      if (t === 'left' || t === 'right' || t === 'camera') return { type: 'look', target: t };
      if (t === 'us') return { type: 'look', target: 'camera' };
      var k = charRef(t);
      return k ? { type: 'look', target: '@' + k } : null;
    }
    var NUM = '(\\d+(?:\\.\\d+)?)', BT = '(?:\\s+beats?)?$';
    if ((m = new RegExp('^(?:dance|dances|bounce|bounces|bouncing)(?:\\s+' + NUM + ')?' + BT).exec(w))) return { type: 'bounce', beats: m[1] ? parseFloat(m[1]) : 4 };
    if ((m = new RegExp('^(?:sway|sways|swaying)(?:\\s+' + NUM + ')?' + BT).exec(w))) return { type: 'sway', beats: m[1] ? parseFloat(m[1]) : 4 };
    if ((m = new RegExp('^(?:side step|side steps|step|steps)(?:\\s+(?:to\\s+)?(left|right))?(?:\\s+' + NUM + ')?' + BT).exec(w))) return { type: 'step', dir: m[1] || 'left', beats: m[2] ? parseFloat(m[2]) : 2 };
    if ((m = new RegExp('^(?:spin|spins|twirl|twirls)(?:\\s+around)?(?:\\s+' + NUM + ')?' + BT).exec(w))) return { type: 'spin', beats: m[1] ? parseFloat(m[1]) : 2 };
    if (w === 'wave' || w === 'waves') return { type: 'wave' };
    if (w === 'hop' || w === 'hops' || w === 'jump' || w === 'jumps') return { type: 'hop' };
    if (w === 'peeks') w = 'peek';
    if (/^(?:stand|shrug|point)s$/.test(w)) w = w.slice(0, -1);
    if (POSE_WORDS.indexOf(w) >= 0) return { type: 'pose', preset: w };
    if (w === 'two hearts') return { type: 'emote', id: 'hearts' };
    if (w === 'music note') return { type: 'emote', id: 'note' };
    if (EMOTE_WORDS[w]) return { type: 'emote', id: EMOTE_WORDS[w] };
    if (/s$/.test(w) && EMOTE_WORDS[w.slice(0, -1)] && w !== 'hearts') return { type: 'emote', id: EMOTE_WORDS[w.slice(0, -1)] };
    if (fuzzyOk && w.indexOf(' ') < 0 && (fixed = fuzzy(w, VOCAB))) {
      if (notes) notes.push('I read "' + String(tok).trim() + '" as "' + fixed + '".');
      return parseWord(fixed);
    }
    return null;
  }
  MM.parseWord = parseWord;

  /* a walk word right before "enter left" or "exit right" is the same move at that speed ("run, exit right") */
  function mergeRuns(acts) {
    var out = [];
    acts.forEach(function (a, i) {
      var nx = acts[i + 1];
      if (a.type === 'walk' && !a.dest && !a.follow && nx && (nx.type === 'enter' || nx.type === 'exit') && nx.side) { if (nx.speed === undefined) nx.speed = a.speed; return; }
      out.push(a);
    });
    return out;
  }

  /* Camera: words. null when not understood */
  function parseCamera(text, notes, ln) {
    var w = cleanTok(text), m;
    if (/^auto$/.test(w)) return { type: 'auto' };
    if (/^wide(?: shot)?$/.test(w)) return { type: 'wide' };
    if (/^(?:push|push in|zoom in|move in)$/.test(w)) return { type: 'push' };
    if (/^(?:pull|pull out|pull back|zoom out)$/.test(w)) return { type: 'pull' };
    if (/^(?:orbit|circle)$/.test(w)) return { type: 'orbit' };
    if ((m = /^close(?:\s+up)?(?:\s+on)?(?:\s+(.+))?$/.exec(w))) {
      var k = m[1] ? charRef(m[1]) : null;
      if (k) return { type: 'close', who: k };
      notes.push({ line: ln, text: 'Line ' + ln + (m[1] ? ': I do not know "' + m[1] + '" for the camera to close in on.' : ': close on who? Try Camera: close on Dibs.') });
      return null;
    }
    notes.push({ line: ln, text: 'Line ' + ln + ': I did not know the camera word "' + String(text).trim() + '". Try wide, close on Dibs, push in, pull out, orbit or auto.' });
    return null;
  }

  var LIGHT_WORDS = [['golden hour', 'golden'], ['golden', 'golden'], ['sunset', 'golden'], ['blue hour', 'blue'], ['dusk', 'blue'], ['evening', 'blue'], ['midday', 'noon'], ['noon', 'noon'], ['morning', 'morning'], ['night', 'night'], ['studio', 'studio'], ['day', 'noon']];
  /* "Hot dog stand, morning" -> { text: 'Hot dog stand', light: 'morning' } */
  function splitLight(text) {
    var light = null, t = ' ' + text + ' ';
    LIGHT_WORDS.forEach(function (lw) {
      if (light) return;
      var re = new RegExp('(?:\\s(?:at|in the|in|during|on)\\s+|[\\s,]+)' + lw[0] + '(?=[\\s,.]|$)', 'i');
      if (re.test(t)) { light = lw[1]; t = t.replace(re, ' '); }
    });
    return { text: t.replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim(), light: light };
  }

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

  /* Places: Dibs front, Chance back left, Ivy back right  ->  { dibs: { x, z }, ... }. Words: front, back, far back, middle, left, right, far left, far right.
     A character not given a side stands in the middle; front is z 0.5, back is -0.3, far back is -0.8, and nothing said keeps the depth the character has. */
  function parsePlaces(text, notes, ln) {
    var out = {}, any = false;
    String(text).split(/\s*[,;]+\s*/).forEach(function (part) {
      part = part.trim(); if (!part) return;
      var m = /^([A-Za-z]+(?:\s*\d+)?)\s*(.*)$/.exec(part), kind = m && charRef(m[1]);
      if (!kind) { notes.push({ line: ln, text: 'Line ' + ln + ': I do not know "' + part + '" in the Places line. Try Places: Dibs front, Chance back left.' }); return; }
      var ws = ' ' + m[2].toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ', far = / far /.test(ws), pt = {};
      if (/ front /.test(ws)) pt.z = 0.5; else if (/ back /.test(ws)) pt.z = far ? -0.8 : -0.3;
      if (/ left /.test(ws)) pt.x = far ? -1.9 : -0.95; else if (/ right /.test(ws)) pt.x = far ? 1.9 : 0.95; else pt.x = 0;
      out[kind] = pt; any = true;
    });
    return any ? out : null;
  }

  /* text -> { shots: [{ isNew, setId, light, name, lines }], notes: [{ line, text }] }
     a line is { who, actions, line, amp } for a character, { cam: { type, who }, line, amp } for Camera: or { cap: text, line, amp } for Caption: */
  MM.parseScript = function (text) {
    var notes = [], specs = [{ isNew: false, setId: null, light: null, name: '', lines: [] }], bpm = DEF_BPM;
    String(text || '').split(/\r?\n/).forEach(function (raw, i) {
      var ln = i + 1, line = raw.trim(), m, amp = false;
      if (!line || /^(#|\/\/)/.test(line)) return;
      if ((m = /^-{2,}\s*(.*)$/.exec(line)) || (m = /^scene\s*[:\-]\s*(.*)$/i.exec(line))) {
        var sp = splitLight(m[1].trim()), isSame = /^same(?:\s+(?:place|scene|spot))?$/i.test(sp.text), nm = isSame ? '' : sp.text.slice(0, 40);
        var sid = sp.text && !isSame ? matchSet(sp.text) : null;
        if (sp.text && !isSame && !sid) notes.push({ line: ln, text: 'Line ' + ln + ': I did not find a place called "' + nm + '", so this shot keeps the current place.' });
        var spec = { isNew: true, setId: sid, light: sp.light, name: nm, lines: [] }, first = specs[0];
        if (specs.length === 1 && !first.lines.length && !first.isNew) specs[0] = spec; else specs.push(spec);
        return;
      }
      if (/^&/.test(line)) { amp = true; line = line.replace(/^&\s*/, ''); }
      if ((m = /^(?:tempo|bpm)\s*[:：]\s*(.*)$/i.exec(line))) {
        var bm = /^(\d+(?:\.\d+)?)\s*(?:bpm|beats(?: a| per)? minute)?$/i.exec(m[1].trim());
        if (!bm) notes.push({ line: ln, text: 'Line ' + ln + ': I need a number for the tempo, like Tempo: 120.' });
        else {
          var nb = parseFloat(bm[1]);
          if (nb < 40 || nb > 220) notes.push({ line: ln, text: 'Line ' + ln + ': tempo goes from 40 to 220 beats a minute, so ' + bm[1] + ' became ' + clamp(Math.round(nb), 40, 220) + '.' });
          bpm = clamp(Math.round(nb), 40, 220);
        }
        return;
      }
      if ((m = /^places?\s*[:：]\s*(.*)$/i.exec(line))) {
        var pl = parsePlaces(m[1], notes, ln);
        if (pl) { var ps = specs[specs.length - 1]; ps.places = ps.places || {}; Object.keys(pl).forEach(function (k) { ps.places[k] = pl[k]; }); }
        return;
      }
      if ((m = /^(?:camera|cam)\s*[:：]\s*(.*)$/i.exec(line))) {
        var cm = parseCamera(m[1], notes, ln);
        if (cm) specs[specs.length - 1].lines.push({ cam: cm, line: ln, amp: amp });
        return;
      }
      if ((m = /^caption\s*[:：]\s*(.*)$/i.exec(line))) {
        var ct = m[1].replace(/\s+/g, ' ').trim();
        if (/^(off|none|clear)$/i.test(ct)) ct = '';
        specs[specs.length - 1].lines.push({ cap: ct.slice(0, 120), line: ln, amp: amp });
        return;
      }
      m = /^([A-Za-z][A-Za-z0-9 ]{0,22}?)\s*(?:\(([^)]*)\))?\s*[:：]\s*(.*)$/.exec(line);
      if (!m) { notes.push({ line: ln, text: 'Line ' + ln + ': I need a name and a colon, like Dibs: Hello.' }); return; }
      var kind = charRef(m[1]);
      if (!kind) { notes.push({ line: ln, text: 'Line ' + ln + ': I do not know "' + m[1].trim() + '". Try Dibs, Wacker, Chance, Hiram, Ivy, Monty, Sue or Pigeon.' }); return; }
      var acts = [], lineNotes = [];
      if (m[2]) {
        splitToks(m[2]).forEach(function (tk) {
          var a = parseWord(tk, lineNotes, true);
          if (a) acts.push(a); else lineNotes.push('I did not know "' + tk.trim() + '", so I skipped it.');
        });
      }
      var rest = m[3].trim();
      if (rest) {
        var toks = splitToks(rest), exact = 0, cmds = [], local = [], unknown = null;
        toks.forEach(function (tk) { if (parseWord(tk, [], false)) exact++; });
        // a typo is forgiven only next to words that are surely commands
        toks.forEach(function (tk) { var a = parseWord(tk, local, exact > 0); if (a) cmds.push(a); else if (!unknown) unknown = tk; });
        if (cmds.length && !unknown) { acts = acts.concat(cmds); local.forEach(function (x) { lineNotes.push(x); }); }
        else {
          acts.push({ type: 'say', text: rest.slice(0, 160), style: 'speech' });
          if (cmds.length && !/[.!?]/.test(rest)) lineNotes.push('"' + unknown + '" is not a command, so ' + m[1].trim() + ' says all of it out loud.');
        }
      }
      // dance words count beats: the tempo in force turns them into seconds (and each move remembers its beat length)
      acts.forEach(function (a) {
        if (a.beats === undefined) return;
        a.sec = a.beats * 60 / bpm; a.beat = 60 / bpm; delete a.beats;
      });
      acts = mergeRuns(acts);
      lineNotes.forEach(function (x) { notes.push({ line: ln, text: 'Line ' + ln + ': ' + x }); });
      if (!acts.length) { notes.push({ line: ln, text: 'Line ' + ln + ': nothing to do for ' + m[1].trim() + '.' }); return; }
      specs[specs.length - 1].lines.push({ who: kind, actions: acts, line: ln, amp: amp });
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
  function ensureCast(scene, keys) {
    var cnt = {}, add = [];
    scene.items.forEach(function (it) { if (DP.isPuppet(it.kind)) cnt[it.kind] = (cnt[it.kind] || 0) + 1; });
    // copy n of a kind is the n-th one of that kind in the shot. A copy the shot does not have yet is added (with the copies before it).
    keys.forEach(function (key) {
      var kd = keyKind(key), n = keyN(key);
      while ((cnt[kd] || 0) < n) { cnt[kd] = (cnt[kd] || 0) + 1; add.push({ kind: kd, n: cnt[kd] }); }
    });
    var existing = scene.items.filter(function (it) { return DP.isPuppet(it.kind); });
    add.forEach(function (k, i) {
      var x;
      if (!existing.length) x = Math.round((i - (add.length - 1) / 2) * 1.6 * 20) / 20;
      else {
        var cand = [0, -1.3, 1.3, -2.6, 2.6, -3.9, 3.9, -5.2, 5.2];
        x = cand.filter(function (c) { return existing.every(function (e) { return Math.abs(e.x - c) >= 1.1; }); })[0];
        if (x === undefined) x = existing.length * 1.2;
      }
      var it = makeItem(scene, k.kind, x, 0.2), def = DP.PUPPETS[k.kind];
      // copies are told apart by body color where the character has colors (copy 1 keeps the drawn one)
      if (k.n > 1 && it.pose && def && def.colors && def.colors.length > 1) it.pose.color = (k.n - 1) % def.colors.length;
      scene.items.push(it); existing.push(it);
    });
  }
  function kindId(scene, key) { var it = scene.items.filter(function (i) { return i.kind === keyKind(key); })[keyN(key) - 1]; return it ? it.id : null; }

  /* a shot with nothing in it yet: a script that starts with a Scene line fills it instead of adding a shot */
  function emptyShot(sh) {
    if (!sh || MM.hasActions(sh) || sh.tracks.some(function (tr) { return tr.keys.some(function (k) { return !k.gen; }); })) return false;
    var cast = sh.scene.items.filter(function (it) { return DP.isPuppet(it.kind); });
    if (!cast.length) return true;
    // the two characters a brand new movie starts with count as empty too, as long as nobody touched them
    var st = App.starterScene().items.filter(function (it) { return DP.isPuppet(it.kind); });
    return cast.length === st.length && cast.every(function (it, i) {
      var o = st[i];
      return o && it.kind === o.kind && it.x === o.x && it.z === o.z && it.y === o.y && it.yaw === o.yaw && it.scale === o.scale && !(it.attach && it.attach.length);
    });
  }
  var EDGE_SPEED = 1.8;    // walks on and off the screen edge are a little quicker than a normal walk

  /* Build: replaces the commands of the shots the script covers. Returns a promise of { ok, text, notes }. */
  MM.buildScript = function (text) {
    var parsed = MM.parseScript(text), notes = parsed.notes.slice();
    if (!parsed.shots.length) return Promise.resolve({ ok: false, text: 'There is nothing to build yet. Type a line like Dibs: Hello!', notes: notes });
    MM.pause(); MM.pushUndo();
    var m = MM.movie, curIdx = MM.shotIdx, insertAt = curIdx, touchedCur = false, firstIdx = -1, made = [], lineCount = 0, newCount = 0, prev = null;
    function lightOf(id) { return App.LIGHTS.filter(function (l) { return l.id === id; })[0]; }
    parsed.shots.forEach(function (spec, si) {
      var shot, curShot = m.shots[curIdx], reuse = false, kept = false;
      if (!spec.isNew) { shot = curShot; touchedCur = true; }
      else if (si === 0 && emptyShot(curShot)) {
        // the open shot is still empty: the script fills it
        shot = curShot; touchedCur = true; reuse = true;
        var cs0 = shot.scene.set || {};
        shot.scene.set = { id: spec.setId || cs0.id || 'sweep', color: cs0.color || '#fbf6ea' };
        if (spec.light && lightOf(spec.light)) shot.scene.light = App.lightFrom(lightOf(spec.light));
        if (spec.name) shot.name = spec.name;
        shot.autoCamera = true;
        shot.scene.items = shot.scene.items.filter(function (it) { return !DP.isPuppet(it.kind); });   // the untouched starter characters make room for the script's cast
      } else {
        var left = MAX_DUR - MM.total();
        if (m.shots.length >= MM.MAX_SHOTS || left < 0.5) { notes.push({ line: spec.lines[0].line, text: 'There is no room for another shot, so "' + (spec.name || 'this scene') + '" was skipped. A movie can be 60 sec.' }); return; }
        var sc = App.starterScene();
        sc.items = []; sc.name = spec.name || 'Scene'; sc.frame.platform = m.platform;
        sc.lens.focus = { mode: 'dist', id: '', dist: 5.4, point: [0, 1, 0] };
        var curScene = prev ? prev.shot.scene : curShot.scene;
        sc.set = { id: spec.setId || (curScene.set && curScene.set.id) || 'sweep', color: (curScene.set && curScene.set.color) || '#fbf6ea' };
        kept = !!(prev && prev.setId === sc.set.id);
        if (spec.light && lightOf(spec.light)) sc.light = App.lightFrom(lightOf(spec.light));
        else if (kept && prev.shot.scene.light) sc.light = clone(prev.shot.scene.light);    // the same place keeps its light
        shot = MM.newShot(sc, spec.name || 'Shot ' + (m.shots.length + 1), Math.min(4, left));
        shot.autoCamera = true;
        insertAt++; m.shots.splice(insertAt, 0, shot); newCount++;
      }
      var kinds = [], holds = {};
      spec.lines.forEach(function (l) {
        if (!l.who) return;
        if (kinds.indexOf(l.who) < 0) kinds.push(l.who);
        l.actions.forEach(function (a) { if (a.type === 'hold') holds[l.who] = a.thing; });
      });
      ensureCast(shot.scene, kinds);
      function itemOf(id) { return shot.scene.items.filter(function (i) { return i.id === id; })[0]; }
      // the same place as the shot before: characters start where they ended (unless they left the scene)
      if (kept) kinds.forEach(function (k) {
        var pe = prev.end[k], it = itemOf(kindId(shot.scene, k));
        if (!pe || prev.exited[k] || !it) return;
        it.x = pe[0]; it.z = pe[1]; it.yaw = it.x < -0.1 ? 10 : it.x > 0.1 ? -10 : 0;
      });
      // Places: line. Everyone it names who is in the shot stands there, facing the camera.
      if (spec.places) Object.keys(spec.places).forEach(function (k) {
        var it = itemOf(kindId(shot.scene, k)); if (!it) return;
        var pt = spec.places[k];
        it.x = pt.x; if (pt.z !== undefined) it.z = pt.z; it.yaw = 0;
      });
      // what a character holds is set for the whole shot (each shot sets its own)
      Object.keys(holds).forEach(function (k) {
        var it = itemOf(kindId(shot.scene, k)); if (!it) return;
        it.attach = (it.attach || []).filter(function (a) { return a.slot !== 'handR'; });
        if (holds[k]) it.attach.push({ id: App.nid('a'), kind: 'symbol:' + holds[k], slot: 'handR', s: 1, r: 0, ox: 0, oy: 0 });
      });
      // the edge of the picture: off screen, beyond the people in the shot
      var cast = shot.scene.items.filter(function (it) { return DP.isPuppet(it.kind); }), cx0 = Infinity, cx1 = -Infinity;
      cast.forEach(function (it) { cx0 = Math.min(cx0, it.x); cx1 = Math.max(cx1, it.x); });
      if (!cast.length) { cx0 = cx1 = 0; }
      var edgeOff = Math.max(4.5, (cx1 - cx0) / 2 + 4.0);
      function edgeX(side) { return r3((cx0 + cx1) / 2 + (side === 'left' ? -edgeOff : edgeOff)); }

      // sequence the lines: one character at a time, the others wait their turn. A line with & starts with the one before it.
      var cursor = 0, prevStart = 0, endT = {}, pos = {}, lists = {}, spot = {}, moved = {}, atEdge = {}, exited = {}, cues = [], caps = [], camLine = 0, capLine = 0;
      kinds.forEach(function (k) { var id = kindId(shot.scene, k), it = itemOf(id); lists[id] = []; endT[id] = 0; pos[id] = [it.x, it.z]; spot[id] = [it.x, it.z]; moved[id] = false; atEdge[id] = false; exited[k] = false; });
      function posOfKind(k) { var id = kindId(shot.scene, k); if (!id) return null; if (pos[id]) return pos[id]; var it = itemOf(id); return it ? [it.x, it.z] : null; }
      function walkTo(from, to, speed, edge) {
        var a = { type: 'walk', path: [[r3((from[0] + to[0]) / 2), r3((from[1] + to[1]) / 2 + 0.1)], [r3(to[0]), r3(to[1])]], speed: speed || MM.SPEEDS.normal, follow: false };
        if (edge) a.edge = true;
        return a;
      }
      spec.lines.forEach(function (l) {
        if (l.cam || l.cap !== undefined) {
          var tcue = r3(LEAD + (l.amp ? prevStart : cursor));
          if (l.cam) {
            var cue = { t: tcue, type: l.cam.type };
            if (l.cam.type === 'close') {
              var cid = kindId(shot.scene, l.cam.who);
              if (!cid) { notes.push({ line: l.line, text: 'Line ' + l.line + ': ' + keyName(l.cam.who) + ' is not in this shot, so the camera cannot close in.' }); lineCount++; return; }
              cue.id = cid;
            }
            if (!camLine) camLine = l.line;
            cues.push(cue);
          } else { if (!capLine) capLine = l.line; caps.push({ t: tcue, text: l.cap }); }
          lineCount++;
          return;
        }
        var id = kindId(shot.scene, l.who), list = lists[id], start = l.amp ? prevStart : cursor;
        if (l.amp && endT[id] > start + 0.05) {
          start = endT[id];
          notes.push({ line: l.line, text: 'Line ' + l.line + ': ' + keyName(l.who) + ' is busy at that moment, so this line goes right after.' });
        }
        start = Math.max(start, endT[id]);
        var gap = Math.round((start - endT[id]) * 10) / 10;
        if (gap >= 0.1) { list.push({ type: 'wait', sec: Math.min(30, gap) }); endT[id] += Math.min(30, gap); }
        prevStart = endT[id];
        function push(c) {
          list.push(c);
          var d = MM.actionDur(c, pos[id]);
          if (c.type === 'walk') pos[id] = c.path[c.path.length - 1];
          endT[id] += d;
          if (c.type !== 'enter' && c.type !== 'wait') moved[id] = true;
        }
        var entering = false;
        l.actions.forEach(function (a0, ai) {
          var a = clone(a0), c;
          if (a.type === 'hold') return;                        // set up above, for the whole shot
          if (a.type === 'enter' && a.side) {
            var ex = edgeX(a.side), sp = a.speed || EDGE_SPEED;
            var nx = l.actions[ai + 1], goesOn = !!(nx && nx.type === 'walk' && nx.dest);    // "enter left, walk to middle": straight on to there
            if (!moved[id]) {
              var it0 = itemOf(id); it0.x = ex; pos[id] = [ex, spot[id][1]];
              list.push({ type: 'enter' }); endT[id] += MM.actionDur({ type: 'enter' });
              if (goesOn) entering = true; else push(cleanAction(walkTo(pos[id], spot[id], sp, true)));
            } else {
              var wasEdge = atEdge[id];
              push({ type: 'enter' });
              if (goesOn) entering = wasEdge; else push(cleanAction(walkTo(pos[id], spot[id], sp, wasEdge)));
            }
            moved[id] = true; atEdge[id] = false; exited[l.who] = false;
            return;
          }
          if (a.type === 'enter') { push({ type: 'enter' }); exited[l.who] = false; atEdge[id] = false; moved[id] = true; return; }
          if (a.type === 'exit' && a.side) {
            var ex2 = edgeX(a.side);
            push(cleanAction(walkTo(pos[id], [ex2, pos[id][1]], a.speed || EDGE_SPEED, true)));
            push({ type: 'exit' });
            atEdge[id] = true; exited[l.who] = true;
            return;
          }
          if (a.type === 'exit') { push({ type: 'exit' }); exited[l.who] = true; return; }
          if (a.type === 'walk') {
            var from = pos[id], to = null, d = a.dest;
            if (d) {
              if (d.k === 'to') {
                var tp = posOfKind(d.who), nmx = keyName(d.who);
                if (!tp) notes.push({ line: l.line, text: 'Line ' + l.line + ': ' + nmx + ' is not in this shot, so the walk was skipped.' });
                else if (kindId(shot.scene, d.who) === id) notes.push({ line: l.line, text: 'Line ' + l.line + ': a character cannot walk to itself, so the walk was skipped.' });
                else to = [tp[0] + (from[0] >= tp[0] ? 1.1 : -1.1), tp[1]];
              } else if (d.k === 'side') to = [from[0] + (d.side === 'left' ? -1.5 : 1.5), from[1]];
              else if (d.k === 'mid') to = [0, from[1]];
              else if (d.k === 'front') to = [from[0], Math.min(1.5, from[1] + 1)];
              else if (d.k === 'back') to = [from[0], Math.max(-1.5, from[1] - 1)];
              if (!to) return;
              a.path = walkTo(from, to).path; delete a.dest;
            } else {
              var rel = MM.lastPath;
              if (!rel) { var sgn = from[0] > 0.8 ? -1 : 1; rel = [[0.5 * sgn, 0.15], [1.0 * sgn, 0], [1.5 * sgn, 0.12]]; }
              a.path = rel.map(function (p) { return [r3(from[0] + p[0]), r3(from[1] + p[1])]; });
            }
            if (entering) { a.edge = true; if (d && a.speed === MM.SPEEDS.normal) a.speed = EDGE_SPEED; entering = false; }
            c = cleanAction(a); if (!c) return;
            push(c); atEdge[id] = false;
            return;
          }
          if (a.type === 'look' && typeof a.target === 'string' && a.target.charAt(0) === '@') {
            var tid = kindId(shot.scene, a.target.slice(1)); a.target = tid && tid !== id ? tid : 'camera';
          }
          c = cleanAction(a); if (!c) return;
          push(c);
        });
        cursor = Math.max(cursor, endT[id]);
        lineCount++;
      });
      shot.actions = {};
      Object.keys(lists).forEach(function (id) { if (lists[id].length) shot.actions[id] = lists[id]; });
      // Camera: lines need Auto camera. Captions must not trample captions made by hand.
      delete shot.camCues; delete shot.capCues;
      if (cues.length) {
        if (MM.hasManualCamera(shot)) notes.push({ line: camLine, text: 'Line ' + camLine + ': Camera lines need Auto camera. This shot has camera keys you made, so they were skipped.' });
        else { shot.camCues = MM.cleanCues({ camCues: cues }).camCues; shot.autoCamera = true; }
      }
      if (caps.length) {
        if (shot.tracks.some(function (tr) { return tr.target === 'caption' && tr.keys.some(function (k) { return !k.gen; }); })) notes.push({ line: capLine, text: 'Line ' + capLine + ': This shot already has captions you made, so the Caption lines were skipped.' });
        else shot.capCues = MM.cleanCues({ capCues: caps }).capCues;
      }
      if (!shot.camCues) delete shot.camCues;
      if (!shot.capCues || !shot.capCues.length) delete shot.capCues;
      delete shot.thumb; delete shot.actDur;
      var idx = m.shots.indexOf(shot);
      if (firstIdx < 0) firstIdx = idx;
      made.push(shot);
      var endK = {};
      kinds.forEach(function (k) { var id = kindId(shot.scene, k); endK[k] = pos[id] ? [pos[id][0], pos[id][1]] : null; });
      prev = { shot: shot, setId: shot.scene.set && shot.scene.set.id, end: endK, exited: exited };
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
