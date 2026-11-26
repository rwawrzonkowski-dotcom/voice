/* DIBS Movie Maker: the showcase movie. About 20 seconds, 9:16, five shots that show what the editor can do.
   It is built from the same tools the editor offers (camera moves, pose keys, emotes, bubbles, costumes, captions),
   so opening it and tapping any key shows how it was made. It opens when no movie has been saved yet. */
(function () {
  'use strict';
  var DP = window.DP;

  DP.movieShowcase = function () {
    var App = DP.app, MM = DP.movie;

    function puppet(id, kind, o) {
      return { id: id, kind: kind, x: o.x || 0, y: 0, z: o.z || 0, yaw: o.yaw || 0, tilt: 0, scale: o.scale || 1, flip: !!o.flip, pose: DP.poseFromPreset(o.pose || 'stand', null, kind), mount: 'none', move: 'none', emote: null, attach: o.attach || [] };
    }
    function scene(o) {
      var s = App.starterScene();
      s.name = o.name;
      s.set = { id: o.set, color: '#fbf6ea' };
      s.items = o.items;
      s.cam = { tx: o.cam[0], ty: o.cam[1], tz: o.cam[2], yaw: o.cam[3], pitch: o.cam[4], dist: o.cam[5], roll: 0, mode: 'orbit' };
      s.lens.mm = o.mm || 35; s.lens.fnum = o.fn || 2.8;
      s.lens.focus = { mode: 'item', id: o.focus, dist: o.cam[5], point: [0, 1, 0] };
      s.light = App.lightFrom(App.LIGHTS.filter(function (l) { return l.id === o.light; })[0]);
      s.look = App.defaultLook(); s.look.filter = o.filter || 0; s.look.vignette = o.vig === undefined ? 0.2 : o.vig;
      s.frame.platform = 'ig-story';
      return s;
    }
    function shot(name, sc, dur) { var sh = MM.newShot(sc, name, dur); sh.id = 'show-' + name.toLowerCase().replace(/[^a-z]+/g, '-'); return sh; }
    function base(sc) { return MM.baseFromScene(App.clean(sc)); }
    function key(sh, target, t, v, ease) { MM.setKey(sh, target, t, v, ease || 'easeInOut'); }
    /* a pose change takes 0.3 s: hold the last pose, then move to the new one */
    function pose(sh, id, t, preset, from) {
      var tg = 'item:' + id + '.pose.preset', tr = MM.getTrack(sh, tg);
      if (!tr && from) key(sh, tg, Math.max(0, t - 0.3), from);
      else if (tr) key(sh, tg, Math.max(0, t - 0.3), tr.keys[tr.keys.length - 1].v);
      key(sh, tg, t, preset);
    }
    function say(sh, id, t, text, tail, until, style) {
      key(sh, 'item:' + id + '.bubble', t, { text: text, style: style || 'speech', tail: tail });
      if (until) key(sh, 'item:' + id + '.bubble', until, null);
    }
    function caption(sh, t, text, until) { key(sh, 'caption', t, { text: text }); if (until) key(sh, 'caption', until, null); }

    var cap = [{ id: 'a-cap', kind: 'costume:cap-blue', slot: 'head', s: 1, r: 0, ox: 0, oy: 0 }];
    var shots = [], sc, sh, b;

    /* 1. Chicago skyline, golden hour. A crane move down onto Dibs while he waves on twos. */
    sc = scene({ name: 'Hello Chicago', set: 'skyline', light: 'golden', focus: 'i-dibs', cam: [0, 1.25, 0, 0.06, 0.5, 8.4], mm: 35, fn: 2.8,
      items: [puppet('i-dibs', 'dibs', { x: 0, z: 0.4, scale: 1.2, pose: 'wave' })] });
    sh = shot('Hello Chicago', sc, 4); b = base(sc);
    MM.motions.crane(sh, b, 0, 3.2, -3.0);
    key(sh, 'item:i-dibs.pose.preset', 0, 'wave');
    [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].forEach(function (t, i) { key(sh, 'item:i-dibs.pose.wingB', t, i % 2 ? 112 : 150); });
    caption(sh, 0.2, 'DIBS Movie Maker');
    say(sh, 'i-dibs', 1.2, "Hey Chicago! Let's make a movie.", 'down');
    shots.push(sh);

    /* 2. L platform, noon. Dolly in with a rack focus from Dibs to Wacker. */
    sc = scene({ name: 'The L platform', set: 'lplatform', light: 'noon', focus: 'i-dibs', cam: [0.05, 1.25, 0, 0.03, 0.1, 7.6], mm: 35, fn: 2.2,
      items: [puppet('i-dibs', 'dibs', { x: -1.0, z: 0.5, yaw: 14, scale: 1.05 }), puppet('i-wacker', 'wacker', { x: 1.0, z: -0.4, yaw: -12, scale: 1.05 })] });
    sh = shot('The L platform', sc, 4); b = base(sc);
    MM.motions.dollyIn(sh, b, 0, 3.6, 0.3);
    MM.motions.rackFocus(sh, b, 1.0, 2.0, 'i-dibs', 'i-wacker');
    say(sh, 'i-wacker', 1.4, "Pigeons can't make movies.", 'right', 3.5);
    key(sh, 'item:i-dibs.emote', 2.2, { id: 'question' }); key(sh, 'item:i-dibs.emote', 3.2, null);
    pose(sh, 'i-dibs', 2.9, 'shrug', 'stand');
    shots.push(sh);

    /* 3. Lower Wacker at night, Chicago night filter, spotlight. A slow orbit while Dibs hops. */
    sc = scene({ name: 'Lower Wacker', set: 'wacker', light: 'night', filter: 6, focus: 'i-dibs', cam: [0, 1.15, 0, -0.27, 0.12, 6.4], mm: 35, fn: 2.4, vig: 0.35,
      items: [puppet('i-dibs', 'dibs', { x: 0, z: 0.3, scale: 1.15 })] });
    sh = shot('Lower Wacker', sc, 4); b = base(sc);
    MM.motions.orbit(sh, b, 0, 4, 30);
    MM.motions.hop(sh, b, 'i-dibs', 0.8, 3, 0.55);
    key(sh, 'item:i-dibs.emote', 0.5, { id: 'note' });
    caption(sh, 0.3, 'Keyframe poses, camera and light');
    shots.push(sh);

    /* 4. Hot dog stand, Pop filter. A costume pops on, a pose, an emote and a bubble. */
    sc = scene({ name: 'Hot dog stand', set: 'hotdog', light: 'morning', filter: 7, focus: 'i-dibs', cam: [0.05, 1.25, 0, 0.04, 0.1, 7.2], mm: 35, fn: 2.8,
      items: [puppet('i-dibs', 'dibs', { x: -0.95, z: 0.4, yaw: 12, scale: 1.05 }), puppet('i-wacker', 'wacker', { x: 1.0, z: -0.3, yaw: -10, scale: 1.05 })] });
    sh = shot('Hot dog stand', sc, 4); b = base(sc);
    MM.motions.dollyIn(sh, b, 0, 4, 0.14);
    key(sh, 'item:i-dibs.wear', 0.5, { id: 'cap-blue' });
    pose(sh, 'i-dibs', 1.2, 'proud', 'stand');
    key(sh, 'item:i-wacker.emote', 1.9, { id: 'exclaim', x: 0.9 });
    say(sh, 'i-wacker', 2.1, "Okay. That one's pretty good.", 'right');
    caption(sh, 0.2, 'Bubbles, emotes and costumes');
    shots.push(sh);

    /* 5. Paper sweep, studio light, warm filter. Dibs holds a proud pose with a heart. */
    sc = scene({ name: 'Closing card', set: 'sweep', light: 'studio', filter: 1, focus: 'i-dibs', cam: [0, 1.2, 0, 0.0, 0.08, 6.4], mm: 35, fn: 2.8,
      items: [puppet('i-dibs', 'dibs', { x: 0, z: 0.2, scale: 1.2, pose: 'proud', attach: cap })] });
    sh = shot('Closing card', sc, 4); b = base(sc);
    MM.motions.dollyIn(sh, b, 0, 4, 0.12);
    key(sh, 'item:i-dibs.emote', 0.5, { id: 'heart' });
    caption(sh, 0.3, 'Make yours in DIBS Movie Maker');
    shots.push(sh);

    return { v: 1, title: 'DIBS Movie Maker showcase', platform: 'ig-story', fps: 30, maxDuration: 60, shots: shots, audio: null };
  };
})();
