/* Optional "remind me Jan 1 when the full year is in" signup (Kit v3 tag subscribe), same pattern as docs/eats/kit.js.
   Sends only the email address. Never the place you looked up, never any weather data.
   TAG is a placeholder until a Kit tag is created; while it isn't numeric the box stays hidden. */
(function () {
  'use strict';
  var KIT_KEY = "9OgTfHEbtX6FB0NWVjkgyg";
  var TAG = (typeof window !== 'undefined' && window.WEATHER_KIT_TAG_TEST) || "25953031";
  var box = document.getElementById('remind');
  if (!box) return;
  if (!/^\d+$/.test(String(TAG))) { box.setAttribute('data-disabled', '1'); box.hidden = true; return; }
  box.removeAttribute('data-disabled');
  // In January the full year is already in, so there's nothing to remind about.
  box.hidden = new Date().getMonth() === 0;
  var f = document.getElementById('signup-form'), msg = document.getElementById('signup-msg');
  f.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = document.getElementById('signup-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Please enter a valid email.'; return; }
    var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing up...';
    try {
      var r = await fetch('https://api.convertkit.com/v3/tags/' + TAG + '/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
        body: JSON.stringify({ api_key: KIT_KEY, email: email })
      });
      if (!r.ok) throw new Error('status ' + r.status);
      f.hidden = true;
      msg.innerHTML = "<b>You're in.</b> We'll email you on Jan 1 when the full year is in. Unsubscribe anytime.";
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Remind me';
      msg.textContent = "Sorry, that didn't go through. Please try again in a moment.";
    }
  });
})();
