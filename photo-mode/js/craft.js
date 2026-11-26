/* DIBS Photo Mode: papercraft detail.
   Corrugated cardboard edges (a real side wall that follows the cut outline), a rough cut edge, slight paper curl,
   brass brads, tape and glue tabs. Everything here is switched by DP.craft.on (Crafty or Clean in the Look tab). */
(function () {
  'use strict';
  var THREE = window.THREEPKG.THREE;
  var DP = window.DP = window.DP || {};

  DP.craft = { on: true };

  /* ---------- small helpers ---------- */
  function hash2(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }
  DP.hash2 = hash2;

  /* ---------- corrugated cardboard: two liners with a wavy flute between ---------- */
  var fluteTex = null, fluteMat = null;
  DP.fluteTexture = function () {
    if (fluteTex) return fluteTex;
    var W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d'), i, y;
    x.fillStyle = '#c49a6c'; x.fillRect(0, 0, W, H);
    var liner = 17, per = W / 4;       // four flutes across the tile, so the tile repeats cleanly
    // flute: lighter paper above the wave, shadow below it
    for (i = 0; i < W; i++) {
      var yy = H / 2 + Math.sin(i / per * Math.PI * 2) * (H / 2 - liner - 7);
      x.fillStyle = '#dcb582'; x.fillRect(i, liner, 1, yy - liner);
      x.fillStyle = '#b3835a'; x.fillRect(i, yy, 1, H - liner - yy);
    }
    x.strokeStyle = '#7d5833'; x.lineWidth = 5; x.lineJoin = 'round'; x.beginPath();
    for (i = 0; i <= W; i += 2) { y = H / 2 + Math.sin(i / per * Math.PI * 2) * (H / 2 - liner - 7); if (i) x.lineTo(i, y); else x.moveTo(i, y); }
    x.stroke();
    // liners
    x.fillStyle = '#c9a070'; x.fillRect(0, 0, W, liner); x.fillRect(0, H - liner, W, liner);
    x.fillStyle = '#7d5833'; x.fillRect(0, liner - 2, W, 3); x.fillRect(0, H - liner - 1, W, 3);
    x.fillStyle = '#e0bd8e'; x.fillRect(0, 2, W, 2); x.fillRect(0, H - liner + 3, W, 2);
    // fibre speckle
    for (i = 0; i < 900; i++) {
      x.fillStyle = i % 2 ? 'rgba(110,76,40,0.16)' : 'rgba(255,236,200,0.14)';
      x.fillRect(hash2(i, 3, 5) * W, hash2(i, 9, 5) * H, 1 + hash2(i, 1, 7) * 2, 1);
    }
    fluteTex = new THREE.CanvasTexture(c);
    fluteTex.wrapS = THREE.RepeatWrapping; fluteTex.wrapT = THREE.ClampToEdgeWrapping;
    fluteTex.colorSpace = THREE.SRGBColorSpace;
    fluteTex.anisotropy = Math.min(4, DP.maxAniso || 4);
    return fluteTex;
  };
  DP.cardboardMat = function () {
    if (!fluteMat) fluteMat = new THREE.MeshStandardMaterial({ map: DP.fluteTexture(), roughness: 1, metalness: 0, side: THREE.DoubleSide });
    return fluteMat;
  };
  var FLUTE_PERIOD = 0.1;   // world units for one tile of four flutes

  /* ---------- outline of a drawing: marching squares on a small copy of its alpha ---------- */
  function rdp(pts, eps) {
    if (pts.length < 3) return pts;
    var keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    var stack = [[0, pts.length - 1]];
    while (stack.length) {
      var s = stack.pop(), a = pts[s[0]], b = pts[s[1]], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9, md = 0, mi = -1;
      for (var i = s[0] + 1; i < s[1]; i++) {
        var d = Math.abs((pts[i][0] - a[0]) * dy - (pts[i][1] - a[1]) * dx) / L;
        if (d > md) { md = d; mi = i; }
      }
      if (md > eps) { keep[mi] = 1; stack.push([s[0], mi], [mi, s[1]]); }
    }
    return pts.filter(function (p, i) { return keep[i]; });
  }

  /* returns runs of [u,v] points (v down, 0..1). Runs that only follow the picture border are left out. */
  DP.contour = function (canvas, gw) {
    var gh = Math.max(8, Math.round(gw * canvas.height / canvas.width));
    var sc = document.createElement('canvas'); sc.width = gw; sc.height = gh;
    var sx = sc.getContext('2d'); sx.drawImage(canvas, 0, 0, gw, gh);
    var d = sx.getImageData(0, 0, gw, gh).data, GW = gw + 2, GH = gh + 2, G = new Uint8Array(GW * GH), i, j;
    for (j = 0; j < gh; j++) for (i = 0; i < gw; i++) if (d[(j * gw + i) * 4 + 3] > 110) G[(j + 1) * GW + i + 1] = 1;
    // corner (ci,cj) in padded grid; pixel (ci-1,cj-1). edge ids: horizontal edge from (ci,cj) to (ci+1,cj) = 2*(cj*GW+ci), vertical = 2*(cj*GW+ci)+1
    var next = {}, pt = {};
    function hE(ci, cj) { var id = 2 * (cj * GW + ci); pt[id] = [((ci - 1) + 0.5 + 0.5) / gw, ((cj - 1) + 0.5) / gh]; return id; }
    function vE(ci, cj) { var id = 2 * (cj * GW + ci) + 1; pt[id] = [((ci - 1) + 0.5) / gw, ((cj - 1) + 0.5 + 0.5) / gh]; return id; }
    function seg(a, b) { next[a] = b; }
    for (j = 0; j < GH - 1; j++) for (i = 0; i < GW - 1; i++) {
      var tl = G[j * GW + i], tr = G[j * GW + i + 1], br = G[(j + 1) * GW + i + 1], bl = G[(j + 1) * GW + i];
      var c = tl | (tr << 1) | (br << 2) | (bl << 3);
      if (c === 0 || c === 15) continue;
      var T = hE(i, j), B = hE(i, j + 1), L = vE(i, j), R = vE(i + 1, j);
      switch (c) {
        case 1: seg(L, T); break; case 2: seg(T, R); break; case 4: seg(R, B); break; case 8: seg(B, L); break;
        case 14: seg(T, L); break; case 13: seg(R, T); break; case 11: seg(B, R); break; case 7: seg(L, B); break;
        case 3: seg(L, R); break; case 6: seg(T, B); break; case 12: seg(R, L); break; case 9: seg(B, T); break;
        case 5: seg(L, T); seg(R, B); break; case 10: seg(T, R); seg(B, L); break;
      }
    }
    var EPS = 1e-6;
    function onBorder(p) { return p[0] < EPS || p[0] > 1 - EPS || p[1] < EPS || p[1] > 1 - EPS; }
    function borderSeg(a, b) {
      var p = pt[a], q = pt[b];
      return (p[0] < EPS && q[0] < EPS) || (p[0] > 1 - EPS && q[0] > 1 - EPS) || (p[1] < EPS && q[1] < EPS) || (p[1] > 1 - EPS && q[1] > 1 - EPS);
    }
    var hasIn = {}, k;
    for (k in next) hasIn[next[k]] = true;
    var runs = [], seen = {};
    function walk(start) {
      var run = [pt[start]], cur = start, guard = 0;
      seen[start] = true;
      while (next[cur] !== undefined && guard++ < 200000) {
        var n = next[cur];
        if (borderSeg(cur, n)) { break; }
        run.push(pt[n]);
        if (seen[n]) break;
        seen[n] = true; cur = n;
      }
      if (run.length > 3) runs.push(run);
    }
    for (k in next) { if (!hasIn[k] && !seen[k]) walk(+k); }
    for (k in next) { if (!seen[k] && !onBorder(pt[k])) walk(+k); }
    var eps = 0.55 / gw;
    function simplify(r) {
      var a = r[0], z = r[r.length - 1];
      if (a[0] === z[0] && a[1] === z[1]) {
        // a closed loop: split it at the point farthest from the start so the two halves can be simplified
        var mi = 1, md = -1, i;
        for (i = 1; i < r.length - 1; i++) { var dd = Math.hypot(r[i][0] - a[0], r[i][1] - a[1]); if (dd > md) { md = dd; mi = i; } }
        return rdp(r.slice(0, mi + 1), eps).concat(rdp(r.slice(mi), eps).slice(1));
      }
      return rdp(r, eps);
    }
    return runs.map(simplify).filter(function (r) { return r.length > 3; });
  };

  /* ---------- the paper's slight bend. u, v in 0..1 (v up from the bottom). Periodic in u so tiled strips match. ---------- */
  DP.warpFn = function (seed, amp, bow) {
    var k = 1 + (seed % 3), p = hash2(seed, 4, 9), q = hash2(seed, 8, 3), sg = hash2(seed, 2, 6) < 0.5 ? -1 : 1;
    return function (u, v) {
      var z = amp * (0.55 * Math.sin(Math.PI * 2 * (k * u + p)) * (0.25 + 0.75 * v) + 0.45 * sg * v * v * (0.6 + 0.4 * Math.sin(Math.PI * 2 * (u + q))));
      if (bow) z -= bow * Math.cos(Math.PI * 2 * (u - 0.5));
      return z;
    };
  };

  /* a plane with a few subdivisions whose z follows warp(u,v) */
  DP.warpedPlane = function (nx, ny, warp) {
    var g = new THREE.PlaneGeometry(1, 1, nx, ny), p = g.attributes.position;
    for (var i = 0; i < p.count; i++) p.setZ(i, warp(p.getX(i) + 0.5, p.getY(i) + 0.5));
    g.computeVertexNormals();
    return g;
  };

  /* ---------- the cardboard side wall ---------- */
  /* runs: contour runs (u,v). W,H: plane size. z0 back, z1 front. warp optional. */
  DP.wallGeometry = function (runs, W, H, z0, z1, warp) {
    var pos = [], nor = [], uv = [], idx = [], base = 0, len = 0;
    runs.forEach(function (run) {
      var pts = run.map(function (p) { return [(p[0] - 0.5) * W, (0.5 - p[1]) * H, p[0], 1 - p[1]]; });
      for (var i = 0; i + 1 < pts.length; i++) {
        var a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
        if (l < 1e-6) continue;
        var nx = dy / l, ny = -dx / l;     // outward: inside is on the left of the walking direction
        var za = warp ? warp(a[2], a[3]) : 0, zb = warp ? warp(b[2], b[3]) : 0;
        pos.push(a[0], a[1], z0 + za, a[0], a[1], z1 + za, b[0], b[1], z0 + zb, b[0], b[1], z1 + zb);
        for (var q = 0; q < 4; q++) nor.push(nx, ny, 0);
        uv.push(len / FLUTE_PERIOD, 0, len / FLUTE_PERIOD, 1, (len + l) / FLUTE_PERIOD, 0, (len + l) / FLUTE_PERIOD, 1);
        idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        base += 4; len += l;
      }
    });
    if (!base) return null;
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  };
  DP.wallMesh = function (geo) {
    var m = new THREE.Mesh(geo, DP.cardboardMat());
    m.receiveShadow = true; m.castShadow = false;
    m.raycast = function () {};
    m.userData.wall = true;
    return m;
  };

  /* ---------- rough cut edge: the die-cut white border gets a few fibres out and a few bites in ---------- */
  DP.roughenEdge = function (canvas, seed) {
    var w = canvas.width, h = canvas.height, ctx = canvas.getContext('2d');
    var id = ctx.getImageData(0, 0, w, h), d = id.data, n = w * h, b = new Uint8Array(n), i, x, y;
    for (i = 0; i < n; i++) b[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    // coarse value noise so the wear comes in patches, not just salt and pepper
    var cs = 40, gx = Math.ceil(w / cs) + 2, gy = Math.ceil(h / cs) + 2, grid = new Float32Array(gx * gy);
    for (i = 0; i < grid.length; i++) grid[i] = hash2(i, 5, seed);
    function coarse(px, py) {
      var fx = px / cs, fy = py / cs, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
      var a = grid[iy * gx + ix], bb = grid[iy * gx + ix + 1], c = grid[(iy + 1) * gx + ix], dd = grid[(iy + 1) * gx + ix + 1];
      return (a * (1 - tx) + bb * tx) * (1 - ty) + (c * (1 - tx) + dd * tx) * ty;
    }
    var o = 2;
    for (y = o; y < h - o; y++) {
      for (x = o; x < w - o; x++) {
        var p = y * w + x, v = b[p];
        if (b[p - o] === v && b[p + o] === v && b[p - o * w] === v && b[p + o * w] === v) continue;
        var r = hash2(x, y, seed) * 0.6 + coarse(x, y) * 0.4;
        if (v) { if (r < 0.4) d[p * 4 + 3] = 0; }
        else if (r > 0.62) { d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = 255; d[p * 4 + 3] = 255; }
      }
    }
    ctx.putImageData(id, 0, 0);
  };

  /* ---------- torn, deckled tops for the backdrop strips ---------- */
  DP.deckleTop = function (canvas, seed, amp) {
    var w = canvas.width, h = canvas.height, ctx = canvas.getContext('2d');
    var id = ctx.getImageData(0, 0, w, h), d = id.data, x, y;
    var g = Math.max(4, Math.round(w / 22)), cell = w / g, tab = [];
    for (x = 0; x < g; x++) tab.push(hash2(x, 1, seed));
    function nz(px) { var f = px / cell, i = Math.floor(f) % g, t = f - Math.floor(f), a = tab[i], b = tab[(i + 1) % g]; return a + (b - a) * t * t * (3 - 2 * t); }
    var tops = new Int32Array(w);
    for (x = 0; x < w; x++) { for (y = 0; y < h; y++) if (d[(y * w + x) * 4 + 3] > 127) break; tops[x] = y; }
    for (x = 0; x < w; x++) {
      y = tops[x];
      if (y >= h - 8) continue;
      // leave steep sides alone: only flat tops get torn
      var ya = tops[Math.max(0, x - 3)], yb = tops[Math.min(w - 1, x + 3)];
      if (Math.abs(ya - y) > 5 || Math.abs(yb - y) > 5) continue;
      var n = Math.round(amp * (0.45 * nz(x) + 0.35 * hash2(x, 7, seed) + 0.2 * nz(x * 3.1)));
      var yy;
      for (yy = y; yy < y + n && yy < h; yy++) d[(yy * w + x) * 4 + 3] = 0;
      // the paper's pale core shows along the tear
      for (yy = y + n; yy < y + n + 3 && yy < h; yy++) {
        var q = (yy * w + x) * 4, t = 0.78 - (yy - y - n) * 0.18;
        d[q] = d[q] + (246 - d[q]) * t; d[q + 1] = d[q + 1] + (238 - d[q + 1]) * t; d[q + 2] = d[q + 2] + (216 - d[q + 2]) * t;
      }
    }
    ctx.putImageData(id, 0, 0);
  };

  /* ---------- brass brad ---------- */
  var bradGeo = null, bradMats = null;
  function bradTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d');
    var g = x.createRadialGradient(24, 22, 2, 32, 32, 31);
    g.addColorStop(0, '#fff2b8'); g.addColorStop(0.35, '#e8b947'); g.addColorStop(0.8, '#b8862a'); g.addColorStop(1, '#8a621c');
    x.fillStyle = g; x.beginPath(); x.arc(32, 32, 30, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#6b4a14'; x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 29, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(107,74,20,0.55)'; x.lineWidth = 2; x.beginPath(); x.arc(32, 32, 19, 0, Math.PI * 2); x.stroke();
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  /* a small paper fastener. radius in world units. The caller places it over a joint, never over a face. */
  DP.makeBrad = function (r) {
    if (!bradGeo) {
      bradGeo = { cap: new THREE.CircleGeometry(1, 20), rim: new THREE.CylinderGeometry(1, 1, 1, 20, 1, true) };
      bradMats = { cap: new THREE.MeshStandardMaterial({ map: bradTexture(), roughness: 0.42, metalness: 0.2 }), rim: new THREE.MeshStandardMaterial({ color: 0x9c7424, roughness: 0.5, metalness: 0.25 }) };
    }
    var g = new THREE.Group();
    var cap = new THREE.Mesh(bradGeo.cap, bradMats.cap); cap.scale.set(r, r, 1); cap.position.z = 0.012;
    var rim = new THREE.Mesh(bradGeo.rim, bradMats.rim); rim.rotation.x = Math.PI / 2; rim.scale.set(r, 0.012, r); rim.position.z = 0.006;
    [cap, rim].forEach(function (m) { m.raycast = function () {}; m.castShadow = true; m.receiveShadow = false; });
    g.add(rim, cap);
    g.userData.brad = true;
    return g;
  };

  /* ---------- tape: translucent cream strip with zig-zag ends ---------- */
  var tapeMat = null, tapeGeo = null;
  DP.makeTape = function (w, h, rot) {
    if (!tapeMat) {
      var c = document.createElement('canvas'); c.width = 128; c.height = 48; var x = c.getContext('2d');
      x.beginPath(); x.moveTo(0, 0); for (var i = 0; i <= 6; i++) x.lineTo(i % 2 ? 4 : 0, 48 * i / 6); x.lineTo(0, 48);
      x.lineTo(128, 48); for (var k = 6; k >= 0; k--) x.lineTo(k % 2 ? 124 : 128, 48 * k / 6); x.closePath();
      x.fillStyle = '#f7ecc8'; x.fill();
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(6, 6, 116, 7);
      x.fillStyle = 'rgba(160,130,70,0.14)'; x.fillRect(6, 34, 116, 8);
      var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
      tapeMat = new THREE.MeshStandardMaterial({ map: t, transparent: true, opacity: 0.72, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      tapeGeo = new THREE.PlaneGeometry(1, 1);
    }
    var m = new THREE.Mesh(tapeGeo, tapeMat);
    m.scale.set(w, h, 1); m.rotation.z = rot || 0;
    m.raycast = function () {}; m.renderOrder = 2;
    m.userData.tape = true;
    return m;
  };
})();
