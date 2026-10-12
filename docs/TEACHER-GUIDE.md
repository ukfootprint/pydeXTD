# pyde (GCSE edition): guide for teachers and tutors

**Live site:** <https://ukfootprint.github.io/pydeXTD/>
**Student guide:** [STUDENT-GUIDE.md](STUDENT-GUIDE.md)

This guide covers:

- what the tool is and why it suits school-managed devices;
- how IT staff set it up;
- the data-protection position;
- how to use each feature in teaching;
- how to make your own practice packs and run a mock of the Edexcel
  International GCSE (4CP0) practical paper.

---

## 1. What it is

pyde is a Python editor and runner that works entirely inside the web browser.
It was built by Miles Berry. This edition adds features aimed at GCSE and
International GCSE Computer Science:

| Feature | What it gives you |
|---|---|
| **Debugger** | Thonny-style step-by-step execution: step into, over and out; breakpoints; a live view of variables and the call stack, with changed values highlighted. |
| **Stop button** | Stops any running program, even an infinite loop, without reloading the page. `time.sleep()` and `input()` no longer freeze the page. |
| **Trace tables** | Builds an exam-style trace table for any program. A Practice mode blanks it for students to fill in and marks it cell by cell. Tables can be copied into worksheets or shared as tasks. |
| **CODES-folder workspace** | Practice with an exam-style folder of starter code and data files: originals that can't be overwritten, *Save as* under the names questions give, and data files your programs can open. |
| **Pseudocode reference** | Each construct in the 4CP0 pseudocode command set beside its Python equivalent, with the usual translation traps. |
| **Mock exam** | A timed rehearsal of the 4CP0 practical paper: countdown, aids hidden, editing locked at the end, and a check that every required file was saved under the right name. |

It also keeps everything the original pyde does: turtle graphics, p5.js
sketches, Parsons puzzles, Tidy (auto-formatting), share links, and a
program input file.

### Why it suits school-managed Chromebooks

The usual way to run Thonny or IDLE on a Chromebook is the Linux container
(Crostini). Traffic from the Linux container can bypass the school's web
filtering and safeguarding (Smoothwall, Lightspeed and similar), so it is
usually turned off on managed devices. pyde runs inside Chrome itself, so
filtering, monitoring and Google Admin policies all keep working. Python
runs locally in the browser tab (CPython compiled to WebAssembly), not on a
server.

---

## 2. Setting it up (for IT staff)

### Browser requirements

- **Chrome or Edge 137 or later, including ChromeOS:** everything works.
- **Safari (including iPad) and Firefox:** Run, turtle, Parsons, Tidy, share
  links, the CODES workspace, the pseudocode reference and trace tables
  (with preset inputs) all work. The **debugger** and the **Stop button** need
  a recent Chrome or Edge and are switched off elsewhere, with an
  explanation. Without Stop, an infinite loop freezes the tab until it is
  reloaded.

### Web filter allow-list

Every file the page uses (Python, the editor, fonts, libraries) is served
from the same site, so the filter only needs to allow **one host**:

- `ukfootprint.github.io`

If you move to your own domain later, allow that instead. A newly registered
domain is often blocked as "uncategorised" by default, so submit it to your
filter vendor for an *Education* categorisation.

> Opening `index.html` directly from a USB stick or disk (a `file://` address)
> also works, but in that case Python is loaded from `cdn.jsdelivr.net`.

### Google Admin console (managed Chromebooks)

1. Add the site to the URL allow-list for the student organisational unit.
2. Optionally, **force-install it as a web app** for the students' group so it
   appears in the launcher.
3. Keep **Linux development environment** turned off for students. That is
   the point of using this tool.

### Checking it works on a student device

Open the site signed in as a student and check:

- [ ] The status (top right) reads **Ready**.
- [ ] **🐛 Debug** is clickable, not greyed out.
- [ ] `while True: pass` → **Run** → **■ Stop** ends it.
- [ ] **Tidy** formats some untidy code.
- [ ] **📁 Files** → *try the practice pack* → open `Q03.py` → **Run** prints
  ` -1`. That's expected: the loop is left for students to complete, and it
  shows the data file was read.

---

## 3. Data protection and safeguarding

These points are written so they can go into a DPIA screening note or the
school's technology register.

- **No accounts, no sign-in, no analytics, no cookies.** The site doesn't know
  who is using it.
- **Students' code never leaves the device.** Python runs inside the browser
  tab. Work is stored in that browser's own storage (`localStorage`) on that
  device and nowhere else.
- **Share links** hold the code inside the link itself, after the `#`. Browsers
  don't send that part to the server. A link is only as private as wherever
  it's pasted.
- **Hosting:** GitHub Pages serves the site's files. Like any web host, it
  keeps standard server logs (such as IP addresses) under GitHub's own privacy
  terms. The site adds nothing to those logs.
- **No AI features** and no third-party services at runtime.

**Practical consequence:** because work stays in one browser, it **does not
follow a student between devices**. It can also be lost if the browser's site
data is cleared. Some managed Chromebooks wipe local data when the student
signs out. Teach students to **download their work** (see Section 8).

---

## 4. Teaching with each feature

### 4.1 The debugger

**🐛 Debug** (Ctrl+F5) runs the program one line at a time.

| Button | Key | Use it to show… |
|---|---|---|
| ↧ **Into** | F7 | each line, including inside functions: parameter passing, local variables |
| ↷ **Over** | F6 | the main program's flow, without going into functions |
| ↥ **Out** | – | the end of the current function and its return value |
| ⏩ **Continue** | F8 | running freely to the next breakpoint |
| ■ **Stop** | Shift+F5 | ending the run |

- **Breakpoints:** click in the margin, or on a line number, to set a red dot.
  **Continue** runs until it reaches one.
- **The panel under the console** shows the **call stack** and the
  **variables** of the selected function. A value that changed on the last
  step is highlighted in green. After a function returns, its return value is
  shown as `square() returned 9`.
- **Good for teaching:**
  - local and global scope;
  - parameter passing and return values;
  - how loop counters change;
  - why an off-by-one error happens;
  - what a `while` condition is checking.

On a Chromebook, the F-keys come from holding the **Search (launcher)** key
with the top-row keys. The on-screen buttons always work.

### 4.2 Stop and `time.sleep()`

A red **■ Stop** button appears while a program runs, and Shift+F5 does the
same. It ends infinite loops, long recursion, a long `time.sleep()` and a
program waiting at `input()`. Animations and countdowns that use
`time.sleep()` now display properly instead of freezing the page.

### 4.3 Trace tables

Open the **Trace table** tab and click **▦ Build trace table**.

- **One row per line that changed a variable or printed something.** Values
  appear only where they change, as in mark schemes. Strings are shown in
  double quotes.
- **Inputs:** type the values the question gives, separated by commas, e.g.
  `5, 3, 0`. If you leave it blank, the program asks in the console as normal.
- **Columns:** untick variables to match the columns in an exam question.
  Untick **Line numbers** if the question's table doesn't have them.
- **Practice:** blanks the table for students to fill in. **✓ Check** marks
  each cell green or red and gives a score. Leaving a cell blank where nothing
  changed is fine. **Reveal** shows the answers.
- **Lenient marking:** quotes are optional (`Ann` or `"Ann"`), `5` matches
  `5.0`, and list spacing doesn't matter.
- **📋 Copy table:** pastes a real table into Word, Google Docs or OneNote. In
  Practice mode it copies a **blank** table, ready for a worksheet.
- **🔗 Share as task:** copies a link that opens straight into a blank
  Practice table, with your code, inputs and column choices. Send it to a
  class.
- **Limits:** a table stops after 300 rows, so an infinite loop can't hang
  the page. p5 sketches can't be traced.

**Lesson idea.** Write a short program as it might appear in an exam. Choose
the inputs and hide the columns the question wouldn't include. Share it as a
task. Students trace it on paper first, then type their answers in and click
**Check**.

### 4.4 The CODES-folder workspace

This models **4CP0 Paper 2**. Candidates get a CODES folder of unfinished
code and data files. They must not overwrite the originals, and they save
each answer under the name the question gives.

Click **📁 Files** to open the panel. It has three sections:

- **Scratch program:** the normal single editor.
- **CODES (originals):** the starter files. Students can edit and run them,
  but never overwrite them. **Save** (Ctrl+S) on an original always opens
  **Save as**. Save as refuses an original's name and adds `.py` if the
  student leaves it off, as IDLE does.
- **My files:** the student's saved answers.

Data files in the workspace (such as `Q03Data.txt`) can be opened by programs
with `open("Q03Data.txt")`. Files a program writes appear in **My files**.

To get started, click **try the practice pack**. It contains three short
original questions (fix errors, complete a loop, read a data file) and a
data file.

### 4.5 Pseudocode reference

The **Pseudocode** tab lists each construct in the 4CP0 pseudocode command
set next to the Python equivalent. A *Watch out for* column covers the points
where a word-for-word translation goes wrong:

- `FOR … TO` includes the end value, so it becomes `range(a, b + 1)`;
- `RANDOM(n)` includes `n`;
- `=` becomes `==`;
- `^` becomes `**`;
- `DIV` and `MOD` become `//` and `%`;
- `&` becomes `+` with `str()`;
- `REPEAT … UNTIL` has no direct equivalent.

There's a search box, and clicking any Python example copies it. Students get
the official booklet with the exam paper. This tab is for learning the
translation, so it is hidden during a mock.

### 4.6 Help menu

**❓ Help** opens this guide and the student guide inside the page, using the
same site, so it works behind the filter. It also has *About this page*.

To send someone straight to a guide, use one of these links:

- `…/pydeXTD/#guide=student`
- `…/pydeXTD/#guide=teacher`

During a mock only *About* is offered, because the guides include Python
equivalents that aren't available in the exam.

### 4.7 Parsons puzzles, Tidy, sharing

These come from the original pyde.

- **🧩 Parsons** turns the current program into a drag-and-drop ordering
  puzzle that can be shared.
- **🧹 Tidy** reformats code to the PEP 8 style.
- **🔗 Share** copies a link to the current program.

---

## 5. Making your own CODES pack

A pack is just a folder of files:

```
CODES/
  Q01.py
  Q02.py
  Q03.py
  Q03Data.txt
```

1. **Write each starter file with its instructions in comments.** Include the
   required file name in this form:
   `# Save your amended code as Q01FINISHED with the correct file extension.`
   The mock exam reads that line to fill in the list of required names
   automatically.
2. **Give it to students** in any of three ways:
   - **A folder:** students click **Open CODES folder** and choose it, for
     example from Google Drive or a USB stick.
   - **A `.zip`:** students click **Open .zip**. Folders inside the zip are
     flattened.
   - **A link:** load the pack yourself, then click **🔗 Share pack** and send
     the link. This suits small packs; very large data files make very long
     links.
3. **Check it:** run each starter file once, so you know which errors are
   deliberate.

> **Copyright.** Pearson's question papers and code files are © Pearson. Using
> them with your own students for practice is normal. **Don't publish them**,
> for example as public share links or on a public website. The built-in
> practice pack is original material.

---

## 6. Running a mock of the practical paper

1. Load the pack: a CODES folder or zip, or the practice pack.
2. Click **⏱ Mock exam**:
   - Set the **time**. The real paper is 180 minutes; shorter mocks, such as 30
     or 60 minutes on fewer questions, also work.
   - Check the **file names** the questions ask for, one per line. They are
     filled in from the CODES files where possible. Correct them against your
     question paper.
3. Click **Start the clock**.
   - A countdown bar runs across the top. It keeps going if the page is
     reloaded or the tab is closed.
   - Trace tables, the Python pseudocode reference, Parsons, Tidy, sharing,
     uploading, loading other files and deleting files are **hidden**.
   - Run, Debug, Save as and the scratch program stay available, as they would
     in an exam IDE.
4. When time runs out, or the student clicks **Finish early**, editing
   **locks**. The **Collect my files** summary then shows:
   - ✓ **saved:** the exact required name exists;
   - ⚠ **wrong name:** something close was saved instead, e.g.
     `q02finished.py` for `Q02FINISHED.py`. In the real exam a marker may not
     find it;
   - ✗ **missing:** nothing with that name;
   - any **unsaved changes**, which would be lost in the real exam.
5. The student clicks **Download my files (.zip)** and hands it in, for
   example on Google Classroom. **End mock** unlocks everything.

**The mock is a practice aid, not a secure exam environment.** A determined
student could open another tab. For mocks that need to be secure, run them
under supervision.

### The real exam is different

The live 4CP0 practical paper is taken on a **centre-prepared computer** with
a local Python IDE (for example IDLE or Thonny), no internet, and the CODES
folder in the candidate's user area. Make sure students also practise on
that set-up before the exam: same IDE, same folder layout, same way of
saving. pyde is for everyday practice and mocks. The final rehearsal should
be on the real exam set-up.

---

## 7. Known limitations

- **The debugger and Stop** need Chrome or Edge 137 or later.
- **p5 sketches** can't be debugged or traced, and a running p5 animation
  can't be stopped. Run again or reload the page.
- **Third-party libraries** (numpy and so on) aren't available, by design.
  Turtle is a built-in lookalike, and `tkinter` isn't available.
- **Work is per browser.** Nothing syncs between devices (see Section 3).
- Very long programs run a little slower with the Stop safety net (about 2–3
  times slower on very tight loops). Typical GCSE programs aren't affected.

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| Status says **Failed to load Python runtime** | The filter is blocking part of the site. Allow the whole host (Section 2). |
| **Debug** is greyed out | The browser is too old or isn't Chrome or Edge. Update ChromeOS or Chrome. |
| A program froze the page | In Chrome or Edge, use **■ Stop**. In other browsers, reload the tab. Your code is kept. |
| Ctrl+F5 or F-keys reload the page or do nothing | On a Chromebook, hold **Search** with the top-row key, or use the on-screen buttons. |
| A student's work has gone | It may be in a different browser or device, or the site data was cleared. Encourage regular **⬇ My files .zip** and **⬇ Download**. |
| `FileNotFoundError` when opening a data file | The data file must be in the workspace (**📁 Files**), or in the *Program input file* box for the scratch program, and the name must match exactly, including capital letters. |

---

## 9. Credits and source

- **pyde** is by Miles Berry, MIT licence: <https://github.com/milesberry/pyde>.
- **The GCSE edition** (debugger, Stop, trace tables, workspace, pseudocode
  reference, mock exam) is in the fork at
  <https://github.com/ukfootprint/pydeXTD>. Technical notes are in
  `DEBUGGER.md`, `gcse/README.md` and `docs/GCSE-EDITION.md`.
- **Python** runs on [Pyodide](https://pyodide.org) (MPL-2.0). The other
  libraries are listed in `vendor/README.md`.
