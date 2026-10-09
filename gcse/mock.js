/* pyde GCSE layer: exam-conditions mock (Edexcel International GCSE 4CP0 Paper 2)
   ------------------------------------------------------------------------
   Turns the CODES workspace into a timed mock of the practical paper:
   - a countdown (3 hours by default) that survives a reload, with warnings
     at 30, 10 and 5 minutes;
   - aids the exam doesn't give you are hidden: Trace table, Pseudocode
     (Python) reference, Parsons, Tidy, share links, loading other files.
     Run, Debug, Save as and the scratch program stay, as an exam IDE has them;
   - when time is up (or the pupil finishes early) the editor locks and a
     "collect my files" summary checks every required file name - exact
     match, near misses (wrong case, missing .py, extra characters),
     unsaved edits that would be lost - and downloads My files as a .zip.

   Required names are read from the CODES files ("Save your amended code as
   Q01FINISHED ...") and can be edited before starting, because in the real
   paper they are printed in the question booklet.

   Self-contained: index.html only needs <script src="gcse/mock.js"> after
   workspace.js. State lives in localStorage like the rest of pyde. */
(function () {
  'use strict';

  const KEY = 'pyde-gcse-mock';
  const WARN_AT = [30, 10, 5];      // minutes left

  const CSS = `
  #mock-bar{ display:flex; align-items:center; gap:.8rem; padding:.35rem .9rem; background:#1d3557; color:#fff; font-size:.85rem; }
  #mock-bar.hidden{ display:none; }
  #mock-bar .clock{ font-family:'Fira Code',monospace; font-variant-numeric:tabular-nums; font-size:1.05rem; font-weight:600; letter-spacing:.03em; }
  #mock-bar.warn{ background:#9a5b00; }
  #mock-bar.urgent{ background:#b3261e; }
  #mock-bar.ended{ background:#3a3f4b; }
  #mock-bar .grow{ flex:1; opacity:.85; }
  #mock-bar button{ background:#fff; color:#1d3557; border:none; border-radius:4px; padding:.25rem .7rem; font-weight:700; cursor:pointer; font-size:.8rem; }
  body.mock-on #tidy-btn, body.mock-on #parsons-btn, body.mock-on #share-btn, body.mock-on #upload-btn,
  body.mock-on button[data-tab=trace], body.mock-on button[data-tab=pseudo],
  body.mock-on #ws-load-folder, body.mock-on #ws-load-zip, body.mock-on #ws-add, body.mock-on #ws-share,
  body.mock-on #ws-clear-codes, body.mock-on #ws-sample, body.mock-on #mock-btn,
  body.mock-on .ws-del{ display:none !important; }
  body.mock-ended #run-btn, body.mock-ended #debug-btn, body.mock-ended #ws-saveas-btn, body.mock-ended #ws-banner button,
  body.mock-ended #new-btn{ display:none !important; }
  .mock-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; z-index:1700; padding:1rem; }
  .mock-overlay.hidden{ display:none; }
  .mock-box{ background:var(--bg); color:var(--fg); border:1px solid var(--comment); border-radius:9px; width:min(560px,94vw); max-height:90vh; overflow:auto; padding:1.1rem 1.3rem; }
  .mock-box h2{ margin:0 0 .5rem; font-size:1.05rem; color:var(--purple); }
  .mock-box p, .mock-box li{ font-size:.85rem; line-height:1.5; }
  .mock-box ul{ margin:.2rem 0 .7rem; padding-left:1.2rem; }
  .mock-box label{ display:block; font-size:.8rem; color:var(--comment); margin:.6rem 0 .2rem; }
  .mock-box input, .mock-box textarea{ width:100%; box-sizing:border-box; background:var(--panel-bg); color:var(--fg); border:1px solid var(--comment);
    border-radius:4px; padding:.35rem .5rem; font-family:'Fira Code',monospace; font-size:.85rem; }
  .mock-box textarea{ min-height:5.5rem; resize:vertical; }
  .mock-box .row{ display:flex; gap:.5rem; justify-content:flex-end; margin-top:.9rem; flex-wrap:wrap; }
  .mock-box button{ background:var(--current-line); color:var(--fg); border:1px solid var(--comment); border-radius:5px; padding:.4rem .9rem; cursor:pointer; font-weight:600; }
  .mock-box button.primary{ background:var(--purple); color:var(--btn-text); border-color:var(--purple); }
  .mock-box .err{ color:var(--red); font-size:.8rem; min-height:1.1em; }
  table.mock-res{ width:100%; border-collapse:collapse; font-size:.82rem; margin:.3rem 0 .6rem; }
  table.mock-res td{ border-bottom:1px solid var(--border); padding:.3rem .4rem; vertical-align:top; }
  table.mock-res td.f{ font-family:'Fira Code',monospace; white-space:nowrap; }
  .ok{ color:var(--green); font-weight:700; } .bad{ color:var(--red); font-weight:700; } .meh{ color:var(--orange); font-weight:700; }
  `;

  let state = null;     // { endAt, startedAt, minutes, required: [...], ended: bool, endedAt }
  let tick = null;
  let warned = new Set();

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v !== null && v !== undefined) e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids) if (kid !== null && kid !== undefined) e.append(kid);
    return e;
  }
  const ws = () => window.pydeWorkspace;
  const save = () => { try { state ? localStorage.setItem(KEY, JSON.stringify(state)) : localStorage.removeItem(KEY); } catch (e) { /* ignore */ } };
  const fmt = (ms) => {
    const t = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  };

  /* ---------------- required names ---------------- */
  function detectRequired() {
    const names = [];
    for (const f of ws().files.filter(f => f.original && /\.py$/i.test(f.name))) {
      const m = f.content.match(/save\s+(?:your\s+)?(?:\w+\s+)?code\s+as\s+([A-Za-z0-9_\-]+)(\.py)?/i);
      if (m) names.push(m[1] + '.py');
    }
    return names;
  }
  const parseRequired = (text) => text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).map(n => (/\.[A-Za-z0-9]+$/.test(n) ? n : n + '.py'));

  /* ---------------- start ---------------- */
  function openStart() {
    if (!ws()) return;
    const originals = ws().files.filter(f => f.original);
    const box = document.getElementById('mock-start');
    box.querySelector('#mock-minutes').value = '180';
    box.querySelector('#mock-required').value = detectRequired().join('\n');
    box.querySelector('.err').textContent = originals.length ? '' : 'Load a CODES pack first (Files → Open CODES folder / .zip, or the practice pack).';
    box.querySelector('#mock-go').disabled = !originals.length;
    box.classList.remove('hidden');
  }

  function start(opts) {
    const minutes = Number(opts.minutes);
    if (!(minutes > 0)) return 'Enter a time in minutes.';
    const now = Date.now();
    state = { startedAt: now, endAt: now + minutes * 60000, minutes, required: opts.required || [], ended: false };
    warned = new Set(WARN_AT.filter(w => w >= minutes));   // no warnings that would fire immediately
    save();
    document.getElementById('mock-start').classList.add('hidden');
    applyMode();
    ws().showSide(true);
    const first = ws().files.find(f => f.original && /\.py$/i.test(f.name));
    if (first) ws().open(first.name);
    showToast('Mock started: ' + fmt(minutes * 60000) + '. Good luck!');
    return null;
  }

  /* ---------------- running ---------------- */
  function applyMode() {
    const on = !!state;
    document.body.classList.toggle('mock-on', on);
    document.body.classList.toggle('mock-ended', on && state.ended);
    document.getElementById('mock-bar').classList.toggle('hidden', !on);
    if (on && ['trace', 'pseudo'].some(t => !document.getElementById('tab-' + t)?.classList.contains('hidden'))) switchTab('console');
    editor.setOption('readOnly', on && state.ended ? 'nocursor' : false);
    clearInterval(tick);
    if (on && !state.ended) { tick = setInterval(update, 1000); }
    update();
  }

  function update() {
    if (!state) return;
    const bar = document.getElementById('mock-bar');
    const clock = bar.querySelector('.clock'), label = bar.querySelector('.grow'), btn = bar.querySelector('button');
    if (state.ended) {
      clock.textContent = 'Finished';
      label.textContent = 'Mock ended ' + new Date(state.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '. Editing is locked.';
      btn.textContent = 'Collect my files';
      bar.className = 'ended';
      return;
    }
    const left = state.endAt - Date.now();
    if (left <= 0) { finish(true); return; }
    clock.textContent = fmt(left);
    label.textContent = 'Mock exam – no internet, notes or saved snippets. Save each answer under the name the question gives.';
    btn.textContent = 'Finish early';
    const mins = left / 60000;
    bar.className = mins <= 5 ? 'urgent' : mins <= 30 ? 'warn' : '';
    for (const w of WARN_AT) {
      if (mins <= w && !warned.has(w)) { warned.add(w); showToast(w + ' minutes left. Check your files are saved with the right names.'); }
    }
  }

  function finish(timeUp) {
    if (!state || state.ended) return;
    state.ended = true;
    state.endedAt = Date.now();
    state.timeUp = !!timeUp;
    save();
    applyMode();
    showSummary();
  }

  /* ---------------- collect my files ---------------- */
  function nearMiss(required, mine) {
    const base = (n) => n.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[\s_\-]/g, '');
    const r = base(required);
    return mine.find(n => n !== required && (n.toLowerCase() === required.toLowerCase() || base(n) === r));
  }

  function showSummary() {
    if (!state) return;
    const files = ws().files;
    const mine = files.filter(f => !f.original).map(f => f.name);
    const unsaved = files.filter(f => ws().isDirty(f)).map(f => f.name);
    const box = document.getElementById('mock-summary');
    const body = box.querySelector('.body');
    body.innerHTML = '';
    const used = Math.min(state.endedAt || Date.now(), state.endAt) - state.startedAt;
    body.append(el('p', {}, (state.timeUp ? 'Time is up. ' : 'You finished early. ') + 'Time used: ' + fmt(used) + ' of ' + fmt(state.minutes * 60000) + '.'));

    let found = 0;
    if (state.required.length) {
      const table = el('table', { class: 'mock-res' });
      for (const req of state.required) {
        let status, note = '';
        if (mine.includes(req)) { status = el('span', { class: 'ok' }, '✓ saved'); found++; }
        else {
          const nm = nearMiss(req, mine);
          if (nm) { status = el('span', { class: 'meh' }, '⚠ wrong name'); note = 'You saved ' + nm + '. The question asks for ' + req + '; a marker may not find it.'; }
          else { status = el('span', { class: 'bad' }, '✗ missing'); note = 'No file with this name.'; }
        }
        table.append(el('tr', {}, el('td', { class: 'f' }, req), el('td', {}, status), el('td', {}, note)));
      }
      body.append(el('p', {}, el('strong', {}, found + ' of ' + state.required.length + ' required files saved with the right name.')), table);
    }
    const extra = mine.filter(n => !state.required.includes(n));
    if (extra.length) body.append(el('p', {}, 'Other files in My files: ', el('span', { style: 'font-family:\'Fira Code\',monospace' }, extra.join(', '))));
    if (unsaved.length) body.append(el('p', { class: 'bad' }, 'Unsaved changes in ' + unsaved.join(', ') + ' – in the exam these would be lost. Always use Save as.'));
    if (!mine.length) body.append(el('p', { class: 'bad' }, 'Nothing was saved in My files.'));
    body.append(el('p', {}, 'In the real exam your saved files are collected for you. Here, download them as a .zip to keep them or hand them to your teacher.'));
    box.classList.remove('hidden');
  }

  function zipName() {
    const d = new Date(state ? state.startedAt : Date.now());
    return 'mock-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.zip';
  }

  function endMock() {
    state = null; save();
    document.getElementById('mock-summary').classList.add('hidden');
    applyMode();
    showToast('Mock ended. Everything is unlocked.');
  }

  /* ---------------- install ---------------- */
  function install() {
    document.head.append(el('style', {}, CSS));
    const btn = el('button', { id: 'mock-btn', class: 'secondary', title: 'Timed mock of the practical paper, under exam conditions' }, '⏱ Mock exam');
    btn.addEventListener('click', openStart);
    const filesBtn = document.getElementById('ws-toggle');
    filesBtn.parentNode.insertBefore(btn, filesBtn.nextSibling);

    const bar = el('div', { id: 'mock-bar', class: 'hidden', role: 'timer', 'aria-live': 'off' },
      el('span', { class: 'clock' }, ''), el('span', { class: 'grow' }, ''),
      el('button', { onclick: () => { if (state && state.ended) showSummary(); else if (confirm('Finish the mock now? Editing will be locked.')) finish(false); } }, 'Finish early'));
    const header = document.querySelector('header.toolbar');
    header.parentNode.insertBefore(bar, header.nextSibling);

    document.body.append(
      el('div', { id: 'mock-start', class: 'mock-overlay hidden' },
        el('div', { class: 'mock-box', role: 'dialog', 'aria-label': 'Start a mock exam' },
          el('h2', {}, 'Mock exam – practical paper'),
          el('p', {}, 'Work on the CODES files under exam conditions:'),
          el('ul', {},
            el('li', {}, 'The timer keeps running if you close or reload the page.'),
            el('li', {}, 'Trace table, the Python pseudocode reference, Parsons, Tidy, sharing and loading other files are hidden.'),
            el('li', {}, 'Run, Debug, Save as and the scratch program stay, as in an exam IDE.'),
            el('li', {}, 'When time is up, editing locks and your saved files are checked against the names the questions ask for.')),
          el('label', { for: 'mock-minutes' }, 'Time (minutes) – the real paper is 180'),
          el('input', { id: 'mock-minutes', type: 'number', min: '1', max: '600', value: '180' }),
          el('label', { for: 'mock-required' }, 'File names the questions ask for (one per line; found in the CODES files where possible – check against the question paper)'),
          el('textarea', { id: 'mock-required', spellcheck: 'false' }),
          el('div', { class: 'err' }),
          el('div', { class: 'row' },
            el('button', { onclick: () => document.getElementById('mock-start').classList.add('hidden') }, 'Cancel'),
            el('button', { id: 'mock-go', class: 'primary', onclick: () => {
              const box = document.getElementById('mock-start');
              const err = start({ minutes: box.querySelector('#mock-minutes').value, required: parseRequired(box.querySelector('#mock-required').value) });
              if (err) box.querySelector('.err').textContent = err;
            } }, 'Start the clock')))),
    );
    document.body.append(
      el('div', { id: 'mock-summary', class: 'mock-overlay hidden' },
        el('div', { class: 'mock-box', role: 'dialog', 'aria-label': 'Collect my files' },
          el('h2', {}, 'Collect my files'),
          el('div', { class: 'body' }),
          el('div', { class: 'row' },
            el('button', { onclick: () => document.getElementById('mock-summary').classList.add('hidden') }, 'Close'),
            el('button', { id: 'mock-zip', onclick: () => ws().downloadZip(zipName()) }, '⬇ Download my files (.zip)'),
            el('button', { id: 'mock-end', class: 'primary', onclick: () => { if (confirm('End the mock and unlock everything?')) endMock(); } }, 'End mock')))));

    // blocked while locked, even via keyboard shortcuts (window capture runs before
    // the document-level shortcut handlers of pyde and workspace.js)
    window.addEventListener('keydown', (e) => {
      if (!state || !state.ended) return;
      if (e.key === 'F5' || e.key === 'F6' || e.key === 'F7' || e.key === 'F8' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) {
        e.preventDefault(); e.stopImmediatePropagation(); showToast('The mock has ended – editing is locked.');
      }
    }, true);
    // the editor may be swapped to another file's document after locking
    editor.on('swapDoc', () => { if (state && state.ended) editor.setOption('readOnly', 'nocursor'); });
  }

  function restore() {
    try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { state = null; }
    if (state && !state.ended) {
      const left = (state.endAt - Date.now()) / 60000;
      warned = new Set(WARN_AT.filter(w => left <= w));      // don't replay old warnings after a reload
    }
    applyMode();
    if (state && state.ended) showSummary();
  }

  if (!window.pydeWorkspace) { console.warn('mock.js needs workspace.js'); return; }
  install();
  restore();
  window.pydeMock = { start, finish, endMock, showSummary, detectRequired, get state() { return state; } };
})();
