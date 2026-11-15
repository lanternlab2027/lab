// Apps hub: optional "new app drops" email signup. Sends only the email address to Kit.
// Same pattern and public form api_key as docs/reading/app.js. TAG is a placeholder until a Kit tag exists.
(function () {
  var KIT_KEY = '9OgTfHEbtX6FB0NWVjkgyg'; var TAG = '25915600';
  var f = document.getElementById('signup-form');
  var msg = document.getElementById('signup-msg');
  if (!f) return;
  f.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = document.getElementById('signup-email').value.trim();
    var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing up...';
    try {
      var r = await fetch('https://api.convertkit.com/v3/tags/' + TAG + '/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: KIT_KEY, email: email })
      });
      if (!r.ok) throw new Error('status ' + r.status);
      f.innerHTML = "<b>You're on the list.</b> We'll email you when the next app drops.";
      msg.textContent = '';
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Notify me';
      msg.textContent = "Sorry, that didn't go through. Please try again in a moment.";
    }
  });
})();
