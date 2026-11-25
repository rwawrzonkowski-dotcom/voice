/* DIBS Photo Mode: the app core. Scene, camera, lights, drawing, capture and saving.
   The tool panel lives in ui.js. Classic script, no modules, no network. */
(function () {
  'use strict';
  var THREE = window.THREEPKG.THREE;
  var DP = window.DP;
  var A = window.DIBS_ASSETS;
  var D2R = Math.PI / 180;
  var $ = function (id) { return document.getElementById(id); };
  var App = DP.app = { objs: {}, sel: null, ui: null };

  var COARSE = window.matchMedia && matchMedia('(pointer:coarse)').matches;
  var UNIT_MM = 180;           // one world unit is 18 cm: a small diorama, so depth of field reads clearly
  App.UNIT_MM = UNIT_MM;

  /* ---------- tables ---------- */
  App.PLATFORMS = [
    { id: 'ig-post', group: 'Instagram', name: 'Post 4:5', w: 1080, h: 1350 },
    { id: 'ig-square', group: 'Instagram', name: 'Square', w: 1080, h: 1080 },
    { id: 'ig-story', group: 'Instagram', name: 'Story or Reel 9:16', w: 1080, h: 1920, safe: true },
    { id: 'threads', group: 'Threads', name: 'Post 4:5', w: 1080, h: 1350 },
    { id: 'tiktok', group: 'TikTok', name: 'Video 9:16', w: 1080, h: 1920, safe: true },
    { id: 'yt-thumb', group: 'YouTube', name: 'Thumbnail 16:9', w: 1280, h: 720 },
    { id: 'yt-shorts', group: 'YouTube', name: 'Shorts 9:16', w: 1080, h: 1920, safe: true },
    { id: 'yt-banner', group: 'YouTube', name: 'Channel banner', w: 2560, h: 1440, banner: { w: 1546, h: 423 } },
    { id: 'x-post', group: 'X', name: 'Post 16:9', w: 1600, h: 900 },
    { id: 'x-header', group: 'X', name: 'Header 3:1', w: 1500, h: 500 },
    { id: 'x-profile', group: 'X', name: 'Profile picture', w: 400, h: 400, circle: true },
    { id: 'pfp', group: 'All platforms', name: 'Profile picture 1:1', w: 1080, h: 1080, circle: true },
    { id: 'free', group: 'Free', name: 'Window', w: 0, h: 0 }
  ];
  App.platform = function (id) { return App.PLATFORMS.filter(function (p) { return p.id === id; })[0] || App.PLATFORMS[0]; };

  App.LIGHTS = [
    { id: 'morning', name: 'Morning', az: -65, el: 20, i: 1.15, k: 4200, fill: 0.55, sky: '#cfe0ff', gnd: '#f1dfc0', soft: 1 },
    { id: 'noon', name: 'Noon', az: 32, el: 55, i: 0.85, k: 6500, fill: 0.4, sky: '#e6f0ff', gnd: '#efe6d2', soft: 1 },
    { id: 'golden', name: 'Golden hour', az: -50, el: 14, i: 1.45, k: 3400, fill: 0.62, sky: '#ffd9a8', gnd: '#e9c9a0', soft: 1 },
    { id: 'blue', name: 'Blue hour', az: 25, el: 6, i: 0.35, k: 9000, fill: 0.75, sky: '#8ea4e8', gnd: '#5d6aa6', soft: 2 },
    { id: 'night', name: 'Lower Wacker night', az: -20, el: 38, i: 0.16, k: 2600, fill: 0.5, sky: '#9a8abc', gnd: '#4a3f5c', soft: 1, spot: { on: true, at: 'item', cone: 40, i: 1.7, color: '#ffb457' } },
    { id: 'studio', name: 'Studio', az: -38, el: 46, i: 1.0, k: 5600, fill: 0.85, sky: '#ffffff', gnd: '#f1e9d8', soft: 3 }
  ];
  App.FILTERS = [
    { id: 0, name: 'None', c: '#ffffff' }, { id: 1, name: 'Warm', c: '#ffd9a0' }, { id: 2, name: 'Cool', c: '#bcdcf7' },
    { id: 3, name: 'Newsprint', c: '#e8dec2' }, { id: 4, name: 'B&W', c: '#b4b4b4' }, { id: 5, name: 'Faded film', c: '#d9cfc0' },
    { id: 6, name: 'Chicago night', c: '#2f8a92' }, { id: 7, name: 'Pop', c: '#ff8fb1' }
  ];
  var SHADOW_SIZES = [2048, 1024, 512, 256];

  /* ---------- state ---------- */
  var uid = 1;
  function nid(p) { return p + (Date.now().toString(36)) + (uid++).toString(36); }
  App.nid = nid;

  function defaultLook() { return { filter: 0, strength: 1, brightness: 0, contrast: 1, saturation: 1, vignette: 0, vigStyle: 0, grain: 0.15 }; }
  function lightFrom(p) {
    var L = { preset: p.id, az: p.az, el: p.el, i: p.i, k: p.k, fill: p.fill, sky: p.sky, gnd: p.gnd, soft: p.soft, spot: { on: false, at: 'item', cone: 38, i: 1.4, color: '#ffffff' } };
    if (p.spot) L.spot = { on: p.spot.on, at: p.spot.at, cone: p.spot.cone, i: p.spot.i, color: p.spot.color };
    return L;
  }
  App.lightFrom = lightFrom;
  function newItem(kind, o) {
    var it = { id: nid('i'), kind: kind, x: 0, y: 0, z: 0, yaw: 0, tilt: 0, scale: 1, flip: false };
    if (kind === 'dibs' || kind === 'wacker') it.pose = DP.defaultPose();
    for (var k in o) it[k] = o[k];
    return it;
  }
  function starterScene() {
    var wave = DP.poseFromPreset('wave');
    return {
      v: 1, name: 'Starter scene',
      set: { id: 'hotdog', color: '#fbf6ea' },
      items: [
        { id: 'i-dibs', kind: 'dibs', x: -0.95, y: 0, z: 0.3, yaw: 10, tilt: 0, scale: 1, flip: false, pose: wave },
        { id: 'i-wacker', kind: 'wacker', x: 1.0, y: 0, z: -0.2, yaw: -8, tilt: 0, scale: 1.05, flip: false, pose: DP.defaultPose() }
      ],
      uploads: {},
      cam: { tx: 0.05, ty: 1.2, tz: 0, yaw: 0.04, pitch: 0.13, dist: 5.4, roll: 0, mode: 'orbit' },
      lens: { mm: 35, fnum: 2.8, focus: { mode: 'item', id: 'i-dibs', dist: 5.4, point: [0, 1, 0] }, exposure: 0, grid: false },
      light: lightFrom(App.LIGHTS[2]),
      look: defaultLook(),
      stickers: [],
      frame: { platform: 'ig-post', style: 'none', text: '', scale: 1, safe: false }
    };
  }
  App.starterScene = starterScene;
  App.defaultLook = defaultLook;

  /* make any loaded scene safe: fill gaps, clamp numbers, drop unknown things */
  function num(v, d, lo, hi) { v = typeof v === 'number' && isFinite(v) ? v : d; return Math.max(lo, Math.min(hi, v)); }
  function str(v, d, n) { return typeof v === 'string' ? v.slice(0, n || 200) : d; }
  App.clean = function (s) {
    var d = starterScene(), o = {};
    if (!s || typeof s !== 'object') return d;
    o.v = 1; o.name = str(s.name, 'Scene', 60);
    o.set = { id: DP.SET_INFO[s.set && s.set.id] ? s.set.id : 'sweep', color: /^#[0-9a-f]{6}$/i.test(s.set && s.set.color) ? s.set.color : '#fbf6ea' };
    o.uploads = {};
    var ups = s.uploads || {};
    Object.keys(ups).slice(0, 40).forEach(function (k) {
      var u = ups[k];
      if (u && typeof u.data === 'string' && /^data:image\/(png|jpeg|webp|svg\+xml|gif)[;,]/.test(u.data)) o.uploads[k.replace(/[^\w-]/g, '').slice(0, 40)] = { name: str(u.name, 'Picture', 60), data: u.data };
    });
    o.items = [];
    (Array.isArray(s.items) ? s.items : []).slice(0, 60).forEach(function (it) {
      if (!it || typeof it.kind !== 'string') return;
      var k = it.kind;
      var okKind = k === 'dibs' || k === 'wacker' || k === 'dibsTrain' || k === 'wackerFly' ||
        (k.indexOf('symbol:') === 0 && A.symbols[k.slice(7)]) || (k.indexOf('upload:') === 0 && o.uploads[k.slice(7)]);
      if (!okKind) return;
      var n = { id: str(it.id, nid('i'), 40).replace(/[^\w-]/g, ''), kind: k, x: num(it.x, 0, -40, 40), y: num(it.y, 0, -2, 10), z: num(it.z, 0, -40, 40), yaw: num(it.yaw, 0, -360, 360), tilt: num(it.tilt, 0, -60, 60), scale: num(it.scale, 1, 0.1, 6), flip: !!it.flip };
      if (k === 'dibs' || k === 'wacker') {
        var p = it.pose || {}, dp = DP.defaultPose();
        n.pose = { preset: str(p.preset, 'stand', 20), head: num(p.head, 0, -60, 60), wingA: num(p.wingA, 0, 0, 170), wingB: num(p.wingB, 0, 0, 170), lean: num(p.lean, 0, -40, 40), bend: num(p.bend, 0, -40, 40), hop: num(p.hop, 0, 0, 1), look: num(p.look, 0, -1, 1) | 0, expr: (p.expr === 'happy' || p.expr === 'wink') ? p.expr : 'open', color: Math.max(0, Math.min(DP.DIBS_COLORS.length - 1, (p.color | 0))) };
        if (k === 'wacker') n.pose.color = 0;
      }
      o.items.push(n);
    });
    var c = s.cam || {};
    o.cam = { tx: num(c.tx, d.cam.tx, -60, 60), ty: num(c.ty, d.cam.ty, -5, 60), tz: num(c.tz, d.cam.tz, -60, 60), yaw: num(c.yaw, d.cam.yaw, -20, 20), pitch: num(c.pitch, d.cam.pitch, -1.4, 1.5), dist: num(c.dist, d.cam.dist, 0.5, 60), roll: num(c.roll, 0, -30, 30), mode: c.mode === 'fly' ? 'fly' : 'orbit' };
    var l = s.lens || {}, f = l.focus || {};
    o.lens = { mm: num(l.mm, 35, 14, 200), fnum: num(l.fnum, 2.8, 1.4, 22.4), exposure: num(l.exposure, 0, -2, 2), grid: !!l.grid,
      focus: { mode: (f.mode === 'point' || f.mode === 'dist') ? f.mode : 'item', id: str(f.id, '', 40), dist: num(f.dist, 5, 0.5, 60), point: Array.isArray(f.point) && f.point.length === 3 ? f.point.map(function (v) { return num(v, 0, -80, 80); }) : [0, 1, 0] } };
    var g = s.light || {}, ld = d.light, sp = g.spot || {};
    o.light = { preset: str(g.preset, 'custom', 20), az: num(g.az, ld.az, -180, 180), el: num(g.el, ld.el, 1, 90), i: num(g.i, ld.i, 0, 4), k: num(g.k, ld.k, 1500, 12000), fill: num(g.fill, ld.fill, 0, 2),
      sky: /^#[0-9a-f]{6}$/i.test(g.sky) ? g.sky : '#e6f0ff', gnd: /^#[0-9a-f]{6}$/i.test(g.gnd) ? g.gnd : '#efe6d2', soft: Math.max(0, Math.min(3, num(g.soft, 1, 0, 3) | 0)),
      spot: { on: !!sp.on, at: sp.at === 'camera' ? 'camera' : 'item', cone: num(sp.cone, 38, 8, 80), i: num(sp.i, 1.4, 0, 6), color: /^#[0-9a-f]{6}$/i.test(sp.color) ? sp.color : '#ffffff' } };
    var k2 = s.look || {};
    o.look = { filter: Math.max(0, Math.min(7, num(k2.filter, 0, 0, 7) | 0)), strength: num(k2.strength, 1, 0, 1), brightness: num(k2.brightness, 0, -1, 1), contrast: num(k2.contrast, 1, 0.5, 1.5), saturation: num(k2.saturation, 1, 0, 2), vignette: num(k2.vignette, 0, 0, 1), vigStyle: k2.vigStyle ? 1 : 0, grain: num(k2.grain, 0.15, 0, 1) };
    o.stickers = [];
    (Array.isArray(s.stickers) ? s.stickers : []).slice(0, 60).forEach(function (st) {
      if (!st || typeof st !== 'object') return;
      var t = st.type;
      if (t !== 'bubble' && t !== 'thought' && t !== 'label' && t !== 'img') return;
      var n = { id: str(st.id, nid('s'), 40).replace(/[^\w-]/g, ''), type: t, x: num(st.x, 0.5, -0.5, 1.5), y: num(st.y, 0.5, -0.5, 1.5), w: num(st.w, 0.3, 0.05, 1.6), r: num(st.r, 0, -12, 12) };
      if (t === 'img') { n.src = str(st.src, '', 80); if (!n.src) return; if (n.src.indexOf('upload:') === 0 && !o.uploads[n.src.slice(7)]) return; }
      else { n.text = str(st.text, '', 240); n.color = /^#[0-9a-f]{6}$/i.test(st.color) ? st.color : '#ffffff'; n.tail = ['bl', 'br', 'tl', 'tr', 'none'].indexOf(st.tail) >= 0 ? st.tail : 'bl'; n.bg = ['tape', 'pink', 'blue', 'yellow', 'none'].indexOf(st.bg) >= 0 ? st.bg : 'tape'; if (/^#[0-9a-f]{6}$/i.test(st.ink)) n.ink = st.ink; }
      o.stickers.push(n);
    });
    var fr = s.frame || {};
    o.frame = { platform: App.platform(fr.platform).id, style: DP.FRAMES.some(function (x) { return x.id === fr.style; }) ? fr.style : 'none', text: str(fr.text, '', 60), scale: fr.scale === 2 ? 2 : 1, safe: !!fr.safe };
    return o;
  };

  var state = App.state = null;

  /* ---------- three.js setup ---------- */
  var renderer, scene, camera, post, rig, sun, hemi, spot, ring, setObj = null, setId = null, overlay;
  var gl = $('gl'), ov = $('ov'), frameBox = $('frameBox'), stage = $('stage');
  var frame = { w: 100, h: 100, aspect: 1, pr: 1 };
  var dirty = true, interactive = false, interTimer = 0, saveTimer = 0, lastT = 0;
  var raycaster = new THREE.Raycaster();
  var tmpV = new THREE.Vector3();

  App.msg = function (t, ms) {
    var m = $('msg'); m.textContent = t; m.classList.add('on');
    clearTimeout(App._mt); App._mt = setTimeout(function () { m.classList.remove('on'); }, ms || 3200);
  };

  function initGL() {
    try {
      renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    } catch (e) { renderer = null; }
    if (!renderer || !renderer.capabilities.isWebGL2) {
      App.msg('This browser could not start 3D. Try a recent Chrome, Safari or Firefox.', 20000);
      return false;
    }
    DP.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xfbf6ea, 1);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
    post = new DP.Post(renderer);
    rig = App.rig = new DP.Rig(camera);

    sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.castShadow = true;
    sun.shadow.camera.left = -18; sun.shadow.camera.right = 18; sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -18;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 150;
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
    sun.target.position.set(0, 0.5, -4);
    scene.add(sun, sun.target);
    hemi = new THREE.HemisphereLight(0xffffff, 0xd8c8a8, 1);
    scene.add(hemi);
    spot = new THREE.SpotLight(0xffffff, 0, 0, 0.6, 0.45, 0);
    spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0006; spot.shadow.normalBias = 0.02;
    spot.visible = false;
    scene.add(spot, spot.target);

    ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: 0x2a2350, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 5;
    scene.add(ring);

    gl.addEventListener('webglcontextlost', function (e) { e.preventDefault(); App.msg('The graphics were reset by your device. Reload the page to continue.', 30000); });
    return true;
  }

  /* ---------- layout ---------- */
  App.layout = function () {
    var r = stage.getBoundingClientRect(), W = r.width, H = r.height;
    var phone = window.matchMedia('(max-width:820px)').matches;
    var padT = phone ? 26 : 34, padB = phone ? 118 : 138, padS = phone ? 14 : 22;
    var aw = Math.max(60, W - padS * 2), ah = Math.max(60, H - padT - padB);
    var p = App.platform(state.frame.platform);
    var asp = p.w ? p.w / p.h : aw / ah;
    var w, h;
    if (aw / ah > asp) { h = ah; w = h * asp; } else { w = aw; h = w / asp; }
    w = Math.floor(w); h = Math.floor(h);
    frame.w = w; frame.h = h; frame.aspect = w / h;
    frame.x = Math.round((W - w) / 2); frame.y = Math.round(padT + (ah - h) / 2);
    frameBox.style.left = frame.x + 'px'; frameBox.style.top = frame.y + 'px';
    frameBox.style.width = w + 'px'; frameBox.style.height = h + 'px';
    frame.pr = Math.min(window.devicePixelRatio || 1, COARSE ? 1.5 : 2);
    if (renderer) renderer.setPixelRatio(frame.pr), renderer.setSize(w, h, false);
    var op = Math.min(window.devicePixelRatio || 1, 2);
    overlay.size(Math.round(w * op), Math.round(h * op));
    overlay.render();
    camera.aspect = frame.aspect;
    applyLens();
    App.updateGuides();
    $('frameInfo').textContent = p.group + ', ' + p.name + (p.w ? ' (' + p.w + ' x ' + p.h + ')' : '');
    App.invalidate();
  };

  App.updateGuides = function () {
    var p = App.platform(state.frame.platform);
    $('gridLines').classList.toggle('on', !!state.lens.grid);
    var sz = $('safeZones');
    sz.classList.toggle('on', !!(p.safe && state.frame.safe));
    if (p.safe && !sz.firstChild) {
      sz.innerHTML = '<i style="left:0;right:0;top:0;height:13%"></i><i style="left:0;right:0;bottom:0;height:20%"></i><i style="right:0;top:13%;bottom:20%;width:13%"></i>';
    }
    $('circleGuide').classList.toggle('on', !!p.circle);
    var bs = $('bannerSafe');
    if (p.banner && state.frame.safe) {
      var bw = p.banner.w / p.w, bh = p.banner.h / p.h;
      bs.style.cssText = 'inset:auto;left:' + ((1 - bw) / 2 * 100) + '%;top:' + ((1 - bh) / 2 * 100) + '%;width:' + bw * 100 + '%;height:' + bh * 100 + '%';
      bs.innerHTML = '<b>Safe area</b>'; bs.classList.add('on');
    } else bs.classList.remove('on');
  };

  /* ---------- lens ---------- */
  function applyLens() {
    camera.fov = DP.fovFor(state.lens.mm, frame.aspect);
    camera.aspect = frame.aspect;
    camera.updateProjectionMatrix();
  }
  App.applyLens = applyLens;

  function kelvin(k) {
    var t = k / 100, r, g, b;
    r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = t >= 66 ? 255 : (t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307);
    function c(v) { return Math.max(0, Math.min(255, v)) / 255; }
    return new THREE.Color().setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
  }
  App.kelvinCss = function (k) { var c = kelvin(k); return '#' + c.getHexString(THREE.SRGBColorSpace); };

  /* ---------- lights ---------- */
  App.applyLight = function () {
    var L = state.light;
    var az = L.az * D2R, el = L.el * D2R;
    var d = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    sun.position.copy(sun.target.position).addScaledVector(d, 70);
    sun.color.copy(kelvin(L.k));
    sun.intensity = L.i * Math.PI;
    var ms = SHADOW_SIZES[Math.max(0, Math.min(3, L.soft | 0))];
    if (COARSE) ms = Math.min(ms, 1024);
    if (sun.shadow.mapSize.x !== ms) {
      sun.shadow.mapSize.set(ms, ms);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    hemi.color.set(L.sky); hemi.groundColor.set(L.gnd);
    hemi.intensity = L.fill * Math.PI;
    var sp = L.spot;
    if (spot.visible !== !!sp.on) { spot.visible = !!sp.on; }
    spot.color.set(sp.color);
    spot.intensity = sp.i * Math.PI;
    spot.angle = Math.max(0.1, sp.cone * D2R / 2);
    App.updateSpot();
    App.invalidate();
  };
  App.updateSpot = function () {
    if (!spot.visible) return;
    var sp = state.light.spot;
    var it = App.sel ? findItem(App.sel) : (state.items[0] || null);
    if (sp.at === 'camera') {
      spot.position.copy(camera.position); spot.target.position.set(rig.s.tx, rig.s.ty, rig.s.tz);
    } else if (it) {
      spot.position.set(it.x + 0.4, it.y + 5.2, it.z + 1.6); spot.target.position.set(it.x, it.y + 0.5, it.z);
    } else { spot.position.set(0, 6, 2); spot.target.position.set(0, 0, 0); }
    spot.target.updateMatrixWorld(); spot.updateMatrixWorld();
  };

  /* ---------- sets ---------- */
  var setSeq = 0;
  App.setBackdrop = function (id, color) {
    state.set.id = id; if (color) state.set.color = color;
    var seq = ++setSeq;
    return DP.buildSet(id, state.set.color).then(function (res) {
      if (seq !== setSeq) { res.dispose(); return; }
      if (setObj) { scene.remove(setObj.group); setObj.dispose(); }
      setObj = res; scene.add(res.group);
      App.invalidate();
    });
  };
  App.setBackdropColor = function (hex) {
    state.set.color = hex;
    if (setObj && setObj.setColor) setObj.setColor(hex);
    App.invalidate(); App.save();
  };

  /* ---------- items ---------- */
  function findItem(id) { for (var i = 0; i < state.items.length; i++) if (state.items[i].id === id) return state.items[i]; return null; }
  App.findItem = findItem;
  App.addItemObj = function (it) {
    return DP.buildItem(it, state.uploads).then(function (o) {
      if (!findItem(it.id)) { o.dispose(); return null; }
      if (App.objs[it.id]) { scene.remove(App.objs[it.id].root); App.objs[it.id].dispose(); }
      App.objs[it.id] = o; scene.add(o.root);
      App.updateRing(); App.invalidate();
      if (App.ui) App.ui.itemsChanged();
      return o;
    }, function () { App.msg('That picture could not be loaded.'); });
  };
  App.removeItem = function (id) {
    var i, o = App.objs[id];
    for (i = 0; i < state.items.length; i++) if (state.items[i].id === id) { state.items.splice(i, 1); break; }
    if (o) { scene.remove(o.root); o.dispose(); delete App.objs[id]; }
    if (App.sel === id) App.sel = null;
    if (state.lens.focus.mode === 'item' && state.lens.focus.id === id) { state.lens.focus = { mode: 'dist', id: '', dist: App.focusDistance(), point: [0, 1, 0] }; }
    App.updateRing(); App.invalidate(); App.save();
    if (App.ui) App.ui.itemsChanged();
  };
  /* a spot on the floor in front of the middle of the view, a little toward the camera */
  App.floorSpot = function () {
    var q = rig.s, hx = Math.sin(q.yaw), hz = Math.cos(q.yaw);
    var k = rig.mode === 'fly' ? 0 : 1.1;
    var x = q.tx + hx * k, z = q.tz + hz * k;
    if (rig.mode === 'fly') { var d = Math.min(q.dist, 6); x = camera.position.x - hx * d; z = camera.position.z - hz * d; }
    return new THREE.Vector3(x, 0, z);
  };
  App.addItem = function (kind, extra) {
    var p = App.floorSpot();
    var it = newItem(kind, { x: Math.round(p.x * 20) / 20, z: Math.round(p.z * 20) / 20 });
    // do not stack exactly on another item
    var tries = 0;
    while (tries++ < 8 && state.items.some(function (o) { return Math.abs(o.x - it.x) < 0.25 && Math.abs(o.z - it.z) < 0.25; })) { it.x += 0.45; }
    if (extra) for (var k in extra) it[k] = extra[k];
    state.items.push(it);
    App.sel = it.id;
    return App.addItemObj(it).then(function () { App.save(); if (App.ui) { App.ui.itemsChanged(); App.ui.selectionChanged(); } return it; });
  };
  App.duplicateItem = function (id) {
    var src = findItem(id); if (!src) return;
    var it = JSON.parse(JSON.stringify(src)); it.id = nid('i'); it.x += 0.5; it.z += 0.15;
    state.items.push(it); App.sel = it.id;
    App.addItemObj(it).then(function () { App.save(); if (App.ui) { App.ui.itemsChanged(); App.ui.selectionChanged(); } });
  };
  App.applyItem = function (id) {
    var it = findItem(id), o = App.objs[id];
    if (it && o) { o.apply(it); if (id === App.sel) App.updateRing(); }
    App.invalidate();
  };
  App.select = function (id) {
    App.sel = id; App.updateRing();
    if (App.ui) App.ui.selectionChanged();
    App.invalidate();
  };
  App.updateRing = function () {
    var it = App.sel && findItem(App.sel), o = it && App.objs[App.sel];
    if (!o) { ring.visible = false; return; }
    var r = Math.max(0.45, (o.w || 1) * 0.62) * it.scale;
    ring.scale.set(r, r, 1); ring.position.set(it.x, 0.03, it.z); ring.visible = true;
  };
  function pickAt(cx, cy) {
    var r = gl.getBoundingClientRect();
    var ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(ndc, camera);
    var best = null, bd = Infinity;
    Object.keys(App.objs).forEach(function (id) {
      var o = App.objs[id]; o.root.updateMatrixWorld(true);
      var hits = raycaster.intersectObjects(o.hitMeshes(), false);
      for (var i = 0; i < hits.length; i++) {
        if (DP.maskHit(hits[i])) { if (hits[i].distance < bd) { bd = hits[i].distance; best = id; } break; }
      }
    });
    return best;
  }
  /* what is under the pointer, for tap to focus: a world point */
  function worldPointAt(cx, cy) {
    var r = gl.getBoundingClientRect();
    var ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    var best = null, bd = Infinity;
    var list = [];
    Object.keys(App.objs).forEach(function (id) { App.objs[id].root.updateMatrixWorld(true); list = list.concat(App.objs[id].hitMeshes()); });
    raycaster.intersectObjects(list, false).forEach(function (h) { if (h.distance < bd && DP.maskHit(h)) { bd = h.distance; best = h.point.clone(); } });
    if (setObj) {
      setObj.group.updateMatrixWorld(true);
      var hits = raycaster.intersectObject(setObj.group, true);
      for (var i = 0; i < hits.length; i++) {
        var h = hits[i];
        if (h.distance >= bd) break;
        var cv = h.object.userData && h.object.userData.cv;
        if (cv && h.uv) {
          var px = cv.getContext('2d').getImageData(Math.min(cv.width - 1, Math.floor(h.uv.x * cv.width)), Math.min(cv.height - 1, Math.floor((1 - h.uv.y) * cv.height)), 1, 1).data[3];
          if (px < 128) continue;
        }
        bd = h.distance; best = h.point.clone(); break;
      }
    }
    return best;
  }

  /* ---------- focus ---------- */
  App.focusPoint = function () {
    var f = state.lens.focus;
    if (f.mode === 'item') {
      var it = findItem(f.id), o = it && App.objs[f.id];
      if (it && o) return new THREE.Vector3(it.x, it.y + o.h * it.scale * 0.62, it.z);
      return null;
    }
    if (f.mode === 'point') return new THREE.Vector3(f.point[0], f.point[1], f.point[2]);
    return null;
  };
  App.focusDistance = function () {
    var p = App.focusPoint();
    if (!p) return Math.max(0.5, state.lens.focus.dist);
    camera.updateMatrixWorld(true);
    var fw = tmpV.set(0, 0, -1).applyQuaternion(camera.quaternion);
    var d = p.clone().sub(camera.position).dot(fw);
    return Math.max(0.5, d);
  };
  App.setFocusPoint = function (p) {
    state.lens.focus = { mode: 'point', id: '', dist: 5, point: [p.x, p.y, p.z] };
    state.lens.focus.dist = App.focusDistance();
    App.showReticle(); App.invalidate(); App.save();
    if (App.ui) App.ui.cameraChanged();
  };
  App.setFocusDist = function (d) {
    state.lens.focus = { mode: 'dist', id: '', dist: d, point: [0, 1, 0] };
    App.showReticle(); App.invalidate(); App.save();
  };
  App.focusOnItem = function (id) {
    state.lens.focus = { mode: 'item', id: id, dist: 5, point: [0, 1, 0] };
    state.lens.focus.dist = App.focusDistance();
    App.showReticle(); App.invalidate(); App.save();
    if (App.ui) App.ui.cameraChanged();
  };
  var retTimer = 0;
  App.showReticle = function () {
    var el = $('reticle');
    el.classList.add('on'); App.positionReticle();
    clearTimeout(retTimer); retTimer = setTimeout(function () { el.classList.remove('on'); }, 2400);
  };
  App.positionReticle = function () {
    var el = $('reticle'); if (!el.classList.contains('on')) return;
    var p = App.focusPoint(), x = 0.5, y = 0.5;
    if (p) {
      camera.updateMatrixWorld(true);
      var v = p.clone().project(camera);
      x = (v.x + 1) / 2; y = (1 - v.y) / 2;
    }
    el.style.left = (x * frame.w) + 'px'; el.style.top = (y * frame.h) + 'px';
  };

  /* ---------- drawing ---------- */
  App.invalidate = function () { dirty = true; };
  App.bump = function () {
    interactive = true; dirty = true;
    clearTimeout(interTimer);
    interTimer = setTimeout(function () { interactive = false; dirty = true; }, 220);
  };

  function lensParams(w, h, taps, samples) {
    var s = DP.sensorFor(w / h);
    return {
      width: w, height: h, samples: samples, taps: taps,
      focalMM: state.lens.mm, fnum: state.lens.fnum, sensorH: s.h, unitMM: UNIT_MM,
      focus: App.focusDistance(), exposure: state.lens.exposure, look: state.look,
      clear: setObj ? setObj.sky : 0xfbf6ea, maxBlur: 0.045
    };
  }

  function renderPreview() {
    if (!renderer || !setObj) return;
    applyLens();
    rig.apply();
    App.updateSpot();
    var w = renderer.domElement.width, h = renderer.domElement.height;
    var taps = interactive ? (COARSE ? 14 : 22) : (COARSE ? 36 : 56);
    var p = lensParams(w, h, taps, 4);
    p.toScreen = true; p.seed = 0;
    post.render(scene, camera, p);
    App.positionReticle();
    if (App.ui && App.ui.afterRender) App.ui.afterRender();
  }

  function loop(t) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.1, (t - lastT) / 1000 || 0.016); lastT = t;
    if (rig && rig.mode === 'fly') {
      if (rig.update(dt)) { App.bump(); if (App.ui) App.ui.cameraMoved(); }
    }
    if (dirty) { dirty = false; renderPreview(); }
  }

  /* render at any size into a canvas (capture, thumbnails). withOverlay draws stickers and frame on top. */
  App.renderToCanvas = function (w, h, opts) {
    opts = opts || {};
    var prevRing = ring.visible, prevAspect = camera.aspect;
    ring.visible = false;
    var samples = w * h > 2700000 ? 0 : 4;
    DP.setA2C(samples > 0);
    camera.aspect = w / h; camera.fov = DP.fovFor(state.lens.mm, w / h); camera.updateProjectionMatrix();
    rig.apply(); App.updateSpot();
    var p = lensParams(w, h, opts.taps || 80, samples);
    p.toScreen = false; p.seed = 3;
    var buf = post.render(scene, camera, p);
    ring.visible = prevRing; DP.setA2C(true);
    camera.aspect = prevAspect; applyLens();
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), row = w * 4, y;
    for (y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    ctx.putImageData(img, 0, 0);
    if (opts.overlay !== false) overlay.paint(ctx, w, h);
    post.free();
    dirty = true;
    return cv;
  };

  App.exportSize = function () {
    var p = App.platform(state.frame.platform), w, h;
    if (p.w) { w = p.w; h = p.h; }
    else { var long = 1600; if (frame.w >= frame.h) { w = long; h = Math.round(long * frame.h / frame.w); } else { h = long; w = Math.round(long * frame.w / frame.h); } }
    var sc = state.frame.scale || 1;
    w *= sc; h *= sc;
    var cap = 4096, m = Math.max(w, h);
    if (m > cap) { w = w * cap / m; h = h * cap / m; }
    return { w: Math.round(w), h: Math.round(h) };
  };

  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  App.takePhoto = function () {
    var btn = $('shutter'); btn.disabled = true;
    var fl = $('flash');
    if (!(window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches)) { fl.classList.add('go'); setTimeout(function () { fl.classList.remove('go'); }, 110); }
    App.msg('Taking photo...', 6000);
    setTimeout(function () {
      var sz = App.exportSize(), cv;
      try { cv = App.renderToCanvas(sz.w, sz.h, { taps: 88 }); }
      catch (e) { btn.disabled = false; App.msg('The photo could not be made at this size. Try the 1x size.', 6000); return; }
      cv.toBlob(function (blob) {
        btn.disabled = false;
        $('msg').classList.remove('on');
        if (!blob) { App.msg('The photo could not be saved.'); return; }
        var name = 'dibs-' + state.frame.platform + '-' + stamp() + '.png';
        var th = DP.thumb(cv, 220);
        var rec = { id: nid('p'), time: Date.now(), blob: blob, thumb: th, name: name, w: sz.w, h: sz.h };
        DP.Store.put('roll', rec).then(function () { return DP.Store.all('roll'); }).then(function (all) {
          all.sort(function (a, b) { return b.time - a.time; });
          all.slice(12).forEach(function (o) { DP.Store.del('roll', o.id); });
          if (App.ui) App.ui.rollChanged();
        });
        App.showResult(rec);
      }, 'image/png');
    }, 30);
  };

  /* ---------- scene save and load ---------- */
  App.serialize = function () {
    var s = JSON.parse(JSON.stringify({ v: 1, name: state.name, set: state.set, items: state.items, uploads: state.uploads, lens: state.lens, light: state.light, look: state.look, stickers: state.stickers, frame: state.frame }));
    s.cam = rig.get();
    return s;
  };
  App.save = function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var s = App.serialize();
      DP.Store.put('auto', { id: 'current', time: Date.now(), data: s });
    }, 700);
  };
  window.addEventListener('pagehide', function () { if (state) DP.Store.put('auto', { id: 'current', time: Date.now(), data: App.serialize() }); });

  App.loadState = function (raw) {
    var s = App.clean(raw);
    // clear
    Object.keys(App.objs).forEach(function (id) { scene.remove(App.objs[id].root); App.objs[id].dispose(); });
    App.objs = {}; App.sel = null;
    state = App.state = s;
    rig.set(s.cam);
    overlay.st = s; overlay.selected = null;
    applyLens();
    App.layout();
    App.applyLight();
    var jobs = [App.setBackdrop(s.set.id, s.set.color)];
    s.items.forEach(function (it) { jobs.push(App.addItemObj(it)); });
    if (App.ui) App.ui.stateLoaded();
    return Promise.all(jobs).then(function () { App.updateRing(); App.invalidate(); if (App.ui) { App.ui.itemsChanged(); App.ui.stateLoaded(); } });
  };

  /* ---------- boot ---------- */
  function wirePointer() {
    var hooks = {
      pick: function (cx, cy) { return pickAt(cx, cy); },
      drag: dragHandler,
      tap: function (cx, cy, picked) {
        if (App.tapFocus) {
          var p = worldPointAt(cx, cy);
          if (p) { App.setFocusPoint(p); App.tapFocus = false; $('msg').classList.remove('on'); if (App.ui) App.ui.tapFocusChanged(); }
          else App.msg('Tap on the scene to pick what is sharp.');
          return;
        }
        if (overlay.selected) overlay.select(null);
        if (!picked) App.select(null);
      },
      changed: function (moving) { if (moving) { App.bump(); App.save(); if (App.ui) App.ui.cameraMoved(); } else { App.invalidate(); App.save(); } },
      height: function () { return frame.h; }
    };
    // stickers get the pointer first
    var stickerPtrs = {};
    ov.addEventListener('pointerdown', function (e) {
      if (overlay.pointerDown(e, ov.getBoundingClientRect())) {
        stickerPtrs[e.pointerId] = 1; ov.setPointerCapture(e.pointerId); e.stopImmediatePropagation(); e.preventDefault();
      }
    });
    ov.addEventListener('pointermove', function (e) { if (stickerPtrs[e.pointerId]) { overlay.pointerMove(e, ov.getBoundingClientRect()); e.stopImmediatePropagation(); } });
    function up(e) { if (stickerPtrs[e.pointerId]) { delete stickerPtrs[e.pointerId]; overlay.pointerUp(e); e.stopImmediatePropagation(); } }
    ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
    new DP.Gestures(ov, rig, hooks);
  }

  var dragState = null;
  function dragHandler(phase, id, cx, cy) {
    var it = findItem(id); if (!it && phase !== 'end') return;
    function planePoint() {
      var r = gl.getBoundingClientRect();
      var ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      camera.updateMatrixWorld(true);
      raycaster.setFromCamera(ndc, camera);
      var pt = new THREE.Vector3();
      return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -it.y), pt) ? pt : null;
    }
    if (phase === 'start') {
      if (App.sel !== id) App.select(id);
      var p = planePoint();
      dragState = p ? { ox: it.x - p.x, oz: it.z - p.z } : null;
    } else if (phase === 'move' && dragState) {
      var q = planePoint(); if (!q) return;
      it.x = Math.max(-30, Math.min(30, q.x + dragState.ox)); it.z = Math.max(-30, Math.min(20, q.z + dragState.oz));
      App.applyItem(id); App.bump();
      if (App.ui) App.ui.itemMoved();
    } else if (phase === 'end') { dragState = null; App.save(); }
  }

  App.boot = function () {
    if (!initGL()) { return; }
    overlay = App.overlay = new DP.Overlay(ov, { stickers: [], frame: {}, uploads: {} }, {
      changed: function () { App.save(); },
      committed: function () { App.save(); if (App.ui) App.ui.stickersChanged(); },
      selected: function (id) { if (App.ui) App.ui.stickerSelected(id); }
    });
    DP.onOverlayAssets = function () { overlay.render(); };
    DP.onChange = function () { App.invalidate(); };
    wirePointer();
    state = App.state = starterScene();
    overlay.st = state;
    var ro = window.ResizeObserver ? new ResizeObserver(function () { App.layout(); }) : null;
    if (ro) ro.observe(stage); else window.addEventListener('resize', App.layout);
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
    requestAnimationFrame(loop);

    var fontsP = (document.fonts && document.fonts.load) ? Promise.all([document.fonts.load('700 20px Lexend'), document.fonts.load('400 16px Lexend')]).catch(function () {}) : Promise.resolve();
    fontsP.then(function () { return DP.Store.get('auto', 'current'); }).then(function (rec) {
      var raw = rec && rec.data ? rec.data : starterScene();
      return App.loadState(raw);
    }).then(function () {
      if (App.ui) App.ui.ready();
      document.body.setAttribute('data-ready', '1');
      overlay.render();
    }).catch(function (e) {
      console.warn('boot', e);
      return App.loadState(starterScene()).then(function () { document.body.setAttribute('data-ready', '1'); });
    });
  };

  /* ---------- keyboard ---------- */
  function typing(e) { var t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) && t.type !== 'range'; }
  function onKey(e) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (k === 'escape') { if (App.ui) App.ui.closeModals(); return; }
    if (document.querySelector('.modal:not([hidden])')) return;
    if (rig.mode === 'fly' && 'wasdqe'.indexOf(k) >= 0 && k.length === 1) { rig.keys[k] = true; rig.keys.shift = e.shiftKey; e.preventDefault(); return; }
    if (k === 'delete' || k === 'backspace') {
      if (overlay.selected) { overlay.remove(overlay.selected); e.preventDefault(); return; }
      if (App.sel) { App.removeItem(App.sel); e.preventDefault(); }
      return;
    }
    if (k.indexOf('arrow') === 0) {
      var step = e.shiftKey ? 0.5 : 0.1;
      if (e.target && e.target.type === 'range') return;
      var it = App.sel && findItem(App.sel);
      if (it) {
        var yaw = rig.s.yaw, fwd = [-Math.sin(yaw), -Math.cos(yaw)], right = [Math.cos(yaw), -Math.sin(yaw)];
        var dx = 0, dz = 0;
        if (k === 'arrowleft') { dx -= right[0]; dz -= right[1]; } if (k === 'arrowright') { dx += right[0]; dz += right[1]; }
        if (k === 'arrowup') { dx += fwd[0]; dz += fwd[1]; } if (k === 'arrowdown') { dx -= fwd[0]; dz -= fwd[1]; }
        it.x = Math.round((it.x + dx * step) * 100) / 100; it.z = Math.round((it.z + dz * step) * 100) / 100;
        App.applyItem(it.id); App.save(); if (App.ui) App.ui.itemMoved();
      } else {
        if (k === 'arrowleft') rig.rotate(-14, 0); if (k === 'arrowright') rig.rotate(14, 0);
        if (k === 'arrowup') rig.rotate(0, -14); if (k === 'arrowdown') rig.rotate(0, 14);
        App.bump(); App.save();
      }
      e.preventDefault();
    } else if (k === '+' || k === '=') { rig.dolly(0.1); App.bump(); }
    else if (k === '-') { rig.dolly(-0.1); App.bump(); }
  }
  function onKeyUp(e) {
    var k = e.key.toLowerCase();
    if (rig && rig.keys[k]) rig.keys[k] = false;
    if (k === 'shift') rig.keys.shift = false;
  }

  window.addEventListener('DOMContentLoaded', function () { /* ui.js starts boot */ });
})();
