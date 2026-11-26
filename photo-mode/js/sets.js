/* DIBS Photo Mode: backdrops. Each set is a stack of flat cut-paper layers at different depths,
   so they slide past each other when the camera moves. All drawings are original, simple closed shapes.
   Wide strips ("tile" layers) are drawn so their left and right ends match: shapes that cross an end are
   drawn again on the other side. That is what lets Paper loop repeat them forever without a seam. */
(function () {
  'use strict';
  var THREE = window.THREEPKG.THREE;
  var DP = window.DP = window.DP || {};

  var INK = '#2a2350';
  var K = 40;   // svg px per world unit

  /* ---------- paper textures ---------- */
  var paperTex = null;
  DP.paperTexture = function () {
    if (paperTex) return paperTex;
    var c = document.createElement('canvas'); c.width = c.height = 512;
    var x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 512);
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    x.lineCap = 'round';
    for (var i = 0; i < 2600; i++) {
      var px = rnd() * 512, py = rnd() * 512, a = rnd() * Math.PI, l = 3 + rnd() * 9;
      x.strokeStyle = rnd() < 0.5 ? 'rgba(90,70,30,' + (0.012 + rnd() * 0.022) + ')' : 'rgba(255,255,255,' + (0.05 + rnd() * 0.08) + ')';
      x.lineWidth = 0.6 + rnd() * 1.1;
      // draw wrapped so the tile repeats without seams
      for (var ox = -512; ox <= 512; ox += 512) for (var oy = -512; oy <= 512; oy += 512) {
        if (px + ox < -30 || px + ox > 542 || py + oy < -30 || py + oy > 542) continue;
        x.beginPath(); x.moveTo(px + ox, py + oy); x.lineTo(px + ox + Math.cos(a) * l, py + oy + Math.sin(a) * l); x.stroke();
      }
    }
    paperTex = new THREE.CanvasTexture(c);
    paperTex.wrapS = paperTex.wrapT = THREE.RepeatWrapping;
    paperTex.colorSpace = THREE.SRGBColorSpace;
    paperTex.anisotropy = DP.maxAniso;
    return paperTex;
  };

  /* ---------- tiny drawing kit (world units, y up from the layer bottom) ---------- */
  function Layer(W, H) { this.W = W; this.H = H; this.items = []; this.texts = []; this.tile = false; }
  function fx(v) { return Math.round(v * 100) / 100; }
  Layer.prototype.Y = function (y) { return fx((this.H - y) * K); };
  Layer.prototype.st = function (o) {
    o = o || {};
    var s = o.stroke === undefined ? INK : o.stroke;
    return (s ? ' stroke="' + s + '" stroke-width="' + fx((o.sw || 0.07) * K) + '" stroke-linejoin="round" stroke-linecap="round"' : '') + (o.op ? ' opacity="' + o.op + '"' : '');
  };
  /* every shape is a function of an x shift, so a tile layer can draw it again on the other side */
  Layer.prototype.add = function (a, b, fn) { this.items.push({ a: a, b: b, fn: fn }); return this; };
  Layer.prototype.rect = function (x, y, w, h, fill, o) {
    o = o || {}; var s = this;
    return this.add(x, x + w, function (dx) {
      return '<rect x="' + fx((x + dx) * K) + '" y="' + s.Y(y + h) + '" width="' + fx(w * K) + '" height="' + fx(h * K) + '"' + (o.r ? ' rx="' + fx(o.r * K) + '"' : '') + ' fill="' + fill + '"' + s.st(o) + '/>';
    });
  };
  /* a shape that runs off both ends of a strip (a ground band, a wall) */
  Layer.prototype.band = function (y, h, fill, o) { return this.rect(-3, y, 300, h, fill, o); };
  function xr(pts) { var a = Infinity, b = -Infinity; pts.forEach(function (q) { if (q[0] < a) a = q[0]; if (q[0] > b) b = q[0]; }); return [a, b]; }
  Layer.prototype.poly = function (pts, fill, o) {
    var s = this, e = xr(pts);
    return this.add(e[0], e[1], function (dx) {
      return '<polygon points="' + pts.map(function (q) { return fx((q[0] + dx) * K) + ',' + s.Y(q[1]); }).join(' ') + '" fill="' + fill + '"' + s.st(o) + '/>';
    });
  };
  Layer.prototype.line = function (pts, o) {
    var s = this, e = xr(pts);
    return this.add(e[0], e[1], function (dx) {
      return '<polyline points="' + pts.map(function (q) { return fx((q[0] + dx) * K) + ',' + s.Y(q[1]); }).join(' ') + '" fill="none"' + s.st(o) + '/>';
    });
  };
  /* many short straight strokes as one path: segs = [[x1,y1,x2,y2], ...] */
  Layer.prototype.path = function (segs, o) {
    var s = this, a = Infinity, b = -Infinity;
    segs.forEach(function (q) { a = Math.min(a, q[0], q[2]); b = Math.max(b, q[0], q[2]); });
    return this.add(a, b, function (dx) {
      return '<path d="' + segs.map(function (q) { return 'M' + fx((q[0] + dx) * K) + ' ' + s.Y(q[1]) + 'L' + fx((q[2] + dx) * K) + ' ' + s.Y(q[3]); }).join('') + '" fill="none"' + s.st(o) + '/>';
    });
  };
  Layer.prototype.circle = function (cx, cy, r, fill, o) {
    var s = this;
    return this.add(cx - r, cx + r, function (dx) {
      return '<circle cx="' + fx((cx + dx) * K) + '" cy="' + s.Y(cy) + '" r="' + fx(r * K) + '" fill="' + fill + '"' + s.st(o) + '/>';
    });
  };
  Layer.prototype.ellipse = function (cx, cy, rx, ry, fill, o) {
    var s = this;
    return this.add(cx - rx, cx + rx, function (dx) {
      return '<ellipse cx="' + fx((cx + dx) * K) + '" cy="' + s.Y(cy) + '" rx="' + fx(rx * K) + '" ry="' + fx(ry * K) + '" fill="' + fill + '"' + s.st(o) + '/>';
    });
  };
  /* a lumpy mass from overlapping circles, with one outline around the whole thing: list = [[x,y,r],...] */
  Layer.prototype.blob = function (list, fill, o) {
    o = o || {}; var sw = o.sw || 0.07, ink = o.stroke === undefined ? INK : o.stroke, self = this;
    if (ink) list.forEach(function (c) { self.circle(c[0], c[1], c[2] + sw / 2, ink, { stroke: null }); });
    list.forEach(function (c) { self.circle(c[0], c[1], c[2] - sw / 2, fill, { stroke: null }); });
    return this;
  };
  Layer.prototype.text = function (x, y, str, size, fill, o) { this.texts.push({ x: x, y: y, s: str, size: size, fill: fill, o: o || {} }); return this; };
  Layer.prototype.svg = function () {
    var W = this.W, out = [], tile = this.tile;
    this.items.forEach(function (it) {
      out.push(it.fn(0));
      if (tile) {
        if (it.a < 0 && it.b < W) out.push(it.fn(W));
        if (it.b > W && it.a > 0) out.push(it.fn(-W));
      }
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + fx(W * K) + ' ' + fx(this.H * K) + '">' + out.join('') + '</svg>';
  };
  function star6(cx, cy, r) {
    var a = [], i;
    for (i = 0; i < 12; i++) { var rr = i % 2 ? r * 0.5 : r, t = i / 12 * Math.PI * 2 + Math.PI / 2; a.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]); }
    return a;
  }
  var seedN = 3;
  function rnd() { seedN = (seedN * 16807) % 2147483647; return seedN / 2147483647; }

  /* a block of windows on a building */
  function windows(L, x, y, w, h, o) {
    o = o || {};
    var cw = o.cw || 0.45, ch = o.ch || 0.55, gx = o.gx || 0.42, gy = o.gy || 0.5;
    var cols = Math.max(1, Math.floor((w - 0.5) / (cw + gx))), rows = Math.max(1, Math.floor((h - 0.5) / (ch + gy)));
    var ox = x + (w - (cols * cw + (cols - 1) * gx)) / 2;
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var lit = rnd() < (o.lit || 0.25);
      L.rect(ox + c * (cw + gx), y + h - 0.35 - (r + 1) * ch - r * gy, cw, ch, lit ? (o.litc || '#fff3a8') : (o.dark || '#ffffff'), { stroke: o.wstroke === undefined ? null : o.wstroke, op: lit ? 1 : (o.wop || 0.55) });
    }
  }
  function building(L, x, w, h, fill, o) {
    o = o || {};
    L.rect(x, o.y0 || -0.2, w, h + 0.2 - (o.y0 || 0), fill, { sw: o.sw, stroke: o.stroke === undefined ? INK : o.stroke });
    if (o.win !== false) windows(L, x, 0.3, w, h - 0.3, o);
    if (o.roof) L.rect(x + w * 0.2, h, w * 0.6, o.roof, fill, { sw: o.sw, stroke: o.stroke === undefined ? INK : o.stroke });
    if (o.ant) L.line([[x + w / 2, h + (o.roof || 0)], [x + w / 2, h + (o.roof || 0) + o.ant]], { sw: 0.09 });
  }
  /* lay buildings side by side until the strip is long enough, then make the strip exactly that long (it tiles) */
  function row(L, to, wmin, wr, hmin, hr, gap, fn) {
    var x = 0, i = 0;
    while (x < to) { var w = wmin + rnd() * wr, h = hmin + rnd() * hr; fn(x, w, h, i++); x += w + gap; }
    L.W = x; L.tile = true;
    return x;
  }
  /* a wavy water band that tiles: top height, wave height, wave length (must divide the strip length) */
  function waterBand(L, top, amp, per, fill, o) {
    var pts = [[-3, -0.3]], x;
    for (x = -3; x <= L.W + 3.01; x += per / 8) pts.push([x, top + Math.sin(x / per * Math.PI * 2) * amp]);
    pts.push([L.W + 3, -0.3]);
    L.poly(pts, fill, o || { sw: 0.06 });
  }
  function glints(L, y0, y1, n, x0, x1, col, op) {
    for (var i = 0; i < n; i++) {
      var gx = x0 + rnd() * (x1 - x0), gy = y0 + rnd() * (y1 - y0), gl = 0.4 + rnd() * 1.0;
      L.line([[gx, gy], [gx + gl, gy]], { stroke: col, sw: 0.07, op: op || 0.8 });
    }
  }

  /* ---------- the sets ---------- */
  var SETS = {};

  SETS.skyline = {
    name: 'Chicago skyline', sky: '#b3ddf2', floor: '#cfe9c4', floorTone: 1,
    layers: function () {
      var out = [], L;
      // far haze
      L = new Layer(52, 15);
      seedN = 11;
      row(L, 50, 1.6, 2.2, 4, 8, 0.05, function (x, w, h) { building(L, x, w, h, '#a9cde6', { win: false, sw: 0.05, stroke: null }); });
      out.push({ L: L, x: 0, y: 0, z: -19 });
      // mid towers
      L = new Layer(46, 22); L.tile = true;
      seedN = 21;
      var x = 0;
      var spec = [[3, 8], [2.4, 11], [3.2, 14], [2.2, 9], [0, 0], [2.8, 12], [2.6, 8.5], [3, 10.5], [0, 1], [3.4, 13], [2.4, 7], [2.8, 11], [3.2, 9]];
      spec.forEach(function (s) {
        if (s[0] === 0 && s[1] === 0) {
          // tall stepped tower with two antennas
          var bx = x;
          L.rect(bx, -0.2, 4.4, 14, '#7fa9cf', {}); L.rect(bx + 0.5, 14, 1.4, 4, '#7fa9cf', {}); L.rect(bx + 2.5, 14, 1.4, 4, '#7fa9cf', {}); L.rect(bx + 1.1, 9, 2.2, 5.5, '#7fa9cf', { sw: 0.0001, stroke: null });
          L.rect(bx + 0.5, 18, 1.4, 2, '#7fa9cf', {}); L.rect(bx + 2.5, 18, 1.4, 1, '#7fa9cf', {});
          L.line([[bx + 1.2, 20], [bx + 1.2, 22]], { sw: 0.1 }); L.line([[bx + 3.2, 19], [bx + 3.2, 21.5]], { sw: 0.1 });
          windows(L, bx, 0.3, 4.4, 13.5, { cw: 0.4, ch: 0.5, gx: 0.45, gy: 0.5 });
          x += 4.5; return;
        }
        if (s[0] === 0 && s[1] === 1) {
          // tapered tower with antennas
          L.poly([[x, -0.2], [x + 3.8, -0.2], [x + 3.2, 17], [x + 0.6, 17]], '#6f9bc4', {});
          L.line([[x + 1.4, 17], [x + 1.4, 20.5]], { sw: 0.1 }); L.line([[x + 2.4, 17], [x + 2.4, 20.5]], { sw: 0.1 });
          L.line([[x + 0.3, 6], [x + 3.5, 12]], { sw: 0.07 }); L.line([[x + 3.5, 6], [x + 0.3, 12]], { sw: 0.07 });
          x += 3.9; return;
        }
        building(L, x, s[0], s[1], rnd() < 0.5 ? '#8db8dc' : '#7ca6cc', { cw: 0.4, ch: 0.5, gx: 0.38, gy: 0.46, roof: rnd() < 0.4 ? 0.5 : 0 });
        x += s[0] + 0.1;
      });
      L.W = x + 0.6;
      out.push({ L: L, x: 0, y: 0, z: -13 });
      // near layer: park, trees and the water tower
      L = new Layer(44, 9); L.tile = true;
      // water tower: cream limestone castle with a roof tower
      var tx = 22;
      L.rect(tx, 0, 3.8, 3.4, '#ecdfba', { r: 0.05 });
      L.rect(tx + 0.15, 3.4, 0.9, 0.5, '#ecdfba', {}); L.rect(tx + 1.5, 3.4, 0.9, 0.5, '#ecdfba', {}); L.rect(tx + 2.75, 3.4, 0.9, 0.5, '#ecdfba', {});
      L.rect(tx + 1.1, 3.4, 1.6, 5.2, '#ecdfba', {});
      L.poly([[tx + 0.95, 8.6], [tx + 1.9, 9.0], [tx + 2.85, 8.6]], '#c9b98c', {}); // little cap (clipped at layer top is fine)
      L.rect(tx + 1.4, 4.2, 0.5, 1.0, '#8a7d58', { r: 0.2 }); L.rect(tx + 1.4, 6.4, 0.5, 1.0, '#8a7d58', { r: 0.2 });
      L.rect(tx + 0.3, 0.9, 0.5, 1.2, '#8a7d58', { r: 0.2 }); L.rect(tx + 1.7, 0.2, 0.5, 1.7, '#8a7d58', { r: 0.2 }); L.rect(tx + 3.0, 0.9, 0.5, 1.2, '#8a7d58', { r: 0.2 });
      // trees
      [[4, 5.2], [10, 4.2], [17.5, 4.9], [31, 5.6], [36, 4.0], [41, 5.0]].forEach(function (t, i) {
        L.rect(t[0] - 0.12, 0, 0.24, t[1] * 0.45, '#8a6a4a', {});
        L.circle(t[0], t[1] * 0.62, t[1] * 0.4, i % 2 ? '#8fcf93' : '#a6dc9f', {});
        L.circle(t[0] - 0.45, t[1] * 0.52, t[1] * 0.26, i % 2 ? '#a6dc9f' : '#8fcf93', { stroke: null });
      });
      // lamp post with a small flag-colored banner
      L.line([[14, 0], [14, 4.6]], { sw: 0.12 });
      L.rect(14.1, 3.2, 0.9, 1.2, '#ffffff', {});
      L.rect(14.1, 3.55, 0.9, 0.18, '#b3ddf2', { stroke: null }); L.rect(14.1, 3.95, 0.9, 0.18, '#b3ddf2', { stroke: null });
      L.poly(star6(14.55, 3.82, 0.16), '#ff0000', { stroke: null });
      out.push({ L: L, x: 0, y: 0, z: -8 });
      return out;
    }
  };

  SETS.lplatform = {
    name: 'L platform', sky: '#c6e0f7', floor: '#ddd6c8',
    layers: function () {
      var out = [], L, x;
      L = new Layer(52, 13); seedN = 5;
      row(L, 50, 1.8, 2.6, 3, 7, 0.08, function (x, w, h) { building(L, x, w, h, rnd() < 0.5 ? '#c9a58f' : '#b58e7a', { cw: 0.4, ch: 0.5, gx: 0.45, gy: 0.5, lit: 0.18 }); });
      out.push({ L: L, x: 0, y: 0, z: -22 });
      // the elevated track wall with girders
      L = new Layer(48, 6); L.tile = true;
      L.band(0, 1.1, '#6f6b86', {});
      L.band(1.1, 0.28, '#4a4466', { stroke: null });
      for (x = 0.8; x < 48; x += 2.4) { L.line([[x, 1.1], [x + 1.2, 0.0]], { sw: 0.06 }); L.line([[x + 1.2, 0.0], [x + 2.4, 1.1]], { sw: 0.06 }); }
      out.push({ L: L, x: 0, y: 0, z: -11 });
      // the L car, red and blue line stripes
      L = new Layer(11, 4.2);
      L.rect(0.1, 0.5, 10.8, 3.1, '#d7dbe6', { r: 0.5 });
      L.rect(0.1, 1.05, 10.8, 0.5, '#e2362f', { stroke: null }); L.rect(0.1, 0.58, 10.8, 0.3, '#2f7fd0', { stroke: null });
      L.line([[0.1, 1.05], [10.9, 1.05]], { sw: 0.05 }); L.line([[0.1, 1.55], [10.9, 1.55]], { sw: 0.05 });
      for (var i = 0; i < 5; i++) L.rect(0.7 + i * 2.1, 1.9, 1.3, 1.1, '#3a4a63', { r: 0.14 });
      L.rect(10.3, 1.7, 0.4, 1.5, '#fff3a8', { r: 0.1 });
      L.circle(1.7, 0.5, 0.34, '#4b4a5e', {}); L.circle(3.0, 0.5, 0.34, '#4b4a5e', {}); L.circle(8.0, 0.5, 0.34, '#4b4a5e', {}); L.circle(9.3, 0.5, 0.34, '#4b4a5e', {});
      out.push({ L: L, x: -6.5, y: 1.1, z: -9.4 });
      // canopy, columns and the station sign (in front, tall, out of the way)
      L = new Layer(50, 9); L.tile = true;
      L.band(7.2, 0.5, '#4a4466', {});
      L.band(7.7, 1.2, '#7d62b8', {});
      [5, 15, 25, 35, 45].forEach(function (cx) { L.rect(cx - 0.28, 0, 0.56, 7.2, '#8f8aa8', {}); L.rect(cx - 0.45, 0, 0.9, 0.3, '#4a4466', { stroke: null }); });
      L.rect(18, 5.2, 4.6, 1.5, '#ffffff', { r: 0.12 }); L.rect(18, 5.2, 4.6, 0.32, '#e2362f', { stroke: null }); L.rect(18, 5.2, 4.6, 1.5, 'none', { r: 0.12 });
      L.line([[19.4, 6.7], [19.4, 7.2]], { sw: 0.06 }); L.line([[21.2, 6.7], [21.2, 7.2]], { sw: 0.06 });
      L.text(18.4, 5.75, 'Wacker Dr', 0.6, INK, { w: 4.0 });
      out.push({ L: L, x: 0, y: 0, z: -4.8 });
      // yellow edge strip on the platform
      var D = new Layer(60, 0.8); D.tile = true; D.band(0, 0.8, '#f2c230', { stroke: null }); D.band(0.74, 0.12, INK, { stroke: null });
      out.push({ L: D, x: 0, y: 0.012, z: -4.0, flat: true });
      return out;
    }
  };

  SETS.wacker = {
    name: 'Lower Wacker', sky: '#2b2840', floor: '#5b5675', dim: true,
    layers: function () {
      var out = [], L, x;
      // far tunnel wall
      L = new Layer(50, 14); L.tile = true;
      L.band(0, 14, '#3a3656', { stroke: null });
      for (x = 3; x < 50; x += 10) { L.rect(x, 0, 6.5, 6.2, '#25223a', { r: 0.1 }); L.poly([[x, 6.2], [x + 6.5, 6.2], [x + 3.25, 7.6]], '#25223a', {}); }
      for (x = 0; x < 50; x += 2.5) L.rect(x, 9, 0.18, 5, '#2f2b4a', { stroke: null });
      out.push({ L: L, x: 0, y: 0, z: -16 });
      // pillars
      L = new Layer(50, 14); L.tile = true;
      [3, 13, 23, 33, 43].forEach(function (cx) { L.rect(cx - 0.8, 0, 1.6, 14, '#6a6590', {}); L.rect(cx - 1.1, 0, 2.2, 0.5, '#4a4568', {}); L.rect(cx - 1.1, 13.2, 2.2, 0.8, '#4a4568', {}); L.rect(cx - 0.8, 1.0, 1.6, 0.35, '#f2c230', { stroke: null }); });
      L.band(12.2, 0.35, '#4a4568', { stroke: null });
      out.push({ L: L, x: 0, y: 0, z: -7.5 });
      // ceiling girders and pipes
      L = new Layer(50, 5); L.tile = true;
      L.band(3.4, 1.6, '#4a4568', {});
      for (x = 0; x < 50; x += 3.125) L.rect(x, 3.4, 0.4, 1.6, '#35314f', { stroke: null });
      L.band(3.0, 0.4, '#7a6a52', {});
      // lamps (bulb part is the emissive layer)
      [6, 16, 26, 36, 46].forEach(function (lx) { L.line([[lx, 3.4], [lx, 2.2]], { sw: 0.07 }); L.rect(lx - 0.5, 1.7, 1.0, 0.55, '#6a6590', { r: 0.2 }); });
      out.push({ L: L, x: 0, y: 7.2, z: -3.4, deckle: false });
      // light cones and bulbs (vellum, crisp)
      L = new Layer(50, 10); L.tile = true;
      [6, 16, 26, 36, 46].forEach(function (lx) {
        L.poly([[lx - 0.4, 8.7], [lx + 0.4, 8.7], [lx + 2.3, 0], [lx - 2.3, 0]], '#f6b84a', { stroke: null, op: 0.15 });
        L.rect(lx - 0.35, 8.65, 0.7, 0.3, '#ffd27a', { r: 0.12, stroke: null });
      });
      out.push({ L: L, x: 0, y: 0, z: -3.3, vellum: true });
      // dashed center line on the road
      var D = new Layer(60, 0.6); D.tile = true;
      for (x = 0; x < 60; x += 3) D.rect(x, 0.1, 1.6, 0.35, '#f2c230', { stroke: null });
      out.push({ L: D, x: 0, y: 0.012, z: -2.0, flat: true });
      return out;
    },
    lamps: [6, 16, 26, 36, 46]
  };

  SETS.hotdog = {
    name: 'Hot dog stand', sky: '#cfe7f5', floor: '#e6dfcf',
    layers: function () {
      var out = [], L, x;
      // brick row of buildings
      L = new Layer(50, 16);
      seedN = 9;
      row(L, 48, 4, 3, 8, 7, 0.05, function (x, w, h) {
        L.rect(x, -0.2, w, h + 0.2, rnd() < 0.5 ? '#d68a67' : '#c47a5c', {});
        windows(L, x, 0.5, w, h - 0.5, { cw: 0.7, ch: 0.9, gx: 0.6, gy: 0.9, lit: 0.2, dark: '#f4ead0', wop: 1 });
        L.rect(x - 0.1, h, w + 0.2, 0.4, '#a85f45', {});
      });
      out.push({ L: L, x: 0, y: 0, z: -15 });
      // low wall and a street lamp on the left
      L = new Layer(40, 7); L.tile = true;
      L.band(0, 1.4, '#e5dcc4', {});
      for (x = 0.5; x < 40; x += 2) L.line([[x, 0], [x, 1.4]], { sw: 0.04 });
      [[5, 6.2], [30, 5.6]].forEach(function (t, i) { L.rect(t[0] - 0.15, 1.4, 0.3, 1.6, '#8a6a4a', {}); L.circle(t[0], 3.6, 1.5, i ? '#8fcf93' : '#a6dc9f', {}); L.circle(t[0] - 0.7, 3.2, 0.9, i ? '#a6dc9f' : '#8fcf93', { stroke: null }); });
      L.line([[16, 1.4], [16, 5.8]], { sw: 0.12 }); L.line([[16, 5.8], [16.9, 5.8]], { sw: 0.12 }); L.circle(17, 5.65, 0.32, '#fff3a8', {});
      out.push({ L: L, x: 0, y: 0, z: -9 });
      // the cart
      L = new Layer(7.4, 7);
      // umbrella
      L.line([[3.7, 1.6], [3.7, 6.0]], { sw: 0.12 });
      var seg = ['#e2362f', '#fff3a8', '#e2362f', '#fff3a8', '#e2362f', '#fff3a8'];
      for (var i = 0; i < 6; i++) {
        var a0 = i / 6, a1 = (i + 1) / 6;
        L.poly([[0.2 + 7.0 * a0, 5.0], [0.2 + 7.0 * a1, 5.0], [3.7 + (a1 - 0.5) * 1.0, 6.3], [3.7 + (a0 - 0.5) * 1.0, 6.3]], seg[i], {});
      }
      L.poly([[0.2, 5.0], [7.2, 5.0], [6.4, 5.35], [0.9, 5.35]], '#c82a24', { stroke: null });
      // cart body
      L.rect(0.7, 1.0, 6.0, 2.2, '#f7c948', { r: 0.2 });
      L.rect(0.7, 2.7, 6.0, 0.5, '#e2362f', { stroke: null });
      L.rect(0.7, 1.0, 6.0, 2.2, 'none', { r: 0.2 });
      L.rect(0.5, 3.2, 6.4, 0.34, '#d5d0e8', { r: 0.1 });
      L.rect(1.0, 1.3, 2.5, 1.2, '#ffffff', { r: 0.12 });
      L.rect(4.0, 1.3, 2.4, 1.2, '#c6e0f7', { r: 0.12 });
      // hot dog picture
      L.rect(4.2, 1.62, 2.0, 0.55, '#e8b46a', { r: 0.27 });
      L.rect(4.35, 1.94, 1.7, 0.2, '#e2362f', { r: 0.1, stroke: null });
      L.rect(4.35, 2.04, 1.7, 0.16, '#6fd14a', { r: 0.08, stroke: null });
      L.circle(1.9, 0.62, 0.62, '#4b4a5e', {}); L.circle(1.9, 0.62, 0.22, '#d6d9e6', { stroke: null });
      L.circle(5.6, 0.62, 0.62, '#4b4a5e', {}); L.circle(5.6, 0.62, 0.22, '#d6d9e6', { stroke: null });
      L.line([[0.7, 1.9], [0.0, 1.9]], { sw: 0.12 });
      L.text(1.15, 1.65, 'HOT DOGS', 0.4, INK, { w: 2.2 });
      out.push({ L: L, x: 3.0, y: 0, z: -4.6 });
      return out;
    }
  };

  SETS.river = {
    name: 'Chicago River', sky: '#c6e0f7', floor: '#79c1ab', waves: true,
    layers: function () {
      var out = [], L, x;
      L = new Layer(54, 17);
      seedN = 31;
      row(L, 52, 2, 3, 5, 10, 0.06, function (x, w, h) { building(L, x, w, h, rnd() < 0.5 ? '#dcd2bb' : '#c9d3df', { cw: 0.45, ch: 0.55, gx: 0.42, gy: 0.52, lit: 0.12, roof: rnd() < 0.3 ? 0.6 : 0 }); });
      out.push({ L: L, x: 0, y: 0, z: -20 });
      // river banks: stone embankment
      L = new Layer(50, 3.2); L.tile = true;
      L.band(0, 2.2, '#b8b09a', {});
      for (x = 0.5; x < 50; x += 3.125) L.line([[x, 0], [x, 2.2]], { sw: 0.05 });
      L.band(2.2, 0.4, '#8f8aa8', {}); for (x = 0.4; x < 50; x += 1.25) L.rect(x, 2.6, 0.18, 0.5, '#8f8aa8', { stroke: null });
      out.push({ L: L, x: 0, y: 0, z: -12 });
      // bascule bridge with trusses
      L = new Layer(30, 9);
      L.rect(0, 3.0, 30, 0.7, '#4f78b4', {}); L.rect(0, 3.7, 30, 0.2, '#2a2350', { stroke: null });
      [3, 27].forEach(function (cx) { L.rect(cx - 0.9, 0, 1.8, 3.0, '#6f93c8', {}); });
      for (x = 3; x < 27; x += 2) { L.line([[x, 3.7], [x + 1, 7.4]], { sw: 0.07 }); L.line([[x + 1, 7.4], [x + 2, 3.7]], { sw: 0.07 }); }
      L.line([[3, 7.4], [27, 7.4]], { sw: 0.12 });
      L.line([[3, 3.7], [3, 7.4]], { sw: 0.12 }); L.line([[27, 3.7], [27, 7.4]], { sw: 0.12 });
      L.rect(11, 2.2, 8, 0.5, '#e2362f', { stroke: null });
      out.push({ L: L, x: -3, y: 0.4, z: -9.5 });
      // tour boat
      L = new Layer(7, 4);
      L.poly([[0.3, 1.0], [6.7, 1.0], [6.0, 0.1], [1.0, 0.1]], '#ffffff', {});
      L.rect(0.3, 0.55, 6.4, 0.3, '#e2362f', { stroke: null });
      L.rect(1.3, 1.0, 3.8, 1.3, '#f4ead0', { r: 0.14 });
      for (var i = 0; i < 4; i++) L.rect(1.55 + i * 0.9, 1.45, 0.6, 0.55, '#c6e0f7', { r: 0.08 });
      L.rect(2.0, 2.3, 2.4, 0.2, '#e2362f', { r: 0.06 });
      L.line([[5.6, 1.0], [5.6, 3.4]], { sw: 0.08 });
      L.rect(5.6, 2.6, 1.2, 0.8, '#ffffff', {});
      L.rect(5.6, 2.8, 1.2, 0.14, '#b3ddf2', { stroke: null }); L.rect(5.6, 3.12, 1.2, 0.14, '#b3ddf2', { stroke: null });
      L.poly(star6(6.0, 3.0, 0.1), '#ff0000', { stroke: null }); L.poly(star6(6.4, 3.0, 0.1), '#ff0000', { stroke: null });
      out.push({ L: L, x: -7, y: 0.05, z: -4.8 });
      return out;
    }
  };

  /* ======================================================================================
     Seven more Chicago places. All original cut-paper drawings: no Bean, no team logos, no
     CTA logo, no brand names. Each is 3 to 6 depth layers plus a floor.
     ====================================================================================== */

  /* ---------- 1. Lakefront at sunset ---------- */
  SETS.lakefront = {
    name: 'Lakefront sunset', sky: '#ffb892', floor: '#ecd8ab', light: 'golden',
    layers: function () {
      var out = [], L, x, i;
      // sunset sky, a sun sinking into the lake, and the skyline across the water
      L = new Layer(60, 30); L.tile = true; seedN = 41;
      [['#ffe9b0', 0, 4.4], ['#ffd29b', 4.4, 3], ['#ffb68f', 7.4, 3.2], ['#f99da4', 10.6, 3.6], ['#d98cb8', 14.2, 4], ['#ab8bd2', 18.2, 4.6], ['#7f84cb', 22.8, 7.4]].forEach(function (b) { L.band(b[1], b[2], b[0], { stroke: null }); });
      L.circle(30, 4.3, 5.4, '#fff0c0', { stroke: null, op: 0.3 }); L.circle(30, 4.3, 4.1, '#fff0c0', { stroke: null, op: 0.45 }); L.circle(30, 4.3, 2.9, '#fff8d8', { stroke: null });
      for (i = 0; i < 9; i++) {
        var cx = rnd() * 60, cy = 7 + rnd() * 13, cw = 3 + rnd() * 6;
        L.rect(cx, cy, cw, 0.34, i % 2 ? '#ffc8b0' : '#f7a9bf', { r: 0.17, stroke: null, op: 0.9 });
        L.rect(cx + cw * 0.2, cy + 0.5, cw * 0.6, 0.26, i % 2 ? '#f7a9bf' : '#ffc8b0', { r: 0.13, stroke: null, op: 0.9 });
      }
      for (i = 0; i < 5; i++) { var gx = 5 + rnd() * 50, gy = 8 + rnd() * 8; L.line([[gx - 0.5, gy + 0.18], [gx, gy], [gx + 0.5, gy + 0.18]], { sw: 0.06 }); L.line([[gx + 0.8, gy - 0.1], [gx + 1.2, gy - 0.28], [gx + 1.7, gy - 0.1]], { sw: 0.06 }); }
      x = 0;
      while (x < 60) {
        var w = 1.4 + rnd() * 2.2, h = 1.6 + rnd() * 4.2;
        if (x > 21 && x < 39) { x += w + 0.04; continue; }
        L.rect(x, 3.0, w, h, '#74639f', { stroke: null });
        windows(L, x, 3.3, w, h - 0.3, { cw: 0.22, ch: 0.3, gx: 0.3, gy: 0.38, lit: 0.14, litc: '#ffe08a', dark: '#74639f', wop: 1 });
        x += w + 0.04;
      }
      // a few tall ones: stepped, tapered with twin antennas, and a rounded one
      L.rect(10, 3.0, 3.2, 8, '#5f4f93', { stroke: null }); L.rect(10.6, 11, 2, 2, '#5f4f93', { stroke: null }); L.rect(11.4, 13, 0.4, 2, '#5f4f93', { stroke: null });
      L.poly([[43, 3.0], [47, 3.0], [46.3, 11.5], [43.7, 11.5]], '#5f4f93', { stroke: null }); L.rect(44.2, 11.5, 0.22, 2.4, '#5f4f93', { stroke: null }); L.rect(45.5, 11.5, 0.22, 2.4, '#5f4f93', { stroke: null });
      L.rect(51, 3.0, 3, 7, '#5f4f93', { stroke: null }); L.ellipse(52.5, 10, 1.5, 0.8, '#5f4f93', { stroke: null });
      out.push({ L: L, x: 0, y: 0, z: -25 });
      // far water with a sailboat and the sun's glitter
      L = new Layer(60, 7); L.tile = true; seedN = 43;
      L.poly([[16.7, 3.9], [19.7, 3.9], [19.0, 3.2], [17.4, 3.2]], '#ffffff', {});
      L.poly([[18.0, 4.0], [18.0, 6.7], [19.5, 4.0]], '#fff6e0', {}); L.poly([[17.8, 4.0], [17.8, 5.9], [16.6, 4.0]], '#ffd7a0', {});
      L.line([[18.0, 3.9], [18.0, 6.8]], { sw: 0.07 });
      waterBand(L, 3.6, 0.12, 7.5, '#8d89d6');
      glints(L, 2.4, 3.5, 30, 22, 38, '#ffd9b0', 0.85);
      glints(L, 1.4, 3.5, 12, 0, 60, '#b9b6ee', 0.8);
      out.push({ L: L, x: 0, y: 0, z: -20 });
      // nearer water, darker
      L = new Layer(60, 4.6); L.tile = true; seedN = 47;
      L.poly([[40, 3.2], [43.4, 3.2], [42.8, 2.5], [40.6, 2.5]], '#ffd0d8', {}); L.rect(40.9, 3.2, 1.6, 0.6, '#ffffff', { r: 0.1 });
      waterBand(L, 2.8, 0.14, 6, '#6c70c4');
      glints(L, 1.4, 2.6, 22, 22, 40, '#ffc8a8', 0.75);
      glints(L, 0.8, 2.6, 10, 0, 60, '#a7a5e8', 0.8);
      out.push({ L: L, x: 0, y: 0, z: -13 });
      // limestone revetment steps along the shore
      L = new Layer(50, 3.4); L.tile = true; seedN = 51;
      for (i = 0; i < 3; i++) {
        var by = i * 0.62, bx = -rnd() * 2;
        L.band(by, 0.62, ['#d9d1c0', '#cfc7b5', '#e3dccb'][i], {});
        while (bx < 52) { var bw = 1.2 + rnd() * 1.6; L.line([[bx + bw, by], [bx + bw, by + 0.62]], { sw: 0.05 }); bx += bw; }
      }
      L.band(1.86, 0.2, '#eee8d8', {});
      for (x = 3; x < 50; x += 12.5) { L.ellipse(x + 1, 2.2, 0.9, 0.5, '#bdb5a2', {}); L.ellipse(x + 2.1, 2.1, 0.55, 0.35, '#cfc7b5', {}); }
      out.push({ L: L, x: 0, y: 0, z: -8 });
      // sand, beach grass and rocks
      L = new Layer(50, 2.4); L.tile = true; seedN = 53;
      var dune = [[-3, 0]];
      for (x = -3; x <= 53.01; x += 0.5) dune.push([x, 0.75 + 0.32 * Math.sin(x / 12.5 * Math.PI * 2) + 0.16 * Math.sin(x / 5 * Math.PI * 2 + 1)]);
      dune.push([53, 0]);
      L.poly(dune, '#f3e0b6', {});
      for (i = 0; i < 40; i++) L.circle(rnd() * 50, 0.15 + rnd() * 0.4, 0.04, '#d5b783', { stroke: null });
      [6, 19, 33, 45].forEach(function (gx) { for (var k = 0; k < 5; k++) L.line([[gx + k * 0.12, 0.9], [gx + (k - 2) * 0.3, 1.9 + (k % 2) * 0.35]], { stroke: '#8fb06a', sw: 0.08 }); });
      L.poly([[26, 0.8], [26.6, 1.5], [27.8, 1.6], [28.5, 0.9]], '#cfc7b5', {}); L.poly([[28.4, 0.9], [28.9, 1.35], [29.8, 1.2], [30, 0.7]], '#bdb5a2', {});
      out.push({ L: L, x: 0, y: 0, z: -4.4 });
      return out;
    }
  };

  /* ---------- 2. Michigan Avenue and the old stone water tower ---------- */
  SETS.michave = {
    name: 'Michigan Ave', sky: '#c6e0f7', floor: '#dcd6c9', light: 'noon',
    layers: function () {
      var out = [], L, x, i;
      L = new Layer(54, 21); seedN = 61;
      row(L, 52, 2.6, 2.6, 8, 11, 0.05, function (x, w, h) { building(L, x, w, h, rnd() < 0.5 ? '#c3d2e6' : '#b4c4dc', { cw: 0.42, ch: 0.52, gx: 0.4, gy: 0.5, lit: 0.1, roof: rnd() < 0.4 ? 0.7 : 0, ant: rnd() < 0.25 ? 1.6 : 0 }); });
      out.push({ L: L, x: 0, y: 0, z: -23 });
      // shop facades with striped awnings
      L = new Layer(54, 12.5); seedN = 63;
      var awn = [['#e2362f', '#ffffff'], ['#2f7fd0', '#ffffff'], ['#2f9d6a', '#fff3a8'], ['#7d62b8', '#ffffff'], ['#f2a33a', '#ffffff']];
      var stone = ['#eadfc4', '#dad5c8', '#d68a67', '#cdd6e0', '#e6d2b0'], dark = ['#c9bc9a', '#b8b3a6', '#b46b4b', '#aeb8c6', '#c8b08a'];
      row(L, 50, 5.4, 3, 7.5, 3.5, 0.0, function (x, w, h, k) {
        var c = k % 5, a = awn[(k * 2 + 1) % 5];
        L.rect(x, -0.2, w, h + 0.2, stone[c], {});
        L.rect(x - 0.1, h, w + 0.2, 0.38, dark[c], {});
        windows(L, x, 3.3, w, h - 3.3, { cw: 0.62, ch: 1.0, gx: 0.5, gy: 0.7, lit: 0.12, dark: '#a6c3dc', wop: 1, wstroke: INK });
        L.rect(x + 0.3, 0.25, w - 0.6, 2.25, '#bcd9ee', { r: 0.1 });
        L.rect(x + w * 0.5 - 0.35, 0.25, 0.7, 1.9, '#4a4466', { r: 0.08 });
        var n = Math.max(4, Math.round(w / 0.7)), sw = (w - 0.1) / n;
        for (var s = 0; s < n; s++) L.poly([[x + 0.05 + s * sw, 3.15], [x + 0.05 + (s + 1) * sw, 3.15], [x + 0.18 + (s + 1) * sw - 0.13, 2.55], [x + 0.18 + s * sw - 0.13, 2.55]], s % 2 ? a[1] : a[0], { sw: 0.05 });
        L.rect(x + 0.25, 2.4, w - 0.5, 0.12, dark[c], { stroke: null });
      });
      out.push({ L: L, x: 0, y: 0, z: -15 });
      // the old water tower: pale limestone castle with turrets and battlements
      L = new Layer(10.6, 14.6);
      var lime = '#ede3c0', limeD = '#d8cca3', win = '#7d6e48';
      function merlons(x0, x1, y, h, c) { var n = Math.max(2, Math.round((x1 - x0) / 0.62)), mw = (x1 - x0) / (2 * n - 1); for (var k = 0; k < n; k++) L.rect(x0 + k * 2 * mw, y, mw, h, c, { sw: 0.06 }); }
      function slit(x, y, h) { L.poly([[x, y], [x + 0.46, y], [x + 0.46, y + h - 0.23], [x + 0.23, y + h], [x, y + h - 0.23]], win, { sw: 0.04 }); }
      L.rect(2.4, 0, 5.8, 3.4, lime, {}); L.rect(2.3, 3.4, 6.0, 0.28, limeD, {}); merlons(2.4, 8.2, 3.68, 0.5, lime);
      L.rect(0.3, 0, 2.3, 6.0, lime, {}); L.rect(0.2, 6.0, 2.5, 0.3, limeD, {}); merlons(0.3, 2.6, 6.3, 0.55, lime);
      L.rect(7.9, 0, 2.3, 6.0, lime, {}); L.rect(7.8, 6.0, 2.5, 0.3, limeD, {}); merlons(7.9, 10.2, 6.3, 0.55, lime);
      L.rect(3.65, 0, 3.3, 8.4, lime, {}); L.rect(3.55, 8.4, 3.5, 0.3, limeD, {}); merlons(3.65, 6.95, 8.7, 0.55, lime);
      L.rect(4.2, 9.25, 2.2, 2.7, lime, {}); L.poly([[3.95, 11.95], [5.3, 14.4], [6.65, 11.95]], '#b3a77f', {}); L.rect(4.2, 11.7, 2.2, 0.26, limeD, {});
      L.poly([[0.1, 6.85], [1.45, 9.0], [2.8, 6.85]], '#b3a77f', {}); L.poly([[7.8, 6.85], [9.15, 9.0], [10.5, 6.85]], '#b3a77f', {});
      var jp = [];
      for (var yy = 0.45; yy < 8.2; yy += 0.45) { jp.push([2.4, yy, 8.2, yy]); }
      L.path(jp.filter(function (s) { return s[1] < 3.3; }).concat([[0.3, 0.9, 2.6, 0.9], [0.3, 1.8, 2.6, 1.8], [0.3, 2.7, 2.6, 2.7], [0.3, 3.6, 2.6, 3.6], [0.3, 4.5, 2.6, 4.5], [0.3, 5.4, 2.6, 5.4], [7.9, 0.9, 10.2, 0.9], [7.9, 1.8, 10.2, 1.8], [7.9, 2.7, 10.2, 2.7], [7.9, 3.6, 10.2, 3.6], [7.9, 4.5, 10.2, 4.5], [7.9, 5.4, 10.2, 5.4], [3.65, 4.0, 6.95, 4.0], [3.65, 5.0, 6.95, 5.0], [3.65, 6.0, 6.95, 6.0], [3.65, 7.0, 6.95, 7.0]]), { stroke: '#b9a97c', sw: 0.04, op: 0.8 });
      slit(1.05, 3.0, 1.9); slit(8.65, 3.0, 1.9); slit(4.35, 4.7, 2.2); slit(5.55, 4.7, 2.2); slit(4.95, 9.8, 1.7); slit(3.35, 1.0, 1.6); slit(6.75, 1.0, 1.6);
      L.poly([[4.4, 0], [4.4, 1.6], [5.3, 2.3], [6.2, 1.6], [6.2, 0]], win, { sw: 0.05 });
      out.push({ L: L, x: 5.5, y: 0, z: -11 });
      // street lamps, flower planters and trees along the sidewalk
      L = new Layer(50, 6.6); L.tile = true; seedN = 67;
      for (i = 0; i < 4; i++) {
        var lx = 6 + i * 12.5;
        L.rect(lx - 0.28, 0, 0.56, 0.5, '#3b3858', {}); L.rect(lx - 0.1, 0.5, 0.2, 4.2, '#3b3858', { stroke: null }); L.line([[lx, 0.5], [lx, 4.7]], { sw: 0.12 });
        L.line([[lx - 0.8, 4.2], [lx, 4.8], [lx + 0.8, 4.2]], { sw: 0.09 });
        L.circle(lx - 0.8, 3.95, 0.34, '#fff6c8', {}); L.circle(lx + 0.8, 3.95, 0.34, '#fff6c8', {}); L.circle(lx, 5.2, 0.4, '#fff6c8', {});
        var px = 12.25 + i * 12.5;
        L.rect(px - 1.3, 0, 2.6, 0.9, '#a9674a', { r: 0.1 }); L.rect(px - 1.4, 0.8, 2.8, 0.2, '#8f5239', {});
        for (var f = 0; f < 6; f++) { var fxp = px - 1.1 + f * 0.44, fh = 0.55 + rnd() * 0.5; L.line([[fxp, 1.0], [fxp, 1.0 + fh]], { stroke: '#4f9a5a', sw: 0.07 }); L.circle(fxp, 1.1 + fh, 0.22, ['#f9a8c2', '#ffd24a', '#ff7a6b', '#ffffff'][(f + i) % 4], { sw: 0.05 }); }
        L.circle(px - 0.9, 1.15, 0.3, '#6fc07a', { sw: 0.05 }); L.circle(px + 0.9, 1.15, 0.3, '#6fc07a', { sw: 0.05 });
      }
      out.push({ L: L, x: 0, y: 0, z: -6.4 });
      // the avenue itself: asphalt, curbs and a dashed lane line
      L = new Layer(60, 3.2); L.tile = true;
      L.band(0, 3.2, '#7a7694', { stroke: null });
      L.band(0, 0.36, '#e8e3d6', { sw: 0.05 }); L.band(2.84, 0.36, '#e8e3d6', { sw: 0.05 });
      for (x = 0; x < 60; x += 4) L.rect(x, 1.5, 2, 0.16, '#fff3a8', { stroke: null });
      out.push({ L: L, x: 0, y: 0.012, z: -8.2, flat: true });
      return out;
    }
  };

  /* ---------- 3. Riverwalk with the bridges up ---------- */
  SETS.riverwalk = {
    name: 'Riverwalk, bridges up', sky: '#cfe4f5', floor: '#cfc6b4', light: 'morning',
    layers: function () {
      var out = [], L, x, i;
      L = new Layer(54, 17); seedN = 71;
      row(L, 52, 2.4, 3, 5, 9, 0.05, function (x, w, h) { building(L, x, w, h, rnd() < 0.5 ? '#d3dceb' : '#c4d0e2', { win: false, sw: 0.05, stroke: null }); });
      out.push({ L: L, x: 0, y: 0, z: -25 });
      L = new Layer(54, 24); seedN = 73;
      var cols = ['#e3bda8', '#b8d3e2', '#ece4cf', '#cdd7e5', '#dcae98'];
      row(L, 52, 3.2, 3.4, 8, 12, 0.06, function (x, w, h, k) {
        building(L, x, w, h, cols[k % 5], { cw: 0.38, ch: 0.5, gx: 0.34, gy: 0.46, lit: 0.1, roof: rnd() < 0.5 ? 0.8 : 0 });
        if (rnd() < 0.5) { L.rect(x + w * 0.15, h, w * 0.7, 1.6, cols[k % 5], {}); }
      });
      out.push({ L: L, x: 0, y: 0, z: -19 });
      // two bascule leaves raised, with bridge houses and counterweights
      L = new Layer(30, 16);
      var steel = '#d94a3a';
      function leaf(hx, hy, deg, len, wid, col) {
        var a = deg * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx, hw = wid / 2, t;
        // tail arm and counterweight behind the hinge
        L.poly([[hx - nx * hw * 0.8, hy - ny * hw * 0.8], [hx + nx * hw * 0.8, hy + ny * hw * 0.8], [hx + nx * hw * 0.8 - dx * 2.4, hy + ny * hw * 0.8 - dy * 2.4], [hx - nx * hw * 0.8 - dx * 2.4, hy - ny * hw * 0.8 - dy * 2.4]], '#8f8aa8', { sw: 0.08 });
        L.poly([[hx - nx * hw, hy - ny * hw], [hx + nx * hw, hy + ny * hw], [hx + nx * hw + dx * len, hy + ny * hw + dy * len], [hx - nx * hw + dx * len, hy - ny * hw + dy * len]], col, { sw: 0.09 });
        for (t = 0.5; t < len - 0.6; t += 1.1) L.line([[hx - nx * hw * 0.7 + dx * t, hy - ny * hw * 0.7 + dy * t], [hx + nx * hw * 0.7 + dx * (t + 0.55), hy + ny * hw * 0.7 + dy * (t + 0.55)]], { sw: 0.05 });
      }
      L.rect(-1, 2.2, 10.2, 0.8, '#8f8aa8', {}); L.rect(20.8, 2.2, 10.2, 0.8, '#8f8aa8', {});
      L.rect(0.8, 0, 1.4, 2.2, '#b8b09a', {}); L.rect(6.6, 0, 1.4, 2.2, '#b8b09a', {}); L.rect(22, 0, 1.4, 2.2, '#b8b09a', {}); L.rect(27.8, 0, 1.4, 2.2, '#b8b09a', {});
      leaf(8.6, 3.0, 62, 10.4, 1.0, steel); leaf(21.4, 3.0, 118, 10.4, 1.0, steel);
      [[0.4, 1], [24.6, 1]].forEach(function (h) {
        var bx = h[0];
        L.rect(bx, 3.0, 5, 4.4, '#e6dcc0', {}); L.poly([[bx - 0.3, 7.4], [bx + 2.5, 8.9], [bx + 5.3, 7.4]], '#8f8aa8', {});
        L.rect(bx + 0.6, 4.8, 0.9, 1.3, '#9ec3d6', { r: 0.1 }); L.rect(bx + 2.05, 4.8, 0.9, 1.3, '#9ec3d6', { r: 0.1 }); L.rect(bx + 3.5, 4.8, 0.9, 1.3, '#9ec3d6', { r: 0.1 });
        L.rect(bx + 1.9, 3.0, 1.2, 1.4, '#7d6e48', { r: 0.1 });
      });
      L.circle(9.0, 4.0, 0.16, '#ff5a4a', {}); L.circle(21.0, 4.0, 0.16, '#ff5a4a', {});
      out.push({ L: L, x: 0, y: 0, z: -14 });
      // the river, with the stone edge of the riverwalk at the front
      L = new Layer(60, 9); L.tile = true; seedN = 79;
      L.band(0.5, 8.5, '#72bad8', { stroke: null });
      for (i = 0; i < 38; i++) {
        var wx = rnd() * 60, wy = 1.0 + rnd() * 7.6, ww = 1.6 + rnd() * 2.6;
        L.line([[wx, wy], [wx + ww * 0.25, wy + 0.3], [wx + ww * 0.5, wy], [wx + ww * 0.75, wy + 0.3], [wx + ww, wy]], { stroke: '#ffffff', sw: 0.13, op: 0.85 });
      }
      L.band(0, 0.5, '#d8d0be', { sw: 0.06 });
      for (x = 0.8; x < 60; x += 2.5) L.line([[x, 0], [x, 0.5]], { sw: 0.04 });
      out.push({ L: L, x: 0, y: 0.012, z: -5.0, flat: true });
      // black iron railing and lamps
      L = new Layer(50, 4.2); L.tile = true;
      L.band(1.1, 0.12, '#4d4a6e', { sw: 0.05 }); L.band(0.62, 0.07, '#4d4a6e', { sw: 0.04 });
      for (x = 0.3; x < 50; x += 1.25) L.rect(x, 0, 0.12, 1.2, '#4d4a6e', { sw: 0.04 });
      for (x = 0.3; x < 50; x += 2.5) L.circle(x + 0.06, 1.3, 0.09, '#4d4a6e', { sw: 0.04 });
      for (i = 0; i < 4; i++) { var lx = 6.3 + i * 12.5; L.rect(lx - 0.22, 0, 0.44, 0.45, '#3b3858', {}); L.line([[lx, 0.4], [lx, 3.3]], { sw: 0.13 }); L.circle(lx, 3.65, 0.38, '#fff6c8', {}); L.rect(lx - 0.25, 3.25, 0.5, 0.14, '#3b3858', {}); }
      out.push({ L: L, x: 0, y: 0, z: -4.5 });
      // a little water taxi
      L = new Layer(6.4, 3.4);
      L.poly([[0.2, 1.0], [6.2, 1.0], [5.5, 0.15], [0.9, 0.15]], '#ffffff', {}); L.rect(0.3, 0.55, 5.8, 0.26, '#2f7fd0', { stroke: null });
      L.rect(1.2, 1.0, 3.2, 1.3, '#fff3a8', { r: 0.14 }); L.rect(1.0, 2.3, 3.6, 0.2, '#e2362f', { r: 0.06 });
      for (i = 0; i < 3; i++) L.rect(1.45 + i * 0.95, 1.4, 0.65, 0.6, '#c6e0f7', { r: 0.08 });
      L.line([[4.8, 1.0], [4.8, 2.7]], { sw: 0.07 }); L.rect(4.8, 2.1, 0.9, 0.55, '#ffffff', {});
      out.push({ L: L, x: 5, y: 0.04, z: -9.5 });
      return out;
    }
  };

  /* ---------- 4. Pier with a Ferris wheel ---------- */
  SETS.pier = {
    name: 'Pier and Ferris wheel', sky: '#bfe3f7', floor: '#5fa9d8', waves: true, light: 'noon',
    layers: function () {
      var out = [], L, x, i;
      // lake horizon, hazy skyline and cut-paper clouds
      L = new Layer(60, 26); L.tile = true; seedN = 81;
      for (i = 0; i < 7; i++) {
        var cx = 4 + i * 9 + rnd() * 3, cy = 13 + rnd() * 8, cr = 0.9 + rnd() * 0.7;
        L.blob([[cx, cy, cr], [cx + cr * 1.1, cy + 0.1, cr * 1.2], [cx + cr * 2.3, cy, cr * 0.9], [cx + cr * 1.1, cy - 0.4, cr * 1.4]], '#ffffff', { sw: 0.06 });
      }
      x = 0; while (x < 60) { var w = 1.4 + rnd() * 2, h = 1.2 + rnd() * 3.4; L.rect(x, 3.0, w, h, '#b7cde6', { stroke: null }); x += w + 0.04; }
      L.rect(30, 3, 2.2, 5.6, '#a9c0de', { stroke: null }); L.rect(46, 3, 2.6, 4.4, '#a9c0de', { stroke: null });
      L.band(0, 3.2, '#82bde2', { stroke: null });
      out.push({ L: L, x: 0, y: 0, z: -25 });
      // near lake with sailboats
      L = new Layer(60, 5); L.tile = true; seedN = 83;
      [[12, '#fff6e0', '#ffd7a0'], [34, '#ffffff', '#ffb3c6'], [52, '#fff6e0', '#a9d4ff']].forEach(function (b) {
        var bx = b[0];
        L.poly([[bx - 1.5, 2.6], [bx + 1.5, 2.6], [bx + 0.9, 1.9], [bx - 0.9, 1.9]], '#ffffff', {});
        L.poly([[bx, 2.7], [bx, 5.0], [bx + 1.4, 2.7]], b[1], {}); L.poly([[bx - 0.2, 2.7], [bx - 0.2, 4.2], [bx - 1.2, 2.7]], b[2], {});
        L.line([[bx, 2.6], [bx, 5.1]], { sw: 0.07 });
      });
      waterBand(L, 2.2, 0.12, 7.5, '#5aa6d8');
      glints(L, 0.8, 2.0, 22, 0, 60, '#ffffff', 0.7);
      out.push({ L: L, x: 0, y: 0, z: -20 });
      // the Ferris wheel: spokes, rim, gondolas and an A-frame
      L = new Layer(13.6, 14.4);
      var cxw = 6.8, cyw = 7.7, R = 5.5, gcol = ['#e2362f', '#fff3a8', '#2f7fd0', '#6fd14a', '#f9a8c2', '#f2a33a'];
      L.poly([[cxw - 0.34, cyw], [cxw + 0.34, cyw], [cxw - 2.7, 0], [cxw - 3.7, 0]], '#e8e4f2', {});
      L.poly([[cxw - 0.34, cyw], [cxw + 0.34, cyw], [cxw + 3.7, 0], [cxw + 2.7, 0]], '#e8e4f2', {});
      L.rect(cxw - 3.3, 1.8, 6.6, 0.24, '#e8e4f2', {});
      for (i = 0; i < 16; i++) { var an = i / 16 * Math.PI * 2; L.line([[cxw, cyw], [cxw + Math.cos(an) * R, cyw + Math.sin(an) * R]], { stroke: '#8f8aa8', sw: 0.08 }); }
      L.circle(cxw, cyw, R, 'none', { sw: 0.34 }); L.circle(cxw, cyw, R, 'none', { stroke: '#e2362f', sw: 0.16 });
      L.circle(cxw, cyw, R * 0.62, 'none', { stroke: '#8f8aa8', sw: 0.08 });
      for (i = 0; i < 16; i++) {
        var a2 = i / 16 * Math.PI * 2, gx2 = cxw + Math.cos(a2) * R, gy2 = cyw + Math.sin(a2) * R;
        L.line([[gx2, gy2], [gx2, gy2 - 0.4]], { sw: 0.05 });
        L.rect(gx2 - 0.38, gy2 - 1.08, 0.76, 0.68, gcol[i % 6], { r: 0.15, sw: 0.05 });
        L.rect(gx2 - 0.24, gy2 - 0.9, 0.48, 0.26, '#c6e0f7', { r: 0.05, stroke: null });
      }
      L.circle(cxw, cyw, 0.6, '#fff3a8', {});
      out.push({ L: L, x: 1, y: 0, z: -13 });
      // pier railing with rope swags, a life ring and lamps
      L = new Layer(50, 4); L.tile = true; seedN = 87;
      L.band(1.45, 0.14, '#8a6a4a', { sw: 0.05 });
      for (x = 0.25; x < 50; x += 2.5) {
        L.rect(x - 0.12, 0, 0.24, 1.6, '#a98458', { sw: 0.05 });
        var pts = []; for (var t = 0; t <= 1.001; t += 0.125) pts.push([x + 0.12 + t * 2.26, 1.15 - Math.sin(t * Math.PI) * 0.38]);
        L.line(pts, { stroke: '#e8e0c8', sw: 0.1 });
      }
      for (i = 0; i < 4; i++) {
        var lx = 8 + i * 12.5;
        L.rect(lx - 0.2, 0, 0.4, 3.2, '#3b3858', {}); L.line([[lx, 3.2], [lx + 0.7, 3.5]], { sw: 0.1 }); L.circle(lx + 0.8, 3.45, 0.3, '#fff6c8', {});
      }
      L.circle(20, 0.85, 0.42, '#ffffff', {}); L.circle(20, 0.85, 0.17, 'none', { stroke: '#e2362f', sw: 0.12 }); L.rect(19.52, 0.8, 0.96, 0.12, '#e2362f', { stroke: null }); L.rect(19.94, 0.43, 0.12, 0.84, '#e2362f', { stroke: null });
      out.push({ L: L, x: 0, y: 0, z: -9.6 });
      // the pier deck, wooden planks
      L = new Layer(60, 22.4); L.tile = true; seedN = 89;
      for (i = 0; i < 30; i++) {
        L.band(i * 0.74, 0.74, i % 2 ? '#c99b6d' : '#d4a97c', { stroke: null });
        L.band(i * 0.74, 0.035, '#7d5a3a', { stroke: null });
        for (var j = 0; j < 4; j++) { var jx = rnd() * 60; L.line([[jx, i * 0.74], [jx, i * 0.74 + 0.74]], { stroke: '#7d5a3a', sw: 0.035, op: 0.7 }); }
      }
      L.band(22.0, 0.4, '#8a6a4a', { sw: 0.06 });
      out.push({ L: L, x: 0, y: 0.02, z: 13, flat: true });
      return out;
    }
  };

  /* ---------- 5. Bungalow alley in snow ---------- */
  SETS.alley = {
    name: 'Alley in snow', sky: '#d3dcea', floor: '#f2f6fb', light: 'noon',
    layers: function () {
      var out = [], L, x, i;
      // far roofs and bare trees, pale in the snow haze
      L = new Layer(54, 14); seedN = 91;
      row(L, 52, 3.5, 3, 3, 3, 0.1, function (x, w, h, k) {
        L.rect(x, -0.2, w, h + 0.2, '#c0cbe0', { stroke: null });
        L.poly([[x - 0.2, h], [x + w / 2, h + 1.5], [x + w + 0.2, h]], '#aab6cf', { stroke: null });
        L.poly([[x + 0.4, h + 0.14], [x + w / 2, h + 1.3], [x + w - 0.4, h + 0.14]], '#f4f8fd', { stroke: null });
        if (k % 2) { var tx = x + w * 0.5; L.line([[tx, h], [tx, h + 5], [tx - 1, h + 7]], { stroke: '#9aa6c0', sw: 0.12 }); L.line([[tx, h + 3.4], [tx + 1.2, h + 5.4]], { stroke: '#9aa6c0', sw: 0.1 }); L.line([[tx, h + 4.4], [tx - 1.3, h + 6]], { stroke: '#9aa6c0', sw: 0.1 }); }
      });
      out.push({ L: L, x: 0, y: 0, z: -22 });
      // brick bungalows, seen from the alley: back porch, chimney, snowy roof
      L = new Layer(50, 9.4); L.tile = true; seedN = 93;
      var brick = ['#c8694f', '#b9573f', '#d3825f', '#a9553f'];
      for (i = 0; i < 4; i++) {
        var bx = 1.2 + i * 12.5, bw = 10.6, c = brick[i % 4];
        L.poly([[bx - 0.5, 4.4], [bx + 1.4, 6.6], [bx + bw - 1.4, 6.6], [bx + bw + 0.5, 4.4]], '#6c6a86', {});
        L.poly([[bx - 0.2, 4.55], [bx + 1.5, 6.5], [bx + bw - 1.5, 6.5], [bx + bw + 0.2, 4.55], [bx + bw - 0.5, 4.75], [bx + bw / 2, 5.1], [bx + 0.5, 4.75]], '#ffffff', { sw: 0.05 });
        L.rect(bx, 0, bw, 4.4, c, {});
        var jj = []; for (var ry = 0.35; ry < 4.4; ry += 0.35) jj.push([bx, ry, bx + bw, ry]);
        L.path(jj, { stroke: '#7a3c2c', sw: 0.025, op: 0.35 });
        L.rect(bx + bw * 0.62, 6.0, 0.9, 2.2, c, {}); L.rect(bx + bw * 0.62 - 0.1, 8.2, 1.1, 0.25, '#ffffff', { sw: 0.05 });
        L.rect(bx + 0.7, 1.5, 1.1, 1.7, '#fff3d0', { sw: 0.06 }); L.rect(bx + 2.3, 1.5, 1.1, 1.7, '#bcd0e6', { sw: 0.06 });
        L.rect(bx + bw * 0.5, 1.5, 1.1, 1.7, '#bcd0e6', { sw: 0.06 });
        // back porch: posts, rail, stairs
        var pxx = bx + bw - 3.2;
        L.rect(pxx, 0, 3, 0.3, '#8a6a4a', {}); L.rect(pxx, 2.8, 3, 0.22, '#a98458', {}); L.rect(pxx, 0, 0.18, 2.8, '#a98458', { stroke: null }); L.rect(pxx + 2.82, 0, 0.18, 2.8, '#a98458', { stroke: null });
        L.band(1.4, 0.08, '#e8e0c8', { stroke: null });
        L.rect(pxx + 0.55, 0.3, 1.6, 2.5, '#6a4a3a', { r: 0.05 });
        for (var st = 0; st < 5; st++) L.rect(pxx - 1.5 + st * 0.3, st * 0.35, 1.5 - st * 0.3, 0.35, '#a98458', { sw: 0.04 });
        L.poly([[pxx - 1.5, 1.8], [pxx, 2.8], [pxx, 3.1], [pxx - 1.5, 2.1]], '#ffffff', { sw: 0.04 });
      }
      out.push({ L: L, x: 0, y: 0, z: -15 });
      // garages, fences, utility poles and wires, and flakes in the air
      L = new Layer(50, 12.5); L.tile = true; seedN = 95;
      [[3, 6.2, '#9aa3b8'], [27, 6.8, '#c4a27a']].forEach(function (g) {
        var gx = g[0], gw = g[1];
        L.rect(gx, 0, gw, 3.3, g[2], {}); L.rect(gx - 0.2, 3.3, gw + 0.4, 0.28, '#6c6a86', {}); L.rect(gx - 0.1, 3.58, gw + 0.2, 0.34, '#ffffff', { sw: 0.05 });
        L.rect(gx + 0.6, 0, gw - 1.2, 2.5, '#e8e4f2', { sw: 0.06 });
        for (var p = 1; p < 4; p++) L.line([[gx + 0.6, p * 0.62], [gx + gw - 0.6, p * 0.62]], { sw: 0.04 });
      });
      for (x = 12; x < 26; x += 0.55) { L.rect(x, 0, 0.42, 1.7, '#fffdf8', { sw: 0.04 }); L.poly([[x, 1.7], [x + 0.21, 2.0], [x + 0.42, 1.7]], '#fffdf8', { sw: 0.04 }); }
      L.band(0.5, 0.1, '#8a8aa6', { stroke: null });
      for (x = 36; x < 49; x += 0.9) L.rect(x, 0, 0.88, 2.3, x % 1.8 < 0.9 ? '#a98458' : '#b8915f', { sw: 0.04 });
      [12.5, 37.5].forEach(function (px) {
        L.rect(px - 0.2, 0, 0.4, 11.4, '#7d5a3a', {}); L.rect(px - 1.3, 10.4, 2.6, 0.26, '#7d5a3a', {}); L.rect(px - 0.9, 9.4, 1.8, 0.2, '#7d5a3a', { sw: 0.05 });
        L.circle(px - 1.0, 10.85, 0.16, '#f4f8fd', {}); L.circle(px + 1.0, 10.85, 0.16, '#f4f8fd', {}); L.circle(px, 11.2, 0.16, '#f4f8fd', {});
        L.poly([[px - 0.35, 11.4], [px + 0.35, 11.4], [px + 0.3, 11.8], [px - 0.3, 11.8]], '#f4f8fd', { sw: 0.05 });
      });
      [[-1.0, 10.9], [0, 11.2], [1.0, 10.9]].forEach(function (o) {
        var pts = []; for (var t = 0; t <= 1.001; t += 0.1) pts.push([12.5 + o[0] + t * 25, o[1] - Math.sin(t * Math.PI) * 1.1]);
        L.line(pts, { sw: 0.05 });
        var pts2 = []; for (t = 0; t <= 1.001; t += 0.1) pts2.push([37.5 + o[0] + t * 25, o[1] - Math.sin(t * Math.PI) * 1.1]);
        L.line(pts2, { sw: 0.05 });
      });
      for (i = 0; i < 70; i++) L.circle(rnd() * 50, 4.5 + rnd() * 8, 0.04 + rnd() * 0.05, '#ffffff', { stroke: null });
      out.push({ L: L, x: 0, y: 0, z: -9.5 });
      // snow banks
      L = new Layer(50, 3.4); L.tile = true; seedN = 97;
      var bank = [[-3, 0]];
      for (x = -3; x <= 53.01; x += 0.5) bank.push([x, 1.3 + 0.5 * Math.sin(x / 10 * Math.PI * 2) + 0.3 * Math.sin(x / 5 * Math.PI * 2 + 1) + 0.2 * Math.sin(x / 25 * Math.PI * 2)]);
      bank.push([53, 0]);
      L.poly(bank, '#fafcff', {});
      for (i = 0; i < 14; i++) { var sx = rnd() * 48, sy = 0.4 + rnd() * 0.7; L.line([[sx, sy], [sx + 0.8, sy + 0.2], [sx + 1.6, sy]], { stroke: '#c9d9ea', sw: 0.07 }); }
      for (i = 0; i < 24; i++) L.circle(rnd() * 50, 0.2 + rnd() * 0.5, 0.045, '#9aa6c0', { stroke: null, op: 0.7 });
      out.push({ L: L, x: 0, y: 0, z: -5.6 });
      // the dibs chair, saving a shoveled spot
      L = new Layer(2.5, 2.7);
      var sp = '#2f9d6a';
      L.line([[0.3, 0.9], [0.18, 0]], { sw: 0.09 }); L.line([[2.2, 0.9], [2.32, 0]], { sw: 0.09 }); L.line([[0.5, 0.75], [0.55, 0.1]], { sw: 0.08 }); L.line([[2.0, 0.75], [1.95, 0.1]], { sw: 0.08 });
      L.line([[0.22, 0.4], [2.28, 0.4]], { stroke: '#8f8aa8', sw: 0.05 });
      L.poly([[0.32, 0.95], [2.18, 0.95], [2.38, 0.6], [0.12, 0.6]], '#ffffff', { sw: 0.06 });
      for (i = 0; i < 5; i += 2) L.poly([[0.32 + i * 0.372, 0.95], [0.32 + (i + 1) * 0.372, 0.95], [0.12 + (i + 1) * 0.45, 0.6], [0.12 + i * 0.45, 0.6]], sp, { stroke: null });
      L.poly([[0.32, 0.95], [2.18, 0.95], [2.38, 0.6], [0.12, 0.6]], 'none', { sw: 0.06 });
      L.rect(0.34, 1.0, 1.82, 1.4, '#ffffff', { r: 0.08, sw: 0.06 });
      for (i = 0; i < 7; i += 2) L.rect(0.38, 1.04 + i * 0.19, 1.74, 0.19, sp, { stroke: null });
      L.rect(0.34, 1.0, 1.82, 1.4, 'none', { r: 0.08, sw: 0.06 });
      L.line([[0.26, 1.5], [0.08, 0.72]], { sw: 0.08 }); L.line([[2.24, 1.5], [2.42, 0.72]], { sw: 0.08 });
      L.ellipse(1.25, 2.42, 0.95, 0.15, '#ffffff', { sw: 0.05 }); L.ellipse(1.2, 1.0, 0.7, 0.1, '#ffffff', { sw: 0.05 });
      out.push({ L: L, x: -3.3, y: 0, z: -2.4 });
      return out;
    }
  };

  /* ---------- 6. Ivy brick ballpark wall ---------- */
  SETS.ballpark = {
    name: 'Ivy ballpark', sky: '#bfe3f7', floor: '#8fcb7e', light: 'noon',
    layers: function () {
      var out = [], L, x, i, j;
      // rooftops of the neighborhood beyond the park
      L = new Layer(54, 13); seedN = 101;
      row(L, 52, 3, 3, 3, 5, 0.1, function (x, w, h, k) {
        L.rect(x, -0.2, w, h + 0.2, ['#d68a67', '#c9a58f', '#dcd2bb', '#b9c6d8'][k % 4], {});
        L.rect(x - 0.15, h, w + 0.3, 0.3, '#8f8aa8', {});
        windows(L, x, 0.5, w, h - 0.5, { cw: 0.5, ch: 0.7, gx: 0.45, gy: 0.6, lit: 0.1, dark: '#f4ead0', wop: 1 });
        if (k % 3 === 0) { L.rect(x + w * 0.2, h + 0.3, 0.8, 0.9, '#7d5a3a', {}); }
      });
      out.push({ L: L, x: 0, y: 0, z: -24 });
      // the stands, light tower and a hand-turned scoreboard
      L = new Layer(50, 15); L.tile = true; seedN = 103;
      L.poly([[-3, 0], [-3, 6.2], [53, 6.2], [53, 0]], '#8f9bb8', {});
      for (i = 0; i < 6; i++) L.band(i * 1.0 + 0.7, 0.08, '#6b7898', { stroke: null });
      for (i = 0; i < 150; i++) { var fx2 = rnd() * 50, fy = 3.9 + Math.floor(rnd() * 3) * 0.7; L.circle(fx2, fy + 0.3, 0.15, ['#e2362f', '#fff3a8', '#2f7fd0', '#f9a8c2', '#ffffff', '#6fd14a'][i % 6], { stroke: null }); L.rect(fx2 - 0.14, fy - 0.1, 0.28, 0.3, ['#e2362f', '#fff3a8', '#2f7fd0', '#ffffff', '#f9a8c2'][(i + 2) % 5], { stroke: null }); }
      L.band(6.2, 0.35, '#5b6684', {});
      // light tower
      L.rect(6.8, 6.5, 0.34, 7.6, '#6b7898', {}); L.rect(5.6, 13.2, 2.7, 1.2, '#eceff7', {});
      for (i = 0; i < 6; i++) L.circle(5.9 + (i % 3) * 0.9, 13.5 + Math.floor(i / 3) * 0.5, 0.2, '#fff3a8', { sw: 0.04 });
      // scoreboard: green board on stilts, rows of blank name boxes and number tiles
      var bY = 7.4, rY = function (j) { return bY + 0.45 + j * 1.3; };
      L.rect(21.2, 6.5, 0.3, 1.2, '#6b7898', {}); L.rect(28.5, 6.5, 0.3, 1.2, '#6b7898', {});
      L.rect(16.5, bY, 17, 4.6, '#2f5a46', { r: 0.2 });
      L.rect(16.9, bY + 0.4, 16.2, 3.8, 'none', { stroke: '#e8e4d0', sw: 0.06 });
      for (j = 0; j < 3; j++) {
        L.rect(17.4, rY(j), 3.3, 1.1, '#e8e4d0', { sw: 0.04 });
        for (i = 0; i < 9; i++) L.rect(21.1 + i * 1.1, rY(j), 0.95, 1.1, '#fffdf4', { sw: 0.04 });
        L.rect(31.3, rY(j), 1.4, 1.1, '#f2c230', { sw: 0.04 });
      }
      for (i = 0; i < 9; i++) L.text(21.3 + i * 1.1, rY(2) + 0.7, '' + (i + 1), 0.62, '#2f5a46', { w: 0.7 });
      var dg = [0, 2, 0, 1, 0, 0, 3, 0, 1, 0, 0, 4, 0, 0, 1, 0, 2, 0];
      for (j = 0; j < 2; j++) for (i = 0; i < 9; i++) L.text(21.3 + i * 1.1, rY(j) + 0.72, '' + dg[j * 9 + i], 0.66, INK, { w: 0.7 });
      L.text(31.45, rY(1) + 0.72, '3', 0.66, INK, { w: 0.9 }); L.text(31.45, rY(0) + 0.72, '5', 0.66, INK, { w: 0.9 });
      out.push({ L: L, x: 0, y: 0, z: -18 });
      // the curved brick wall, covered in ivy
      L = new Layer(50, 5.8); L.tile = true; seedN = 107;
      L.band(0, 3.8, '#a8503a', {});
      var bj = []; for (var by = 0.4; by < 3.8; by += 0.4) { bj.push([-1, by, 52, by]); var off = (Math.round(by / 0.4) % 2) * 0.55; for (x = off; x < 50.5; x += 1.1) bj.push([x, by - 0.4, x, by]); }
      L.path(bj, { stroke: '#6e2f22', sw: 0.03, op: 0.45 });
      L.band(3.8, 0.4, '#c7bba2', { sw: 0.06 });
      // ivy: green clumps on top and hanging down in curtains
      var ivy = [];
      for (x = 0; x < 50; x += 0.7) ivy.push([x + rnd() * 0.3, 4.3 + Math.sin(x * 0.9) * 0.25 + rnd() * 0.3, 0.55 + rnd() * 0.35]);
      for (i = 0; i < 20; i++) {
        var hx = rnd() * 50, hl = 1.4 + rnd() * 2.2;
        for (j = 0; j < hl / 0.55; j++) ivy.push([hx + Math.sin(j * 1.7 + i) * 0.28, 4.1 - j * 0.55, 0.42 + rnd() * 0.2]);
      }
      L.blob(ivy, '#4f9a4f', { sw: 0.08 });
      L.blob(ivy.filter(function (c, k) { return k % 3 === 0; }).map(function (c) { return [c[0] + 0.1, c[1] + 0.1, c[2] * 0.62]; }), '#6fba5f', { stroke: null });
      for (i = 0; i < 130; i++) { var ix = rnd() * 50, iy = 0.2 + rnd() * 4.8; L.circle(ix, iy, 0.07, '#2f6a3a', { stroke: null, op: 0.45 }); }
      out.push({ L: L, x: 0, y: 0, z: -13, bow: 1.5, deckle: false });
      // warning track along the wall and mown stripes on the grass
      L = new Layer(60, 3.0); L.tile = true; seedN = 109;
      L.band(0, 3.0, '#cfa77a', { stroke: null });
      for (i = 0; i < 90; i++) L.circle(rnd() * 60, rnd() * 3, 0.05, '#b98a5c', { stroke: null, op: 0.6 });
      out.push({ L: L, x: 0, y: 0.012, z: -10.4, flat: true });
      L = new Layer(60, 20.4); L.tile = true;
      for (i = 0; i < 10; i++) L.band(i * 2.04, 1.02, '#7fbf70', { stroke: null });
      out.push({ L: L, x: 0, y: 0.01, z: 10, flat: true });
      return out;
    }
  };

  /* ---------- 7. Deep dish pizza parlor ---------- */
  SETS.pizza = {
    name: 'Deep dish parlor', sky: '#f2d6aa', floor: '#e9dcc4', light: 'studio',
    layers: function () {
      var out = [], L, x, i, j;
      // the back wall: wainscot, a framed skyline picture and a flat paper neon sign
      L = new Layer(50, 15); L.tile = true; seedN = 111;
      L.band(0, 15, '#f4d9ae', { stroke: null });
      L.band(0, 3.6, '#8a4a32', { sw: 0.06 });
      for (x = 0; x < 50; x += 2.5) L.rect(x + 0.2, 0.4, 2.1, 2.7, '#a65a3c', { r: 0.08, sw: 0.04 });
      L.band(3.6, 0.4, '#c98a54', { sw: 0.06 });
      // red and cream checker band
      for (x = 0; x < 50; x += 0.5) for (j = 0; j < 2; j++) L.rect(x, 4.1 + j * 0.5, 0.5, 0.5, (Math.floor(x / 0.5) + j) % 2 ? '#e2362f' : '#fffdf4', { stroke: null });
      L.band(4.1, 0.04, INK, { stroke: null }); L.band(5.1, 0.04, INK, { stroke: null });
      // framed skyline picture
      L.rect(11.6, 5.3, 6.6, 4.4, '#6d4630', { r: 0.12 }); L.rect(12.0, 5.7, 5.8, 3.6, '#ffd9a0', { sw: 0.05 });
      L.rect(12.0, 5.7, 5.8, 1.2, '#f6a05c', { stroke: null });
      var sb = [[12.4, 1.2, 1.7], [13.6, 1.0, 2.5], [14.7, 1.2, 2.1], [15.9, 0.9, 1.5], [16.8, 0.9, 2.2]];
      sb.forEach(function (b) { L.rect(b[0], 5.7, b[1], b[2], '#6a5a9a', { stroke: null }); });
      L.circle(16.6, 8.6, 0.5, '#fff3c4', { stroke: null });
      // the sign: dark board, bright letters made from plain paper shapes, no glow
      L.rect(26, 5.8, 9.4, 3.4, '#2a2350', { r: 0.4, sw: 0.1 }); L.rect(26.35, 6.15, 8.7, 2.7, 'none', { stroke: '#f9a8c2', sw: 0.1, r: 0.3 });
      L.text(27.0, 6.7, 'PIZZA', 1.75, '#ffd24a', { w: 7.4 });
      L.rect(27.0, 6.45, 7.4, 0.14, '#e2362f', { stroke: null });
      // wall lamps
      [7, 22, 40, 46].forEach(function (lx) { L.rect(lx - 0.3, 6.6, 0.6, 0.35, '#c98a54', {}); L.poly([[lx - 0.7, 7.0], [lx + 0.7, 7.0], [lx + 0.4, 8.0], [lx - 0.4, 8.0]], '#fff3a8', {}); });
      out.push({ L: L, x: 0, y: 0, z: -14, deckle: false });
      // the counter with a pizza on its stand, and stools
      L = new Layer(24, 8.4);
      L.rect(0.4, 0, 23.2, 3.2, '#b3342f', { r: 0.1 });
      for (x = 0.8; x < 23.4; x += 1.6) L.rect(x, 0.35, 1.3, 2.3, '#c9453e', { r: 0.06, sw: 0.04 });
      L.rect(0, 3.2, 24, 0.6, '#f4ead0', { r: 0.14 });
      for (x = 0.3; x < 23.8; x += 0.6) L.rect(x, 2.7, 0.6, 0.5, (Math.floor(x / 0.6) % 2) ? '#fffdf4' : '#2a2350', { stroke: null });
      L.rect(0.4, 2.7, 23.2, 0.5, 'none', { sw: 0.05 });
      // the tall pizza stand: three legs and a round pan with a thick deep dish pizza
      var sx2 = 9.5;
      L.line([[sx2, 3.8], [sx2 - 0.55, 4.9]], { sw: 0.1 }); L.line([[sx2, 3.8], [sx2 + 0.55, 4.9]], { sw: 0.1 }); L.line([[sx2, 3.8], [sx2, 4.9]], { sw: 0.1 });
      L.ellipse(sx2, 3.8, 0.8, 0.14, '#8f8aa8', { sw: 0.05 });
      L.ellipse(sx2, 5.15, 3.0, 0.8, '#6f6b86', {});
      L.rect(sx2 - 3.0, 5.15, 6.0, 0.8, '#6f6b86', { stroke: null }); L.line([[sx2 - 3.0, 5.15], [sx2 - 3.0, 5.95]], { sw: 0.07 }); L.line([[sx2 + 3.0, 5.15], [sx2 + 3.0, 5.95]], { sw: 0.07 });
      L.ellipse(sx2, 5.95, 3.0, 0.8, '#8f8aa8', {});
      L.ellipse(sx2, 6.0, 2.55, 0.62, '#f7c948', { sw: 0.06 });
      for (i = 0; i < 11; i++) { var an = i / 11 * Math.PI * 2; L.circle(sx2 + Math.cos(an) * (1.2 + (i % 3) * 0.4), 6.0 + Math.sin(an) * 0.28, 0.2, '#e2362f', { stroke: null }); }
      L.circle(sx2 + 0.1, 6.0, 0.22, '#6fd14a', { stroke: null }); L.circle(sx2 - 1.7, 5.95, 0.14, '#6fd14a', { stroke: null }); L.circle(sx2 + 1.9, 6.1, 0.14, '#6fd14a', { stroke: null });
      L.line([[sx2 - 0.2, 6.0], [sx2 + 2.4, 6.2]], { sw: 0.05 }); L.line([[sx2 - 0.2, 6.0], [sx2 + 1.4, 5.5]], { sw: 0.05 });
      // slice with a cheese pull
      L.poly([[sx2 + 0.2, 6.05], [sx2 + 2.4, 6.2], [sx2 + 1.5, 5.5]], '#ffd966', { stroke: null });
      // trays and napkins
      L.rect(15.3, 3.8, 2.4, 0.16, '#d5d0e8', { r: 0.05 }); L.rect(15.6, 3.96, 0.9, 0.7, '#ffffff', { r: 0.06 }); L.rect(16.6, 3.96, 0.9, 0.5, '#fff3a8', { r: 0.06 });
      // a jar of red pepper flakes and a shaker
      L.rect(19.4, 3.8, 0.8, 1.1, '#e8f4fb', { r: 0.12 }); L.rect(19.45, 3.85, 0.7, 0.55, '#e2362f', { r: 0.1, stroke: null }); L.rect(19.35, 4.9, 0.9, 0.22, '#c0c8d8', { r: 0.08 });
      L.rect(20.8, 3.8, 0.8, 1.1, '#e8f4fb', { r: 0.12 }); L.rect(20.85, 3.85, 0.7, 0.55, '#f4ead0', { r: 0.1, stroke: null }); L.rect(20.75, 4.9, 0.9, 0.22, '#c0c8d8', { r: 0.08 });
      // stools
      [3.2, 6.0, 13.0, 15.8].forEach(function (sx) { L.rect(sx - 0.7, 0.0, 1.4, 0.24, '#3b3858', { r: 0.08 }); });
      out.push({ L: L, x: -3, y: 0, z: -9.6 });
      // a red vinyl booth with a checkered table
      L = new Layer(9.4, 7);
      L.rect(0.2, 0.3, 4.2, 5.4, '#b3342f', { r: 0.5 }); L.rect(5.0, 0.3, 4.2, 5.4, '#b3342f', { r: 0.5 });
      L.rect(0.5, 0.3, 3.6, 2.2, '#c9453e', { r: 0.3, sw: 0.05 }); L.rect(5.3, 0.3, 3.6, 2.2, '#c9453e', { r: 0.3, sw: 0.05 });
      for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) { L.circle(0.9 + i * 1.1, 3.1 + j * 0.95, 0.08, '#7a1f1b', { stroke: null }); L.circle(5.7 + i * 1.1, 3.1 + j * 0.95, 0.08, '#7a1f1b', { stroke: null }); }
      L.rect(3.6, 0.0, 2.2, 0.28, '#3b3858', {});
      L.rect(3.9, 0.28, 1.6, 2.1, '#a98458', { stroke: null }); L.rect(3.0, 2.4, 3.4, 0.35, '#e8d4b0', { r: 0.1 });
      out.push({ L: L, x: 7.5, y: 0, z: -7.6 });
      // checkered tablecloth tables, chairs and hanging lamps
      L = new Layer(50, 11.4); L.tile = true; seedN = 113;
      [7, 25, 42].forEach(function (tx, ti) {
        L.line([[tx, 1.75], [tx, 0]], { sw: 0.14 }); L.rect(tx - 0.7, 0, 1.4, 0.2, '#3b3858', { r: 0.06 });
        L.rect(tx - 1.9, 1.7, 3.8, 0.2, '#e2362f', { r: 0.05 });
        for (i = 0; i < 8; i++) for (j = 0; j < 2; j++) L.rect(tx - 1.9 + i * 0.475, 1.9 + j * 0.2, 0.475, 0.2, (i + j) % 2 ? '#fffdf4' : '#e2362f', { stroke: null });
        L.rect(tx - 1.9, 1.7, 3.8, 0.6, 'none', { r: 0.05 });
        L.poly([[tx - 1.9, 1.7], [tx - 2.2, 0.9], [tx - 1.5, 0.9]], '#e2362f', { sw: 0.05 }); L.poly([[tx + 1.9, 1.7], [tx + 2.2, 0.9], [tx + 1.5, 0.9]], '#e2362f', { sw: 0.05 });
        // candle in a bottle and a tiny pizza
        L.rect(tx - 1.2, 2.3, 0.4, 0.75, '#6fa86a', { r: 0.12 }); L.circle(tx - 1.0, 3.22, 0.1, '#ffd24a', { stroke: null });
        L.ellipse(tx + 0.4, 2.4, 0.9, 0.2, '#6f6b86', { sw: 0.05 }); L.ellipse(tx + 0.4, 2.52, 0.78, 0.14, '#f7c948', { sw: 0.04 });
        // chairs, wooden
        [tx - 3.1, tx + 3.1].forEach(function (cx, ci) {
          var d = ci ? -1 : 1;
          L.rect(cx - 0.6, 1.0, 1.2, 0.2, '#a98458', {}); L.line([[cx - 0.5, 1.0], [cx - 0.5, 0]], { sw: 0.12 }); L.line([[cx + 0.5, 1.0], [cx + 0.5, 0]], { sw: 0.12 });
          L.rect(cx - 0.6 - d * 0.1 + (ci ? 0.8 : -0.8) * 0, 1.2, 0.18, 1.5, '#a98458', {});
          L.rect(cx - 0.6, 2.3, 1.2, 0.25, '#a98458', { sw: 0.05 });
        });
        // pendant lamp
        var lx = tx + (ti % 2 ? 0.8 : -0.4);
        L.line([[lx, 11.4], [lx, 6.9]], { sw: 0.06 }); L.poly([[lx - 0.3, 6.9], [lx + 0.3, 6.9], [lx + 1.1, 6.0], [lx - 1.1, 6.0]], '#f2a33a', {}); L.ellipse(lx, 6.0, 1.1, 0.16, '#ffd966', { sw: 0.05 });
      });
      out.push({ L: L, x: 0, y: 0, z: -4.6 });
      // checkerboard floor
      L = new Layer(60, 27.6); L.tile = true;
      for (j = 0; j < 18; j++) for (i = 0; i < 40; i++) if ((i + j) % 2 === 0) L.rect(i * 1.5, j * 1.533, 1.5, 1.533, '#c9453e', { stroke: null });
      out.push({ L: L, x: 0, y: 0.01, z: 14, flat: true });
      return out;
    }
  };

  SETS.sweep = { name: 'Paper sweep', sky: '#fbf6ea', floor: '#fbf6ea', cyc: true, layers: function () { return []; } };

  SETS.photo = { name: 'Your photo', sky: '#fbf6ea', floor: '#fbf6ea', photo: true, layers: function () { return []; } };
  DP.SET_LIST = ['sweep', 'skyline', 'lplatform', 'wacker', 'hotdog', 'river', 'lakefront', 'michave', 'riverwalk', 'pier', 'alley', 'ballpark', 'pizza', 'photo'];
  DP.SET_INFO = SETS;
  DP.PALETTE = [
    { n: 'Cream', c: '#fbf6ea' }, { n: 'White', c: '#fffdf8' }, { n: 'Yellow', c: '#fff3a8' }, { n: 'Green', c: '#c9edc2' },
    { n: 'Blue', c: '#c6e0f7' }, { n: 'Lilac', c: '#e0d0f3' }, { n: 'Pink', c: '#f9cddd' }, { n: 'Orange', c: '#fddcb2' },
    { n: 'Chicago blue', c: '#b3ddf2' }, { n: 'Ink', c: '#2a2350' }
  ];

  /* ---------- building the 3D set ---------- */
  var planeGeo = new THREE.PlaneGeometry(1, 1);

  function drawLayerCanvas(d, idx) {
    var L = d.L;
    var scale = Math.min(1, 2048 / Math.max(L.W * K, L.H * K));
    var w = Math.max(8, Math.round(L.W * K * scale)), h = Math.max(8, Math.round(L.H * K * scale));
    return DP.svgToImage(L.svg(), w, h).then(function (img) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d');
      x.drawImage(img, 0, 0, w, h);
      L.texts.forEach(function (t) {
        x.fillStyle = t.fill; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
        x.font = '700 ' + (t.size * K * scale) + 'px Lexend, system-ui, sans-serif';
        x.fillText(t.s, t.x * K * scale, (L.H - t.y) * K * scale, t.o.w ? t.o.w * K * scale : undefined);
      });
      // torn, deckled tops on the long backdrop strips (the sky stays clean)
      if (DP.craft.on && L.tile && !d.flat && !d.vellum && d.deckle !== false) DP.deckleTop(c, 17 + idx * 5, 0.11 * K * scale);
      return c;
    });
  }

  /* where the bottom edge of the drawing is solid, for tape: lowest opaque pixel in a few columns */
  function tapeSpots(cv, n, tile) {
    var gw = 160, gh = Math.max(8, Math.round(gw * cv.height / cv.width));
    var sc = document.createElement('canvas'); sc.width = gw; sc.height = gh;
    sc.getContext('2d').drawImage(cv, 0, 0, gw, gh);
    var a = sc.getContext('2d').getImageData(0, 0, gw, gh).data, out = [];
    function lowest(c0, c1) {
      var best = null;
      for (var c = c0; c < c1; c++) for (var y = gh - 1; y >= 0; y--) if (a[(y * gw + c) * 4 + 3] > 200) { if (!best || y > best.y) best = { x: c, y: y }; break; }
      return best;
    }
    var spans = [];
    if (tile) { for (var k = 0; k < n; k++) spans.push([Math.round((k + 0.25) * gw / n), Math.round((k + 0.75) * gw / n)]); }
    else { spans.push([0, Math.round(gw * 0.3)]); spans.push([Math.round(gw * 0.7), gw]); }
    spans.forEach(function (s) {
      var b = lowest(s[0], s[1]); if (b && b.y < gh - 1) out.push({ u: (b.x + 0.5) / gw, v: (b.y + 0.5) / gh });
    });
    return out;
  }

  function addCard(res, canvas, d, idx) {
    var L = d.L, W = L.W, H = L.H, crafty = DP.craft.on, group = res.group;
    var t = DP.canvasTexture(canvas, true);
    var geo = planeGeo, warp = null, bow = d.bow || 0;
    var mesh;
    if (!d.flat && !d.vellum && (crafty || bow)) {
      warp = DP.warpFn(idx * 7 + 3, crafty ? (d.curl !== undefined ? d.curl : 0.022) : 0, bow);
      geo = DP.warpedPlane(Math.max(4, Math.min(40, Math.round(W / 1.5))), 6, warp);
    }
    var sw = W + (L.tile ? 0.006 : 0);
    if (d.vellum) {
      var vm = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false });
      mesh = new THREE.Mesh(geo, vm);
    } else if (d.flat) {
      // flat decals on the floor: soft blended, so thin lines survive mip levels
      var fm = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      mesh = new THREE.Mesh(geo, fm);
      mesh.receiveShadow = true;
    } else {
      var mat = DP.paperMat(t);
      mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      var depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.5 });
      mesh.customDepthMaterial = depth;
      mesh.castShadow = true;
    }
    mesh.scale.set(sw, H, 1);
    mesh.userData.cv = canvas;
    var g = new THREE.Group();
    g.add(mesh);
    if (!d.flat && !d.vellum) {
      var backZ = crafty ? -0.04 : -0.035;
      var back = new THREE.Mesh(geo, DP.paperMat(t, 0xe6dcc4, THREE.DoubleSide));
      back.scale.set(sw, H, 1); back.position.z = backZ; back.receiveShadow = true;
      g.add(back);
      if (crafty) {
        // corrugated cardboard edge that follows the cut outline
        var runs = DP.contour(canvas, Math.max(120, Math.min(420, Math.round(W * 8))));
        var wg = DP.wallGeometry(runs, W, H, backZ, -0.0006, warp);
        if (wg) g.add(DP.wallMesh(wg));
        // tape across the foot of the strip
        if (d.tape !== false) {
          var spots = tapeSpots(canvas, 3, !!L.tile);
          spots.forEach(function (s, k) {
            var tp = DP.makeTape(0.62, 0.22, (k % 2 ? -1 : 1) * (0.55 + 0.25 * ((k * 7 + idx) % 3) / 3));
            tp.position.set((s.u - 0.5) * W, (0.5 - s.v) * H + 0.05, 0.012);
            g.add(tp);
          });
        }
      }
    }
    if (d.flat) { g.rotation.x = -Math.PI / 2; g.position.set(d.x, d.y, d.z - H / 2); }
    else { g.position.set(d.x, d.y + H / 2, d.z); }
    group.add(g);
    // how fast this layer slides in the moving backgrounds: far slow, near fast
    var near = Math.max(0, Math.min(1, (d.z + 28) / 25));
    res.layers.push({ g: g, def: d, W: W, tile: !!L.tile, x0: g.position.x, gf: d.flat ? 1 : 0.25 + 0.75 * near, copies: null });
    return { tex: t };
  }

  function makeCyc(color) {
    var pts = [], i, R = 5, zb = -6;
    for (var z = 18; z >= zb; z -= 4) pts.push([z, 0]);
    for (i = 1; i <= 12; i++) { var a = i / 12 * Math.PI / 2; pts.push([zb - Math.sin(a) * R, R - Math.cos(a) * R]); }
    pts.push([zb - R, 24]);
    var pos = [], uv = [], idx = [], nor = [];
    var len = 0, W = 70;
    for (i = 0; i < pts.length; i++) {
      if (i) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      var prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
      var tz = next[0] - prev[0], ty = next[1] - prev[1], tl = Math.hypot(tz, ty);
      var nz = ty / tl, ny = -tz / tl;   // faces into the room
      for (var s = 0; s < 2; s++) {
        pos.push(s ? W / 2 : -W / 2, pts[i][1], pts[i][0]);
        nor.push(0, ny, nz);
        uv.push((s ? W : 0) / 7, len / 7);
      }
      if (i) { var b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    var m = new THREE.MeshStandardMaterial({ color: color, roughness: 1, map: DP.paperTexture(), side: THREE.DoubleSide });
    var mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    return mesh;
  }

  /* a copy of a layer that shares its geometry, materials and picture (for the repeating strip) */
  function cloneCard(g) {
    var c = new THREE.Group();
    c.rotation.copy(g.rotation); c.position.copy(g.position);
    g.children.forEach(function (m) {
      var n = new THREE.Mesh(m.geometry, m.material);
      n.position.copy(m.position); n.rotation.copy(m.rotation); n.scale.copy(m.scale);
      n.castShadow = m.castShadow; n.receiveShadow = m.receiveShadow; n.renderOrder = m.renderOrder;
      if (m.customDepthMaterial) n.customDepthMaterial = m.customDepthMaterial;
      n.userData = m.userData; n.raycast = m.raycast;
      c.add(n);
    });
    return c;
  }
  function mod(a, n) { return ((a % n) + n) % n; }

  /* Build set `id`. Returns a promise of {group, sky(color), setColor(hex), lamps[], layers[], setMotion(), dispose()} */
  DP.buildSet = function (id, color) {
    var def = SETS[id] || SETS.sweep;
    var group = new THREE.Group();
    var res = { group: group, def: def, id: id, texs: [], lights: [], layers: [] };
    var floorMat, cyc = null, floor = null, floorTex = null;
    var base = color || def.floor;
    if (def.cyc) {
      cyc = makeCyc(base); group.add(cyc); res.cyc = cyc; floorMat = cyc.material;
    } else {
      floorMat = new THREE.MeshStandardMaterial({ color: def.floor, roughness: 1, map: DP.paperTexture() });
      floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), floorMat);
      floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -14); floor.receiveShadow = true;
      var ft = DP.paperTexture().clone(); ft.needsUpdate = true; ft.repeat.set(13, 10); floorMat.map = ft; res.texs.push(ft); floorTex = ft;
      group.add(floor);
      res.floor = floor;
      // sky wall
      if (!def.photo) {
        var skyMat = new THREE.MeshStandardMaterial({ color: def.sky, roughness: 1, map: DP.paperTexture() });
        var sky = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), skyMat);
        sky.position.set(0, 20, -26); sky.receiveShadow = true;
        group.add(sky);
      }
    }
    res.setColor = function (hex) { if (cyc) { cyc.material.color.set(hex); } };
    res.sky = new THREE.Color(cyc ? base : def.sky);

    var defs = def.layers();
    return Promise.all(defs.map(function (d, i) { return drawLayerCanvas(d, i).then(function (cv) { return { d: d, cv: cv }; }); })).then(function (arr) {
      arr.forEach(function (it, i) {
        var r = addCard(res, it.cv, it.d, i);
        res.texs.push(r.tex);
      });
      if (def.waves) {
        // paper waves on the river floor
        var WL = new Layer(60, 40); WL.tile = true;
        seedN = 77;
        for (var j = 0; j < 46; j++) {
          var wx = rnd() * 56, wy = 1 + rnd() * 38, ww = 2.5 + rnd() * 3.5;
          WL.line([[wx, wy], [wx + ww * 0.25, wy + 0.5], [wx + ww * 0.5, wy], [wx + ww * 0.75, wy + 0.5], [wx + ww, wy]], { stroke: '#ffffff', sw: 0.2, op: 0.8 });
        }
        return drawLayerCanvas({ L: WL, flat: true }, 99).then(function (cv) {
          var r = addCard(res, cv, { L: WL, flat: true, x: 0, y: 0.012, z: 14 }, 99);
          res.texs.push(r.tex);
        });
      }
    }).then(function () {
      if (def.lamps) {
        res.lamps = def.lamps.map(function (lx) { return new THREE.Vector3(lx - 25, 8.8, -3.2); });
      }
      /* Moving backgrounds. pos is how far the nearest layer has travelled, in world units.
         mode 'pan': the layers slide gently back and forth, far ones slower (a multiplane camera).
         mode 'loop': every strip scrolls and repeats forever. dir is 1 or -1. */
      res.setMotion = function (mode, pos, dir) {
        dir = dir < 0 ? -1 : 1;
        res.layers.forEach(function (ly) {
          var off = 0, g = ly.gf, k, W = ly.W;
          if (mode === 'pan') {
            var A = ly.tile ? Math.max(1.5, (W - 30 + 15 * g) / 2 * 0.8) : 8 * g + 1;
            off = dir * A * Math.sin(pos * g / A);
          } else if (mode === 'loop') {
            var s = dir * pos * g;
            if (ly.tile) off = mod(s + W / 2, W) - W / 2;
            else { var span = Math.max(70, W + 40); off = mod(s + span / 2, span) - span / 2; }
          }
          ly.g.position.x = ly.x0 + off;
          var need = mode === 'loop' && ly.tile;
          if (need && !ly.copies) {
            ly.copies = [];
            var nk = W < 36 ? 2 : 1;
            for (k = -nk; k <= nk; k++) { if (!k) continue; var c = cloneCard(ly.g); c.userData.k = k; group.add(c); ly.copies.push(c); }
          }
          if (ly.copies) ly.copies.forEach(function (c) { c.visible = need; c.position.x = ly.x0 + off + c.userData.k * W; });
        });
        if (floorTex) floorTex.offset.x = mode === 'loop' ? -dir * pos / (90 / 13) : 0;
      };
      res.dispose = function () {
        group.traverse(function (o) {
          if (o.geometry && o.geometry !== planeGeo) o.geometry.dispose();
          if (o.material) {
            var i = DP.paperMats.indexOf(o.material); if (i >= 0) DP.paperMats.splice(i, 1);
            if (!o.material.userData || !o.material.userData.shared) o.material.dispose();
          }
          if (o.customDepthMaterial) o.customDepthMaterial.dispose();
        });
        res.texs.forEach(function (t) { t.dispose(); });
      };
      return res;
    });
  };
})();
