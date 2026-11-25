/* DIBS Photo Mode: the tool panel. Tabs, sliders, chips, dialogs. */
(function () {
  'use strict';
  var DP = window.DP, App = DP.app, A = window.DIBS_ASSETS;
  var $ = function (id) { return document.getElementById(id); };
  var D2R = Math.PI / 180;
  var content = $('content'), tabsEl = $('tabs'), panel = $('panel');
  var UI = App.ui = {};
  var S = function () { return App.state; };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function svgData(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function isPhone() { return window.matchMedia('(max-width:820px)').matches; }

  /* ---------- tabs ---------- */
  var ICON = {
    scene: '<path d="M2 20L9 8l5 8 3-4 5 8z"/><circle cx="17" cy="6" r="2.5"/>',
    pose: '<circle cx="12" cy="5" r="2.5"/><path d="M12 8v7M5 11l7-1.5L19 11M12 15l-4 6M12 15l4 6"/>',
    camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    look: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="#2a2350"/>',
    stickers: '<path d="M4 4h12l4 4v12H4z"/><path d="M16 4v4h4"/>',
    frame: '<rect x="3" y="3" width="18" height="18"/><rect x="7" y="7" width="10" height="10"/>',
    save: '<path d="M4 4h13l3 3v13H4z"/><rect x="8" y="4" width="7" height="5"/><rect x="7" y="13" width="10" height="7"/>'
  };
  var TABS = [['scene', 'Scene'], ['pose', 'Pose'], ['camera', 'Camera'], ['light', 'Light'], ['look', 'Look'], ['stickers', 'Stickers'], ['frame', 'Frame'], ['save', 'Save']];
  var curTab = 'scene';

  /* ---------- html helpers ---------- */
  function field(id, label, min, max, step) {
    return '<div class="field"><label for="f-' + id + '">' + label + '</label><output id="o-' + id + '" for="f-' + id + '"></output><input type="range" id="f-' + id + '" min="' + min + '" max="' + max + '" step="' + step + '"></div>';
  }
  function chip(act, v, label, extra) { return '<button type="button" class="chip" data-act="' + act + '" data-v="' + esc(v) + '" aria-pressed="false"' + (extra || '') + '>' + label + '</button>'; }
  function seg(act, list, label) {
    return '<div class="seg" role="group" aria-label="' + label + '">' + list.map(function (o) { return '<button type="button" data-act="' + act + '" data-v="' + o[0] + '" aria-pressed="false">' + o[1] + '</button>'; }).join('') + '</div>';
  }
  function tog(act, label) { return '<button type="button" class="tog" data-act="' + act + '" aria-pressed="false"><span>' + label + '</span><span class="track" aria-hidden="true"></span></button>'; }
  function swatches(act, list, label) {
    return '<div class="swatches" role="group" aria-label="' + label + '">' + list.map(function (c) {
      return '<button type="button" class="sw" data-act="' + act + '" data-v="' + c[0] + '" style="background:' + c[1] + '" aria-label="' + c[2] + '" aria-pressed="false"></button>';
    }).join('') + '</div>';
  }
  var PAL = DP.PALETTE.map(function (p) { return [p.c, p.c, p.n]; });

  /* ---------- panels ---------- */
  function buildPanels() {
    var propHtml = Object.keys(A.symbols).map(function (n) {
      return '<button type="button" data-act="prop" data-v="' + n + '" data-name="' + n.replace(/-/g, ' ') + '" aria-label="Add ' + n.replace(/-/g, ' ') + '" title="' + n.replace(/-/g, ' ') + '"><img alt="" decoding="async" loading="lazy" src="' + svgData(A.symbols[n]) + '"></button>';
    }).join('');
    var setHtml = DP.SET_LIST.map(function (id) {
      var d = DP.SET_INFO[id];
      return '<button type="button" class="setbtn" data-act="set" data-v="' + id + '" aria-pressed="false"><span class="pv" style="background:linear-gradient(to bottom,' + d.sky + ' 0 58%,' + d.floor + ' 58% 100%)"></span><span class="nm">' + d.name + '</span></button>';
    }).join('');
    var h = {};
    var charList = DP.PUPPET_LIST.concat(['dibsTrain', 'wackerFly']);
    var charChips = charList.map(function (k) {
      var info = DP.kindInfo(k), svg = info.puppet ? DP.charSvg(k) : info.svg;
      return '<button type="button" class="chip thumb" data-act="add" data-v="' + k + '"><img alt="" src="' + svgData(svg) + '">' + info.name + '</button>';
    }).join('');
    var lChips = DP.THE_L.map(function (c) {
      return '<button type="button" class="chip lchip" data-act="addl" data-v="' + c + '" aria-label="Add the L, ' + DP.L_NAMES[c] + '"><i style="background:' + DP.L_COLORS[c] + '"></i>' + cap(c) + '</button>';
    }).join('');
    var bubChips = DP.BUBBLES.map(function (b) { return chip('addbub', b.id, b.name); }).join('');
    h.scene =
      '<div class="group"><h3>Backdrop</h3><div class="fgrid" style="margin-bottom:10px">' + setHtml + '</div>' +
      '<div id="sweepColors" hidden>' + swatches('bdcolor', PAL, 'Paper color') + '</div>' +
      '<div id="photoBox" hidden><h3>Your photo</h3><div class="row"><button type="button" class="btn" data-act="photocam">Take a picture</button><button type="button" class="btn" data-act="photofile">Choose a picture</button></div>' +
      '<p class="hint" id="photoHint">Take a picture or choose one. It goes behind your characters.</p>' +
      '<div id="photoCtl">' + field('psize', 'Size', 0.3, 3, 0.05) + field('px', 'Left or right', -12, 12, 0.1) + field('py', 'Up or down', -8, 12, 0.1) + field('pdist', 'Distance', 1, 30, 0.5) +
      '<h3>Floor</h3>' + seg('pfloor', [['paper', 'Paper floor'], ['shadow', 'Photo only'], ['hidden', 'Hidden']], 'Floor') +
      '<p class="hint">Photo only keeps the shadows and hides the paper.</p>' + tog('pflat', 'Flat on floor') + '</div></div></div>' +
      '<div class="group"><h3>Add a character</h3><div class="chips" id="charChips">' + charChips + '</div>' +
      '<h3>Add the L</h3><div class="chips">' + lChips + '</div>' +
      '<h3>Add a speech bubble</h3><div class="chips">' + bubChips + '</div>' +
      '<h3>Add a prop</h3><input type="text" id="propFind" placeholder="Find a prop" aria-label="Find a prop" autocomplete="off" style="margin-bottom:8px">' +
      '<div class="propgrid" id="propGrid">' + propHtml + '</div>' +
      '<button type="button" class="btn" data-act="uploadprop">Add your image</button></div>' +
      '<div class="group"><h3>In the scene</h3><ul class="items" id="itemList"></ul>' +
      '<div id="itemCtl" hidden>' +
      '<h3 id="selName">Selected</h3>' +
      field('y', 'Height off the ground', 0, 8, 0.05) +
      '<div id="mountBox"><h3>Mount</h3>' + seg('mount', [['none', 'None'], ['stick', 'Stick'], ['string', 'String']], 'Mount') + '</div>' +
      field('x', 'Left or right', -12, 12, 0.05) + field('z', 'Closer or farther', -14, 10, 0.05) +
      field('yaw', 'Turn', -180, 180, 1) + field('tilt', 'Tilt', -40, 40, 1) + field('scale', 'Size', 0.2, 4, 0.05) +
      '<div class="row">' + tog('flip', 'Flip left and right').replace('class="tog"', 'class="tog" style="margin:0"') + '</div>' +
      '<div id="bubbleBox" hidden><h3>Bubble words</h3><label for="bubText" class="small">Words</label><textarea id="bubText" maxlength="160" aria-label="Bubble words"></textarea>' +
      '<h3>Bubble color</h3>' + swatches('bubcolor', PAL, 'Bubble color') + '<div id="bubTail"><h3>Tail</h3>' + seg('bubtail', [['left', 'Left'], ['right', 'Right'], ['down', 'Down'], ['none', 'None']], 'Tail') + '</div></div>' +
      '<div id="giveBox" hidden><h3>Give to</h3><select id="giveTarget" aria-label="Give to which character"></select><div class="chips" style="margin-top:8px">' + chip('give', 'handL', 'Left hand') + chip('give', 'handR', 'Right hand') + chip('give', 'head', 'Head') + '</div></div>' +
      '<div class="row"><button type="button" class="btn" data-act="dup">Duplicate</button><button type="button" class="btn danger" data-act="del">Delete</button></div>' +
      '</div><p class="hint" id="itemHint">Tap an item in the picture to pick it, then drag it along the floor. Drag the small tab on its ring to lift it.</p></div>';

    var emoteChips = chip('emote', 'none', 'None') + DP.EMOTES.map(function (e) {
      return '<button type="button" class="chip thumb" data-act="emote" data-v="' + e.id + '" aria-pressed="false"><img alt="" src="' + svgData(e.svg) + '">' + e.name + '</button>';
    }).join('');
    var wearChips = DP.COSTUMES.map(function (c) {
      return '<button type="button" class="chip thumb" data-act="wear" data-v="' + c.id + '" aria-pressed="false"><img alt="" src="' + svgData(A.costumes[c.id]) + '">' + c.name + '</button>';
    }).join('');
    h.pose =
      '<div id="poseNone"><p class="hint">Pick a character in the picture or here. Poses and costumes work on the critters, emotes work on anything.</p><div class="chips" id="poseChooser"></div></div>' +
      '<div id="poseBox" hidden><h3 id="poseName" style="margin:0 0 8px">Pose</h3>' +
      '<div id="poseSec"><div class="group"><h3>Pose</h3><div class="chips">' +
      DP.POSES.map(function (p) { return chip('pose', p.id, p.name); }).join('') + '</div></div>' +
      '<div class="group">' + field('head', 'Head tilt', -40, 40, 1) + field('wingA', 'Left wing', 0, 160, 1) + field('wingB', 'Right wing', 0, 160, 1) +
      field('lean', 'Lean left or right', -25, 25, 1) + field('bend', 'Lean back or forward', -25, 25, 1) + field('hop', 'Hop', 0, 1, 0.05) + '</div>' +
      '<div class="group"><h3>Looking</h3>' + seg('look', [['-1', 'Left'], ['0', 'Front'], ['1', 'Right']], 'Looking') +
      '<div id="bodyColors"><h3>Body color</h3><div id="bodySw"></div></div></div></div>' +
      '<div class="group" id="emoteSec"><h3>Emote</h3><div class="chips">' + emoteChips + '</div>' +
      '<div id="emoteCtl">' + field('emx', 'Left or right of head', -1.5, 1.5, 0.05) + field('ems', 'Emote size', 0.4, 2.5, 0.05) + '</div>' +
      '<h3>Move</h3><div class="chips">' + DP.MOVES.map(function (m) { return chip('move', m.id, m.name); }).join('') + '</div>' +
      '<p class="hint">Choosing an emote also picks a move. Change the move on its own if you like.</p></div>' +
      '<div class="group" id="holdSec"><h3>Holding</h3><div class="chips">' +
      chip('holdin', 'handL', 'Hold in left hand') + chip('holdin', 'handR', 'Hold in right hand') + chip('holdin', 'head', 'On head') + chip('holdin', 'neck', 'Around neck') + chip('holdin', 'feet', 'At feet') + '</div>' +
      '<div class="chips" id="attList" style="margin-top:8px"></div>' +
      '<div id="attCtl" hidden>' + field('asize', 'Held size', 0.2, 3, 0.05) + field('arot', 'Held turn', -180, 180, 1) + field('aox', 'Held left or right', -40, 40, 1) + field('aoy', 'Held up or down', -40, 40, 1) +
      '<div id="attBub" hidden><label for="attText" class="small">Bubble words</label><textarea id="attText" maxlength="160" aria-label="Held bubble words"></textarea></div>' +
      '<div class="row"><button type="button" class="btn" data-act="letgo">Let go</button><button type="button" class="btn danger" data-act="takeoff">Take off</button></div></div></div>' +
      '<div class="group" id="wearSec"><h3>Wear</h3><div class="chips">' + wearChips + '</div><p class="hint">Hats and horns sit on the head, the scarf goes around the neck, the stick and football go in a hand.</p></div></div>';

    h.camera =
      '<div class="group"><h3>Moving the camera</h3>' + seg('mode', [['orbit', 'Orbit'], ['fly', 'Fly']], 'Camera mode') +
      '<p class="hint" id="modeHint"></p></div>' +
      '<div class="group">' + field('mm', 'Lens', 0, 1000, 1) + '<div class="chips">' + [16, 24, 35, 50, 85, 135].map(function (m) { return chip('mm', m, m + ''); }).join('') + '</div>' +
      field('fn', 'Aperture', 0, 24, 1) + '<div class="chips">' + [1.4, 2, 2.8, 4, 8, 16].map(function (m) { return chip('fn', m, 'f/' + m); }).join('') + '</div>' +
      '<p class="hint">A wide opening (small f number) blurs what is near and far.</p></div>' +
      '<div class="group"><h3>Focus</h3><div class="row">' + '<button type="button" class="btn" data-act="tapfocus" aria-pressed="false">Tap to focus</button><button type="button" class="btn" data-act="focussel">Focus on selected</button></div>' +
      field('fd', 'Focus distance', 0, 1000, 1) + '</div>' +
      '<div class="group">' + field('roll', 'Tilt the camera', -30, 30, 1) + field('exp', 'Exposure', -2, 2, 0.1) +
      '<p class="hint" id="camHeight"></p>' + tog('grid', 'Thirds grid') +
      '<button type="button" class="btn" data-act="resetcam">Reset camera</button></div>';

    h.light =
      '<div class="group"><h3>Time of day</h3><div class="chips">' + App.LIGHTS.map(function (l) { return chip('light', l.id, l.name); }).join('') + '</div></div>' +
      '<div class="group"><h3>Sun</h3>' + field('az', 'Direction', -180, 180, 1) + field('el', 'Height in the sky', 2, 90, 1) + field('si', 'Brightness', 0, 3, 0.05) + field('sk', 'Warmth', 2500, 9000, 100) +
      field('fill', 'Fill light', 0, 1.5, 0.05) + '<h3>Shadow edge</h3>' + seg('soft', [['0', 'Crisp'], ['1', 'Soft'], ['2', 'Softer'], ['3', 'Softest']], 'Shadow edge') + '</div>' +
      '<div class="group"><h3>Spotlight</h3>' + tog('spot', 'Spotlight on') + '<div id="spotBox">' + seg('spotat', [['item', 'On selected item'], ['camera', 'From camera']], 'Spotlight place') +
      field('sc', 'Cone width', 10, 80, 1) + field('sp', 'Brightness', 0, 4, 0.05) +
      swatches('spotcolor', [['#ffffff', '#ffffff', 'White'], ['#ffb457', '#ffb457', 'Amber'], ['#b3ddf2', '#b3ddf2', 'Chicago blue'], ['#f9cddd', '#f9cddd', 'Pink'], ['#c9edc2', '#c9edc2', 'Green']], 'Spotlight color') + '</div></div>';

    h.look =
      '<div class="group"><h3>Filter</h3><div class="chips">' + App.FILTERS.map(function (f) { return '<button type="button" class="chip filt" data-act="filter" data-v="' + f.id + '" aria-pressed="false"><i style="background:' + f.c + '"></i>' + f.name + '</button>'; }).join('') + '</div>' +
      field('strength', 'Filter strength', 0, 1, 0.05) + '</div>' +
      '<div class="group">' + field('bright', 'Brightness', -1, 1, 0.05) + field('contrast', 'Contrast', 0.5, 1.5, 0.05) + field('sat', 'Color', 0, 2, 0.05) + '</div>' +
      '<div class="group">' + field('vig', 'Vignette', 0, 1, 0.05) + seg('vig', [['0', 'Soft'], ['1', 'Paper edge']], 'Vignette style') + field('grain', 'Paper grain', 0, 1, 0.05) +
      '<button type="button" class="btn" data-act="resetlook">Reset look</button></div>';

    var lib = DP.buildStickerLib();
    function libGrid(g) {
      return '<div class="propgrid">' + lib.filter(function (l) { return l.group === g; }).map(function (l) {
        return '<button type="button" data-act="stkadd" data-v="' + esc(l.id) + '" aria-label="Add sticker ' + esc(l.name) + '" title="' + esc(l.name) + '"><img alt="" decoding="async" src="' + svgData(l.svg) + '"></button>';
      }).join('') + '</div>';
    }
    h.stickers =
      '<div class="group"><h3>Add words</h3><div class="chips">' + chip('stk', 'bubble', 'Speech bubble') + chip('stk', 'thought', 'Thought bubble') + chip('stk', 'label', 'Text label') + '</div>' +
      '<div id="stkEdit" hidden><h3>Selected sticker</h3>' +
      '<div id="stkTextBox"><label for="stkText" class="small">Words</label><textarea id="stkText" maxlength="240" aria-label="Words"></textarea></div>' +
      '<div id="stkTail"><h3>Tail</h3><div class="chips">' + [['bl', 'Down left'], ['br', 'Down right'], ['tl', 'Up left'], ['tr', 'Up right'], ['none', 'None']].map(function (t) { return chip('tail', t[0], t[1]); }).join('') + '</div></div>' +
      '<div id="stkBg"><h3>Tape</h3><div class="chips">' + [['tape', 'Tape'], ['pink', 'Pink'], ['blue', 'Blue'], ['yellow', 'Yellow'], ['none', 'None']].map(function (t) { return chip('bg', t[0], t[1]); }).join('') + '</div></div>' +
      '<div id="stkColor"><h3 id="stkColorName">Color</h3>' + swatches('stkcolor', PAL, 'Sticker color') + '</div>' +
      field('stksize', 'Size', 0.05, 1.2, 0.01) + field('stkturn', 'Turn', -180, 180, 1) +
      '<div class="row"><button type="button" class="btn" data-act="stkfront">Bring to front</button><button type="button" class="btn" data-act="stkdup">Duplicate</button><button type="button" class="btn danger" data-act="stkdel">Delete</button></div></div></div>' +
      '<div class="group"><h3>Badges</h3>' + libGrid('badges') + '<h3>Shapes</h3>' + libGrid('shapes') + '<h3>Tape</h3>' + libGrid('tape') + '<h3>Symbols</h3>' + libGrid('symbols') +
      '<button type="button" class="btn" data-act="stkupload">Add your picture</button></div>' +
      '<p class="hint">Drag a sticker to move it. Drag its corner dot to resize and turn it. Pinch with two fingers on a phone.</p>';

    var groups = [], seen = {};
    App.PLATFORMS.forEach(function (p) { if (!seen[p.group]) { seen[p.group] = []; groups.push(p.group); } seen[p.group].push(p); });
    h.frame =
      '<div class="group"><h3>Made for</h3>' + groups.map(function (g) {
        return '<div class="platrow"><h3>' + g + '</h3><div class="chips">' + seen[g].map(function (p) { return chip('plat', p.id, p.name); }).join('') + '</div></div>';
      }).join('') + '<p class="sizeline" id="sizeLine"></p>' + seg('fscale', [['1', '1x size'], ['2', '2x size']], 'Export size') +
      '<div id="safeBox">' + tog('safe', 'Show safe area') + '<p class="hint" id="safeHint"></p></div></div>' +
      '<div class="group"><h3>Paper frame</h3><div class="chips">' + DP.FRAMES.map(function (f) { return chip('fstyle', f.id, f.name); }).join('') + '</div>' +
      '<div id="frameTextBox" hidden><label for="frameText" class="small" id="frameTextLabel">Caption</label><input type="text" id="frameText" maxlength="60" autocomplete="off"></div></div>';

    h.save =
      '<div class="group"><h3>Your scenes</h3><label for="sceneName" class="small">Name</label><input type="text" id="sceneName" maxlength="60" autocomplete="off" style="margin-bottom:8px">' +
      '<div class="row"><button type="button" class="btn primary" data-act="savescene">Save scene</button><button type="button" class="btn" data-act="newscene">New scene</button></div>' +
      '<ul class="scenes" id="sceneList"></ul>' +
      '<div class="row"><button type="button" class="btn" data-act="export">Export file</button><button type="button" class="btn" data-act="import">Import file</button></div>' +
      '<p class="hint" id="storeHint"></p></div>' +
      '<div class="group"><h3>Photo roll</h3><div class="roll" id="rollGrid"></div><p class="hint" id="rollHint">Your last 12 photos stay here on this device.</p></div>';

    TABS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'tab'; b.setAttribute('role', 'tab'); b.id = 'tab-' + t[0];
      b.setAttribute('aria-controls', 'tp-' + t[0]); b.setAttribute('aria-selected', 'false'); b.tabIndex = -1;
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[t[0]] + '</svg><span>' + t[1] + '</span>';
      b.addEventListener('click', function () { setTab(t[0], true); });
      b.addEventListener('keydown', function (e) {
        var i = TABS.map(function (x) { return x[0]; }).indexOf(t[0]);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { setTab(TABS[(i + 1) % TABS.length][0], false); $('tab-' + curTab).focus(); e.preventDefault(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { setTab(TABS[(i + TABS.length - 1) % TABS.length][0], false); $('tab-' + curTab).focus(); e.preventDefault(); }
      });
      tabsEl.appendChild(b);
      var sec = document.createElement('section'); sec.className = 'panelsec'; sec.id = 'tp-' + t[0]; sec.setAttribute('role', 'tabpanel'); sec.setAttribute('aria-labelledby', 'tab-' + t[0]); sec.hidden = true;
      sec.innerHTML = h[t[0]];
      content.appendChild(sec);
    });
  }

  function setTab(id, fromClick) {
    if (fromClick && isPhone() && id === curTab && panel.dataset.open === 'true') { setOpen(false); return; }
    curTab = id;
    TABS.forEach(function (t) {
      var on = t[0] === id, b = $('tab-' + t[0]);
      b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
      $('tp-' + t[0]).hidden = !on;
    });
    if (isPhone() && panel.dataset.open !== 'true') setOpen(true);
    content.scrollTop = 0;
    if (id === 'save') { refreshScenes(); refreshRoll(); }
    if (id === 'camera') syncCamera();
    if (id === 'stickers') syncSticker();
    App.tabNow = id;
  }
  function setOpen(o) {
    panel.dataset.open = o ? 'true' : 'false';
    $('sheetToggle').setAttribute('aria-expanded', o ? 'true' : 'false');
  }

  /* ---------- fields ---------- */
  var F = {};
  var FS = [3200, 3500, 4000, 4500, 5000, 5600, 6500, 7500, 8500];
  var STD_F = [1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
  function fmtF(n) { return 'f/' + (n < 10 ? (Math.round(n * 10) / 10) : Math.round(n)); }
  function selItem() { return App.sel ? App.findItem(App.sel) : null; }
  function selSticker() { var id = App.overlay && App.overlay.selected; return id ? App.overlay.find(id) : null; }
  function itemField(id, key, fmt) {
    F[id] = { get: function () { var it = selItem(); return it ? it[key] : undefined; }, set: function (v) { var it = selItem(); if (!it) return; it[key] = v; App.applyItem(it.id); }, fmt: fmt };
  }
  function poseField(id, key, fmt) {
    F[id] = { get: function () { var it = selItem(); return it && it.pose ? it.pose[key] : undefined; },
      set: function (v) { var it = selItem(); if (!it || !it.pose) return; it.pose[key] = v; it.pose.preset = 'custom'; App.applyItem(it.id); markPressed(); }, fmt: fmt };
  }
  function photoField(key, fmt) {
    return { get: function () { return S().photo[key]; }, set: function (v) { S().photo[key] = v; App.applyPhoto(); }, fmt: fmt };
  }
  var attSel = null;
  function selAtt() { var it = selItem(); if (!it || !it.attach) return null; for (var i = 0; i < it.attach.length; i++) if (it.attach[i].id === attSel) return it.attach[i]; return null; }
  function attField(id, key, fmt) {
    F[id] = { get: function () { var a = selAtt(); return a ? a[key] : undefined; }, set: function (v) { var a = selAtt(), it = selItem(); if (a && it) { a[key] = v; App.applyItem(it.id); } }, fmt: fmt };
  }
  function lightField(id, key, fmt) {
    F[id] = { get: function () { return S().light[key]; }, set: function (v) { S().light[key] = v; S().light.preset = 'custom'; App.applyLight(); markPressed(); }, fmt: fmt };
  }
  function lookField(id, key, fmt) {
    F[id] = { get: function () { return S().look[key]; }, set: function (v) { S().look[key] = v; App.invalidate(); }, fmt: fmt };
  }
  function pct(v) { return Math.round(v * 100) + '%'; }
  function deg(v) { return Math.round(v) + '°'; }
  function defineFields() {
    itemField('x', 'x', function (v) { return v.toFixed(2); }); itemField('z', 'z', function (v) { return v.toFixed(2); }); itemField('y', 'y', function (v) { return v.toFixed(2); });
    F.psize = photoField('size', function (v) { return v.toFixed(2) + 'x'; }); F.px = photoField('x', function (v) { return v.toFixed(1); }); F.py = photoField('y', function (v) { return v.toFixed(1); }); F.pdist = photoField('dist', function (v) { return v.toFixed(1); });
    F.emx = { get: function () { var it = selItem(); return it && it.emote ? it.emote.x : 0; }, set: function (v) { var it = selItem(); if (it && it.emote) { it.emote.x = v; App.applyItem(it.id); } }, fmt: function (v) { return v.toFixed(2); } };
    F.ems = { get: function () { var it = selItem(); return it && it.emote ? it.emote.s : 1; }, set: function (v) { var it = selItem(); if (it && it.emote) { it.emote.s = v; App.applyItem(it.id); } }, fmt: function (v) { return v.toFixed(2) + 'x'; } };
    attField('asize', 's', function (v) { return v.toFixed(2) + 'x'; }); attField('arot', 'r', deg); attField('aox', 'ox', function (v) { return Math.round(v); }); attField('aoy', 'oy', function (v) { return Math.round(v); });
    itemField('yaw', 'yaw', deg); itemField('tilt', 'tilt', deg); itemField('scale', 'scale', function (v) { return v.toFixed(2) + 'x'; });
    poseField('head', 'head', deg); poseField('wingA', 'wingA', deg); poseField('wingB', 'wingB', deg); poseField('lean', 'lean', deg); poseField('bend', 'bend', deg); poseField('hop', 'hop', pct);
    F.mm = { get: function () { return Math.log(S().lens.mm / 14) / Math.log(200 / 14) * 1000; }, set: function (v) { S().lens.mm = Math.round(14 * Math.pow(200 / 14, v / 1000)); App.applyLens(); App.positionReticle(); App.invalidate(); markPressed(); }, fmt: function () { return S().lens.mm + ' mm'; } };
    F.fn = { get: function () { return Math.round(Math.log(S().lens.fnum / 1.4) / Math.LN2 * 6); },
      set: function (v) { var raw = 1.4 * Math.pow(2, v / 6), best = STD_F[0]; STD_F.forEach(function (s) { if (Math.abs(Math.log(s / raw)) < Math.abs(Math.log(best / raw))) best = s; }); S().lens.fnum = best; App.invalidate(); markPressed(); },
      fmt: function () { return fmtF(S().lens.fnum); } };
    F.fd = { get: function () { return Math.log(Math.max(0.6, App.focusDistance()) / 0.6) / Math.log(40 / 0.6) * 1000; }, set: function (v) { App.setFocusDist(0.6 * Math.pow(40 / 0.6, v / 1000)); }, fmt: function () { return (App.focusDistance() * App.UNIT_MM / 1000).toFixed(2) + ' m'; } };
    F.roll = { get: function () { return App.rig.s.roll; }, set: function (v) { App.rig.s.roll = v; App.rig.apply(); App.invalidate(); }, fmt: deg };
    F.exp = { get: function () { return S().lens.exposure; }, set: function (v) { S().lens.exposure = v; App.invalidate(); }, fmt: function (v) { return (v > 0 ? '+' : '') + v.toFixed(1) + ' EV'; } };
    lightField('az', 'az', deg); lightField('el', 'el', deg); lightField('si', 'i', function (v) { return v.toFixed(2); }); lightField('sk', 'k', function (v) { return Math.round(v) + ' K'; }); lightField('fill', 'fill', function (v) { return v.toFixed(2); });
    F.sc = { get: function () { return S().light.spot.cone; }, set: function (v) { S().light.spot.cone = v; S().light.preset = 'custom'; App.applyLight(); markPressed(); }, fmt: deg };
    F.sp = { get: function () { return S().light.spot.i; }, set: function (v) { S().light.spot.i = v; S().light.preset = 'custom'; App.applyLight(); markPressed(); }, fmt: function (v) { return v.toFixed(2); } };
    lookField('strength', 'strength', pct); lookField('bright', 'brightness', function (v) { return (v > 0 ? '+' : '') + v.toFixed(2); }); lookField('contrast', 'contrast', function (v) { return v.toFixed(2); });
    lookField('sat', 'saturation', function (v) { return v.toFixed(2); }); lookField('vig', 'vignette', pct); lookField('grain', 'grain', pct);
    F.stksize = { get: function () { var s = selSticker(); return s ? s.w : undefined; }, set: function (v) { var s = selSticker(); if (s) { s.w = v; App.overlay.render(); App.save(); } }, fmt: function (v) { return Math.round(v * 100) + '%'; } };
    F.stkturn = { get: function () { var s = selSticker(); return s ? Math.round((s.r || 0) / D2R) : undefined; }, set: function (v) { var s = selSticker(); if (s) { s.r = v * D2R; App.overlay.render(); App.save(); } }, fmt: deg };
    Object.keys(F).forEach(function (id) {
      var el = $('f-' + id); if (!el) return;
      el.addEventListener('input', function () {
        var v = parseFloat(el.value); F[id].set(v);
        $('o-' + id).textContent = F[id].fmt ? F[id].fmt(F[id].get() === undefined ? v : v) : v;
        App.bump(); App.save();
        if (id === 'x' || id === 'z' || id === 'y' || id === 'scale') App.updateRing();
        if (id === 'y') syncMount();
        if (id === 'mm' || id === 'fn') App.showReticle();
      });
    });
  }
  function syncFields() {
    Object.keys(F).forEach(function (id) {
      var el = $('f-' + id); if (!el) return;
      var v = F[id].get();
      if (v === undefined) return;
      el.value = v;
      $('o-' + id).textContent = F[id].fmt ? F[id].fmt(parseFloat(el.value)) : el.value;
    });
  }

  /* ---------- pressed states ---------- */
  function setPressed(act, v, on) {
    var els = content.querySelectorAll('[data-act="' + act + '"]');
    for (var i = 0; i < els.length; i++) {
      var e = els[i], dv = e.getAttribute('data-v');
      if (v === null) e.setAttribute('aria-pressed', on ? 'true' : 'false');
      else e.setAttribute('aria-pressed', dv === String(v) ? 'true' : 'false');
    }
  }
  function markPressed() {
    var st = S(); if (!st) return;
    var it = selItem(), pose = it && it.pose, sp = selSticker();
    setPressed('set', st.set.id);
    $('sweepColors').hidden = st.set.id !== 'sweep';
    setPressed('bdcolor', st.set.color);
    setPressed('flip', null, it && it.flip);
    setPressed('pose', pose ? pose.preset : '');
    setPressed('look', pose ? pose.look : '');
    setPressed('body', pose ? pose.color : '');
    setPressed('emote', it ? (it.emote ? it.emote.id : 'none') : '');
    setPressed('move', it ? (it.move || 'none') : '');
    setPressed('mount', it ? (it.mount || 'none') : '');
    setPressed('pfloor', st.photo.floor); setPressed('pflat', null, st.photo.flat);
    var worn = it && it.attach ? it.attach.map(function (a) { return a.kind; }) : [];
    var wl = content.querySelectorAll('[data-act="wear"]');
    for (var wi = 0; wi < wl.length; wi++) wl[wi].setAttribute('aria-pressed', worn.indexOf('costume:' + wl[wi].getAttribute('data-v')) >= 0 ? 'true' : 'false');
    setPressed('att', attSel);
    var bub = it && it.kind.indexOf('bubble:') === 0;
    if (bub) { setPressed('bubcolor', it.color); setPressed('bubtail', it.tail); }
    setPressed('mode', App.rig.mode);
    setPressed('mm', st.lens.mm); setPressed('fn', st.lens.fnum);
    setPressed('tapfocus', null, !!App.tapFocus);
    setPressed('grid', null, st.lens.grid);
    setPressed('light', st.light.preset); setPressed('soft', st.light.soft);
    setPressed('spot', null, st.light.spot.on); setPressed('spotat', st.light.spot.at); setPressed('spotcolor', st.light.spot.color);
    $('spotBox').style.opacity = st.light.spot.on ? '1' : '0.5';
    setPressed('filter', st.look.filter); setPressed('vig', st.look.vigStyle);
    setPressed('plat', st.frame.platform); setPressed('fscale', st.frame.scale); setPressed('fstyle', st.frame.style); setPressed('safe', null, st.frame.safe);
    if (sp) { setPressed('tail', sp.tail); setPressed('bg', sp.bg); setPressed('stkcolor', sp.type === 'label' ? (sp.ink || '#2a2350') : sp.color); }
  }

  /* ---------- sync sections ---------- */
  function renderItemList() {
    var ul = $('itemList');
    ul.innerHTML = '';
    S().items.forEach(function (it) {
      var o = App.objs[it.id], info = DP.kindInfo(it.kind);
      var li = document.createElement('li');
      var nm = info.upload ? (S().uploads[it.kind.slice(7)] ? S().uploads[it.kind.slice(7)].name : 'Picture') : info.name;
      li.innerHTML = '<button type="button" data-act="pick" data-v="' + esc(it.id) + '" aria-pressed="' + (App.sel === it.id) + '">' + (o && o.thumb ? '<img alt="" src="' + o.thumb + '">' : '<img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">') + '<span class="nm">' + esc(nm) + '</span></button>';
      ul.appendChild(li);
    });
    if (!S().items.length) ul.innerHTML = '<li class="hint">The scene is empty. Add a character above.</li>';
  }
  var NOUN = { chance: 'arm', sue: 'arm' };
  var lastBodyKind = '';
  function syncMount() {
    var it = selItem();
    $('mountBox').hidden = !(it && it.y > 0.05);
  }
  function renderAtt() {
    var it = selItem(), list = it && it.attach ? it.attach : [], box = $('attList');
    var names = { handL: 'left hand', handR: 'right hand', head: 'head', neck: 'neck', feet: 'feet' };
    box.innerHTML = '';
    if (attSel && !list.some(function (a) { return a.id === attSel; })) attSel = null;
    if (!attSel && list.length) attSel = list[0].id;
    list.forEach(function (a) {
      var info = DP.kindInfo(a.kind), nm = info ? (info.upload ? 'Picture' : info.name) : a.kind;
      box.insertAdjacentHTML('beforeend', '<button type="button" class="chip" data-act="att" data-v="' + esc(a.id) + '" aria-pressed="' + (a.id === attSel) + '">' + esc(cap(nm)) + ', ' + names[a.slot] + '</button>');
    });
    $('attCtl').hidden = !list.length;
    var a = selAtt();
    $('attBub').hidden = !(a && a.kind.indexOf('bubble:') === 0);
    if (a && a.kind.indexOf('bubble:') === 0 && document.activeElement !== $('attText')) $('attText').value = a.text || '';
  }
  function renderBodyColors(def, kind) {
    var key = kind + '|' + (def.colors ? def.colors.length : 0);
    if (key === lastBodyKind) return;
    lastBodyKind = key;
    $('bodyColors').hidden = !def.colors;
    $('bodySw').innerHTML = def.colors ? swatches('body', def.colors.map(function (c, i) { return [String(i), c.sw || def.main || '#cccccc', c.name]; }), 'Body color') : '';
  }
  function syncSelection() {
    var it = selItem(), puppet = !!(it && DP.isPuppet(it.kind)), bub = !!(it && it.kind.indexOf('bubble:') === 0);
    $('itemCtl').hidden = !it; $('itemHint').hidden = !!it;
    var canEmote = !!(it && !bub);
    $('poseNone').hidden = canEmote; $('poseBox').hidden = !canEmote;
    if (it) {
      var info = DP.kindInfo(it.kind);
      $('selName').textContent = info.upload ? 'Selected: Picture' : 'Selected: ' + info.name;
      syncMount();
      $('bubbleBox').hidden = !bub;
      if (bub) { $('bubTail').hidden = it.kind === 'bubble:sign' || it.kind === 'bubble:shout'; if (document.activeElement !== $('bubText')) $('bubText').value = it.text || ''; }
      // give a prop to a character
      var holdable = /^(symbol|upload|costume|bubble):/.test(it.kind);
      var targets = S().items.filter(function (i) { return DP.isPuppet(i.kind); });
      $('giveBox').hidden = !(holdable && targets.length);
      if (holdable && targets.length) {
        var sel = $('giveTarget'), prev = sel.value; sel.innerHTML = '';
        targets.forEach(function (t, n) { var o = document.createElement('option'); o.value = t.id; o.textContent = DP.kindInfo(t.kind).name + (targets.filter(function (z) { return z.kind === t.kind; }).length > 1 ? ' ' + (targets.filter(function (z) { return z.kind === t.kind; }).indexOf(t) + 1) : ''); sel.appendChild(o); });
        if (prev && targets.some(function (t) { return t.id === prev; })) sel.value = prev;
      }
    }
    if (canEmote) {
      var def = puppet ? DP.PUPPETS[it.kind] : null;
      $('poseName').textContent = (it.kind.indexOf('upload:') === 0 ? 'Picture' : DP.kindInfo(it.kind).name) + (puppet ? ', pose and costumes' : ', emote');
      $('poseSec').hidden = !puppet; $('holdSec').hidden = !puppet; $('wearSec').hidden = !puppet;
      $('emoteCtl').hidden = !it.emote;
      if (puppet) {
        var n = NOUN[it.kind] || 'wing', w = def.wings;
        $('f-wingA').parentNode.hidden = w === 0; $('f-wingB').parentNode.hidden = w < 2;
        content.querySelector('label[for="f-wingA"]').textContent = w === 2 ? 'Left ' + n : cap(n);
        content.querySelector('label[for="f-wingB"]').textContent = 'Right ' + n;
        renderBodyColors(def, it.kind);
        renderAtt();
      }
    }
    var ch = $('poseChooser'); ch.innerHTML = '';
    var cand = S().items.filter(function (i) { return i.kind.indexOf('bubble:') !== 0 && !/^(symbol|costume):/.test(i.kind); });
    cand.forEach(function (i) {
      var same = S().items.filter(function (z) { return z.kind === i.kind; });
      var nm = i.kind.indexOf('upload:') === 0 ? 'Picture' : DP.kindInfo(i.kind).name;
      ch.insertAdjacentHTML('beforeend', chip('pick', i.id, nm + (same.length > 1 ? ' ' + (same.indexOf(i) + 1) : '')));
    });
    if (!ch.children.length) ch.innerHTML = '<p class="hint">There is no character in the scene. Add one in the Scene tab.</p>';
    syncFields(); markPressed(); renderItemList();
    var ph = S().photo, on = S().set.id === 'photo';
    $('photoBox').hidden = !on;
    $('photoCtl').hidden = !ph.data;
    $('photoHint').hidden = !!ph.data;
  }
  function syncCamera() {
    syncFields(); markPressed();
    var h = App.rig.camera.position.y * App.UNIT_MM / 1000;
    $('camHeight').textContent = 'Camera height: ' + h.toFixed(2) + ' m';
    $('modeHint').textContent = App.rig.mode === 'orbit'
      ? 'Drag to go around the scene. Scroll or pinch to move closer. Right-drag or two fingers to slide.'
      : 'Drag to look around. Use the pad (or W A S D, Q and E) to walk. Scroll or pinch to move forward.';
    $('fly').hidden = App.rig.mode !== 'fly';
  }
  var syncPend = false;
  function syncSticker() {
    var s = selSticker();
    $('stkEdit').hidden = !s;
    if (s) {
      $('stkTextBox').hidden = s.type === 'img'; $('stkTail').hidden = !(s.type === 'bubble' || s.type === 'thought');
      $('stkBg').hidden = s.type !== 'label'; $('stkColor').hidden = s.type === 'img';
      $('stkColorName').textContent = s.type === 'label' ? 'Text color' : 'Bubble color';
      if (document.activeElement !== $('stkText')) $('stkText').value = s.text || '';
    }
    syncFields(); markPressed();
  }
  function syncFrame() {
    var p = App.platform(S().frame.platform), sz = App.exportSize();
    $('sizeLine').textContent = p.group + ', ' + p.name + ': ' + sz.w + ' x ' + sz.h + ' px';
    var fr = DP.FRAMES.filter(function (f) { return f.id === S().frame.style; })[0];
    $('frameTextBox').hidden = !(fr && fr.text);
    if (fr && fr.text) { $('frameTextLabel').textContent = fr.id === 'lsign' ? 'Sign words' : (fr.id === 'ticket' ? 'Ticket words' : 'Caption'); if (document.activeElement !== $('frameText')) $('frameText').value = S().frame.text; }
    $('safeBox').hidden = !(p.safe || p.banner);
    $('safeHint').textContent = p.banner ? 'The part of a banner that shows on every screen (1546 x 423).' : 'Rough places where the app puts its own buttons and captions.';
    markPressed();
  }

  /* ---------- upload helper ---------- */
  function readUpload(file, cb) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml|gif)$/.test(file.type)) { App.msg('Pick a PNG, JPG, WebP or SVG picture.'); return; }
    var fr = new FileReader();
    fr.onload = function () {
      var data = fr.result;
      DP.loadImage(data).then(function (im) {
        var w = im.naturalWidth || 512, h = im.naturalHeight || 512, m = Math.max(w, h);
        var keep = file.type === 'image/svg+xml' || (m <= 1400 && file.size < 1500000);
        if (!keep) {
          var k = 1400 / m, c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          data = c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9);
        }
        var id = App.nid('u');
        S().uploads[id] = { name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Picture', data: data };
        cb(id);
      }, function () { App.msg('That picture could not be read.'); });
    };
    fr.readAsDataURL(file);
  }

  /* ---------- dialogs ---------- */
  var resUrl = null, resRec = null, lastFocus = null;
  App.showResult = function (rec) {
    if (resUrl) URL.revokeObjectURL(resUrl);
    resRec = rec; resUrl = URL.createObjectURL(rec.blob);
    $('resImg').src = resUrl; $('resDownload').href = resUrl; $('resDownload').download = rec.name;
    $('resInfo').textContent = rec.name + ', ' + rec.w + ' x ' + rec.h + ' px, ' + Math.round(rec.blob.size / 1024) + ' KB';
    var canShare = false;
    try { canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([rec.blob], rec.name, { type: 'image/png' })] })); } catch (e) { canShare = false; }
    $('resShare').hidden = !canShare;
    lastFocus = document.activeElement;
    $('resultModal').hidden = false; $('resDownload').focus();
  };
  function closeResult() { $('resultModal').hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  var confirmCb = null;
  function confirmDlg(title, text, yes, no, cb) {
    $('cfTitle').textContent = title; $('cfText').textContent = text; $('cfYes').textContent = yes; $('cfNo').textContent = no; confirmCb = cb;
    lastFocus = document.activeElement; $('confirmModal').hidden = false; $('cfNo').focus();
  }
  UI.closeModals = function () { $('resultModal').hidden = true; $('confirmModal').hidden = true; $('pickModal').hidden = true; confirmCb = null; };
  $('resBack').addEventListener('click', closeResult);
  $('resDownload').addEventListener('click', function (e) { if (dlApi && resRec) { e.preventDefault(); download(resRec.blob, resRec.name); } });
  $('resShare').addEventListener('click', function () {
    if (!resRec) return;
    navigator.share({ files: [new File([resRec.blob], resRec.name, { type: 'image/png' })], title: 'DIBS photo' }).catch(function () {});
  });
  $('cfNo').addEventListener('click', function () { $('confirmModal').hidden = true; confirmCb = null; if (lastFocus && lastFocus.focus) lastFocus.focus(); });
  $('cfYes').addEventListener('click', function () { var cb = confirmCb; $('confirmModal').hidden = true; confirmCb = null; if (cb) cb(); });
  ['resultModal', 'confirmModal', 'pickModal'].forEach(function (id) {
    $(id).addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $(id).querySelectorAll('a[href],button:not([hidden]),input:not([hidden])'); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    });
  });

  /* ---------- scenes list and roll ---------- */
  function refreshScenes() {
    DP.Store.ok().then(function (ok) { $('storeHint').textContent = ok ? 'Your scene is saved on this device automatically.' : 'This browser is not keeping saved scenes. Use Export file to keep your work.'; });
    DP.Store.all('scenes').then(function (list) {
      list.sort(function (a, b) { return b.updated - a.updated; });
      var ul = $('sceneList'); ul.innerHTML = '';
      if (!list.length) { ul.innerHTML = '<li class="hint" style="border:0;padding:0">No saved scenes yet.</li>'; return; }
      list.forEach(function (sc) {
        var li = document.createElement('li');
        li.innerHTML = '<span class="nm">' + esc(sc.name) + '</span><button type="button" class="btn small" data-act="openscene" data-v="' + esc(sc.id) + '">Open</button><button type="button" class="btn small" data-act="dupscene" data-v="' + esc(sc.id) + '">Duplicate</button><button type="button" class="btn small danger" data-act="delscene" data-v="' + esc(sc.id) + '">Delete</button>';
        ul.appendChild(li);
      });
    });
  }
  function refreshRoll() {
    DP.Store.all('roll').then(function (list) {
      list.sort(function (a, b) { return b.time - a.time; });
      var g = $('rollGrid'); g.innerHTML = '';
      list.slice(0, 12).forEach(function (r) {
        var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-act', 'roll'); b.setAttribute('data-v', r.id); b.setAttribute('aria-label', 'Open photo ' + r.name);
        b.innerHTML = '<img alt="" src="' + r.thumb + '">'; g.appendChild(b);
      });
      $('rollHint').textContent = list.length ? 'Tap a photo to open it again. The last 12 stay on this device.' : 'Your last 12 photos will stay here on this device.';
    });
  }
  /* Inside a claude.ai artifact the page cannot start downloads itself; the viewer's downloads capability saves instead. */
  var dlApi = null;
  try { if (window.claude && window.claude.use) window.claude.use('downloads').then(function (d) { dlApi = d; }, function () {}); } catch (e) { dlApi = null; }
  function download(blob, name) {
    if (dlApi) {
      dlApi.save({ filename: name, data: blob }).catch(function (e) { if (!e || e.code !== 'declined') App.msg('The file could not be saved here.'); });
      return;
    }
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function safeName(n) { return (n || 'scene').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'scene'; }

  /* ---------- speech bubbles: redraw after a short pause ---------- */
  var rebuildTimer = 0;
  function rebuildSoon(id) {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(function () { App.rebuildItem(id); App.save(); }, 220);
  }

  /* ---------- the prop picker for Holding ---------- */
  var pickSlot = 'handR', pickBuilt = false;
  function openPicker(slot) {
    pickSlot = slot;
    if (!pickBuilt) {
      pickBuilt = true;
      var first = ['stick', 'football'].map(function (c) {
        return '<button type="button" data-v="costume:' + c + '" data-name="' + c + '" aria-label="Hold ' + c + '" title="' + c + '"><img alt="" src="' + svgData(A.costumes[c]) + '"></button>';
      }).join('');
      $('pkGrid').innerHTML = first + Object.keys(A.symbols).map(function (n) {
        return '<button type="button" data-v="symbol:' + n + '" data-name="' + n.replace(/-/g, ' ') + '" aria-label="Hold ' + n.replace(/-/g, ' ') + '" title="' + n.replace(/-/g, ' ') + '"><img alt="" decoding="async" loading="lazy" src="' + svgData(A.symbols[n]) + '"></button>';
      }).join('');
    }
    var names = { handL: 'left hand', handR: 'right hand', head: 'the head', neck: 'the neck', feet: 'the feet' };
    $('pkTitle').textContent = 'Put something on ' + (slot === 'handL' || slot === 'handR' ? 'the ' : '') + names[slot];
    $('pkFind').value = ''; var els = $('pkGrid').children; for (var i = 0; i < els.length; i++) els[i].hidden = false;
    lastFocus = document.activeElement;
    $('pickModal').hidden = false; $('pkFind').focus();
  }
  function closePicker() { $('pickModal').hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }

  /* ---------- actions ---------- */
  var act = {
    set: function (v) {
      var st = S(), prev = st.set.id;
      App.setBackdrop(v).then(function () { App.save(); });
      if (v === 'wacker' && st.light.preset !== 'night') { st.light = App.lightFrom(App.LIGHTS[4]); App.applyLight(); App.msg('Light changed to Lower Wacker night. Change it in Light.'); syncAll(); }
      else if (prev === 'wacker' && st.light.preset === 'night') { st.light = App.lightFrom(App.LIGHTS[1]); App.applyLight(); syncAll(); }
      syncSelection();
    },
    photocam: function () { $('filePhotoCam').click(); },
    photofile: function () { $('filePhoto').click(); },
    pfloor: function (v) { S().photo.floor = v; App.applyPhoto(); markPressed(); App.save(); },
    pflat: function () { S().photo.flat = !S().photo.flat; App.applyPhoto(); markPressed(); App.save(); },
    addl: function (v) { App.addItem('the-l:' + v); },
    addbub: function (v) { App.addItem('bubble:' + v).then(function () { App.msg('Added. Change its words in the Scene tab.'); }); },
    mount: function (v) { var it = selItem(); if (it) { it.mount = v; App.applyItem(it.id); App.save(); markPressed(); } },
    emote: function (v) {
      var it = selItem(); if (!it) return;
      if (v === 'none') { it.emote = null; }
      else { var e = DP.emoteInfo(v); it.emote = { id: v, x: it.emote ? it.emote.x : 0, s: it.emote ? it.emote.s : 1 }; it.move = e.move; }
      App.applyItem(it.id); App.save(); syncSelection();
    },
    move: function (v) { var it = selItem(); if (it) { it.move = v; App.applyItem(it.id); App.save(); markPressed(); } },
    wear: function (v) { if (App.sel) { App.wear(App.sel, v); syncSelection(); } },
    holdin: function (v) { if (App.sel) openPicker(v); },
    att: function (v) { attSel = v; renderAtt(); syncFields(); markPressed(); },
    letgo: function () { var a = selAtt(); if (a && App.sel) { var id = App.sel; App.letGo(id, a.id); attSel = null; } },
    takeoff: function () { var a = selAtt(); if (a && App.sel) { App.detach(App.sel, a.id); attSel = null; syncSelection(); } },
    bubcolor: function (v) { var it = selItem(); if (it) { it.color = v; markPressed(); rebuildSoon(it.id); } },
    bubtail: function (v) { var it = selItem(); if (it) { it.tail = v; markPressed(); rebuildSoon(it.id); } },
    give: function (v) { var it = selItem(); if (!it) return; var t = $('giveTarget').value; if (t && App.giveItem(it.id, t, v)) { App.msg('Given. Find it in the Pose tab under Holding.'); } },
    bdcolor: function (v) { App.setBackdropColor(v); markPressed(); },
    add: function (v) { App.addItem(v).then(function () { if (DP.isPuppet(v)) App.msg('Added. Try the Pose tab.'); }); },
    prop: function (v) { App.addItem('symbol:' + v); },
    uploadprop: function () { $('fileProp').click(); },
    pick: function (v) { App.select(v); },
    flip: function () { var it = selItem(); if (it) { it.flip = !it.flip; App.applyItem(it.id); App.save(); markPressed(); } },
    dup: function () { if (App.sel) App.duplicateItem(App.sel); },
    del: function () { if (App.sel) App.removeItem(App.sel); },
    pose: function (v) {
      var it = selItem(); if (!it || !it.pose) return;
      it.pose = DP.poseFromPreset(v, it.pose, it.kind);
      App.applyItem(it.id); App.save(); syncFields(); markPressed();
    },
    look: function (v) { var it = selItem(); if (it && it.pose) { it.pose.look = parseInt(v, 10); it.pose.preset = 'custom'; App.applyItem(it.id); App.save(); markPressed(); } },
    body: function (v) { var it = selItem(); if (it && it.pose) { it.pose.color = parseInt(v, 10); App.applyItem(it.id); App.save(); markPressed(); } },
    mode: function (v) { App.rig.setMode(v); App.bump(); syncCamera(); App.save(); },
    mm: function (v) { S().lens.mm = parseInt(v, 10); App.applyLens(); App.showReticle(); App.invalidate(); syncFields(); markPressed(); App.save(); },
    fn: function (v) { S().lens.fnum = parseFloat(v); App.invalidate(); App.showReticle(); syncFields(); markPressed(); App.save(); },
    tapfocus: function () { App.tapFocus = !App.tapFocus; markPressed(); if (App.tapFocus) App.msg('Tap the picture where you want it sharp.', 4000); },
    focussel: function () { if (App.sel) { App.focusOnItem(App.sel); syncFields(); } else App.msg('Pick an item first, then focus on it.'); },
    grid: function () { S().lens.grid = !S().lens.grid; App.updateGuides(); markPressed(); App.save(); },
    resetcam: function () { var c = App.starterScene().cam; App.rig.set(c); App.rig.s.roll = 0; App.bump(); syncCamera(); App.save(); },
    light: function (v) {
      var p = App.LIGHTS.filter(function (l) { return l.id === v; })[0], st = S(), keepSpot = st.light.spot;
      st.light = App.lightFrom(p); App.applyLight(); syncAll(); App.save();
    },
    soft: function (v) { S().light.soft = parseInt(v, 10); S().light.preset = 'custom'; App.applyLight(); markPressed(); App.save(); },
    spot: function () { var sp = S().light.spot; sp.on = !sp.on; S().light.preset = 'custom'; App.applyLight(); markPressed(); App.save(); },
    spotat: function (v) { S().light.spot.at = v; S().light.preset = 'custom'; App.applyLight(); markPressed(); App.save(); },
    spotcolor: function (v) { S().light.spot.color = v; S().light.preset = 'custom'; App.applyLight(); markPressed(); App.save(); },
    filter: function (v) { S().look.filter = parseInt(v, 10); if (S().look.filter && S().look.strength === 0) S().look.strength = 1; App.invalidate(); syncFields(); markPressed(); App.save(); },
    vig: function (v) { S().look.vigStyle = parseInt(v, 10); if (!S().look.vignette) S().look.vignette = 0.5; App.invalidate(); syncFields(); markPressed(); App.save(); },
    resetlook: function () { S().look = App.defaultLook(); App.invalidate(); syncFields(); markPressed(); App.save(); },
    stk: function (v) {
      var st = S(), id = App.nid('s');
      var nth = st.stickers.length % 4, base = { id: id, x: 0.5 + (nth - 1.5) * 0.06, y: 0.3 + nth * 0.07, r: 0 };
      var o;
      if (v === 'bubble') o = { type: 'bubble', w: 0.46, text: 'Hello from Chicago!', color: '#ffffff', tail: 'bl', bg: 'tape' };
      else if (v === 'thought') o = { type: 'thought', w: 0.46, text: 'Is that a hot dog?', color: '#ffffff', tail: 'bl', bg: 'tape' };
      else { o = { type: 'label', w: 0.6, text: 'Dibs was here', color: '#ffffff', tail: 'bl', bg: 'tape' }; base.y = 0.85; base.r = -0.05; }
      for (var k in o) base[k] = o[k];
      st.stickers.push(base); App.overlay.render(); App.overlay.select(id); App.save();
    },
    stkadd: function (v) {
      var id = App.nid('s'), w = /^tape/.test(v) ? 0.5 : (v === 'chi-stars' ? 0.3 : 0.26);
      S().stickers.push({ id: id, type: 'img', src: v, x: 0.5, y: 0.5, w: w, r: /^tape/.test(v) ? -0.2 : 0 });
      App.overlay.render(); App.overlay.select(id); App.save();
    },
    stkupload: function () { $('fileSticker').click(); },
    tail: function (v) { var s = selSticker(); if (s) { s.tail = v; App.overlay.render(); markPressed(); App.save(); } },
    bg: function (v) { var s = selSticker(); if (s) { s.bg = v; App.overlay.render(); markPressed(); App.save(); } },
    stkcolor: function (v) { var s = selSticker(); if (s) { if (s.type === 'label') s.ink = v; else s.color = v; App.overlay.render(); markPressed(); App.save(); } },
    stkfront: function () { var s = selSticker(); if (!s) return; var l = S().stickers, i = l.indexOf(s); l.splice(i, 1); l.push(s); App.overlay.render(); App.save(); },
    stkdup: function () { var s = selSticker(); if (!s) return; var c = JSON.parse(JSON.stringify(s)); c.id = App.nid('s'); c.x = Math.min(0.95, c.x + 0.05); c.y = Math.min(0.95, c.y + 0.05); S().stickers.push(c); App.overlay.render(); App.overlay.select(c.id); App.save(); },
    stkdel: function () { var s = selSticker(); if (s) App.overlay.remove(s.id); },
    plat: function (v) {
      S().frame.platform = v; App.layout(); syncFrame(); App.save();
    },
    fscale: function (v) { S().frame.scale = parseInt(v, 10); syncFrame(); App.save(); },
    safe: function () { S().frame.safe = !S().frame.safe; App.updateGuides(); markPressed(); App.save(); },
    fstyle: function (v) {
      var f = S().frame; f.style = v;
      var fr = DP.FRAMES.filter(function (x) { return x.id === v; })[0];
      if (fr && fr.text && !f.text) f.text = fr.defText;
      App.overlay.render(); syncFrame(); App.save();
    },
    savescene: function () {
      var name = ($('sceneName').value || '').trim() || 'My scene';
      S().name = name;
      var data = App.serialize();
      var thumb = DP.thumb(App.renderToCanvas(Math.round(220 * App.layoutAspect()), 220, { taps: 24 }), 160);
      var existing = null;
      DP.Store.all('scenes').then(function (list) {
        list.forEach(function (s) { if (s.name === name) existing = s; });
        return DP.Store.put('scenes', { id: existing ? existing.id : App.nid('sc'), name: name, updated: Date.now(), thumb: thumb, data: data });
      }).then(function () { refreshScenes(); App.msg('Saved "' + name + '".'); });
    },
    openscene: function (v) { DP.Store.get('scenes', v).then(function (sc) { if (sc) { App.loadState(sc.data).then(function () { App.save(); }); $('sceneName').value = sc.name; App.msg('Opened "' + sc.name + '".'); } }); },
    dupscene: function (v) { DP.Store.get('scenes', v).then(function (sc) { if (!sc) return; var c = JSON.parse(JSON.stringify(sc)); c.id = App.nid('sc'); c.name = sc.name + ' copy'; c.updated = Date.now(); return DP.Store.put('scenes', c).then(refreshScenes); }); },
    delscene: function (v) { DP.Store.del('scenes', v).then(refreshScenes); },
    export: function () {
      var s = App.serialize(); s.name = ($('sceneName').value || '').trim() || s.name;
      var blob = new Blob([JSON.stringify({ app: 'dibs-photo-mode', version: 1, scene: s })], { type: 'application/json' });
      download(blob, safeName(s.name) + '.dibsscene.json');
    },
    import: function () { $('fileScene').click(); },
    newscene: function () {
      confirmDlg('Start a new scene?', 'Your current scene is saved automatically, but this will replace it. Save it under a name first if you want to keep it.', 'Start new scene', 'Keep this one', function () {
        App.loadState(App.starterScene()).then(function () { App.save(); });
        $('sceneName').value = '';
      });
    },
    roll: function (v) { DP.Store.get('roll', v).then(function (r) { if (r) App.showResult(r); }); }
  };
  App.layoutAspect = function () { return App.state ? (document.getElementById('frameBox').clientWidth / Math.max(1, document.getElementById('frameBox').clientHeight)) : 1; };

  content.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el || !content.contains(el)) return;
    var a = el.getAttribute('data-act');
    if (act[a]) act[a](el.getAttribute('data-v'), el);
  });

  /* ---------- sync everything ---------- */
  function syncAll() { syncSelection(); syncCamera(); syncSticker(); syncFrame(); markPressed(); }

  UI.itemsChanged = function () { renderItemList(); syncSelection(); };
  UI.selectionChanged = function () { syncSelection(); };
  UI.itemMoved = function () { if (!syncPend) { syncPend = true; requestAnimationFrame(function () { syncPend = false; syncFields(); syncMount(); }); } };
  UI.cameraChanged = function () { syncCamera(); };
  UI.cameraMoved = function () { if (!syncPend) { syncPend = true; requestAnimationFrame(function () { syncPend = false; if (curTab === 'camera') { syncFields(); $('camHeight').textContent = 'Camera height: ' + (App.rig.camera.position.y * App.UNIT_MM / 1000).toFixed(2) + ' m'; } }); } };
  UI.tapFocusChanged = function () { markPressed(); };
  UI.stickersChanged = function () { syncSticker(); };
  UI.stickerSelected = function () { syncSticker(); if (selSticker() && curTab !== 'stickers' && !isPhone()) { /* keep the tab, the sticker has its own handles */ } };
  UI.photoChanged = function () { syncSelection(); };
  UI.rollChanged = function () { if (curTab === 'save') refreshRoll(); };
  UI.stateLoaded = function () { syncAll(); $('sceneName').value = S().name === 'Starter scene' ? '' : S().name; };
  UI.ready = function () { syncAll(); };

  /* ---------- inputs ---------- */
  function wireInputs() {
    $('propFind').addEventListener('input', function () {
      var q = this.value.trim().toLowerCase(), els = $('propGrid').children;
      for (var i = 0; i < els.length; i++) els[i].hidden = q && els[i].getAttribute('data-name').indexOf(q) < 0;
    });
    $('bubText').addEventListener('input', function () { var it = selItem(); if (it && it.kind.indexOf('bubble:') === 0) { it.text = this.value; rebuildSoon(it.id); } });
    $('attText').addEventListener('input', function () { var a = selAtt(), it = selItem(); if (a && it) { a.text = this.value; App.applyItem(it.id); App.save(); } });
    $('pkFind').addEventListener('input', function () {
      var q = this.value.trim().toLowerCase(), els = $('pkGrid').children;
      for (var i = 0; i < els.length; i++) els[i].hidden = q && els[i].getAttribute('data-name').indexOf(q) < 0;
    });
    $('pkGrid').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-v]'); if (!b || !App.sel) return;
      App.attachTo(App.sel, { kind: b.getAttribute('data-v'), slot: pickSlot });
      var it = selItem(); attSel = it && it.attach.length ? it.attach[it.attach.length - 1].id : null;
      closePicker(); syncSelection();
    });
    $('pkClose').addEventListener('click', closePicker);
    $('pkUpload').addEventListener('click', function () { $('fileHold').click(); });
    $('fileHold').addEventListener('change', function () {
      var f = this.files[0]; this.value = '';
      readUpload(f, function (id) {
        if (!App.sel) return;
        App.attachTo(App.sel, { kind: 'upload:' + id, slot: pickSlot });
        var it = selItem(); attSel = it && it.attach.length ? it.attach[it.attach.length - 1].id : null;
        closePicker(); syncSelection();
      });
    });
    ['filePhotoCam', 'filePhoto'].forEach(function (id) {
      $(id).addEventListener('change', function () { var f = this.files[0]; this.value = ''; if (f) App.setPhotoFile(f); });
    });
    $('stkText').addEventListener('input', function () { var s = selSticker(); if (s) { s.text = this.value; App.overlay.render(); App.save(); } });
    $('frameText').addEventListener('input', function () { S().frame.text = this.value; App.overlay.render(); App.save(); });
    $('fileProp').addEventListener('change', function () {
      var f = this.files[0]; this.value = '';
      readUpload(f, function (id) { App.addItem('upload:' + id); });
    });
    $('fileSticker').addEventListener('change', function () {
      var f = this.files[0]; this.value = '';
      readUpload(f, function (id) {
        var sid = App.nid('s');
        S().stickers.push({ id: sid, type: 'img', src: 'upload:' + id, x: 0.5, y: 0.5, w: 0.3, r: 0 });
        App.overlay.render(); App.overlay.select(sid); App.save();
      });
    });
    $('fileScene').addEventListener('change', function () {
      var f = this.files[0]; this.value = '';
      if (!f) return;
      if (f.size > 60 * 1024 * 1024) { App.msg('That file is too big to be a scene.'); return; }
      var fr = new FileReader();
      fr.onload = function () {
        var obj;
        try { obj = JSON.parse(fr.result); } catch (e) { App.msg('That file is not a scene file.'); return; }
        var sc = obj && obj.scene ? obj.scene : obj;
        if (!sc || !Array.isArray(sc.items)) { App.msg('That file is not a scene file.'); return; }
        App.loadState(sc).then(function () { App.save(); App.msg('Scene imported.'); });
      };
      fr.readAsText(f);
    });
    $('shutter').addEventListener('click', function () { App.takePhoto(); });
    $('sheetToggle').addEventListener('click', function () { setOpen(false); });

    // flying pad
    var joy = $('joy'), knob = $('joyKnob'), jp = null;
    function joyMove(e) {
      var r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2), d = Math.hypot(dx, dy);
      if (d > 1) { dx /= d; dy /= d; }
      App.rig.joy.x = dx; App.rig.joy.y = dy;
      knob.style.transform = 'translate(' + dx * 34 + 'px,' + dy * 34 + 'px)';
      App.bump();
    }
    joy.addEventListener('pointerdown', function (e) { jp = e.pointerId; joy.setPointerCapture(jp); joyMove(e); e.stopPropagation(); });
    joy.addEventListener('pointermove', function (e) { if (e.pointerId === jp) joyMove(e); });
    function joyEnd(e) { if (e.pointerId !== jp) return; jp = null; App.rig.joy.x = 0; App.rig.joy.y = 0; knob.style.transform = ''; App.save(); }
    joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
    [['flyUp', 1], ['flyDown', -1]].forEach(function (b) {
      var el = $(b[0]);
      el.addEventListener('pointerdown', function (e) { App.rig.joy.up = b[1]; el.setPointerCapture(e.pointerId); });
      var end = function () { App.rig.joy.up = 0; App.save(); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    });
  }

  /* ---------- start ---------- */
  buildPanels();
  defineFields();
  wireInputs();
  setTab('scene');
  setOpen(!isPhone());
  App.boot();
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
