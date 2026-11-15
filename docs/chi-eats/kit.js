/* Optional "alert me when a new inspection shows up" signup (Kit v3 tag subscribe), same pattern as docs/eats.
   Sends only the email and the establishment's license number (custom field restaurant_license).
   TAG is a placeholder until a Kit tag is created; while it isn't numeric the box stays hidden. */
(function () {
  'use strict';
  var KIT_KEY = "9OgTfHEbtX6FB0NWVjkgyg";
  var TAG = (typeof window !== 'undefined' && window.CHIEATS_KIT_TAG_TEST) || "25916705";
  var box = document.getElementById('alert');
  if (!box) return;
  if (!/^\d+$/.test(String(TAG))) { box.setAttribute('data-disabled', '1'); box.hidden = true; return; }
  var f = document.getElementById('signup-form'), msg = document.getElementById('signup-msg');
  f.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = document.getElementById('signup-email').value.trim();
    var lic = document.getElementById('signup-license').value || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Please enter a valid email.'; return; }
    if (!/^\d{1,10}$/.test(lic)) { msg.textContent = 'Open a restaurant first.'; return; }
    var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing up...';
    try {
      var r = await fetch('https://api.convertkit.com/v3/tags/' + TAG + '/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: KIT_KEY, email: email, fields: { restaurant_license: lic } })
      });
      if (!r.ok) throw new Error('status ' + r.status);
      f.hidden = true;
      msg.innerHTML = "<b>You're in.</b> We'll email you when a new inspection for this restaurant shows up in the city's data.";
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Alert me';
      msg.textContent = "Sorry, that didn't go through. Please try again in a moment.";
    }
  });
})();
