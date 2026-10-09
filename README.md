# pyde

A self-contained, single-file Python IDE that runs entirely in the browser — no server, no install, no build step. Double-click `index.html`, or use it live at **[milesberry.net/pyde](https://milesberry.net/pyde/)**.

Built for teaching (GCSE/A Level CS style exercises), but useful for any quick "write and run some Python" need.

## Guides

- **Teachers and tutors:** [docs/TEACHER-GUIDE.md](docs/TEACHER-GUIDE.md). Covers set-up on managed Chromebooks, data protection, teaching with each feature, making CODES packs and running mocks.
- **Students:** [docs/STUDENT-GUIDE.md](docs/STUDENT-GUIDE.md).

## Features

- **Run Python** — full CPython 3.13, compiled to WebAssembly (via [Pyodide](https://pyodide.org)), executing directly in your tab. stdout/stderr are captured and shown in the console, with errors colour-coded.
- **Debug** — step through a program one line at a time, Thonny-style: step into / over / out, continue, stop, and breakpoints (click the margin by a line number). A panel shows the call stack and each function's variables, highlights values that changed on the last step, and shows what a function just returned. `input()` works anywhere in the program while debugging, and turtle drawings build up live as you step. Needs Chrome or Edge 137+ (ChromeOS included); see [DEBUGGER.md](DEBUGGER.md).
- **Trace tables** (GCSE layer, `gcse/trace.js`) — the *Trace table* tab runs the program and builds an exam-style trace table: one row per line that changed a variable or printed something, a column per variable (values shown only when they change), and Output. Inputs can be preset ("5, 3, 0"). **Practice** blanks the table for pupils to fill in and **Check** marks it cell by cell; **Copy table** pastes a blank or completed table into Word/Docs; **Share as task** makes a link that opens straight into practice. See [gcse/README.md](gcse/README.md).
- **CODES workspace** (GCSE layer, `gcse/workspace.js`) — the *Files* button opens a panel modelled on Edexcel International GCSE (4CP0) Paper 2: load a CODES folder (folder, `.zip` or link) as read-only-by-default originals, edit and run them, and **Save as** (Ctrl+S) under the name a question gives — originals can't be overwritten, `.py` is added like IDLE. All workspace files are in Python's working folder, so `open("Q03Data.txt")` works, and files a program writes appear under *My files*, which download as a `.zip`. Includes a practice pack of original questions.
- **Pseudocode** (GCSE layer, `gcse/pseudocode.js`) — a tab pairing each construct in the Edexcel International GCSE (4CP0) pseudocode command set with its Python equivalent and the usual translation traps (inclusive `FOR … TO`, `RANDOM(n)`, `=`/`==`, `^`/`**`, `DIV`/`MOD`, `&`). Searchable; click to copy.
- **Mock exam** (GCSE layer, `gcse/mock.js`) — a timed rehearsal of the 4CP0 practical paper on the CODES workspace: 3-hour countdown that survives a reload, exam-irrelevant aids hidden, editing locked at the end, and a *Collect my files* check of every required file name (saved / wrong name / missing, plus unsaved edits) with a `.zip` download.
- **New** — a clearly-labelled way to start a blank program, distinct from just deleting everything in the editor (which reads as normal practice to a pupil watching, when the point is to save the old one and start a deliberate new one).
- **Syntax highlighting** — [CodeMirror 5](https://codemirror.net/5/) with a Python mode and a dark (Dracula) / light (Eclipse) theme toggle. Copying a selection also writes a colour-highlighted `text/html` version to the clipboard alongside the plain text, matching the current theme, so pasting into Word/OneNote/Google Docs keeps the syntax colours instead of landing as flat text.
- **Multi-cursor editing** — select a word and press `Cmd-D` / `Ctrl-D` to select the next occurrence, VS Code / Sublime style.
- **Block comment / indent** — select some lines, press `#` to toggle a comment prefix on all of them, or `Tab` / `Shift-Tab` to indent/dedent the block.
- **Download / Upload** — save your code as a `.py` file, or load one from disk.
- **Virtual input file** — paste text into the "Program input file" box and it's readable from Python via `open("filename")`. Any files your program writes are picked up automatically — text files show their content right on the page (handy on iPad, where downloading a blob is clunky), with a download link alongside; binary files are download-only.
- **Auto-recovery** — the editor and the input file both save to `localStorage` as you type and restore automatically next visit, so closing the tab, a crash, or a hung program doesn't lose your work. A page refresh after editing further than a share link always reflects your latest changes, not the stale shared snapshot.
- **Turtle graphics** — `import turtle` (or `from turtle import *`) renders to an on-page canvas.
- **p5.js sketches** — write `setup()` / `draw()` functions and call `p5.background(...)`, `p5.ellipse(...)`, etc. p5.js is loaded on demand.
- **Parsons puzzles** — turn the current code into a drag-and-drop line-reordering puzzle, with a Check button that highlights right/wrong placements, and a Copy button for the completed arrangement. Shareable as a standalone puzzle link — the answer is never loaded into the editor until solved correctly, so closing the puzzle before solving it doesn't reveal the original code.
- **Share via URL** — the whole program (or just a Parsons puzzle) is LZ-compressed into the page's URL hash, so a link fully reproduces it with no backend. If the program reads a file via the input box above, that content travels in the link too, so a shared example that depends on it actually works for whoever opens it.
- **Tidy** — auto-formats the code to PEP8 style with [autopep8](https://github.com/hhatto/autopep8), loaded on demand from wheels bundled in `vendor/` the first time it's used.

## Supported libraries

Because Python is run via Pyodide, most of the **standard library** works out of the box, including:

`math`, `random`, `string`, `re`, `datetime`, `itertools`, `collections`, `json`, `statistics`, `decimal`, `fractions`, `functools`, `dataclasses`, `enum`, `typing`, `textwrap`, `copy`, `heapq`, `bisect`, and more.

A couple of modules are **shimmed** rather than the real thing, because the browser sandbox can't support them as-is:

- **`turtle`** — the real stdlib `turtle` needs Tkinter, which isn't available in a WebAssembly browser build. Instead, `import turtle` / `from turtle import *` loads a custom canvas-backed replacement covering the common API: `forward`, `backward`, `left`, `right`, `goto`, `circle`, `penup`/`pendown`, `color`/`pencolor`/`fillcolor`, `begin_fill`/`end_fill`, `write`, `Screen()`, and the usual short-form aliases (`fd`, `bk`, `lt`, `rt`, ...).
- **`p5`** — not a real PyPI package. Detected when your code contains `import p5` / `from p5 import` or a `def draw():` function, this loads [p5.js](https://p5js.org) and exposes it as a Python module. `import p5; p5.whatever(...)` forwards any p5.js call, camelCase and all. `from p5 import *` also works, for a curated set of the common drawing/canvas/colour functions — including the snake_case and Processing-style names (`no_fill`, `no_stroke`, `size` for canvas sizing, ...) that convention expects, alongside the plain camelCase ones. Anything that would shadow a Python builtin (`map`, `min`, `max`, `print`, `pow`, ...) is deliberately left out of that starred set — `remap` is provided in place of `map`, and the rest stay reachable via `p5.min(...)` etc. Live-valued properties like `width`, `mouseX`, or `frameCount` aren't star-importable either (there's no way to make a plain Python name "live"), so use `p5.width` and friends for those.

**Not supported:** anything needing real OS features — `tkinter` (GUI), `socket` (raw networking), `subprocess`, `multiprocessing`, real threads, or the real filesystem (there's an in-memory virtual filesystem instead, used for the input/output file feature). Third-party PyPI packages (numpy, pandas, etc.) aren't loaded by default — there's no general "install any package" mechanism, deliberately: most of PyPI doesn't have a WASM build anyway, so an open door mostly just invites confusing failures. Genuinely Pyodide-supported packages (numpy included) are a small, well-understood addition when actually needed — see how the Tidy feature above loads `autopep8` via `micropip` for the pattern. If a lesson needs one, fork the repo and add it yourself, or [open an issue](https://github.com/milesberry/pyde/issues/new) to ask.

`input()` works. For plain (non-turtle, non-p5) programs, it shows an inline text box right in the console, keeping the full scrollback visible while you answer — this covers both `input()` at top-level code (a guess-the-number loop) and `input()` called from inside a helper function (very common — e.g. a `get_guess()` function, or a whole game wrapped in its own `def`), including chains of functions calling each other. If a program uses turtle/p5, or does something with `input()` too dynamic to safely rewrite (aliasing a function, passing it around as a value, recursion, decorators, a name shadowed elsewhere in the file), it falls back to a native `prompt()` dialog instead. See [colophon.md](colophon.md) for how (and why it can't always avoid the popup).

`time.process_time()` doesn't work — it always reads `0.0`, even across genuine CPU-bound work, because it relies on OS-level CPU accounting that doesn't exist inside a WebAssembly sandbox. Use `time.time()` or `time.perf_counter()` for timing code instead; both work correctly.

**Stop.** In Chrome and Edge 137 or later (Chromebooks included), a running program can always be stopped with the Stop button or Shift+F5. That includes infinite loops, long recursion, `time.sleep()` and programs waiting for `input()`. `time.sleep()` also no longer freezes the page. There, `input()` always uses the inline box, without the code rewriting described above. A hook counts loop iterations and function calls in your code and hands control back to the browser roughly every 50 ms; this costs about 2–3x on very tight loops and nothing on typical programs. In other browsers (Safari/iPad, Firefox), an infinite loop or long `time.sleep()` will still freeze the tab: reload to recover.

## Running it locally

There's nothing to install. Serve the folder with any static file server, or open `index.html` directly in a browser.

Everything (Pyodide, CodeMirror, fonts, p5, Tidy's wheels) is served from [`vendor/`](vendor/README.md), so a published copy needs **only its own host** allowed through a school web filter. There are no third-party CDNs. The one exception is opening the file straight from disk: browsers block a `file://` page from fetching the Pyodide runtime, so it falls back to jsDelivr in that case.

## License

[MIT](LICENSE) — use it, modify it, teach with it, no strings attached.
