/* DIBS Photo Mode: backdrops. Each set is a stack of flat cut-paper layers at different depths,
   so they slide past each other when the camera moves. All drawings are original, simple closed shapes. */
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
  function Layer(W, H) { this.W = W; this.H = H; this.p = []; this.texts = []; }
  function fx(v) { return Math.round(v * 100) / 100; }
  Layer.prototype.Y = function (y) { return fx((this.H - y) * K); };
  Layer.prototype.st = function (o) {
    o = o || {};
    var s = o.stroke === undefined ? INK : o.stroke;
    return (s ? ' stroke="' + s + '" stroke-width="' + fx((o.sw || 0.07) * K) + '" stroke-linejoin="round" stroke-linecap="round"' : '') + (o.op ? ' opacity="' + o.op + '"' : '');
  };
  Layer.prototype.rect = function (x, y, w, h, fill, o) {
    o = o || {};
    this.p.push('<rect x="' + fx(x * K) + '" y="' + this.Y(y + h) + '" width="' + fx(w * K) + '" height="' + fx(h * K) + '"' + (o.r ? ' rx="' + fx(o.r * K) + '"' : '') + ' fill="' + fill + '"' + this.st(o) + '/>');
    return this;
  };
  Layer.prototype.poly = function (pts, fill, o) {
    var self = this;
    this.p.push('<polygon points="' + pts.map(function (q) { return fx(q[0] * K) + ',' + self.Y(q[1]); }).join(' ') + '" fill="' + fill + '"' + this.st(o) + '/>');
    return this;
  };
  Layer.prototype.line = function (pts, o) {
    var self = this;
    this.p.push('<polyline points="' + pts.map(function (q) { return fx(q[0] * K) + ',' + self.Y(q[1]); }).join(' ') + '" fill="none"' + this.st(o) + '/>');
    return this;
  };
  Layer.prototype.circle = function (cx, cy, r, fill, o) {
    this.p.push('<circle cx="' + fx(cx * K) + '" cy="' + this.Y(cy) + '" r="' + fx(r * K) + '" fill="' + fill + '"' + this.st(o) + '/>');
    return this;
  };
  Layer.prototype.ellipse = function (cx, cy, rx, ry, fill, o) {
    this.p.push('<ellipse cx="' + fx(cx * K) + '" cy="' + this.Y(cy) + '" rx="' + fx(rx * K) + '" ry="' + fx(ry * K) + '" fill="' + fill + '"' + this.st(o) + '/>');
    return this;
  };
  Layer.prototype.text = function (x, y, str, size, fill, o) { this.texts.push({ x: x, y: y, s: str, size: size, fill: fill, o: o || {} }); return this; };
  Layer.prototype.svg = function () {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + fx(this.W * K) + ' ' + fx(this.H * K) + '">' + this.p.join('') + '</svg>';
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
    if (o.roof) L.rect(x + w * 0.2, h, w * 0.6, o.roof, fill, { sw: o.sw });
    if (o.ant) L.line([[x + w / 2, h + (o.roof || 0)], [x + w / 2, h + (o.roof || 0) + o.ant]], { sw: 0.09 });
  }

  /* ---------- the sets ---------- */
  var SETS = {};

  SETS.skyline = {
    name: 'Chicago skyline', sky: '#b3ddf2', floor: '#cfe9c4', floorTone: 1,
    layers: function () {
      var out = [], L;
      // far haze
      L = new Layer(52, 15);
      var x = 0;
      seedN = 11;
      while (x < 50) { var w = 1.6 + rnd() * 2.2, h = 4 + rnd() * 8; building(L, x, w, h, '#a9cde6', { win: false, sw: 0.05, stroke: null }); x += w + 0.05; }
      out.push({ L: L, x: 0, y: 0, z: -19 });
      // mid towers
      L = new Layer(46, 22);
      seedN = 21;
      x = 0;
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
      out.push({ L: L, x: 0, y: 0, z: -13 });
      // near layer: park, trees and the water tower
      L = new Layer(36, 9);
      // water tower: cream limestone castle with a roof tower
      var tx = 22;
      L.rect(tx, 0, 3.8, 3.4, '#ecdfba', { r: 0.05 });
      L.rect(tx + 0.15, 3.4, 0.9, 0.5, '#ecdfba', {}); L.rect(tx + 1.5, 3.4, 0.9, 0.5, '#ecdfba', {}); L.rect(tx + 2.75, 3.4, 0.9, 0.5, '#ecdfba', {});
      L.rect(tx + 1.1, 3.4, 1.6, 5.2, '#ecdfba', {});
      L.poly([[tx + 0.95, 8.6], [tx + 1.9, 9.0], [tx + 2.85, 8.6]], '#c9b98c', {}); // little cap (clipped at layer top is fine)
      L.rect(tx + 1.4, 4.2, 0.5, 1.0, '#8a7d58', { r: 0.2 }); L.rect(tx + 1.4, 6.4, 0.5, 1.0, '#8a7d58', { r: 0.2 });
      L.rect(tx + 0.3, 0.9, 0.5, 1.2, '#8a7d58', { r: 0.2 }); L.rect(tx + 1.7, 0.2, 0.5, 1.7, '#8a7d58', { r: 0.2 }); L.rect(tx + 3.0, 0.9, 0.5, 1.2, '#8a7d58', { r: 0.2 });
      // trees
      [[4, 5.2], [10, 4.2], [17.5, 4.9], [31, 5.6], [34.2, 4.0]].forEach(function (t, i) {
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
      L = new Layer(52, 13); seedN = 5; x = 0;
      while (x < 50) { var w = 1.8 + rnd() * 2.6, h = 3 + rnd() * 7; building(L, x, w, h, rnd() < 0.5 ? '#c9a58f' : '#b58e7a', { cw: 0.4, ch: 0.5, gx: 0.45, gy: 0.5, lit: 0.18 }); x += w + 0.08; }
      out.push({ L: L, x: 0, y: 0, z: -22 });
      // the elevated track wall with girders
      L = new Layer(48, 6);
      L.rect(0, 0, 48, 1.1, '#6f6b86', {});
      L.rect(0, 1.1, 48, 0.28, '#4a4466', { stroke: null });
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
      L = new Layer(46, 9);
      L.rect(0, 7.2, 46, 0.5, '#4a4466', {});
      L.rect(0, 7.7, 46, 1.2, '#7d62b8', {});
      [4, 14, 24, 34, 44].forEach(function (cx) { L.rect(cx - 0.28, 0, 0.56, 7.2, '#8f8aa8', {}); L.rect(cx - 0.45, 0, 0.9, 0.3, '#4a4466', { stroke: null }); });
      L.rect(18, 5.2, 4.6, 1.5, '#ffffff', { r: 0.12 }); L.rect(18, 5.2, 4.6, 0.32, '#e2362f', { stroke: null }); L.rect(18, 5.2, 4.6, 1.5, 'none', { r: 0.12 });
      L.line([[19.4, 6.7], [19.4, 7.2]], { sw: 0.06 }); L.line([[21.2, 6.7], [21.2, 7.2]], { sw: 0.06 });
      L.text(18.4, 5.75, 'Wacker Dr', 0.6, INK, { w: 4.0 });
      out.push({ L: L, x: 0, y: 0, z: -4.8 });
      // yellow edge strip on the platform
      var D = new Layer(60, 0.8); D.rect(0, 0, 60, 0.8, '#f2c230', { stroke: null }); D.rect(0, 0.74, 60, 0.12, INK, { stroke: null });
      out.push({ L: D, x: 0, y: 0.012, z: -4.0, flat: true });
      return out;
    }
  };

  SETS.wacker = {
    name: 'Lower Wacker', sky: '#2b2840', floor: '#5b5675', dim: true,
    layers: function () {
      var out = [], L, x;
      // far tunnel wall
      L = new Layer(50, 14);
      L.rect(0, 0, 50, 14, '#3a3656', { stroke: null });
      for (x = 3; x < 50; x += 10) { L.rect(x, 0, 6.5, 6.2, '#25223a', { r: 0.1 }); L.poly([[x, 6.2], [x + 6.5, 6.2], [x + 3.25, 7.6]], '#25223a', {}); }
      for (x = 0; x < 50; x += 2.5) L.rect(x, 9, 0.18, 5, '#2f2b4a', { stroke: null });
      out.push({ L: L, x: 0, y: 0, z: -16 });
      // pillars
      L = new Layer(46, 14);
      [3, 13, 23, 33, 43].forEach(function (cx) { L.rect(cx - 0.8, 0, 1.6, 14, '#6a6590', {}); L.rect(cx - 1.1, 0, 2.2, 0.5, '#4a4568', {}); L.rect(cx - 1.1, 13.2, 2.2, 0.8, '#4a4568', {}); L.rect(cx - 0.8, 1.0, 1.6, 0.35, '#f2c230', { stroke: null }); });
      L.rect(0, 12.2, 46, 0.35, '#4a4568', { stroke: null });
      out.push({ L: L, x: 0, y: 0, z: -7.5 });
      // ceiling girders and pipes
      L = new Layer(50, 5);
      L.rect(0, 3.4, 50, 1.6, '#4a4568', {});
      for (x = 0; x < 50; x += 3.1) L.rect(x, 3.4, 0.4, 1.6, '#35314f', { stroke: null });
      L.rect(0, 3.0, 50, 0.4, '#7a6a52', {});
      // lamps (bulb part is the emissive layer)
      [6, 16, 26, 36, 46].forEach(function (lx) { L.line([[lx, 3.4], [lx, 2.2]], { sw: 0.07 }); L.rect(lx - 0.5, 1.7, 1.0, 0.55, '#6a6590', { r: 0.2 }); });
      out.push({ L: L, x: 0, y: 7.2, z: -3.4 });
      // light cones and bulbs (vellum, crisp)
      L = new Layer(50, 10);
      [6, 16, 26, 36, 46].forEach(function (lx) {
        L.poly([[lx - 0.4, 8.7], [lx + 0.4, 8.7], [lx + 2.3, 0], [lx - 2.3, 0]], '#f6b84a', { stroke: null, op: 0.15 });
        L.rect(lx - 0.35, 8.65, 0.7, 0.3, '#ffd27a', { r: 0.12, stroke: null });
      });
      out.push({ L: L, x: 0, y: 0, z: -3.3, vellum: true });
      // dashed center line on the road
      var D = new Layer(60, 0.6);
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
      seedN = 9; x = 0;
      while (x < 49) {
        var w = 4 + rnd() * 3, h = 8 + rnd() * 7;
        L.rect(x, -0.2, w, h + 0.2, rnd() < 0.5 ? '#d68a67' : '#c47a5c', {});
        windows(L, x, 0.5, w, h - 0.5, { cw: 0.7, ch: 0.9, gx: 0.6, gy: 0.9, lit: 0.2, dark: '#f4ead0', wop: 1 });
        L.rect(x - 0.1, h, w + 0.2, 0.4, '#a85f45', {});
        x += w + 0.05;
      }
      out.push({ L: L, x: 0, y: 0, z: -15 });
      // low wall and a street lamp on the left
      L = new Layer(40, 7);
      L.rect(0, 0, 40, 1.4, '#e5dcc4', {});
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
      seedN = 31; x = 0;
      while (x < 52) { var w = 2 + rnd() * 3, h = 5 + rnd() * 10; building(L, x, w, h, rnd() < 0.5 ? '#dcd2bb' : '#c9d3df', { cw: 0.45, ch: 0.55, gx: 0.42, gy: 0.52, lit: 0.12, roof: rnd() < 0.3 ? 0.6 : 0 }); x += w + 0.06; }
      out.push({ L: L, x: 0, y: 0, z: -20 });
      // river banks: stone embankment
      L = new Layer(50, 3.2);
      L.rect(0, 0, 50, 2.2, '#b8b09a', {});
      for (x = 0.5; x < 50; x += 3.5) L.line([[x, 0], [x, 2.2]], { sw: 0.05 });
      L.rect(0, 2.2, 50, 0.4, '#8f8aa8', {}); for (x = 0.4; x < 50; x += 1.2) L.rect(x, 2.6, 0.18, 0.5, '#8f8aa8', { stroke: null });
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

  SETS.sweep = { name: 'Paper sweep', sky: '#fbf6ea', floor: '#fbf6ea', cyc: true, layers: function () { return []; } };

  SETS.photo = { name: 'Your photo', sky: '#fbf6ea', floor: '#fbf6ea', photo: true, layers: function () { return []; } };
  DP.SET_LIST = ['sweep', 'skyline', 'lplatform', 'wacker', 'hotdog', 'river', 'photo'];
  DP.SET_INFO = SETS;
  DP.PALETTE = [
    { n: 'Cream', c: '#fbf6ea' }, { n: 'White', c: '#fffdf8' }, { n: 'Yellow', c: '#fff3a8' }, { n: 'Green', c: '#c9edc2' },
    { n: 'Blue', c: '#c6e0f7' }, { n: 'Lilac', c: '#e0d0f3' }, { n: 'Pink', c: '#f9cddd' }, { n: 'Orange', c: '#fddcb2' },
    { n: 'Chicago blue', c: '#b3ddf2' }, { n: 'Ink', c: '#2a2350' }
  ];

  /* ---------- building the 3D set ---------- */
  var planeGeo = new THREE.PlaneGeometry(1, 1);
  var NEED_FONT = false;

  function drawLayerCanvas(L, flat) {
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
      return c;
    });
  }

  function addCard(group, canvas, W, H, def, set) {
    var t = DP.canvasTexture(canvas, true);
    var geo = planeGeo;
    var mesh;
    if (def.vellum) {
      var vm = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false });
      mesh = new THREE.Mesh(geo, vm);
    } else if (def.flat) {
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
    mesh.scale.set(W, H, 1);
    mesh.userData.cv = canvas;
    var g = new THREE.Group();
    g.add(mesh);
    if (!def.flat && !def.vellum) {
      var back = new THREE.Mesh(geo, DP.paperMat(t, 0xe6dcc4, THREE.DoubleSide));
      back.scale.set(W, H, 1); back.position.z = -0.035; back.receiveShadow = true;
      g.add(back);
    }
    if (def.flat) { g.rotation.x = -Math.PI / 2; g.position.set(def.x, def.y, def.z - H / 2); }
    else { g.position.set(def.x, def.y + H / 2, def.z); }
    group.add(g);
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

  /* Build set `id`. Returns a promise of {group, sky(color), setColor(hex), lamps[], dispose()} */
  DP.buildSet = function (id, color) {
    var def = SETS[id] || SETS.sweep;
    var group = new THREE.Group();
    var res = { group: group, def: def, id: id, texs: [], lights: [] };
    var floorMat, cyc = null, floor = null;
    var base = color || def.floor;
    if (def.cyc) {
      cyc = makeCyc(base); group.add(cyc); res.cyc = cyc; floorMat = cyc.material;
    } else {
      floorMat = new THREE.MeshStandardMaterial({ color: def.floor, roughness: 1, map: DP.paperTexture() });
      floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), floorMat);
      floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -14); floor.receiveShadow = true;
      var ft = DP.paperTexture().clone(); ft.needsUpdate = true; ft.repeat.set(13, 10); floorMat.map = ft; res.texs.push(ft);
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
    return Promise.all(defs.map(function (d) { return drawLayerCanvas(d.L, d.flat).then(function (cv) { return { d: d, cv: cv }; }); })).then(function (arr) {
      arr.forEach(function (it) {
        var r = addCard(group, it.cv, it.d.L.W, it.d.L.H, it.d, def);
        res.texs.push(r.tex);
      });
      if (def.waves) {
        // paper waves on the river floor
        var WL = new Layer(60, 40);
        seedN = 77;
        for (var j = 0; j < 46; j++) {
          var wx = rnd() * 56, wy = 1 + rnd() * 38, ww = 2.5 + rnd() * 3.5;
          WL.line([[wx, wy], [wx + ww * 0.25, wy + 0.5], [wx + ww * 0.5, wy], [wx + ww * 0.75, wy + 0.5], [wx + ww, wy]], { stroke: '#ffffff', sw: 0.2, op: 0.8 });
        }
        return drawLayerCanvas(WL, true).then(function (cv) {
          var r = addCard(group, cv, 60, 40, { flat: true, x: 0, y: 0.012, z: 14 }, def);
          res.texs.push(r.tex);
        });
      }
    }).then(function () {
      if (def.lamps) {
        res.lamps = def.lamps.map(function (lx) { return new THREE.Vector3(lx - 25, 8.8, -3.2); });
      }
      res.dispose = function () {
        group.traverse(function (o) {
          if (o.geometry && o.geometry !== planeGeo) o.geometry.dispose();
          if (o.material) {
            var i = DP.paperMats.indexOf(o.material); if (i >= 0) DP.paperMats.splice(i, 1);
            o.material.dispose();
          }
          if (o.customDepthMaterial) o.customDepthMaterial.dispose();
        });
        res.texs.forEach(function (t) { t.dispose(); });
      };
      return res;
    });
  };
})();
