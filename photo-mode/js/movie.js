/* DIBS Movie Maker: the engine.
   A movie is a list of shots. Each shot is a photo mode scene plus keyframe tracks.
   This file holds the data model, the timeline maths (a pure function of time), playback, sound,
   saving, and the frame by frame video export. The editor screen is in movie-ui.js.
   Classic script, no modules, no network. */
(function () {
  'use strict';
  var THREE = window.THREEPKG.THREE;
  var DP = window.DP, App = DP.app, A = window.DIBS_ASSETS;
  var MM = DP.movie = {};
  var D2R = Math.PI / 180;

  var FPS = 30, POSE_FPS = 12, MAX_DUR = 60, MAX_SHOTS = 30, POP = 0.14;
  var POSE_PARAMS = ['head', 'wingA', 'wingB', 'lean', 'bend', 'hop', 'look'];
  var POSE_RANGE = { head: [-60, 60], wingA: [0, 170], wingB: [0, 170], lean: [-40, 40], bend: [-40, 40], hop: [0, 1], look: [-1, 1] };
  var EASES = ['linear', 'easeInOut', 'back'];
  MM.FPS = FPS; MM.POSE_FPS = POSE_FPS; MM.MAX_DUR = MAX_DUR; MM.MAX_SHOTS = MAX_SHOTS; MM.POSE_PARAMS = POSE_PARAMS; MM.POSE_RANGE = POSE_RANGE; MM.EASES = EASES;

  MM.PLATFORMS = [
    { id: 'ig-story', name: '9:16 Reels, TikTok, Shorts', w: 1080, h: 1920, safe: true },
    { id: 'yt-thumb', name: '16:9 YouTube', w: 1920, h: 1080 },
    { id: 'x-post', name: '16:9 X', w: 1600, h: 900 },
    { id: 'ig-post', name: '4:5 Instagram', w: 1080, h: 1350 },
    { id: 'ig-square', name: '1:1 Square', w: 1080, h: 1080 }
  ];
  MM.platformInfo = function (id) { return MM.PLATFORMS.filter(function (p) { return p.id === id; })[0] || MM.PLATFORMS[0]; };

  /* ---------- small helpers ---------- */
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function snapT(t) { return r4(Math.round(t * FPS) / FPS); }
  MM.snapT = snapT; MM.clone = clone;
  MM.fmtTime = function (s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); };
  var sid = 1;
  function nid(p) { return p + Date.now().toString(36) + (sid++).toString(36); }
  MM.nid = nid;

  /* ---------- events ---------- */
  var handlers = {};
  MM.on = function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); };
  function emit(name, a, b) { (handlers[name] || []).forEach(function (fn) { try { fn(a, b); } catch (e) { console.warn('movie event', name, e); } }); }
  MM.emit = emit;

  /* ---------- easing ---------- */
  function ease(name, u) {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    if (name === 'easeInOut') return 0.5 - 0.5 * Math.cos(Math.PI * u);
    if (name === 'back') { var c1 = 1.70158, c3 = c1 + 1, v = u - 1; return 1 + c3 * v * v * v + c1 * v * v; }
    return u;
  }
  MM.ease = ease;
  /* a paper pop: scale from nothing to a little over, then settle. About 4 frames at 30 fps. */
  function pop(age) { return age >= POP ? 1 : Math.max(0.02, ease('back', age / POP)); }

  /* ---------- targets ---------- */
  /* group: camera | item | light | look | caption. mode: smooth (every frame), stepped (12 fps on twos), discrete (switches at its key) */
  function describe(target) {
    if (typeof target !== 'string') return null;
    var f, m;
    if (target.indexOf('camera.') === 0) {
      f = target.slice(7);
      if (f === 'pos' || f === 'target') return { group: 'camera', field: f, mode: 'smooth', n: 3 };
      if (['mm', 'fstop', 'focus', 'roll', 'exposure'].indexOf(f) >= 0) return { group: 'camera', field: f, mode: 'smooth', n: 1 };
      return null;
    }
    m = /^item:([\w-]+)\.(.+)$/.exec(target);
    if (m) {
      f = m[2];
      if (f === 'pos') return { group: 'item', id: m[1], field: f, mode: 'stepped', n: 2 };
      if (f === 'rot' || f === 'height') return { group: 'item', id: m[1], field: f, mode: 'stepped', n: 1 };
      if (f === 'pose.preset') return { group: 'item', id: m[1], field: f, mode: 'stepped', n: 0, preset: true };
      if (f.indexOf('pose.') === 0 && POSE_PARAMS.indexOf(f.slice(5)) >= 0) return { group: 'item', id: m[1], field: f, mode: 'stepped', n: 1, param: f.slice(5) };
      if (['emote', 'bubble', 'visible', 'wear'].indexOf(f) >= 0) return { group: 'item', id: m[1], field: f, mode: 'discrete', n: 0 };
      return null;
    }
    if (target === 'light.preset') return { group: 'light', field: 'preset', mode: 'discrete', n: 0 };
    if (target === 'light.warmth') return { group: 'light', field: 'warmth', mode: 'smooth', n: 1 };
    if (target === 'look.filter') return { group: 'look', field: 'filter', mode: 'discrete', n: 0 };
    if (target === 'caption') return { group: 'caption', field: 'caption', mode: 'discrete', n: 0 };
    return null;
  }
  MM.describe = describe;

  /* ---------- data model ---------- */
  MM.newShot = function (scene, name, duration) {
    return { id: nid('s'), name: name || 'Shot', duration: clamp(duration || 4, 0.5, MAX_DUR), scene: scene || App.starterScene(), tracks: [] };
  };
  MM.newMovie = function (title) {
    var sh = MM.newShot(App.starterScene(), 'Shot 1', 4);
    return { v: 1, title: title || 'My movie', platform: 'ig-story', fps: FPS, maxDuration: MAX_DUR, shots: [sh], audio: null };
  };
  MM.total = function (m) { return (m || MM.movie).shots.reduce(function (a, s) { return a + s.duration; }, 0); };

  function cleanKeyValue(d, v) {
    if (d.mode === 'discrete') {
      if (v === null) return null;
      if (d.field === 'emote') { var e = v && DP.emoteInfo(v.id); return e ? { id: e.id, x: isNum(v.x) ? clamp(v.x, -1.5, 1.5) : 0, s: isNum(v.s) ? clamp(v.s, 0.4, 2.5) : 1 } : null; }
      if (d.field === 'bubble') {
        if (!v || typeof v !== 'object') return null;
        var st = DP.BUBBLES.some(function (b) { return b.id === v.style; }) ? v.style : 'speech';
        var o = { text: typeof v.text === 'string' ? v.text.slice(0, 160) : '', style: st, tail: ['left', 'right', 'down', 'none'].indexOf(v.tail) >= 0 ? v.tail : 'down' };
        if (/^#[0-9a-f]{6}$/i.test(v.color)) o.color = v.color;
        if (isNum(v.ox)) o.ox = clamp(v.ox, -100, 100);
        if (isNum(v.oy)) o.oy = clamp(v.oy, -100, 100);
        return o;
      }
      if (d.field === 'visible') return !!v;
      if (d.field === 'wear') { var c = v && DP.costumeInfo(v.id || v); return c ? { id: c.id } : null; }
      if (d.field === 'preset') return App.LIGHTS.some(function (l) { return l.id === v; }) ? v : null;
      if (d.field === 'filter') return isNum(v) ? clamp(Math.round(v), 0, 7) : 0;
      if (d.field === 'caption') return v && typeof v.text === 'string' ? { text: v.text.slice(0, 120) } : null;
      return null;
    }
    if (d.preset) return DP.POSES.some(function (p) { return p.id === v; }) ? v : 'stand';
    if (d.n > 1) {
      if (!Array.isArray(v) || v.length !== d.n) return undefined;
      return v.map(function (x) { return isNum(x) ? x : 0; });
    }
    return isNum(v) ? v : undefined;
  }
  function cleanTracks(list, dur) {
    var out = [];
    (Array.isArray(list) ? list : []).slice(0, 200).forEach(function (tr) {
      var d = tr && describe(tr.target);
      if (!d) return;
      var keys = [];
      (Array.isArray(tr.keys) ? tr.keys : []).slice(0, 700).forEach(function (k) {
        if (!k || !isNum(k.t)) return;
        var v = cleanKeyValue(d, k.v);
        if (v === undefined) return;
        var nk = { t: r4(clamp(k.t, 0, dur)), v: v, ease: EASES.indexOf(k.ease) >= 0 ? k.ease : 'easeInOut' };
        if (k.gen === true) nk.gen = true;      // made by the Quick action list, rebuilt whenever the list changes
        keys.push(nk);
      });
      if (!keys.length) return;
      keys.sort(function (a, b) { return a.t - b.t; });
      out.push({ target: tr.target, keys: keys });
    });
    return out;
  }
  /* make any loaded movie safe: fill gaps, clamp numbers, drop unknown things, cap the total at 60 seconds */
  MM.clean = function (raw) {
    var m = { v: 1, title: 'My movie', platform: 'ig-story', fps: FPS, maxDuration: MAX_DUR, shots: [], audio: null };
    if (!raw || typeof raw !== 'object') return MM.newMovie();
    if (typeof raw.title === 'string') m.title = raw.title.slice(0, 60);
    m.platform = MM.PLATFORMS.some(function (p) { return p.id === raw.platform; }) ? raw.platform : 'ig-story';
    var left = MAX_DUR;
    (Array.isArray(raw.shots) ? raw.shots : []).slice(0, MAX_SHOTS).forEach(function (s, i) {
      if (!s || typeof s !== 'object' || !s.scene || typeof s.scene !== 'object' || left < 0.5) return;
      var dur = clamp(isNum(s.duration) ? s.duration : 4, 0.5, left);
      left -= dur;
      var shot = { id: typeof s.id === 'string' ? s.id.replace(/[^\w-]/g, '').slice(0, 30) || nid('s') : nid('s'), name: typeof s.name === 'string' ? s.name.slice(0, 40) : 'Shot ' + (i + 1), duration: r4(dur), scene: s.scene, tracks: cleanTracks(s.tracks, dur) };
      if (MM.cleanActions) { var acts = MM.cleanActions(s.actions); if (Object.keys(acts).length) shot.actions = acts; }
      if (s.autoCamera === true) shot.autoCamera = true;
      if (MM.cleanCues) { var cues = MM.cleanCues(s); if (cues.camCues.length) shot.camCues = cues.camCues; if (cues.capCues.length) shot.capCues = cues.capCues; }
      if (isNum(s.actDur) && shot.actions) { shot.actDur = r4(clamp(s.actDur, 0.5, MAX_DUR)); if (isNum(s.preDur)) shot.preDur = r4(clamp(s.preDur, 0.5, MAX_DUR)); }
      if (typeof s.thumb === 'string' && /^data:image\/(jpeg|png);base64,/.test(s.thumb) && s.thumb.length < 60000) shot.thumb = s.thumb;
      m.shots.push(shot);
    });
    if (!m.shots.length) return MM.newMovie(m.title);
    var a = raw.audio;
    if (a && typeof a === 'object' && (typeof a.dataUrl !== 'string' || /^data:audio\//.test(a.dataUrl))) {
      m.audio = { name: typeof a.name === 'string' ? a.name.slice(0, 80) : 'Sound', dataUrl: typeof a.dataUrl === 'string' ? a.dataUrl : '', offset: isNum(a.offset) ? clamp(a.offset, 0, MAX_DUR) : 0, volume: isNum(a.volume) ? clamp(a.volume, 0, 1) : 0.8 };
    }
    return m;
  };

  /* ---------- tracks: finding, adding, removing ---------- */
  MM.getTrack = function (shot, target, create) {
    for (var i = 0; i < shot.tracks.length; i++) if (shot.tracks[i].target === target) return shot.tracks[i];
    if (!create) return null;
    var tr = { target: target, keys: [] };
    shot.tracks.push(tr);
    return tr;
  };
  MM.hasTrack = function (shot, target) { var t = MM.getTrack(shot, target); return !!(t && t.keys.length); };
  MM.keyAt = function (track, t) {
    if (!track) return -1;
    for (var i = 0; i < track.keys.length; i++) if (Math.abs(track.keys[i].t - t) <= 0.5 / FPS + 1e-6) return i;
    return -1;
  };
  /* put a key at time t (replacing one on the same frame). A brand new track gets an anchor key at 0 holding `anchorValue`,
     so the change starts at t and not at the start of the shot. */
  MM.setKey = function (shot, target, t, v, ease, anchorValue) {
    var d = describe(target); if (!d) return null;
    if (d.group === 'camera' && shot.autoCamera && MM.autoCameraOff && ['pos', 'target', 'focus'].indexOf(d.field) >= 0) MM.autoCameraOff(shot);
    var tr = MM.getTrack(shot, target, true), isNew = !tr.keys.length;
    t = clamp(snapT(t), 0, shot.duration);
    var cv = cleanKeyValue(d, v);
    if (cv === undefined) return null;
    if (isNew && t > 0.02 && anchorValue !== undefined && d.mode !== 'discrete') {
      var av = cleanKeyValue(d, anchorValue);
      if (av !== undefined) tr.keys.push({ t: 0, v: av, ease: ease || 'easeInOut' });
    }
    var i = MM.keyAt(tr, t), k;
    if (i >= 0) { k = tr.keys[i]; k.v = cv; if (ease) k.ease = ease; delete k.gen; return k; }
    k = { t: t, v: cv, ease: ease || 'easeInOut' };
    tr.keys.push(k);
    tr.keys.sort(function (a, b) { return a.t - b.t; });
    return k;
  };
  MM.removeKey = function (shot, target, index) {
    var tr = MM.getTrack(shot, target); if (!tr) return;
    tr.keys.splice(index, 1);
    if (!tr.keys.length) shot.tracks.splice(shot.tracks.indexOf(tr), 1);
  };
  MM.moveKey = function (shot, target, index, t) {
    var tr = MM.getTrack(shot, target); if (!tr) return index;
    var k = tr.keys[index]; if (!k) return index;
    t = clamp(snapT(t), 0, shot.duration);
    var other = MM.keyAt(tr, t);
    if (other >= 0 && other !== index) return index;   // keep two keys off the same frame
    k.t = t; delete k.gen;
    tr.keys.sort(function (a, b) { return a.t - b.t; });
    return tr.keys.indexOf(k);
  };
  MM.clearTracks = function (shot, pred) { shot.tracks = shot.tracks.filter(function (t) { return !pred(t.target); }); };

  /* ---------- the timeline as a pure function of time ---------- */
  function lerpV(a, b, e) { return Array.isArray(a) ? a.map(function (x, i) { return x + (b[i] - x) * e; }) : a + (b - a) * e; }
  function sampleKeys(keys, t) {
    var n = keys.length; if (!n) return undefined;
    if (t <= keys[0].t) return clone(keys[0].v);
    if (t >= keys[n - 1].t) return clone(keys[n - 1].v);
    var i = 0; while (i < n - 1 && keys[i + 1].t <= t) i++;
    var a = keys[i], b = keys[i + 1];
    return lerpV(a.v, b.v, ease(a.ease, (t - a.t) / (b.t - a.t)));
  }
  /* index of the last key at or before t, -1 if t is before the first */
  function lastIdx(keys, t) { var r = -1; for (var i = 0; i < keys.length; i++) { if (keys[i].t <= t + 1e-6) r = i; else break; } return r; }
  function samplePreset(keys, t, kind, basePose) {
    var i = lastIdx(keys, t);
    if (i < 0) return clone(basePose);
    var A0 = DP.poseFromPreset(keys[i].v, null, kind);
    if (i === keys.length - 1) return A0;
    var B0 = DP.poseFromPreset(keys[i + 1].v, null, kind), a = keys[i], b = keys[i + 1], e = ease(a.ease, (t - a.t) / (b.t - a.t)), out = {};
    POSE_PARAMS.forEach(function (p) { out[p] = p === 'look' ? A0.look : A0[p] + (B0[p] - A0[p]) * e; });
    return out;
  }

  /* what the scene looks like before any track touches it. Built from a cleaned scene. */
  function camToPT(c) {
    var cp = Math.cos(c.pitch);
    return { pos: [c.tx + Math.sin(c.yaw) * cp * c.dist, c.ty + Math.sin(c.pitch) * c.dist, c.tz + Math.cos(c.yaw) * cp * c.dist], target: [c.tx, c.ty, c.tz] };
  }
  function ptToCam(pos, tg) {
    var dx = pos[0] - tg[0], dy = pos[1] - tg[1], dz = pos[2] - tg[2], d = Math.hypot(dx, dy, dz) || 0.001;
    return { tx: tg[0], ty: tg[1], tz: tg[2], yaw: Math.atan2(dx, dz), pitch: Math.asin(clamp(dy / d, -1, 1)), dist: d };
  }
  MM.camToPT = camToPT; MM.ptToCam = ptToCam; MM.cleanTracks = cleanTracks;
  function baseFromScene(sc) {
    var pt = camToPT(sc.cam), b = { cam: clone(sc.cam), camPos: pt.pos, camTarget: pt.target, mm: sc.lens.mm, fstop: sc.lens.fnum, exposure: sc.lens.exposure, focus: clone(sc.lens.focus), roll: sc.cam.roll || 0,
      light: clone(sc.light), filter: sc.look.filter, items: {} };
    sc.items.forEach(function (it) {
      b.items[it.id] = { kind: it.kind, x: it.x, z: it.z, y: it.y, yaw: it.yaw, scale: it.scale, pose: it.pose ? clone(it.pose) : null, move: it.move, emote: clone(it.emote), attach: clone(it.attach || []).filter(function (a) { return String(a.id).indexOf('mm-') !== 0; }) };
    });
    return b;
  }
  MM.baseFromScene = baseFromScene;

  function bubbleRec(v, age) {
    var d = DP.bubbleDefaults(v.style), tail = v.tail;
    return { id: 'mm-bub', kind: 'bubble:' + v.style, slot: 'head', text: v.text, color: v.color || d.color, tail: tail, s: pop(age), r: 0,
      ox: isNum(v.ox) ? v.ox : (tail === 'left' ? 38 : tail === 'right' ? -38 : 0), oy: isNum(v.oy) ? v.oy : 0 };
  }
  function wearRec(v, age) {
    var cs = DP.costumeInfo(v.id); if (!cs) return null;
    return { id: 'mm-wear', kind: 'costume:' + cs.id, slot: cs.slot === 'hand' ? 'handR' : cs.slot, s: pop(age), r: 0, ox: 0, oy: 0 };
  }

  /* Returns what every track says at time t. No scene is touched. Same input, same output. */
  MM.evalFrame = function (shot, t, base) {
    var tq = Math.floor(t * POSE_FPS + 1e-6) / POSE_FPS;
    var f = { t: t, cam: {}, items: {}, light: undefined, warmth: undefined, filter: undefined, caption: undefined };
    function ent(id) { return f.items[id] || (f.items[id] = { presetKeys: null, params: {} }); }
    shot.tracks.forEach(function (tr) {
      var d = describe(tr.target); if (!d || !tr.keys.length) return;
      var keys = tr.keys, i, k, e, v;
      if (d.group === 'camera') {
        v = sampleKeys(keys, t);
        f.cam[d.field] = v;
      } else if (d.group === 'item') {
        if (!base.items[d.id]) return;
        e = ent(d.id);
        if (d.preset) e.presetKeys = keys;
        else if (d.param) e.params[d.param] = sampleKeys(keys, tq);
        else if (d.field === 'pos') e.pos = sampleKeys(keys, tq);
        else if (d.field === 'rot') e.rot = sampleKeys(keys, tq);
        else if (d.field === 'height') e.height = sampleKeys(keys, tq);
        else {
          i = lastIdx(keys, t); k = i >= 0 ? keys[i] : null;
          if (d.field === 'visible') e.visible = k ? !!k.v : 'base';
          else if (d.field === 'emote') { e.emote = k ? (k.v ? { id: k.v.id, x: k.v.x || 0, s: k.v.s || 1, age: t - k.t, moveAge: Math.max(0, tq - k.t) } : null) : 'base'; }
          else if (d.field === 'bubble') e.bubble = k ? (k.v ? { v: k.v, age: t - k.t } : null) : null;
          else if (d.field === 'wear') e.wear = k ? (k.v ? { v: k.v, age: t - k.t } : null) : null;
        }
      } else if (d.group === 'light') {
        if (d.field === 'preset') { i = lastIdx(keys, t); f.light = i >= 0 && keys[i].v ? { preset: keys[i].v } : { base: true }; }
        else f.warmth = sampleKeys(keys, t);
      } else if (d.group === 'look') {
        i = lastIdx(keys, t); f.filter = i >= 0 ? keys[i].v : base.filter;
      } else if (d.group === 'caption') {
        i = lastIdx(keys, t); f.caption = i >= 0 && keys[i].v ? { text: keys[i].v.text, age: t - keys[i].t } : null;
      }
    });
    Object.keys(f.items).forEach(function (id) {
      var e = f.items[id], bi = base.items[id], pose = null;
      if (e.presetKeys) pose = samplePreset(e.presetKeys, tq, bi.kind, bi.pose || DP.defaultPose());
      var any = false;
      POSE_PARAMS.forEach(function (p) {
        if (e.params[p] === undefined) return;
        pose = pose || {};
        pose[p] = p === 'look' ? Math.round(e.params[p]) : e.params[p];
        any = true;
      });
      e.pose = pose;
      if (e.emote !== undefined) {
        if (e.emote && e.emote !== 'base') { var ei = DP.emoteInfo(e.emote.id); e.move = ei && e.emote.moveAge < 0.5 ? ei.move : (bi.move || 'none'); }
        else e.move = bi.move || 'none';
      }
      delete e.presetKeys; delete e.params;
    });
    return f;
  };

  /* ---------- applying a frame to the live scene ---------- */
  var applied = { lightSig: null };
  MM.applyFrame = function (f, base) {
    var st = App.state, rig = App.rig, c = f.cam, changedCam = false, changedLens = false;
    if (c.pos || c.target) {
      var q = ptToCam(c.pos || base.camPos, c.target || base.camTarget);
      rig.s.tx = q.tx; rig.s.ty = q.ty; rig.s.tz = q.tz; rig.s.yaw = q.yaw; rig.s.pitch = q.pitch; rig.s.dist = q.dist;
      rig.mode = 'orbit'; changedCam = true;
    }
    if (c.roll !== undefined) { rig.s.roll = c.roll; changedCam = true; }
    if (c.mm !== undefined) { st.lens.mm = clamp(c.mm, 14, 200); changedLens = true; }
    if (c.fstop !== undefined) { st.lens.fnum = clamp(c.fstop, 1.4, 22.4); changedLens = true; }
    if (c.exposure !== undefined) { st.lens.exposure = clamp(c.exposure, -2, 2); changedLens = true; }
    if (c.focus !== undefined) { st.lens.focus = { mode: 'dist', id: '', dist: Math.max(0.5, c.focus), point: [0, 1, 0] }; changedLens = true; }
    if (changedLens) App.applyLens();
    if (f.light !== undefined || f.warmth !== undefined) {
      var want;
      if (f.light && f.light.preset) { var lp = App.LIGHTS.filter(function (l) { return l.id === f.light.preset; })[0]; want = lp ? App.lightFrom(lp) : clone(base.light); }
      else want = clone(base.light);
      if (f.warmth !== undefined) want.k = clamp(f.warmth, 1500, 12000);
      var sig = JSON.stringify(want);
      if (sig !== applied.lightSig) { st.light = want; applied.lightSig = sig; App.applyLight(); }
    }
    if (f.filter !== undefined && st.look.filter !== f.filter) { st.look.filter = f.filter; }
    Object.keys(f.items).forEach(function (id) {
      var it = App.findItem(id), bi = base.items[id], o = App.objs[id], e = f.items[id];
      if (!it || !o || !bi) return;
      if (e.pos) { it.x = e.pos[0]; it.z = e.pos[1]; }
      if (e.rot !== undefined) it.yaw = e.rot;
      if (e.height !== undefined) it.y = Math.max(0, e.height);
      if (e.pose && it.pose) for (var k in e.pose) it.pose[k] = e.pose[k];
      if (e.move !== undefined) it.move = e.move;
      if (e.emote !== undefined) {
        if (e.emote === 'base') it.emote = clone(bi.emote);
        else if (e.emote === null) it.emote = null;
        else it.emote = { id: e.emote.id, x: e.emote.x, s: e.emote.s * pop(e.emote.age) };
      }
      if (e.bubble !== undefined || e.wear !== undefined) {
        var list = clone(bi.attach) || [], r;
        if (e.wear) { r = wearRec(e.wear.v, e.wear.age); if (r) list.push(r); }
        if (e.bubble) list.push(bubbleRec(e.bubble.v, e.bubble.age));
        it.attach = list;
      }
      App.applyItem(id);
      if (e.visible !== undefined) o.root.visible = e.visible === 'base' ? true : e.visible;
    });
    if (changedCam || changedLens || c.focus !== undefined) App.invalidate();
    App.invalidate();
  };

  /* ---------- the current movie, shot and time ---------- */
  MM.movie = null; MM.shotIdx = 0; MM.t = 0; MM.base = null; MM.loading = false; MM.playing = false;
  MM.safeGuides = false;
  MM.cur = function () { return MM.movie ? MM.movie.shots[MM.shotIdx] : null; };
  MM.shotStart = function (i) { var a = 0; for (var k = 0; k < i; k++) a += MM.movie.shots[k].duration; return a; };
  MM.absTime = function () { return MM.shotStart(MM.shotIdx) + MM.t; };
  MM.captionNow = null;

  MM.applyAt = function (t, shot, base) {
    shot = shot || MM.cur(); base = base || MM.base;
    if (!shot || !base) return null;
    var f = MM.evalFrame(shot, t, base);
    MM.applyFrame(f, base);
    MM.captionNow = f.caption || null;
    return f;
  };
  /* go to time t in the current shot (snapped to a frame unless playing) */
  MM.seek = function (t, nosnap) {
    var shot = MM.cur(); if (!shot) return;
    t = clamp(t, 0, shot.duration);
    if (!nosnap) t = snapT(t);
    MM.t = t;
    MM.applyAt(t);
    paintCaptionPreview();
    emit('time', t);
  };

  /* wait until emotes, bubbles and costumes are drawn */
  function settle() {
    return new Promise(function (res) {
      var t0 = Date.now();
      (function chk() {
        var pend = Object.keys(App.objs).some(function (id) { var o = App.objs[id]; return o && o.pending && o.pending(); });
        if (!pend || Date.now() - t0 > 6000) return res();
        setTimeout(chk, 10);
      })();
    });
  }
  MM.settle = settle;

  var chain = Promise.resolve();
  /* load shot i into the scene. Calls are queued so quick taps cannot overlap. */
  MM.loadShot = function (i, t) {
    var run = function () {
      var m = MM.movie;
      i = clamp(i, 0, m.shots.length - 1);
      var shot = m.shots[i];
      var raw = clone(shot.scene);
      raw.frame = raw.frame || {}; raw.frame.platform = m.platform; raw.frame.safe = !!MM.safeGuides;
      raw.cam = raw.cam || {}; raw.cam.mode = 'orbit';
      MM.loading = true; emit('loading', true);
      return App.loadState(raw).then(function () { return App.applyPhoto(); }).then(settle).then(function () {
        MM.shotIdx = i;
        MM.base = baseFromScene(App.state);
        applied.lightSig = null;
        MM.loading = false;
        MM.t = clamp(t || 0, 0, shot.duration);
        MM.applyAt(MM.t);
        paintCaptionPreview();
        emit('loaded', i); emit('time', MM.t); emit('loading', false);
      }, function (e) { MM.loading = false; emit('loading', false); console.warn('shot load', e); });
    };
    chain = chain.then(run, run);
    return chain;
  };

  /* write what the live scene holds back into the shot, leaving everything the tracks drive at its base value */
  MM.commit = function () {
    var shot = MM.cur(); if (!shot || !MM.base || MM.loading || !App.state) return;
    var s = App.serialize(), base = MM.base, touched = {}, cam = {}, light = false, filt = false, lens = {};
    shot.tracks.forEach(function (tr) {
      var d = describe(tr.target); if (!d || !tr.keys.length) return;
      if (d.group === 'item') (touched[d.id] = touched[d.id] || {})[d.field.indexOf('pose.') === 0 ? 'pose' : d.field] = true;
      else if (d.group === 'camera') { if (d.field === 'pos' || d.field === 'target') cam.pt = true; else if (d.field === 'roll') cam.roll = true; else lens[d.field] = true; }
      else if (d.group === 'light') light = true;
      else if (d.group === 'look') filt = true;
    });
    s.items.forEach(function (it) {
      var bi = base.items[it.id], tt = touched[it.id];
      it.attach = (it.attach || []).filter(function (a) { return String(a.id).indexOf('mm-') !== 0; });
      if (!bi) return;
      if (tt) {
        if (tt.pos) { it.x = bi.x; it.z = bi.z; }
        if (tt.rot) it.yaw = bi.yaw;
        if (tt.height) it.y = bi.y;
        if (tt.pose && bi.pose) it.pose = clone(bi.pose);
        if (tt.emote) { it.emote = clone(bi.emote); it.move = bi.move; }
        if (tt.bubble || tt.wear) it.attach = clone(bi.attach);
      }
    });
    if (cam.pt) { s.cam.tx = base.cam.tx; s.cam.ty = base.cam.ty; s.cam.tz = base.cam.tz; s.cam.yaw = base.cam.yaw; s.cam.pitch = base.cam.pitch; s.cam.dist = base.cam.dist; }
    if (cam.roll) s.cam.roll = base.cam.roll;
    if (lens.mm) s.lens.mm = base.mm;
    if (lens.fstop) s.lens.fnum = base.fstop;
    if (lens.exposure) s.lens.exposure = base.exposure;
    if (lens.focus) s.lens.focus = clone(base.focus);
    if (light) s.light = clone(base.light);
    if (filt) s.look.filter = base.filter;
    s.frame.safe = false;
    shot.scene = s;
    MM.base = baseFromScene(App.clean(s));
    // the clean copy has the same ids, so keep the base in step with the live scene
    return s;
  };

  /* ---------- undo and redo ---------- */
  var undoS = [], redoS = [];
  function pack(m) { return JSON.stringify(m, function (k, v) { return k === 'dataUrl' ? undefined : v; }); }
  MM.packMovie = pack;
  MM.pushUndo = function () {
    if (!MM.movie || MM.loading) return;
    MM.commit();
    undoS.push({ j: pack(MM.movie), i: MM.shotIdx, t: MM.t });
    if (undoS.length > 40) undoS.shift();
    redoS.length = 0;
    emit('history');
  };
  function restore(entry) {
    var m = JSON.parse(entry.j);
    if (m.audio && MM.audioData && MM.audioData.name === m.audio.name) m.audio.dataUrl = MM.audioData.dataUrl;
    else if (m.audio) m.audio = null;
    MM.movie = m;
    MM.touch();
    return MM.loadShot(Math.min(entry.i, m.shots.length - 1), entry.t).then(function () { emit('shots'); emit('tracks'); emit('title'); emit('history'); emit('audio'); });
  }
  MM.undo = function () {
    if (!undoS.length || MM.loading) return Promise.resolve();
    MM.commit();
    redoS.push({ j: pack(MM.movie), i: MM.shotIdx, t: MM.t });
    return restore(undoS.pop());
  };
  MM.redo = function () {
    if (!redoS.length || MM.loading) return Promise.resolve();
    MM.commit();
    undoS.push({ j: pack(MM.movie), i: MM.shotIdx, t: MM.t });
    return restore(redoS.pop());
  };
  MM.canUndo = function () { return undoS.length > 0; };
  MM.canRedo = function () { return redoS.length > 0; };
  MM.resetHistory = function () { undoS = []; redoS = []; emit('history'); };

  /* ---------- shots ---------- */
  MM.addShot = function (scene, name, afterIdx) {
    var m = MM.movie, left = MAX_DUR - MM.total();
    if (m.shots.length >= MAX_SHOTS) { App.msg('That is the most shots a movie can hold.'); return Promise.resolve(false); }
    if (left < 0.5) { App.msg('A movie can be 60 sec long. Shorten a shot first.'); return Promise.resolve(false); }
    MM.pushUndo();
    var sh = MM.newShot(scene, name || 'Shot ' + (m.shots.length + 1), Math.min(4, left));
    var at = (afterIdx === undefined ? MM.shotIdx : afterIdx) + 1;
    m.shots.splice(at, 0, sh);
    MM.touch(); emit('shots');
    return MM.loadShot(at).then(function () { thumbFor(sh); emit('shots'); return true; });
  };
  MM.duplicateShot = function () {
    MM.commit();
    var src = MM.cur(), m = MM.movie, left = MAX_DUR - MM.total();
    if (m.shots.length >= MAX_SHOTS) { App.msg('That is the most shots a movie can hold.'); return Promise.resolve(false); }
    if (left < 0.5) { App.msg('A movie can be 60 sec long. Shorten a shot first.'); return Promise.resolve(false); }
    MM.pushUndo();
    var cp = clone(src); cp.id = nid('s'); cp.name = src.name + ' copy'; cp.duration = Math.min(src.duration, left); cp.tracks = cleanTracks(cp.tracks, cp.duration);
    var at = MM.shotIdx + 1; m.shots.splice(at, 0, cp);
    MM.touch(); emit('shots');
    return MM.loadShot(at).then(function () { emit('shots'); return true; });
  };
  MM.deleteShot = function () {
    var m = MM.movie;
    if (m.shots.length < 2) { App.msg('A movie needs at least one shot.'); return Promise.resolve(false); }
    MM.pushUndo();
    m.shots.splice(MM.shotIdx, 1);
    var i = Math.min(MM.shotIdx, m.shots.length - 1);
    MM.touch(); emit('shots');
    return MM.loadShot(i).then(function () { emit('shots'); emit('tracks'); return true; });
  };
  MM.moveShot = function (from, to) {
    var m = MM.movie;
    if (to < 0 || to >= m.shots.length || from === to) return;
    MM.pushUndo();
    var cur = m.shots[MM.shotIdx], sh = m.shots.splice(from, 1)[0];
    m.shots.splice(to, 0, sh);
    MM.shotIdx = m.shots.indexOf(cur);
    MM.touch(); emit('shots');
  };
  MM.selectShot = function (i, t) {
    if (MM.loading) return Promise.resolve();
    if (i === MM.shotIdx && t === undefined) return Promise.resolve();
    MM.commit();
    return MM.loadShot(i, t || 0).then(function () { emit('shots'); emit('tracks'); });
  };
  MM.setDuration = function (d) {
    var shot = MM.cur(), m = MM.movie;
    var others = MM.total() - shot.duration;
    d = clamp(Math.round(d * 2) / 2, 0.5, Math.min(MAX_DUR - others, MAX_DUR));
    var need = MM.actionNeeded ? MM.actionNeeded(shot) : 0;
    if (need && d < need - 1e-6 && d < shot.duration) { App.msg('The Quick list needs ' + (Math.round(need * 10) / 10) + ' sec. Shorten the list to make the shot shorter.', 3600); return; }
    if (d === shot.duration) { if (MM.total() >= MAX_DUR - 1e-6) App.msg('A movie can be 60 sec long.'); return; }
    MM.pushUndo();
    shot.duration = d;
    shot.tracks.forEach(function (tr) { tr.keys = tr.keys.filter(function (k) { return k.t <= d + 1e-6; }); });
    shot.tracks = shot.tracks.filter(function (tr) { return tr.keys.length; });
    if (MM.t > d) MM.t = d;
    MM.touch(); emit('shots'); emit('tracks'); emit('time', MM.t);
  };

  /* shot picture for the strip, taken at the middle of the shot */
  function thumbFor(shot, force, keepSel) {
    if (!shot || (shot.thumb && !force)) return;
    var live = MM.cur() === shot;
    if (!live || MM.loading) return;
    var keepT = MM.t;
    try {
      var p = MM.platformInfo(MM.movie.platform), h = 128, w = Math.round(h * p.w / p.h);
      MM.applyAt(shot.duration * 0.5);
      if (!keepSel) App.select(null);
      var cv = App.renderToCanvas(w, h, { taps: 24, overlay: true });
      MM.applyAt(keepT);
      var t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').drawImage(cv, 0, 0);
      var cap = captionAt(shot, shot.duration * 0.5);
      if (cap) drawCaption(t.getContext('2d'), w, h, cap.text, 1, MM.movie.platform);
      shot.thumb = t.toDataURL('image/jpeg', 0.78);
    } catch (e) { console.warn('thumb', e); }
  }
  MM.thumbFor = thumbFor;
  function captionAt(shot, t) { return MM.evalFrame(shot, t, MM.base).caption; }

  /* load every shot once, so drawings are ready and each shot has a picture. Ends back on the shot that was open. */
  MM.warmUp = function (onProgress) {
    var m = MM.movie, start = MM.shotIdx, startT = MM.t, seq = Promise.resolve();
    MM.commit();
    m.shots.forEach(function (sh, i) {
      seq = seq.then(function () {
        if (onProgress) onProgress(i, m.shots.length);
        return MM.loadShot(i).then(function () { thumbFor(MM.cur()); });
      });
    });
    return seq.then(function () { return MM.loadShot(start, startT); }).then(function () { emit('shots'); });
  };

  /* ---------- captions: an L sign bar drawn over the picture, inside the platform safe area ---------- */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawCaption(ctx, w, h, text, age, platformId) {
    if (!text) return;
    var p = MM.platformInfo(platformId), m = Math.min(w, h), u = m / 800;
    var left, right, bottom;
    if (p.safe) { left = w * 0.05; right = w * 0.87; bottom = h * 0.79; }      // keep out of the top, bottom and right app bars
    else { left = w * 0.05; right = w * 0.95; bottom = h * 0.93; }
    var bw = right - left, bh = Math.min(m * 0.1, bw * 0.2), fs = bh * 0.42, FONT = 'Lexend, "Atkinson Hyperlegible", system-ui, sans-serif';
    ctx.save();
    ctx.font = '700 ' + fs + 'px ' + FONT;
    var avail = bw - bh * 1.6, lines = [text], tw = ctx.measureText(text).width;
    if (tw > avail) {
      if (tw * 0.78 <= avail) { fs *= avail / tw; }
      else {
        fs *= 0.82; ctx.font = '700 ' + fs + 'px ' + FONT;
        var words = text.split(/\s+/), a = '', b = '', i;
        for (i = 0; i < words.length; i++) { if (ctx.measureText((a + ' ' + words[i]).trim()).width <= avail || !a) a = (a + ' ' + words[i]).trim(); else break; }
        b = words.slice(a ? a.split(/\s+/).length : 0).join(' ');
        lines = b ? [a, b] : [a];
        var wid = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
        if (wid > avail) fs *= avail / wid;
      }
    }
    var th = lines.length > 1 ? bh * 1.5 : bh, by = bottom - th, cx = left + bw / 2, cy = by + th / 2, sc = age === undefined ? 1 : pop(age);
    ctx.translate(cx, cy + th / 2); ctx.scale(sc, sc); ctx.translate(-cx, -(cy + th / 2));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = '#2a2350'; rr(ctx, left + 5 * u, by + 5 * u, bw, th, th * 0.2); ctx.fill();
    ctx.fillStyle = '#b3ddf2'; rr(ctx, left, by, bw, th, th * 0.2); ctx.fill();
    ctx.strokeStyle = '#2a2350'; ctx.lineWidth = 4 * u; ctx.stroke();
    ctx.fillStyle = '#e2362f'; ctx.fillRect(left + 3 * u, by + th * 0.8, bw - 6 * u, th * 0.1);
    [left + bh * 0.5, left + bw - bh * 0.5].forEach(function (sx) {
      ctx.fillStyle = '#e4002b'; ctx.beginPath();
      for (var q = 0; q < 12; q++) { var rad = q % 2 ? bh * 0.1 : bh * 0.2, tt = q / 12 * Math.PI * 2 - Math.PI / 2; ctx[q ? 'lineTo' : 'moveTo'](sx + Math.cos(tt) * rad, by + th * 0.4 + Math.sin(tt) * rad); }
      ctx.closePath(); ctx.fill();
    });
    ctx.font = '700 ' + fs + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#2a2350';
    var ly = by + th * 0.4 - (lines.length - 1) * fs * 0.6;
    lines.forEach(function (l, k) { ctx.fillText(l, cx, ly + k * fs * 1.2); });
    ctx.restore();
  }
  MM.drawCaption = drawCaption;
  var capCv = null, capSig = '';
  function paintCaptionPreview() {
    capCv = capCv || document.getElementById('cap');
    if (!capCv) return;
    var fb = document.getElementById('frameBox'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(fb.clientWidth * dpr)), h = Math.max(1, Math.round(fb.clientHeight * dpr));
    var c = MM.captionNow, sig = (c ? c.text + '|' + (c.age < POP ? c.age.toFixed(3) : 'x') : '') + '|' + w + 'x' + h + '|' + (MM.movie ? MM.movie.platform : '');
    if (sig === capSig) return;
    capSig = sig;
    if (capCv.width !== w || capCv.height !== h) { capCv.width = w; capCv.height = h; }
    var ctx = capCv.getContext('2d'); ctx.clearRect(0, 0, w, h);
    if (c) drawCaption(ctx, w, h, c.text, c.age, MM.movie.platform);
  }
  MM.paintCaption = function () { capSig = ''; paintCaptionPreview(); };

  /* ---------- camera and character helpers (used by the Camera tab, the Item tab and the showcase) ---------- */
  var Mo = MM.motions = {};
  function itemPointY(base, id) {
    var bi = base.items[id], def = bi && DP.PUPPETS[bi.kind], o = App.objs && App.objs[id];
    if (def) return def.size * bi.scale * 0.62;
    return o ? o.h * bi.scale * 0.62 : 0.8;
  }
  /* depth of a character from the camera at time t, as the lens measures focus */
  Mo.focusDist = function (shot, base, t, id) {
    var f = MM.evalFrame(shot, t, base), pos = f.cam.pos || base.camPos, tg = f.cam.target || base.camTarget;
    var bi = base.items[id], e = f.items[id] || {};
    var x = e.pos ? e.pos[0] : bi.x, z = e.pos ? e.pos[1] : bi.z, y = (e.height !== undefined ? e.height : bi.y) + itemPointY(base, id);
    var fw = [tg[0] - pos[0], tg[1] - pos[1], tg[2] - pos[2]], L = Math.hypot(fw[0], fw[1], fw[2]) || 1;
    var d = ((x - pos[0]) * fw[0] + (y - pos[1]) * fw[1] + (z - pos[2]) * fw[2]) / L;
    return Math.max(0.5, d);
  };
  function camNow(shot, base, t) {
    var f = MM.evalFrame(shot, t, base);
    return { pos: f.cam.pos || base.camPos.slice(), target: f.cam.target || base.camTarget.slice() };
  }
  function setPT(shot, base, t, pos, tg, ease) {
    MM.setKey(shot, 'camera.pos', t, pos, ease, base.camPos);
    MM.setKey(shot, 'camera.target', t, tg, ease, base.camTarget);
  }
  /* each move starts from the camera as it is at t0 and writes eased keys up to t1. No whip pans. */
  Mo.dollyIn = function (shot, base, t0, t1, amount) {
    var c = camNow(shot, base, t0), k = 1 - (amount === undefined ? 0.3 : amount);
    var p1 = [0, 1, 2].map(function (i) { return c.target[i] + (c.pos[i] - c.target[i]) * k; });
    clearAfter(shot, ['camera.pos', 'camera.target'], t0);
    setPT(shot, base, t0, c.pos, c.target, 'easeInOut');
    setPT(shot, base, t1, p1, c.target, 'easeInOut');
  };
  Mo.orbit = function (shot, base, t0, t1, degrees) {
    var c = camNow(shot, base, t0), q = ptToCam(c.pos, c.target), n = Math.max(2, Math.round((t1 - t0) / 0.4)), i;
    var deg = degrees === undefined ? 30 : degrees;
    clearAfter(shot, ['camera.pos', 'camera.target'], t0);
    for (i = 0; i <= n; i++) {
      var u = i / n, yaw = q.yaw + deg * D2R * ease('easeInOut', u), cp = Math.cos(q.pitch);
      var pos = [q.tx + Math.sin(yaw) * cp * q.dist, q.ty + Math.sin(q.pitch) * q.dist, q.tz + Math.cos(yaw) * cp * q.dist];
      setPT(shot, base, t0 + (t1 - t0) * u, pos, c.target, 'linear');
    }
  };
  Mo.crane = function (shot, base, t0, t1, dy) {
    var c = camNow(shot, base, t0), p1 = [c.pos[0], Math.max(0.3, c.pos[1] + (dy === undefined ? 1.8 : dy)), c.pos[2]];
    clearAfter(shot, ['camera.pos', 'camera.target'], t0);
    setPT(shot, base, t0, c.pos, c.target, 'easeInOut');
    setPT(shot, base, t1, p1, c.target, 'easeInOut');
  };
  Mo.hold = function (shot, base, t0, t1) {
    var c = camNow(shot, base, t0);
    clearAfter(shot, ['camera.pos', 'camera.target'], t0);
    setPT(shot, base, t0, c.pos, c.target, 'linear');
    setPT(shot, base, t1, c.pos, c.target, 'linear');
  };
  /* focus slides from character A to character B, following the camera if it moves. Keys every 0.25 s keep it sharp on the way. */
  Mo.rackFocus = function (shot, base, t0, t1, idA, idB) {
    var n = Math.max(2, Math.round((t1 - t0) / 0.25)), i;
    clearAfter(shot, ['camera.focus'], t0 - 0.001);
    MM.setKey(shot, 'camera.focus', t0, Mo.focusDist(shot, base, t0, idA), 'linear', Mo.focusDist(shot, base, 0, idA));
    for (i = 1; i <= n; i++) {
      var u = i / n, t = t0 + (t1 - t0) * u, w = ease('easeInOut', u);
      MM.setKey(shot, 'camera.focus', t, Mo.focusDist(shot, base, t, idA) * (1 - w) + Mo.focusDist(shot, base, t, idB) * w, 'linear');
    }
  };
  function clearAfter(shot, targets, t0) {
    targets.forEach(function (tg) {
      var tr = MM.getTrack(shot, tg); if (!tr) return;
      tr.keys = tr.keys.filter(function (k) { return k.t < t0 - 0.5 / FPS; });
      if (!tr.keys.length) shot.tracks.splice(shot.tracks.indexOf(tr), 1);
    });
  }
  /* a hop: up, land with a little squash, settle. Poses step on twos, so it reads as stop motion. */
  Mo.hop = function (shot, base, id, t0, count, each) {
    var tg = 'item:' + id + '.pose.hop', bn = 'item:' + id + '.pose.bend', wA = 'item:' + id + '.pose.wingA', wB = 'item:' + id + '.pose.wingB', i;
    var bi = base.items[id], wings = bi && DP.PUPPETS[bi.kind] ? DP.PUPPETS[bi.kind].wings : 2, hp = bi && bi.pose ? bi.pose : DP.defaultPose();
    each = each || 0.5;
    for (i = 0; i < (count || 1); i++) {
      var a = t0 + i * each;
      MM.setKey(shot, tg, a, 0, 'easeInOut', hp.hop || 0);
      MM.setKey(shot, tg, a + each * 0.45, 0.55, 'easeInOut');
      MM.setKey(shot, tg, a + each * 0.9, 0, 'easeInOut');
      MM.setKey(shot, bn, a, hp.bend || 0, 'easeInOut', hp.bend || 0);
      MM.setKey(shot, bn, a + each * 0.9, 11, 'easeInOut');
      MM.setKey(shot, bn, a + each, hp.bend || 0, 'easeInOut');
      if (wings >= 1) { MM.setKey(shot, wA, a, hp.wingA || 0, 'easeInOut', hp.wingA || 0); MM.setKey(shot, wA, a + each * 0.45, 45, 'easeInOut'); MM.setKey(shot, wA, a + each * 0.9, hp.wingA || 0, 'easeInOut'); }
      if (wings >= 2) { MM.setKey(shot, wB, a, hp.wingB || 0, 'easeInOut', hp.wingB || 0); MM.setKey(shot, wB, a + each * 0.45, 45, 'easeInOut'); MM.setKey(shot, wB, a + each * 0.9, hp.wingB || 0, 'easeInOut'); }
    }
  };

  /* ---------- sound ---------- */
  var actx = null, abuf = null, asrc = null, again = null, abufName = '';
  MM.audioData = null;      // { name, dataUrl } of the file in use
  MM.muted = true;          // sound is off until the person turns it on
  function ctxGet() {
    if (!actx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; try { actx = new AC(); } catch (e) { actx = null; } }
    if (actx && actx.state === 'suspended') actx.resume().catch(function () {});
    return actx;
  }
  function dataUrlToBuf(u) {
    var b64 = u.slice(u.indexOf(',') + 1), bin = atob(b64), n = bin.length, a = new Uint8Array(n);
    for (var i = 0; i < n; i++) a[i] = bin.charCodeAt(i);
    return a.buffer;
  }
  MM.hasSound = function () { return !!(MM.movie && MM.movie.audio && MM.movie.audio.dataUrl); };
  MM.prepareAudio = function () {
    var a = MM.movie && MM.movie.audio;
    if (!a || !a.dataUrl) { abuf = null; abufName = ''; return Promise.resolve(false); }
    var c = ctxGet(); if (!c) return Promise.resolve(false);
    if (abuf && abufName === a.name + a.dataUrl.length) return Promise.resolve(true);
    return new Promise(function (res) {
      var data; try { data = dataUrlToBuf(a.dataUrl); } catch (e) { return res(false); }
      var ok = function (b) { abuf = b; abufName = a.name + a.dataUrl.length; res(true); };
      var bad = function () { App.msg('That sound could not be read. Try an mp3, m4a, wav or ogg file.'); abuf = null; res(false); };
      try { var p = c.decodeAudioData(data, ok, bad); if (p && p.catch) p.catch(bad); } catch (e) { bad(); }
    });
  };
  MM.setAudioFile = function (file) {
    return new Promise(function (res) {
      if (!file) return res(false);
      if (file.size > 30 * 1024 * 1024) { App.msg('That sound file is too big. Try one under 30 MB.'); return res(false); }
      var fr = new FileReader();
      fr.onload = function () {
        var url = String(fr.result);
        if (!/^data:audio\//.test(url)) url = url.replace(/^data:[^;,]*/, 'data:audio/mpeg');
        MM.pushUndo();
        MM.audioData = { name: file.name.slice(0, 80), dataUrl: url };
        MM.movie.audio = { name: MM.audioData.name, dataUrl: url, offset: 0, volume: 0.8 };
        abuf = null; MM.audioDirty = true;
        MM.prepareAudio().then(function (ok) {
          if (!ok) { MM.movie.audio = null; MM.audioData = null; }
          else MM.muted = false;
          MM.touch(); emit('audio'); res(ok);
        });
      };
      fr.onerror = function () { App.msg('That sound could not be read.'); res(false); };
      fr.readAsDataURL(file);
    });
  };
  MM.removeAudio = function () { MM.pushUndo(); MM.movie.audio = null; MM.audioData = null; abuf = null; MM.audioDirty = true; MM.audioStop(); MM.touch(); emit('audio'); };
  MM.audioStop = function () { if (asrc) { try { asrc.stop(); } catch (e) {} try { asrc.disconnect(); } catch (e) {} asrc = null; } };
  MM.audioVolume = function () { if (again && MM.movie && MM.movie.audio) again.gain.value = MM.muted ? 0 : MM.movie.audio.volume; };
  /* start the sound so it lines up with movie time `abs` seconds */
  MM.audioStart = function (abs) {
    MM.audioStop();
    var a = MM.movie && MM.movie.audio, c = ctxGet();
    if (!a || !abuf || !c || MM.muted) return;
    again = c.createGain(); again.gain.value = a.volume; again.connect(c.destination);
    asrc = c.createBufferSource(); asrc.buffer = abuf; asrc.connect(again);
    var into = abs - a.offset;
    if (into >= abuf.duration) { asrc = null; return; }
    if (into >= 0) asrc.start(0, into); else asrc.start(c.currentTime - into, 0);
  };

  /* ---------- playback (preview) ---------- */
  var lastNow = 0, rafId = 0, holdAfterLoad = false;
  MM.play = function () {
    if (MM.playing || MM.loading) return;
    var shot = MM.cur();
    if (MM.shotIdx === MM.movie.shots.length - 1 && MM.t >= shot.duration - 0.02) {
      MM.commit();
      MM.loadShot(0, 0).then(function () { MM.play(); });
      return;
    }
    MM.commit();
    MM.playing = true; MM.selBeforePlay = App.sel; App.select(null);
    var go = function () { if (!MM.playing) return; MM.audioStart(MM.absTime()); lastNow = performance.now(); rafId = requestAnimationFrame(tick); emit('play', true); };
    emit('play', true);
    if (MM.hasSound() && !MM.muted) MM.prepareAudio().then(go); else go();
  };
  MM.pause = function () {
    if (!MM.playing) return;
    MM.playing = false; cancelAnimationFrame(rafId); MM.audioStop();
    MM.seek(MM.t);
    if (MM.selBeforePlay) App.select(MM.selBeforePlay);
    emit('play', false);
  };
  MM.togglePlay = function () { if (MM.playing) MM.pause(); else MM.play(); };
  function tick(now) {
    if (!MM.playing) return;
    rafId = requestAnimationFrame(tick);
    if (MM.loading) { lastNow = now; return; }
    var dt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
    var shot = MM.cur();
    MM.t += dt;
    if (MM.t >= shot.duration) {
      if (MM.shotIdx < MM.movie.shots.length - 1) {
        // a hard cut to the next shot. The clock waits while it loads.
        MM.loadShot(MM.shotIdx + 1, 0).then(function () { if (MM.playing) { MM.audioStart(MM.absTime()); emit('shots'); emit('tracks'); } });
        return;
      }
      MM.t = shot.duration;
      MM.applyAt(MM.t); paintCaptionPreview(); emit('time', MM.t);
      MM.pause();
      App.msg('The end. Play it again, or export it.', 2600);
      return;
    }
    MM.applyAt(MM.t);
    paintCaptionPreview();
    App.bump();
    emit('time', MM.t);
  }

  /* ---------- saving ---------- */
  var saveTimer = 0;
  MM.touch = function () { clearTimeout(saveTimer); saveTimer = setTimeout(function () { MM.saveCurrent(); }, 800); };
  function movieRec(id) {
    return { id: id, name: MM.movie.title, time: Date.now(), thumb: MM.movie.shots[0].thumb || '', data: JSON.parse(pack(MM.movie)) };
  }
  MM.saveCurrent = function () {
    if (!MM.movie || MM.loading) return Promise.resolve();
    MM.commit();
    var jobs = [DP.Store.put('movies', movieRec('current'))];
    if (MM.audioDirty) {
      MM.audioDirty = false;
      jobs.push(MM.movie.audio && MM.movie.audio.dataUrl ? DP.Store.put('auto', { id: 'mmaudio-current', time: Date.now(), name: MM.movie.audio.name, dataUrl: MM.movie.audio.dataUrl }) : DP.Store.del('auto', 'mmaudio-current'));
    }
    return Promise.all(jobs);
  };
  window.addEventListener('pagehide', function () { if (MM.movie && !MM.loading) { try { MM.commit(); DP.Store.put('movies', movieRec('current')); } catch (e) {} } });
  MM.saveNamed = function (name) {
    MM.commit();
    var id = nid('m'), rec = movieRec(id);
    if (name) rec.name = name.slice(0, 60);
    var jobs = [DP.Store.put('movies', rec)];
    if (MM.movie.audio && MM.movie.audio.dataUrl) jobs.push(DP.Store.put('auto', { id: 'mmaudio-' + id, time: Date.now(), name: MM.movie.audio.name, dataUrl: MM.movie.audio.dataUrl }));
    return Promise.all(jobs).then(function () { return rec; });
  };
  MM.listMovies = function () {
    return DP.Store.all('movies').then(function (list) {
      return list.filter(function (r) { return r.id !== 'current'; }).sort(function (a, b) { return b.time - a.time; });
    });
  };
  MM.deleteMovie = function (id) { return Promise.all([DP.Store.del('movies', id), DP.Store.del('auto', 'mmaudio-' + id)]); };
  /* a saved record becomes the open movie */
  MM.openRecord = function (rec, audioId) {
    return DP.Store.get('auto', 'mmaudio-' + (audioId || rec.id)).then(function (au) {
      var m = MM.clean(rec.data);
      if (m.audio && au && au.dataUrl) { m.audio.dataUrl = au.dataUrl; m.audio.name = au.name || m.audio.name; }
      else if (m.audio) m.audio = null;
      return MM.setMovie(m);
    });
  };
  MM.setMovie = function (m) {
    MM.pause();
    MM.movie = m;
    MM.audioData = m.audio && m.audio.dataUrl ? { name: m.audio.name, dataUrl: m.audio.dataUrl } : null;
    abuf = null; MM.audioDirty = true; MM.muted = true;
    MM.resetHistory();
    emit('title'); emit('audio');
    return MM.loadShot(0, 0).then(function () { return MM.warmUp(); }).then(function () { MM.touch(); emit('shots'); emit('tracks'); emit('title'); });
  };
  MM.exportFileText = function () { MM.commit(); return JSON.stringify(MM.movie); };
  MM.importFileText = function (text) {
    var obj; try { obj = JSON.parse(text); } catch (e) { return Promise.reject(new Error('That file is not a movie file.')); }
    if (!obj || !Array.isArray(obj.shots)) return Promise.reject(new Error('That file is not a movie file.'));
    return MM.setMovie(MM.clean(obj));
  };
  MM.setTitle = function (t) { MM.movie.title = String(t).slice(0, 60); MM.touch(); };
  MM.setPlatform = function (id) {
    if (id === MM.movie.platform) return Promise.resolve();
    MM.pushUndo();
    MM.movie.platform = id;
    MM.movie.shots.forEach(function (s) { delete s.thumb; });
    App.state.frame.platform = id; App.layout(); MM.paintCaption();
    MM.touch(); emit('title');
    return MM.warmUp();
  };

  /* ---------- download, the same route photo mode uses ---------- */
  var dlApi = null;
  try { if (window.claude && window.claude.use) window.claude.use('downloads').then(function (d) { dlApi = d; }, function () {}); } catch (e) { dlApi = null; }
  MM.download = function (blob, name) {
    if (dlApi) {
      dlApi.save({ filename: name, data: blob }).catch(function (e) { if (!e || e.code !== 'declined') App.msg('The file could not be saved here.'); });
      return;
    }
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };
  MM.slug = function (s) { return String(s || 'movie').toLowerCase().replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'movie'; };

  /* ---------- video export ---------- */
  MM.exportSize = function (fast) {
    var p = MM.platformInfo(MM.movie.platform), w = p.w, h = p.h;
    if (fast) { w = Math.round(w / 4) * 2; h = Math.round(h / 4) * 2; }
    return { w: w, h: h };
  };
  MM.frameCount = function () { return MM.movie.shots.reduce(function (a, s) { return a + Math.max(1, Math.round(s.duration * FPS)); }, 0); };
  function pickMime() {
    if (!window.MediaRecorder) return '';
    var list = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    for (var i = 0; i < list.length; i++) { try { if (MediaRecorder.isTypeSupported(list[i])) return list[i]; } catch (e) {} }
    return '';
  }
  MM.canExport = function () { return !!pickMime() && !!HTMLCanvasElement.prototype.captureStream; };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function toBlob(cv, type, q) { return new Promise(function (res) { cv.toBlob(res, type, q); }); }
  function decode(blob) {
    if (window.createImageBitmap) return createImageBitmap(blob);
    return new Promise(function (res, rej) { var u = URL.createObjectURL(blob), im = new Image(); im.onload = function () { URL.revokeObjectURL(u); res(im); }; im.onerror = rej; im.src = u; });
  }
  MM.exporting = false;
  var cancelFlag = false;
  MM.cancelExport = function () { cancelFlag = true; };

  /* Two steps keep the video the right length on any device.
     First every frame is drawn on its own, as slowly as it needs (the timeline is a pure function of the frame number).
     Then the saved frames are played into the recorder at an exact 30 per second, with the sound in step. */
  MM.exportVideo = function (opts, progress) {
    opts = opts || {};
    if (MM.exporting) return Promise.reject(new Error('busy'));
    var mime = pickMime();
    if (!mime) return Promise.reject(new Error('This browser cannot record video. Try a recent Chrome, Edge, Firefox or Safari.'));
    MM.pause();
    MM.exporting = true; cancelFlag = false;
    var m = MM.movie, sz = MM.exportSize(opts.fast), W = sz.w, H = sz.h, total = MM.frameCount();
    var keep = { i: MM.shotIdx, t: MM.t, sel: App.sel };
    MM.commit();
    App.select(null);
    var out = document.createElement('canvas'); out.width = W; out.height = H;
    var octx = out.getContext('2d');
    var blobs = [], done = 0;
    var useSound = !!(opts.sound && MM.hasSound());
    var taps = opts.fast ? 48 : 80;
    var aborted = function () { return cancelFlag; };
    function finish(err, val) {
      MM.exporting = false;
      return MM.loadShot(keep.i, keep.t).then(function () { if (keep.sel) App.select(keep.sel); emit('shots'); emit('tracks'); if (err) throw err; return val; });
    }
    var fontsP = (document.fonts && document.fonts.load) ? Promise.all([document.fonts.load('700 40px Lexend')]).catch(function () {}) : Promise.resolve();
    var seq = fontsP.then(function () { return useSound ? MM.prepareAudio() : null; });
    // step 1: draw every frame
    m.shots.forEach(function (shot, si) {
      seq = seq.then(function () {
        if (aborted()) throw { cancelled: true };
        return MM.loadShot(si, 0);
      }).then(function () {
        var n = Math.max(1, Math.round(shot.duration * FPS)), f = 0;
        return (function next() {
          if (f >= n) return;
          if (aborted()) throw { cancelled: true };
          var t = f / FPS;
          MM.applyAt(t, shot, MM.base);
          return settle().then(function () {
            var cv = App.renderToCanvas(W, H, { taps: taps });
            octx.drawImage(cv, 0, 0);
            var cap = MM.captionNow;
            if (cap) drawCaption(octx, W, H, cap.text, cap.age, m.platform);
            return toBlob(out, 'image/jpeg', 0.93);
          }).then(function (b) {
            blobs.push(b); done++; f++;
            if (progress) progress({ phase: 'draw', frame: done, total: total });
            return sleep(0).then(next);
          });
        })();
      });
    });
    // step 2: record at real speed
    seq = seq.then(function () {
      if (aborted()) throw { cancelled: true };
      var stream = out.captureStream(0), track = stream.getVideoTracks()[0], c = null, dest = null, src = null;
      if (useSound && abuf) {
        c = ctxGet();
        if (c && c.createMediaStreamDestination) {
          dest = c.createMediaStreamDestination();
          var g = c.createGain(); g.gain.value = m.audio.volume; g.connect(dest);
          src = c.createBufferSource(); src.buffer = abuf; src.connect(g);
          dest.stream.getAudioTracks().forEach(function (tr) { stream.addTrack(tr); });
        }
      }
      var rec, chunks = [];
      try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 }); }
      catch (e) { rec = new MediaRecorder(stream, { mimeType: mime }); }
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      var stopped = new Promise(function (res) { rec.onstop = res; });
      return decode(blobs[0]).then(function (b0) {
        octx.drawImage(b0, 0, 0); if (b0.close) b0.close();
        rec.start(500);
        var startAt = performance.now() + 150, ahead = {}, i = 0, step = 1000 / FPS;
        if (src) { var off = m.audio.offset; if (off >= 0) src.start(c.currentTime + 0.15 + off, 0); }
        function want(k) { if (k < blobs.length && !ahead[k]) ahead[k] = decode(blobs[k]); return ahead[k]; }
        for (var q = 0; q < 6; q++) want(q);
        return (function loop() {
          if (i >= blobs.length) return;
          if (aborted()) throw { cancelled: true };
          var wait = startAt + i * step - performance.now();
          return (wait > 0 ? sleep(wait) : Promise.resolve()).then(function () { return want(i); }).then(function (bmp) {
            octx.drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
            delete ahead[i];
            track.requestFrame && track.requestFrame();
            want(i + 6);
            i++;
            if (progress && i % 3 === 0) progress({ phase: 'record', frame: i, total: blobs.length });
            return loop();
          });
        })().then(function () { return sleep(step * 2); }).then(function () {
          try { rec.stop(); } catch (e) {}
          if (src) { try { src.stop(); } catch (e) {} }
          return stopped;
        }).then(function () {
          stream.getTracks().forEach(function (tr) { tr.stop(); });
          var type = mime.split(';')[0], blob = new Blob(chunks, { type: type });
          return { blob: blob, mime: type, ext: type === 'video/mp4' ? 'mp4' : 'webm', w: W, h: H, frames: blobs.length, seconds: blobs.length / FPS, sound: !!src };
        }, function (e) { try { rec.stop(); } catch (x) {} throw e; });
      });
    });
    return seq.then(function (res) { blobs = null; return finish(null, res); }, function (e) { blobs = null; return finish(e && e.cancelled ? { cancelled: true } : e); });
  };

  /* a PNG of the picture at the current moment, at full size */
  MM.posterBlob = function (fast) {
    var sz = MM.exportSize(fast), out = document.createElement('canvas'); out.width = sz.w; out.height = sz.h;
    var selWas = App.sel; App.select(null);
    var cv = App.renderToCanvas(sz.w, sz.h, { taps: 80 }), ctx = out.getContext('2d');
    ctx.drawImage(cv, 0, 0);
    if (MM.captionNow) drawCaption(ctx, sz.w, sz.h, MM.captionNow.text, MM.captionNow.age, MM.movie.platform);
    if (selWas) App.select(selWas);
    return toBlob(out, 'image/png');
  };

  /* ---------- start ---------- */
  /* App.boot loads the first shot by itself. MM.adopt then makes that the open shot, once the screen is ready. */
  MM.start = function () {
    var forceShowcase = /[?&]showcase\b/.test(location.search);
    return (forceShowcase ? Promise.resolve(null) : DP.Store.get('movies', 'current').then(function (rec) { return rec && rec.data ? MM.openRecordForStart(rec) : null; })).then(function (m) {
      MM.movie = m || MM.clean(DP.movieShowcase ? DP.movieShowcase() : null);
      MM.audioData = MM.movie.audio && MM.movie.audio.dataUrl ? { name: MM.movie.audio.name, dataUrl: MM.movie.audio.dataUrl } : null;
      var first = clone(MM.movie.shots[0].scene);
      first.frame = first.frame || {}; first.frame.platform = MM.movie.platform; first.cam = first.cam || {}; first.cam.mode = 'orbit';
      return new Promise(function (res) {
        MM._ready = res;
        App.boot({ noAutosave: true, initial: function () { return first; } });
      });
    });
  };
  MM.adopt = function () {
    if (!MM.movie || !App.state) return;
    MM.shotIdx = 0; MM.base = baseFromScene(App.state); applied.lightSig = null; MM.t = 0; MM.loading = false;
    MM.applyAt(0); paintCaptionPreview();
    emit('title'); emit('audio'); emit('loaded', 0); emit('time', 0);
  };
  MM.openRecordForStart = function (rec) {
    return DP.Store.get('auto', 'mmaudio-current').then(function (au) {
      var m = MM.clean(rec.data);
      if (m.audio && au && au.dataUrl) m.audio.dataUrl = au.dataUrl; else if (m.audio) m.audio = null;
      return m;
    });
  };

  /* hooks for tests and for debugging in the console */
  MM.api = { evalFrame: MM.evalFrame, applyAt: MM.applyAt, settle: settle, clean: MM.clean, baseFromScene: baseFromScene };
})();
