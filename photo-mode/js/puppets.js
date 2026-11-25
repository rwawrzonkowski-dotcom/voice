/* DIBS Photo Mode: paper cutouts and puppets.
   Turns SVG art into textures (never from file URLs, so file:// works), builds die-cut cards with a white
   edge, a cardstock back and a folded stand, and builds Dibs and Wacker as posable paper puppets. */
(function () {
  'use strict';
  var THREE = window.THREEPKG.THREE;
  var DP = window.DP = window.DP || {};
  var A = window.DIBS_ASSETS;

  DP.maxAniso = 4;
  DP.paperMats = [];       // every paper material, so quality changes can reach them
  DP.useA2C = true;

  /* ---------- rasterizing ---------- */
  var imgCache = {};
  function loadImage(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error('image failed')); };
      im.src = src;
    });
  }
  DP.loadImage = loadImage;
  DP.svgToImage = function (svg, w, h) { return svgToImage(svg, w, h); };

  function svgSize(svg) {
    var m = svg.match(/viewBox="\s*([-\d.]+)[ ,]+([-\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)\s*"/);
    if (m) return { w: parseFloat(m[3]), h: parseFloat(m[4]) };
    var w = svg.match(/<svg[^>]*\swidth="([\d.]+)/), h = svg.match(/<svg[^>]*\sheight="([\d.]+)/);
    return { w: w ? parseFloat(w[1]) : 100, h: h ? parseFloat(h[1]) : 100 };
  }
  DP.svgSize = svgSize;

  function svgToImage(svg, pxW, pxH) {
    var tag = svg.match(/<svg\b[^>]*>/)[0];
    var tag2 = tag.replace(/\s(width|height)="[^"]*"/g, '').replace('<svg', '<svg width="' + pxW + '" height="' + pxH + '"');
    var s = svg.replace(tag, tag2);
    if (!/xmlns=/.test(tag2)) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    return loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s));
  }

  /* Draw art into a canvas with a margin, then build the white die-cut silhouette and a small hit mask.
     src is an SVG string or an <img>. frame (optional) = {w,h} units to map to the content box (for puppet parts). */
  var N = 1024, M = 28, R = 17;
  DP.CARD_N = N;
  DP.prepArt = function (src, o) {
    o = o || {};
    var isSvg = typeof src === 'string';
    var nat = isSvg ? svgSize(src) : { w: src.naturalWidth || 512, h: src.naturalHeight || 512 };
    var asp = nat.w / nat.h;
    var cw, ch;
    if (o.square) { cw = ch = N; } else if (asp >= 1) { cw = N; ch = Math.max(64, Math.round((N - 2 * M) / asp) + 2 * M); } else { ch = N; cw = Math.max(64, Math.round((N - 2 * M) * asp) + 2 * M); }
    var iw = cw - 2 * M, ih = ch - 2 * M;
    var p = isSvg ? svgToImage(src, iw, ih) : Promise.resolve(src);
    return p.then(function (img) {
      var art = document.createElement('canvas'); art.width = cw; art.height = ch;
      var c = art.getContext('2d');
      c.drawImage(img, M, M, iw, ih);
      var sil = document.createElement('canvas'); sil.width = cw; sil.height = ch;
      var s = sil.getContext('2d');
      var k, a;
      for (var ring = 0; ring < 2; ring++) {
        var rad = ring ? R * 0.55 : R;
        for (k = 0; k < 20; k++) {
          a = k / 20 * Math.PI * 2;
          s.drawImage(art, Math.cos(a) * rad, Math.sin(a) * rad);
        }
      }
      s.drawImage(art, 0, 0);
      s.globalCompositeOperation = 'source-in';
      s.fillStyle = '#ffffff'; s.fillRect(0, 0, cw, ch);
      // hit mask, 96 px on the long side
      var mw = cw >= ch ? 96 : Math.round(96 * cw / ch), mh = cw >= ch ? Math.round(96 * ch / cw) : 96;
      var mc = document.createElement('canvas'); mc.width = mw; mc.height = mh;
      var mctx = mc.getContext('2d'); mctx.drawImage(sil, 0, 0, mw, mh);
      var d = mctx.getImageData(0, 0, mw, mh).data, alpha = new Uint8Array(mw * mh);
      for (var i = 0; i < alpha.length; i++) alpha[i] = d[i * 4 + 3];
      return { art: art, sil: sil, mask: { w: mw, h: mh, a: alpha }, cw: cw, ch: ch, aspect: asp, nat: nat };
    });
  };

  DP.thumb = function (canvas, px) {
    var t = document.createElement('canvas'), r = canvas.width / canvas.height;
    t.width = r >= 1 ? px : Math.round(px * r); t.height = r >= 1 ? Math.round(px / r) : px;
    t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
    return t.toDataURL('image/png');
  };

  /* ---------- paper materials ---------- */
  var CARD_BACK = 0xe6dcc4;
  function tex(canvas, srgb) {
    var t = new THREE.CanvasTexture(canvas);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = DP.maxAniso;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }
  DP.canvasTexture = tex;
  function paperMat(map, color, side) {
    var m = new THREE.MeshStandardMaterial({ map: map, color: color === undefined ? 0xffffff : color, roughness: 0.96, metalness: 0, alphaTest: 0.5, side: side || THREE.FrontSide });
    m.alphaToCoverage = DP.useA2C;
    m.shadowSide = THREE.DoubleSide;   // thin planes must show up in the shadow pass from either side
    DP.paperMats.push(m);
    return m;
  }
  DP.paperMat = paperMat;
  function depthMat(map) {
    return new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: map, alphaTest: 0.5 });
  }
  DP.setA2C = function (on) {
    DP.useA2C = on;
    DP.paperMats.forEach(function (m) { if (m.alphaToCoverage !== on) { m.alphaToCoverage = on; m.needsUpdate = true; } });
  };
  var planeGeo = new THREE.PlaneGeometry(1, 1);

  /* A layer = art plane + white edge plane + cardstock back plane. Sizes are the content box in world units. */
  DP.makeLayer = function (prep, worldW, worldH, o) {
    o = o || {};
    var g = new THREE.Group();
    var fw = worldW * prep.cw / (prep.cw - 2 * M), fh = worldH * prep.ch / (prep.ch - 2 * M);
    var tArt = tex(prep.art, true), tSil = tex(prep.sil, false);
    var art = new THREE.Mesh(planeGeo, paperMat(tArt));
    art.scale.set(fw, fh, 1); art.position.z = o.z || 0;
    art.receiveShadow = true; art.userData.hit = true;
    var edge = new THREE.Mesh(planeGeo, paperMat(tSil, 0xfffcf4));
    edge.scale.set(fw, fh, 1); edge.position.z = (o.edgeZ !== undefined ? o.edgeZ : -0.02);
    edge.castShadow = true; edge.receiveShadow = true;
    edge.customDepthMaterial = depthMat(tSil);
    var back = new THREE.Mesh(planeGeo, paperMat(tSil, CARD_BACK, THREE.DoubleSide));
    back.scale.set(fw, fh, 1); back.position.z = (o.backZ !== undefined ? o.backZ : -0.04);
    back.receiveShadow = true;
    g.add(back, edge, art);
    g.userData = { prep: prep, fw: fw, fh: fh, textures: [tArt, tSil], art: art, edge: edge, back: back };
    edge.userData.mask = prep.mask; edge.userData.hit = true;
    return g;
  };
  DP.disposeLayer = function (g) {
    var u = g.userData; if (!u || !u.textures) return;
    u.textures.forEach(function (t) { t.dispose(); });
    [u.art, u.edge, u.back].forEach(function (m) {
      var i = DP.paperMats.indexOf(m.material); if (i >= 0) DP.paperMats.splice(i, 1);
      m.material.dispose(); if (m.customDepthMaterial) m.customDepthMaterial.dispose();
    });
  };

  /* ---------- the folded paper stand ---------- */
  var standMat = null;
  function makeStand(width, height) {
    if (!standMat) { standMat = new THREE.MeshStandardMaterial({ color: 0xd9cfb6, roughness: 1, side: THREE.DoubleSide }); }
    var sh = new THREE.Shape();
    var w = width * 0.5;
    sh.moveTo(-w, 0); sh.lineTo(w, 0); sh.lineTo(w * 0.62, height); sh.lineTo(-w * 0.62, height); sh.lineTo(-w, 0);
    var m = new THREE.Mesh(new THREE.ShapeGeometry(sh), standMat);
    m.rotation.x = -0.95;      // leans back from the card base
    m.position.set(0, 0.012, -0.035);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  /* ---------- Dibs and Wacker as puppets ---------- */
  var SK = 'stroke="#3d3a4f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  var SW = 'stroke="#2a2350" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  function svg100(inner, extra) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' + (extra || '') + inner + '</svg>'; }

  DP.DIBS_COLORS = [
    { id: 'orig', name: 'Original', c: ['#b9bed1', '#a1a8c0', '#a2a9c0'], sw: '#b9bed1' },
    { id: 'cream', name: 'Cream', c: ['#efe6cf', '#ddd2b6', '#e9dfc6'], sw: '#efe6cf' },
    { id: 'slate', name: 'Slate', c: ['#7d83a0', '#6a7090', '#767c9a'], sw: '#7d83a0' },
    { id: 'rust', name: 'Rust', c: ['#c99673', '#b58260', '#c08d6a'], sw: '#c99673' },
    { id: 'lav', name: 'Lavender', c: ['#cbbbea', '#b8a6dc', '#c4b3e5'], sw: '#cbbbea' },
    { id: 'pink', name: 'Pink', c: ['#f2bccd', '#e5a6ba', '#ecb2c4'], sw: '#f2bccd' }
  ];

  function dibsParts(colorIdx) {
    var cc = DP.DIBS_COLORS[colorIdx || 0].c;
    var grad = '<defs><linearGradient id="dibs-nk" x1="0" x2="1"><stop offset="0" stop-color="#3aa58c"/><stop offset=".5" stop-color="#7d62b8"/><stop offset="1" stop-color="#3aa58c"/></linearGradient></defs>';
    return {
      legs: svg100('<g ' + SK + '><path d="M40 92l-5 4M40 92l0 5M40 92l5 4M60 92l-5 4M60 92l0 5M60 92l5 4" fill="none" stroke="#e58a9c" stroke-width="3.2"/><path d="M39 86v6M61 86v6" stroke="#e58a9c" stroke-width="3.2"/></g>'),
      body: svg100('<g ' + SK + '><ellipse cx="50" cy="66" rx="29" ry="26" fill="' + cc[0] + '"/></g>'),
      wingA: svg100('<g ' + SK + '><path d="M22 60Q12 76 26 88Q36 86 36 74Z" fill="' + cc[1] + '"/><path d="M22 72q6 3 10 1M23 79q6 3 10 1" fill="none" stroke="#4b4a5e" stroke-width="2.4"/></g>'),
      wingB: svg100('<g ' + SK + '><path d="M78 60Q88 76 74 88Q64 86 64 74Z" fill="' + cc[1] + '"/><path d="M78 72q-6 3-10 1M77 79q-6 3-10 1" fill="none" stroke="#4b4a5e" stroke-width="2.4"/></g>'),
      belly: svg100('<ellipse cx="50" cy="71" rx="16" ry="17" fill="#d6d9e6"/><g ' + SK + '><path d="M31 47Q50 60 69 47L68 55Q50 66 32 55Z" fill="url(#dibs-nk)"/></g>', grad),
      headFn: function (expr, look) {
        var dx = look * 2.6, eyes;
        var ex = [39.6, 60.4];
        if (expr === 'happy') {
          eyes = '<path d="M32 33Q39.6 23 47.2 33M52.8 33Q60.4 23 68 33" fill="none" stroke="#3d3a4f" stroke-width="3.2" stroke-linecap="round"/>';
        } else {
          var open = function (x) {
            return '<circle cx="' + x + '" cy="30.7" r="7.28" fill="#f2903f" stroke="#3d3a4f" stroke-width="2"/><circle cx="' + (x + dx) + '" cy="30.7" r="3.64" fill="#211d2b"/><circle cx="' + (x + dx - 1) + '" cy="29.5" r="1.2" fill="#fff"/>';
          };
          if (expr === 'wink') eyes = '<path d="M32.4 31.5Q39.6 36 46.8 31.5" fill="none" stroke="#3d3a4f" stroke-width="3.2" stroke-linecap="round"/>' + open(ex[1]);
          else eyes = open(ex[0]) + open(ex[1]);
        }
        return svg100('<g ' + SK + '><circle cx="50" cy="31" r="22" fill="' + cc[2] + '"/></g>' + eyes +
          '<path d="M 44.80 41.10 L 55.20 41.10 L 50.00 51.50 Z" fill="#4b4a5e" stroke="#3d3a4f" stroke-width="2" stroke-linejoin="round"/><ellipse cx="50" cy="40.5" rx="5" ry="2.4" fill="#efecf3" stroke="#3d3a4f" stroke-width="1.4"/>');
      }
    };
  }

  function wackerParts() {
    return {
      tail: svg100('<g ' + SW + '><path d="M64 76L70 98H90L84 72Z" fill="#5b6b84"/><path d="M68 86H87M70 92H88" fill="none" stroke="#3f4a5e" stroke-width="2"/></g>'),
      legs: svg100('<g ' + SW + '><path d="M40 88v6M60 88v6" stroke="#f2c230" stroke-width="3.4" fill="none"/><path d="M40 94l-6 3M40 94l-1 4M40 94l5 3M60 94l-6 3M60 94l-1 4M60 94l5 3" fill="none" stroke="#f2c230" stroke-width="3.2"/></g>'),
      body: svg100('<g ' + SW + '><ellipse cx="52" cy="64" rx="27" ry="27" fill="#5b6b84"/></g>'),
      wingA: svg100('<g ' + SW + '><path d="M62 46Q82 62 76 94Q64 90 58 84Q54 66 56 48Z" fill="#3f4a5e"/><path d="M61 52Q74 66 70 84" fill="none" stroke="#2a2350" stroke-width="2"/></g>'),
      chest: svg100('<g ' + SW + '><path d="M28 46Q22 68 36 88Q50 92 56 84Q60 66 54 48Z" fill="#f7f1e3"/><path d="M33 68h11M32 75h13M35 82h11" fill="none" stroke="#3f4a5e" stroke-width="2.4"/></g>'),
      headFn: function (expr) {
        var eye = expr === 'happy'
          ? '<path d="M31 27Q39 18 47 27" fill="none" stroke="#2a2350" stroke-width="3.2" stroke-linecap="round"/>'
          : '<circle cx="39" cy="26" r="9" fill="#f2c230" stroke="#2a2350" stroke-width="2"/><circle cx="37.5" cy="27.5" r="4.8" fill="#211d2b"/><circle cx="36" cy="26" r="1.6" fill="#fff"/>';
        return svg100('<g ' + SW + '><circle cx="42" cy="30" r="22" fill="#2f3850"/></g>' +
          '<path d="M21 33Q30 30 36 36Q42 42 42 52Q36 56 28 50Q22 44 21 33Z" fill="#f7f1e3" stroke="#2a2350" stroke-width="2" stroke-linejoin="round"/>' +
          '<path d="M37 37Q46 40 46 55Q40 56 36 50Q34 44 37 37Z" fill="#2f3850" stroke="#2a2350" stroke-width="2" stroke-linejoin="round"/>' +
          '<path d="M25 22Q10 22 10 34Q11 42 18 44Q18 38 23 36Q28 33 28 27Z" fill="#6f7a92" stroke="#2a2350" stroke-width="2.4" stroke-linejoin="round"/>' +
          '<path d="M24 24Q30 22 32 27Q29 31 24 31Q22 28 24 24Z" fill="#f2c230" stroke="#2a2350" stroke-width="2" stroke-linejoin="round"/>' +
          eye +
          (expr === 'happy' ? '' : '<path d="M30 25A9 9 0 0 1 48 23Z" fill="#2f3850" stroke="#2a2350" stroke-width="2" stroke-linejoin="round"/>'));
      }
    };
  }

  /* kind -> layout. order is back to front. pivot in 100-unit art coordinates; base = standing line. */
  var PUPPETS = {
    dibs: {
      size: 1.7, base: 97, parts: ['legs', 'body', 'wingA', 'wingB', 'belly', 'head'],
      pivots: { legs: [50, 92], body: [50, 92], wingA: [30, 62], wingB: [70, 62], belly: [50, 92], head: [50, 50] },
      wings: 2, name: 'Dibs', make: dibsParts
    },
    wacker: {
      size: 1.7, base: 98, parts: ['tail', 'legs', 'body', 'wingA', 'chest', 'head'],
      pivots: { tail: [64, 78], legs: [50, 90], body: [52, 92], wingA: [60, 50], chest: [52, 92], head: [42, 50] },
      wings: 1, name: 'Wacker', make: wackerParts
    }
  };
  DP.PUPPETS = PUPPETS;

  DP.POSES = [
    { id: 'stand', name: 'Stand', p: {} },
    { id: 'wave', name: 'Wave', p: { wingB: 150, head: 6, expr: 'happy' } },
    { id: 'shrug', name: 'Shrug', p: { wingA: 62, wingB: 62, head: 10, bend: 0 } },
    { id: 'proud', name: 'Proud', p: { bend: -16, head: -5, wingA: 12, wingB: 12 } },
    { id: 'peek', name: 'Peek', p: { lean: 14, head: 24, look: 1, wingB: 8 } },
    { id: 'hop', name: 'Hop', p: { hop: 0.55, wingA: 45, wingB: 45, expr: 'happy' } },
    { id: 'lookl', name: 'Look left', p: { look: -1, head: 8 } },
    { id: 'lookr', name: 'Look right', p: { look: 1, head: -8 } },
    { id: 'point', name: 'Point', p: { wingA: 92, head: 8, lean: -4 } }
  ];
  DP.defaultPose = function () { return { preset: 'stand', head: 0, wingA: 0, wingB: 0, lean: 0, bend: 0, hop: 0, look: 0, expr: 'open', color: 0 }; };
  DP.poseFromPreset = function (id, keep, kind) {
    var d = DP.defaultPose(), pr = DP.POSES.filter(function (x) { return x.id === id; })[0] || DP.POSES[0];
    for (var k in pr.p) d[k] = pr.p[k];
    d.preset = pr.id;
    if (kind === 'wacker') { d.wingA = Math.max(d.wingA, d.wingB); d.wingB = 0; d.color = 0; }
    if (keep) { d.color = keep.color || 0; if (!pr.p.expr) d.expr = keep.expr || 'open'; }
    return d;
  };

  var rasterCache = {};   // svg -> prep
  function cachedPrep(svg, o) {
    var key = svg + (o && o.square ? '#sq' : '');
    if (!rasterCache[key]) rasterCache[key] = DP.prepArt(svg, o);
    return rasterCache[key];
  }

  function Puppet(kind, pose) {
    var def = PUPPETS[kind];
    this.kind = kind; this.def = def;
    this.root = new THREE.Group();          // base point, spun by the item
    this.body = new THREE.Group();          // pose lean/bend/hop
    this.root.add(this.body);
    this.parts = {};
    this.S = def.size;
    this.pose = pose;
    this.headKey = '';
    this.colorIdx = -1;
  }
  Puppet.prototype.u = function (ux, uy) { return new THREE.Vector3((ux - 50) / 100 * this.S, (this.def.base - uy) / 100 * this.S, 0); };

  Puppet.prototype.build = function () {
    var self = this, def = this.def;
    var svgs = def.make(this.pose.color);
    this.svgs = svgs;
    var jobs = def.parts.map(function (id) {
      var svg = id === 'head' ? svgs.headFn(self.pose.expr, self.pose.look) : svgs[id];
      return cachedPrep(svg, { square: true }).then(function (prep) { return { id: id, prep: prep }; });
    });
    return Promise.all(jobs).then(function (list) {
      list.forEach(function (it, i) {
        var layer = DP.makeLayer(it.prep, self.S, self.S, { z: i * 0.006 });
        var pv = def.pivots[it.id];
        var grp = new THREE.Group();
        var p = self.u(pv[0], pv[1]);
        grp.position.copy(p);
        layer.position.set(-p.x, -p.y + 0, 0);
        // layer is centred on art (50,50) which is world (0, (base-50)/100*S)
        layer.position.set(-p.x, (def.base - 50) / 100 * self.S - p.y, 0);
        grp.add(layer);
        self.body.add(grp);
        self.parts[it.id] = { grp: grp, layer: layer, prep: it.prep };
      });
      self.colorIdx = self.pose.color; self.headKey = self.pose.expr + '|' + self.pose.look;
      self.applyPose(self.pose);
      self.width = self.S * 0.62; self.height = self.S * 0.98;
      self.hit = [];
      return self;
    });
  };

  var D2R = Math.PI / 180;
  Puppet.prototype.applyPose = function (pose) {
    this.pose = pose;
    var P = this.parts, def = this.def;
    this.body.rotation.z = -pose.lean * D2R;
    this.body.rotation.x = pose.bend * D2R;
    this.body.position.y = 0.03 + pose.hop * this.S * 0.32;   // 0.03 keeps the white edge sitting on the floor
    if (P.legs) { var sq = 1 - 0.0 - pose.hop * 0.0; P.legs.grp.scale.y = 1 + pose.hop * 0.15; }
    // body squash when standing from a hop is a nicety: slight squash at hop 0 stays at 1
    var flipHead = (this.kind === 'wacker' && pose.look > 0);
    if (P.head) {
      P.head.grp.rotation.z = -pose.head * D2R;
      var lookX = this.kind === 'dibs' ? pose.look * 0.03 * this.S : (pose.look < 0 ? -0.02 * this.S : 0);
      P.head.grp.position.x = this.u(def.pivots.head[0], def.pivots.head[1]).x + lookX;
      P.head.grp.scale.x = flipHead ? -1 : 1;
    }
    if (P.wingA) P.wingA.grp.rotation.z = (this.kind === 'wacker' ? 1 : -1) * pose.wingA * D2R;
    if (P.wingB) P.wingB.grp.rotation.z = pose.wingB * D2R;
    if (P.tail) P.tail.grp.rotation.z = pose.hop * 10 * D2R;
    // texture swaps (color, expression, eyes) happen asynchronously
    var self = this, hk = pose.expr + '|' + pose.look, wantColor = pose.color;
    if (this.kind === 'dibs' && (hk !== this.headKey || wantColor !== this.colorIdx)) {
      this.headKey = hk; this.colorIdx = wantColor; this.swapSeq = (this.swapSeq || 0) + 1;
      var seq = this.swapSeq;
      var svgs = def.make(wantColor);
      var map = { body: svgs.body, wingA: svgs.wingA, wingB: svgs.wingB, head: svgs.headFn(pose.expr, pose.look) };
      Object.keys(map).forEach(function (id) {
        cachedPrep(map[id], { square: true }).then(function (prep) {
          if (seq !== self.swapSeq || !self.parts[id]) return;
          self.swapPart(id, prep);
        });
      });
    } else if (this.kind === 'wacker' && hk.split('|')[0] !== (this.headKey || '').split('|')[0]) {
      this.headKey = hk;
      cachedPrep(def.make().headFn(pose.expr, 0), { square: true }).then(function (prep) { if (self.parts.head) self.swapPart('head', prep); });
    }
    if (DP.onChange) DP.onChange();
  };
  Puppet.prototype.swapPart = function (id, prep) {
    var part = this.parts[id], old = part.layer;
    var idx = this.def.parts.indexOf(id);
    var layer = DP.makeLayer(prep, this.S, this.S, { z: idx * 0.006 });
    layer.position.copy(old.position);
    part.grp.add(layer); part.grp.remove(old);
    DP.disposeLayer(old);
    part.layer = layer; part.prep = prep;
    if (DP.onChange) DP.onChange();
  };
  Puppet.prototype.hitMeshes = function () {
    var out = [];
    for (var id in this.parts) out.push(this.parts[id].layer.userData.edge);
    return out;
  };
  Puppet.prototype.dispose = function () {
    for (var id in this.parts) DP.disposeLayer(this.parts[id].layer);
  };

  /* ---------- items: puppet, character card, symbol card, upload card ---------- */
  var CARD_SIZES = { dibsTrain: 2.2, wackerFly: 1.9 };

  DP.kindInfo = function (kind) {
    if (kind === 'dibs') return { name: 'Dibs', puppet: true, key: 'dibs' };
    if (kind === 'wacker') return { name: 'Wacker', puppet: true, key: 'wacker' };
    if (kind === 'dibsTrain') return { name: 'Dibs on the L', svg: A.characters.dibsTrain, h: 1.35 };
    if (kind === 'wackerFly') return { name: 'Wacker flying', svg: A.characters.wackerFly, h: 1.7 };
    if (kind.indexOf('symbol:') === 0) {
      var n = kind.slice(7);
      return { name: n.replace(/-/g, ' '), svg: A.symbols[n], h: 1.25 };
    }
    if (kind.indexOf('upload:') === 0) return { name: 'Picture', upload: true, h: 1.6 };
    return null;
  };

  /* Build the 3D object for an item record. Returns a promise of an object with root, update(item), dispose(). */
  DP.buildItem = function (item, uploads) {
    var info = DP.kindInfo(item.kind);
    if (!info) return Promise.reject(new Error('unknown item ' + item.kind));
    var root = new THREE.Group();
    var tilt = new THREE.Group();
    root.add(tilt);
    var obj = { root: root, tilt: tilt, kind: item.kind, id: item.id, info: info };

    function finish(contentW, contentH, hitMeshes, stand, puppet, thumb) {
      obj.w = contentW; obj.h = contentH; obj.hitMeshes = hitMeshes; obj.puppet = puppet;
      if (stand) root.add(makeStand(contentW * 0.5, Math.max(0.35, contentH * 0.3)));
      obj.thumb = thumb;
      obj.apply = function (it) {
        root.position.set(it.x, it.y, it.z);
        root.rotation.set(0, it.yaw * D2R, 0);
        root.scale.set(it.scale * (it.flip ? -1 : 1), it.scale, it.scale);
        tilt.rotation.x = -it.tilt * D2R;
        if (puppet) puppet.applyPose(it.pose || DP.defaultPose());
      };
      obj.dispose = function () {
        if (puppet) puppet.dispose();
        else obj.layer && DP.disposeLayer(obj.layer);
      };
      obj.apply(item);
      return obj;
    }

    if (info.puppet) {
      var pose = item.pose || DP.defaultPose();
      var pp = new Puppet(info.key, pose);
      return pp.build().then(function () {
        tilt.add(pp.root);
        // pp.root is a child of tilt
        var base = pp.parts.body.prep.art;
        var th = (function () {   // thumbnail: whole puppet composited
          var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d');
          pp.def.parts.forEach(function (id) { x.drawImage(pp.parts[id].prep.art, 0, 0, 128, 128); });
          return c.toDataURL('image/png');
        })();
        return finish(pp.S * 0.62, pp.S, null, true, pp, th);
      }).then(function (o) { o.hitMeshes = function () { return o.puppet.hitMeshes(); }; return o; });
    }

    function fromPrep(prep) {
      var ch = info.h, cwd = info.h * prep.aspect;
      if (info.upload) { var mx = Math.max(cwd, ch), k = 1.6 / mx; cwd *= k; ch *= k; }
      else if (CARD_SIZES[item.kind]) { var kk = CARD_SIZES[item.kind] / cwd; cwd *= kk; ch *= kk; }
      var layer = DP.makeLayer(prep, cwd, ch);
      layer.position.y = ch / 2 + 0.03;
      tilt.add(layer);
      obj.layer = layer;
      var th = DP.thumb(prep.art, 96);
      var o = finish(cwd, ch, null, true, null, th);
      o.hitMeshes = function () { return [layer.userData.edge]; };
      return o;
    }
    if (info.upload) {
      var up = uploads && uploads[item.kind.slice(7)];
      if (!up) return Promise.reject(new Error('missing upload'));
      return loadImage(up.data).then(function (im) { return DP.prepArt(im); }).then(fromPrep);
    }
    return cachedPrep(info.svg).then(fromPrep);
  };

  /* Alpha lookup for picking: returns true if the ray hit a non-empty pixel of the mesh's mask. */
  DP.maskHit = function (hit) {
    var mask = hit.object.userData.mask;
    if (!mask || !hit.uv) return true;
    var x = Math.min(mask.w - 1, Math.max(0, Math.floor(hit.uv.x * mask.w)));
    var y = Math.min(mask.h - 1, Math.max(0, Math.floor((1 - hit.uv.y) * mask.h)));
    return mask.a[y * mask.w + x] > 100;
  };

  DP.prepStickerImage = function (svgOrImg) { return cachedPrep(svgOrImg); };
  DP.rasterForSticker = function (svg, px) {
    var nat = svgSize(svg), a = nat.w / nat.h;
    var w = a >= 1 ? px : Math.round(px * a), h = a >= 1 ? Math.round(px / a) : px;
    return svgToImage(svg, w, h);
  };
})();
