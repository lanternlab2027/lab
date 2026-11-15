/* Optional "Remind me on Selection Sunday" signup (Kit v3 tag subscribe), same pattern as docs/eats/kit.js.
   Sends only the email. TAG is a placeholder until a Kit tag is created; while it isn't numeric the box stays hidden. */
(function () {
  'use strict';
  var KIT_KEY = "9OgTfHEbtX6FB0NWVjkgyg";
  var TAG = (typeof window !== 'undefined' && window.BRACKET_KIT_TAG_TEST) || "25924445";
  var box = document.getElementById('remind');
  if (!box) return;
  if (!/^\d+$/.test(String(TAG))) { box.setAttribute('data-disabled', '1'); box.hidden = true; return; }
  box.hidden = false;
  var f = document.getElementById('remind-form'), msg = document.getElementById('remind-msg');
  f.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = document.getElementById('remind-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Please enter a valid email.'; return; }
    var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing up...';
    try {
      var r = await fetch('https://api.convertkit.com/v3/tags/' + TAG + '/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: KIT_KEY, email: email })
      });
      if (!r.ok) throw new Error('status ' + r.status);
      f.hidden = true;
      msg.innerHTML = "<b>You're in.</b> We'll email you on Selection Sunday, March 14, 2027, when the field is posted and the bracket fills in.";
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Remind me';
      msg.textContent = "Sorry, that didn't go through. Please try again in a moment.";
    }
  });
})();
