/* Optional "email me when odds are high" signup (Kit v3 tag subscribe), same pattern as docs/eats/kit.js.
   Sends only the email and a ZIP code (custom field snow_zip). No name, age or school is asked for.
   TAG is a placeholder until a Kit tag is created; while it isn't numeric the box stays hidden. */
(function () {
  'use strict';
  var KIT_KEY = "9OgTfHEbtX6FB0NWVjkgyg";
  var TAG = (typeof window !== 'undefined' && window.SNOW_KIT_TAG_TEST) || "25923836";
  var box = document.getElementById('alert');
  if (!box) return;
  if (!/^\d+$/.test(String(TAG))) { box.setAttribute('data-disabled', '1'); box.hidden = true; return; }
  box.hidden = false;
  var f = document.getElementById('signup-form'), msg = document.getElementById('signup-msg');
  f.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = document.getElementById('signup-email').value.trim();
    var zip = document.getElementById('signup-zip').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Please enter a valid email.'; return; }
    if (!/^\d{5}$/.test(zip)) { msg.textContent = 'Please enter a 5-digit ZIP code.'; return; }
    var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing up...';
    try {
      var r = await fetch('https://api.convertkit.com/v3/tags/' + TAG + '/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
        body: JSON.stringify({ api_key: KIT_KEY, email: email, fields: { snow_zip: zip } })
      });
      if (!r.ok) throw new Error('status ' + r.status);
      f.hidden = true;
      msg.innerHTML = "<b>You're in.</b> We'll email you when the odds for " + zip + " look high. Unsubscribe anytime.";
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Email me';
      msg.textContent = "Sorry, that didn't go through. Please try again in a moment.";
    }
  });
})();
