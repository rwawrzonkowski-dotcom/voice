// For clinicians: a simplified picture of the Model prompt fading (100, 75, 50, 25 percent, then independent).
(function () {
  'use strict';
  var box = document.getElementById('fade'); if (!box) return;
  var LEVELS = [100, 75, 50, 25, 0];
  var i = 0;
  var ring = box.querySelector('.ring'), critter = box.querySelector('.critter');
  var label = document.getElementById('fade-label'), meter = document.getElementById('fade-meter');
  var less = document.getElementById('fade-less'), more = document.getElementById('fade-more');
  function draw() {
    var v = LEVELS[i];
    ring.style.opacity = v / 100; critter.style.opacity = v / 100;
    label.textContent = v ? 'Model prompt at ' + v + '%' : 'Independent: no prompt showing';
    meter.innerHTML = LEVELS.slice(0, 4).map(function (l, k) { return '<i class="' + (k >= i ? 'on' : '') + '"></i>'; }).join('');
    less.disabled = i === LEVELS.length - 1; more.disabled = i === 0;
  }
  less.addEventListener('click', function () { if (i < LEVELS.length - 1) { i++; draw(); } });
  more.addEventListener('click', function () { if (i > 0) { i--; draw(); } });
  box.hidden = false;
  draw();
})();
