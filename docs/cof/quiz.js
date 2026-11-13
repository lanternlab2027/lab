(function () {
  'use strict';
  var EXAMS = ['F-01', 'F-03', 'F-60', 'S-95'];
  var FREE_COUNT = 10;
  var PASS = 0.7;
  var KIT_URL = 'https://api.convertkit.com/v3/tags/25838722/subscribe';
  var KIT_KEY = '9OgTfHEbtX6FB0NWVjkgyg';

  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var examCode = (params.get('exam') || '').toUpperCase();
  var bank = null;
  var run = null; // {mode, items, i, answers[], timerId, deadline}

  function store(key, val) {
    try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; }
  }
  function unlockKey() { return 'cofpractice_unlocked_' + examCode; }
  function isUnlocked() { return store(unlockKey()) === '1'; }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function show(id, on) { $(id).classList.toggle('hidden', !on); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function citeHTML(q) {
    var s = q.source;
    return '<div class="cite" style="margin-top:8px">Source: <a href="' + esc(s.url) + '#page=' + s.page +
      '" target="_blank" rel="noopener">official ' + esc(examCode) + ' study booklet, PDF page ' + s.page + '</a></div>' +
      '<blockquote>“' + esc(s.quote) + '”</blockquote>';
  }

  function fail(msg) {
    $('title').textContent = 'Practice test not found';
    $('error').innerHTML = '<p>' + msg + '</p><p><a class="btn" href="index.html">See all exams</a></p>';
    show('error', true);
  }

  function init() {
    if (EXAMS.indexOf(examCode) < 0) return fail('Choose an exam from the list to start practicing.');
    fetch('questions/' + examCode + '.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        bank = d;
        document.title = examCode + ' Practice Test';
        $('title').textContent = examCode + ' ' + d.title + ' practice test';
        $('subtitle').textContent = 'The real exam has ' + d.real_exam_questions + ' questions with a ' +
          d.real_exam_minutes + '-minute time limit, and you need 70% to pass. This bank has ' + d.questions.length + ' questions.';
        $('pdflink').href = d.source_pdf;
        $('gateTitle').textContent = 'Unlock all ' + d.questions.length + ' questions + timed mock exam';
        if (isUnlocked()) showUnlocked(); else startRun('free');
      })
      .catch(function () { fail('The question bank could not be loaded. Please reload the page.'); });
  }

  // ---- runner ----
  function startRun(mode) {
    var qs = shuffle(bank.questions);
    if (mode === 'free') qs = qs.slice(0, FREE_COUNT);
    if (mode === 'mock') qs = qs.slice(0, Math.min(bank.real_exam_questions, qs.length));
    run = { mode: mode, items: qs.map(function (q) { return { q: q, order: shuffle([0, 1, 2, 3]) }; }), i: 0, answers: [] };
    ['results', 'gate', 'unlocked', 'review'].forEach(function (id) { show(id, false); });
    show('runner', true);
    $('qmode').textContent = mode === 'free' ? 'Free sample' : mode === 'mock' ? 'Timed mock exam' : 'Full practice';
    show('finishEarly', mode === 'mock');
    if (mode === 'mock') startTimer(bank.real_exam_minutes * 60); else stopTimer();
    renderQ();
    $('runner').scrollIntoView({ block: 'start' });
  }

  function renderQ() {
    var it = run.items[run.i], q = it.q, n = run.items.length;
    $('qcount').textContent = 'Question ' + (run.i + 1) + ' of ' + n;
    $('bar').style.width = (100 * run.i / n) + '%';
    $('qtext').textContent = q.question;
    var ul = $('opts'); ul.innerHTML = '';
    it.order.forEach(function (oi, pos) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.className = 'opt'; b.type = 'button'; b.dataset.oi = oi;
      b.innerHTML = '<span class="k">' + 'ABCD'[pos] + '</span><span>' + esc(q.options[oi]) + '</span>';
      b.addEventListener('click', function () { pick(oi); });
      li.appendChild(b); ul.appendChild(li);
    });
    show('feedback', false);
    $('next').disabled = true;
    $('next').textContent = run.i === n - 1 ? (run.mode === 'mock' ? 'Finish exam' : 'See my score') : 'Next question';
  }

  function pick(oi) {
    var it = run.items[run.i], q = it.q;
    run.answers[run.i] = oi;
    var buttons = $('opts').querySelectorAll('.opt');
    if (run.mode === 'mock') {
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
    fb.innerHTML = '<div class="verdict ' + (right ? 'ok">Correct.' : 'bad">Not quite. The answer is: ' + esc(q.options[q.answer])) +
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
    if (confirm('Finish the exam now? Unanswered questions count as wrong.')) finish(false);
  });

  function score() {
    var c = 0; run.items.forEach(function (it, i) { if (run.answers[i] === it.q.answer) c++; });
    return c;
  }

  function finish(timedOut) {
    stopTimer();
    show('runner', false);
    var c = score(), n = run.items.length, pct = Math.round(100 * c / n);
    $('resScore').textContent = c + ' / ' + n;
    var txt;
    if (run.mode === 'mock') {
      txt = (timedOut ? 'Time is up. ' : '') + pct + '%: ' + (c / n >= PASS ? 'that would be a pass (70% needed).' : 'below the 70% needed to pass. Review the explanations below and try again.');
    } else {
      txt = pct + '% correct.' + (run.mode === 'free' ? ' That was the free 10-question sample.' : '');
    }
    $('resText').textContent = txt;
    show('results', true);
    if (run.mode === 'mock') renderReview();
    if (run.mode === 'free' && !isUnlocked()) show('gate', true);
    else showUnlocked(true);
    $('results').scrollIntoView({ block: 'start' });
  }

  function renderReview() {
    var ol = $('reviewList'); ol.innerHTML = '';
    run.items.forEach(function (it, i) {
      var q = it.q, a = run.answers[i], right = a === q.answer;
      var li = document.createElement('li');
      li.innerHTML = '<strong>' + esc(q.question) + '</strong><div class="verdict ' + (right ? 'ok' : 'bad') + '" style="font-weight:600;color:var(--' + (right ? 'ok' : 'bad') + ')">' +
        (right ? 'Correct' : (a === undefined ? 'Not answered' : 'You chose: ' + esc(q.options[a]))) + '</div>' +
        '<div>Answer: ' + esc(q.options[q.answer]) + '</div><div class="small">' + esc(q.explanation) + '</div>' + citeHTML(q);
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
      var m = Math.floor(left / 60), s = left % 60;
      $('timer').textContent = m + ':' + (s < 10 ? '0' : '') + s;
      $('timer').classList.toggle('low', left <= 120);
      if (left <= 0) finish(true);
    };
    tick();
    run.timerId = setInterval(tick, 1000);
  }
  function stopTimer() { if (run && run.timerId) { clearInterval(run.timerId); run.timerId = null; } show('timer', false); }

  // ---- unlocked ----
  function showUnlocked(afterRun) {
    $('unlockedText').textContent = 'Practice all ' + bank.questions.length + ' questions with instant feedback, or take a ' +
      bank.real_exam_questions + '-question mock exam with a ' + bank.real_exam_minutes + '-minute timer, just like the real ' + examCode + '.';
    show('unlocked', true);
    if (!afterRun) show('runner', false);
  }
  $('startAll').addEventListener('click', function () { startRun('all'); });
  $('startMock').addEventListener('click', function () { startRun('mock'); });

  // ---- email gate (Kit) ----
  $('gateForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('email').value.trim();
    var msg = $('gateMsg');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.className = 'msg err'; msg.textContent = 'Please enter a valid email address.'; return; }
    $('gateBtn').disabled = true; msg.className = 'msg'; msg.textContent = 'Unlocking…';
    var notConfigured = KIT_KEY === 'KIT_' + 'PUBLIC_KEY' || KIT_URL.indexOf('/25838722/') > -1;
    fetch(KIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: KIT_KEY, email: email, fields: { building_address: examCode } })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      unlock();
    }).catch(function (err) {
      if (notConfigured) {
        // PoC: Kit placeholders not filled in yet, so unlock anyway (honor system).
        if (window.console) console.warn('Kit signup not configured (' + err.message + '); unlocking locally.');
        unlock();
      } else {
        $('gateBtn').disabled = false;
        msg.className = 'msg err'; msg.textContent = 'Sorry, we could not sign you up just now. Please try again.';
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
