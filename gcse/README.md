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
