# pyde GCSE edition: a proposal

*Draft for discussion with Miles Berry. Prepared by Simon (ukfootprint),
October 2026.*

## Summary

pyde already does most of what a GCSE Python student needs in a browser. It
does it without accounts, without a server, and without any pupil data
leaving the device. That last property is what lets a school approve a tool
quickly.

This proposal is for a **thin GCSE layer on top of pyde, hosted separately**.
pyde itself stays general-purpose and stays yours. The layer adds features
that map directly onto how GCSE Computer Science is examined. The headline
feature is **trace tables**: every exam board tests them, and no desktop IDE,
Thonny included, produces them.

Two things are asked of pyde:

1. Consider the three pull requests already prepared:
   - Pyodide 0.29.5
   - a step debugger
   - Stop for Run, with non-blocking `time.sleep()` and `input()`
2. Consider a small **extension-hooks** pull request (about 50 lines). It
   would let a layer like this live alongside pyde rather than in a fork.

## Background

This started with one GCSE student on a school-managed Chromebook. The usual
route, Thonny in the ChromeOS Linux container, bypasses the school's
Smoothwall filtering, so it isn't acceptable for safeguarding. pyde was the
best browser alternative. The fork
([ukfootprint/pydeXTD](https://github.com/ukfootprint/pydeXTD), live at
<https://ukfootprint.github.io/pydeXTD/>) adds the following:

- **A Thonny-style debugger:**
  - step into, over and out; breakpoints;
  - call stack and variables, with changed values highlighted;
  - return values.

  It uses `run_sync()` with JSPI, so it is still one file, still works from
  `file://`, and needs no Worker and no special HTTP headers.
- **Stop for Run**, `time.sleep()` that doesn't freeze the tab, and `input()`
  that always uses the inline box.
- **Self-hosted dependencies**, so a school filter only has to allow one
  host. This is kept in the fork only; the PRs leave pyde's CDN approach
  as it is.

## Design principles for the GCSE layer

1. **No personal data.** No accounts, no analytics, no cloud storage of pupils'
   work. Code stays in the browser's local storage and in files the pupil
   saves. This keeps the tool outside the territory of DPIAs, data processing
   agreements and the ICO Children's Code, and it keeps hosting static and
   cheap.
2. **Works on a locked-down school Chromebook.** One host to allow, no installs,
   and nothing that needs the Linux container.
3. **Exam-faithful.** The features mirror the exam questions pupils will meet
   (trace tables, testing evidence, file handling, SQL) in the boards' own
   formats.
4. **Layered, not forked.** GCSE code lives in separate files, so pyde updates
   merge cleanly.
5. **Deterministic and offline.** No AI features. Error help and marking are
   rule-based.

## What to build

### Tier 1 (about 2–3 weeks)

| Feature | What it does | Why it matters for GCSE |
|---|---|---|
| **Trace tables + practice mode** | Built from the debugger's steps: line, one column per variable (a value appears only when it changes), output. In practice mode the cells are blank and the pupil fills them in; each cell is then marked. Shareable as a link. | Every board's papers include "complete the trace table". This turns the debugger into exam practice. |
| **Shell after Run** | A `>>>` prompt in the finished program's namespace; the variables panel stays visible | pyde's biggest gap compared with Thonny |
| **Friendly error notes** | Plain-English notes beside the traceback for the 15–20 errors that cause most GCSE failures. Examples: str + int after `input()`; a `NameError` from a typo, with a "did you mean…?" hint; `IndexError` off-by-one; `int("abc")`; `=` versus `==`. | This is where most beginners get stuck |
| **Exam-board profiles** | **Edexcel GCSE (1CP2):** checks code against the published Programming Language Subset, with an "exam conditions" mode (Paper 2 is an onscreen Python exam). **Edexcel International GCSE (4CP0):** see below. **OCR:** an Exam Reference Language panel beside the code. **AQA:** pseudo-code shown beside the code. | Practice in the board's own language and conditions |

### Edexcel International GCSE (4CP0)

Paper 2 is a three-hour practical exam on a workstation with a code editor
and interpreter and no internet. Candidates get a **CODES folder** of code and
data files. They must not overwrite the originals, and they save each answer
under the name the question gives. A pseudocode command set is provided.
Python, C# or Java may be used. The 4CP0 profile therefore needs:

- **A CODES-folder workspace.** *Built:* `gcse/workspace.js`; see
  `gcse/README.md`.
- **A pseudocode command set panel** showing the Python equivalent of each
  construct, with the usual translation traps. *Built:* `gcse/pseudocode.js`.
- **An exam-conditions mock mode:** a 3-hour timer, aids switched off, saving
  under the given names enforced, and a "collect my files" step at the end.

The exam itself runs on a centre-prepared PC with a local IDE, not a
Chromebook. Pupils should rehearse there as well, using the same IDE and
folder layout.

### Tier 2 (next term)

- **SQL**, using Pyodide's `sqlite3`, with starter databases and results shown
  as tables.
- **Several input files and CSV shown as tables.** File handling is on every
  specification.
- **Test tables.** The pupil enters normal, boundary and erroneous inputs; the
  tool runs the program once per row and records the result, which produces
  the testing evidence mark schemes ask for.
- **Challenge packs.** A teacher writes a task with hidden tests. The pupil's
  functions are checked in the browser, and the pack is shared as a link with
  no accounts.
- **Save to Drive on ChromeOS.** Ctrl+S writes a real `.py` file to My Files or
  Google Drive.

### Tier 3 (if there is demand)

- Step back through debugger history, and local versus global colouring.
- Offline-capable install (a PWA), force-installable from the Google Admin
  console.
- Thonny-style expression-by-expression evaluation (lowest priority: trace
  tables teach the examined skill).

### Deliberately out of scope

Pupil accounts, teacher dashboards, cloud storage of work, analytics and AI
helpers. Each brings in children's personal data, and with it a DPIA, a data
processing agreement per school, Children's Code obligations and breach duties.
Each also turns a static site into a service someone has to run.

## Architecture

### Proposed extension hooks in pyde

This would be a small PR to pyde. pyde behaves exactly as now when no
extension is configured, and it still works by double-clicking the file.

```js
window.pyde = {
  onRunStart(fn), onRunEnd(fn),          // fn({ code, result, error })
  onDebugPause(fn),                      // fn(snapshot): line, frames, vars
  addOutputTab(name, element),           // e.g. "Trace", "SQL"
  addToolbarButton({ id, label, title, onClick }),
  registerPythonModule(name, source),    // e.g. a gcse helper module
  onError(fn),                           // fn(tracebackText) -> extra HTML
};
// plus: load any scripts listed in an `extensions` array or ?ext= parameter
```

### Repository layout for the GCSE edition

```
pyde-gcse/
  vendor/pyde/index.html   # pyde, unmodified and pinned; a GitHub Action
                           # opens an update PR when pyde changes
  gcse/*.js, gcse/*.py     # trace tables, errors, board profiles, SQL, tests
  content/                 # original exam-style tasks and starters (JSON)
  vendor/                  # self-hosted libraries (one host for filters)
  build.sh                 # dist/index.html = pyde + <script src="gcse/gcse.js">
```

If the hooks aren't wanted in pyde, the fork keeps the same separation: GCSE
code in `gcse/`, with only a few one-line hooks in `index.html`.

## Hosting

| Option | Pros | Cons |
|---|---|---|
| GitHub Pages on the fork (current pilot) | Free, working | A personal `github.io` address; continuity depends on one account |
| **Neutral custom domain on Cloudflare Pages or GitHub Pages** (recommended) | Free or cheap; can be classified as Education by filter vendors; survives a change of maintainer | Someone has to own and renew the domain |
| Under milesberry.net/pyde | Trusted name in UK computing education | Puts maintenance on Miles |
| A community body such as Computing at School | Best long-term reach and continuity | Slower; governance and branding questions |
| Schools host their own copy | Maximum control, trivial DPIA | Each school updates its own copy |

### Practical points

- **Filter categorisation.** New domains often start "uncategorised" and are
  blocked by default. Submit the domain to Smoothwall, Lightspeed and
  Netsweeper for an Education categorisation.
- **Managed Chromebooks.** Add the URL to the Google Admin allowlist and
  force-install it as a web app for the pupils' group.
- **Privacy notice.** A one-page statement: no cookies, no analytics, no
  accounts; the host's server logs are kept for a stated period. Add a DPIA
  screening note concluding that no full DPIA is required.
- **Copyright and trade marks.** Write original exam-style tasks; don't
  reproduce past papers. Build the Edexcel subset checker from the published
  rules without republishing the document. Use exam board names only
  descriptively; nothing should imply endorsement.
- **Licences.** The software stays MIT, keeping Miles's copyright notice.
  Teaching content is CC BY-SA, so teachers can remix it.

## Ownership

Recommendation: a **neutral GitHub organisation** (for example `pyde-edu`)
holds the repository and the domain. It should have two or more admins
(Simon, plus Miles if willing), with the software free and MIT-licensed. Any
paid support or bespoke content packs for schools can be offered separately,
without changing the tool's no-data design.

## Questions for Miles

1. Are you happy to receive the three prepared PRs (Pyodide 0.29.5, debugger,
   Stop for Run)?
2. Would you accept an extension-hooks PR, or would you rather GCSE features
   lived in pyde itself, or entirely in a separate project?
3. Would you be interested in co-owning a GCSE edition, or in having it linked
   from or hosted under milesberry.net?
4. Any concerns about naming? "pyde GCSE" only with your agreement.

## Status

- **Done in the fork:** debugger, Stop for Run, self-hosting. 59 automated
  checks in headless Chromium.
- **Done:** trace tables with practice mode, marking, copy-to-worksheet and
  shareable task links (`gcse/trace.js`).
- **Done:** a CODES-folder workspace for 4CP0 Paper 2 practice
  (`gcse/workspace.js`).
- **Done:** a 4CP0 pseudocode reference (`gcse/pseudocode.js`).
- Each module is attached to pyde by one `<script>` tag. There are 93
  automated checks in total.
- **Next:** pilot with a GCSE student on a school Chromebook behind Smoothwall.
