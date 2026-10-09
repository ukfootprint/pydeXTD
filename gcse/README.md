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
