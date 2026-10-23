/* Tesla Coaching Classes: shared script (menu + enquiry form). Small on purpose. */
(function () {
  var PHONE = '919763788820';
  var FORM_EMAIL = 'yelelucky@gmail.com';

  // Mobile menu
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('site-nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? '✕' : '☰';
    });
  }

  // Enquiry form
  var form = document.getElementById('enquiry-form');
  if (!form) return;

  var phoneEl = form.elements['phone'];
  var statusEl = document.getElementById('form-status');
  var thanks = document.getElementById('thanks');
  var waAfter = document.getElementById('wa-after');

  function cleanPhone(v) {
    v = (v || '').replace(/[\s\-()]/g, '');
    if (v.indexOf('+91') === 0) v = v.slice(3);
    else if (v.length === 12 && v.indexOf('91') === 0) v = v.slice(2);
    else if (v.length === 11 && v.charAt(0) === '0') v = v.slice(1);
    return v;
  }
  function validPhone(v) { return /^[6-9]\d{9}$/.test(cleanPhone(v)); }

  function mark(el, bad) {
    el.classList.toggle('invalid', bad);
    el.setAttribute('aria-invalid', bad ? 'true' : 'false');
  }

  phoneEl.addEventListener('blur', function () { if (phoneEl.value) mark(phoneEl, !validPhone(phoneEl.value)); });
  phoneEl.addEventListener('input', function () { if (phoneEl.classList.contains('invalid') && validPhone(phoneEl.value)) mark(phoneEl, false); });

  function waText(d) {
    return 'Hello Lucky Bhaiya, I want to know about admission.\n' +
      'Student: ' + d.student_name + '\n' +
      'Parent: ' + d.parent_name + '\n' +
      'Class: ' + d.class + '\n' +
      'Subject: ' + d.subject + '\n' +
      'Phone: ' + d.phone + '\n' +
      'Village/Area: ' + d.village + (d.message ? '\nMessage: ' + d.message : '');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var required = ['student_name', 'parent_name', 'class', 'subject', 'phone', 'village'];
    var firstBad = null;
    required.forEach(function (name) {
      var el = form.elements[name];
      var bad = !el.value.trim() || (name === 'phone' && !validPhone(el.value));
      mark(el, bad);
      if (bad && !firstBad) firstBad = el;
    });
    if (firstBad) { firstBad.focus(); statusEl.textContent = 'Please fix the boxes marked in red.'; return; }
    if (form.elements['_honey'].value) return; // spam bot

    var d = {
      student_name: form.elements['student_name'].value.trim(),
      parent_name: form.elements['parent_name'].value.trim(),
      class: form.elements['class'].value,
      subject: form.elements['subject'].value,
      phone: cleanPhone(form.elements['phone'].value),
      village: form.elements['village'].value.trim(),
      message: form.elements['message'].value.trim()
    };
    var waUrl = 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(waText(d));
    waAfter.href = waUrl;

    var submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    statusEl.textContent = 'Sending… please wait.';

    var payload = {
      _subject: 'New enquiry: ' + d.student_name + ' (Class ' + d.class + ')',
      _template: 'table',
      'Student name': d.student_name,
      'Parent name': d.parent_name,
      'Class': d.class,
      'Subject': d.subject,
      'Phone': d.phone,
      'Village / Area': d.village,
      'Message': d.message || '-'
    };

    fetch('https://formsubmit.co/ajax/' + FORM_EMAIL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (String(res.success) === 'true') {
          form.hidden = true;
          thanks.classList.add('show');
          thanks.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          throw new Error(res.message || 'not sent');
        }
      })
      .catch(function () {
        submitBtn.disabled = false;
        statusEl.innerHTML = 'Sorry, the form could not be sent (maybe slow internet). ' +
          '<a href="' + waUrl + '" target="_blank" rel="noopener">Tap here to send the same details on WhatsApp</a>.';
      });
  });
})();
