/* DIBS Movie Maker: quick templates.
   Each template is a short form (fields) that turns into script text for the Script sheet (movie-quick.js).
   A field is { key, label, type: 'text' | 'cast' | 'symbol' | 'place', def }. A cast field with none: true also offers Nobody (value 'nobody'). A template can have a hint, shown under its form.
   script(values) returns the text of the script, written in the same words anyone can type. No screen code here. */
(function () {
  'use strict';
  var DP = window.DP, MM = DP.movie;

  var CAST = [['dibs', 'Dibs'], ['wacker', 'Wacker'], ['chance', 'Chance'], ['hiram', 'Hiram'], ['ivy', 'Ivy'], ['monty', 'Monty'], ['sue', 'Sue'], ['pigeon', 'Pigeon']];
  function nameOf(kind) { for (var i = 0; i < CAST.length; i++) if (CAST[i][0] === kind) return CAST[i][1]; return 'Dibs'; }
  /* what was typed or tapped, or the template's own words when the box is empty */
  function val(v, key, def) {
    var x = v && v[key] !== undefined && v[key] !== null ? String(v[key]).replace(/\s+/g, ' ').trim() : '';
    return x || def;
  }
  function pick(v, key, def) { return nameOf(kindPick(v, key, def)); }
  /* the character id for a cast field (the template's own default when the field is empty or not a character) */
  function kindPick(v, key, def) {
    var k = val(v, key, def);
    return CAST.every(function (c) { return c[0] !== k; }) ? def : k;
  }
  /* names for a cast list. A character picked more than once gets numbers in the order picked (Pigeon 1, Pigeon 2), the same numbers the script reads. */
  function numbered(kinds) {
    var total = {}, seen = {};
    kinds.forEach(function (k) { total[k] = (total[k] || 0) + 1; });
    return kinds.map(function (k) { if (total[k] < 2) return nameOf(k); seen[k] = (seen[k] || 0) + 1; return nameOf(k) + ' ' + seen[k]; });
  }
  function place(v, def) { var p = val(v, 'place', def); return DP.SET_INFO && DP.SET_INFO[p] && p !== 'photo' ? p : def; }
  /* sentences must not read as commands: a one word line like "Wait" would turn into an action, so these are always real sentences */
  function spoken(s) { return String(s).replace(/-/g, ' '); }

  MM.CAST_CHOICES = CAST.map(function (c) { return { kind: c[0], name: c[1] }; });
  MM.TEMPLATES = [
    {
      id: 'tip', name: 'Tip of the day', blurb: 'Dibs talks to the camera and gives one tip.',
      fields: [
        { key: 'place', label: 'Where', type: 'place', def: 'sweep' },
        { key: 'tip', label: 'The tip', type: 'text', def: 'Say the snack\'s name before you hand it over.' },
        { key: 'signoff', label: 'Sign-off', type: 'text', def: 'See you tomorrow, Chicago!' }
      ],
      script: function (v) {
        return ['Scene: ' + place(v, 'sweep') + ', studio',
          'Caption: Dibs\'s tip of the day',
          'Dibs (enter left, walk to middle): Hey, it\'s Dibs with today\'s tip!',
          'Camera: close on Dibs',
          'Dibs (point): ' + val(v, 'tip', 'Say the snack\'s name before you hand it over.'),
          'Caption: off',
          'Camera: wide',
          'Dibs (wave): ' + val(v, 'signoff', 'See you tomorrow, Chicago!')].join('\n');
      }
    },
    {
      id: 'chat', name: 'Two-critter chat', blurb: 'Two friends talk. The second one laughs at the end.',
      fields: [
        { key: 'first', label: 'First friend', type: 'cast', def: 'dibs' },
        { key: 'second', label: 'Second friend', type: 'cast', def: 'chance' },
        { key: 'place', label: 'Where', type: 'place', def: 'lplatform' },
        { key: 'line1', label: 'First line', type: 'text', def: 'Is the train late again?' },
        { key: 'line2', label: 'Reply', type: 'text', def: 'Late? It\'s practically a parade.' },
        { key: 'line3', label: 'Last line', type: 'text', def: 'Then I\'m saving us the good seats.' }
      ],
      script: function (v) {
        var nm = numbered([kindPick(v, 'first', 'dibs'), kindPick(v, 'second', 'chance')]), A = nm[0], B = nm[1];
        return ['Scene: ' + place(v, 'lplatform') + ', morning',
          A + ': ' + val(v, 'line1', 'Is the train late again?'),
          B + ' (look at ' + A + '): ' + val(v, 'line2', 'Late? It\'s practically a parade.'),
          A + ' (shrug): ' + val(v, 'line3', 'Then I\'m saving us the good seats.'),
          '& ' + B + ': laugh'].join('\n');
      }
    },
    {
      id: 'wacker', name: 'Wacker steals a snack', blurb: 'Three shots. Wacker grabs the snack and is wrong again.',
      fields: [
        { key: 'place', label: 'Where', type: 'place', def: 'hotdog' },
        { key: 'line1', label: 'Dibs shows off', type: 'text', def: 'Best hot dog in Chicago!' },
        { key: 'line2', label: 'Wacker tricks', type: 'text', def: 'Look! A parade!' },
        { key: 'line3', label: 'Wacker grabs it', type: 'text', def: 'Mine now.' },
        { key: 'line4', label: 'Dibs wins', type: 'text', def: 'Good thing I got two.' }
      ],
      script: function (v) {
        return ['Scene: ' + place(v, 'hotdog') + ', noon',
          'Dibs (holds food, proud): ' + val(v, 'line1', 'Best hot dog in Chicago!'),
          'Wacker (enter right, walk to Dibs): ' + val(v, 'line2', 'Look! A parade!'),
          'Dibs (look left): Where?',
          '--- same',
          'Wacker (holds food): ' + val(v, 'line3', 'Mine now.'),
          '& Dibs: question',
          'Wacker: hop, exit right',
          '--- same',
          'Camera: close on Dibs',
          'Dibs (holds food, proud): ' + val(v, 'line4', 'Good thing I got two.'),
          'Caption: Wacker is wrong again.'].join('\n');
      }
    },
    {
      id: 'reveal', name: 'Big reveal', blurb: 'A whisper, a hop, and a big announcement.',
      fields: [
        { key: 'who', label: 'Who reveals', type: 'cast', def: 'dibs' },
        { key: 'place', label: 'Where', type: 'place', def: 'michave' },
        { key: 'tease', label: 'The tease', type: 'text', def: 'Psst. Want to see something?' },
        { key: 'reveal', label: 'The reveal', type: 'text', def: 'Ta-da! I learned a new word!' },
        { key: 'caption', label: 'Caption', type: 'text', def: 'Big news from Dibs' }
      ],
      script: function (v) {
        var W = pick(v, 'who', 'dibs');
        return ['Scene: ' + place(v, 'michave') + ', noon',
          'Camera: close on ' + W,
          W + ' (peek): ' + val(v, 'tease', 'Psst. Want to see something?'),
          'Camera: wide',
          W + ' (hop, proud, exclaim): ' + val(v, 'reveal', 'Ta-da! I learned a new word!'),
          'Camera: push in',
          'Caption: ' + val(v, 'caption', 'Big news from Dibs')].join('\n');
      }
    },
    {
      id: 'walk', name: 'Walk and talk', blurb: 'Two friends stroll in together and talk, then race off.',
      fields: [
        { key: 'first', label: 'First friend', type: 'cast', def: 'dibs' },
        { key: 'second', label: 'Second friend', type: 'cast', def: 'monty' },
        { key: 'place', label: 'Where', type: 'place', def: 'riverwalk' },
        { key: 'line1', label: 'First line', type: 'text', def: 'Nice day for a walk.' },
        { key: 'line2', label: 'Reply', type: 'text', def: 'Every day is a nice day by the river.' },
        { key: 'line3', label: 'Last line', type: 'text', def: 'Race you to the bridge!' }
      ],
      script: function (v) {
        var nm = numbered([kindPick(v, 'first', 'dibs'), kindPick(v, 'second', 'monty')]), A = nm[0], B = nm[1];
        return ['Scene: ' + place(v, 'riverwalk') + ', morning',
          A + ' (enter left, walk to middle): ' + val(v, 'line1', 'Nice day for a walk.'),
          '& ' + B + ' (enter left, walk to ' + A + '):',
          B + ': ' + val(v, 'line2', 'Every day is a nice day by the river.'),
          A + ' (hop): ' + val(v, 'line3', 'Race you to the bridge!'),
          A + ': exit right',
          '& ' + B + ': run, exit right'].join('\n');
      }
    },
    {
      id: 'dance', name: 'TikTok dance', blurb: 'Dibs leads a 15 second dance. Add your own music with Sound.',
      hint: 'Tip: add your song in Tools, Sound. Set Tempo to the song\'s beats per minute so the moves land on the beat.',
      fields: [
        { key: 'place', label: 'Where', type: 'place', def: 'lakefront' },
        { key: 'lead', label: 'Dance leader', type: 'cast', def: 'dibs' },
        { key: 'dancer2', label: 'Dancer 2', type: 'cast', none: true, def: 'chance' },
        { key: 'dancer3', label: 'Dancer 3', type: 'cast', none: true, def: 'ivy' },
        { key: 'dancer4', label: 'Dancer 4', type: 'cast', none: true, def: 'nobody' },
        { key: 'tempo', label: 'Tempo (beats a minute, 40 to 220)', type: 'text', number: true, def: '120' },
        { key: 'caption', label: 'Caption (empty for none)', type: 'text', def: 'Dibs dance challenge' }
      ],
      script: function (v) {
        var bpm = parseFloat(val(v, 'tempo', '120'));
        bpm = isFinite(bpm) ? Math.max(40, Math.min(220, Math.round(bpm))) : 120;
        var kinds = [kindPick(v, 'lead', 'dibs')], lead;
        ['dancer2', 'dancer3', 'dancer4'].forEach(function (key) {
          var k = val(v, key, 'nobody');
          if (CAST.every(function (c) { return c[0] !== k; })) return;       // Nobody, or something that is not a character
          kinds.push(k);                                                       // the same character twice is two dancers (Pigeon 1, Pigeon 2)
        });
        var crew = numbered(kinds); lead = crew[0];
        // the leader is in the middle at the front, the others stand behind
        var spots = crew.length === 2 ? ['back left'] : crew.length === 3 ? ['back left', 'back right'] : ['back left', 'back right', 'far back'];
        var places = [lead + ' front'].concat(crew.slice(1).map(function (nm, i) { return nm + ' ' + spots[i]; }));
        var cap = v && v.caption !== undefined && v.caption !== null ? String(v.caption).replace(/\s+/g, ' ').trim() : 'Dibs dance challenge';
        var lines = ['Scene: ' + place(v, 'sweep'), 'Tempo: ' + bpm, 'Places: ' + places.join(', ')];
        if (cap) lines.push('Caption: ' + cap);
        lines.push('Camera: wide');
        // everybody moves together: the lines after the leader's start with &
        function together(words) { crew.forEach(function (nm, i) { lines.push((i ? '& ' : '') + nm + ': ' + words); }); }
        together('bounce 8'); together('sway 8'); together('step left 4, step right 4'); together('spin 4, proud');
        lines.push('& Camera: push in');       // the push in starts with the spin
        return lines.join('\n');
      }
    },
    {
      id: 'word', name: 'Word of the week', blurb: 'Dibs holds up a picture word and says it.',
      fields: [
        { key: 'word', label: 'The word', type: 'symbol', def: 'more' },
        { key: 'place', label: 'Where', type: 'place', def: 'sweep' },
        { key: 'tip', label: 'The tip', type: 'text', def: 'Hold it up, say it, and wait. Give them a chance to try it too.' }
      ],
      script: function (v) {
        var syms = (window.DIBS_ASSETS && window.DIBS_ASSETS.symbols) || {}, key = val(v, 'word', 'more');
        if (!syms[key]) key = 'more';
        var say = spoken(key);
        return ['Scene: ' + place(v, 'sweep') + ', studio',
          'Caption: Word of the week: ' + say.toUpperCase(),
          'Dibs (holds ' + key + ', enter left, walk to middle): This week\'s word is ' + say + '!',
          'Camera: close on Dibs',
          'Dibs (point): ' + val(v, 'tip', 'Hold it up, say it, and wait. Give them a chance to try it too.'),
          'Camera: wide',
          'Dibs (wave): Try it today!'].join('\n');
      }
    }
  ];
})();
