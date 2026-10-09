/* pyde GCSE layer: trace tables
   ------------------------------------------------------------------------
   Builds an exam-style trace table for the program in the editor: one row
   per executed line that changed a variable or produced output; a column per
   variable (a value appears only when it changes, as in GCSE mark schemes),
   plus Output. Practice mode blanks the table for pupils to fill in and
   marks it cell by cell. Teachers can share a trace task as a link
   (#trace=...) with fixed inputs and chosen columns, and copy a blank or
   completed table into a worksheet.

   Self-contained: index.html only needs <script src="gcse/trace.js">. It
   adds its own tab, styles and Python helper, and uses pyde's globals
   (editor, pyodide, switchTab, requestInlineInput, ...). Recording uses
   sys.settrace in a fresh namespace; input() takes pre-set inputs first,
   then the inline console box (run_sync, JSPI browsers) or prompt(). */
(function () {
  'use strict';

  const MAX_ROWS = 300;
  const MAX_LINES = 20000;

  /* ---------------- Python recorder ---------------- */
  const TRACE_SRC = `
import sys as _tsys, json as _tjson, builtins as _tbuiltins, linecache as _tlinecache
import js as _tjs
from pyodide.ffi import run_sync as _trun_sync, can_run_sync as _tcan_run_sync

_TRACE_FILE = "<trace>"


class _PydeTraceLimit(BaseException):
    """BaseException so a pupil's 'except Exception:' can't swallow it."""


def _pyde_trace_fmt(v, depth=0):
    # Like repr(), but strings always in double quotes, as in most mark schemes
    if isinstance(v, str):
        return '"' + v + '"'
    if depth < 3 and type(v) in (list, tuple, set, dict):
        if isinstance(v, dict):
            inner = ", ".join(_pyde_trace_fmt(k, depth + 1) + ": " + _pyde_trace_fmt(x, depth + 1) for k, x in v.items())
            r = "{" + inner + "}"
        else:
            inner = ", ".join(_pyde_trace_fmt(x, depth + 1) for x in v)
            if isinstance(v, tuple):
                r = "(" + inner + ("," if len(v) == 1 else "") + ")"
            elif isinstance(v, set):
                r = "{" + inner + "}" if v else "set()"
            else:
                r = "[" + inner + "]"
    else:
        try:
            r = repr(v)
        except Exception:
            r = "?"
    return r if len(r) <= 120 or depth else r[:120] + "..."


class _PydeTraceRecorder:
    SKIP_TYPES = ("function", "builtin_function_or_method", "module", "type")

    def __init__(self, inputs, max_rows, max_lines):
        self.inputs = list(inputs)
        self.max_rows, self.max_lines = max_rows, max_lines
        self.lines_run = 0
        self.cols = []          # [{"key", "name", "scope"}] in order of first appearance
        self.col_index = {}
        self.last = {}          # key -> formatted value last recorded
        self.pending = {}       # id(frame) -> line number that last started running there
        self.rows = []
        self.out = []           # output text since the last row
        self.truncated = False
        self.module_frame = None

    # -- helpers -----------------------------------------------------------
    def _vars(self, frame):
        scope = "" if frame.f_code.co_name == "<module>" else frame.f_code.co_name
        for name, value in list(frame.f_locals.items()):
            if name.startswith("__") or name == "input":
                continue
            if type(value).__name__ in self.SKIP_TYPES:
                continue
            yield scope, name, value

    def _row(self, frame, line):
        changes = {}
        frames = [frame]
        if self.module_frame is not None and frame is not self.module_frame:
            frames.append(self.module_frame)      # globals can change inside functions
        for f in frames:
            for scope, name, value in self._vars(f):
                key = (scope + "." if scope else "") + name
                text = _pyde_trace_fmt(value)
                if self.last.get(key) != text:
                    self.last[key] = text
                    if key not in self.col_index:
                        self.col_index[key] = len(self.cols)
                        self.cols.append({"key": key, "name": name, "scope": scope})
                    changes[key] = text
        out = "".join(self.out)
        self.out = []
        if out.endswith("\\n"):
            out = out[:-1]
        if changes or out:
            self.rows.append({"line": line, "vals": changes, "out": out})
            if len(self.rows) >= self.max_rows:
                self.truncated = True
                raise _PydeTraceLimit()

    # -- trace function ----------------------------------------------------
    def trace(self, frame, event, arg):
        if frame.f_code.co_filename != _TRACE_FILE:
            return None
        if frame.f_code.co_name == "<module>" and self.module_frame is None:
            self.module_frame = frame
        fid = id(frame)
        if event == "call" and frame.f_code.co_name != "<module>":
            # parameters get their values on the def line, as on paper
            self._row(frame, frame.f_code.co_firstlineno)
        elif event == "line":
            self.lines_run += 1
            if self.lines_run > self.max_lines:
                self.truncated = True
                raise _PydeTraceLimit()
            prev = self.pending.get(fid)
            if prev is not None:
                self._row(frame, prev)
            self.pending[fid] = frame.f_lineno
        elif event == "return":
            prev = self.pending.pop(fid, None)
            if prev is not None:
                self._row(frame, prev)
        return self.trace

    # -- input() and stdout during recording --------------------------------
    def input(self, prompt=""):
        prompt = str(prompt)
        if self.inputs:
            value = str(self.inputs.pop(0))
            _tjs._pydeTraceEcho(prompt + value)
            return value
        if _tcan_run_sync():
            _tjs.switchTab("console")    # the inline input box lives in the console
            return str(_trun_sync(_tjs.requestInlineInput(prompt)))
        return _ide_input(prompt)


class _PydeTraceStdout:
    def __init__(self, rec, real):
        self.rec, self.real = rec, real

    def write(self, s):
        self.rec.out.append(s)
        return self.real.write(s)

    def flush(self):
        return self.real.flush()


def _pyde_trace_run(src, inputs, max_rows, max_lines):
    rec = _PydeTraceRecorder(list(inputs), int(max_rows), int(max_lines))
    result = {"error": None}
    try:
        code = compile(src, _TRACE_FILE, "exec")
    except SyntaxError as e:
        return _tjson.dumps({"cols": [], "rows": [], "truncated": False,
                             "error": {"type": "SyntaxError", "msg": str(e.msg), "line": e.lineno}})
    _tlinecache.cache[_TRACE_FILE] = (len(src), None, src.splitlines(True), _TRACE_FILE)
    ns = {"__name__": "__main__", "__builtins__": _tbuiltins, "input": rec.input}
    real_stdout = _tsys.stdout
    _tsys.stdout = _PydeTraceStdout(rec, real_stdout)
    _tsys.settrace(rec.trace)
    try:
        exec(code, ns)
    except _PydeTraceLimit:
        pass
    except BaseException as e:
        _tsys.settrace(None)
        line = None
        tb = e.__traceback__
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == _TRACE_FILE:
                line = tb.tb_lineno
            tb = tb.tb_next
        if rec.out:   # output printed before the error still belongs in the table
            rec.rows.append({"line": line, "vals": {}, "out": "".join(rec.out).rstrip("\\n")})
        result["error"] = {"type": type(e).__name__, "msg": str(e), "line": line}
    finally:
        _tsys.settrace(None)
        _tsys.stdout = real_stdout
    result.update(cols=rec.cols, rows=rec.rows, truncated=rec.truncated)
    return _tjson.dumps(result)
`;

  /* ---------------- styles ---------------- */
  const CSS = `
  #tab-trace{ display:flex; flex-direction:column; gap:.5rem; }
  #tab-trace.hidden{ display:none; }
  .trace-bar{ display:flex; flex-wrap:wrap; gap:.4rem; align-items:center; font-size:.8rem; color:var(--comment); }
  .trace-bar button{ background:var(--current-line); color:var(--fg); border:1px solid var(--comment); border-radius:5px;
    padding:.3rem .65rem; cursor:pointer; font-size:.8rem; font-weight:600; }
  .trace-bar button.primary{ background:var(--purple); color:var(--btn-text); border-color:var(--purple); }
  .trace-bar button:disabled{ opacity:.45; cursor:not-allowed; }
  .trace-bar label{ display:inline-flex; align-items:center; gap:.25rem; cursor:pointer; }
  #trace-inputs{ background:var(--bg); color:var(--fg); border:1px solid var(--comment); border-radius:4px; padding:.25rem .4rem;
    font-family:'Fira Code',monospace; font-size:.8rem; width:11rem; }
  .trace-cols{ display:flex; flex-wrap:wrap; gap:.3rem .7rem; font-size:.78rem; color:var(--fg); }
  .trace-cols:empty{ display:none; }
  .trace-cols .trace-cols-title{ color:var(--comment); }
  #trace-status{ font-size:.82rem; color:var(--comment); min-height:1.1em; }
  #trace-status.good{ color:var(--green); font-weight:600; }
  #trace-status.bad{ color:var(--red); }
  .trace-wrap{ overflow:auto; }
  table.trace{ border-collapse:collapse; font-family:'Fira Code',monospace; font-size:var(--editor-font-size,14px); }
  table.trace th, table.trace td{ border:1px solid var(--comment); padding:.2rem .55rem; text-align:center; min-width:3.2rem; }
  table.trace th{ background:var(--current-line); color:var(--fg); font-weight:600; position:sticky; top:0; }
  table.trace th .scope{ display:block; font-weight:400; font-size:.75em; color:var(--comment); }
  table.trace td.line{ color:var(--comment); }
  table.trace td.out{ text-align:left; white-space:pre-wrap; }
  table.trace td input{ width:6.5em; box-sizing:border-box; background:transparent; color:var(--fg); border:none;
    border-bottom:1px dashed var(--comment); font-family:inherit; font-size:inherit; text-align:center; outline:none; }
  table.trace td.out input{ text-align:left; width:11em; }
  table.trace td.right{ background:rgba(80,250,123,.18); }
  table.trace td.wrong{ background:rgba(255,85,85,.22); }
  table.trace td.wrong .answer{ display:block; font-size:.75em; color:var(--red); }
  table.trace tr.err td{ color:var(--red); }
  .trace-empty{ color:var(--comment); font-size:.85rem; line-height:1.5; }
  `;

  /* ---------------- state ---------------- */
  let data = null;               // last recording: {cols, rows, truncated, error}
  let hiddenCols = new Set();
  let showLines = true;
  let practice = false;
  let builtFor = null;           // code the table was built from
  let building = false;

  /* ---------------- DOM ---------------- */
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

  function install() {
    document.head.append(el('style', {}, CSS));
    const tabs = document.querySelector('#output-panel .tabs');
    const tabBtn = el('button', { class: 'tab-btn', 'data-tab': 'trace', title: 'Build a GCSE-style trace table for this program' }, 'Trace table');
    tabBtn.addEventListener('click', () => switchTab('trace'));
    tabs.append(tabBtn);

    const panel = el('div', { class: 'tab-content hidden', id: 'tab-trace' },
      el('div', { class: 'trace-bar' },
        el('button', { id: 'trace-build', class: 'primary', onclick: build, title: 'Run the program and record every change' }, '▦ Build trace table'),
        el('span', {}, 'Inputs:'),
        el('input', { id: 'trace-inputs', type: 'text', placeholder: 'e.g. 5, 3, 0', title: 'Values given to input() in order, separated by commas. Leave blank to type them as the program runs.' }),
        el('label', { title: 'Hide the answers so you can fill the table in yourself' },
          el('input', { id: 'trace-practice', type: 'checkbox', onchange: (e) => { practice = e.target.checked; render(); } }), 'Practice'),
        el('label', {}, el('input', { id: 'trace-lines', type: 'checkbox', checked: true, onchange: (e) => { showLines = e.target.checked; render(); } }), 'Line numbers'),
        el('button', { id: 'trace-check', onclick: check, disabled: true }, '✓ Check'),
        el('button', { id: 'trace-reveal', onclick: reveal, disabled: true }, 'Reveal'),
        el('button', { id: 'trace-copy', onclick: copyTable, disabled: true, title: 'Copy the table (blank in Practice mode) for Word, Docs or OneNote' }, '📋 Copy table'),
        el('button', { id: 'trace-share', onclick: shareTask, disabled: true, title: 'Copy a link that opens this program as a trace-table task' }, '🔗 Share as task')
      ),
      el('div', { class: 'trace-cols', id: 'trace-cols' }),
      el('div', { id: 'trace-status' }),
      el('div', { class: 'trace-wrap', id: 'trace-wrap' },
        el('p', { class: 'trace-empty' },
          'Click ', el('strong', {}, 'Build trace table'), ' to run the program and record how each variable changes, line by line, in the format GCSE exam questions use. ',
          'Tick ', el('strong', {}, 'Practice'), ' to hide the answers and fill the table in yourself, then ', el('strong', {}, 'Check'), '.'))
    );
    // place the Trace panel with the other tab contents (before the debugger pane)
    const debugPane = document.getElementById('debug-pane');
    debugPane.parentNode.insertBefore(panel, debugPane);

    editor.on('change', () => {
      if (data && builtFor !== null && editor.getValue() !== builtFor) setStatus('The code has changed since this table was built – click Build trace table to update it.', '');
    });
  }

  /* ---------------- building ---------------- */
  window._pydeTraceEcho = (text) => appendConsole(text, 'stdout');

  function parseInputs(text) {
    const t = text.trim();
    if (!t) return [];
    return t.split(/\s*[,\n]\s*/).map(s => s.replace(/^(["'])(.*)\1$/, '$2'));
  }

  let srcLoaded = false;
  async function build() {
    if (typeof pyodideReady === 'undefined' || !pyodideReady) { showToast('Python is still loading…'); return; }
    if (isRunning || building) return;
    const code = editor.getValue();
    if (/\bimport\s+p5\b|\bfrom\s+p5\s+import\b/.test(code) || /def\s+draw\s*\(\s*\)\s*:/.test(code)) {
      setStatus('Trace tables aren’t available for p5 sketches.', 'bad'); return;
    }
    building = true; isRunning = true;
    const btn = document.getElementById('trace-build');
    btn.disabled = true; runBtn.disabled = true; debugBtn.disabled = true;
    setStatus('Recording…', '');
    clearConsole();
    try {
      if (!srcLoaded) { await pyodide.runPythonAsync(TRACE_SRC); srcLoaded = true; }
      if (/\bimport\s+turtle\b|\bfrom\s+turtle\s+import\b/.test(code)) {
        const canvas = document.getElementById('turtle-canvas');
        canvas.style.display = 'block';
        document.getElementById('p5-container').style.display = 'none';
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        pyodide.globals.set('_TURTLE_SRC_TEXT', TURTLE_SRC);
        await resetTurtleShim(ctx, canvas);
      }
      writeVirtualFile();
      pyodide.globals.set('_pyde_trace_src', code);
      pyodide.globals.set('_pyde_trace_inputs', pyodide.toPy(parseInputs(document.getElementById('trace-inputs').value)));
      const json = await pyodide.runPythonAsync(`_pyde_trace_run(_pyde_trace_src, _pyde_trace_inputs, ${MAX_ROWS}, ${MAX_LINES})`);
      data = JSON.parse(json);
      builtFor = code;
      const prevHidden = hiddenCols;
      hiddenCols = new Set([...prevHidden].filter(k => data.cols.some(c => c.key === k)));
      render();
      let msg = data.rows.length + ' row' + (data.rows.length === 1 ? '' : 's') + '.';
      if (data.truncated) msg += ' Stopped early: the program ran for too long (an infinite loop?), so only the first part is shown.';
      if (data.error) msg += ' The program stopped with ' + data.error.type + (data.error.line ? ' on line ' + data.error.line : '') + ': ' + data.error.msg;
      setStatus(msg, data.error ? 'bad' : '');
    } catch (err) {
      setStatus('Could not build the trace table: ' + (err.message || err), 'bad');
    } finally {
      building = false; isRunning = false;
      btn.disabled = false; runBtn.disabled = false; debugBtn.disabled = !jspiSupported;
      switchTab('trace');
    }
  }

  /* ---------------- rendering ---------------- */
  function visibleCols() { return data ? data.cols.filter(c => !hiddenCols.has(c.key)) : []; }

  function renderColumnPicker() {
    const box = document.getElementById('trace-cols');
    box.innerHTML = '';
    if (!data || !data.cols.length) return;
    box.append(el('span', { class: 'trace-cols-title' }, 'Columns:'));
    for (const c of data.cols) {
      const cb = el('input', { type: 'checkbox', checked: !hiddenCols.has(c.key) });
      cb.addEventListener('change', () => { if (cb.checked) hiddenCols.delete(c.key); else hiddenCols.add(c.key); render(); });
      box.append(el('label', { title: c.scope ? 'local variable in ' + c.scope + '()' : 'variable in the main program' }, cb, c.scope ? c.name + ' (' + c.scope + ')' : c.name));
    }
  }

  // rows shown = rows that still have something in a visible column (or output)
  function shownRows() {
    const cols = visibleCols();
    return data.rows.filter(r => r.out || cols.some(c => c.key in r.vals));
  }

  function render() {
    const wrap = document.getElementById('trace-wrap');
    ['trace-check', 'trace-reveal'].forEach(id => document.getElementById(id).disabled = !(data && practice));
    ['trace-copy', 'trace-share'].forEach(id => document.getElementById(id).disabled = !data);
    if (!data) return;
    renderColumnPicker();
    wrap.innerHTML = '';
    const cols = visibleCols();
    const table = el('table', { class: 'trace', id: 'trace-table' });
    const head = el('tr', {});
    if (showLines) head.append(el('th', {}, 'Line'));
    for (const c of cols) head.append(el('th', {}, c.name, c.scope ? el('span', { class: 'scope' }, 'in ' + c.scope + '()') : null));
    head.append(el('th', {}, 'Output'));
    table.append(el('thead', {}, head));
    const body = el('tbody', {});
    for (const r of shownRows()) {
      const tr = el('tr', {});
      if (showLines) tr.append(el('td', { class: 'line' }, r.line === null ? '' : String(r.line)));
      for (const c of cols) {
        const expected = c.key in r.vals ? r.vals[c.key] : '';
        tr.append(practice ? el('td', { 'data-col': c.key }, el('input', { type: 'text', 'aria-label': c.name })) : el('td', {}, expected));
      }
      tr.append(practice ? el('td', { class: 'out', 'data-col': '__out' }, el('input', { type: 'text', 'aria-label': 'Output' })) : el('td', { class: 'out' }, r.out));
      body.append(tr);
    }
    if (data.error) {
      const tr = el('tr', { class: 'err' });
      tr.append(el('td', { colspan: String(cols.length + 1 + (showLines ? 1 : 0)) }, data.error.type + ': ' + data.error.msg));
      body.append(tr);
    }
    table.append(body);
    if (!shownRows().length && !data.error) wrap.append(el('p', { class: 'trace-empty' }, 'Nothing changed and nothing was printed.'));
    else wrap.append(table);
  }

  /* ---------------- marking ---------------- */
  function canon(v) {
    let s = String(v).trim();
    const q = s.match(/^(["'])([\s\S]*)\1$/);
    if (q) return 's:' + q[2];
    if (s !== '' && !isNaN(Number(s))) return 'n:' + Number(s);
    if (/^(true|false|none)$/i.test(s)) return 'k:' + s.toLowerCase();
    return 's:' + s.replace(/\s+/g, '').replace(/'/g, '"');
  }
  function canonList(v) { return canon(v).replace(/\s+/g, ''); }
  function same(a, b) {
    if (canon(a) === canon(b)) return true;
    // accept a string's text without quotes: "5" vs 5, "Ann" vs Ann
    const q = String(a).trim().match(/^(["'])([\s\S]*)\1$/);
    if (q && q[2] === String(b).trim()) return true;
    return canonList(a) === canonList(b);   // [1, 2] vs [1,2], ['a'] vs ["a"]
  }

  function check() {
    if (!data || !practice) return;
    const rows = shownRows();
    const trs = document.querySelectorAll('#trace-table tbody tr:not(.err)');
    const current = {};       // value each column holds so far (for blank-cell leniency)
    let right = 0, total = 0, extra = 0;
    rows.forEach((r, i) => {
      const cells = trs[i].querySelectorAll('td[data-col]');
      cells.forEach(td => {
        const key = td.dataset.col;
        const given = td.querySelector('input').value;
        td.classList.remove('right', 'wrong');
        const old = td.querySelector('.answer'); if (old) old.remove();
        if (key === '__out') {
          if (r.out) {
            total++;
            const ok = r.out.split('\n').map(s => s.trim()).join(' ') === given.trim().replace(/\s*\/\s*/g, ' ') || same(r.out, given);
            if (ok) { right++; td.classList.add('right'); } else td.classList.add('wrong');
          } else if (given.trim()) { extra++; td.classList.add('wrong'); }
          return;
        }
        if (key in r.vals) {
          total++;
          if (same(r.vals[key], given)) { right++; td.classList.add('right'); } else td.classList.add('wrong');
          current[key] = r.vals[key];
        } else if (given.trim() && !(key in current && same(current[key], given))) {
          extra++; td.classList.add('wrong');   // a value where nothing changed (and not just repeating it)
        }
      });
    });
    let msg = right + ' / ' + total + ' correct.';
    if (extra) msg += ' ' + extra + ' cell' + (extra === 1 ? '' : 's') + ' filled in where the value didn’t change.';
    if (right === total && !extra) msg = 'All ' + total + ' correct – well done!';
    setStatus(msg, right === total && !extra ? 'good' : '');
  }

  function reveal() {
    if (!data || !practice) return;
    const rows = shownRows();
    const trs = document.querySelectorAll('#trace-table tbody tr:not(.err)');
    rows.forEach((r, i) => {
      trs[i].querySelectorAll('td[data-col]').forEach(td => {
        const key = td.dataset.col;
        const expected = key === '__out' ? r.out : (key in r.vals ? r.vals[key] : '');
        const input = td.querySelector('input');
        if (td.classList.contains('wrong') && expected) {
          if (!td.querySelector('.answer')) td.append(el('span', { class: 'answer' }, expected));
        } else if (!input.value.trim()) {
          input.value = expected;
        }
      });
    });
    setStatus('Answers shown. Untick Practice to see the full table.', '');
  }

  /* ---------------- copy / share ---------------- */
  function copyTable() {
    if (!data) return;
    const cols = visibleCols();
    const headers = (showLines ? ['Line'] : []).concat(cols.map(c => c.scope ? c.name + ' (' + c.scope + ')' : c.name), ['Output']);
    const rows = shownRows().map(r => (showLines ? [r.line === null ? '' : String(r.line)] : [])
      .concat(cols.map(c => practice ? '' : (c.key in r.vals ? r.vals[c.key] : '')), [practice ? '' : r.out]));
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cell = 'border:1px solid #444;padding:4px 10px;font-family:Consolas,monospace;min-width:60px;text-align:center;';
    const html = '<table style="border-collapse:collapse;"><tr>' + headers.map(h => '<th style="' + cell + 'background:#eee;">' + esc(h) + '</th>').join('') + '</tr>' +
      rows.map(r => '<tr>' + r.map(v => '<td style="' + cell + '">' + (esc(v).replace(/\n/g, '<br>') || '&nbsp;') + '</td>').join('') + '</tr>').join('') + '</table>';
    const tsv = [headers].concat(rows).map(r => r.map(v => String(v).replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
    const done = () => showToast(practice ? 'Blank trace table copied – paste it into a worksheet.' : 'Trace table copied.');
    try {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([tsv], { type: 'text/plain' }),
      })]).then(done, () => navigator.clipboard.writeText(tsv).then(done));
    } catch (e) {
      navigator.clipboard.writeText(tsv).then(done);
    }
  }

  function shareTask() {
    if (!data) return;
    const payload = {
      code: editor.getValue(),
      inputs: document.getElementById('trace-inputs').value,
      hidden: [...hiddenCols],
      lines: showLines,
      practice: true,
    };
    const vfile = document.getElementById('vfile-content').value;
    if (vfile) { payload.vfileName = document.getElementById('vfile-name').value.trim() || 'input.txt'; payload.vfileContent = vfile; }
    const hash = '#trace=' + LZString.compressToEncodedURIComponent(JSON.stringify(payload));
    const url = location.origin + location.pathname + hash;
    const done = () => showToast('Trace task link copied – it opens in Practice mode.');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => { history.replaceState(null, '', hash); showToast('Link is in the address bar.'); });
    else { history.replaceState(null, '', hash); showToast('Link is in the address bar.'); }
  }

  function openTaskFromHash() {
    if (!location.hash.startsWith('#trace=')) return;
    let task;
    try { task = JSON.parse(LZString.decompressFromEncodedURIComponent(location.hash.slice(7))); } catch (e) { return; }
    if (!task || typeof task.code !== 'string') return;
    editor.setValue(task.code);
    document.getElementById('trace-inputs').value = task.inputs || '';
    if (task.vfileContent !== undefined) {
      document.getElementById('vfile-name').value = task.vfileName || 'input.txt';
      document.getElementById('vfile-content').value = task.vfileContent;
    }
    hiddenCols = new Set(task.hidden || []);
    showLines = task.lines !== false;
    document.getElementById('trace-lines').checked = showLines;
    practice = task.practice !== false;
    document.getElementById('trace-practice').checked = practice;
    switchTab('trace');
    setStatus('Trace-table task: work through the program and fill in the table, then click Check.', '');
    const waitAndBuild = () => {
      if (typeof pyodideReady !== 'undefined' && pyodideReady) build().then(() => setStatus('Trace-table task: fill in the table, then click Check.', ''));
      else setTimeout(waitAndBuild, 200);
    };
    waitAndBuild();
  }

  function setStatus(msg, cls) {
    const s = document.getElementById('trace-status');
    s.textContent = msg;
    s.className = cls || '';
  }

  install();
  openTaskFromHash();
  window.pydeTrace = { build, check, reveal, get data() { return data; } };
})();
