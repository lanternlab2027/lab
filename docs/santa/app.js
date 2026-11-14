/* Organizer page. Matches never touch the DOM: they go straight from the draw into sealed links. */
(function () {
  'use strict';
  const S = window.SantaCore;
  const $ = id => document.getElementById(id);
  const STORE = 'santa.lastDraw.v1';
  const peopleEl = $('people'), exclEl = $('excls'), errEl = $('err');
  let state = null; // {group, links:[{name,url,sent}], me}

  // ---------- people inputs ----------
  function addPerson(val, focus) {
    const row = document.createElement('div'); row.className = 'person';
    row.innerHTML = '<span class="num"></span><input type="text" maxlength="40" autocapitalize="words" enterkeyhint="next"><button type="button" class="x" aria-label="Remove">&times;</button>';
    const inp = row.querySelector('input'); inp.value = val || '';
    inp.addEventListener('input', refreshNames);
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return; e.preventDefault();
      const rows = [...peopleEl.children], i = rows.indexOf(row);
      if (i === rows.length - 1) addPerson('', true); else rows[i + 1].querySelector('input').focus();
    });
    inp.addEventListener('paste', e => { // paste a whole list: one name per line or comma-separated
      const t = (e.clipboardData || window.clipboardData).getData('text');
      const parts = t.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
      if (parts.length < 2) return;
      e.preventDefault(); inp.value = parts.shift();
      let after = row;
      for (const p of parts) { const r = addPerson(p); peopleEl.insertBefore(r, after.nextSibling); after = r; }
      refreshNames();
    });
    row.querySelector('.x').addEventListener('click', () => {
      if (peopleEl.children.length <= 3) { inp.value = ''; inp.focus(); } else row.remove();
      refreshNames();
    });
    peopleEl.appendChild(row); renumber();
    if (focus) inp.focus();
    return row;
  }
  function renumber() { [...peopleEl.children].forEach((r, i) => { r.querySelector('.num').textContent = i + 1; r.querySelector('input').placeholder = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Riley', 'Casey'][i] || 'Name'; r.querySelector('input').setAttribute('aria-label', 'Person ' + (i + 1)); }); }
  function names() { return [...peopleEl.querySelectorAll('input')].map(i => i.value.trim().replace(/\s+/g, ' ')).filter(Boolean); }

  function fillSelect(sel, list, keep, blank) {
    const cur = keep ? sel.value : '';
    sel.innerHTML = '';
    const o0 = document.createElement('option'); o0.value = ''; o0.textContent = blank; sel.appendChild(o0);
    for (const n of list) { const o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o); }
    if (list.includes(cur)) sel.value = cur;
  }
  function refreshNames() {
    renumber();
    const list = [...new Set(names())];
    fillSelect($('me'), list, true, 'Choose your name');
    exclEl.querySelectorAll('select').forEach(s => fillSelect(s, list, true, 'Choose'));
  }

  // ---------- exclusion pairs ----------
  function addExcl() {
    const row = document.createElement('div'); row.className = 'excl';
    row.innerHTML = '<select aria-label="First person"></select><span class="amp">&amp;</span><select aria-label="Second person"></select><button type="button" class="x" aria-label="Remove pair">&times;</button>';
    row.querySelector('.x').addEventListener('click', () => row.remove());
    exclEl.appendChild(row); refreshNames();
    row.querySelector('select').focus();
  }

  $('setup').addEventListener('input', () => errEl.classList.add('hidden'));
  $('setup').addEventListener('change', () => errEl.classList.add('hidden'));
  $('add-person').addEventListener('click', () => addPerson('', true));
  $('add-excl').addEventListener('click', addExcl);
  $('me-too').addEventListener('change', e => $('me-wrap').classList.toggle('hidden', !e.target.checked));
  for (let i = 0; i < 4; i++) addPerson('');
  refreshNames();

  // ---------- helpers ----------
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1800); }
  function showErr(msg) { errEl.textContent = msg; errEl.classList.remove('hidden'); errEl.scrollIntoView({block: 'center', behavior: 'smooth'}); }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* ignore */ } ta.remove(); return ok;
    }
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* private mode: fine */ } }
  // ?ref= passthrough (URL only): opened with ?ref=X, the links we generate carry ?ref=share-X
  // (then share2-X, share3-X...) so a later analytics pass can follow the chain. No ref -> share.
  function inRef() {
    let r = '';
    try { r = new URLSearchParams(location.search).get('ref') || ''; } catch (e) { r = ''; }
    return r.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  }
  function nextRef() {
    const r = inRef();
    if (!r) return 'share';
    const m = /^share(\d*)(?:-(.+))?$/.exec(r);
    if (m) return 'share' + ((m[1] ? +m[1] : 1) + 1) + (m[2] ? '-' + m[2] : '');
    return 'share-' + r;
  }
  const pageBase = () => new URL('go.html', location.href).href.split(/[?#]/)[0];
  const linkBase = () => pageBase() + '?ref=' + encodeURIComponent(nextRef());

  // "See what each person gets": a sealed sample link with made-up names, opened in a new tab.
  (async () => {
    const a = $('preview'); if (!a) return;
    const d = new Date(); d.setDate(d.getDate() + 21);
    const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const frag = await S.seal({k: 's', g: 'Sample group', n: 'Alex', t: 'Sam', b: '$30', d: iso, m: 'Wrapped, please! (This is a made-up example.)'}, 's1');
    a.href = pageBase() + '?preview=1' + (inRef() ? '&ref=' + encodeURIComponent(inRef()) : '') + '#' + frag;
    a.classList.remove('hidden');
  })();
  function message(l) {
    const g = state.group ? ' "' + state.group + '"' : '';
    return 'Hi ' + l.name + '! You\'re in our' + g + ' Secret Santa. Open your private link to see who you\'re buying for (it\'s only for you, so don\'t share it): ' + l.url;
  }

  // ---------- draw ----------
  $('setup').addEventListener('submit', async e => {
    e.preventDefault(); errEl.classList.add('hidden');
    const list = names();
    const lower = list.map(n => n.toLowerCase());
    const dup = list.find((n, i) => lower.indexOf(n.toLowerCase()) !== i);
    if (list.length < 3) return showErr('Add at least 3 people.');
    if (dup) return showErr('"' + dup + '" is listed twice. Add a last initial so everyone is unique.');
    if (list.length > 200) return showErr('That\'s a big group! Please keep it to 200 people.');
    const pairs = [];
    for (const row of exclEl.children) {
      const [a, b] = [...row.querySelectorAll('select')].map(s => s.value);
      if (!a && !b) continue;
      if (!a || !b) return showErr('Finish or remove the unfinished pair.');
      if (a === b) return showErr('A pair needs two different people.');
      pairs.push([list.indexOf(a), list.indexOf(b)]);
    }
    const meToo = $('me-too').checked, me = $('me').value;
    if (meToo && !list.includes(me)) return showErr('Choose which name is you, or untick "I\'m in the draw too".');
    const group = $('group').value.trim(), budget = $('budget').value.trim(), date = $('date').value, note = $('note').value.trim();

    let perm;
    try { perm = S.draw(list.length, pairs); }
    catch (err) {
      if (err instanceof S.DrawError) {
        let msg = err.message;
        if (err.who !== null) msg = list[err.who] + ' is paired with everyone, so they can\'t draw anyone. Remove a pair.';
        else if (/no valid way/.test(msg)) msg = 'Those pairs make a fair draw impossible: there\'s no way for everyone to give and get exactly one gift. Remove a pair or add another person.';
        return showErr(msg);
      }
      throw err;
    }
    const base = linkBase(), links = [];
    for (let g = 0; g < list.length; g++) {
      const frag = await S.seal({k: 's', g: group, n: list[g], t: list[perm[g]], b: budget, d: date, m: note}, 's1');
      links.push({name: list[g], url: base + '#' + frag, sent: false});
    }
    perm = null; // drop the only plaintext copy
    state = {group, links, me: meToo ? me : '', date};
    save(); renderResults(true);
  });

  // ---------- results ----------
  function renderResults(scroll) {
    $('setup').classList.add('hidden'); $('results').classList.remove('hidden');
    const r = $('remind'); if (state.date && !r.hasAttribute('data-disabled')) r.classList.remove('hidden');
    const others = state.links.filter(l => l.name !== state.me);
    $('res-title').textContent = state.group ? state.group + ': names drawn!' : 'Names drawn!';
    $('res-sub').textContent = state.links.length + ' private links are ready. Send each person their own link' + (state.me ? ', then open yours.' : '.');
    const my = $('my-link'); my.innerHTML = '';
    if (state.me) {
      const l = state.links.find(x => x.name === state.me);
      my.className = 'link-row me'; my.style.marginTop = '14px';
      my.innerHTML = '<div class="link-head"><b></b><span class="status">Your link</span></div><a class="btn pine" style="width:100%" target="_blank" rel="noopener">Open my link</a>';
      my.querySelector('b').textContent = l.name + ' (you)';
      my.querySelector('a').href = l.url;
    } else my.className = 'hidden';
    const ul = $('links'); ul.innerHTML = '';
    for (const l of others) ul.appendChild(row(l));
    if (scroll) $('results').scrollIntoView({behavior: 'smooth', block: 'start'});
  }
  function row(l) {
    const li = document.createElement('li'); li.className = 'link-row' + (l.sent ? ' sent' : '');
    li.innerHTML = '<div class="link-head"><b></b><span class="status"></span></div><div class="acts"></div>';
    li.querySelector('b').textContent = l.name;
    const st = li.querySelector('.status'); const mark = how => { l.sent = how; save(); li.classList.add('sent'); st.textContent = how; };
    st.textContent = l.sent || 'Not sent yet';
    const acts = li.querySelector('.acts');
    const subj = 'Your Secret Santa link' + (state.group ? ' (' + state.group + ')' : '');
    const mk = (tag, label, fn) => { const b = document.createElement(tag); b.className = 'btn'; b.textContent = label; if (tag === 'button') b.type = 'button'; acts.appendChild(b); if (fn) b.addEventListener('click', fn); return b; };
    if (navigator.share) mk('button', 'Share', async () => { try { await navigator.share({title: subj, text: message(l).replace(l.url, '').trim(), url: l.url}); mark('Shared'); } catch (e) { /* cancelled */ } });
    mk('button', 'Copy', async () => { if (await copy(message(l))) { mark('Copied'); toast('Copied ' + l.name + '\'s message + link'); } else toast('Couldn\'t copy. Long-press the link instead.'); });
    const sms = mk('a', 'Text'); sms.href = 'sms:?&body=' + encodeURIComponent(message(l)); sms.addEventListener('click', () => mark('Texted'));
    const em = mk('a', 'Email'); em.href = 'mailto:?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(message(l)); em.addEventListener('click', () => mark('Emailed'));
    if (acts.children.length === 3) acts.classList.add('three');
    return li;
  }
  $('copy-all').addEventListener('click', async () => {
    const txt = (state.group ? state.group + ' Secret Santa links\n\n' : 'Secret Santa links\n\n') + state.links.map(l => l.name + ': ' + l.url).join('\n\n');
    toast(await copy(txt) ? 'All links copied' : 'Couldn\'t copy');
  });
  $('redraw').addEventListener('click', () => {
    if (!confirm('Start over? Links you already sent will still open their old match, so you\'d need to send everyone new links.')) return;
    state = null; try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
    $('results').classList.add('hidden'); $('remind').classList.add('hidden'); $('setup').classList.remove('hidden');
    window.scrollTo({top: 0, behavior: 'smooth'});
  });
  window.addEventListener('beforeunload', e => { if (state && state.links.some(l => !l.sent)) { e.preventDefault(); e.returnValue = ''; } });

  // Restore an unfinished draw from this device (names + sealed links only).
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && saved.links && saved.links.length) { state = saved; renderResults(false); }
  } catch (e) { /* ignore */ }
})();
