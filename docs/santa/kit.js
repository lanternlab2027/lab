(function(){
  // Optional reminder signup (Kit). Sends only the email and the exchange date, never names.
  var KIT_KEY = "9OgTfHEbtX6FB0NWVjkgyg"; var TAG = "25924128";
  var box = document.getElementById('remind');
  if (!/^\d+$/.test(TAG)) { box.setAttribute('data-disabled', '1'); return; } // not configured yet: keep hidden
  var f = document.getElementById('signup-form'), msg = document.getElementById('signup-msg');
  f.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = document.getElementById('signup-email').value.trim();
    var date = document.getElementById('date').value || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Please enter a valid email.'; return; }
    var btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Saving...';
    try {
      var r = await fetch('https://api.convertkit.com/v3/tags/' + TAG + '/subscribe', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({api_key: KIT_KEY, email: email, fields: {santa_exchange_date: date}})
      });
      if (!r.ok) throw new Error('status ' + r.status);
      f.outerHTML = '<div class="note ok" style="margin:0"><b>You\'re set.</b> We\'ll nudge you a week before the exchange.</div>';
      msg.textContent = '';
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Remind me';
      msg.textContent = "Sorry, that didn't go through. Please try again in a moment.";
    }
  });
})();
