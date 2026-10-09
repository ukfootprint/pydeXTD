/* pyde GCSE layer: CODES-folder workspace
   ------------------------------------------------------------------------
   Practice for Pearson Edexcel International GCSE Computer Science (4CP0)
   Paper 2, where candidates get a CODES folder of unfinished code and data
   files, must not overwrite the originals, and must save their work under
   the file names the questions give.

   - A Files sidebar: "CODES (originals)" and "My files", plus the usual
     single-file "scratch" program pyde always had.
   - Originals can be edited and run, but never overwritten: Save (Ctrl+S)
     on an original asks for a new name (".py" added if missing, as IDLE
     does) and refuses the name of an existing original.
   - Every workspace file is written into Python's working folder before Run,
     Debug or Trace, so open("Q03Data.txt") works; files a program writes
     appear under My files.
   - Load a CODES pack from a folder, a .zip or a #codes= link; download My
     files as a .zip; a built-in practice pack of original questions.
   - Saved in this browser only (localStorage), like the rest of pyde.

   Self-contained: index.html only needs <script src="gcse/workspace.js">. It
   wraps pyde's writeVirtualFile() and diffAndListFiles() and uses its globals
   (editor, pyodide, showToast, ...). Each file has its own CodeMirror Doc,
   so undo history stays per file. */
(function () {
  'use strict';

  const STORE_KEY = 'pyde-gcse-workspace';
  const MAX_FILE_CHARS = 1000000;

  /* ---------------- practice pack (original material, not Pearson's) ---------------- */
  const SAMPLE_PACK = [
    { name: 'Q01.py', content:
`# Q01
# This program should ask for the length and width of a rectangle and
# display its area and perimeter. It contains errors.
# Find and correct the errors.
# Save your amended code as Q01FINISHED with the correct file extension.

length = int(input("Enter the length: "))
width = int(input("Enter the width: ")
area = length * width
perimeter = 2 * (length + width
print("Area: " + area)
print("Perimeter:", perimiter)
` },
    { name: 'Q02.py', content:
`# Q02
# Complete the program so that it counts how many of the scores are at
# or above the pass mark, and displays that count.
# Save your amended code as Q02FINISHED with the correct file extension.

scores = [45, 72, 38, 90, 61, 55, 29]
passMark = 50
passed = 0

# Add your code here

print("Number passed:", passed)
` },
    { name: 'Q03.py', content:
`# Q03
# The file Q03Data.txt holds one record per line in the form name,score
# Complete the program so that it displays the name and score of the
# student with the highest score.
# Save your amended code as Q03FINISHED with the correct file extension.

highName = ""
highScore = -1

theFile = open("Q03Data.txt", "r")
for line in theFile:
    # Add your code here
    pass
theFile.close()

print(highName, highScore)
` },
    { name: 'Q03Data.txt', content: 'Amira,67\nBen,82\nChen,74\nDara,91\nEli,58\n' },
  ];

  /* ---------------- styles ---------------- */
  const CSS = `
  .ws-body{ flex:1; display:flex; min-height:0; }
  .ws-body > .CodeMirror{ flex:1; min-width:0; }
  #ws-side{ flex:0 0 13.5rem; display:flex; flex-direction:column; background:var(--panel-bg); border-right:1px solid var(--border);
    font-size:.8rem; overflow:auto; }
  #ws-side.hidden{ display:none; }
  .ws-actions{ display:flex; flex-wrap:wrap; gap:.25rem; padding:.45rem; border-bottom:1px solid var(--border); }
  .ws-actions button{ background:var(--current-line); color:var(--fg); border:1px solid var(--comment); border-radius:4px; padding:.2rem .45rem;
    cursor:pointer; font-size:.72rem; font-weight:600; }
  .ws-actions button.primary{ background:var(--purple); color:var(--btn-text); border-color:var(--purple); }
  .ws-section{ padding:.35rem .45rem .2rem; font-size:.66rem; text-transform:uppercase; letter-spacing:.06em; color:var(--comment); }
  .ws-list{ list-style:none; margin:0; padding:0 .25rem .3rem; }
  .ws-list li{ display:flex; align-items:center; gap:.3rem; padding:.18rem .35rem; border-radius:4px; cursor:pointer;
    font-family:'Fira Code',monospace; font-size:.78rem; color:var(--fg); }
  .ws-list li:hover{ background:var(--current-line); }
  .ws-list li.current{ background:var(--current-line); color:var(--purple); font-weight:600; }
  .ws-list li .ws-name{ flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ws-list li .ws-badge{ font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:.62rem; padding:0 .3rem; border-radius:3px;
    background:var(--orange); color:var(--btn-text); }
  .ws-list li .ws-del{ visibility:hidden; background:none; border:none; color:var(--comment); cursor:pointer; font-size:.8rem; padding:0 .15rem; }
  .ws-list li:hover .ws-del{ visibility:visible; }
  .ws-list li .ws-del.confirm{ visibility:visible; color:var(--red); font-weight:700; }
  .ws-empty{ padding:.3rem .7rem .5rem; color:var(--comment); font-size:.75rem; line-height:1.45; }
  .ws-empty a{ color:var(--cyan); cursor:pointer; }
  .ws-note{ margin-top:auto; padding:.5rem .6rem; color:var(--comment); font-size:.68rem; line-height:1.4; border-top:1px solid var(--border); }
  #ws-banner{ padding:.3rem .8rem; font-size:.78rem; background:rgba(255,184,108,.18); color:var(--fg); border-bottom:1px solid var(--border); }
  #ws-banner.hidden{ display:none; }
  #ws-banner button{ margin-left:.4rem; background:var(--orange); color:var(--btn-text); border:none; border-radius:4px; padding:.12rem .5rem;
    font-weight:600; cursor:pointer; font-size:.75rem; }
  #ws-saveas{ position:fixed; inset:0; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; z-index:1600; }
  #ws-saveas.hidden{ display:none; }
  #ws-saveas .box{ background:var(--bg); border:1px solid var(--comment); border-radius:8px; padding:1rem 1.2rem; width:min(380px,92vw); color:var(--fg); }
  #ws-saveas h3{ margin:0 0 .5rem; font-size:.95rem; color:var(--purple); }
  #ws-saveas input{ width:100%; box-sizing:border-box; background:var(--panel-bg); color:var(--fg); border:1px solid var(--comment); border-radius:4px;
    padding:.35rem .5rem; font-family:'Fira Code',monospace; font-size:.9rem; }
  #ws-saveas .err{ color:var(--red); font-size:.78rem; min-height:1.1em; margin:.35rem 0; }
  #ws-saveas .row{ display:flex; gap:.4rem; justify-content:flex-end; }
  #ws-saveas button{ background:var(--current-line); color:var(--fg); border:1px solid var(--comment); border-radius:4px; padding:.3rem .8rem; cursor:pointer; font-weight:600; }
  #ws-saveas button.primary{ background:var(--purple); color:var(--btn-text); border-color:var(--purple); }
  `;

  /* ---------------- state ---------------- */
  // file: { name, content (saved/original text), original: bool, doc: CodeMirror.Doc }
  let files = [];
  let current = null;            // file object shown in the editor, or null = scratch program
  let scratchDoc = null;         // pyde's own single-file buffer
  let lastWritten = new Set();   // names this module wrote into Pyodide's FS
  let persistTimer = null;

  const isPy = (name) => /\.py$/i.test(name);
  const modeFor = (name) => (isPy(name) ? 'python' : null);
  const byName = (name) => files.find(f => f.name === name);
  const sortFiles = (list) => list.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

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

  function makeFile(name, content, original) {
    const f = { name, content, original: !!original, doc: null };
    f.doc = CodeMirror.Doc(content, modeFor(name));
    f.doc.on('change', () => onDocChange(f));
    return f;
  }
  const isDirty = (f) => f.original && f.doc.getValue() !== f.content;

  /* ---------------- persistence ---------------- */
  function writeStore() {
    clearTimeout(persistTimer);
    persistTimer = null;
    const data = {
      files: files.map(f => ({ name: f.name, content: f.content, original: f.original,
                               draft: isDirty(f) ? f.doc.getValue() : undefined })),
      current: current ? current.name : null,
    };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
    catch (e) { showToast('Could not save the workspace in this browser (storage full?). Download your files to keep them.'); }
  }
  // Typing is saved after a short pause; anything that creates, replaces or
  // deletes a file is saved at once, so closing the tab straight after
  // "Save as" can't lose it. Pending typing is flushed when the page is hidden.
  function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(writeStore, 300);
  }
  function persistNow() { writeStore(); }
  window.addEventListener('pagehide', () => { if (persistTimer) writeStore(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && persistTimer) writeStore(); });

  function restore() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { /* ignore */ }
    if (!data || !Array.isArray(data.files)) return null;
    files = data.files.map(d => {
      const f = makeFile(d.name, d.content, d.original);
      if (d.original && typeof d.draft === 'string') f.doc.setValue(d.draft);   // unsaved edits survive a reload
      return f;
    });
    return data.current;
  }

  // pyde auto-saves "the editor" as its scratch draft 500 ms after any edit.
  // When a workspace file is showing, put the scratch text back afterwards.
  let draftFixTimer = null;
  function keepScratchDraft() {
    clearTimeout(draftFixTimer);
    draftFixTimer = setTimeout(() => {
      try { localStorage.setItem('pyde-draft', scratchDoc.getValue()); } catch (e) { /* ignore */ }
    }, 800);
  }

  function onDocChange(f) {
    if (!f.original) f.content = f.doc.getValue();
    keepScratchDraft();
    persist();
    if (f === current) { renderBanner(); renderList(); }
  }

  /* ---------------- switching files ---------------- */
  function open(f) {
    if (f === current) return;
    current = f;
    editor.swapDoc(f ? f.doc : scratchDoc);
    document.getElementById('filename-input').value = f ? f.name : (document.getElementById('filename-input').dataset.scratchName || 'program.py');
    render();
    persist();
    editor.focus();
    if (typeof updateCharCount === 'function') updateCharCount();
  }

  /* ---------------- Python working folder ---------------- */
  function writeFilesToFS() {
    if (typeof pyodide === 'undefined' || !pyodide) return;
    const now = new Set(files.map(f => f.name));
    for (const name of lastWritten) {
      if (!now.has(name)) { try { pyodide.FS.unlink(name); } catch (e) { /* ignore */ } }
    }
    // Originals go in as the original text (they are never overwritten); the
    // file being edited goes in as currently shown, so Run uses what you see.
    for (const f of files) {
      const text = f === current ? f.doc.getValue() : f.content;
      try { pyodide.FS.writeFile(f.name, text); } catch (e) { /* ignore */ }
    }
    lastWritten = now;
  }

  function pickUpWrittenFiles(before) {
    if (typeof pyodide === 'undefined' || !pyodide) return;
    // only once the workspace is in use - plain pyde keeps its Files tab behaviour
    if (!files.length && document.getElementById('ws-side').classList.contains('hidden')) return;
    const after = snapshotFS();
    const vfileName = (document.getElementById('vfile-name').value.trim() || 'input.txt');
    const changedOriginals = [];
    let added = 0;
    for (const name in after) {
      if (name in before && before[name] === after[name]) continue;
      if (name === vfileName && !byName(name)) continue;       // pyde's own input-file box
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(pyodide.FS.readFile(name)); } catch (e) { continue; }
      if (text.length > MAX_FILE_CHARS) continue;
      const f = byName(name);
      if (f && f.original) { changedOriginals.push(name); continue; }
      if (f) { if (f !== current) { f.content = text; f.doc.setValue(text); } }
      else { files.push(makeFile(name, text, false)); added++; }
    }
    if (changedOriginals.length) showToast('Your program changed ' + changedOriginals.join(', ') + ' – the original is kept unchanged in CODES.');
    if (added) showToast(added + ' file' + (added === 1 ? '' : 's') + ' written by your program added to My files.');
    if (added || changedOriginals.length) { render(); persistNow(); }
  }

  /* ---------------- Save / Save as ---------------- */
  function normaliseName(raw) {
    let name = String(raw || '').trim().replace(/^.*[\\/]/, '');
    if (!name) return { error: 'Type a file name.' };
    if (/[<>:"|?*\x00-\x1f]/.test(name)) return { error: 'File names can’t contain < > : " | ? *' };
    if (!/\.[A-Za-z0-9]+$/.test(name)) name += '.py';                       // like IDLE
    return { name };
  }

  function saveAs(defaultName) {
    const box = document.getElementById('ws-saveas');
    const input = box.querySelector('input');
    const err = box.querySelector('.err');
    const doc = editor.getDoc();
    const fromOriginal = current && current.original ? current : null;
    // like IDLE, start from the current name: reading the question for the required name is part of the skill
    input.value = defaultName || (current ? current.name : (document.getElementById('filename-input').value || 'program.py'));
    err.textContent = '';
    box.classList.remove('hidden');
    input.focus(); input.select();
    return new Promise(resolve => {
      const finish = (ok) => {
        box.classList.add('hidden');
        box.querySelector('.ok').onclick = box.querySelector('.cancel').onclick = input.onkeydown = null;
        resolve(ok);
        editor.focus();
      };
      const attempt = () => {
        const r = normaliseName(input.value);
        if (r.error) { err.textContent = r.error; return; }
        const existing = byName(r.name);
        if (existing && existing.original) { err.textContent = r.name + ' is an original CODES file – you must not overwrite it. Choose another name.'; return; }
        const text = doc.getValue();
        let target = existing;
        if (target) { target.content = text; target.doc.setValue(text); }
        else { target = makeFile(r.name, text, false); files.push(target); }
        if (fromOriginal) fromOriginal.doc.setValue(fromOriginal.content);    // the original goes back to how it was
        else if (!current) scratchDoc.setValue(scratchDoc.getValue());         // scratch keeps its text
        open(target);
        showToast('Saved as ' + r.name);
        persistNow();
        finish(true);
      };
      box.querySelector('.ok').onclick = attempt;
      box.querySelector('.cancel').onclick = () => finish(false);
      input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); attempt(); } if (e.key === 'Escape') finish(false); };
    });
  }

  function save() {
    if (current && !current.original) { current.content = current.doc.getValue(); persistNow(); showToast('Saved ' + current.name); return; }
    saveAs();
  }

  /* ---------------- loading packs ---------------- */
  function addFiles(list, original) {
    let n = 0, skipped = [];
    for (const { name, content } of list) {
      const clean = String(name).replace(/^.*[\\/]/, '');
      if (!clean || clean.startsWith('.') || clean.startsWith('__MACOSX')) continue;
      if (typeof content !== 'string' || content.length > MAX_FILE_CHARS) { skipped.push(clean); continue; }
      const existing = byName(clean);
      if (existing) {
        if (existing.original && !original) { skipped.push(clean + ' (an original has that name)'); continue; }
        existing.content = content; existing.original = original; existing.doc.setValue(content);
      } else files.push(makeFile(clean, content, original));
      n++;
    }
    render(); persistNow();
    if (skipped.length) showToast('Skipped: ' + skipped.join(', '));
    return n;
  }

  function loadPack(list, label) {
    if (files.some(f => f.original) && !confirm('Replace the current CODES files with ' + label + '? Files in My files are kept.')) return;
    files = files.filter(f => !f.original);
    if (current && !files.includes(current)) current = null;
    const n = addFiles(list, true);
    showSide(true);
    const firstPy = sortFiles(files.filter(f => f.original && isPy(f.name)))[0];
    if (firstPy) open(firstPy); else render();
    showToast('Loaded ' + n + ' CODES file' + (n === 1 ? '' : 's') + ' from ' + label + '.');
  }

  async function readUploads(fileList) {
    const out = [];
    for (const file of fileList) {
      if (/\.zip$/i.test(file.name)) out.push(...await unzip(file));
      else {
        const buf = await file.arrayBuffer();
        try { out.push({ name: file.name, content: new TextDecoder('utf-8', { fatal: true }).decode(buf) }); }
        catch (e) { out.push({ name: file.name, content: null }); }
      }
    }
    return out;
  }

  async function unzip(file) {
    await waitForPython();
    pyodide.FS.writeFile('/tmp/_pyde_in.zip', new Uint8Array(await file.arrayBuffer()));
    const json = pyodide.runPython(`
import zipfile as _zf, json as _js
_out = []
with _zf.ZipFile("/tmp/_pyde_in.zip") as _z:
    for _i in _z.infolist():
        if _i.is_dir():
            continue
        try:
            _out.append({"name": _i.filename, "content": _z.read(_i).decode("utf-8")})
        except UnicodeDecodeError:
            _out.append({"name": _i.filename, "content": None})
_js.dumps(_out)`);
    try { pyodide.FS.unlink('/tmp/_pyde_in.zip'); } catch (e) { /* ignore */ }
    return JSON.parse(json);
  }

  async function downloadZip(zipName) {
    const mine = files.filter(f => !f.original);
    if (!mine.length) { showToast('Nothing in My files yet – use Save as to save your work.'); return; }
    await waitForPython();
    pyodide.globals.set('_pyde_zip_files', pyodide.toPy(mine.map(f => [f.name, f === current ? f.doc.getValue() : f.content])));
    pyodide.runPython(`
import zipfile as _zf
with _zf.ZipFile("/tmp/_pyde_out.zip", "w", _zf.ZIP_DEFLATED) as _z:
    for _n, _c in _pyde_zip_files:
        _z.writestr(_n, _c)`);
    const blob = new Blob([pyodide.FS.readFile('/tmp/_pyde_out.zip')], { type: 'application/zip' });
    try { pyodide.FS.unlink('/tmp/_pyde_out.zip'); } catch (e) { /* ignore */ }
    zipName = typeof zipName === 'string' ? zipName : 'my-files.zip';
    const a = el('a', { href: URL.createObjectURL(blob), download: zipName });
    document.body.append(a); a.click(); a.remove();
    showToast('Downloaded ' + zipName + ' (' + mine.length + ' file' + (mine.length === 1 ? '' : 's') + ').');
  }

  function sharePack() {
    const originals = files.filter(f => f.original);
    if (!originals.length) { showToast('Load a CODES pack first.'); return; }
    const hash = '#codes=' + LZString.compressToEncodedURIComponent(JSON.stringify({ files: originals.map(f => ({ name: f.name, content: f.content })) }));
    const url = location.origin + location.pathname + hash;
    const done = () => showToast('Link to this CODES pack copied.');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => { history.replaceState(null, '', hash); showToast('Link is in the address bar.'); });
    else { history.replaceState(null, '', hash); showToast('Link is in the address bar.'); }
  }

  function waitForPython() {
    return new Promise(resolve => {
      const tick = () => (typeof pyodideReady !== 'undefined' && pyodideReady) ? resolve() : setTimeout(tick, 150);
      tick();
    });
  }

  function deleteFile(f) {
    files = files.filter(x => x !== f);
    if (current === f) open(null); else render();
    persistNow();
    showToast('Deleted ' + f.name);
  }

  function clearOriginals() {
    if (!confirm('Remove the CODES files from this workspace? Files in My files are kept.')) return;
    const wasCurrent = current && current.original;
    files = files.filter(f => !f.original);
    if (wasCurrent) open(null); else render();
    persist();
  }

  /* ---------------- rendering ---------------- */
  function showSide(show) {
    document.getElementById('ws-side').classList.toggle('hidden', !show);
    try { localStorage.setItem('pyde-gcse-files-open', show ? '1' : '0'); } catch (e) { /* ignore */ }
    editor.refresh();
  }

  function renderList() {
    const fill = (ul, list, canDelete) => {
      ul.innerHTML = '';
      for (const f of sortFiles(list)) {
        const li = el('li', { class: f === current ? 'current' : '', title: f.original ? 'Original CODES file – Save as a new name to keep changes' : 'Your file' , 'data-name': f.name },
          el('span', {}, isPy(f.name) ? '🐍' : '📄'),
          el('span', { class: 'ws-name' }, f.name),
          isDirty(f) ? el('span', { class: 'ws-badge', title: 'Changed but not saved – use Save as' }, 'edited') : null);
        li.addEventListener('click', () => open(f));
        if (canDelete) {
          const del = el('button', { class: 'ws-del', title: 'Delete ' + f.name }, '✕');
          del.addEventListener('click', (e) => {
            e.stopPropagation();
            if (del.classList.contains('confirm')) deleteFile(f);
            else { del.classList.add('confirm'); del.textContent = 'Delete?'; setTimeout(() => { del.classList.remove('confirm'); del.textContent = '✕'; }, 3000); }
          });
          li.append(del);
        }
        ul.append(li);
      }
    };
    const originals = files.filter(f => f.original), mine = files.filter(f => !f.original);
    fill(document.getElementById('ws-codes'), originals, false);
    fill(document.getElementById('ws-mine'), mine, true);
    document.getElementById('ws-codes-empty').classList.toggle('hidden', originals.length > 0);
    document.getElementById('ws-mine-empty').classList.toggle('hidden', mine.length > 0);
    document.getElementById('ws-scratch').classList.toggle('current', current === null);
    document.getElementById('ws-clear-codes').classList.toggle('hidden', originals.length === 0);
  }

  function renderBanner() {
    const b = document.getElementById('ws-banner');
    if (current && current.original) {
      b.classList.remove('hidden');
      b.querySelector('span').textContent = isDirty(current)
        ? current.name + ' is an original CODES file. Your changes are not saved – save them under the name the question gives.'
        : current.name + ' is an original CODES file. You can edit and run it, but save your work under a new name.';
    } else b.classList.add('hidden');
    const header = document.querySelector('#editor-panel .panel-header');
    header.textContent = current ? 'Editor – ' + current.name + (current.original ? ' (original)' : '') : 'Editor';
    editor.setOption('mode', current ? modeFor(current.name) : 'python');
  }

  function render() { renderList(); renderBanner(); }

  /* ---------------- install ---------------- */
  function install() {
    document.head.append(el('style', {}, CSS));
    scratchDoc = editor.getDoc();

    // sidebar lives inside the editor panel, so pyde's splitter maths is unaffected
    const panel = document.getElementById('editor-panel');
    const cmWrap = editor.getWrapperElement();
    const body = el('div', { class: 'ws-body' });
    cmWrap.parentNode.insertBefore(body, cmWrap);
    const side = el('aside', { id: 'ws-side', class: 'hidden' },
      el('div', { class: 'ws-actions' },
        el('button', { class: 'primary', id: 'ws-saveas-btn', title: 'Save the file shown under a new name (Ctrl+Shift+S)', onclick: () => saveAs() }, 'Save as…'),
        el('button', { id: 'ws-load-folder', title: 'Load a CODES folder as originals', onclick: () => document.getElementById('ws-folder-input').click() }, 'Open CODES folder'),
        el('button', { id: 'ws-load-zip', title: 'Load a CODES .zip as originals', onclick: () => document.getElementById('ws-zip-input').click() }, 'Open .zip'),
        el('button', { id: 'ws-add', title: 'Add your own files to My files', onclick: () => document.getElementById('ws-add-input').click() }, 'Add files'),
        el('button', { id: 'ws-download', title: 'Download My files as a .zip', onclick: downloadZip }, '⬇ My files .zip'),
        el('button', { id: 'ws-share', title: 'Copy a link that opens these CODES files (for teachers)', onclick: sharePack }, '🔗 Share pack')),
      el('ul', { class: 'ws-list' }, el('li', { id: 'ws-scratch', title: 'pyde’s usual single program (not a file in the workspace)', onclick: () => open(null) },
        el('span', {}, '✏️'), el('span', { class: 'ws-name' }, 'Scratch program'))),
      el('div', { class: 'ws-section' }, 'CODES (originals) ', el('a', { id: 'ws-clear-codes', class: 'hidden', title: 'Remove the CODES files', style: 'cursor:pointer;float:right;text-transform:none;letter-spacing:0', onclick: clearOriginals }, 'remove')),
      el('ul', { class: 'ws-list', id: 'ws-codes' }),
      el('div', { class: 'ws-empty', id: 'ws-codes-empty' }, 'No CODES files. Open a folder or .zip, or ',
        el('a', { id: 'ws-sample', onclick: () => loadPack(SAMPLE_PACK, 'the practice pack') }, 'try the practice pack'), '.'),
      el('div', { class: 'ws-section' }, 'My files'),
      el('ul', { class: 'ws-list', id: 'ws-mine' }),
      el('div', { class: 'ws-empty', id: 'ws-mine-empty' }, 'Nothing saved yet. Use Save as (Ctrl+S) to save your work under the name a question gives.'),
      el('div', { class: 'ws-note' }, 'Files are kept in this browser only. Download My files to hand work in or keep a copy.'),
      el('input', { id: 'ws-folder-input', type: 'file', class: 'hidden', webkitdirectory: true, multiple: true }),
      el('input', { id: 'ws-zip-input', type: 'file', class: 'hidden', accept: '.zip' }),
      el('input', { id: 'ws-add-input', type: 'file', class: 'hidden', multiple: true })
    );
    body.append(side, cmWrap);
    panel.insertBefore(el('div', { id: 'ws-banner', class: 'hidden' }, el('span', {}), el('button', { onclick: () => saveAs() }, 'Save as…')), body);
    document.body.append(el('div', { id: 'ws-saveas', class: 'hidden' },
      el('div', { class: 'box', role: 'dialog', 'aria-label': 'Save as' },
        el('h3', {}, 'Save as'),
        el('input', { type: 'text', spellcheck: 'false', 'aria-label': 'File name' }),
        el('div', { class: 'err' }),
        el('div', { class: 'row' }, el('button', { class: 'cancel' }, 'Cancel'), el('button', { class: 'ok primary' }, 'Save')))));

    // toolbar toggle, next to Upload
    const toggle = el('button', { id: 'ws-toggle', class: 'secondary', title: 'Show or hide the Files panel (CODES folder practice)' }, '📁 Files');
    toggle.addEventListener('click', () => showSide(document.getElementById('ws-side').classList.contains('hidden')));
    const uploadBtn = document.getElementById('upload-btn');
    uploadBtn.parentNode.insertBefore(toggle, uploadBtn.nextSibling);

    document.getElementById('ws-folder-input').addEventListener('change', async (e) => {
      const list = await readUploads([...e.target.files]); e.target.value = '';
      if (list.length) loadPack(list, 'the folder');
    });
    document.getElementById('ws-zip-input').addEventListener('change', async (e) => {
      const list = await readUploads([...e.target.files]); e.target.value = '';
      if (list.length) loadPack(list, e.target.files[0] ? e.target.files[0].name : 'the zip');
    });
    document.getElementById('ws-add-input').addEventListener('change', async (e) => {
      const list = await readUploads([...e.target.files]); e.target.value = '';
      const n = addFiles(list, false);
      if (n) { showSide(true); showToast('Added ' + n + ' file' + (n === 1 ? '' : 's') + ' to My files.'); }
    });

    // pyde's New and Upload act on the scratch program, never on a workspace file
    document.getElementById('new-btn').addEventListener('click', () => { if (current) open(null); }, true);
    document.getElementById('upload-input').addEventListener('change', () => { if (current) open(null); }, true);
    document.getElementById('filename-input').addEventListener('input', (e) => { if (!current) e.target.dataset.scratchName = e.target.value; });

    // Run on a data file makes no sense
    for (const id of ['run-btn', 'debug-btn', 'trace-build']) {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', (e) => {
        if (current && !isPy(current.name)) { e.stopImmediatePropagation(); showToast(current.name + ' is a data file – open a .py file to run it.'); }
      }, true);
    }

    // Ctrl/Cmd+S = Save (Save as for originals and the scratch program); Ctrl/Cmd+Shift+S = Save as
    document.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return;
      if (!document.getElementById('ws-saveas').classList.contains('hidden')) { e.preventDefault(); return; }
      e.preventDefault();
      if (e.shiftKey) saveAs(); else save();
    }, true);

    // sync files into Python's working folder before Run / Debug / Trace, and pick up files a program writes
    const origWrite = window.writeVirtualFile;
    window.writeVirtualFile = function () { origWrite(); writeFilesToFS(); };
    const origDiff = window.diffAndListFiles;
    window.diffAndListFiles = function (before) { origDiff(before); pickUpWrittenFiles(before); };
  }

  function start() {
    install();
    const lastCurrent = restore();
    let opened = false;
    if (location.hash.startsWith('#codes=')) {
      try {
        const pack = JSON.parse(LZString.decompressFromEncodedURIComponent(location.hash.slice(7)));
        if (pack && Array.isArray(pack.files)) {
          history.replaceState(null, '', location.pathname + location.search);
          loadPack(pack.files, 'the shared link'); opened = true;
        }
      } catch (e) { /* ignore malformed */ }
    }
    // a #code / #puzzle / #trace link owns the scratch program; otherwise reopen the last file
    if (!opened && !location.hash && lastCurrent && byName(lastCurrent)) open(byName(lastCurrent));
    let sideOpen = null;
    try { sideOpen = localStorage.getItem('pyde-gcse-files-open'); } catch (e) { /* ignore */ }
    if (opened || sideOpen === '1' || (sideOpen === null && files.length)) showSide(true);
    render();
  }

  start();
  window.pydeWorkspace = { open: (name) => open(name ? byName(name) : null), saveAs, save, loadPack, downloadZip, showSide, isDirty, get files() { return sortFiles(files.filter(f => f.original)).concat(sortFiles(files.filter(f => !f.original))); }, get current() { return current; }, SAMPLE_PACK };
})();
