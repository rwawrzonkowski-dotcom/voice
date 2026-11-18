// Practice games page: three short games. Nothing is saved, nothing is sent, no network calls.
// Everything lives in memory and resets when the page closes.
(function () {
  'use strict';

  var aud = 'parent';
  var token = 0;                       // bumps on every restart so old timers do nothing

  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function shuffle(a) {
    var b = a.slice(), i, j, t;
    for (i = b.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = b[i]; b[i] = b[j]; b[j] = t; }
    return b;
  }
  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function isSchool() { return aud === 'school'; }
  function range(n) { var r = [], i; for (i = 0; i < n; i++) r.push(i); return r; }

  // Draw into a game body and keep keyboard focus where it was (or move it to focusKey).
  function draw(id, html, focusKey) {
    var body = $('#g-' + id + '-body');
    var a = document.activeElement, key = null;
    if (a && body.contains(a)) key = a.getAttribute('data-key');
    body.innerHTML = html;
    var want = focusKey || key, el = want && $('[data-key="' + want + '"]', body);
    if (el) el.focus();
  }
  function say(id, text) { $('#g-' + id + '-say').textContent = text; }
  function live(id, html) { $('#g-' + id + '-live').innerHTML = html || ''; }
  function dots(n, cur, states) {
    var h = '<ol class="g-dots" aria-hidden="true">', i;
    for (i = 0; i < n; i++) h += '<li class="' + (states[i] || '') + (i === cur ? ' now' : '') + '"></li>';
    return h + '</ol>';
  }

  // =====================================================================
  // GAME 1: Find the favorite (paired choice)
  // =====================================================================
  var G1D = {
    parent: {
      kid: 'Sam',
      items: [
        { label: 'Toy', took: 'the toy', img: 'play.svg' },
        { label: 'Juice', took: 'the juice', img: 'juice.svg' },
        { label: 'Book', took: 'the book', img: 'read.svg' },
        { label: 'Pet the dog', took: 'the dog to pet', img: 'pet.svg' },
        { label: 'Go outside to run', took: 'going outside to run', img: 'run.svg' }
      ]
    },
    school: {
      kid: 'Jordan',
      items: [
        { label: 'Computer time', took: 'computer time', img: 'computer.svg' },
        { label: 'Stickers', took: 'the stickers', img: 'stickers.svg' },
        { label: 'Help the teacher', took: 'helping the teacher', img: 'teacher.svg' },
        { label: 'Recess (run)', took: 'recess to run', img: 'run.svg' },
        { label: 'Book', took: 'the book', img: 'read.svg' }
      ]
    }
  };
  var g1 = null;

  function g1New() {
    var d = G1D[aud], perm = shuffle(range(5)), pairs = [], i, k;
    // Every pair once. Item at spot i is on the left twice and on the right twice.
    for (i = 0; i < 5; i++) for (k = 1; k <= 2; k++) pairs.push({ l: perm[i], r: perm[(i + k) % 5] });
    g1 = {
      d: d, truth: shuffle(range(5)), pairs: shuffle(pairs), t: 0, phase: 'trial', offered: false, st: 'idle',
      pick: -1, counts: [0, 0, 0, 0, 0], done: 0, order: []
    };
    g1.pos = []; g1.truth.forEach(function (it, p) { g1.pos[it] = p; });
    live('favorite', '');
    g1Draw(false);
  }

  function g1Item(i, extra) {
    var it = g1.d.items[i], cls = 'g-item' + (extra.cls || '');
    return '<button type="button" class="' + cls + '" data-act="' + extra.act + '" data-i="' + i + '" data-key="i' + i + '"' +
      (extra.disabled ? ' aria-disabled="true"' : '') + '>' +
      '<img class="g-pic" src="img/symbols/' + it.img + '" alt="' + esc(it.label) + '">' +
      '<span class="g-lab" aria-hidden="true">' + esc(it.label) + '</span>' + (extra.badge || '') + '</button>';
  }

  function g1Draw(user) {
    var s = g1, kid = s.d.kid, h = '', fk = null;
    if (s.phase === 'trial') {
      var p = s.pairs[s.t];
      h += '<p class="g-count">Trial ' + (s.t + 1) + ' of 10 · Picks written down: ' + s.done + '</p>';
      h += dots(10, s.t, range(10).map(function (n) { return n < s.t ? 'done' : ''; }));
      if (!s.offered) {
        h += '<div class="g-pair" aria-hidden="true"><div class="g-slot">?</div><div class="g-slot">?</div></div>';
        h += '<div class="g-actions"><button type="button" class="btn solid" data-act="offer" data-key="offer">Offer</button></div>';
        say('favorite', 'Offer both. Watch which one ' + kid + ' takes.');
        fk = user ? 'offer' : null;
      } else {
        var rec = s.st === 'recorded', ch = s.st === 'chosen' || rec, w = s.st === 'watching';
        h += '<div class="g-pair">' + [p.l, p.r].map(function (i) {
          var took = ch && i === s.pick;
          return g1Item(i, {
            act: 'pick', disabled: w || rec, cls: rec && took ? ' rec' : (took ? ' took' : ''),
            badge: took ? '<span class="g-badge">' + (rec ? 'Written down' : kid + ' took this') + '</span>' : ''
          });
        }).join('') + '</div>';
        if (rec) {
          h += '<div class="g-actions"><button type="button" class="btn solid" data-act="next" data-key="next">' +
            (s.t === 9 ? 'Put the items in order' : 'Next pair') + '</button></div>';
        }
        say('favorite', w ? 'Watching…' : (rec ? 'Good. Writing it down every time keeps it honest.' : 'Now tap the one ' + kid + ' took, to write it down.'));
        fk = rec ? 'next' : (user && s.st === 'watching' ? 'i' + p.l : null);
      }
      h += '<p class="g-tip"><strong>Tip:</strong> Switch sides so you don’t just find which side ' + kid + ' likes. This game does that for you.</p>';
    } else if (s.phase === 'rank') {
      var n = s.order.length;
      h += '<p class="g-count">Which was ' + kid + '’s favorite?</p>';
      h += '<p>Tap the items from favorite to least favorite, using the picks you wrote down.</p>';
      h += '<ol class="g-slots" aria-label="Your order">' + range(5).map(function (k) {
        var it = s.order[k] != null ? s.d.items[s.order[k]] : null;
        return it ? '<li class="full"><span class="n">' + (k + 1) + '</span><img src="img/symbols/' + it.img + '" alt="">' + esc(it.label) + '</li>'
          : '<li><span class="n" style="background:#5a5270">' + (k + 1) + '</span>empty</li>';
      }).join('') + '</ol>';
      h += '<div class="g-rank">' + range(5).map(function (i) {
        var at = s.order.indexOf(i);
        return g1Item(i, { act: 'rank', disabled: at >= 0, badge: at >= 0 ? '<span class="g-badge">Number ' + (at + 1) + '</span>' : '' });
      }).join('') + '</div>';
      h += '<div class="g-actions"><button type="button" class="btn" data-act="clear" data-key="clear"' + (n ? '' : ' disabled') + '>Clear</button>' +
        '<button type="button" class="btn solid" data-act="check" data-key="check"' + (n === 5 ? '' : ' disabled') + '>Check</button></div>';
      say('favorite', n === 5 ? 'All five in order. Tap Check.' : 'Which one did ' + kid + ' pick the most?');
      fk = user ? (n === 5 ? 'check' : (n === 0 ? 'i0' : null)) : null;
    } else {
      var max = Math.max.apply(null, s.counts), top = s.counts.map(function (c, i) { return c === max ? i : -1; }).filter(function (i) { return i >= 0; });
      var mine = s.order[0], ok = s.counts[mine] === max;
      var rows = range(5).sort(function (a, b) { return s.counts[b] - s.counts[a] || s.pos[a] - s.pos[b]; });
      var names = top.map(function (i) { return s.d.items[i].took; });
      h += '<p class="g-count">Each item was offered 4 times. Here is how often it was picked.</p>';
      h += '<ul class="g-res">' + rows.map(function (i) {
        var it = s.d.items[i], c = s.counts[i];
        return '<li><img src="img/symbols/' + it.img + '" alt="' + esc(it.label) + '"><b>' + esc(it.label) + '</b>' +
          '<span class="g-bar"><span class="g-track" aria-hidden="true"><span class="g-fill" style="width:' + (c * 25) + '%"></span></span>' +
          '<span class="g-pct">' + c + ' of 4 (' + (c * 25) + '%)</span></span></li>';
      }).join('') + '</ul>';
      h += '<div class="g-lists"><div><h3>Your order</h3><ol>' + s.order.map(function (i) { return '<li>' + esc(s.d.items[i].label) + '</li>'; }).join('') + '</ol></div>' +
        '<div><h3>' + kid + '’s hidden order</h3><ol>' + s.truth.map(function (i) { return '<li>' + esc(s.d.items[i].label) + '</li>'; }).join('') + '</ol></div></div>';
      h += '<div class="g-actions"><button type="button" class="btn solid" data-act="again" data-key="again">Play again</button></div>';
      say('favorite', ok ? 'Yes! You found the favorite.' : 'Close. Let’s look at the picks.');
      fk = 'again';
      var mm = '<p><strong>' + (ok ? 'Your number 1 matches.' : 'Your number 1 was not the most picked.') + '</strong> ' +
        (ok ? (top.length > 1 ? 'You put ' + esc(s.d.items[mine].label) + ' first, and it tied for the most picks.' : 'You put ' + esc(s.d.items[mine].label) + ' first, and it was picked the most.')
          : esc(s.d.items[top[0]].label) + (top.length > 1 ? ' (and one more) was' : ' was') + ' picked the most, ' + max + ' of 4 times.') +
        ' The item picked most is the best first reward to try.</p>' +
        '<p>Like real children, ' + esc(kid) + ' sometimes picks the other item, so the picks can differ a little from the hidden order.</p>' +
        '<p><strong>Favorites change.</strong> Do a quick check often, like before a session or once a day.' +
        (isSchool() ? ' You offered two items at a time and wrote down each pick (paired-stimulus preference assessment).' : '') + '</p>';
      draw('favorite', h, fk);
      live('favorite', mm);
      return;
    }
    draw('favorite', h, fk);
  }

  function g1Click(e) {
    var b = e.target.closest('button[data-act]'); if (!b || !g1) return;
    var act = b.getAttribute('data-act'), s = g1, kid = s.d.kid, my = token;
    if (b.getAttribute('aria-disabled') === 'true') return;
    if (act === 'offer') {
      var p = s.pairs[s.t], fav = s.pos[p.l] < s.pos[p.r] ? p.l : p.r, oth = fav === p.l ? p.r : p.l;
      s.pick = Math.random() < 0.85 ? fav : oth;
      s.offered = true; s.st = 'watching';
      live('favorite', '<p>Offered: ' + esc(s.d.items[p.l].label) + ' and ' + esc(s.d.items[p.r].label) + '. Watching…</p>');
      g1Draw(true);
      var show = function () {
        if (my !== token || s.st !== 'watching') return;
        s.st = 'chosen'; g1Draw(false);
        live('favorite', '<p>' + esc(kid) + ' took ' + esc(s.d.items[s.pick].took) + '. Tap it to write it down.</p>');
      };
      if (reduced()) show(); else setTimeout(show, 800);
    } else if (act === 'pick') {
      if (s.st !== 'chosen') return;
      var i = +b.getAttribute('data-i');
      if (i !== s.pick) { live('favorite', '<p>Look again. ' + esc(kid) + ' took ' + esc(s.d.items[s.pick].took) + '.</p>'); return; }
      s.counts[i]++; s.done++; s.st = 'recorded';
      live('favorite', '<p>Written down: ' + esc(kid) + ' took ' + esc(s.d.items[i].took) + '. ' + s.done + ' of 10 done.</p>');
      g1Draw(true);
    } else if (act === 'next') {
      s.t++; s.offered = false; s.st = 'idle';
      live('favorite', '');
      if (s.t === 10) { s.phase = 'rank'; g1Draw(true); } else g1Draw(true);
    } else if (act === 'rank') {
      s.order.push(+b.getAttribute('data-i')); g1Draw(true);
      live('favorite', '<p>' + s.order.length + ' of 5 placed.</p>');
    } else if (act === 'clear') {
      s.order = []; live('favorite', '<p>Cleared. Start again with the favorite.</p>'); g1Draw(true);
    } else if (act === 'check') {
      if (s.order.length < 5) return;
      s.phase = 'result'; g1Draw(true);
    } else if (act === 'again') { g1New(); g1Draw(true); }
  }

  // =====================================================================
  // GAME 2: Why did that happen? (match the function)
  // =====================================================================
  var FN = [
    { p: 'To get attention', t: 'attention' },
    { p: 'To get out of something', t: 'escape' },
    { p: 'To get an item or activity', t: 'tangible' },
    { p: 'Because it feels good', t: 'automatic / sensory' }
  ];
  var END = [
    'Attention followed the behavior.',
    'The hard thing went away after the behavior.',
    'The item came after the behavior.',
    'Nothing changed around the child, so the behavior seems to feel good by itself.'
  ];
  var G2D = {
    parent: [
      { a: 0, s: 'Dad is on the phone, and Mia is playing alone in her room. She yells, “Dad! Dad! Dad!” over and over. Dad hangs up, comes in, and talks with her about her drawing.',
        w: 'After she yelled, Dad came in and talked with her.',
        h: 'Teach a way to ask for attention, like tapping “look” or saying “come here,” and give lots of attention when things are going well.' },
      { a: 0, s: 'In the grocery store, Mom stops to chat with a neighbor. Leo drops to the floor and rolls back and forth. Mom turns, kneels down, and talks quietly to him.',
        w: 'Mom was talking with the neighbor. After Leo dropped to the floor, she turned and talked to him.',
        h: 'Teach a quick way to ask for Mom’s attention, like a gentle tap on her arm, and give him small bits of attention while you chat.' },
      { a: 1, s: 'Dad says, “Time to wash your hair.” Noah screams and pushes the cup away. Dad says, “Okay, all done,” and lifts him out of the tub.',
        w: 'Hair washing was the hard part. After Noah screamed, Dad ended it.',
        h: 'Teach a way to ask for a break or for help, like tapping “stop” or “help,” and make the hard part smaller, like one cup of water at a time with a song.' },
      { a: 1, s: 'At the barber, Ava is asked to sit still for her haircut. She cries and slides down out of the chair. The barber says, “Okay, we’ll stop,” and Ava walks away from the chair.',
        w: 'Sitting for the haircut was the hard part. After Ava slid out of the chair, it stopped.',
        h: 'Teach a way to ask for a short break, like tapping “all done,” and practice short pretend haircuts at home with something fun right after.' },
      { a: 2, s: 'Eli sees the cookie jar on the counter. Mom says, “Cookies are for after dinner.” Eli throws himself on the floor and screams, and Mom says, “Okay, one cookie,” and hands him one.',
        w: 'Eli wanted the cookie. After he screamed, he got it.',
        h: 'Teach a way to ask for it, like saying or tapping “want cookie,” and show when it will be ready, like a card that says “after dinner.”' },
      { a: 2, s: 'At a playdate, Lily wants the red truck, but her cousin is playing with it. Lily grabs it out of her cousin’s hands. Her cousin lets go, and Lily drives the truck across the floor.',
        w: 'Lily wanted the truck. After she grabbed it, she had it.',
        h: 'Teach a way to ask for a turn, like saying or tapping “my turn,” and help the kids take turns with a timer.' },
      { a: 3, s: 'Zoe sits on the couch alone, and no one is asking her for anything. She rubs the soft fringe of her blanket against her cheek for a long time. No one comes over, and nothing is given or taken away.',
        w: 'No one came over, and nothing was given or taken away. Zoe does it even when she is alone.',
        h: 'If it isn’t hurting her or getting in the way, it may not need to change. Keep soft things she likes nearby, and talk with her doctor if a behavior is new or causes harm.' },
      { a: 3, s: 'On a long car ride, Ben taps his fingers fast on the window and hums. He does this on most drives, even when Mom is quiet and no one is talking to him. Nothing is given or taken away when he does it.',
        w: 'No one reacted, and nothing was given or taken away. It keeps going when no one is paying attention.',
        h: 'If it isn’t getting in the way, it may not need to change. Bring things he can tap, touch or listen to in the car.' }
    ],
    school: [
      { a: 0, s: 'The teacher is helping another group while Carlos works at his desk. He calls out, “Ms. Lee! Ms. Lee!” and bangs his pencil on the desk. Ms. Lee walks over and says, “Carlos, I see you. What do you need?”',
        w: 'After Carlos called out and banged his pencil, the teacher came over and talked with him.',
        h: 'Teach a way to get the teacher’s attention, like raising a hand or tapping “look,” and visit his desk often when he is working well.' },
      { a: 0, s: 'On the bus, Priya sits alone while the other students talk with each other. She tosses her hat onto the seat in front of her. A classmate turns around, laughs, and says, “Hey! Give it back!”',
        w: 'Priya was not part of the talking. After she tossed her hat, a classmate turned around and talked to her.',
        h: 'Teach a friendly way to join in, like saying or tapping “hi,” and set up a buddy to chat with her on the ride.' },
      { a: 1, s: 'In math, Owen is handed a worksheet of long division. He puts his head on the desk and pushes the paper onto the floor. The aide picks up the worksheet and says, “Okay, we’ll skip it for now.”',
        w: 'The worksheet was the hard part. After Owen put his head down and pushed it away, it was taken away.',
        h: 'Teach a way to ask for help or a break, like tapping “help” or “break,” and make the work smaller or easier at first so he can succeed.' },
      { a: 1, s: 'The class lines up in the hallway to walk to an assembly. Hana sits down on the floor and will not move. The teacher says, “Okay, you can go back to class,” and the others walk on without her.',
        w: 'Going to the assembly was the hard part. After Hana sat down and would not move, she did not have to go.',
        h: 'Teach a way to say “no” or ask for a break, like tapping “stop” or “break,” and get her ready ahead of time with a picture preview of the assembly.' },
      { a: 2, s: 'In the lunch line, Marcus asks for chocolate milk, but the worker says, “That kind is all gone.” Marcus yells and kicks the table leg. The worker finds one more carton in the back and hands it to him.',
        w: 'Marcus wanted the chocolate milk. After he yelled and kicked, he got it.',
        h: 'Teach a calm way to ask for what he wants and to handle “all gone,” like tapping “want” and then choosing from what is left.' },
      { a: 2, s: 'Ruby is told to wait her turn on the class computer. She grabs the mouse out of her classmate’s hand. The teacher moves the classmate over, and Ruby takes over the computer.',
        w: 'Ruby wanted the computer. After she grabbed the mouse, she got to use it.',
        h: 'Teach a way to ask for a turn, like saying or tapping “my turn,” and use a visual timer so she can see when her turn is coming.' },
      { a: 3, s: 'Felix has finished his work and sits at a back table with nothing to do. He rubs the corner of his book against his lips again and again. No one comes over, and nothing is given or taken away.',
        w: 'No one reacted, and nothing was given or taken away. Felix does it by himself when nothing else is going on.',
        h: 'Offer other things to do with his hands and mouth, like a safe chew tool, and give him something fun to do when he finishes early.' },
      { a: 3, s: 'Nadia waits at her locker while the hallway is empty. She flicks her fingers in front of her eyes and watches the light through them. No one is around, and nothing changes when she does it.',
        w: 'No one was there, and nothing changed. It happens even when no one can react.',
        h: 'If it isn’t hurting her or getting in the way, it may not need to change. If it does get in the way of learning, or it is new, share it with her team.' }
    ]
  };
  var g2 = null;

  function g2New() {
    g2 = { list: shuffle(G2D[aud]), i: 0, score: 0, ans: -1, marks: [] };
    live('why', '');
    g2Draw(false);
  }
  function g2Opt(i) { return FN[i].p + (isSchool() ? ' <span class="g-term">(' + FN[i].t + ')</span>' : ''); }

  function g2Draw(user) {
    var s = g2, h = '', fk = null, cur = s.list[s.i];
    if (s.i >= 8) {
      h += '<p class="g-score">' + s.score + ' of 8</p>';
      h += dots(8, -1, s.marks);
      h += '<div class="g-actions"><button type="button" class="btn solid" data-act="again" data-key="again">Play again</button></div>';
      say('why', s.score >= 6 ? 'Nice spotting! The clue is what happens right after.' : 'Good practice. The clue is what happens right after the behavior.');
      draw('why', h, 'again');
      live('why', '<p><strong>You got ' + s.score + ' of 8.</strong> Play again to see the stories in a new order.</p>');
      return;
    }
    var answered = s.ans >= 0;
    h += '<p class="g-count">Story ' + (s.i + 1) + ' of 8 · Correct so far: ' + s.score + '</p>';
    h += dots(8, s.i, s.marks);
    h += '<div class="g-story"><p>' + esc(cur.s) + '</p></div>';
    h += '<p class="g-q" id="g-why-q">Why did the child do it? Pick the best answer.</p>';
    h += '<ul class="g-opts" aria-labelledby="g-why-q">' + FN.map(function (f, i) {
      var cls = '', tag = '';
      if (answered) {
        if (i === cur.a) { cls = ' good'; tag = '<span class="g-tag">Best answer</span>'; }
        else if (i === s.ans) { cls = ' weak'; tag = '<span class="g-tag">Your pick</span>'; }
      }
      return '<li><button type="button" class="pchip' + cls + '" data-act="ans" data-i="' + i + '" data-key="a' + i + '"' + (answered ? ' aria-disabled="true"' : '') + '><span>' + g2Opt(i) + '</span>' + tag + '</button></li>';
    }).join('') + '</ul>';
    if (answered) h += '<div class="g-actions"><button type="button" class="btn solid" data-act="next" data-key="next">' + (s.i === 7 ? 'See my score' : 'Next') + '</button></div>';
    say('why', answered ? (s.ans === cur.a ? 'Yes! You spotted the clue.' : 'Not quite. Look at what happened right after.') : 'Read it, then look at what happened right after.');
    draw('why', h, answered ? 'next' : (user ? 'a0' : null));
  }

  function g2Click(e) {
    var b = e.target.closest('button[data-act]'); if (!b || !g2) return;
    var s = g2, act = b.getAttribute('data-act');
    if (b.getAttribute('aria-disabled') === 'true') return;
    if (act === 'ans') {
      if (s.ans >= 0) return;
      var i = +b.getAttribute('data-i'), cur = s.list[s.i], ok = i === cur.a;
      s.ans = i; if (ok) s.score++; s.marks[s.i] = ok ? 'done' : 'miss';
      g2Draw(true);
      live('why', '<p><strong>' + (ok ? 'Correct.' : 'Not quite. The best answer is: ' + esc(FN[cur.a].p) + '.') + '</strong></p>' +
        '<p><strong>Why:</strong> ' + esc(cur.w) + ' ' + esc(END[cur.a]) + '</p>' +
        '<p><strong>What could help:</strong> ' + esc(cur.h) + '</p>');
    } else if (act === 'next') {
      s.i++; s.ans = -1; live('why', ''); g2Draw(true);
    } else if (act === 'again') { g2New(); g2Draw(true); }
  }

  // =====================================================================
  // GAME 3: Build a goal (SMART)
  // =====================================================================
  var LET = [['S', 'Specific'], ['M', 'Measurable'], ['A', 'Achievable'], ['R', 'Relevant'], ['T', 'Time-bound']];
  var G3D = {
    parent: [
      { vague: 'Sam will behave better at dinner.',
        base: 'Right now Sam asks for more food by saying or tapping “more” on about 2 of 5 chances. The other times, he reaches or grabs.',
        steps: [
          { q: 'What exactly will Sam do?', good: 'Ask for more food by saying or tapping “more”.', yes: 'You can see and hear it. Tapping “more” on a talker like V.O.I.C.E. counts as communicating, just like saying it.',
            bad: [['Behave well at dinner.', '“Behave” can mean different things to different people. Pick something you can see or hear.'], ['Not be bad at the table.', 'This says what NOT to do, and it is hard to see. Say what Sam WILL do.']] },
          { q: 'How will you count it?', good: 'Count each time Sam has a chance to ask for more, and whether he did, with tally marks on the fridge.', yes: 'A count is clear. Anyone in the family would count the same way.',
            bad: [['See how dinners feel this month.', 'A feeling is not a count. Two people could feel differently.'], ['Count every word Sam says all day.', 'That counts more than your goal. Count only the thing in your goal.']] },
          { q: 'Is that a reasonable next step from where Sam is now?', good: 'On at least 4 of 5 chances.', yes: 'It is more than Sam does now, but not a giant jump.',
            bad: [['On all 5 chances, every dinner, starting tomorrow.', 'That is a big jump from 2 of 5. Smaller steps are easier to win.'], ['On at least 2 of 5 chances.', 'Sam already does that. A goal should be a little more than now.']] },
          { q: 'Why does this matter in Sam’s day?', good: 'Asking for what he wants at dinner makes meals smoother and gives Sam a way to be heard.', yes: 'It helps Sam in a real moment of his day.',
            bad: [['Because a skills chart says so.', 'A chart can help, but the goal should matter in Sam’s own day.'], ['Because the neighbor’s child can do it.', 'Compare Sam to Sam, not to other children.']] },
          { q: 'By when?', good: 'By March 1, for 3 dinners in a row.', yes: 'A date and a clear finish line tell you when to check.',
            bad: [['Someday soon.', 'Without a date, no one knows when to check.'], ['By tomorrow night.', 'That is too quick to learn something new. Pick a date far enough to practice.']] }
        ],
        final: 'By March 1, at dinner, Sam will ask for more food by saying or tapping “more,” on at least 4 of 5 chances, for 3 dinners in a row. We’ll count with tally marks on the fridge.' },
      { vague: 'Sam will talk more.',
        base: 'Right now Sam asks for a snack with 1 word or tap, like “crackers.” He puts 2 words together at about 1 of 10 snack times.',
        steps: [
          { q: 'What exactly will Sam do?', good: 'Ask for a snack or drink with 2 words together, saying or tapping, like “want crackers.”', yes: 'You can hear or see it. Tapping words on a talker like V.O.I.C.E. counts as talking.',
            bad: [['Be more talkative.', 'That is hard to see, and it means different things to different people. Name the exact talking.'], ['Say every word clearly.', '“Clearly” depends on who is listening, and tapping a talker counts too. Name the exact words or taps.']] },
          { q: 'How will you count it?', good: 'After each snack, make a tally mark: did Sam use 2 words together, yes or no?', yes: 'A quick yes or no after each snack is easy to keep up.',
            bad: [['Count all the words Sam says in a day.', 'That is a lot to count and it is more than your goal. Count only the talking in your goal.'], ['Guess at the end of the week.', 'A guess forgets things. Write it down right after each snack.']] },
          { q: 'Is that a reasonable next step from where Sam is now?', good: 'At least 5 of 10 snack times.', yes: 'It is a real step up from 1 of 10, and still reachable.',
            bad: [['Every snack time, from now on.', 'That is a big jump from 1 of 10. Smaller steps are easier to win.'], ['At 1 of 10 snack times.', 'Sam already does that. A goal should be a little more than now.']] },
          { q: 'Why does this matter in Sam’s day?', good: 'Using more words helps Sam get what he wants and be understood by family and friends.', yes: 'It helps Sam be understood in a real moment of his day.',
            bad: [['Because other kids his age use longer sentences.', 'Compare Sam to Sam, not to other children.'], ['Because it would be nice.', 'That is too vague. Say how it helps Sam’s day.']] },
          { q: 'By when?', good: 'By January 31, two weeks in a row.', yes: 'A date and a time to keep it up tell you when to check.',
            bad: [['Whenever he is ready.', 'Without a date, no one knows when to check.'], ['By the end of today.', 'That is too quick to learn something new. Pick a date far enough to practice.']] }
        ],
        final: 'By January 31, at snack time, Sam will ask for what he wants with 2 words together, by saying or tapping, like “want crackers,” on at least 5 of 10 snack times, two weeks in a row. We’ll make a tally mark after each snack.' },
      { vague: 'Sam will be more independent getting dressed.',
        base: 'Right now Sam puts on his own shirt, with no more than one reminder, on about 2 of 5 mornings.',
        steps: [
          { q: 'What exactly will Sam do?', good: 'Put on his own shirt after you set it out.', yes: 'It is one clear job you can see.',
            bad: [['Get dressed all by himself.', 'That is a lot of steps at once. Pick one clear job to start with.'], ['Be more independent.', '“Independent” can mean many things. Name the exact job.']] },
          { q: 'How will you count it?', good: 'Use a checklist on his door. Check the box if he did it with no more than one reminder.', yes: 'A checklist makes it easy to see progress.',
            bad: [['Notice if mornings feel easier.', 'A feeling is not a count. Write down what you see.'], ['Ask a friend if Sam seems more independent.', 'Someone else’s opinion is not a count. Count what you see.']] },
          { q: 'Is that a reasonable next step from where Sam is now?', good: 'On at least 4 of 5 mornings.', yes: 'It is more than Sam does now, but not a giant jump.',
            bad: [['On all 5 mornings, with no reminders at all.', 'That is a big jump from 2 of 5. Smaller steps are easier to win.'], ['On at least 2 of 5 mornings.', 'Sam already does that. A goal should be a little more than now.']] },
          { q: 'Why does this matter in Sam’s day?', good: 'Dressing on his own makes busy mornings smoother and helps Sam feel proud and in charge.', yes: 'It helps Sam in a real part of his day.',
            bad: [['Because his cousin already does it.', 'Compare Sam to Sam, not to other children.'], ['Because it would make mornings easier for the adults.', 'That may be a bonus, but the goal should matter to Sam too.']] },
          { q: 'By when?', good: 'By February 15, for 2 weeks in a row.', yes: 'A date and a clear finish line tell you when to check.',
            bad: [['Eventually.', 'Without a date, no one knows when to check.'], ['By tomorrow morning.', 'That is too quick to learn something new. Pick a date far enough to practice.']] }
        ],
        final: 'By February 15, on school mornings, Sam will put on his own shirt after it is set out, with no more than one reminder, on at least 4 of 5 mornings, for 2 weeks in a row. We’ll use a checklist on his bedroom door.' }
    ],
    school: [
      { vague: 'Jordan will follow directions.',
        base: 'Right now Jordan begins an assigned task within 1 minute of the direction on about 2 of 5 opportunities.',
        steps: [
          { q: 'What exactly will Jordan do?', good: 'Begin the assigned math task, like picking up the pencil and writing the first answer, after the teacher gives the direction.', yes: 'It is a behavior you can observe, in one setting.',
            bad: [['Follow all directions.', '“All directions” is too broad. Name one kind of direction in one setting.'], ['Be more compliant.', '“Compliant” is a label, not something you can see. Describe what Jordan does.']] },
          { q: 'How will you measure it?', good: 'For each direction, mark yes or no on a teacher data sheet: did Jordan begin within 1 minute?', yes: 'Each opportunity is counted the same way every time.',
            bad: [['The teacher’s overall impression at the end of the term.', 'An impression is not a count. Measure each opportunity.'], ['Count how many times the direction had to be repeated.', 'Repeats are worth noting, but they do not show whether Jordan began within a set time.']] },
          { q: 'Is that a reasonable next step from where Jordan is now?', good: 'In 4 of 5 opportunities.', yes: 'It is a real step up from 2 of 5 without being a giant jump.',
            bad: [['In 5 of 5 opportunities, every day, starting next week.', 'That is a big jump from 2 of 5. Smaller steps are easier to win.'], ['In 2 of 5 opportunities.', 'Jordan already does that. A goal should be a little more than now.']] },
          { q: 'Why does this matter in Jordan’s day?', good: 'Starting work quickly lets Jordan finish more of his math, keep up with class, and show what he knows.', yes: 'It connects to Jordan’s real school day.',
            bad: [['Because the plan needs another goal on the page.', 'A goal belongs there because it helps the student, not to fill a page.'], ['Because the other students do it.', 'Compare Jordan to Jordan’s own past, not to classmates.']] },
          { q: 'By when?', good: 'By the end of the second grading period, across 3 consecutive data days.', yes: 'A date and a way to confirm it tell the team when to check.',
            bad: [['Sometime this year.', 'Without a date, no one knows when to check.'], ['By Friday.', 'That is too quick to learn something new. Pick a date far enough to teach.']] }
        ],
        final: 'By the end of the second grading period, during whole-group math, Jordan will begin an assigned task within 1 minute of the direction in 4 of 5 opportunities across 3 consecutive data days, as measured by teacher data sheets.' },
      { vague: 'Jordan will communicate better.',
        base: 'Right now Jordan asks for help, with a word, a sign or his talker, on about 1 of 10 opportunities when a task is hard.',
        steps: [
          { q: 'What exactly will Jordan do?', good: 'Ask for help during independent work, using a word, a sign, a picture or an AAC device (a talker).', yes: 'It is one clear message in one setting. Any way of communicating counts, including a talker like V.O.I.C.E.',
            bad: [['Communicate more with others.', 'That is too broad. Pick one clear message in one setting.'], ['Speak in complete sentences.', 'That leaves out students who use signs, pictures or a talker. Any way of communicating counts.']] },
          { q: 'How will you measure it?', good: 'Each time the task gets hard, mark yes or no on the staff data sheet: did Jordan ask for help?', yes: 'Every opportunity is counted, in any form of communication.',
            bad: [['Ask staff if he seems to communicate better.', 'An impression is not a count. Measure each opportunity.'], ['Count only the words Jordan says out loud.', 'That leaves out signs, pictures and talker taps. Count every way he communicates.']] },
          { q: 'Is that a reasonable next step from where Jordan is now?', good: 'On at least 6 of 10 opportunities.', yes: 'It is a real step up from 1 of 10 without being a giant jump.',
            bad: [['On 10 of 10 opportunities, starting next week.', 'That is a big jump from 1 of 10. Smaller steps are easier to win.'], ['On 1 of 10 opportunities.', 'Jordan already does that. A goal should be a little more than now.']] },
          { q: 'Why does this matter in Jordan’s day?', good: 'Asking for help lets Jordan get unstuck, stay in class, and rely less on adults guessing what he needs.', yes: 'It connects to Jordan’s real school day.',
            bad: [['Because speech goals are common.', 'A goal should fit this student’s day, not what is common.'], ['Because the teacher wants a quieter room.', 'The goal should help Jordan, not only the room.']] },
          { q: 'By when?', good: 'By the end of the school year, across 3 consecutive data days.', yes: 'A date and a way to confirm it tell the team when to check.',
            bad: [['At some point.', 'Without a date, no one knows when to check.'], ['By next week.', 'That is too quick to learn something new. Pick a date far enough to teach.']] }
        ],
        final: 'By the end of the school year, during independent work, when a task is hard, Jordan will request help by using a word, sign, picture or his AAC device on at least 6 of 10 opportunities across 3 consecutive data days, as measured by staff data sheets.' },
      { vague: 'Jordan will stay on task.',
        base: 'Right now Jordan keeps working on his assigned reading for about 2 minutes in a row.',
        steps: [
          { q: 'What exactly will Jordan do?', good: 'Keep working on his assigned reading, with his eyes and hands on the work.', yes: 'It describes what on-task looks like.',
            bad: [['Pay attention more.', '“Pay attention” can’t be seen. Describe what on-task looks like.'], ['Not get distracted.', 'This says what NOT to do. Say what Jordan will do.']] },
          { q: 'How will you measure it?', good: 'Use a timer and a data sheet. Write how many minutes in a row Jordan kept working in each session.', yes: 'Minutes in a row is clear and easy to compare.',
            bad: [['The teacher’s feeling about how he is doing.', 'A feeling is not a count. Measure what you see.'], ['Count how many times he looks away.', 'That counts the problem, not the goal. Measure how long he works.']] },
          { q: 'Is that a reasonable next step from where Jordan is now?', good: '5 minutes in a row, in 4 of 5 sessions.', yes: 'It is a real step up from 2 minutes without being a giant jump.',
            bad: [['20 minutes in a row, starting next week.', 'That is a big jump from 2 minutes. Smaller steps are easier to win.'], ['2 minutes in a row.', 'Jordan already does that. A goal should be a little more than now.']] },
          { q: 'Why does this matter in Jordan’s day?', good: 'Staying with his work gives Jordan time to finish assignments and learn the lesson.', yes: 'It connects to Jordan’s real school day.',
            bad: [['Because teachers like quiet students.', 'The goal should help Jordan, not only the adults.'], ['Because the class is moving ahead.', 'Compare Jordan to Jordan’s own past, not to the class.']] },
          { q: 'By when?', good: 'By the end of the third grading period, across 2 consecutive weeks.', yes: 'A date and a way to confirm it tell the team when to check.',
            bad: [['Sometime later.', 'Without a date, no one knows when to check.'], ['By tomorrow.', 'That is too quick to learn something new. Pick a date far enough to teach.']] }
        ],
        final: 'By the end of the third grading period, during independent reading, Jordan will keep working on his assigned reading for 5 minutes in a row, with no more than one reminder, in 4 of 5 sessions across 2 consecutive weeks, as measured by a timer and teacher data sheets.' }
    ]
  };
  var g3 = null, g3idx = { parent: 0, school: 0 };

  function g3New(keep) {
    var goal = G3D[aud][g3idx[aud]];
    g3 = { goal: goal, step: 0, done: [], tried: {}, order: null };
    g3.order = shuffle(range(3));
    live('goal', '');
    g3Draw(false, keep);
  }
  function strip(s) {
    return '<ol class="g-strip" aria-label="Goal parts">' + LET.map(function (l, i) {
      var st = i < s.step ? 'done' : (i === s.step ? 'now' : '');
      return '<li class="' + st + '"><b>' + l[0] + '</b><span class="g-w">' + l[1] + '</span><span class="sr">' + (st === 'done' ? ' (done)' : (st === 'now' ? ' (now)' : '')) + '</span></li>';
    }).join('') + '</ol>';
  }
  function g3Draw(user) {
    var s = g3, h = '', goal = s.goal, kid = isSchool() ? 'Jordan' : 'Sam';
    h += strip(s);
    if (s.step >= 5) {
      h += '<p class="g-was"><span class="sr">The vague goal was: </span><del>' + esc(goal.vague) + '</del></p>';
      h += '<div class="sticky green g-goal"><span class="tape"></span><h3 class="g-h3" id="g-goal-final" tabindex="-1" data-key="final">Your goal</h3><p>' + esc(goal.final) + '</p></div>';
      h += '<ul class="g-done">' + s.done.map(function (d, i) { return '<li><span class="g-ck" aria-hidden="true">✓</span><span><b>' + LET[i][0] + ' ' + LET[i][1] + ':</b> ' + esc(d) + '</span></li>'; }).join('') + '</ul>';
      h += '<div class="g-actions"><button type="button" class="btn solid" data-act="new" data-key="new">New goal</button></div>';
      say('goal', 'Now anyone can tell what to do, how to count it, and when to check.');
      draw('goal', h, 'final');
      return;
    }
    var st = goal.steps[s.step];
    h += '<p class="g-was">Vague goal: <b>' + esc(goal.vague) + '</b></p>';
    if (s.done.length) h += '<ul class="g-done">' + s.done.map(function (d, i) { return '<li><span class="g-ck" aria-hidden="true">✓</span><span><b>' + LET[i][0] + ' ' + LET[i][1] + ':</b> ' + esc(d) + '</span></li>'; }).join('') + '</ul>';
    h += '<h3 class="g-h3" id="g-goal-h" tabindex="-1" data-key="h">' + LET[s.step][0] + ': ' + LET[s.step][1] + '</h3>';
    h += '<p class="g-q" id="g-goal-q">' + esc(st.q) + ' Pick the best one.</p>';
    if (s.step === 2) h += '<p class="g-base"><strong>' + (isSchool() ? 'Right now (baseline):' : 'Right now:') + '</strong> ' + esc(goal.base.replace(/^Right now /, '')) + '</p>';
    var opts = [{ t: st.good, g: true }, { t: st.bad[0][0], r: st.bad[0][1] }, { t: st.bad[1][0], r: st.bad[1][1] }];
    h += '<ul class="g-opt-list" aria-labelledby="g-goal-q">' + s.order.map(function (k, pos) {
      var o = opts[k], tried = s.tried[s.step + '-' + k];
      return '<li><button type="button" class="pchip" data-act="opt" data-k="' + k + '" data-key="o' + pos + '"' + (tried ? ' aria-disabled="true"' : '') + '>' +
        (tried ? '<span class="g-tag" style="margin-left:0">Not this one</span>' : '') + '<span>' + esc(o.t) + '</span></button></li>';
    }).join('') + '</ul>';
    h += '<div class="g-actions"><button type="button" class="btn" data-act="new" data-key="new">New goal</button></div>';
    say('goal', s.step === 0 ? 'Let’s fix this goal, one letter at a time.' : 'Nice. Next letter.');
    draw('goal', h, user ? 'h' : null);
  }
  function g3Click(e) {
    var b = e.target.closest('button[data-act]'); if (!b || !g3) return;
    var s = g3, act = b.getAttribute('data-act');
    if (b.getAttribute('aria-disabled') === 'true') return;
    if (act === 'new') {
      g3idx[aud] = (g3idx[aud] + 1) % 3; g3New(); g3Draw(true);
      return;
    }
    if (act === 'opt') {
      var k = +b.getAttribute('data-k'), st = s.goal.steps[s.step];
      if (k === 0) {
        s.done.push(st.good); s.step++; s.tried = {}; s.order = shuffle(range(3));
        g3Draw(true);
        if (s.step >= 5) live('goal', '<p><strong>Yes.</strong> ' + esc(st.yes) + '</p><p>All five parts are done. Here is your goal.</p>');
        else live('goal', '<p><strong>Yes.</strong> ' + esc(st.yes) + '</p><p>Next: ' + LET[s.step][1] + '.</p>');
      } else {
        s.tried[s.step + '-' + k] = true;
        var why = st.bad[k - 1][1];
        g3Draw(false);
        live('goal', '<p><strong>Not quite.</strong> ' + esc(why) + ' Pick again.</p>');
      }
    }
  }

  // =====================================================================
  // Audience switch and start
  // =====================================================================
  var PRACTICE = {
    parent: [
      'Finding what a child likes best by offering two things at a time and writing down what the child picks.',
      'Spotting why a child might do something by looking at what happens right after.',
      'Turning a vague wish into a clear goal you can count.'
    ],
    school: [
      'Offering two items at a time and recording each pick to find the best reward (paired-stimulus preference assessment).',
      'Spotting why a behavior happens by looking at what happens right after it (function of behavior).',
      'Turning a vague goal into a clear one with five parts (SMART goal).'
    ]
  };
  function setPractice() {
    ['favorite', 'why', 'goal'].forEach(function (id, i) { $('#' + id + '-practice').textContent = PRACTICE[aud][i]; });
  }
  function startAll() {
    token++;
    setPractice();
    g1New(); g2New(); g3New();
  }
  function setAud(a, announce) {
    aud = a;
    $all('.g-aud .pill').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-aud') === a ? 'true' : 'false'); });
    g3idx[a] = 0;
    startAll();
    if (announce) $('#g-aud-live').textContent = a === 'school' ? 'Examples are now for people who work in a school. The games restarted.' : 'Examples are now for parents. The games restarted.';
  }

  $all('.g-aud .pill').forEach(function (b) {
    b.addEventListener('click', function () { if (b.getAttribute('aria-pressed') !== 'true') setAud(b.getAttribute('data-aud'), true); });
  });
  $('#g-favorite-body').addEventListener('click', g1Click);
  $('#g-why-body').addEventListener('click', g2Click);
  $('#g-goal-body').addEventListener('click', g3Click);
  setAud('parent', false);
})();
