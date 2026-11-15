(function () {
  'use strict';
  // ---- per-site config ----
  var CONFIG = {
    code: 'FPCES', storePrefix: 'fpcpractice', shortTitle: 'Protección de Alimentos de NYC',
    subtitle: function (d) { return 'El examen final real del DOHMH tiene 50 preguntas de opción múltiple en una hora, y necesita 70% para aprobar. Este banco tiene ' + d.questions.length + ' preguntas.'; },
    passText: '70%, o sea 35 de 50',
    mocks: [{ label: 'Examen de práctica', n: 50, minutes: 60 }],
    mockNote: 'El examen de práctica es como el real: 50 preguntas con un reloj de 60 minutos.'
  };
  var EXAMS = [CONFIG.code];
  var FREE_COUNT = 10;
  // Kit (ConvertKit) v3 tag-subscribe. Replace TAGID_FOOD_ES with the Spanish list's Kit tag ID.
  var KIT_URL = 'https://api.convertkit.com/v3/tags/25845321/subscribe';
  var KIT_KEY = '9OgTfHEbtX6FB0NWVjkgyg';

  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var examCode = (params.get('exam') || CONFIG.code).toUpperCase();
  var bank = null;
  var PASS = 0.7;
  var run = null; // {mode, mock, items, i, answers[], timerId, deadline}

  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; }
  }
  function unlockKey() { return CONFIG.storePrefix + '_unlocked_' + examCode; }
  function isUnlocked() { return store(unlockKey()) === '1'; }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function show(id, on) { $(id).classList.toggle('hidden', !on); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function pct(x) { return Math.round(100 * x); }

  function citeHTML(q) {
    var s = q.source;
    var href = s.url + (s.page ? '#page=' + s.page : '');
    var label = esc(s.title) + (s.page ? ', página ' + s.page + ' del PDF' : '');
    var pre = s.lang === 'en' ? 'Fuente (inglés): ' : 'Fuente: ';
    return '<div class="cite" style="margin-top:8px">' + pre + '<a href="' + esc(href) +
      '" target="_blank" rel="noopener">' + label + '</a></div>' +
      '<blockquote' + (s.lang === 'en' ? ' lang="en"' : '') + '>“' + esc(s.quote) + '”</blockquote>';
  }

  function fail(msg) {
    $('title').textContent = 'No se encontró la prueba';
    $('error').innerHTML = '<p>' + msg + '</p><p><a class="btn" href="index.html">Volver a la página del examen</a></p>';
    show('error', true);
  }

  function init() {
    if (EXAMS.indexOf(examCode) < 0) return fail('Esa prueba de práctica no existe en este sitio.');
    fetch('questions/' + examCode + '.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        bank = d;
        PASS = d.real_exam_pass / d.real_exam_questions;
        document.title = 'Examen de práctica: ' + CONFIG.shortTitle;
        $('title').textContent = 'Examen de práctica de ' + CONFIG.shortTitle;
        $('subtitle').textContent = CONFIG.subtitle(d);
        $('gateTitle').textContent = 'Desbloquee las ' + d.questions.length + ' preguntas y el examen de práctica con reloj';
        if (isUnlocked()) showUnlocked(); else startRun('free');
      })
      .catch(function () { fail('No se pudieron cargar las preguntas. Vuelva a cargar la página.'); });
  }

  // ---- runner ----
  function startRun(mode, mockIdx) {
    var qs = shuffle(bank.questions);
    var mock = mode === 'mock' ? CONFIG.mocks[mockIdx || 0] : null;
    if (mode === 'free') qs = qs.slice(0, FREE_COUNT);
    if (mock) qs = qs.slice(0, Math.min(mock.n, qs.length));
    run = { mode: mode, mock: mock, items: qs.map(function (q) { return { q: q, order: shuffle([0, 1, 2, 3]) }; }), i: 0, answers: [] };
    ['results', 'gate', 'unlocked', 'review'].forEach(function (id) { show(id, false); });
    show('runner', true);
    $('qmode').textContent = mode === 'free' ? 'Muestra gratis' : mock ? mock.label : 'Práctica completa';
    show('finishEarly', !!mock);
    if (mock) startTimer(mock.minutes * 60); else stopTimer();
    renderQ();
    $('runner').scrollIntoView({ block: 'start' });
  }

  function renderQ() {
    var it = run.items[run.i], q = it.q, n = run.items.length;
    $('qcount').textContent = 'Pregunta ' + (run.i + 1) + ' de ' + n;
    $('qtopic').textContent = q.topic || '';
    $('bar').style.width = (100 * run.i / n) + '%';
    $('qtext').textContent = q.question;
    var ul = $('opts'); ul.innerHTML = '';
    it.order.forEach(function (oi, pos) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.className = 'opt'; b.type = 'button'; b.dataset.oi = oi;
      if (run.answers[run.i] === oi && run.mock) b.classList.add('picked');
      b.innerHTML = '<span class="k">' + 'ABCD'[pos] + '</span><span>' + esc(q.options[oi]) + '</span>';
      b.addEventListener('click', function () { pick(oi); });
      li.appendChild(b); ul.appendChild(li);
    });
    show('feedback', false);
    $('next').disabled = !(run.mock && run.answers[run.i] !== undefined);
    $('next').textContent = run.i === n - 1 ? (run.mock ? 'Terminar el examen' : 'Ver mi resultado') : 'Siguiente pregunta';
  }

  function pick(oi) {
    var it = run.items[run.i], q = it.q;
    if (!run.mock && run.answers[run.i] !== undefined) return;
    run.answers[run.i] = oi;
    var buttons = $('opts').querySelectorAll('.opt');
    if (run.mock) {
      buttons.forEach(function (b) { b.classList.toggle('picked', +b.dataset.oi === oi); });
      $('next').disabled = false;
      return;
    }
    var right = oi === q.answer;
    buttons.forEach(function (b) {
      var k = +b.dataset.oi; b.disabled = true;
      if (k === q.answer) b.classList.add('correct');
      else if (k === oi) b.classList.add('wrong');
    });
    var fb = $('feedback');
    fb.innerHTML = '<div class="verdict ' + (right ? 'ok">¡Correcto!' : 'bad">No es correcto. La respuesta es: ' + esc(q.options[q.answer])) +
      '</div><div>' + esc(q.explanation) + '</div>' + citeHTML(q);
    show('feedback', true);
    $('next').disabled = false;
    $('next').focus({ preventScroll: true });
  }

  $('next').addEventListener('click', function () {
    if (run.i < run.items.length - 1) { run.i++; renderQ(); window.scrollTo({ top: $('runner').offsetTop - 8 }); }
    else finish(false);
  });
  $('finishEarly').addEventListener('click', function () {
    if (confirm('¿Terminar el examen ahora? Las preguntas sin contestar cuentan como incorrectas.')) finish(false);
  });

  function score() {
    var c = 0; run.items.forEach(function (it, i) { if (run.answers[i] === it.q.answer) c++; });
    return c;
  }

  function finish(timedOut) {
    stopTimer();
    show('runner', false);
    var c = score(), n = run.items.length, p = pct(c / n);
    $('resScore').textContent = c + ' / ' + n;
    var txt;
    if (run.mock) {
      txt = (timedOut ? 'Se acabó el tiempo. ' : '') + p + '%: ' + (c / n >= PASS
        ? 'con esto aprobaría (' + CONFIG.passText + ').'
        : 'no alcanza para aprobar (' + CONFIG.passText + '). Repase las explicaciones de abajo e inténtelo otra vez.');
    } else {
      txt = p + '% de respuestas correctas.' + (run.mode === 'free' ? ' Esa fue la muestra gratis de 10 preguntas.' : '');
    }
    $('resText').textContent = txt;
    show('results', true);
    if (run.mock) renderReview();
    if (run.mode === 'free' && !isUnlocked()) show('gate', true);
    else showUnlocked(true);
    $('results').scrollIntoView({ block: 'start' });
  }

  function renderReview() {
    var ol = $('reviewList'); ol.innerHTML = '';
    run.items.forEach(function (it, i) {
      var q = it.q, a = run.answers[i], right = a === q.answer;
      var li = document.createElement('li');
      li.innerHTML = '<strong>' + esc(q.question) + '</strong><div class="verdict ' + (right ? 'ok' : 'bad') + '">' +
        (right ? 'Correcto' : (a === undefined ? 'Sin contestar' : 'Usted eligió: ' + esc(q.options[a]))) + '</div>' +
        '<div>Respuesta: ' + esc(q.options[q.answer]) + '</div><div class="small">' + esc(q.explanation) + '</div>' + citeHTML(q);
      ol.appendChild(li);
    });
    show('review', true);
  }

  // ---- timer ----
  function startTimer(secs) {
    stopTimer();
    run.deadline = Date.now() + secs * 1000;
    show('timer', true);
    var tick = function () {
      var left = Math.max(0, Math.round((run.deadline - Date.now()) / 1000));
      var h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
      $('timer').textContent = (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
      $('timer').classList.toggle('low', left <= 120);
      if (left <= 0) finish(true);
    };
    tick();
    run.timerId = setInterval(tick, 1000);
  }
  function stopTimer() { if (run && run.timerId) { clearInterval(run.timerId); run.timerId = null; } show('timer', false); }

  // ---- unlocked ----
  function showUnlocked(afterRun) {
    $('unlockedText').textContent = 'Practique las ' + bank.questions.length + ' preguntas con la respuesta al momento, o haga un examen de práctica con reloj. ' + CONFIG.mockNote;
    var box = $('mockButtons'); box.innerHTML = '';
    CONFIG.mocks.forEach(function (m, idx) {
      var b = document.createElement('button');
      b.className = 'btn secondary'; b.type = 'button';
      b.textContent = m.label + ': ' + Math.min(m.n, bank.questions.length) + ' preguntas, ' + m.minutes + ' min';
      b.addEventListener('click', function () { startRun('mock', idx); });
      box.appendChild(b);
    });
    show('unlocked', true);
    if (!afterRun) show('runner', false);
  }
  $('startAll').addEventListener('click', function () { startRun('all'); });

  // ---- email gate (Kit) ----
  $('gateForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('email').value.trim();
    var msg = $('gateMsg');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.className = 'msg err'; msg.textContent = 'Escriba un correo electrónico válido.'; return; }
    $('gateBtn').disabled = true; msg.className = 'msg'; msg.textContent = 'Desbloqueando…';
    var notConfigured = KIT_URL.indexOf('TAGID_') >= 0;
    fetch(KIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: KIT_KEY, email: email, fields: { exam_code: examCode } })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      unlock();
    }).catch(function (err) {
      if (notConfigured) {
        // Kit tag placeholder not filled in yet, so unlock anyway (honor system).
        if (window.console) console.warn('Kit signup not configured (' + err.message + '); unlocking locally.');
        unlock();
      } else {
        $('gateBtn').disabled = false;
        msg.className = 'msg err'; msg.textContent = 'Lo sentimos, no pudimos registrarlo en este momento. Inténtelo otra vez.';
      }
    });
  });
  function unlock() {
    store(unlockKey(), '1');
    $('gateMsg').textContent = '';
    show('gate', false);
    showUnlocked(true);
    $('unlocked').scrollIntoView({ block: 'start' });
  }

  init();
})();
