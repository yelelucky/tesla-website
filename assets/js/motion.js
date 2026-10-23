/* Tesla Coaching Classes: scroll-driven motion engine v3. No libraries.
 *
 * One requestAnimationFrame loop drives everything and sleeps when nothing is moving.
 *   [data-s]      --p 0→1 as the element rises up the screen (smoothed / "eased" towards the target)
 *   [data-split]  heading split into words that rise one by one with --p
 *   [data-hl]     paragraph whose words light up one by one with --p
 *   .story        pinned "scrollytelling" scene: --lp 0→1 across its height, steps change on the way
 *   .hs           pinned horizontal gallery: vertical scroll moves the cards sideways
 *   .energy       a lightning line drawn down the page margin as you scroll (wide screens)
 *   .hero/.page-head  --y for parallax; .ticker-row moves and skews with scroll speed
 * Pointer (desktop): magnetic buttons, spotlight on cards and hero.
 * Respect: "reduce motion" → everything shown still. Low-memory phones → "lite" (no smoothing/skew).
 */
(function () {
  var doc = document.documentElement;
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lite = !!(navigator.deviceMemory && navigator.deviceMemory <= 2);
  doc.classList.add('js');
  if (still) doc.classList.add('still');
  if (lite) doc.classList.add('lite');
  var header = document.querySelector('.site-header');

  // Scroll progress bar
  var bar = document.createElement('div');
  bar.className = 'progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  // ---------- 1. Text splitting ----------
  function splitWords(el, wordClass, inner) {
    if (el.getAttribute('data-done')) return;
    el.setAttribute('data-done', '1');
    var n = 0;
    each(Array.prototype.slice.call(el.childNodes), function (node) {
      if (node.nodeType === 3) {
        var frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var w = document.createElement('span'); w.className = wordClass; w.style.setProperty('--i', n++);
          if (inner) { var s = document.createElement('span'); s.className = inner; s.textContent = part; w.appendChild(s); }
          else w.textContent = part;
          frag.appendChild(w);
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === 1 && !node.classList.contains('hi') && node.tagName !== 'BR') {
        node.classList.add(wordClass === 'hw' ? 'hw' : 'w-el');
        node.style.setProperty('--i', n++);
      }
    });
    el.style.setProperty('--n', n);
  }

  // ---------- 2. Tag blocks with motion presets ----------
  var styles = ['up', 'flip', 'zoom', 'tilt'];
  function tag(root) {
    each(root.querySelectorAll('.grid, .tests, .stats-grid, .mat-list'), function (g, gi) {
      each(g.children, function (el, i) {
        if (!el.hasAttribute('data-s')) el.setAttribute('data-s', g.classList.contains('stats-grid') ? 'zoom' : styles[(gi + i) % styles.length]);
        if (!el.hasAttribute('data-delay')) el.setAttribute('data-delay', String((i % 4) * 0.12));
      });
    });
    each(root.querySelectorAll('.flow > li'), function (el, i) {
      if (!el.hasAttribute('data-s')) el.setAttribute('data-s', i % 2 ? 'right' : 'left');
    });
    each(root.querySelectorAll('main h2'), function (h) {
      if (h.closest('.hero') || h.closest('.page-head') || h.closest('.story') || h.closest('.hs') || h.closest('.mat-group')) return;
      if (!h.hasAttribute('data-s')) { h.setAttribute('data-s', 'split'); h.setAttribute('data-split', ''); }
    });
    each(root.querySelectorAll('[data-split]'), function (h) { splitWords(h, 'w', 'wi'); });
    each(root.querySelectorAll('[data-hl]'), function (p) { splitWords(p, 'hw'); if (!p.hasAttribute('data-s')) p.setAttribute('data-s', 'hl'); });
    each(root.querySelectorAll('main .eyebrow, main .lead, main .notice, main .placeholder, main .table-wrap, main details, main .price, main .cta-card, .mat-type, .mat-group > h2, .site-footer .foot-grid > *, .site-footer .credit'), function (el) {
      if (el.hasAttribute('data-s') || el.closest('[data-s]') || el.closest('.hero-copy') || el.closest('.page-head') || el.closest('.story') || el.closest('.hs-head')) return;
      el.setAttribute('data-s', 'up');
    });
  }
  tag(document);

  if (still) {
    each(document.querySelectorAll('[data-count]'), function (el) {
      var v = el.getAttribute('data-count') === 'materials' ? (window.MATERIALS || []).length : el.getAttribute('data-count');
      el.textContent = v + (el.getAttribute('data-suffix') || '');
    });
    fillSubjectCounts();
    startRotators(false);
    return;
  }

  // ---------- 3. Measure (layout positions, ignoring transforms) ----------
  var items = [], counters = [], stories = [], gals = [], energy = null;
  var vh = window.innerHeight, maxScroll = 0, hh = 64;
  function absTop(el) { var y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; }

  each(document.querySelectorAll('[data-count="materials"]'), function (el) {
    if (window.MATERIALS) el.setAttribute('data-count', window.MATERIALS.length); else el.removeAttribute('data-count');
  });
  function fillSubjectCounts() {
    each(document.querySelectorAll('[data-subject-count]'), function (el) {
      var keys = el.getAttribute('data-subject-count').split(',');
      el.textContent = (window.MATERIALS || []).filter(function (m) { return keys.indexOf(m.subject) >= 0; }).length;
    });
  }
  fillSubjectCounts();

  function measure() {
    vh = window.innerHeight;
    hh = header ? header.offsetHeight : 64;
    doc.style.setProperty('--hh', hh + 'px');

    // horizontal galleries set their own height first
    gals = [];
    each(document.querySelectorAll('.hs'), function (s) {
      var stage = s.querySelector('.hs-stage'), track = s.querySelector('.hs-track');
      var dist = Math.max(0, track.scrollWidth - stage.clientWidth);
      s.style.setProperty('--hs-dist', dist + 'px');
      gals.push({ el: s, track: track, dist: dist, last: -1 });
    });

    maxScroll = Math.max(0, doc.scrollHeight - vh);
    items = [];
    each(document.querySelectorAll('[data-s]'), function (el) {
      var top = absTop(el);
      var e = parseFloat(el.getAttribute('data-end')); if (isNaN(e)) e = 0.55;
      var b = parseFloat(el.getAttribute('data-start')); if (isNaN(b)) b = 1;
      var end = Math.min(top - vh * e, maxScroll);
      var start = Math.min(top - vh * b, end - vh * 0.25);
      var it = { el: el, start: start, end: end, delay: parseFloat(el.getAttribute('data-delay')) || 0, cur: -1, last: -1 };
      items.push(it);
    });
    each(document.querySelectorAll('.flow.timeline'), function (t) {
      items.push({ el: t, prop: '--progress', start: absTop(t) - vh * 0.8, end: absTop(t) + t.offsetHeight - vh * 0.6, delay: 0, cur: -1, last: -1 });
    });

    stories = [];
    each(document.querySelectorAll('.story'), function (s) {
      var stage = s.querySelector('.story-stage');
      stories.push({ el: s, top: absTop(s) - hh, range: Math.max(1, s.offsetHeight - stage.offsetHeight), steps: s.querySelectorAll('.story-steps > li'),
        dots: s.querySelectorAll('.story-dots > span'), num: s.querySelector('.ring-num b'), idx: -1, last: -1 });
    });
    each(gals, function (g) { g.top = absTop(g.el) - hh; g.range = Math.max(1, g.el.offsetHeight - g.el.querySelector('.hs-stage').offsetHeight); });

    counters = [];
    each(document.querySelectorAll('[data-count]'), function (el) {
      var top = absTop(el);
      counters.push({ el: el, end: parseFloat(el.getAttribute('data-count')) || 0, suffix: el.getAttribute('data-suffix') || '',
        start: Math.min(top - vh, maxScroll - vh * 0.3), stop: Math.min(top - vh * 0.5, maxScroll), last: -1 });
    });

    buildEnergy();
  }

  // ---------- 4. Energy line (wide screens only) ----------
  function buildEnergy() {
    var main = document.querySelector('main');
    var old = document.querySelector('.energy');
    if (window.innerWidth < 1240 || lite || !main) { if (old) old.remove(); energy = null; return; }
    var H = main.offsetHeight, W = 60, ns = 'http://www.w3.org/2000/svg';
    var svg = old || document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'energy'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
    // zig-zag bolt segments down the page
    var d = 'M30 0', y = 0, left = true;
    while (y < H) { y += 260; d += ' L' + (left ? 8 : 52) + ' ' + Math.min(y, H); left = !left; }
    svg.innerHTML = '<defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DDA733"/><stop offset="1" stop-color="#2F5FB3"/></linearGradient></defs>' +
      '<path class="e-bg" d="' + d + '"/><path class="e-fg" d="' + d + '"/><circle class="e-dot" r="5"/>';
    if (!old) main.appendChild(svg);
    var fg = svg.querySelector('.e-fg');
    var len = fg.getTotalLength();
    fg.style.strokeDasharray = len; fg.style.strokeDashoffset = len;
    energy = { fg: fg, dot: svg.querySelector('.e-dot'), len: len, top: absTop(main), H: H, last: -1 };
  }

  // ---------- 5. The loop ----------
  var tickers = document.querySelectorAll('.ticker-row');
  var parallax = document.querySelectorAll('.hero, .page-head');
  var lastY = window.scrollY, vel = 0, running = false;
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  var smooth = lite ? 1 : 0.16;

  function frame() {
    var y = window.scrollY || window.pageYOffset, busy = false;
    vel += ((y - lastY) - vel) * 0.25; lastY = y;
    if (Math.abs(vel) > 0.05) busy = true; else vel = 0;
    var skew = lite ? 0 : Math.max(-7, Math.min(7, vel * 0.18));

    if (header) header.classList.toggle('scrolled', y > 8);
    doc.style.setProperty('--sp', maxScroll ? (y / maxScroll).toFixed(4) : 0);
    each(parallax, function (h) { if (y < h.offsetHeight + 200) h.style.setProperty('--y', Math.round(y)); });

    each(tickers, function (t, i) {
      var half = t.scrollWidth / 3, shift = (y * 0.45) % half;
      t.style.transform = 'translate3d(' + (i % 2 ? shift - half : -shift).toFixed(1) + 'px,0,0) skewX(' + (-skew).toFixed(2) + 'deg)';
    });

    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      var target = clamp((y - it.start) / (it.end - it.start || 1));
      if (it.delay) target = clamp((target - it.delay) / (1 - it.delay));
      if (it.cur < 0) it.cur = target;
      else it.cur += (target - it.cur) * smooth;
      if (Math.abs(target - it.cur) < 0.002) it.cur = target; else busy = true;
      var p = Math.round(it.cur * 1000) / 1000;
      if (p !== it.last) { it.last = p; it.el.style.setProperty(it.prop || '--p', p); }
    }

    each(stories, function (s) {
      var lp = clamp((y - s.top) / s.range);
      if (Math.abs(lp - s.last) > 0.0005) { s.last = lp; s.el.style.setProperty('--lp', lp.toFixed(4)); }
      var idx = Math.min(s.steps.length - 1, Math.floor(lp * s.steps.length));
      if (idx !== s.idx) {
        s.idx = idx;
        each(s.steps, function (li, i) { li.classList.toggle('active', i === idx); li.classList.toggle('done', i < idx); });
        each(s.dots, function (d, i) { d.classList.toggle('on', i <= idx); });
        if (s.num) s.num.textContent = idx + 1;
      }
    });

    each(gals, function (g) {
      var lp = clamp((y - g.top) / g.range);
      g.el.style.setProperty('--lp', lp.toFixed(4));
      g.track.style.transform = 'translate3d(' + (-lp * g.dist).toFixed(1) + 'px,0,0) skewX(' + (-skew * 0.6).toFixed(2) + 'deg)';
    });

    if (energy) {
      var ep = clamp((y + vh * 0.6 - energy.top) / energy.H);
      if (ep !== energy.last) {
        energy.last = ep;
        energy.fg.style.strokeDashoffset = (energy.len * (1 - ep)).toFixed(1);
        var pt = energy.fg.getPointAtLength(energy.len * ep);
        energy.dot.setAttribute('cx', pt.x.toFixed(1)); energy.dot.setAttribute('cy', pt.y.toFixed(1));
      }
    }

    for (var c = 0; c < counters.length; c++) {
      var ct = counters[c];
      var q = clamp((y - ct.start) / (ct.stop - ct.start || 1));
      var n = Math.round(ct.end * (1 - Math.pow(1 - q, 2)));
      if (n !== ct.last) { ct.last = n; ct.el.textContent = n + ct.suffix; }
    }
    return busy;
  }

  function loop() { if (frame()) requestAnimationFrame(loop); else running = false; }
  function wake() {
    if (running) return;
    running = true;
    requestAnimationFrame(loop);
    setTimeout(function () { if (running) { running = false; if (frame()) wake(); } }, 150); // backup if frames are paused
  }

  // ---------- 6. Pointer effects (mouse / trackpad only) ----------
  if (window.matchMedia && window.matchMedia('(pointer: fine)').matches && !lite) {
    document.addEventListener('pointermove', function (e) {
      var t = e.target;
      var btn = t.closest && t.closest('.btn, .call-mini, .wa-float');
      if (btn) {
        var r = btn.getBoundingClientRect();
        btn.style.translate = ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1) + 'px ' + ((e.clientY - r.top - r.height / 2) * 0.35).toFixed(1) + 'px';
        btn.setAttribute('data-mag', '1');
      }
      var card = t.closest && t.closest('.card, .mat, .stat, .hs-card, .story-steps > li');
      if (card) {
        var cr = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - cr.left) + 'px'); card.style.setProperty('--my', (e.clientY - cr.top) + 'px');
      }
      var hero = t.closest && t.closest('.hero');
      if (hero) { hero.style.setProperty('--mx', e.clientX + 'px'); hero.style.setProperty('--my', (e.clientY - hero.getBoundingClientRect().top) + 'px'); }
    }, { passive: true });
    document.addEventListener('pointerout', function (e) {
      var btn = e.target.closest && e.target.closest('[data-mag]');
      if (btn && !btn.contains(e.relatedTarget)) { btn.style.translate = ''; btn.removeAttribute('data-mag'); }
    });
  }

  // ---------- 7. Hero word rotator ----------
  function startRotators(animate) {
    each(document.querySelectorAll('.rotator'), function (r) {
      var words = r.querySelectorAll('span'), i = 0;
      if (!words.length) return;
      words[0].classList.add('on');
      if (!animate || words.length < 2) return;
      setInterval(function () {
        var cur = words[i];
        cur.classList.remove('on'); cur.classList.add('out');
        setTimeout(function () { cur.classList.remove('out'); }, 650);
        i = (i + 1) % words.length;
        words[i].classList.add('on');
      }, 2200);
    });
  }
  startRotators(true);

  // ---------- 8. Start ----------
  measure(); frame();
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', function () { measure(); wake(); });
  window.addEventListener('load', function () { measure(); wake(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); wake(); });
  if ('ResizeObserver' in window) {
    var lastH = 0, rt;
    new ResizeObserver(function () {
      if (Math.abs(doc.scrollHeight - lastH) < 2) return;
      lastH = doc.scrollHeight;
      clearTimeout(rt); rt = setTimeout(function () { measure(); wake(); }, 120);
    }).observe(document.body);
  }

  // Study Materials page re-draws its list: tag the new cards and re-measure
  window.TeslaMotion = { refresh: function (root) { tag(root || document); measure(); frame(); } };
})();
