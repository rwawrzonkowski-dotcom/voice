// Get started: show one step at a time, with Back and Next. With scripts off, every step simply shows.
(function () {
  'use strict';
  var list = document.getElementById('steps'); if (!list) return;
  var steps = Array.prototype.slice.call(list.querySelectorAll('.step'));
  var nav = document.getElementById('stepnav');
  var cur = 0, showAll = false;
  var m = /^#step-(\d)$/.exec(location.hash); if (m) cur = Math.min(steps.length - 1, Math.max(0, Number(m[1]) - 1));

  nav.innerHTML = '<button type="button" class="btn" id="st-back">Back</button>' +
    '<div class="dots" role="group" aria-label="Steps">' + steps.map(function (s, i) {
      return '<button type="button" class="dot" aria-label="Step ' + (i + 1) + '">' + (i + 1) + '</button>';
    }).join('') + '</div>' +
    '<button type="button" class="btn solid" id="st-next">Next</button>';
  var back = document.getElementById('st-back'), next = document.getElementById('st-next');
  var dots = nav.querySelectorAll('.dot');
  var all = document.getElementById('st-all');

  function draw(focus) {
    steps.forEach(function (s, i) { s.hidden = !showAll && i !== cur; });
    for (var i = 0; i < dots.length; i++) { if (i === cur && !showAll) dots[i].setAttribute('aria-current', 'step'); else dots[i].removeAttribute('aria-current'); }
    back.disabled = cur === 0; next.disabled = cur === steps.length - 1;
    nav.hidden = showAll;
    if (all) { all.firstChild.textContent = showAll ? 'Show one step at a time' : 'Show all steps on one page'; all.classList.toggle('on', showAll); }
    if (focus) {
      var h = steps[cur].querySelector('h2'); h.tabIndex = -1; h.focus({ preventScroll: true });
      steps[cur].scrollIntoView({ block: 'start' });
      try { history.replaceState(null, '', '#step-' + (cur + 1)); } catch (e) {}
    }
  }
  back.addEventListener('click', function () { if (cur > 0) { cur--; draw(true); } });
  next.addEventListener('click', function () { if (cur < steps.length - 1) { cur++; draw(true); } });
  for (var d = 0; d < dots.length; d++) (function (i) { dots[i].addEventListener('click', function () { cur = i; draw(true); }); })(d);
  if (all) { all.hidden = false; all.addEventListener('click', function () { showAll = !showAll; draw(false); }); }
  draw(false);
})();
