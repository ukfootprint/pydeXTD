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

This needs Pyodide 0.27.7 or later, because `run_sync()` with JSPI on Chrome
137 or later only works from that version onwards. 0.26.2 fails with
*"WebAssembly stack switching not supported in this JavaScript runtime"*.
pyde now uses 0.29.5.

### Cost

Tracing slows Python down while debugging, by roughly 25 times on a tight
loop (a 300k-iteration loop took 36 ms untraced and about 0.9 s traced). The
slowdown only applies under Debug; Run is unchanged.

## Tests

`dev/test_debugger.py` is an offline end-to-end Playwright suite. CDN requests
are served from local npm copies. It covers the existing Run, input, turtle and
file features, and the debugger:

- stepping, breakpoints and the variables and stack panel;
- return values and changed-value highlighting;
- `input()`, Stop in every state, errors, turtle and keyboard shortcuts.

It also checks Run's Stop in every state, `time.sleep()`, and a simulated
browser without JSPI (Safari/Firefox). Setup instructions are in the file's
docstring.

## Stop for Run

Run uses a much lighter version of the same idea. A `sys.monitoring` hook on
`JUMP` (every loop iteration) and `PY_START` (every function call) events, for
the pupil's code only, hands control back to the browser via `run_sync()` about
every 50 ms. That lets the Stop button and Shift+F5 interrupt the program. It
costs about 2–3x on a tight loop, compared with roughly 25x for `sys.settrace`.

When Stop is pressed, the hook raises `PydeStopped` (an ordinary `Exception`)
at every event, so it lands outside any `try` block. If the program keeps
swallowing it for half a second (for example with `except Exception:`), the
hook escalates to `KeyboardInterrupt`.

The pupil's code is run with the filename `<program>`, so the hook ignores
pyde's own `runPython()` calls. While a program is running:

- `input()` waits on the inline console box through `run_sync()`.
- `time.sleep()` waits in slices of up to 100 ms through `run_sync()`, so the
  page never freezes and Stop works during long sleeps.

Without JSPI, Run falls back to the original behaviour: the AST generator
rewrite for `input()`, and no Stop button.

## Not done yet

- **p5 sketches in the debugger.** The `draw()` loop also can't be stopped
  yet: p5 calls it synchronously from JS.
- **Expression-level stepping** (Thonny's sub-expression evaluation).
