/* Launch-news signup (Kit): new photo packs and new city games, a few times a year. Sends only api_key + email. Same pattern as ../ll97/. */
(function () {
  'use strict';
  var KIT_KEY = '9OgTfHEbtX6FB0NWVjkgyg'; var TAG = '25915601';
  var f = document.getElementById('signup-form');
  var msg = document.getElementById('signup-msg');
  if (!f) return;
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('signup-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Please enter a valid email address.'; return; }
    var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing up...';
    fetch('https://api.convertkit.com/v3/tags/' + TAG + '/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: KIT_KEY, email: email })
    }).then(function (r) {
      if (!r.ok) throw new Error('status ' + r.status);
      f.innerHTML = '<b>You\u2019re in.</b> We\u2019ll email you when new photo packs or new city games launch (a few times a year).';
      msg.textContent = '';
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Keep me posted';
      msg.textContent = 'Sorry, that didn\u2019t go through. Please try again in a moment.';
    });
  });
})();
