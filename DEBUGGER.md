# Debugger

A Thonny-style line-by-line debugger for pyde. It still runs entirely in the
browser tab, with no server, no Web Worker and no special HTTP headers, so it
works from `file://` and on GitHub Pages.

## Using it

| Action | Button | Key |
|---|---|---|
| Start debugging (pauses on the first line) | 🐛 Debug | Ctrl+F5 |
| Step into: run one line, going inside any function it calls | ↧ Into | F7 |
| Step over: run one line without stopping inside functions | ↷ Over | F6 |
| Step out: finish the current function | ↥ Out | |
| Continue: run until the next breakpoint or the end | ⏩ Continue | F8 |
| Stop | ■ Stop | Shift+F5 |

These keys match Thonny's. On a Chromebook, hold the Search (launcher) key with
the top-row keys to get F5 to F8.

To set or clear a **breakpoint**, click in the margin to the left of a line
number, or on the line number itself.

While the program is paused, the panel under the console shows:

- **Call stack:** the main program plus each function call in progress. Click a
  row to see that call's variables; the editor highlights the line it's on.
- **Variables:** name, type and value. Anything that changed on the last step
  is highlighted in green. After a function returns, its return value is shown
  as `square() returned 4`.

The editor is read-only while debugging, so that line numbers stay accurate.
`input()` uses the inline console box anywhere in the program, including inside
nested functions, recursion and lambdas. Turtle drawings build up live as you
step. p5 sketches aren't supported in the debugger yet; use Run for those.

## Browser support

The debugger needs **JSPI** (WebAssembly JavaScript Promise Integration). That
means Chrome or Edge 137 or later, including ChromeOS. In other browsers,
including Safari/iPad and Firefox without a flag, the Debug button is disabled
with a tooltip explaining why, and Run works exactly as before.

## How it works

The pupil's code is compiled with the filename `<program>` and run under
`sys.settrace`. When the trace function decides to stop on a line, it calls

```python
cmd = run_sync(js._pydeDebugPause(line, snapshot_json))
```

`_pydeDebugPause` highlights the line, renders the variables panel, and returns
a JS promise. That promise resolves only when a step, continue or stop button
is pressed. Pyodide's `run_sync()` uses JSPI to suspend the WebAssembly stack in
the middle of the trace callback, so the interpreter is genuinely paused while
the page stays fully responsive. The value the promise resolves with becomes
the next stepping mode:

- `into` stops on the next line anywhere.
- `over` stops at the same or a shallower call depth.
- `out` stops at a shallower call depth.
- `continue` stops only at breakpoints.

Frames that aren't from `<program>` (the turtle and p5 shims, the standard
library) are never traced. While running freely, the trace function hands
control back to the browser every 1,500 lines (`run_sync` on a
`setTimeout(0)` promise). That keeps the page responsive and lets the Stop
button work even in an infinite loop. Stop sets a flag; the trace function
then raises `KeyboardInterrupt` in the pupil's code.

`input()` inside the debugger is replaced with
`run_sync(js._pydeDebugInput(prompt))`, which awaits the existing inline
console input box. No AST rewriting is needed, so it never falls back to the
`prompt()` popup.

Code started with `pyodide.runPythonAsync()` can stack-switch. Code started
with `runPython()` or a plain synchronous proxy call can't. The debugger is
therefore always started with `runPythonAsync('_pyde_debug_run(...)')`.

Pyodide was upgraded from 0.26.2 to 0.29.5 (Python 3.12 to 3.13) for this,
because `run_sync()` with JSPI on Chrome 137 or later only works from Pyodide
0.27.7 onwards. 0.26.2 fails with *"WebAssembly stack switching not supported
in this JavaScript runtime"*.

### Cost

Tracing slows Python down while debugging, by roughly 25 times on a tight
loop (a 300k-iteration loop took 36 ms untraced and about 0.9 s traced). The
slowdown only applies under Debug; Run is unchanged.

## Tests

`dev/test_debugger.py` is an end-to-end Playwright suite. It has 36 checks:
existing Run, input, turtle and file features on the new Pyodide, plus
stepping, breakpoints, the variables and stack panel, return values, changed-value
highlighting, `input()`, Stop in each state, errors, turtle under the debugger,
and keyboard shortcuts. Setup instructions are in the file's docstring.

## Not done yet

- **Stop for Run.** The same periodic `run_sync` yield could give normal
  runs a Stop button. Measure the overhead first.
- **Simpler input() on JSPI browsers.** Normal Run could use `run_sync` for
  `input()` there, and keep the AST generator rewrite only as the fallback.
- **p5 sketches in the debugger.**
- **Expression-level stepping** (Thonny's sub-expression evaluation). This
  would be a much bigger job.
