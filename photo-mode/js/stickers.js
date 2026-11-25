/* DIBS Photo Mode: 2D overlay. Stickers (bubbles, labels, die-cut pictures) and paper frames are drawn on a
   canvas in frame space (0..1), so they survive aspect changes and are drawn again at full size when you take a photo. */
(function () {
  'use strict';
  var THREE = window.THREEPKG.THREE;
  var DP = window.DP = window.DP || {};
  var A = window.DIBS_ASSETS;
  var INK = '#2a2350';
  var FONT = 'Lexend, "Atkinson Hyperlegible", system-ui, sans-serif';

  /* ---------- sticker library ---------- */
  function star(cx, cy, R, r, n, rot) {
    var pts = [], i;
    for (i = 0; i < n * 2; i++) { var rr = i % 2 ? r : R, t = rot + i / (n * 2) * Math.PI * 2; pts.push((cx + Math.cos(t) * rr).toFixed(2) + ',' + (cy + Math.sin(t) * rr).toFixed(2)); }
    return pts.join(' ');
  }
  function sv(inner) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' + inner + '</svg>'; }
  function inner(svg) { return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''); }
  var SW = 'stroke="' + INK + '" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';

  var LIB = [];
  function lib(id, name, svg, group, o) { LIB.push({ id: id, name: name, svg: svg, group: group || 'shapes', plain: o && o.plain }); }
  DP.buildStickerLib = function () {
    if (LIB.length) return LIB;
    var dibsHead = DP.PUPPETS.dibs.make(0).head, wackHead = DP.PUPPETS.wacker.make().head;
    lib('dibs-head', 'Dibs', sv('<circle cx="50" cy="50" r="47" fill="#fff3a8" ' + SW + '/><g transform="translate(50 52) scale(1.5) translate(-50 -37)">' + inner(dibsHead) + '</g>'), 'badges');
    lib('wacker-head', 'Wacker', sv('<circle cx="50" cy="50" r="47" fill="#c6e0f7" ' + SW + '/><g transform="translate(52 52) scale(1.32) translate(-38 -36)">' + inner(wackHead) + '</g>'), 'badges');
    lib('chi-star', 'Chicago star', sv('<polygon points="' + star(50, 52, 46, 23, 6, -Math.PI / 2) + '" fill="#ff0000"/>'), 'badges');
    lib('chi-stars', 'Flag stripes', sv('<rect x="4" y="22" width="92" height="56" fill="#ffffff" ' + SW + '/><rect x="4" y="34" width="92" height="9" fill="#b3ddf2"/><rect x="4" y="57" width="92" height="9" fill="#b3ddf2"/><polygon points="' + star(24, 50, 8, 4, 6, -Math.PI / 2) + '" fill="#ff0000"/><polygon points="' + star(44, 50, 8, 4, 6, -Math.PI / 2) + '" fill="#ff0000"/><polygon points="' + star(64, 50, 8, 4, 6, -Math.PI / 2) + '" fill="#ff0000"/><polygon points="' + star(84, 50, 8, 4, 6, -Math.PI / 2) + '" fill="#ff0000"/><rect x="4" y="22" width="92" height="56" fill="none" ' + SW + '/>'), 'badges');
    lib('hotdog', 'Hot dog', sv('<rect x="6" y="38" width="88" height="30" rx="15" fill="#e9b56c" ' + SW + '/><rect x="12" y="44" width="76" height="12" rx="6" fill="#d9502f" stroke="' + INK + '" stroke-width="3"/><path d="M16 50q8 -6 14 0t14 0t14 0t14 0t10 0" fill="none" stroke="#6fd14a" stroke-width="5" stroke-linecap="round"/><circle cx="30" cy="42" r="2" fill="#fff3a8"/><circle cx="52" cy="41" r="2" fill="#fff3a8"/><circle cx="72" cy="42" r="2" fill="#fff3a8"/><rect x="6" y="56" width="88" height="14" rx="7" fill="#e9b56c" ' + SW + '/>'), 'badges');
    lib('heart', 'Heart', sv('<path d="M50 86C14 60 10 34 28 22c10-6 18 0 22 8c4-8 12-14 22-8c18 12 14 38-22 64z" fill="#f48aa8" ' + SW + '/>'), 'shapes');
    lib('star', 'Star', sv('<polygon points="' + star(50, 53, 44, 20, 5, -Math.PI / 2) + '" fill="#ffd84a" ' + SW + '/>'), 'shapes');
    lib('arrow', 'Arrow', sv('<path d="M10 40h46V20l34 30-34 30V60H10z" fill="#c9edc2" ' + SW + '/>'), 'shapes');
    lib('circle', 'Dot', sv('<circle cx="50" cy="50" r="40" fill="#c6e0f7" ' + SW + '/>'), 'shapes');
    lib('tape1', 'Tape', sv('<path d="M6 30l5 4l-5 4l5 4l-5 4l5 4l-5 4l5 4L6 70h88l-5-4l5-4l-5-4l5-4l-5-4l5-4l-5-4l5-4l-5-4z" transform="translate(0 -4)" fill="#ecdcb4" fill-opacity=".9"/>'), 'tape', { plain: true });
    lib('tape2', 'Tape, pink', sv('<path d="M6 30l5 4l-5 4l5 4l-5 4l5 4l-5 4l5 4L6 70h88l-5-4l5-4l-5-4l5-4l-5-4l5-4l-5-4l5-4l-5-4z" transform="translate(0 -4)" fill="#f9cddd" fill-opacity=".92"/>'), 'tape', { plain: true });
    lib('tape3', 'Tape, blue', sv('<path d="M6 30l5 4l-5 4l5 4l-5 4l5 4l-5 4l5 4L6 70h88l-5-4l5-4l-5-4l5-4l-5-4l5-4l-5-4l5-4l-5-4z" transform="translate(0 -4)" fill="#c6e0f7" fill-opacity=".92"/>'), 'tape', { plain: true });
    Object.keys(A.symbols).forEach(function (n) { lib('symbol:' + n, n.replace(/-/g, ' '), A.symbols[n], 'symbols'); });
    return LIB;
  };
  DP.stickerSource = function (key, uploads) {
    if (key.indexOf('upload:') === 0) { var u = uploads && uploads[key.slice(7)]; return u ? { img: u.data } : null; }
    var l = DP.buildStickerLib().filter(function (x) { return x.id === key; })[0];
    return l ? { svg: l.svg, plain: l.plain } : null;
  };

  /* composite canvases for picture stickers (art with a white die-cut edge) */
  var compCache = {}, compWait = {};
  function getComp(key, uploads, done) {
    if (compCache[key]) return compCache[key];
    if (!compWait[key]) {
      var src = DP.stickerSource(key, uploads);
      if (!src) return null;
      compWait[key] = true;
      var p = src.svg ? DP.prepArt(src.svg) : DP.loadImage(src.img).then(function (im) { return DP.prepArt(im); });
      p.then(function (prep) {
        var c = document.createElement('canvas'); c.width = prep.cw; c.height = prep.ch;
        var x = c.getContext('2d');
        if (!src.plain) x.drawImage(prep.sil, 0, 0);
        x.drawImage(prep.art, 0, 0);
        compCache[key] = { canvas: c, aspect: prep.cw / prep.ch, prep: prep };
        if (DP.onOverlayAssets) DP.onOverlayAssets();
      }, function () { compCache[key] = { canvas: document.createElement('canvas'), aspect: 1 }; });
    }
    return null;
  }
  DP.stickerThumb = function (key, uploads, cb) {
    var c = getComp(key, uploads);
    if (c) { cb(DP.thumb(c.canvas, 96)); return; }
    var t = setInterval(function () { var c2 = compCache[key]; if (c2) { clearInterval(t); cb(DP.thumb(c2.canvas, 96)); } }, 60);
  };

  /* ---------- text helpers ---------- */
  function wrapLines(ctx, text, maxW) {
    var out = [];
    String(text || '').split('\n').forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean), line = '';
      if (!words.length) { out.push(''); return; }
      words.forEach(function (w) {
        var t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
      });
      out.push(line);
    });
    return out.length ? out : [''];
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* each draw function paints around (0,0) and returns {hw, hh} half size (before rotation) */
  function drawBubble(ctx, s, fw, u) {
    var boxW = s.w * fw, fs = boxW * 0.118;
    ctx.font = '700 ' + fs + 'px ' + FONT;
    var padX = fs * 0.9, padY = fs * 0.7;
    var lines = wrapLines(ctx, s.text, boxW - padX * 2);
    var lh = fs * 1.22, h = lines.length * lh + padY * 2, w = boxW;
    var x = -w / 2, y = -h / 2;
    var thought = s.type === 'thought';
    var sw = 4 * u, off = 5 * u;
    var tail = s.tail || 'bl';
    var fill = s.color || '#ffffff';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    function body() {
      if (thought) {
        var n = Math.max(10, Math.round((w + h) / (fs * 1.1)));
        ctx.beginPath();
        for (var i = 0; i < n; i++) {
          var a = i / n * Math.PI * 2, cx = Math.cos(a) * (w / 2 - fs * 0.55), cy = Math.sin(a) * (h / 2 - fs * 0.45);
          ctx.moveTo(cx + fs * 0.7, cy); ctx.arc(cx, cy, fs * 0.7, 0, Math.PI * 2);
        }
        ctx.moveTo(w / 2 - fs, 0); ctx.ellipse(0, 0, w / 2 - fs * 0.6, h / 2 - fs * 0.5, 0, 0, Math.PI * 2);
        return;
      }
      var r = Math.min(fs * 1.1, h / 2);
      var th = fs * 1.15, bottom = tail === 'bl' || tail === 'br', top = tail === 'tl' || tail === 'tr', left = tail === 'bl' || tail === 'tl';
      var t0 = left ? x + w * 0.16 : x + w * 0.70, t1 = t0 + w * 0.15, tip = left ? x + w * 0.07 : x + w * 0.93;
      ctx.beginPath(); ctx.moveTo(x + r, y);
      if (top) { ctx.lineTo(t0, y); ctx.lineTo(tip, y - th); ctx.lineTo(t1, y); }
      ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      if (bottom) { ctx.lineTo(t1, y + h); ctx.lineTo(tip, y + h + th); ctx.lineTo(t0, y + h); }
      ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
    }
    function tailDots(main) {
      if (!thought || tail === 'none') return;
      var sx = (tail === 'bl' || tail === 'tl') ? -1 : 1, sy = (tail === 'bl' || tail === 'br') ? 1 : -1;
      var d = [0.62, 0.46, 0.32];
      d.forEach(function (q, i) {
        var cx = sx * w * (0.30 + i * 0.07), cy = sy * (h / 2 + fs * (0.5 + i * 0.75));
        ctx.beginPath(); ctx.arc(cx, cy, fs * q, 0, Math.PI * 2);
        ctx.stroke(); ctx.fill();
      });
    }
    // hard offset shadow
    ctx.save(); ctx.translate(off, off); ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = sw * 2;
    body(); ctx.fill(); ctx.stroke(); tailDots(false); ctx.restore();
    ctx.fillStyle = fill; ctx.strokeStyle = INK;
    if (thought) {
      ctx.lineWidth = sw * 2; body(); ctx.stroke(); ctx.fill(); tailDots(true);
    } else {
      ctx.lineWidth = sw; body(); ctx.fill(); ctx.stroke();
    }
    // text
    ctx.fillStyle = s.ink || INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 ' + fs + 'px ' + FONT;
    lines.forEach(function (l, i) { ctx.fillText(l, 0, y + padY + lh * (i + 0.5)); });
    return { hw: w / 2 + off, hh: h / 2 + off + (tail === 'none' ? 0 : fs * (thought ? 2.3 : 1.1)) };
  }

  function drawLabel(ctx, s, fw, u) {
    var fs = s.w * fw * 0.16;
    ctx.font = '700 ' + fs + 'px ' + FONT;
    var lines = String(s.text || '').split('\n');
    var tw = 0; lines.forEach(function (l) { tw = Math.max(tw, ctx.measureText(l).width); });
    var lh = fs * 1.15, h = lines.length * lh, padX = fs * 0.55, padY = fs * 0.28;
    var w = tw + padX * 2, hh = h + padY * 2;
    var tape = s.bg !== 'none';
    if (tape) {
      var tc = s.bg === 'pink' ? '#f9cddd' : (s.bg === 'blue' ? '#c6e0f7' : (s.bg === 'yellow' ? '#fff3a8' : '#ecdcb4'));
      ctx.save(); ctx.fillStyle = tc; ctx.globalAlpha = 0.95;
      ctx.shadowColor = INK; ctx.shadowOffsetX = 4 * u; ctx.shadowOffsetY = 4 * u; ctx.shadowBlur = 0;
      var x0 = -w / 2, y0 = -hh / 2, tz = fs * 0.14;
      ctx.beginPath(); ctx.moveTo(x0, y0);
      var n = Math.max(2, Math.round(hh / (tz * 2))), i;
      ctx.lineTo(x0 + w, y0);
      for (i = 0; i < n; i++) { ctx.lineTo(x0 + w - (i % 2 ? 0 : tz), y0 + hh * (i + 0.5) / n); ctx.lineTo(x0 + w, y0 + hh * (i + 1) / n); }
      ctx.lineTo(x0, y0 + hh);
      for (i = n - 1; i >= 0; i--) { ctx.lineTo(x0 + (i % 2 ? 0 : tz), y0 + hh * (i + 0.5) / n); ctx.lineTo(x0, y0 + hh * i / n); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    lines.forEach(function (l, i) {
      var yy = -h / 2 + lh * (i + 0.5);
      if (!tape) { ctx.strokeStyle = '#fffdf8'; ctx.lineWidth = fs * 0.2; ctx.strokeText(l, 0, yy); }
      ctx.fillStyle = s.ink || INK; ctx.fillText(l, 0, yy);
    });
    return { hw: w / 2 + 6 * u, hh: hh / 2 + 6 * u };
  }

  function drawPicture(ctx, s, fw, u, uploads) {
    var c = getComp(s.src, uploads);
    var bw = s.w * fw;
    if (!c) { return { hw: bw / 2, hh: bw / 2 }; }
    var bh = bw / c.aspect;
    ctx.save();
    var plain = DP.stickerSource(s.src, uploads);
    if (!(plain && plain.plain)) { ctx.shadowColor = INK; ctx.shadowOffsetX = 4 * u; ctx.shadowOffsetY = 4 * u; ctx.shadowBlur = 0; }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c.canvas, -bw / 2, -bh / 2, bw, bh);
    ctx.restore();
    return { hw: bw / 2, hh: bh / 2 };
  }

  /* ---------- paper frames ---------- */
  DP.FRAMES = [
    { id: 'none', name: 'None' },
    { id: 'polaroid', name: 'White border', text: true, defText: '' },
    { id: 'torn', name: 'Torn paper' },
    { id: 'tape', name: 'Tape corners' },
    { id: 'ink', name: 'Ink outline' },
    { id: 'ticket', name: 'Ticket stub', text: true, defText: 'ADMIT ONE' },
    { id: 'lsign', name: 'L sign', text: true, defText: 'Next stop: Wacker Dr' }
  ];
  function jag(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

  function drawFrame(ctx, w, h, f, uni) {
    var m = Math.min(w, h), u = uni;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    var st = f.style;
    if (st === 'polaroid') {
      var b = m * 0.05, bb = m * 0.15;
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.rect(b, b, w - 2 * b, h - b - bb); ctx.fill('evenodd');
      ctx.strokeStyle = INK; ctx.lineWidth = 3 * u; ctx.strokeRect(b, b, w - 2 * b, h - b - bb);
      ctx.fillStyle = INK; ctx.fillRect(w - 6 * u, 0, 0, 0);
      if (f.text) {
        var fs = bb * 0.42; ctx.font = '700 ' + fs + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var t = f.text, tw = ctx.measureText(t).width, maxw = w - 2 * b - 20 * u;
        if (tw > maxw) { fs *= maxw / tw; ctx.font = '700 ' + fs + 'px ' + FONT; }
        ctx.fillStyle = INK; ctx.fillText(t, w / 2, h - bb / 2 - b * 0.1 + 0);
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 3 * u; ctx.strokeRect(1.5 * u, 1.5 * u, w - 3 * u, h - 3 * u);
    } else if (st === 'torn') {
      var mar = m * 0.035, rnd = jag(11), step = Math.max(6, m * 0.012), j = m * 0.012, i;
      ctx.beginPath(); ctx.rect(0, 0, w, h);
      var pts = [];
      for (i = 0; i <= w; i += step) pts.push([i, mar + (rnd() - 0.5) * 2 * j + 0]);
      for (i = 0; i <= h; i += step) pts.push([w - mar + (rnd() - 0.5) * 2 * j, i]);
      for (i = w; i >= 0; i -= step) pts.push([i, h - mar + (rnd() - 0.5) * 2 * j]);
      for (i = h; i >= 0; i -= step) pts.push([mar + (rnd() - 0.5) * 2 * j, i]);
      // reorder as a clean loop: top (left to right), right (top to bottom), bottom (right to left), left (bottom to top)
      ctx.moveTo(pts[0][0], pts[0][1]); for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath();
      ctx.fillStyle = '#fffdf8'; ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(42,35,80,.55)'; ctx.lineWidth = 1.5 * u; ctx.stroke();
    } else if (st === 'tape') {
      var tw2 = m * 0.2, th = m * 0.07, cs = [[0, 0, 1], [w, 0, -1], [0, h, -1], [w, h, 1]];
      cs.forEach(function (c) {
        ctx.save(); ctx.translate(c[0] + (c[0] ? -tw2 * 0.08 : tw2 * 0.08), c[1] + (c[1] ? -th * 0.2 : th * 0.2)); ctx.rotate(c[2] * Math.PI / 4);
        ctx.fillStyle = 'rgba(236,220,180,.92)'; ctx.shadowColor = 'rgba(42,35,80,.55)'; ctx.shadowOffsetX = 2 * u; ctx.shadowOffsetY = 3 * u;
        ctx.beginPath(); ctx.moveTo(-tw2 / 2, -th / 2);
        var n = 4, k;
        ctx.lineTo(tw2 / 2, -th / 2);
        for (k = 0; k < n; k++) ctx.lineTo(tw2 / 2 + (k % 2 ? 0 : -th * 0.12), -th / 2 + th * (k + 0.5) / n), ctx.lineTo(tw2 / 2, -th / 2 + th * (k + 1) / n);
        ctx.lineTo(-tw2 / 2, th / 2);
        for (k = n - 1; k >= 0; k--) ctx.lineTo(-tw2 / 2 + (k % 2 ? 0 : th * 0.12), -th / 2 + th * (k + 0.5) / n), ctx.lineTo(-tw2 / 2, -th / 2 + th * k / n);
        ctx.closePath(); ctx.fill(); ctx.restore();
      });
    } else if (st === 'ink') {
      var mg = m * 0.03;
      ctx.fillStyle = '#fffdf8';
      ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.rect(mg, mg, w - 2 * mg, h - 2 * mg); ctx.fill('evenodd');
      ctx.fillStyle = INK;
      var sh = 9 * u;
      ctx.fillRect(mg + sh, h - mg - 0, w - 2 * mg - sh, 0);
      // offset shadow band inside the photo (right and bottom)
      ctx.fillRect(w - mg - sh, mg + sh, sh, h - 2 * mg - sh); ctx.fillRect(mg + sh, h - mg - sh, w - 2 * mg - sh, sh);
      ctx.strokeStyle = INK; ctx.lineWidth = 4 * u; ctx.strokeRect(mg, mg, w - 2 * mg, h - 2 * mg);
      ctx.lineWidth = 4 * u; ctx.strokeRect(2 * u, 2 * u, w - 4 * u, h - 4 * u);
    } else if (st === 'ticket') {
      var bd = m * 0.05, bt = m * 0.13;
      ctx.fillStyle = '#fff3a8';
      ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.rect(bd, bd, w - 2 * bd, h - bd - bt);
      var nr = bd * 0.8;
      ctx.moveTo(0 + nr, (h - bt) / 2); ctx.arc(0, (h - bt) / 2, nr, 0, Math.PI * 2);
      ctx.moveTo(w + nr, (h - bt) / 2); ctx.arc(w, (h - bt) / 2, nr, 0, Math.PI * 2);
      ctx.fill('evenodd');
      ctx.strokeStyle = INK; ctx.lineWidth = 3 * u; ctx.strokeRect(bd, bd, w - 2 * bd, h - bd - bt);
      ctx.setLineDash([8 * u, 7 * u]); ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(bd + 10 * u, h - bt + 6 * u); ctx.lineTo(w - bd - 10 * u, h - bt + 6 * u); ctx.stroke(); ctx.setLineDash([]);
      if (f.text) {
        var fs3 = bt * 0.34; ctx.font = '700 ' + fs3 + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var tw3 = ctx.measureText(f.text).width, mx = w - 2 * bd - 20 * u; if (tw3 > mx) { fs3 *= mx / tw3; ctx.font = '700 ' + fs3 + 'px ' + FONT; }
        ctx.fillStyle = INK; ctx.fillText(f.text, w / 2, h - bt * 0.4);
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 3 * u; ctx.strokeRect(1.5 * u, 1.5 * u, w - 3 * u, h - 3 * u);
    } else if (st === 'lsign') {
      var bh = m * 0.13, by = h - bh - m * 0.04, bx = m * 0.04, bw = w - 2 * bx;
      ctx.fillStyle = INK; rr(ctx, bx + 5 * u, by + 5 * u, bw, bh, bh * 0.22); ctx.fill();
      ctx.fillStyle = '#b3ddf2'; rr(ctx, bx, by, bw, bh, bh * 0.22); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 4 * u; ctx.stroke();
      ctx.fillStyle = '#e2362f'; ctx.fillRect(bx + 3 * u, by + bh * 0.76, bw - 6 * u, bh * 0.1);
      // flag stars at both ends
      [bx + bh * 0.5, bx + bw - bh * 0.5].forEach(function (cx) {
        ctx.fillStyle = '#ff0000'; ctx.beginPath();
        for (var q = 0; q < 12; q++) { var rad = q % 2 ? bh * 0.1 : bh * 0.2, t = q / 12 * Math.PI * 2 - Math.PI / 2; ctx[q ? 'lineTo' : 'moveTo'](cx + Math.cos(t) * rad, by + bh * 0.4 + Math.sin(t) * rad); }
        ctx.closePath(); ctx.fill();
      });
      var fs4 = bh * 0.4; ctx.font = '700 ' + fs4 + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var avail = bw - bh * 1.5, tw4 = ctx.measureText(f.text || '').width; if (tw4 > avail) { fs4 *= avail / tw4; ctx.font = '700 ' + fs4 + 'px ' + FONT; }
      ctx.fillStyle = INK; ctx.fillText(f.text || '', w / 2, by + bh * 0.4);
    }
    ctx.restore();
  }

  /* ---------- overlay controller ---------- */
  function Overlay(canvas, st, hooks) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.st = st; this.h = hooks;
    this.geo = {};   // id -> {cx,cy,hw,hh,rot} in pixels at the last draw
    this.pw = 1; this.ph = 1; this.selected = null;
    this.ptrs = {}; this.drag = null;
  }
  Overlay.prototype.size = function (w, h) { this.cv.width = w; this.cv.height = h; this.pw = w; this.ph = h; };

  Overlay.prototype.drawStickers = function (ctx, w, h, editing) {
    var uploads = this.st.uploads, list = this.st.stickers, self = this;
    var u = Math.min(w, h) / 800;
    list.forEach(function (s) {
      ctx.save();
      var cx = s.x * w, cy = s.y * h;
      ctx.translate(cx, cy); ctx.rotate(s.r || 0);
      var size;
      var mn = Math.min(w, h);   // sticker sizes follow the short side, so they keep their look when the aspect changes
      if (s.type === 'bubble' || s.type === 'thought') size = drawBubble(ctx, s, mn, u);
      else if (s.type === 'label') size = drawLabel(ctx, s, mn, u);
      else size = drawPicture(ctx, s, mn, u, uploads);
      ctx.restore();
      if (editing) self.geo[s.id] = { cx: cx, cy: cy, hw: size.hw, hh: size.hh, rot: s.r || 0 };
    });
  };

  Overlay.prototype.render = function () {
    var ctx = this.ctx, w = this.pw, h = this.ph;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    this.geo = {};
    var f = this.st.frame;
    if (f.style && f.style !== 'none') drawFrame(ctx, w, h, f, Math.min(w, h) / 800);
    this.drawStickers(ctx, w, h, true);
    // selection chrome
    var g = this.selected && this.geo[this.selected];
    if (g) {
      ctx.save(); ctx.translate(g.cx, g.cy); ctx.rotate(g.rot);
      var pad = 8;
      ctx.setLineDash([7, 5]); ctx.lineWidth = 2; ctx.strokeStyle = INK;
      ctx.strokeRect(-g.hw - pad, -g.hh - pad, 2 * (g.hw + pad), 2 * (g.hh + pad));
      ctx.setLineDash([]);
      this.handles(ctx, g, pad);
      ctx.restore();
    }
  };
  Overlay.prototype.handles = function (ctx, g, pad) {
    var r = 13;
    // scale and turn handle (bottom right)
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(g.hw + pad, g.hh + pad, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(g.hw + pad, g.hh + pad, r * 0.45, 0.4, Math.PI * 1.6); ctx.stroke();
    // delete (top left)
    ctx.fillStyle = '#f9cddd';
    ctx.beginPath(); ctx.arc(-g.hw - pad, -g.hh - pad, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); var d = r * 0.4; ctx.moveTo(-g.hw - pad - d, -g.hh - pad - d); ctx.lineTo(-g.hw - pad + d, -g.hh - pad + d); ctx.moveTo(-g.hw - pad + d, -g.hh - pad - d); ctx.lineTo(-g.hw - pad - d, -g.hh - pad + d); ctx.stroke();
  };

  /* Paint everything for export. */
  Overlay.prototype.paint = function (ctx, w, h) {
    var f = this.st.frame;
    var u = Math.min(w, h) / 800;
    if (f.style && f.style !== 'none') drawFrame(ctx, w, h, f, u);
    this.drawStickers(ctx, w, h, false);
  };

  function toLocal(g, px, py) {
    var dx = px - g.cx, dy = py - g.cy, c = Math.cos(-g.rot), s = Math.sin(-g.rot);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }
  Overlay.prototype.hitSticker = function (px, py) {
    var list = this.st.stickers;
    for (var i = list.length - 1; i >= 0; i--) {
      var g = this.geo[list[i].id]; if (!g) continue;
      var l = toLocal(g, px, py);
      if (Math.abs(l.x) <= g.hw + 6 && Math.abs(l.y) <= g.hh + 6) return list[i];
    }
    return null;
  };
  Overlay.prototype.find = function (id) { return this.st.stickers.filter(function (s) { return s.id === id; })[0]; };

  /* pointer events (client coordinates; rect is the overlay's client rect). Returns true if the overlay took the event. */
  Overlay.prototype.pointerDown = function (e, rect) {
    var taken = this._down(e, rect);
    if (!taken) delete this.ptrs[e.pointerId];
    return taken;
  };
  Overlay.prototype._down = function (e, rect) {
    var k = this.pw / rect.width, px = (e.clientX - rect.left) * k, py = (e.clientY - rect.top) * k;
    this.ptrs[e.pointerId] = { x: px, y: py };
    var nptr = Object.keys(this.ptrs).length;
    var sel = this.selected && this.find(this.selected), g = sel && this.geo[sel.id];
    if (nptr === 2 && sel && this.drag && this.drag.kind === 'move') {
      var ids = Object.keys(this.ptrs), a = this.ptrs[ids[0]], b = this.ptrs[ids[1]];
      this.drag = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), a0: Math.atan2(b.y - a.y, b.x - a.x), w0: sel.w, r0: sel.r || 0 };
      return true;
    }
    if (nptr > 1) return !!this.drag;
    if (g) {
      var l = toLocal(g, px, py), pad = 8;
      if (Math.hypot(l.x - (g.hw + pad), l.y - (g.hh + pad)) < 24) {
        this.drag = { kind: 'scale', id: sel.id, d0: Math.hypot(px - g.cx, py - g.cy), a0: Math.atan2(py - g.cy, px - g.cx), w0: sel.w, r0: sel.r || 0 };
        return true;
      }
      if (Math.hypot(l.x + g.hw + pad, l.y + g.hh + pad) < 24) { this.remove(sel.id); return true; }
    }
    var hit = this.hitSticker(px, py);
    if (hit) {
      this.select(hit.id);
      this.drag = { kind: 'move', id: hit.id, ox: hit.x - px / this.pw, oy: hit.y - py / this.ph, moved: 0 };
      return true;
    }
    return false;
  };
  Overlay.prototype.pointerMove = function (e, rect) {
    var p = this.ptrs[e.pointerId]; if (!p) return false;
    var k = this.pw / rect.width, px = (e.clientX - rect.left) * k, py = (e.clientY - rect.top) * k;
    p.x = px; p.y = py;
    var d = this.drag; if (!d) return false;
    var s = this.find(d.id || this.selected); if (!s) return false;
    if (d.kind === 'move') {
      s.x = Math.max(0, Math.min(1, px / this.pw + d.ox)); s.y = Math.max(0, Math.min(1, py / this.ph + d.oy)); d.moved = 1;
    } else if (d.kind === 'scale') {
      var g = this.geo[s.id];
      var dist = Math.hypot(px - g.cx, py - g.cy), ang = Math.atan2(py - g.cy, px - g.cx);
      s.w = Math.max(0.05, Math.min(1.6, d.w0 * dist / Math.max(8, d.d0)));
      var rot = d.r0 + (ang - d.a0);
      if (Math.abs(ang - d.a0) < 0.06) rot = d.r0;   // small wobble does not turn it
      s.r = rot;
    } else if (d.kind === 'pinch') {
      var ids = Object.keys(this.ptrs); if (ids.length < 2) return true;
      var a = this.ptrs[ids[0]], b = this.ptrs[ids[1]];
      s.w = Math.max(0.05, Math.min(1.6, d.w0 * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(10, d.d0)));
      s.r = d.r0 + (Math.atan2(b.y - a.y, b.x - a.x) - d.a0);
    }
    this.render(); this.h.changed();
    return true;
  };
  Overlay.prototype.pointerUp = function (e) {
    var had = !!this.ptrs[e.pointerId];
    delete this.ptrs[e.pointerId];
    var d = this.drag;
    if (Object.keys(this.ptrs).length === 0) { this.drag = null; if (d) this.h.committed(); }
    else if (d && d.kind === 'pinch') this.drag = null;
    return had && !!d;
  };
  Overlay.prototype.select = function (id) { this.selected = id; this.render(); this.h.selected(id); };
  Overlay.prototype.remove = function (id) {
    var list = this.st.stickers;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { list.splice(i, 1); break; }
    if (this.selected === id) this.selected = null;
    this.render(); this.h.selected(null); this.h.changed(); this.h.committed();
  };

  DP.Overlay = Overlay;
  DP.drawFrame = drawFrame;
})();
