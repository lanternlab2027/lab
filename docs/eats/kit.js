/* Optional grade-change alert signup (Kit v3 tag subscribe), same pattern as docs/ll97.
   Sends only the email and the restaurant's CAMIS ID (custom field restaurant_camis).
   TAG is a placeholder until a Kit tag is created; while it isn't numeric the box stays hidden. */
(function () {
  'use strict';
  var KIT_KEY = "9OgTfHEbtX6FB0NWVjkgyg";
  var TAG = (typeof window !== 'undefined' && window.EATS_KIT_TAG_TEST) || "25882781";
  var box = document.getElementById('alert');
  if (!box) return;
  if (!/^\d+$/.test(String(TAG))) { box.setAttribute('data-disabled', '1'); box.hidden = true; return; }
  var f = document.getElementById('signup-form'), msg = document.getElementById('signup-msg');
  f.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = document.getElementById('signup-email').value.trim();
    var camis = document.getElementById('signup-camis').value || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Please enter a valid email.'; return; }
    if (!/^\d{5,10}$/.test(camis)) { msg.textContent = 'Open a restaurant first.'; return; }
    var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing up...';
    try {
      var r = await fetch('https://api.convertkit.com/v3/tags/' + TAG + '/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: KIT_KEY, email: email, fields: { restaurant_camis: camis } })
      });
      if (!r.ok) throw new Error('status ' + r.status);
      f.hidden = true;
      msg.innerHTML = "<b>You're in.</b> We'll email you if this restaurant's grade changes in the city's data.";
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Alert me';
      msg.textContent = "Sorry, that didn't go through. Please try again in a moment.";
    }
  });
})();
