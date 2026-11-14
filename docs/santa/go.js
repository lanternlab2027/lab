/* Reveal page: decrypts the #fragment locally. Nothing is fetched or sent. */
(function () {
  'use strict';
  const S = window.SantaCore;
  const $ = id => document.getElementById(id);
  const show = id => $(id).classList.remove('hidden');
  const hide = id => $(id).classList.add('hidden');
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1800); }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* ignore */ } ta.remove(); return ok;
    }
  }
  function parseDate(d) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function dateText(d) {
    const dt = parseDate(d); if (!dt) return '';
    const opt = {weekday: 'short', month: 'short', day: 'numeric'}; if (dt.getFullYear() !== new Date().getFullYear()) opt.year = 'numeric';
    const s = dt.toLocaleDateString(undefined, opt);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((dt - today) / 864e5);
    return s + (days > 1 ? '\n' + days + ' days to go' : days === 1 ? '\nTomorrow!' : days === 0 ? '\nToday!' : '');
  }
  function fact(label, value, wide) {
    const f = document.createElement('div'); f.className = 'fact' + (wide ? ' wide' : '');
    f.innerHTML = '<small></small><span></span>'; f.querySelector('small').textContent = label; f.querySelector('span').textContent = value;
    return f;
  }
  // Text with http(s) links made clickable, built with DOM nodes (no innerHTML).
  function linkify(el, text) {
    const re = /\bhttps?:\/\/[^\s<>"']+/g; let last = 0, m;
    while ((m = re.exec(text))) {
      el.appendChild(document.createTextNode(text.slice(last, m.index)));
      let url = m[0].replace(/[.,;:!?)]+$/, '');
      const a = document.createElement('a'); a.href = url; a.textContent = url; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
      el.appendChild(a); last = m.index + url.length; re.lastIndex = last;
    }
    el.appendChild(document.createTextNode(text.slice(last)));
  }

  // ---------- confetti ----------
  function confetti() {
    if (reduce) return;
    const c = $('confetti'), ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
    const W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr;
    c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
    const cols = ['#b8283a', '#e6b85c', '#0f4a37', '#5fc79c', '#ffffff', '#d63c4f'];
    const ps = Array.from({length: 140}, () => ({
      x: W / 2 + (Math.random() - .5) * W * .2, y: H * .38, vx: (Math.random() - .5) * 16 * dpr, vy: (-Math.random() * 15 - 6) * dpr,
      w: (6 + Math.random() * 6) * dpr, h: (8 + Math.random() * 8) * dpr, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[(Math.random() * cols.length) | 0]
    }));
    const t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.vy += .45 * dpr; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); ctx.restore();
      }
      if (t - t0 < 3200) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    })(t0);
  }

  // ---------- secret ----------
  function renderSecret(d) {
    document.title = 'Secret Santa for ' + d.n;
    if (d.g) $('grp-pill').textContent = d.g;
    $('who').textContent = d.n;
    $('unwrap').textContent = 'I\'m ' + d.n + ', unwrap it';
    $('notyou').textContent = 'Not ' + d.n + '? Please close this page. No peeking!';
    $('target').textContent = d.t;
    const facts = $('facts');
    const solo = !(d.b && parseDate(d.d)); // budget and date share a row only when both exist
    if (d.b) facts.appendChild(fact('Budget', d.b, solo));
    if (parseDate(d.d)) facts.appendChild(fact('Exchange', dateText(d.d), solo));
    if (d.m) facts.appendChild(fact('Note from the organizer', d.m, true));
    if (!facts.children.length) facts.classList.add('hidden');
    if (!parseDate(d.d)) $('cal-bar').classList.add('hidden');
    $('cal').addEventListener('click', () => {
      const name = d.g ? d.g + ' Secret Santa' : 'Secret Santa exchange';
      const desc = 'You\'re buying for ' + d.t + '.' + (d.b ? '\nBudget: ' + d.b : '') + (d.m ? '\n\n' + d.m : '') + '\n\nYour link: ' + location.href;
      const ics = S.makeIcs({date: d.d, title: name, description: desc});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([ics], {type: 'text/calendar;charset=utf-8'}));
      a.download = 'secret-santa.ics'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
    const gift = $('gift');
    let opened = false;
    function unwrap() {
      if (opened) return; opened = true;
      gift.classList.remove('idle'); gift.classList.add('shake');
      $('unwrap').disabled = true;
      setTimeout(() => {
        gift.classList.remove('shake'); gift.classList.add('open');
        setTimeout(() => {
          hide('gate'); $('reveal').classList.add('show'); confetti();
          $('wish-make').classList.remove('hidden');
        }, reduce ? 0 : 650);
      }, reduce ? 0 : 560);
    }
    $('unwrap').addEventListener('click', unwrap);
    gift.addEventListener('click', unwrap);
    gift.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); unwrap(); } });
    show('secret');

    // wishlist maker
    $('wish-go').addEventListener('click', async () => {
      const w = $('wish-text').value.trim();
      if (!w) { $('wish-text').focus(); return toast('Write a wish or two first'); }
      const url = new URL('go.html', location.href).href.split('#')[0] + '#' + await S.seal({k: 'w', g: d.g || '', n: d.n, w}, 'w1');
      const msg = d.n + '\'s Secret Santa wishlist' + (d.g ? ' (' + d.g + ')' : '') + ': ' + url;
      const acts = $('wish-acts'); acts.innerHTML = '';
      const mk = (tag, label) => { const b = document.createElement(tag); b.className = 'btn'; b.textContent = label; if (tag === 'button') b.type = 'button'; acts.appendChild(b); return b; };
      if (navigator.share) mk('button', 'Share').addEventListener('click', () => navigator.share({title: d.n + '\'s wishlist', url}).catch(() => {}));
      mk('button', 'Copy').addEventListener('click', async () => toast(await copy(msg) ? 'Wishlist link copied' : 'Couldn\'t copy'));
      mk('a', 'Text').href = 'sms:?&body=' + encodeURIComponent(msg);
      if (!navigator.share) mk('a', 'Email').href = 'mailto:?subject=' + encodeURIComponent(d.n + '\'s Secret Santa wishlist') + '&body=' + encodeURIComponent(msg);
      acts.dataset.url = url;
      show('wish-out');
    });
  }

  function renderWish(d) {
    document.title = d.n + '\'s Secret Santa wishlist';
    if (d.g) $('grp-pill').textContent = d.g;
    $('wish-kicker').textContent = d.g ? d.g + ' wishlist' : 'Secret Santa wishlist';
    $('wish-title').textContent = d.n + '\'s wishlist';
    linkify($('wish-body'), d.w);
    show('wish');
  }

  async function init() {
    const frag = location.hash.slice(1);
    hide('loading');
    if (!frag) { $('bad-why').textContent = 'This page opens private Secret Santa links, and this one is empty.'; return show('bad'); }
    try {
      const {prefix, data} = await S.open(frag);
      if (prefix === 's1' && data.k === 's' && data.n && data.t) return renderSecret(data);
      if (prefix === 'w1' && data.k === 'w' && data.n) return renderWish(data);
      throw new Error('This link isn\'t one we recognize.');
    } catch (e) {
      $('bad-why').textContent = e.message || 'This link was damaged.'; show('bad');
    }
  }
  window.addEventListener('hashchange', () => location.reload());
  init();
})();
