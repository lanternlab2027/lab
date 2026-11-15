/* Optional "new data" email signup (Kit v3 tag subscribe), same pattern as docs/eats/kit.js.
   Sends only the email address. TAG is a placeholder until a Kit tag is created; while it isn't numeric
   the signup box stays hidden. */
(function () {
  'use strict';
  var KIT_KEY = "9OgTfHEbtX6FB0NWVjkgyg";
  var TAG = (typeof window !== 'undefined' && window.DOGS_KIT_TAG_TEST) || '25923630';
  var box = document.getElementById('signup');
  if (!box) return;
  if (!/^\d+$/.test(String(TAG))) { box.setAttribute('data-disabled', '1'); box.hidden = true; return; }
  box.hidden = false;
  var f = document.getElementById('signup-form'), msg = document.getElementById('signup-msg');
  f.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = document.getElementById('signup-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Please enter a valid email.'; return; }
    var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing up...';
    try {
      var r = await fetch('https://api.convertkit.com/v3/tags/' + TAG + '/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: KIT_KEY, email: email })
      });
      if (!r.ok) throw new Error('status ' + r.status);
      f.hidden = true;
      msg.innerHTML = "<b>You're on the list.</b> One email when the city's new dog license data is in.";
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Email me';
      msg.textContent = "Sorry, that didn't go through. Please try again in a moment.";
    }
  });
})();
