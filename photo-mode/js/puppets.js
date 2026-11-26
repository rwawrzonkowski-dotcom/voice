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
    var nat = isSvg ? svgSize(src) : { w: src.naturalWidth || src.width || 512, h: src.naturalHeight || src.height || 512 };
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

  /* ---------- puppets ---------- */
  var SK = 'stroke="#3d3a4f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  var SW = 'stroke="#2a2350" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  function svg100(inner, extra) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' + (extra || '') + inner + '</svg>'; }
  function innerOf(svg) { return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''); }

  DP.DIBS_COLORS = [
    { id: 'orig', name: 'Original', c: ['#b9bed1', '#a1a8c0', '#a2a9c0'], sw: '#b9bed1' },
    { id: 'cream', name: 'Cream', c: ['#efe6cf', '#ddd2b6', '#e9dfc6'], sw: '#efe6cf' },
    { id: 'slate', name: 'Slate', c: ['#7d83a0', '#6a7090', '#767c9a'], sw: '#7d83a0' },
    { id: 'rust', name: 'Rust', c: ['#c99673', '#b58260', '#c08d6a'], sw: '#c99673' },
    { id: 'lav', name: 'Lavender', c: ['#cbbbea', '#b8a6dc', '#c4b3e5'], sw: '#cbbbea' },
    { id: 'pink', name: 'Pink', c: ['#f2bccd', '#e5a6ba', '#ecb2c4'], sw: '#f2bccd' }
  ];
  DP.PIGEON_COLORS = [
    { id: 'orig', name: 'Grey', c: ['#b9bed1', '#a1a8c0', '#a2a9c0'], sw: '#b9bed1' },
    { id: 'dark', name: 'Dark grey', c: ['#6d7186', '#585c72', '#62667c'], sw: '#6d7186' },
    { id: 'brown', name: 'Brown', c: ['#b49880', '#9c8068', '#a58a72'], sw: '#b49880' },
    { id: 'blue', name: 'Blue grey', c: ['#8f97ab', '#7d869c', '#868fa4'], sw: '#8f97ab' },
    { id: 'white', name: 'Cream white', c: ['#ece9f0', '#d9d5e0', '#e3dfe9'], sw: '#ece9f0' },
    { id: 'tan', name: 'Tan', c: ['#c9ad8a', '#b49574', '#bea080'], sw: '#c9ad8a' }
  ];
  DP.GENERIC_COLORS = [
    { id: 'orig', name: 'As drawn', sw: null },
    { id: 'cream', name: 'Cream', sw: '#efe6cf' },
    { id: 'slate', name: 'Slate', sw: '#7d83a0' },
    { id: 'rust', name: 'Rust', sw: '#c99673' },
    { id: 'lav', name: 'Lavender', sw: '#cbbbea' },
    { id: 'pink', name: 'Pink', sw: '#f2bccd' }
  ];

  /* The Chicago flag neck band for Dibs (photo mode only): white, two light blue stripes, red six-pointed stars.
     Same outline as the original ring. kind 'black' is the plain pigeon's solid band. */
  var BAND = 'M31 47Q50 60 69 47L68 55Q50 66 32 55Z';
  function star6(cx, cy, R) {
    var pts = [], r = R * 0.56;
    for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r : R; pts.push((cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2)); }
    return 'M' + pts.join('L') + 'Z';
  }
  function neckBand(kind) {
    if (kind === 'black') return '<path d="' + BAND + '" fill="#211d2b" ' + SK + '/>';
    var d = 2.3, stars = '';
    [38.5, 46, 54, 61.5].forEach(function (x) {
      var t = (x - 31) / 38, t2 = (x - 32) / 36;
      var yt = 47 + 26 * t * (1 - t), yb = 55 + 22 * t2 * (1 - t2);
      stars += '<path d="' + star6(x, (yt + yb) / 2 + 0.1, 2.1) + '"/>';
    });
    return '<defs><clipPath id="nk-clip"><path d="' + BAND + '"/></clipPath></defs>' +
      '<path d="' + BAND + '" fill="#ffffff"/>' +
      '<g clip-path="url(#nk-clip)"><path d="M31 ' + (47 + d) + 'Q50 ' + (60 + d) + ' 69 ' + (47 + d) + '" fill="none" stroke="#8ccbe9" stroke-width="1.5"/>' +
      '<path d="M32 ' + (55 - d + 0.2) + 'Q50 ' + (66 - d + 0.2) + ' 68 ' + (55 - d + 0.2) + '" fill="none" stroke="#8ccbe9" stroke-width="1.5"/>' +
      '<g fill="#e4002b">' + stars + '</g></g>' +
      '<path d="' + BAND + '" fill="none" stroke="#3d3a4f" stroke-width="2.4" stroke-linejoin="round"/>';
  }

  function dibsMaker(colors, neck) {
    return function (colorIdx) {
      var cc = colors[colorIdx || 0].c;
      return {
        legs: svg100('<g ' + SK + '><path d="M40 92l-5 4M40 92l0 5M40 92l5 4M60 92l-5 4M60 92l0 5M60 92l5 4" fill="none" stroke="#e58a9c" stroke-width="3.2"/><path d="M39 86v6M61 86v6" stroke="#e58a9c" stroke-width="3.2"/></g>'),
        body: svg100('<g ' + SK + '><ellipse cx="50" cy="66" rx="29" ry="26" fill="' + cc[0] + '"/></g>'),
        wingA: svg100('<g ' + SK + '><path d="M22 60Q12 76 26 88Q36 86 36 74Z" fill="' + cc[1] + '"/><path d="M22 72q6 3 10 1M23 79q6 3 10 1" fill="none" stroke="#4b4a5e" stroke-width="2.4"/></g>'),
        wingB: svg100('<g ' + SK + '><path d="M78 60Q88 76 74 88Q64 86 64 74Z" fill="' + cc[1] + '"/><path d="M78 72q-6 3-10 1M77 79q-6 3-10 1" fill="none" stroke="#4b4a5e" stroke-width="2.4"/></g>'),
        belly: svg100('<ellipse cx="50" cy="71" rx="16" ry="17" fill="#d6d9e6"/>' + neckBand(neck)),
        head: svg100('<g ' + SK + '><circle cx="50" cy="31" r="22" fill="' + cc[2] + '"/></g>' +
          '<circle cx="39.6" cy="30.7" r="7.28" fill="#f2903f" stroke="#3d3a4f" stroke-width="2"/><circle cx="60.4" cy="30.7" r="7.28" fill="#f2903f" stroke="#3d3a4f" stroke-width="2"/>' +
          '<circle cx="39.6" cy="30.7" r="3.64" fill="#211d2b"/><circle cx="60.4" cy="30.7" r="3.64" fill="#211d2b"/><circle cx="38.6" cy="29.5" r="1.2" fill="#fff"/><circle cx="59.4" cy="29.5" r="1.2" fill="#fff"/>' +
          '<path d="M 44.80 41.10 L 55.20 41.10 L 50.00 51.50 Z" fill="#4b4a5e" stroke="#3d3a4f" stroke-width="2" stroke-linejoin="round"/><ellipse cx="50" cy="40.5" rx="5" ry="2.4" fill="#efecf3" stroke="#3d3a4f" stroke-width="1.4"/>')
      };
    };
  }

  function wackerMake() {
    return {
      tail: svg100('<g ' + SW + '><path d="M64 76L70 98H90L84 72Z" fill="#5b6b84"/><path d="M68 86H87M70 92H88" fill="none" stroke="#3f4a5e" stroke-width="2"/></g>'),
      legs: svg100('<g ' + SW + '><path d="M40 88v6M60 88v6" stroke="#f2c230" stroke-width="3.4" fill="none"/><path d="M40 94l-6 3M40 94l-1 4M40 94l5 3M60 94l-6 3M60 94l-1 4M60 94l5 3" fill="none" stroke="#f2c230" stroke-width="3.2"/></g>'),
      body: svg100('<g ' + SW + '><ellipse cx="52" cy="64" rx="27" ry="27" fill="#5b6b84"/></g>'),
      wingA: svg100('<g ' + SW + '><path d="M62 46Q82 62 76 94Q64 90 58 84Q54 66 56 48Z" fill="#3f4a5e"/><path d="M61 52Q74 66 70 84" fill="none" stroke="#2a2350" stroke-width="2"/></g>'),
      chest: svg100('<g ' + SW + '><path d="M28 46Q22 68 36 88Q50 92 56 84Q60 66 54 48Z" fill="#f7f1e3"/><path d="M33 68h11M32 75h13M35 82h11" fill="none" stroke="#3f4a5e" stroke-width="2.4"/></g>'),
      head: svg100('<g ' + SW + '><circle cx="42" cy="30" r="22" fill="#2f3850"/></g>' +
        '<path d="M21 33Q30 30 36 36Q42 42 42 52Q36 56 28 50Q22 44 21 33Z" fill="#f7f1e3" stroke="#2a2350" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M37 37Q46 40 46 55Q40 56 36 50Q34 44 37 37Z" fill="#2f3850" stroke="#2a2350" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M25 22Q10 22 10 34Q11 42 18 44Q18 38 23 36Q28 33 28 27Z" fill="#6f7a92" stroke="#2a2350" stroke-width="2.4" stroke-linejoin="round"/>' +
        '<path d="M24 24Q30 22 32 27Q29 31 24 31Q22 28 24 24Z" fill="#f2c230" stroke="#2a2350" stroke-width="2" stroke-linejoin="round"/>' +
        '<circle cx="39" cy="26" r="9" fill="#f2c230" stroke="#2a2350" stroke-width="2"/><circle cx="37.5" cy="27.5" r="4.8" fill="#211d2b"/><circle cx="36" cy="26" r="1.6" fill="#fff"/>' +
        '<path d="M30 25A9 9 0 0 1 48 23Z" fill="#2f3850" stroke="#2a2350" stroke-width="2" stroke-linejoin="round"/>')
    };
  }

  /* ---- the Chicago critters: cut the drawing into parts by its own SVG elements (never redrawn) ---- */
  function hexToHsl(h) {
    var r = parseInt(h.substr(1, 2), 16) / 255, g = parseInt(h.substr(3, 2), 16) / 255, b = parseInt(h.substr(5, 2), 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = 0, hh = 0;
    if (mx !== mn) {
      var d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : (mx === g ? (b - r) / d + 2 : (r - g) / d + 4); hh /= 6;
    }
    return [hh, s, l];
  }
  function hslToHex(h, s, l) {
    function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }
    var r, g, b;
    if (s === 0) { r = g = b = l; } else { var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3); }
    function x(v) { var n = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16); return n.length < 2 ? '0' + n : n; }
    return '#' + x(r) + x(g) + x(b);
  }
  /* shift a drawn fill so the main body fill becomes the swatch color, keeping the light and dark differences */
  function recolor(fill, main, target) {
    if (!/^#[0-9a-f]{6}$/i.test(fill)) return fill;
    var f = hexToHsl(fill), m = hexToHsl(main), t = hexToHsl(target);
    return hslToHex(t[0], t[1], Math.max(0.05, Math.min(0.97, t[2] + (f[2] - m[2]))));
  }
  var splitCache = {};
  function parseLeaves(kind, svg) {
    if (splitCache[kind]) return splitCache[kind];
    var doc = new DOMParser().parseFromString(svg, 'image/svg+xml'), leaves = [], defs = '';
    var ser = new XMLSerializer();
    function open(el) {
      var s = '<' + el.localName, i, a;
      for (i = 0; i < el.attributes.length; i++) { a = el.attributes[i]; s += ' ' + a.name + '="' + a.value.replace(/"/g, '&quot;') + '"'; }
      return s + '>';
    }
    function walk(node, wrap) {
      for (var c = node.firstElementChild; c; c = c.nextElementSibling) {
        var tag = c.localName;
        if (tag === 'defs') { defs += ser.serializeToString(c).replace(/ xmlns="[^"]*"/g, ''); }
        else if (tag === 'g') walk(c, wrap.concat([open(c)]));
        else leaves.push({ wrap: wrap, el: c });
      }
    }
    walk(doc.documentElement, []);
    return (splitCache[kind] = { leaves: leaves, defs: defs });
  }
  function critterMaker(kind, svgText, parts, main) {
    return function (colorIdx) {
      var P = parseLeaves(kind, svgText), out = {};
      var target = colorIdx > 0 && main ? DP.GENERIC_COLORS[colorIdx].sw : null;
      var ser = new XMLSerializer();
      Object.keys(parts).forEach(function (id) {
        var s = '';
        parts[id].forEach(function (li) {
          var lf = P.leaves[li], el = lf.el;
          if (target && el.getAttribute('class') === 'body') {
            el = el.cloneNode(true);
            el.setAttribute('fill', recolor(el.getAttribute('fill'), main, target));
          }
          var x = ser.serializeToString(el).replace(/ xmlns="[^"]*"/g, '');
          lf.wrap.forEach(function (w) { s += w; });
          s += x;
          for (var k = 0; k < lf.wrap.length; k++) s += '</g>';
        });
        out[id] = svg100(s, P.defs);
      });
      return out;
    };
  }
  function range(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }
  var CR = window.DIBS_ASSETS.critters;

  /* anchors: art coordinates (100 x 100). part = which part carries it, so it moves with the pose. w = width a hat or scarf should have. */
  var PUPPETS = {
    dibs: {
      name: 'Dibs', size: 1.7, base: 97, parts: ['legs', 'body', 'wingA', 'wingB', 'belly', 'head'],
      pivots: { legs: [50, 92], body: [50, 92], wingA: [30, 62], wingB: [70, 62], belly: [50, 92], head: [50, 50] },
      wings: 2, wingSign: { A: -1, B: 1 }, side: false, colors: DP.DIBS_COLORS, make: dibsMaker(DP.DIBS_COLORS, 'flag'),
      headTop: [50, 8], feetY: 96,
      anchors: { handL: { part: 'wingA', x: 24, y: 85 }, handR: { part: 'wingB', x: 76, y: 85 }, head: { part: 'head', x: 50, y: 18, w: 40 }, neck: { part: 'body', x: 50, y: 56, w: 46 }, feet: { part: 'legs', x: 50, y: 95 } }
    },
    pigeon: {
      name: 'Pigeon', size: 1.7, base: 97, parts: ['legs', 'body', 'wingA', 'wingB', 'belly', 'head'],
      pivots: { legs: [50, 92], body: [50, 92], wingA: [30, 62], wingB: [70, 62], belly: [50, 92], head: [50, 50] },
      wings: 2, wingSign: { A: -1, B: 1 }, side: false, colors: DP.PIGEON_COLORS, make: dibsMaker(DP.PIGEON_COLORS, 'black'),
      headTop: [50, 8], feetY: 96,
      anchors: { handL: { part: 'wingA', x: 24, y: 85 }, handR: { part: 'wingB', x: 76, y: 85 }, head: { part: 'head', x: 50, y: 18, w: 40 }, neck: { part: 'body', x: 50, y: 56, w: 46 }, feet: { part: 'legs', x: 50, y: 95 } }
    },
    wacker: {
      name: 'Wacker', size: 1.7, base: 98, parts: ['tail', 'legs', 'body', 'wingA', 'chest', 'head'],
      pivots: { tail: [64, 78], legs: [50, 90], body: [52, 92], wingA: [60, 50], chest: [52, 92], head: [42, 50] },
      wings: 1, wingSign: { A: 1 }, side: true, colors: null, make: wackerMake,
      headTop: [40, 8], feetY: 96,
      anchors: { handL: { part: 'body', x: 30, y: 74 }, handR: { part: 'wingA', x: 70, y: 88 }, head: { part: 'head', x: 40, y: 15, w: 34 }, neck: { part: 'body', x: 40, y: 52, w: 34 }, feet: { part: 'legs', x: 50, y: 96 } }
    },
    chance: {
      name: 'Chance', size: 1.7, base: 97, parts: ['tail', 'legs', 'body', 'wingA', 'wingB', 'head'],
      pivots: { tail: [68, 77], legs: [50, 91], body: [50, 92], wingA: [25, 62], wingB: [75, 62], head: [50, 52] },
      wings: 2, wingSign: { A: -1, B: 1 }, side: false, colors: DP.GENERIC_COLORS, main: '#6fae5a',
      headTop: [50, 13], feetY: 96,
      anchors: { handL: { part: 'wingA', x: 21, y: 77 }, handR: { part: 'wingB', x: 79, y: 77 }, head: { part: 'head', x: 50, y: 15, w: 36 }, neck: { part: 'body', x: 50, y: 53, w: 40 }, feet: { part: 'legs', x: 50, y: 96 } },
      split: { tail: [0, 1], legs: [2, 3], body: [4, 7, 8], wingA: [5], wingB: [6], head: range(9, 22) }
    },
    hiram: {
      name: 'Hiram', size: 1.7, base: 98, parts: ['body', 'legs', 'head'],
      pivots: { body: [50, 92], legs: [50, 91], head: [50, 56] },
      wings: 0, wingSign: {}, side: false, colors: DP.GENERIC_COLORS, main: '#d9a46b',
      headTop: [50, 17], feetY: 97,
      anchors: { handL: { part: 'body', x: 23, y: 72 }, handR: { part: 'body', x: 77, y: 72 }, head: { part: 'head', x: 50, y: 25, w: 44 }, neck: { part: 'body', x: 50, y: 56, w: 44 }, feet: { part: 'legs', x: 50, y: 96 } },
      split: { body: [0, 1, 2, 3], legs: [4, 5], head: range(6, 21) }
    },
    ivy: {
      name: 'Ivy', size: 1.7, base: 98, parts: ['tail', 'legs', 'body', 'wingA', 'head'],
      pivots: { tail: [74, 63], legs: [51, 90], body: [54, 92], wingA: [56, 62], head: [43, 60] },
      wings: 1, wingSign: { A: 1 }, side: true, colors: DP.GENERIC_COLORS, main: '#9a8670',
      headTop: [43, 11], feetY: 97,
      anchors: { handL: { part: 'body', x: 28, y: 76 }, handR: { part: 'wingA', x: 80, y: 71 }, head: { part: 'head', x: 43, y: 13, w: 24 }, neck: { part: 'body', x: 43, y: 56, w: 24 }, feet: { part: 'legs', x: 51, y: 97 } },
      split: { tail: [0], legs: [1, 2], body: [3, 4], wingA: [5, 6], head: range(7, 13) }
    },
    monty: {
      name: 'Monty', size: 1.7, base: 98, parts: ['legs', 'tail', 'body', 'wingA', 'head'],
      pivots: { legs: [50, 88], tail: [73, 62], body: [51, 90], wingA: [60, 63], head: [47, 52] },
      wings: 1, wingSign: { A: 1 }, side: true, colors: DP.GENERIC_COLORS, main: '#d8c4a0',
      headTop: [47, 21], feetY: 97,
      anchors: { handL: { part: 'body', x: 30, y: 72 }, handR: { part: 'wingA', x: 74, y: 70 }, head: { part: 'head', x: 46, y: 28, w: 30 }, neck: { part: 'body', x: 47, y: 54, w: 30 }, feet: { part: 'legs', x: 50, y: 97 } },
      split: { legs: [0, 1, 12], tail: [2], body: [3, 4], wingA: [5], head: [6, 7, 8, 9, 10, 11, 13, 14, 15] }
    },
    sue: {
      name: 'Sue', size: 1.7, base: 95, parts: ['tail', 'legs', 'body', 'wingA', 'head'],
      pivots: { tail: [64, 62], legs: [50, 90], body: [50, 92], wingA: [40, 58], head: [48, 44] },
      wings: 1, wingSign: { A: -1 }, side: true, colors: null,
      headTop: [36, 10], feetY: 93,
      anchors: { handL: { part: 'wingA', x: 29, y: 63 }, handR: { part: 'body', x: 62, y: 62 }, head: { part: 'head', x: 37, y: 16, w: 34 }, neck: { part: 'body', x: 54, y: 47, w: 22 }, feet: { part: 'legs', x: 50, y: 92 } },
      split: { tail: [0, 1, 2], legs: range(3, 8), body: [9, 10, 11, 12], wingA: [13, 14], head: range(15, 23) }
    }
  };
  ['chance', 'hiram', 'ivy', 'monty', 'sue'].forEach(function (k) {
    var d = PUPPETS[k]; d.svg = CR[k];
    d.make = critterMaker(k, CR[k], d.split, d.main);
  });
  DP.PUPPETS = PUPPETS;
  DP.PUPPET_LIST = ['dibs', 'pigeon', 'chance', 'hiram', 'ivy', 'monty', 'sue', 'wacker'];
  DP.isPuppet = function (k) { return !!PUPPETS[k]; };
  /* one drawing of the whole character, for thumbnails */
  DP.charSvg = function (kind, colorIdx) {
    var d = PUPPETS[kind]; if (!d) return '';
    if (d.svg && !colorIdx) return d.svg;
    var parts = d.make(colorIdx || 0);
    return svg100(d.parts.map(function (id) { return innerOf(parts[id]); }).join(''));
  };

  DP.POSES = [
    { id: 'stand', name: 'Stand', p: {} },
    { id: 'wave', name: 'Wave', p: { wingB: 150, head: 6 } },
    { id: 'shrug', name: 'Shrug', p: { wingA: 62, wingB: 62, head: 10 } },
    { id: 'proud', name: 'Proud', p: { bend: -16, head: -5, wingA: 12, wingB: 12 } },
    { id: 'peek', name: 'Peek', p: { lean: 14, head: 24, look: 1, wingB: 8 } },
    { id: 'hop', name: 'Hop', p: { hop: 0.55, wingA: 45, wingB: 45 } },
    { id: 'lookl', name: 'Look left', p: { look: -1, head: 8 } },
    { id: 'lookr', name: 'Look right', p: { look: 1, head: -8 } },
    { id: 'point', name: 'Point', p: { wingA: 92, head: 8, lean: -4 } }
  ];
  DP.defaultPose = function () { return { preset: 'stand', head: 0, wingA: 0, wingB: 0, lean: 0, bend: 0, hop: 0, look: 0, color: 0 }; };
  DP.poseFromPreset = function (id, keep, kind) {
    var d = DP.defaultPose(), pr = DP.POSES.filter(function (x) { return x.id === id; })[0] || DP.POSES[0];
    for (var k in pr.p) d[k] = pr.p[k];
    d.preset = pr.id;
    var def = PUPPETS[kind];
    if (def && def.wings === 1) { d.wingA = Math.max(d.wingA, d.wingB); d.wingB = 0; }
    else if (def && def.wings === 0) { d.wingA = 0; d.wingB = 0; }
    d.color = keep ? (keep.color || 0) : 0;
    return d;
  };

  var rasterCache = {};   // svg -> prep
  function cachedPrep(svg, o) {
    var key = svg + (o && o.square ? '#sq' : '');
    if (!rasterCache[key]) rasterCache[key] = DP.prepArt(svg, o);
    return rasterCache[key];
  }

  var D2R = Math.PI / 180;

  /* a body move nudges the pose (puppets) or the whole card. Static, for photos. */
  function withMove(pose, move) {
    var e = {}, k;
    for (k in pose) e[k] = pose[k];
    e.dy = 0; e.sx = 1; e.sy = 1; e.jit = 0;
    if (move === 'bounce') { e.hop = Math.max(e.hop, 0.5); e.wingA = Math.max(e.wingA, 38); e.wingB = Math.max(e.wingB, 38); e.sx = 1.05; e.sy = 0.95; }
    else if (move === 'tilt') { e.head += 20; e.lean += 4; }
    else if (move === 'lean') { e.bend += 16; e.head += 6; }
    else if (move === 'shiver') { e.jit = 1; e.head += 3; e.lean += 2; e.wingA = Math.max(e.wingA, 14); e.wingB = Math.max(e.wingB, 14); }
    else if (move === 'slump') { e.bend += 9; e.head -= 12; e.dy = -0.06; e.wingA = 0; e.wingB = 0; e.sy = 0.96; }
    return e;
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
    this.move = 'none';
    this.colorIdx = -1;
    this.svgs = null;
  }
  Puppet.prototype.u = function (ux, uy) { return new THREE.Vector3((ux - 50) / 100 * this.S, (this.def.base - uy) / 100 * this.S, 0); };

  Puppet.prototype.build = function () {
    var self = this, def = this.def;
    var svgs = def.make(this.pose.color);
    this.svgs = svgs;
    var jobs = def.parts.map(function (id) {
      return cachedPrep(svgs[id], { square: true }).then(function (prep) { return { id: id, prep: prep }; });
    });
    return Promise.all(jobs).then(function (list) {
      list.forEach(function (it, i) {
        var layer = DP.makeLayer(it.prep, self.S, self.S, { z: i * 0.006 });
        var pv = def.pivots[it.id];
        var grp = new THREE.Group();
        var p = self.u(pv[0], pv[1]);
        grp.position.copy(p);
        layer.position.set(-p.x, (def.base - 50) / 100 * self.S - p.y, 0);
        grp.add(layer);
        self.body.add(grp);
        self.parts[it.id] = { grp: grp, layer: layer, prep: it.prep, home: p.clone() };
      });
      self.colorIdx = self.pose.color;
      self.applyPose(self.pose, self.move);
      self.width = self.S * 0.62; self.height = self.S * 0.98;
      return self;
    });
  };

  Puppet.prototype.applyPose = function (pose0, move) {
    this.pose = pose0; this.move = move || 'none';
    var pose = withMove(pose0, this.move);
    var P = this.parts, def = this.def, S = this.S, sg = def.wingSign;
    this.body.rotation.z = -pose.lean * D2R;
    this.body.rotation.x = pose.bend * D2R;
    this.body.position.y = 0.03 + pose.hop * S * 0.32;   // 0.03 keeps the white edge sitting on the floor
    this.body.scale.set(pose.sx, pose.sy, 1);
    if (P.legs) P.legs.grp.scale.y = 1 + pose.hop * 0.15;
    var flipHead = def.side && pose.look > 0, j = pose.jit ? 1 : 0, id, k = 0;
    if (P.head) {
      P.head.grp.rotation.z = -pose.head * D2R;
      var lookX = def.side ? (pose.look < 0 ? -0.02 * S : 0) : pose.look * 0.03 * S;
      P.head.grp.position.x = P.head.home.x + lookX;
      P.head.grp.position.y = P.head.home.y + pose.dy * S;
      P.head.grp.scale.x = flipHead ? -1 : 1;
    }
    if (P.wingA) P.wingA.grp.rotation.z = (sg.A || 1) * pose.wingA * D2R;
    if (P.wingB) P.wingB.grp.rotation.z = (sg.B || 1) * pose.wingB * D2R;
    if (P.tail) P.tail.grp.rotation.z = pose.hop * 10 * D2R;
    // paper shiver: every part sits a hair off its place
    for (id in P) {
      if (id === 'head') continue;
      P[id].grp.position.x = P[id].home.x + (j ? ((k % 2) ? 0.014 : -0.014) * S : 0);
      k++;
    }
    if (j && P.head) P.head.grp.position.x += 0.012 * S;
    // color changes swap the textures of the parts that show it
    if (def.colors && pose0.color !== this.colorIdx) {
      this.colorIdx = pose0.color; this.swapSeq = (this.swapSeq || 0) + 1;
      var self = this, seq = this.swapSeq, svgs = def.make(pose0.color);
      Object.keys(svgs).forEach(function (pid) {
        if (!self.parts[pid] || svgs[pid] === self.svgs[pid]) return;
        cachedPrep(svgs[pid], { square: true }).then(function (prep) {
          if (seq !== self.swapSeq || !self.parts[pid]) return;
          self.swapPart(pid, prep);
        });
      });
      this.svgs = svgs;
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
  /* where a named anchor is: the group to attach to and the position inside it (world units) */
  Puppet.prototype.anchorAt = function (slot, bubble) {
    var def = this.def, a = def.anchors[slot];
    if (!a) return null;
    var ax = a.x, ay = a.y, part = a.part;
    if (bubble && slot === 'head') { ax = def.headTop[0]; ay = def.headTop[1] - 2; }
    var parent = part === 'body' || !this.parts[part] ? this.body : this.parts[part].grp;
    var pos = this.u(ax, ay);
    if (parent !== this.body) pos.sub(this.parts[part].home);
    var n = def.parts.length, z;
    if (slot === 'neck') z = Math.max(0, def.parts.indexOf('head')) * 0.006 - 0.003;
    else z = n * 0.006 + 0.004;
    return { parent: parent, pos: pos, z: z, w: a.w };
  };

  /* ---------- items: puppet, character card, prop card, upload card, bubble ---------- */
  var CARD_SIZES = { dibsTrain: 2.2, wackerFly: 1.9 };
  var L_HEIGHT = 4.2;

  DP.kindInfo = function (kind) {
    if (PUPPETS[kind]) return { name: PUPPETS[kind].name, puppet: true, key: kind };
    if (kind === 'dibsTrain') return { name: 'Dibs on the L', svg: A.characters.dibsTrain, h: 1.35 };
    if (kind === 'wackerFly') return { name: 'Wacker flying', svg: A.characters.wackerFly, h: 1.7 };
    if (kind.indexOf('symbol:') === 0) {
      var n = kind.slice(7);
      return A.symbols[n] ? { name: n.replace(/-/g, ' '), svg: A.symbols[n], h: 1.25 } : null;
    }
    if (kind.indexOf('the-l:') === 0) {
      var c = kind.slice(6);
      return A.theL[c] ? { name: 'The L, ' + (DP.L_NAMES[c] || c), svg: A.theL[c], h: L_HEIGHT, big: true, drop: 0.07 } : null;
    }
    if (kind.indexOf('costume:') === 0) {
      var cs = DP.costumeInfo(kind.slice(8));
      return cs ? { name: cs.name, svg: A.costumes[cs.id], h: 1.1 } : null;
    }
    if (kind.indexOf('bubble:') === 0) {
      var b = DP.BUBBLES.filter(function (x) { return x.id === kind.slice(7); })[0];
      return b ? { name: b.name, bubble: b.id, h: 1.2, lift: true } : null;
    }
    if (kind.indexOf('upload:') === 0) return { name: 'Picture', upload: true, h: 1.6 };
    return null;
  };
  DP.kindDefaults = function (kind) {
    if (kind.indexOf('bubble:') === 0) { var d = DP.bubbleDefaults(kind.slice(7)); d.y = 1.9; return d; }
    return {};
  };

  /* speech bubble art is remembered, so a line that comes back (a movie shot, an undo) does not redraw. The newest 40 stay. */
  var bubbleCache = {}, bubbleKeys = [];
  function bubblePrep(shape, text, color, tail) {
    var key = [shape, text, color, tail].join('\u0001');
    if (!bubbleCache[key]) {
      bubbleCache[key] = DP.fontReady().then(function () { return DP.prepArt(DP.bubbleCanvas({ shape: shape, text: text, color: color, tail: tail })); });
      bubbleKeys.push(key);
      if (bubbleKeys.length > 40) delete bubbleCache[bubbleKeys.shift()];
    }
    return bubbleCache[key];
  }
  var uploadsRef = {};
  /* art for something held or worn: returns a promise of {prep, aspect} */
  function artFor(rec) {
    var k = rec.kind;
    if (k.indexOf('costume:') === 0) { var cs = DP.costumeInfo(k.slice(8)); return cs ? cachedPrep(A.costumes[cs.id]) : Promise.reject(new Error('no costume')); }
    if (k.indexOf('symbol:') === 0) return A.symbols[k.slice(7)] ? cachedPrep(A.symbols[k.slice(7)]) : Promise.reject(new Error('no symbol'));
    if (k.indexOf('upload:') === 0) {
      var up = uploadsRef[k.slice(7)]; if (!up) return Promise.reject(new Error('no upload'));
      return loadImage(up.data).then(function (im) { return DP.prepArt(im); });
    }
    if (k.indexOf('bubble:') === 0) {
      return bubblePrep(k.slice(7), rec.text, rec.color, rec.tail);
    }
    return Promise.reject(new Error('cannot hold that'));
  }

  /* Build the 3D object for an item record. Returns a promise of an object with root, apply(item), dispose(). */
  DP.buildItem = function (item, uploads) {
    uploadsRef = uploads || uploadsRef;
    var info = DP.kindInfo(item.kind);
    if (!info) return Promise.reject(new Error('unknown item ' + item.kind));
    var root = new THREE.Group();
    var tilt = new THREE.Group();
    root.add(tilt);
    var obj = { root: root, tilt: tilt, kind: item.kind, id: item.id, info: info, extras: {} };
    var standMesh = null, rod = null, rodMat = null, strMesh = null;
    var emote = null, emSeq = 0, emSig = '', atts = {}, atSeq = 0, atSig = '';

    function emoteSize() {
      if (obj.puppet) return obj.puppet.S * 0.34;
      return Math.max(0.45, Math.min(1.6, 0.3 * Math.max(obj.w, obj.h)));
    }
    function placeEmote(it) {
      if (!emote || !it.emote) return;
      var sz = emoteSize() * (it.emote.s || 1), g = emote.grp;
      if (obj.puppet) {
        var pp = obj.puppet, ht = pp.u(pp.def.headTop[0], pp.def.headTop[1]);
        g.position.set(ht.x + (it.emote.x || 0) * pp.S * 0.55, ht.y + 0.08 + sz * 0.5, 0.14);
      } else {
        g.position.set((it.emote.x || 0) * obj.w * 0.5, obj.h + 0.1 + sz * 0.5 + 0.03, 0.14);
      }
      g.scale.set(sz, sz, 1);
    }
    function syncEmote(it) {
      var sig = it.emote ? it.emote.id : '';
      if (sig !== emSig) {
        emSig = sig; var seq = ++emSeq;
        if (emote) { emote.grp.parent && emote.grp.parent.remove(emote.grp); DP.disposeLayer(emote.layer); emote = null; }
        var ei = it.emote && DP.emoteInfo(it.emote.id);
        if (ei) cachedPrep(ei.svg, { square: true }).then(function (prep) {
          if (seq !== emSeq) return;
          var layer = DP.makeLayer(prep, 1, 1, { edgeZ: -0.004, backZ: -0.012 });
          var g = new THREE.Group(); g.add(layer);
          (obj.puppet ? obj.puppet.body : tilt).add(g);
          emote = { grp: g, layer: layer };
          placeEmote(it); if (DP.onChange) DP.onChange();
        });
      }
      placeEmote(it);
    }

    function attSize(rec, prep) {
      var pp = obj.puppet, S = pp.S, Wc, Hc, cs = rec.kind.indexOf('costume:') === 0 ? DP.costumeInfo(rec.kind.slice(8)) : null;
      if (cs && cs.slot !== 'hand' && cs.slot === (rec.slot === 'head' ? 'head' : rec.slot === 'neck' ? 'neck' : '')) {
        var an = pp.def.anchors[cs.slot]; Wc = S * an.w / cs.refW; Hc = Wc;
      } else if (cs) { Wc = Hc = S * (cs.hand || 0.5); }
      else if (rec.kind.indexOf('bubble:') === 0) { Wc = S * 1.1; Hc = Wc / prep.aspect; }
      else { var box = S * 0.5; Wc = prep.aspect >= 1 ? box : box * prep.aspect; Hc = prep.aspect >= 1 ? box / prep.aspect : box; }
      return { w: Wc * (rec.s || 1), h: Hc * (rec.s || 1) };
    }
    function attRef(rec) {
      var cs = rec.kind.indexOf('costume:') === 0 ? DP.costumeInfo(rec.kind.slice(8)) : null;
      if (cs) return cs.ref;
      if (rec.kind.indexOf('bubble:') === 0) return rec.slot === 'head' ? [50, 90] : [50, 50];
      return [50, 50];
    }
    function placeAtt(rec) {
      var a = atts[rec.id]; if (!a || !a.grp) return;
      var pp = obj.puppet, an = pp.anchorAt(rec.slot, rec.kind.indexOf('bubble:') === 0);
      if (!an) return;
      if (a.grp.parent !== an.parent) { a.grp.parent && a.grp.parent.remove(a.grp); an.parent.add(a.grp); }
      var sz = attSize(rec, a.prep), ref = attRef(rec);
      a.layer.scale.set(sz.w, sz.h, 1);
      a.layer.position.set((50 - ref[0]) / 100 * sz.w, (ref[1] - 50) / 100 * sz.h, 0);
      var lift = (rec.kind.indexOf('bubble:') === 0 && rec.slot === 'head') ? 0.05 * pp.S : 0;
      a.grp.position.set(an.pos.x + (rec.ox || 0) / 100 * pp.S, an.pos.y + (rec.oy || 0) / 100 * pp.S + lift, an.z + a.order * 0.002);
      a.grp.rotation.z = (rec.r || 0) * D2R;
    }
    function syncAtts(it) {
      if (!obj.puppet) return;
      var list = it.attach || [];
      var sig = list.map(function (a) { return [a.id, a.kind, a.slot, a.text || '', a.color || '', a.tail || ''].join('|'); }).join(';');
      if (sig !== atSig) {
        atSig = sig; var seq = ++atSeq;
        Object.keys(atts).forEach(function (id) { var a = atts[id]; if (a.grp) { a.grp.parent && a.grp.parent.remove(a.grp); DP.disposeLayer(a.layer); } });
        atts = {};
        list.forEach(function (rec, idx) {
          atts[rec.id] = { order: idx, grp: null };
          artFor(rec).then(function (prep) {
            if (seq !== atSeq) return;
            var sz = attSize(rec, prep);
            var layer = DP.makeLayer(prep, 1, 1, { edgeZ: -0.004, backZ: -0.012 });
            var g = new THREE.Group(); g.add(layer);
            atts[rec.id] = { order: idx, grp: g, layer: layer, prep: prep };
            placeAtt(rec); if (DP.onChange) DP.onChange();
            if (obj.onAttachReady) obj.onAttachReady();
          }, function () { /* a missing picture just does not show */ });
        });
      }
      list.forEach(placeAtt);
    }
    /* true while an emote or a held thing is still being drawn (the movie maker waits for this before it takes a frame) */
    obj.pending = function () {
      if (emSig && !emote) return true;
      return Object.keys(atts).some(function (id) { return !atts[id].grp; });
    };
    /* world position of a held thing, for Let go */
    obj.attachWorld = function (id) {
      var a = atts[id]; if (!a || !a.grp) return null;
      var v = new THREE.Vector3(); a.grp.updateWorldMatrix(true, false); a.grp.getWorldPosition(v); return v;
    };

    function setMount(it) {
      var m = it.mount || 'none', raised = it.y > 0.05;
      var airborne = (obj.puppet ? obj.puppet.pose.hop > 0.15 : false) || it.move === 'bounce';
      if (standMesh) standMesh.visible = !raised && !airborne;
      var want = raised && (m === 'stick' || m === 'string');
      if (!rod && want) {
        rodMat = new THREE.MeshStandardMaterial({ color: 0xd8b98a, roughness: 1 });
        rod = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10), rodMat);
        rod.castShadow = true; rod.receiveShadow = true; root.add(rod);
        strMesh = new THREE.Mesh(rod.geometry, new THREE.MeshStandardMaterial({ color: 0x2a2350, roughness: 1 }));
        root.add(strMesh);
      }
      if (rod) {
        var sc = it.scale || 1, h = it.y / sc;
        rod.visible = want && m === 'stick'; strMesh.visible = want && m === 'string';
        if (rod.visible) { rod.scale.set(0.028 / sc * 1.0, Math.max(0.01, h + 0.03), 0.028 / sc); rod.position.set(0, -h / 2 + 0.015, -0.07); }
        if (strMesh.visible) { var top = obj.h + 0.05, len = 40; strMesh.scale.set(0.007 / sc, len, 0.007 / sc); strMesh.position.set(0, top + len / 2, -0.03); strMesh.castShadow = false; }
      }
    }

    function finish(contentW, contentH, stand, puppet, thumb) {
      obj.w = contentW; obj.h = contentH; obj.puppet = puppet;
      if (stand) { standMesh = makeStand(contentW * 0.5, Math.max(0.35, contentH * 0.3)); root.add(standMesh); }
      obj.thumb = thumb;
      obj.apply = function (it) {
        root.position.set(it.x, it.y, it.z);
        root.rotation.set(0, it.yaw * D2R, 0);
        root.scale.set(it.scale * (it.flip ? -1 : 1), it.scale, it.scale);
        var mv = it.move || 'none';
        if (puppet) { tilt.rotation.x = -it.tilt * D2R; tilt.rotation.z = 0; tilt.position.set(0, 0, 0); tilt.scale.set(1, 1, 1); puppet.applyPose(it.pose || DP.defaultPose(), mv); }
        else {
          var rx = -it.tilt * D2R, rz = 0, py = 0, sx = 1, sy = 1, px = 0, big = Math.max(contentW, contentH);
          if (mv === 'bounce') { py = 0.12 * contentH; sx = 1.05; sy = 0.95; }
          else if (mv === 'tilt') { rz = 10 * D2R; }
          else if (mv === 'lean') { rx += 14 * D2R; }
          else if (mv === 'shiver') { rz = 2.5 * D2R; px = 0.012 * big; }
          else if (mv === 'slump') { rx += 9 * D2R; sy = 0.93; rz = 3 * D2R; }
          tilt.rotation.set(rx, 0, rz); tilt.position.set(px, py, 0); tilt.scale.set(sx, sy, 1);
        }
        setMount(it);
        syncEmote(it);
        syncAtts(it);
      };
      obj.dispose = function () {
        if (emote) DP.disposeLayer(emote.layer);
        Object.keys(atts).forEach(function (id) { if (atts[id].grp) DP.disposeLayer(atts[id].layer); });
        if (rod) { rod.material.dispose(); strMesh.material.dispose(); rod.geometry.dispose(); }
        if (puppet) puppet.dispose();
        else obj.layer && DP.disposeLayer(obj.layer);
      };
      obj.hitMeshes = function () {
        var out = puppet ? puppet.hitMeshes() : [obj.layer.userData.edge];
        Object.keys(atts).forEach(function (id) { if (atts[id].grp) out.push(atts[id].layer.userData.edge); });
        return out;
      };
      obj.apply(item);
      return obj;
    }

    if (info.puppet) {
      var pose = item.pose || DP.defaultPose();
      var pp = new Puppet(info.key, pose);
      return pp.build().then(function () {
        tilt.add(pp.root);
        var th = (function () {   // thumbnail: whole puppet composited
          var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d');
          pp.def.parts.forEach(function (id) { x.drawImage(pp.parts[id].prep.art, 0, 0, 128, 128); });
          return c.toDataURL('image/png');
        })();
        return finish(pp.S * 0.62, pp.S, true, pp, th);
      });
    }

    function fromPrep(prep) {
      var ch = info.h, cwd = info.h * prep.aspect;
      if (info.upload) { var mx = Math.max(cwd, ch), k = 1.6 / mx; cwd *= k; ch *= k; }
      else if (info.bubble) { cwd = 1.9; ch = cwd / prep.aspect; }
      else if (CARD_SIZES[item.kind]) { var kk = CARD_SIZES[item.kind] / cwd; cwd *= kk; ch *= kk; }
      var layer = DP.makeLayer(prep, cwd, ch);
      layer.position.y = ch / 2 + 0.03 - (info.drop || 0) * ch;
      tilt.add(layer);
      obj.layer = layer;
      var th = DP.thumb(prep.art, 96);
      return finish(cwd, ch, !info.big && !info.bubble, null, th);
    }
    if (info.upload) {
      var up = uploads && uploads[item.kind.slice(7)];
      if (!up) return Promise.reject(new Error('missing upload'));
      return loadImage(up.data).then(function (im) { return DP.prepArt(im); }).then(fromPrep);
    }
    if (info.bubble) {
      return bubblePrep(info.bubble, item.text, item.color, item.tail).then(fromPrep);
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
