/* Study Materials page: search + filters over window.MATERIALS (made by tools/update-materials.ps1). */
(function () {
  var data = window.MATERIALS || [];
  var SUBJECTS = [
    { key: 'Science-1', name: 'Science Part-1', cls: 'Class 10', img: 'assets/img/subject-science.jpg' },
    { key: 'Science-2', name: 'Science Part-2', cls: 'Class 10', img: 'assets/img/subject-science.jpg' },
    { key: 'Maths-1', name: 'Maths Part-1 (Algebra)', cls: 'Class 10', img: 'assets/img/subject-maths.jpg' },
    { key: 'Maths-2', name: 'Maths Part-2 (Geometry)', cls: 'Class 10', img: 'assets/img/subject-maths.jpg' },
    { key: 'Grammar', name: 'English Grammar', cls: 'Class 5–10', img: 'assets/img/subject-grammar.jpg' }
  ];
  // Filter buttons group several folders under one simple name
  var TYPES = [
    { key: 'Notes', name: 'Notes', match: ['Class Notes', 'Study Notes'] },
    { key: 'DPPs', name: 'DPPs', match: ['DPPs'] },
    { key: 'Test Papers', name: 'Test Papers', match: ['Test Papers'] },
    { key: 'Board Papers', name: 'Board Papers', match: ['Board Papers'] },
    { key: 'Question Bank', name: 'Question Bank', match: ['Question Bank'] },
    { key: 'Answer Bank', name: 'Answer Bank (Solutions)', match: ['Answer Bank'] }
  ];
  var TYPE_ORDER = ['Class Notes', 'Study Notes', 'DPPs', 'Question Bank', 'Answer Bank', 'Test Papers', 'Board Papers'];

  var state = { subject: 'all', type: 'all', q: '' };
  var listEl = document.getElementById('materials');
  var countEl = document.getElementById('result-count');
  var searchEl = document.getElementById('search');
  var subjChips = document.getElementById('subject-chips');
  var typeChips = document.getElementById('type-chips');

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function chip(container, group, key, label) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = label;
    b.dataset.key = key;
    b.setAttribute('aria-pressed', state[group] === key ? 'true' : 'false');
    b.addEventListener('click', function () { state[group] = key; syncChips(); render(); });
    container.appendChild(b);
  }
  function syncChips() {
    [[subjChips, 'subject'], [typeChips, 'type']].forEach(function (p) {
      Array.prototype.forEach.call(p[0].children, function (b) { b.setAttribute('aria-pressed', b.dataset.key === state[p[1]] ? 'true' : 'false'); });
    });
  }

  function chapterNum(t) { var m = /^Ch (\d+)/.exec(t); return m ? +m[1] : 999; }
  function sortItems(a, b) {
    var d = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
    if (d) return d;
    d = chapterNum(a.title) - chapterNum(b.title);
    if (d) return d;
    return a.title.localeCompare(b.title, 'en', { numeric: true });
  }

  function card(m) {
    var ch = /^Ch (\d+) - /.exec(m.title);
    var title = ch ? m.title.slice(ch[0].length) : m.title;
    var badges = '<span class="badge new">✨ Latest</span>' + (ch ? '<span class="badge ch">Chapter ' + ch[1] + '</span>' : '') +
      '<span class="badge">' + esc(m.type) + '</span><span class="badge">PDF · ' + m.mb + ' MB</span>';
    var fname = (m.subject + ' - ' + m.title + '.pdf').replace(/[\\/:*?"<>|]/g, '-');
    return '<article class="mat"><div class="mat-title">' + esc(title) + '</div>' +
      '<div class="mat-meta">' + badges + '</div>' +
      '<div class="mat-btns">' +
      '<a class="btn btn-navy" href="' + m.url + '" target="_blank" rel="noopener">👁️ View</a>' +
      '<a class="btn btn-line" href="' + m.url + '" download="' + esc(fname) + '">⬇️ Download</a>' +
      '</div></article>';
  }

  function render() {
    var q = state.q.trim().toLowerCase();
    var typeDef = TYPES.filter(function (t) { return t.key === state.type; })[0];
    var items = data.filter(function (m) {
      if (state.subject !== 'all' && m.subject !== state.subject) return false;
      if (typeDef && typeDef.match.indexOf(m.type) < 0) return false;
      if (q) {
        var hay = (m.title + ' ' + m.type + ' ' + m.subject).toLowerCase();
        return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
      }
      return true;
    });
    countEl.textContent = items.length + (items.length === 1 ? ' file' : ' files') + ' found';
    if (!items.length) { listEl.innerHTML = '<p class="empty">No files match. Try another word or tap “All”.</p>'; return; }

    var html = '';
    SUBJECTS.forEach(function (s) {
      var mine = items.filter(function (m) { return m.subject === s.key; }).sort(sortItems);
      if (!mine.length) return;
      html += '<section class="mat-group"><h2><img src="' + s.img + '" alt="" width="36" height="36" loading="lazy">' +
        esc(s.cls) + ' · ' + esc(s.name) + '</h2>';
      var lastType = '';
      mine.forEach(function (m) {
        if (m.type !== lastType) {
          if (lastType) html += '</div>';
          html += '<h3 class="mat-type">' + esc(m.type) + '</h3><div class="mat-list">';
          lastType = m.type;
        }
        html += card(m);
      });
      html += '</div></section>';
    });
    listEl.innerHTML = html;
    // New cards join the scroll-linked motion
    if (window.TeslaMotion) window.TeslaMotion.refresh(listEl);
  }

  chip(subjChips, 'subject', 'all', 'All subjects');
  SUBJECTS.forEach(function (s) { chip(subjChips, 'subject', s.key, s.name.replace(/ \(.*\)/, '')); });
  chip(typeChips, 'type', 'all', 'All types');
  TYPES.forEach(function (t) { chip(typeChips, 'type', t.key, t.name); });

  // Links like materials.html#Science-1 open that subject
  var hash = decodeURIComponent(location.hash.slice(1));
  if (SUBJECTS.some(function (s) { return s.key === hash; })) state.subject = hash;
  syncChips();

  var timer;
  searchEl.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { state.q = searchEl.value; render(); }, 150);
  });
  render();
})();
