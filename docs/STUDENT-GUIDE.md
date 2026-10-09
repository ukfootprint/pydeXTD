# pyde: student guide

**Open it here:** <https://ukfootprint.github.io/pydeXTD/>

pyde lets you write and run Python in your browser, including on a school
Chromebook. You don't need an account and there is nothing to install.

---

## 1. The basics

1. Type your program in the **editor** on the left.
2. Click **▶ Run**, or press **F5**. Output appears in the **Console** on the
   right.
3. If your program asks a question with `input()`, type your answer in the
   console and press **Enter**.
4. If your program gets stuck, for example in a loop that never ends, click
   the red **■ Stop** button or press **Shift+F5**.

Error messages appear in red in the console. Read the **last line** first: it
tells you what went wrong and on which line.

**Other buttons you may use:**

- **📄 New:** start a blank program.
- **⬇ Download / ⬆ Upload:** save a `.py` file to your device, or open one.
- **A− / A+:** make the text smaller or bigger.
- **🌙 Dark / ☀️ Light:** change the colours.

> **On a Chromebook:** to use F5–F8, hold the **Search** key (🔍) and press the
> top-row key. You can always click the buttons instead.

---

## 2. Your work is saved in this browser only

pyde remembers your work **in the browser on this device**. It is not saved
online. This means:

- **It won't be there** if you switch to another Chromebook or computer.
- **It can be lost** if the browser's data is cleared. Some school Chromebooks
  do this when you sign out.

**To keep your work safe:**

- **For a single program,** click **⬇ Download**. That saves a `.py` file to
  your Files or Google Drive.
- **For work in the Files panel,** click **⬇ My files .zip**.

Do this at the end of every lesson.

---

## 3. Finding mistakes with the debugger

Click **🐛 Debug** (or press **Ctrl+F5**). Your program starts and pauses on
the first line, which is highlighted.

| Button | Key | What it does |
|---|---|---|
| ↧ **Into** | F7 | Run one line. If it calls a function, go inside it. |
| ↷ **Over** | F6 | Run one line, without going inside functions. |
| ↥ **Out** | – | Finish the current function and go back to where it was called. |
| ⏩ **Continue** | F8 | Run until the next breakpoint, or the end. |
| ■ **Stop** | Shift+F5 | Stop the program. |

**The panel under the console shows:**

- **Variables:** every variable and its value. Values that **just changed**
  are green. When a function finishes, you see what it **returned**.
- **Call stack:** which function you're in, and who called it. Click a line to
  see that function's variables.

**Breakpoints:** click next to a line number to put a red dot there. Then
**Continue** runs your program until it reaches that line. This is useful
for jumping straight to the part you want to check.

**Tip:** if a loop gives the wrong answer, put a breakpoint inside the loop
and press **Continue** a few times. Watch how the variables change each time
round.

---

## 4. Trace tables

Exam papers often ask you to *complete the trace table*. pyde can build one
for you, or test you on one.

1. Open the **Trace table** tab.
2. If the program uses `input()`, type the inputs in the **Inputs** box,
   separated by commas, e.g. `5, 3, 0`.
3. Click **▦ Build trace table**.

Each row shows a line that changed a variable or printed something. A value
is only written when it **changes**, the same as in exam mark schemes.

**To practise:**

1. Tick **Practice**. The table goes blank.
2. Work through the program yourself, on paper first if you like, and fill
   in the cells.
3. Click **✓ Check**. Green cells are right and red cells are wrong.
4. Stuck? Click **Reveal** to see the answers.

You don't have to write quotes around text. You can leave a cell blank if
the value didn't change.

If your teacher sends you a **trace task link**, it opens straight in
Practice mode, ready to fill in.

---

## 5. Practising with a CODES folder (Edexcel International GCSE Paper 2)

In the practical exam you get a folder called **CODES** with starter
programs and data files. You must:

- **not overwrite the original files**;
- **save each answer with the exact name the question gives**, for example
  `Q01FINISHED.py`.

pyde lets you practise exactly that. Click **📁 Files**. A panel opens with:

- **Scratch program:** your normal editor.
- **CODES (originals):** the starter files. Click one to open it. You can
  change it and run it, but you **can't save over it**.
- **My files:** your saved answers.

**Saving your answer:**

1. Make your changes to the original, e.g. `Q01.py`.
2. Press **Ctrl+S**, or click **Save as…**.
3. Type the name the question asks for, e.g. `Q01FINISHED`. pyde adds `.py`
   if you forget, just as IDLE does.
4. Your answer appears under **My files**, and the original goes back to how
   it was.

Check capital letters carefully: `Q01FINISHED.py` and `q01finished.py` are
different names.

**Data files:** if a question uses a file such as `Q03Data.txt`, your program
can open it with `open("Q03Data.txt")`, as in the exam. If your program
writes a new file, it appears in **My files**.

**No CODES folder yet?** Click **try the practice pack** in the Files panel.

**Getting files in and out:**

- **Open CODES folder / Open .zip:** load the files your teacher gave you.
- **⬇ My files .zip:** download your answers to hand in or keep.

---

## 6. Pseudocode → Python

Exam questions use Pearson's **pseudocode**. The **Pseudocode** tab shows the
Python for each pseudocode command, plus the common mistakes. Search for a
command, e.g. `REPEAT` or `MOD`, and click any Python example to copy it.

**The top five traps:**

| Pseudocode | Python | Watch out |
|---|---|---|
| `FOR i FROM 1 TO 10` | `for i in range(1, 11):` | `range` stops **before** the end number |
| `IF x = 5 THEN` | `if x == 5:` | two equals signs to compare |
| `2 ^ 3` | `2 ** 3` | `^` means something else in Python |
| `17 DIV 5`, `17 MOD 5` | `17 // 5`, `17 % 5` | |
| `'Age: ' & age` | `"Age: " + str(age)` | Python needs `str()` to join a number to text |

In the exam you get the official pseudocode booklet with the paper. The
Python version in this tab is for practising.

---

## 7. Mock exams

Your teacher may ask you to do a **⏱ Mock exam**. It works like the real
practical paper:

- **A countdown** runs at the top. It keeps going even if you reload the page.
- **Some helpers are switched off**, such as trace tables, the Python
  pseudocode tab and Tidy, because you won't have them in the exam.
- **Run, Debug and Save as still work.**
- **When time is up** (or you click **Finish early**), editing locks. You then
  see **Collect my files**, which checks that each answer was saved with the
  right name:
  - ✓ **saved**: well done;
  - ⚠ **wrong name**: close, but not exactly what the question asked for. In
    the real exam the marker might not find it;
  - ✗ **missing**: not saved.
- **Download my files (.zip)** and hand it in as your teacher asks.

---

## 8. Keyboard shortcuts

| Action | Keys |
|---|---|
| Run | F5 |
| Stop | Shift+F5 |
| Debug | Ctrl+F5 |
| Step over / into / continue | F6 / F7 / F8 |
| Save (Save as for originals) | Ctrl+S |
| Save as | Ctrl+Shift+S |
| Comment or uncomment lines | select the lines, then press `#` |
| Indent / un-indent | Tab / Shift+Tab |
| Select the next copy of a word | Ctrl+D |

On a Chromebook, hold **Search** for F-keys.

---

## 9. Common errors and what they usually mean

| Error | Usually means… |
|---|---|
| `SyntaxError` | A typing mistake: a missing `)` or `:`, or a missing quote. Look at the line shown **and the one before it**. |
| `IndentationError` | The spaces at the start of a line don't line up. Use the Tab key. |
| `NameError: name 'x' is not defined` | A spelling mistake in a variable name, or you used it before giving it a value. |
| `TypeError: can only concatenate str (not "int") to str` | You joined text and a number with `+`. Use `str(number)`, or `print("Age:", age)`. |
| `TypeError: '<' not supported between instances of 'str' and 'int'` | `input()` gives text. Convert it with `int(input(...))`. |
| `ValueError: invalid literal for int()` | `int()` was given something that isn't a whole number, e.g. `"abc"` or `"5.5"`. |
| `IndexError: list index out of range` | You asked for an item past the end of the list. Lists start at 0. |
| `FileNotFoundError` | The file name doesn't match exactly (check capitals), or the file isn't in the Files panel. |
| `ZeroDivisionError` | You divided by zero. Check the value before dividing. |

---

## 10. Before the real exam

- In the exam you'll use a **school computer** with a Python program such as
  **IDLE**, not this website. Ask your teacher for a practice session on that
  computer, so the IDE and the folders feel familiar.
- Practise **Save As with exact names** until it's automatic.
- Practise **reading data files** (`open`, `for line in file`, `strip()`,
  `split(",")`).
- Do at least one full-length **mock** to get used to working for three hours.

Good luck!
