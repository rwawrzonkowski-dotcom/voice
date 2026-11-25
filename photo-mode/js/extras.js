/* DIBS Photo Mode: emote cutouts, costumes, The L and 3D speech bubbles.
   All art here is drawn as plain SVG text or on a canvas, so it works from file:// with no network. */
(function () {
  'use strict';
  var DP = window.DP = window.DP || {};
  var A = window.DIBS_ASSETS;
  var INK = '#2a2350';
  var FONT = 'Lexend, "Atkinson Hyperlegible", system-ui, sans-serif';

  function sv(inner) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' + inner + '</svg>'; }
  var J = 'stroke-linejoin="round" stroke-linecap="round"';
  /* a line with an ink edge: ink stroke underneath, color on top */
  function line(d, color, w) {
    return '<path d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="' + (w + 6) + '" ' + J + '/><path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" ' + J + '/>';
  }
  function shape(d, fill) { return '<path d="' + d + '" fill="' + fill + '" stroke="' + INK + '" stroke-width="3" ' + J + '/>'; }
  var HEART = 'M50 86C14 60 12 32 30 24C41 19 50 28 50 34C50 28 59 19 70 24C88 32 86 60 50 86Z';

  DP.EMOTES = [
    { id: 'heart', name: 'Heart', move: 'lean', svg: sv(shape(HEART, '#f08bab')) },
    { id: 'hearts', name: 'Two hearts', move: 'lean', svg: sv('<g transform="translate(-14 -2) scale(.82)">' + shape(HEART, '#f08bab') + '</g><g transform="translate(36 28) scale(.5)">' + shape(HEART, '#f9cddd') + '</g>') },
    { id: 'exclaim', name: 'Exclaim', move: 'bounce', svg: sv(shape('M41 10H59L55.5 62H44.5Z', '#ffd25a') + '<circle cx="50" cy="80" r="9" fill="#ffd25a" stroke="' + INK + '" stroke-width="3"/>') },
    { id: 'question', name: 'Question', move: 'tilt', svg: sv(line('M32 32Q32 12 50 12Q69 12 69 30Q69 44 51 52Q49 56 49 62', '#c6e0f7', 11) + '<circle cx="49" cy="82" r="8" fill="#c6e0f7" stroke="' + INK + '" stroke-width="3"/>') },
    { id: 'note', name: 'Music note', move: 'bounce', svg: sv(shape('M47 76V16L78 26V40L58 34V76Z', '#e0d0f3') + '<ellipse cx="36" cy="76" rx="15" ry="11" transform="rotate(-20 36 76)" fill="#e0d0f3" stroke="' + INK + '" stroke-width="3"/>') },
    { id: 'sweat', name: 'Sweat drop', move: 'shiver', svg: sv(shape('M50 8C50 8 24 44 24 62A26 26 0 0 0 76 62C76 44 50 8 50 8Z', '#b3ddf2') + '<path d="M38 64Q39 74 47 78" fill="none" stroke="#ffffff" stroke-width="4" ' + J + '/>') },
    { id: 'zzz', name: 'Sleepy', move: 'slump', svg: sv(line('M14 58H36L14 84H38', '#c6e0f7', 8) + line('M46 32H70L46 60H72', '#c6e0f7', 8) + line('M70 8H88L70 28H90', '#c6e0f7', 6)) },
    { id: 'steam', name: 'Steam', move: 'shiver', svg: sv(shape('M24 72A14 14 0 0 1 22 46A16 16 0 0 1 50 34A18 18 0 0 1 80 48A14 14 0 0 1 76 74Z', '#fffdf8') + line('M36 52L46 60M66 50L58 60M50 40V50', '#e4002b', 5)) },
    { id: 'idea', name: 'Idea', move: 'bounce', svg: sv(shape('M50 8A28 28 0 0 1 66 58L66 68H34L34 58A28 28 0 0 1 50 8Z', '#fff3a8') + shape('M36 68H64V76H36ZM40 76H60V86Q50 92 40 86Z', '#c9c5cf') + '<path d="M42 56L46 40L50 52L54 40L58 56" fill="none" stroke="' + INK + '" stroke-width="3" ' + J + '/>') },
    { id: 'laugh', name: 'Laughing', move: 'bounce', svg: sv(shape('M10 34H90Q90 86 50 86Q10 86 10 34Z', '#fffdf8') + '<path d="M22 70Q50 52 78 70Q70 84 50 84Q30 84 22 70Z" fill="#f08bab" stroke="' + INK + '" stroke-width="3" ' + J + '/><path d="M10 34H90" stroke="' + INK + '" stroke-width="3" ' + J + '/>' + line('M6 14Q14 22 10 30M94 14Q86 22 90 30', '#fddcb2', 4)) },
    { id: 'tears', name: 'Tears', move: 'slump', svg: sv(shape('M30 14C30 14 12 42 12 56A18 18 0 0 0 48 56C48 42 30 14 30 14Z', '#b3ddf2') + shape('M72 36C72 36 56 60 56 72A16 16 0 0 0 88 72C88 60 72 36 72 36Z', '#b3ddf2')) },
    { id: 'shiver', name: 'Shivering', move: 'shiver', svg: sv(line('M22 12Q14 26 22 38Q30 50 22 62Q16 72 22 86', '#c6e0f7', 5) + line('M50 8Q42 24 50 36Q58 48 50 62Q44 74 50 90', '#c6e0f7', 5) + line('M78 12Q70 26 78 38Q86 50 78 62Q72 72 78 86', '#c6e0f7', 5)) }
  ];
  DP.emoteInfo = function (id) { for (var i = 0; i < DP.EMOTES.length; i++) if (DP.EMOTES[i].id === id) return DP.EMOTES[i]; return null; };

  /* body moves: one pose nudge for every kind of item. Static, made for photos. */
  DP.MOVES = [
    { id: 'none', name: 'None' }, { id: 'bounce', name: 'Bounce' }, { id: 'tilt', name: 'Tilt' },
    { id: 'lean', name: 'Lean in' }, { id: 'shiver', name: 'Shiver' }, { id: 'slump', name: 'Slump' }
  ];

  /* costumes. ref = the spot of the drawing that sits on the anchor, refW = width of the drawing that matches the anchor width. */
  DP.COSTUMES = [
    { id: 'cap-blue', name: 'Blue cap', slot: 'head', ref: [50, 64], refW: 60 },
    { id: 'cap-black', name: 'Black cap', slot: 'head', ref: [50, 64], refW: 60 },
    { id: 'horns', name: 'Horns', slot: 'head', ref: [50, 58], refW: 74 },
    { id: 'scarf', name: 'Scarf', slot: 'neck', ref: [50, 52], refW: 76 },
    { id: 'stick', name: 'Stick', slot: 'hand', ref: [58, 34], hand: 0.95 },
    { id: 'football', name: 'Football', slot: 'hand', ref: [50, 50], hand: 0.42 }
  ];
  DP.costumeInfo = function (id) { for (var i = 0; i < DP.COSTUMES.length; i++) if (DP.COSTUMES[i].id === id) return DP.COSTUMES[i]; return null; };

  DP.THE_L = ['blue', 'brown', 'green', 'orange', 'pink', 'purple', 'red', 'yellow'];
  DP.L_NAMES = { blue: 'Blue Line', brown: 'Brown Line', green: 'Green Line', orange: 'Orange Line', pink: 'Pink Line', purple: 'Purple Line', red: 'Red Line', yellow: 'Yellow Line' };
  DP.L_COLORS = { blue: '#00a1de', brown: '#62361b', green: '#009b3a', orange: '#f9461c', pink: '#e27ea6', purple: '#522398', red: '#c60c30', yellow: '#f9e300' };

  /* ---------- 3D speech bubbles: a flat paper cutout drawn on a canvas ---------- */
  DP.BUBBLES = [
    { id: 'speech', name: 'Speech bubble', text: 'Hello from Chicago!' },
    { id: 'thought', name: 'Thought bubble', text: 'Is that a hot dog?' },
    { id: 'shout', name: 'Shout bubble', text: 'Wow!' },
    { id: 'sign', name: 'Sign on a stick', text: 'Dibs was here' }
  ];
  var fontP = null;
  DP.fontReady = function () {
    if (!fontP) {
      fontP = (document.fonts && document.fonts.load)
        ? Promise.all([document.fonts.load('700 48px Lexend'), document.fonts.load('400 48px Lexend')]).catch(function () {})
        : Promise.resolve();
    }
    return fontP;
  };
  function wrap(ctx, text, maxW) {
    var out = [];
    String(text || '').split('\n').forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean), ln = '';
      if (!words.length) { out.push(''); return; }
      words.forEach(function (w) {
        var t = ln ? ln + ' ' + w : w;
        if (ctx.measureText(t).width > maxW && ln) { out.push(ln); ln = w; } else ln = t;
      });
      out.push(ln);
    });
    return out.length ? out : [''];
  }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  /* returns a canvas, 1024 wide at most. o = {shape, text, color, tail: left|right|down|none} */
  DP.bubbleCanvas = function (o) {
    var shapeId = o.shape || 'speech', text = String(o.text == null ? '' : o.text).slice(0, 160) || ' ';
    var color = /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : '#ffffff';
    var tail = ['left', 'right', 'down', 'none'].indexOf(o.tail) >= 0 ? o.tail : 'left';
    var lw = 12, pad = 60;
    var bw = shapeId === 'shout' ? 780 : 800;
    var m = document.createElement('canvas').getContext('2d');
    // fit the words: biggest type that keeps the box in a friendly shape
    var fs = 120, lines, lh, textH, textW, maxH = shapeId === 'sign' ? 380 : 420;
    for (; fs >= 30; fs -= 4) {
      m.font = '700 ' + fs + 'px ' + FONT;
      lines = wrap(m, text, bw - pad * 2);
      lh = fs * 1.2; textH = lines.length * lh;
      textW = 0; lines.forEach(function (l) { textW = Math.max(textW, m.measureText(l).width); });
      if (textH <= maxH && textW <= bw - pad * 2) break;
    }
    var bodyH = Math.max(230, textH + pad * 1.6);
    var tailH = (shapeId === 'speech' && tail !== 'none') ? 170 : (shapeId === 'thought' && tail !== 'none' ? 190 : 0);
    var stickH = shapeId === 'sign' ? 380 : 0;
    var edge = 36 + lw, W = 1024, sideX = (W - bw) / 2;
    var burst = shapeId === 'shout' ? 70 : 0;
    var H = Math.round(edge * 2 + burst * 2 + bodyH + tailH + stickH);
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = lw; c.strokeStyle = INK; c.fillStyle = color;
    var x = sideX, y = edge + burst, w = bw, h = bodyH;
    var cx = x + w / 2, cy = y + h / 2;
    if (shapeId === 'speech') {
      var r = Math.min(70, h / 2);
      c.beginPath();
      var tx0 = tail === 'left' ? x + w * 0.16 : (tail === 'right' ? x + w * 0.62 : x + w * 0.42);
      var tx1 = tx0 + w * 0.22, tip = tail === 'left' ? x + w * 0.06 : (tail === 'right' ? x + w * 0.94 : x + w * 0.5);
      c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
      if (tail !== 'none') { c.lineTo(tx1, y + h); c.lineTo(tip, y + h + tailH); c.lineTo(tx0, y + h); }
      c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
      c.fill(); c.stroke();
    } else if (shapeId === 'thought') {
      var n = Math.max(12, Math.round((w + h) / 62)), rad = 60;
      function cloud(fillIt) {
        c.beginPath();
        for (var i = 0; i < n; i++) {
          var a = i / n * Math.PI * 2, px = cx + Math.cos(a) * (w / 2 - rad * 0.8), py = cy + Math.sin(a) * (h / 2 - rad * 0.7);
          c.moveTo(px + rad, py); c.arc(px, py, rad, 0, Math.PI * 2);
        }
        c.moveTo(cx + w / 2 - rad * 1.7, cy); c.ellipse(cx, cy, w / 2 - rad * 0.9, h / 2 - rad * 0.8, 0, 0, Math.PI * 2);
        if (fillIt) c.fill(); else c.stroke();
      }
      c.lineWidth = lw * 2; cloud(false); c.lineWidth = lw; cloud(true);
      c.lineWidth = lw;
      // the white cloud interior must cover the inner stroke; draw the fill again without stroke
      if (tail !== 'none') {
        var sx = tail === 'left' ? -1 : (tail === 'right' ? 1 : 0.15), bx = cx + sx * w * 0.28, by = y + h + 10;
        [[0, 38], [60, 27], [112, 18]].forEach(function (d, i) {
          var px = bx + sx * (i * 30), py = by + d[0] + 20;
          c.beginPath(); c.arc(px, py, d[1], 0, Math.PI * 2); c.fill(); c.stroke();
        });
      }
    } else if (shapeId === 'shout') {
      var pts = 18, ox = w / 2 + burst * 0.9, oy = h / 2 + burst * 0.9, ix = w / 2 - 20, iy = h / 2 - 15;
      c.beginPath();
      for (var k = 0; k < pts * 2; k++) {
        var ang = k / (pts * 2) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? 0.74 : 1;
        var jit = k % 2 ? 1 : (1 + ((k * 7) % 5) * 0.025);
        var px2 = cx + Math.cos(ang) * (k % 2 ? ix : ox * jit) * (k % 2 ? 1 : 1), py2 = cy + Math.sin(ang) * (k % 2 ? iy : oy * jit);
        if (k) c.lineTo(px2, py2); else c.moveTo(px2, py2);
      }
      c.closePath(); c.fill(); c.stroke();
    } else {   // sign: a board on a stick
      var sx0 = cx - 26;
      c.beginPath(); rrect(c, sx0, y + h - 10, 52, stickH + 10, 14); c.fillStyle = '#d8b98a'; c.fill(); c.stroke();
      c.fillStyle = color; c.beginPath(); rrect(c, x, y, w, h, 34); c.fill(); c.stroke();
      c.lineWidth = 6; c.beginPath(); rrect(c, x + 22, y + 22, w - 44, h - 44, 20); c.stroke(); c.lineWidth = lw;
    }
    c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 ' + fs + 'px ' + FONT;
    var ty = cy - textH / 2 + lh / 2;
    lines.forEach(function (l, i) { c.fillText(l, cx, ty + i * lh); });
    return cv;
  };
  DP.bubbleDefaults = function (shape) {
    var b = DP.BUBBLES.filter(function (x) { return x.id === shape; })[0] || DP.BUBBLES[0];
    return { text: b.text, color: shape === 'shout' ? '#fff3a8' : (shape === 'sign' ? '#fddcb2' : '#ffffff'), tail: shape === 'sign' || shape === 'shout' ? 'none' : 'left' };
  };
})();
