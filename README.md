# pydeXTD: pyde, extended for GCSE

A browser-based Python IDE for GCSE and International GCSE Computer Science.
It runs entirely in the browser tab: there is no server, nothing to install and
no account, so it works on **school-managed Chromebooks without the Linux
container**.

**Live:** <https://ukfootprint.github.io/pydeXTD/>

pydeXTD is a fork of **[pyde](https://github.com/milesberry/pyde) by Miles Berry**.
It keeps everything pyde does (single page, no build step, Python running
locally through WebAssembly) and adds the features below.

## Guides

- **Teachers, tutors and IT staff:** [docs/TEACHER-GUIDE.md](docs/TEACHER-GUIDE.md).
  Covers set-up on managed Chromebooks, data protection, teaching with each
  feature, making CODES packs and running mocks.
- **Students:** [docs/STUDENT-GUIDE.md](docs/STUDENT-GUIDE.md).

## Why this fork exists

It started with a GCSE student on a school-managed Chromebook. The usual way to
run Thonny or IDLE on a Chromebook is the Linux (Crostini) container. Traffic
from that container can bypass the school's web filtering and safeguarding
(Smoothwall and similar), so it is turned off on managed devices.

pyde already ran Python safely inside Chrome. It lacked three things: a
Thonny-style debugger, a way to stop a runaway program, and the exam-specific
practice the student needed. pydeXTD adds those, and makes the site easy for a
school to approve.

## What's new compared with pyde

| | pyde | pydeXTD |
|---|---|---|
| **Debugger** | – | Thonny-style: step into, over and out; breakpoints; call stack and variables; changed values highlighted; return values shown |
| **Stopping a program** | Reload the tab | **■ Stop** / Shift+F5 ends infinite loops, long recursion, `time.sleep()` and a waiting `input()` |
| **`time.sleep()`** | Freezes the tab | Waits without freezing the page |
| **`input()`** | Inline box via code rewriting, with a `prompt()` fallback | Always the inline box (Chrome/Edge) |
| **Trace tables** | – | Exam-style tables, a marked Practice mode, copy-to-worksheet and shareable tasks |
| **CODES-folder workspace** | One file plus one input file | Multi-file workspace modelled on Edexcel International GCSE (4CP0) Paper 2 |
| **Pseudocode reference** | – | 4CP0 pseudocode command set next to the Python equivalents, with the usual translation traps |
| **Mock exam** | – | Timed rehearsal of the 4CP0 practical paper with a "collect my files" check |
| **Hosting** | Libraries from public CDNs | Everything self-hosted: a school filter allows **one host** |
| **Python** | 3.12 (Pyodide 0.26.2) | 3.13 (Pyodide 0.29.5) |
| **Keyboard** | – | Thonny keys: F5 run, Ctrl+F5 debug, F6/F7/F8 step, Shift+F5 stop |
| **Help** | About pop-up | Help menu with the student and teacher guides shown in the page |
| **Tests** | – | 112 automated end-to-end checks in headless Chromium |

## Features added in pydeXTD

### Debugger ([DEBUGGER.md](DEBUGGER.md))

**🐛 Debug** (Ctrl+F5) pauses on the first line. The controls are:

- **Into** (F7), **Over** (F6), **Out**, **Continue** (F8) and **Stop**
  (Shift+F5).
- **Breakpoints:** click the margin or a line number.

A panel under the console shows:

- **the call stack**: click a frame to see its variables;
- **the variables**, with the values changed by the last step highlighted;
- **what a function returned**.

`input()` works anywhere in the program while debugging, turtle drawings
build up as you step, and the editor is read-only while debugging.

**How it works.** The program runs under `sys.settrace`. When it should stop,
the trace function calls Pyodide's `run_sync()` on a promise that the step
buttons resolve. JSPI (WebAssembly JavaScript Promise Integration) suspends
the WebAssembly stack, so the interpreter genuinely pauses while the page
stays responsive. This needs no Web Worker, no `SharedArrayBuffer` and no
COOP/COEP headers, so it still works as a single static page.

### Stop for Run

While a program runs, a red **■ Stop** button (Shift+F5) appears. It works by:

- **A light `sys.monitoring` hook** on loop jumps and function calls, which
  hands control back to the browser about every 50 ms. Stop then interrupts
  the program. This costs about 2–3 times on very tight loops and nothing
  noticeable on typical programs.
- **`time.sleep()` and `input()`** waiting through `run_sync()`, so they no
  longer freeze the tab.

F5 runs the program, as in Thonny.

### GCSE layer ([gcse/README.md](gcse/README.md))

These are self-contained modules, each attached to the page by one
`<script>` tag:

- **Trace tables** (`gcse/trace.js`). The **Trace table** tab runs the program
  and builds an exam-style table:
  - one row per line that changed a variable or printed something;
  - values shown only when they change;
  - inputs can be preset, e.g. `5, 3, 0`;
  - variables can be hidden to match a question.

  **Practice** blanks the table and **Check** marks it cell by cell, leniently
  on quotes, number format and spacing. **Copy table** pastes a blank or
  completed table into Word or Docs. **Share as task** creates a link that
  opens straight into Practice mode.
- **CODES-folder workspace** (`gcse/workspace.js`). **📁 Files** opens a panel
  modelled on 4CP0 Paper 2:
  - originals that can be edited and run but **never overwritten**;
  - **Save as** (Ctrl+S) under the name a question gives, adding `.py` as
    IDLE does;
  - data files readable with `open()`, and files a program writes appear
    under *My files*;
  - packs load from a folder, a `.zip` or a share link; *My files* download as
    a `.zip`.

  It includes a practice pack of original questions.
- **Pseudocode reference** (`gcse/pseudocode.js`). This pairs each construct
  in the 4CP0 pseudocode command set with its Python equivalent and its
  traps: `FOR … TO` is inclusive, `RANDOM(n)` includes `n`, `=` versus `==`,
  `^` versus `**`, `DIV`/`MOD`, and `&` versus `str()`. It has a search box
  and click-to-copy.
- **Mock exam** (`gcse/mock.js`). This is a timed rehearsal of the practical
  paper:
  - a 3-hour countdown that survives a reload;
  - aids the exam doesn't provide are hidden;
  - editing locks at the end;
  - **Collect my files** checks every required file name (saved, wrong name or
    missing) and flags unsaved edits, then downloads a dated `.zip`.

### Help menu (`gcse/help.js`)

**❓ Help** replaces the About button with a menu:

- the **Student guide**;
- the **Teacher & tutor guide**;
- **About this page**.

The guides are rendered inside the page from the same site, so they work
behind a filter. Links between guides open in the viewer, and the guides can
be printed. `#guide=student` and `#guide=teacher` link to them directly.

### Self-hosting ([vendor/README.md](vendor/README.md))

Pyodide, CodeMirror, lz-string, p5.js, marked (for the guides), the Fira Code font and Tidy's
autopep8/pycodestyle wheels are all served from `vendor/`. There are no
third-party CDNs and no PyPI downloads at runtime, so a school web filter only
needs to allow the site's own host. Opening `index.html` straight from disk
(`file://`) still works: in that case only, Pyodide is loaded from jsDelivr.

## Features inherited from pyde

- **Run Python:** full CPython (3.13 here) compiled to WebAssembly by
  [Pyodide](https://pyodide.org), running in the tab. Output and errors appear
  in the console, colour-coded.
- **New:** a clearly labelled way to start a blank program.
- **Syntax highlighting:** [CodeMirror 5](https://codemirror.net/5/) with
  Dracula (dark) and Eclipse (light) themes. Copying a selection also copies a
  colour-highlighted version, so pasting into Word, OneNote or Google Docs
  keeps the colours.
- **Editing shortcuts:** `Ctrl-D` / `Cmd-D` selects the next occurrence of a
  word. With lines selected, `#` toggles a comment on each of them, and Tab or
  Shift-Tab indents or dedents the block.
- **Download / Upload:** save the code as a `.py` file, or load one.
- **Program input file:** paste text into the box and read it from Python with
  `open("filename")`. Files the program writes are shown on the page with a
  download link.
- **Auto-recovery:** the editor and the input file are saved to `localStorage`
  as you type, so a crash or a hung program doesn't lose work.
- **Turtle graphics:** `import turtle` draws on an on-page canvas, using a
  canvas-based stand-in for the standard library module.
- **p5.js sketches:** write `setup()` and `draw()` and call `p5.background(...)`
  and so on. p5.js loads on demand.
- **Parsons puzzles:** turn the current code into a drag-and-drop ordering
  puzzle, shareable as a link that never reveals the answer.
- **Share via URL:** the program, and its input file, are compressed into the
  link's `#` fragment, so no server is needed.
- **Tidy:** auto-formats code to PEP 8 with
  [autopep8](https://github.com/hhatto/autopep8). In pydeXTD it uses the
  wheels bundled in `vendor/`.

## Supported libraries

Most of the **standard library** works, including `math`, `random`, `string`,
`re`, `datetime`, `itertools`, `collections`, `json`, `statistics`, `decimal`,
`fractions`, `functools`, `dataclasses`, `enum`, `typing`, `textwrap`, `copy`,
`heapq` and `bisect`.

Two modules are **stand-ins** rather than the real thing, because the browser
sandbox can't support them as they are:

- **`turtle`**: the real module needs Tkinter. The stand-in covers the common
  API: `forward`, `backward`, `left`, `right`, `goto`, `circle`,
  `penup`/`pendown`, `color`/`pencolor`/`fillcolor`, `begin_fill`/`end_fill`,
  `write`, `Screen()`, and the short aliases (`fd`, `bk`, `lt`, `rt`, …).
- **`p5`**: a bridge to [p5.js](https://p5js.org). `import p5; p5.whatever(...)`
  forwards any p5.js call. `from p5 import *` gives a curated set that leaves
  out names that would shadow Python built-ins (use `remap` instead of `map`).
  Live values such as `p5.width` and `p5.mouseX` need the `p5.` prefix.

**Not supported:**

- anything needing real operating-system features: `tkinter`, `socket`,
  `subprocess`, `multiprocessing`, real threads, or the real filesystem (there
  is an in-memory one instead);
- third-party PyPI packages such as numpy. This is deliberate; see how Tidy
  loads bundled wheels for the pattern if a lesson needs one.

`time.process_time()` always reads `0.0` inside WebAssembly; use
`time.time()` or `time.perf_counter()` instead.

## Browser support

| | Chrome / Edge 137+ (incl. ChromeOS) | Safari (incl. iPad), Firefox |
|---|---|---|
| Run, turtle, p5, Parsons, Tidy, sharing | ✓ | ✓ |
| CODES workspace, pseudocode reference, mock exam | ✓ | ✓ |
| Trace tables | ✓ | ✓ with preset inputs |
| Debugger, Stop, non-blocking `time.sleep()` | ✓ | – (disabled, with an explanation) |
| `input()` | inline box | inline box via code rewriting, `prompt()` fallback |

## Privacy

- **No accounts, cookies or analytics, and no server-side code.** Python runs
  in the browser tab.
- **Work is stored only in that browser's `localStorage`** on that device.
- **Share links** keep the code in the URL fragment, which browsers never send
  to the server.

The [teacher guide](docs/TEACHER-GUIDE.md#3-data-protection-and-safeguarding)
has a summary written for DPIA screening.

## Running it locally

There's nothing to install. Serve the folder with any static file server
(`python -m http.server`), or open `index.html` directly. To publish it,
GitHub Pages or any static host works. The live site is GitHub Pages on the
`debugger` branch.

## Project layout

```
index.html            the app (pyde + debugger + Stop), plus the <script> tags for the GCSE layer
gcse/                 trace.js, workspace.js, pseudocode.js, mock.js, help.js, README.md
vendor/               self-hosted Pyodide, CodeMirror, lz-string, p5, fonts, wheels (+ licences)
dev/test_debugger.py  end-to-end Playwright suite (112 checks)
docs/                 TEACHER-GUIDE.md, STUDENT-GUIDE.md, GCSE-EDITION.md (roadmap / proposal)
DEBUGGER.md           how the debugger and Stop work
colophon.md           pyde's original build notes
```

## Tests

`dev/test_debugger.py` runs the app in headless Chromium. The page is served
over HTTP with **every other host blocked**, which proves the site needs only
one host. The suite covers:

- the original pyde features;
- the debugger, Stop and `time.sleep()`;
- trace tables, the workspace, the pseudocode tab and the mock exam;
- the `file://` fallback, and a simulated browser without JSPI.

Setup instructions are in the file's docstring.

## Relationship with pyde

The aim is to keep pydeXTD close to pyde and to offer the general-purpose
parts back:

- Pull-request branches for Miles are prepared on this fork:
  - `pr/1-pyodide-0.29`
  - `pr/2-debugger`
  - `pr/3-run-stop`

  They use pyde's CDN approach and leave out the GCSE layer and self-hosting.
- The GCSE layer is kept in separate files, so pyde updates merge cleanly. The
  proposal for a GCSE edition, including optional extension hooks in pyde, is
  in [docs/GCSE-EDITION.md](docs/GCSE-EDITION.md).

For issues with pyde itself, see
<https://github.com/milesberry/pyde/issues>. For the GCSE features, use this
fork's issues.

## Licence and credits

[MIT](LICENSE). pyde is © Miles Berry, and the licence notice is kept. The
pydeXTD additions are released under the same licence. Bundled libraries keep
their own licences (see [vendor/README.md](vendor/README.md)): Pyodide
MPL-2.0, CodeMirror MIT, lz-string MIT, p5.js LGPL-2.1, marked MIT, Fira Code OFL-1.1,
autopep8 and pycodestyle MIT.

The practice pack is original material. Pearson's question papers, code files
and pseudocode booklet are © Pearson and are not included. Exam board names
are used only to say what the material is for; nothing here is endorsed by
any exam board.
