# GCSE layer

These are self-contained additions aimed at GCSE Computer Science. Each one is
a single file. `index.html` attaches it with one `<script>` tag, and the file
adds its own tab, styles and Python helpers. See
[docs/GCSE-EDITION.md](../docs/GCSE-EDITION.md) for the wider plan.

## Trace tables (`trace.js`)

**Build trace table** runs the program under `sys.settrace` in a fresh
namespace and records, line by line:

- **one row per executed line that changed a variable or printed something;**
- **one column per variable**, in order of first appearance. A value appears
  only on the row where it changes, as in mark schemes. Function locals are
  labelled, e.g. `n in square()`, and parameters get their values on the
  `def` line;
- **an Output column** with what that line printed.

Strings are shown in double quotes, including inside lists and dicts. A
recording stops after 300 rows or 20,000 lines, so an infinite loop can't hang
the page. An error ends the table with the error message.

**Inputs.** Type values such as `5, 3, 0` and `input()` takes them in order,
echoing them to the console. If none are given, `input()` asks in the console
as usual. Preset inputs also work in browsers without JSPI (Safari, Firefox).

**Columns.** Untick variables to match the columns of an exam question. Rows
that no longer show anything are dropped. Line numbers can be hidden too.

**Practice.** Practice blanks every answer cell. **Check** marks each cell:

- **Correct:** green.
- **Wrong:** red.
- **Blank where nothing changed:** fine, and so is repeating the unchanged
  value.
- **Leniency:** quotes are optional, `5` matches `5.0`, `True` matches
  `true`, and list spacing and quote style are ignored.

**Reveal** fills the blanks and shows the right answer beside each wrong
cell.

**Copy table** copies HTML and tab-separated text, so it pastes as a real
table into Word, Google Docs or OneNote. In Practice mode it copies a blank
table for a worksheet.

**Share as task** copies a `#trace=` link carrying the code, the preset
inputs, the hidden columns and the line-number setting. It opens straight
into a blank Practice table. Like pyde's other share links, everything lives
in the URL fragment, which browsers never send to the server.

## CODES-folder workspace (`workspace.js`)

This is practice for **Pearson Edexcel International GCSE Computer Science
(4CP0) Paper 2**. In that exam candidates get a CODES folder of unfinished code
and data files, must not overwrite the originals, and save each answer under
the name the question gives. The **📁 Files** button opens a side panel with
three sections:

- **Scratch program:** pyde's usual single editor. New, Upload and share
  links always act on this, never on a workspace file.
- **CODES (originals):** files loaded from a CODES pack. They open, can be
  edited and run, and show an *edited* badge when changed. They are never
  overwritten: **Save** (Ctrl+S) on an original opens **Save as**. Save as
  starts from the current name, because reading the question for the required
  name is part of the skill. It refuses an original's name and adds `.py` if
  there is no extension, as IDLE does. After saving, the original goes back to
  its unedited text.
- **My files:** the pupil's saved work. These files save as you type. Ctrl+S
  confirms the save, and Ctrl+Shift+S always opens Save as.

All workspace files are written into Python's working folder before **Run**,
**Debug** and **Trace table**, so `open("Q03Data.txt")` works. Files a program
writes appear under My files. A program changing an original leaves the CODES
copy untouched, with a message to say so. Running a data file is refused with
a message.

**Loading a pack.** Open a CODES folder, open a `.zip` (folders inside are
flattened and `__MACOSX` entries skipped), or follow a `#codes=` link made with
**Share pack**, which teachers can use. Loading a pack replaces the current
originals and keeps My files. **Try the practice pack** loads four files:
three original exam-style questions (fix errors, complete a loop, read a data
file) and a data file. They were written for pyde, not taken from Pearson
papers.

**Keeping work.** Everything is stored in this browser's local storage,
including unsaved edits to originals, which survive a reload. **My files
.zip** downloads the pupil's files for handing in or backing up. As with the
rest of pyde, nothing is sent to a server.

## Pseudocode reference (`pseudocode.js`)

The **Pseudocode** tab pairs each construct in Pearson's Edexcel International
GCSE (4CP0) pseudocode command set with its Python equivalent. A **Watch out
for** column lists the points where a word-for-word translation goes wrong:

- `FOR … FROM 1 TO 10` includes 10, so it is `range(1, 11)`;
- `RANDOM(n)` includes `n`, as `randint(0, n)` does;
- `=` is `==`, `<>` is `!=` and `^` is `**` (in Python `^` is XOR, with no
  error to warn you);
- `DIV` is `//` and `MOD` is `%`;
- `/` is always a float in Python;
- `&` converts numbers to text, but `+` doesn't;
- `REPEAT … UNTIL` becomes `while True` with a `break`;
- `RECEIVE … (INTEGER)` needs `int(input())`.

There is a find box at the top of the tab, and clicking any Python example
copies it.

**Copyright.** Only the short syntax templates (the pseudocode itself) are
taken from Pearson's booklet. All the explanations and examples are original.
The booklet itself is © Pearson and is not included in this repository.
Pupils get a copy with the exam paper, and the panel links to Pearson's 4CP0
page.

## Exam-conditions mock (`mock.js`, needs `workspace.js`)

**⏱ Mock exam** turns the CODES workspace into a timed rehearsal of the
4CP0 practical paper. It needs a CODES pack to be loaded first.

**Setting up.** Choose a time; the default is 180 minutes, as in the real
paper. Enter the file names the questions ask for, one per line. These are
filled in automatically from instructions such as "Save your amended code as
Q01FINISHED" in the CODES files. Check them against the question paper,
because in the real exam they are printed there.

**While it runs:**

- **The countdown** keeps going through a reload or a closed tab, because it
  works from a fixed end time. The bar turns amber at 30 minutes and red at
  5, and warnings pop up at 30, 10 and 5 minutes.
- **These aids are hidden**, because the exam doesn't provide them: Trace
  table, the Python pseudocode reference, Parsons, Tidy, sharing, uploading,
  loading other packs and deleting files.
- **These stay**, as a normal exam IDE has them: Run, Debug, Save as, the
  scratch program and Download.

**When time is up, or after Finish early:**

- Editing locks: the editor is read-only, Run, Debug and Save as disappear,
  and F5–F8 and Ctrl+S are blocked.
- **Collect my files** opens. It checks each required name: *saved* for an
  exact match, *wrong name* for a near miss (wrong case, missing `.py`,
  stray `_` or `-`, with what was actually saved), or *missing*.
- It lists any other saved files and warns about unsaved edits to originals,
  which would be lost in the exam.
- **Download my files** saves a dated `mock-YYYY-MM-DD.zip`. **End mock**
  unlocks everything again.

**Saving.** Files are written to browser storage straight away on Save as,
delete and load, so closing the tab immediately afterwards loses nothing.
Typing is saved after a short pause, and any pending typing is flushed when
the page is hidden or closed.

## Help menu and guide viewer (`help.js`)

This replaces the toolbar's About button with **❓ Help**, which has three
entries:

- **Student guide** (`docs/STUDENT-GUIDE.md`);
- **Teacher & tutor guide** (`docs/TEACHER-GUIDE.md`);
- **About this page** (pyde's original pop-up, which now also links to both
  guides).

**Viewing.** Guides are fetched from the same site and rendered with marked,
which is vendored and loaded on first use. They don't need GitHub, which a
school filter may block.

- Links between docs open in the viewer.
- `#heading` links scroll, using GitHub-style heading ids.
- External links open in a new tab.
- **Print** prints only the guide, so it can be saved as a PDF.
- From a `file://` page the viewer can't fetch the guides, so it offers a
  GitHub link instead.

**Links.** `#guide=student` and `#guide=teacher` open a guide on load.

**During a mock exam** only About is offered, because the guides contain the
Python equivalents.

The site has a `.nojekyll` file, so GitHub Pages serves the `.md` files as they
are instead of converting them to HTML.
