/* pyde GCSE layer: pseudocode reference (Edexcel International GCSE 4CP0)
   ------------------------------------------------------------------------
   A "Pseudocode" tab pairing each construct in Pearson's 4CP0 pseudocode
   command set with its Python equivalent, plus the points where a direct
   translation goes wrong (FOR ... TO is inclusive, RANDOM(n) includes n,
   = versus ==, & coerces to STRING, DIV/MOD/^ ...).

   Only the short syntax templates come from the command set (they are the
   language itself); every explanation and example here is original. Pupils
   get the official booklet with the paper - link to Pearson, don't copy it.

   Self-contained: index.html only needs <script src="gcse/pseudocode.js">. */
(function () {
  'use strict';

  // [pseudocode template, python equivalent, note]
  const SECTIONS = [
    ['Variables, constants and data types', [
      ['SET <variable> TO <value>', 'total = 0\ngreeting = "Hello"', 'SET is plain assignment. In pseudocode = means "equal to", never assignment.'],
      ['SET <variable> TO <expression>', 'size = len(word)\nscore = score + 10', ''],
      ['CONST REAL <id>\nSET <id> TO <value>', 'VAT_RATE = 0.2', 'Python has no real constants: use an UPPER_CASE name and never reassign it.'],
      ['INTEGER  REAL  BOOLEAN\nCHARACTER  STRING', 'int  float  bool\nstr (length 1)  str', 'Python works out the type from the value. TRUE / FALSE are written True / False.'],
      ['INTEGER + REAL gives REAL', '3 + 8.25   # 11.25\n7 / 2      # 3.5 (always float)', 'In Python 3, / always gives a float, even 6 / 2 = 3.0. Use // for whole-number division.'],
    ]],
    ['Arrays and strings', [
      ['SET <array> TO [<value>, ...]', 'marks = [56, 72, 38]', 'Arrays are Python lists. Indices start at 0 in both.'],
      ['SET <array>[<index>] TO <value>', 'marks[1] = 80', 'The index must already exist; use marks.append(80) to add a new item.'],
      ['SET <array>[<row>, <col>] TO <value>', 'grid[2][4] = 92', 'A 2D array is a list of lists: [row][col], not [row, col].'],
      ['LENGTH(<array or string>)', 'len(marks)\nlen(name)', ''],
      ['<string> & <value>', 'msg = "Fred" + str(age)\nnames = names + ["Ann"]', '& joins and turns numbers into text automatically; in Python you must use str() yourself or you get a TypeError.'],
    ]],
    ['Selection', [
      ['IF <expression> THEN\n   <command>\nEND IF', 'if answer == 10:\n    score = score + 1', 'No THEN or END IF: the colon and the indentation mark the block.'],
      ['IF <expression> THEN\n   <command>\nELSE\n   <command>\nEND IF', 'if answer == "correct":\n    print("Well done")\nelse:\n    print("Try again")', 'Nested IF ... ELSE IF ... can be written with elif in Python.'],
    ]],
    ['Repetition', [
      ['WHILE <condition> DO\n   <command>\nEND WHILE', 'while flag == 0:\n    ...', ''],
      ['REPEAT\n   <command>\nUNTIL <expression>', 'while True:\n    go = go + 1\n    if go == 10:\n        break', 'Python has no REPEAT ... UNTIL. The body must run at least once, so test at the end and break when the UNTIL condition is true.'],
      ['REPEAT <expression> TIMES\n   <command>\nEND REPEAT', 'for _ in range(n):\n    print("*")', ''],
      ['FOR <id> FROM <a> TO <b> DO\n   <command>\nEND FOR', 'for i in range(a, b + 1):\n    ...', 'TO includes the end value; range() stops one before it. FROM 1 TO 10 is range(1, 11).'],
      ['FOR <id> FROM <a> TO <b> STEP <s> DO\n   <command>\nEND FOR', 'for i in range(a, b + 1, s):\n    ...', 'Counting down: FROM 10 TO 1 STEP -1 is range(10, 0, -1).'],
      ['FOR EACH <id> FROM <array> DO\n   <command>\nEND FOREACH', 'for word in words:\n    sentence = sentence + word + " "', ''],
    ]],
    ['Input and output', [
      ['SEND <expression> TO DISPLAY', 'print("Have a good day.")', 'print(a, b) puts a space between items; print(a + b) does not.'],
      ['RECEIVE <id> FROM (STRING) KEYBOARD', 'name = input("Name: ")', 'input() always gives a string.'],
      ['RECEIVE <id> FROM (INTEGER) KEYBOARD', 'age = int(input("Age: "))', 'Convert with int() or float(); forgetting this is the most common cause of TypeError.'],
      ['RECEIVE <id> FROM (CHARACTER) KEYBOARD', 'answer = input("Y/N: ")[0]', 'Python has no separate character type: take the first character of the string.'],
    ]],
    ['File handling', [
      ['READ <file> <record>', 'with open("data.txt") as f:\n    for line in f:\n        fields = line.strip().split(",")', 'A record is usually one line; strip() removes the newline and split(",") separates the fields. Fields are strings until you convert them.'],
      ['WRITE <file> <record>', 'with open("out.txt", "a") as f:\n    f.write(name + "," + str(score) + "\\n")', '"w" replaces the file, "a" adds to the end. write() needs a string and doesn\'t add a newline.'],
    ]],
    ['Subprograms', [
      ['PROCEDURE <id> (<parameter>, ...)\nBEGIN PROCEDURE\n   <command>\nEND PROCEDURE', 'def show_average(m1, m2, m3):\n    print((m1 + m2 + m3) / 3)', 'A procedure is a def with no return value.'],
      ['FUNCTION <id> (<parameter>, ...)\nBEGIN FUNCTION\n   <command>\n   RETURN <expression>\nEND FUNCTION', 'def add_marks(m1, m2, m3):\n    total = m1 + m2 + m3\n    return total', 'Use the returned value: result = add_marks(1, 2, 3). Variables made inside a function are local to it.'],
      ['<id> (<parameter>, ...)', 'show_average(50, 60, 70)\nt = add_marks(50, 60, 70)', ''],
    ]],
    ['Functions and comments', [
      ['RANDOM(<n>)', 'import random\nrandom.randint(0, n)', 'RANDOM(n) gives 0 to n inclusive, and so does randint(0, n). random.random() is a float between 0 and 1, which is different.'],
      ['# comment', '# comment', 'The same in both.'],
    ]],
    ['Operators', [
      ['+  -  *  /', '+  -  *  /', '/ always gives a float in Python.'],
      ['^', '**', '2 ^ 3 is 2 ** 3 = 8. In Python ^ means something else (XOR), with no error to warn you.'],
      ['MOD', '%', '17 MOD 5 is 17 % 5 = 2'],
      ['DIV', '//', '17 DIV 5 is 17 // 5 = 3'],
      ['=', '==', 'Comparison needs two equals signs. One = is assignment and gives a SyntaxError in an if.'],
      ['<>', '!=', ''],
      ['>  >=  <  <=', '>  >=  <  <=', ''],
      ['AND  OR  NOT', 'and  or  not', 'Lower case in Python.'],
    ]],
  ];

  const CSS = `
  #tab-pseudo.hidden{ display:none; }
  .pc-intro{ font-size:.8rem; color:var(--comment); margin:0 0 .5rem; line-height:1.45; }
  .pc-intro a{ color:var(--cyan); }
  #pc-filter{ width:100%; box-sizing:border-box; margin:0 0 .6rem; background:var(--bg); color:var(--fg); border:1px solid var(--comment);
    border-radius:4px; padding:.3rem .5rem; font-size:.82rem; }
  .pc-sec{ margin:0 0 .7rem; }
  .pc-sec h3{ margin:.2rem 0 .3rem; font-size:.72rem; text-transform:uppercase; letter-spacing:.06em; color:var(--purple); }
  table.pc{ width:100%; border-collapse:collapse; font-size:.8rem; table-layout:fixed; }
  table.pc col.c1{ width:34%; } table.pc col.c2{ width:30%; }
  table.pc th{ text-align:left; font-weight:600; color:var(--comment); font-size:.7rem; padding:.15rem .4rem; border-bottom:1px solid var(--comment); }
  table.pc td{ vertical-align:top; padding:.35rem .4rem; border-bottom:1px solid var(--border); }
  table.pc td.code{ font-family:'Fira Code',monospace; font-variant-ligatures:none; font-feature-settings:"liga" 0,"calt" 0; white-space:pre-wrap; word-break:break-word; font-size:.78rem; }
  table.pc td.code.py{ cursor:copy; color:var(--green); }
  table.pc td.code.pc-ps{ color:var(--orange); }
  table.pc td.note{ color:var(--fg); line-height:1.4; }
  table.pc tr.hl td{ background:rgba(189,147,249,.15); }
  `;

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const kid of kids) if (kid !== null && kid !== undefined) e.append(kid);
    return e;
  }

  function install() {
    document.head.append(el('style', {}, CSS));
    const tabs = document.querySelector('#output-panel .tabs');
    const btn = el('button', { class: 'tab-btn', 'data-tab': 'pseudo', title: 'Edexcel International GCSE pseudocode and its Python equivalents' }, 'Pseudocode');
    btn.addEventListener('click', () => switchTab('pseudo'));
    tabs.append(btn);

    const body = el('div', {});
    for (const [title, rows] of SECTIONS) {
      const table = el('table', { class: 'pc' }, el('colgroup', {}, el('col', { class: 'c1' }), el('col', { class: 'c2' }), el('col', {})), el('tr', {}, el('th', {}, 'Pseudocode'), el('th', {}, 'Python'), el('th', {}, 'Watch out for')));
      for (const [ps, py, note] of rows) {
        const pyCell = el('td', { class: 'code py', title: 'Click to copy the Python' }, py);
        pyCell.addEventListener('click', () => {
          const done = () => showToast('Python copied');
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(py).then(done, () => {});
        });
        table.append(el('tr', { 'data-search': (ps + ' ' + py + ' ' + note).toLowerCase() },
          el('td', { class: 'code pc-ps' }, ps), pyCell, el('td', { class: 'note' }, note)));
      }
      body.append(el('div', { class: 'pc-sec' }, el('h3', {}, title), table));
    }

    const filter = el('input', { id: 'pc-filter', type: 'search', placeholder: 'Find, e.g. REPEAT, MOD, file, random\u2026', 'aria-label': 'Find a construct' });
    filter.addEventListener('input', () => {
      const q = filter.value.trim().toLowerCase();
      body.querySelectorAll('.pc-sec').forEach(sec => {
        let any = false;
        sec.querySelectorAll('tr[data-search]').forEach(tr => {
          const show = !q || tr.dataset.search.includes(q);
          tr.style.display = show ? '' : 'none';
          tr.classList.toggle('hl', !!q && show);
          any = any || show;
        });
        sec.style.display = any ? '' : 'none';
      });
    });

    const panel = el('div', { class: 'tab-content hidden', id: 'tab-pseudo' },
      el('p', { class: 'pc-intro' },
        'Python equivalents for the pseudocode used in Pearson Edexcel International GCSE Computer Science (4CP0) papers. ',
        'In the exam you get the official pseudocode command set booklet with the paper (also on ',
        el('a', { href: 'https://qualifications.pearson.com/en/qualifications/edexcel-international-gcses/international-gcse-computer-science-2017.html', target: '_blank', rel: 'noopener' }, 'Pearson\u2019s 4CP0 page'),
        '). Click any Python to copy it.'),
      filter, body);
    const debugPane = document.getElementById('debug-pane');
    debugPane.parentNode.insertBefore(panel, debugPane);
  }

  install();
  window.pydePseudocode = { SECTIONS };
})();
