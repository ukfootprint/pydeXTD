"""End-to-end tests for pyde (debugger, Run Stop, self-hosting), in headless Chromium.

The page is served from a local HTTP server and *every* request to any other
host is blocked and recorded, which proves the site needs only one host.
The file:// fallback (which loads Pyodide from jsDelivr) is tested by serving
jsDelivr URLs from a local npm copy of the same Pyodide release.

    pip install playwright && python -m playwright install chromium
    npm install pyodide@0.29.5          # only for the file:// fallback check
    PYDE_NODE_MODULES=path/to/node_modules python dev/test_debugger.py
"""
import http.server, json, mimetypes, os, re, socketserver, sys, threading, time
from functools import partial
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
NM = os.environ.get("PYDE_NODE_MODULES", os.path.join(HERE, "node_modules"))
SHOTS = os.path.join(HERE, "screenshots")
os.makedirs(SHOTS, exist_ok=True)
PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.29.5/full/"

class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
mimetypes.add_type("application/wasm", ".wasm")
httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), partial(_Quiet, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{httpd.server_address[1]}/"

external = []          # requests to any host other than the local server
def route_one_host(r):
    url = r.request.url
    if url.startswith(BASE) or url.startswith("data:") or url.startswith("blob:"):
        return r.continue_()
    external.append(url)
    return r.abort()

def route_file_mode(r):
    url = r.request.url
    if url.startswith(PYODIDE_CDN):
        path = os.path.join(NM, "pyodide", url[len(PYODIDE_CDN):].split("?")[0])
        if os.path.exists(path):
            ct = "application/wasm" if path.endswith(".wasm") else (mimetypes.guess_type(path)[0] or "application/octet-stream")
            return r.fulfill(path=path, content_type=ct, headers={"Access-Control-Allow-Origin": "*"})
    if url.startswith("file://") or url.startswith("data:") or url.startswith("blob:"):
        return r.continue_()
    return r.abort()

results = []
def check(name, cond, detail=""):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + (f"  -- {detail}" if detail else ""))

def open_page(browser, url, route, init_script=None):
    ctx = browser.new_context(viewport={"width": 1366, "height": 768})
    ctx.route("**/*", route)
    if init_script:
        ctx.add_init_script(init_script)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(url)
    page.wait_for_function("/Ready|Failed/.test(document.getElementById('status-text').textContent)", timeout=90000)
    if page.is_visible("#about-close"): page.click("#about-close")
    return page, errs

with sync_playwright() as p:
    b = p.chromium.launch()
    page, errors = open_page(b, BASE + "index.html", route_one_host)
    check("H1. Loads and reaches Ready with all non-local requests blocked", page.inner_text("#status-text") == "Ready")

    console = lambda: page.inner_text("#console-output")
    status = lambda: page.inner_text("#status-text")
    def set_code(src):
        page.evaluate("(s) => { const cm = document.querySelector('.CodeMirror').CodeMirror; cm.setValue(s); cm.clearGutter('breakpoints'); }", src)
    def wait_status(pred_js, timeout=15000):
        page.wait_for_function(pred_js, timeout=timeout)
    def paused_line():
        wait_status("/^Paused at line|^Waiting for input|^Finished|^Stopped|^Error/.test(document.getElementById('status-text').textContent)")
        return status()
    def vars_():
        return page.evaluate("""() => [...document.querySelectorAll('#debug-vars tbody tr')].map(tr =>
            ({n: tr.children[0].textContent, t: tr.children[1] && tr.children[1].textContent,
              v: tr.children[2] && tr.children[2].textContent, changed: tr.classList.contains('changed'), ret: tr.classList.contains('retval')}))""")
    def stack():
        return page.evaluate("[...document.querySelectorAll('#debug-stack li')].map(li => li.textContent)")
    def click(sel):
        page.click(sel)

    print("Python version:", page.evaluate("pyodide.runPython('import sys; sys.version.split()[0]')"))
    check("0. Debug button enabled (JSPI available)", page.is_enabled("#debug-btn"))

    # ---------------- regression: existing features on the newer Pyodide ----------------
    click("#run-btn"); page.wait_for_function("!document.getElementById('run-btn').disabled")
    check("R1. Run: default program output", "Hello, world!" in console() and "4 16" in console())

    set_code('def ask():\n    return input("Name? ")\nn = ask()\nprint("Hi " + n)\n')
    click("#run-btn")
    page.wait_for_selector("#console-output .console-inline-input", timeout=10000)
    page.fill("#console-output .console-inline-input", "Ada"); page.press("#console-output .console-inline-input", "Enter")
    page.wait_for_function("!document.getElementById('run-btn').disabled")
    check("R2. Run: inline input() via AST generator rewrite still works", "Hi Ada" in console(), console().replace("\n", " | "))

    set_code('import turtle\nt = turtle.Turtle()\nfor _ in range(4):\n    t.forward(50)\n    t.left(90)\nprint("drawn")\n')
    click("#run-btn"); page.wait_for_function("!document.getElementById('run-btn').disabled")
    check("R3. Run: turtle program", "drawn" in console() and "Error" not in console(), console()[:200])

    set_code('with open("out.txt", "w") as f:\n    f.write("abc")\nprint(open("input.txt").read() if False else "ok")\n')
    click("#run-btn"); page.wait_for_function("!document.getElementById('run-btn').disabled")
    check("R4. Run: file writing appears in Files tab", "out.txt" in page.inner_text("#files-list"))

    # ---------------- debugger ----------------
    PROG = ('def square(n):\n'            # 1
            '    result = n * n\n'         # 2
            '    return result\n'          # 3
            '\n'                           # 4
            'total = 0\n'                  # 5
            'for i in range(3):\n'         # 6
            '    total = total + square(i)\n'  # 7
            'name = input("Your name? ")\n'    # 8
            'print("Hello", name, "total =", total)\n')  # 9
    set_code(PROG)
    click("#debug-btn")
    s = paused_line()
    check("D1. Debug pauses on line 1", s == "Paused at line 1", s)
    check("D2. Editor is read-only and current line highlighted",
          page.evaluate("document.querySelector('.CodeMirror').CodeMirror.getOption('readOnly')") is True
          and page.locator(".debug-current-line").count() == 1)
    check("D3. Run button disabled, step controls shown", page.is_disabled("#run-btn") and page.is_visible("#dbg-into"))

    for _ in range(3):  # 1 -> 5 -> 6 -> 7
        click("#dbg-into"); s = paused_line()
    check("D4. Step into walks module lines", s == "Paused at line 7", s)
    v = {r["n"]: r for r in vars_()}
    check("D5. Variables panel shows globals (total, i) but hides internals",
          v.get("total", {}).get("v") == "0" and v.get("i", {}).get("v") == "0" and "input" not in v and "__builtins__" not in v
          and v.get("square", {}).get("t") == "function", json.dumps(list(v.keys())))
    click("#dbg-into"); s = paused_line()
    check("D6. Step into enters square()", s == "Paused at line 2" and stack() == ["(main program)  line 7", "square()  line 2"], f"{s} {stack()}")
    v = {r["n"]: r for r in vars_()}
    check("D7. Locals of square() shown", v.get("n", {}).get("v") == "0" and page.text_content("#debug-vars-title") == "Variables in square()")
    page.locator("#debug-stack li").first.click()
    check("D8. Clicking a stack frame shows that frame's variables", "total" in [r["n"] for r in vars_()] and page.text_content("#debug-vars-title") == "Variables in (main program)")
    click("#dbg-out"); s = paused_line()
    v = vars_()
    ret = [r for r in v if r["ret"]]
    check("D9. Step out returns to caller and shows return value", s in ("Paused at line 6", "Paused at line 7") and ret and ret[0]["n"] == "square()" and ret[0]["v"] == "0", f"{s} {ret}")
    vd = {r["n"]: r for r in v}
    check("D10. total (0 -> 0) not marked as changed", vd["total"]["changed"] is False, json.dumps(vd["total"]))
    click("#dbg-over"); s = paused_line()   # 6 -> 7 (i becomes 1)
    vd = {r["n"]: r for r in vars_()}
    check("D11. Changed value (i: 0->1) is highlighted", vd.get("i", {}).get("v") == "1" and vd["i"]["changed"], json.dumps(vd.get("i")))
    click("#dbg-over"); s = paused_line()
    check("D12. Step over does not enter square()", s in ("Paused at line 6",) and len(stack()) == 1, f"{s} {stack()}")
    ret = [r for r in vars_() if r["ret"]]
    check("D13. ...but still reports what square() returned", ret and ret[0]["v"] == "1", json.dumps(ret))

    page.screenshot(path=f"{SHOTS}/debug_paused.png")

    click("#dbg-continue")
    page.wait_for_selector("#console-output .console-inline-input", timeout=10000)
    check("D14. input() during debug uses the inline console box", status() == "Waiting for input")
    page.fill("#console-output .console-inline-input", "Simon"); page.press("#console-output .console-inline-input", "Enter")
    wait_status("document.getElementById('status-text').textContent === 'Finished'")
    check("D15. Program finishes with correct output", "Hello Simon total = 5" in console(), console().replace("\n", " | "))
    check("D16. UI restored after finishing", page.is_enabled("#run-btn") and page.is_visible("#debug-btn") and not page.is_visible("#debug-pane")
          and page.evaluate("document.querySelector('.CodeMirror').CodeMirror.getOption('readOnly')") is False)

    # breakpoints via gutter click
    set_code("x = 1\nfor i in range(5):\n    x = x * 2\nprint(x)\n")
    page.locator(".CodeMirror-gutter-wrapper").nth(2).locator(".CodeMirror-linenumber").click()
    bps = page.evaluate("getBreakpoints()")
    check("D17. Clicking a line number sets a breakpoint", bps == [3], str(bps))
    click("#debug-btn"); paused_line()
    click("#dbg-continue"); s = paused_line()
    check("D18. Continue stops at the breakpoint", s == "Paused at line 3", s)
    click("#dbg-continue"); s = paused_line()
    v = {r["n"]: r["v"] for r in vars_()}
    check("D19. ...and again on the next loop iteration", s == "Paused at line 3" and v.get("x") == "2" and v.get("i") == "1", f"{s} {v}")
    click("#dbg-stop"); wait_status("document.getElementById('status-text').textContent === 'Stopped'")
    check("D20. Stop while paused ends the program", "[Program stopped]" in console() and page.is_enabled("#run-btn"))

    # infinite loop + stop
    set_code("n = 0\nwhile True:\n    n += 1\n")
    click("#debug-btn"); paused_line()
    click("#dbg-continue"); time.sleep(1)
    t0 = page.evaluate("performance.now()"); page.evaluate("new Promise(r => setTimeout(r, 100))"); t1 = page.evaluate("performance.now()")
    check("D21. Page stays responsive during an infinite loop under the debugger", t1 - t0 < 1000, f"100ms timer took {t1 - t0:.0f} ms")
    click("#dbg-stop"); wait_status("document.getElementById('status-text').textContent === 'Stopped'", 10000)
    check("D22. Stop button ends an infinite loop", "[Program stopped]" in console())

    # runtime error
    set_code("def f(a):\n    return 10 / a\n\nprint(f(0))\n")
    click("#debug-btn"); paused_line(); click("#dbg-continue")
    wait_status("/^Error/.test(document.getElementById('status-text').textContent)")
    check("D23. Runtime error: clean traceback and error line highlighted",
          status() == "Error on line 2" and "ZeroDivisionError" in console() and "_pyde" not in console() and "return 10 / a" in console() and page.locator(".debug-error-line").count() == 1,
          console().replace("\n", " | "))

    # syntax error
    set_code("print('hi'\n")
    click("#debug-btn")
    wait_status("/^Error/.test(document.getElementById('status-text').textContent)")
    check("D24. Syntax error reported", "SyntaxError" in console(), console().replace("\n", " | "))

    # input() inside a recursive function - the AST rewrite would fall back to a popup here
    set_code('def ask(n):\n    if n == 0:\n        return []\n    return [input("Item? ")] + ask(n - 1)\nprint(ask(2))\n')
    click("#debug-btn"); paused_line(); click("#dbg-continue")
    for val in ("a", "b"):
        page.wait_for_selector("#console-output .console-inline-input", timeout=10000)
        page.fill("#console-output .console-inline-input", val); page.press("#console-output .console-inline-input", "Enter")
    wait_status("document.getElementById('status-text').textContent === 'Finished'")
    check("D25. input() in a recursive function works inline under the debugger", "['a', 'b']" in console(), console().replace("\n", " | "))

    # stop while waiting for input
    set_code('x = input("? ")\nprint(x)\n')
    click("#debug-btn"); paused_line(); click("#dbg-continue")
    page.wait_for_selector("#console-output .console-inline-input", timeout=10000)
    click("#dbg-stop"); wait_status("document.getElementById('status-text').textContent === 'Stopped'", 10000)
    check("D26. Stop while waiting for input()", "[Program stopped]" in console())

    # turtle under the debugger
    set_code('import turtle\nt = turtle.Turtle()\nfor _ in range(4):\n    t.forward(80)\n    t.left(90)\nprint("square done")\n')
    click("#debug-btn"); paused_line()
    s = status(); stk = stack()
    check("D27. Turtle program: debugger does not step into the turtle shim", s == "Paused at line 1", s)
    click("#dbg-continue"); wait_status("document.getElementById('status-text').textContent === 'Finished'")
    check("D28. Turtle program completes under the debugger", "square done" in console())

    # keyboard shortcuts
    set_code("a = 1\nb = 2\nc = a + b\n")
    page.keyboard.press("Control+F5"); s = paused_line()
    page.keyboard.press("F7"); s2 = paused_line()
    page.keyboard.press("F6"); s3 = paused_line()
    page.keyboard.press("F8"); wait_status("document.getElementById('status-text').textContent === 'Finished'")
    check("D29. Keyboard shortcuts Ctrl+F5 / F7 / F6 / F8", (s, s2, s3) == ("Paused at line 1", "Paused at line 2", "Paused at line 3"), f"{s} {s2} {s3}")

    # Normal Run still works after debugging
    set_code("print(sum(range(10)))\n")
    click("#run-btn"); page.wait_for_function("!document.getElementById('run-btn').disabled")
    check("D30. Normal Run works after debug sessions", "45" in console())

    check("D31. No uncaught page errors", not errors, "; ".join(errors[:3]))

    # light theme screenshot of a paused session
    set_code(PROG)
    page.click("#theme-toggle")
    click("#debug-btn"); paused_line()
    for _ in range(4): click("#dbg-into"); paused_line()
    page.screenshot(path=f"{SHOTS}/debug_paused_light.png")
    click("#dbg-stop"); wait_status("document.getElementById('status-text').textContent === 'Stopped'")
    page.click("#theme-toggle")

    # ---------------- Stop for Run ----------------
    def run_and_wait(src, timeout=20000):
        set_code(src); click("#run-btn")
        page.wait_for_function("!document.getElementById('run-btn').disabled", timeout=timeout)
    def responsive():
        t0 = page.evaluate("performance.now()"); page.evaluate("new Promise(r => setTimeout(r, 100))"); t1 = page.evaluate("performance.now()")
        return t1 - t0
    def start_run(src):
        set_code(src); click("#run-btn"); time.sleep(0.8)

    check("S1. Run's Stop button hidden when idle", not page.is_visible("#run-stop-btn"))
    start_run("while True:\n    pass\n")
    check("S2. Stop button shown while running; page responsive in an infinite loop",
          page.is_visible("#run-stop-btn") and responsive() < 1000 and status() == "Running")
    click("#run-stop-btn"); page.wait_for_function("!document.getElementById('run-btn').disabled", timeout=5000)
    check("S3. Stop ends an infinite loop cleanly", console().strip() == "[Program stopped]" and status() == "Stopped"
          and not page.is_visible("#run-stop-btn"), console())

    start_run("def fib(n):\n    return n if n < 2 else fib(n - 1) + fib(n - 2)\nprint(fib(40))\n")
    r = responsive(); click("#run-stop-btn"); page.wait_for_function("!document.getElementById('run-btn').disabled", timeout=5000)
    check("S4. Stop ends long recursion (no loops)", "[Program stopped]" in console() and r < 1000, f"timer {r:.0f} ms")

    set_code('name = input("Name? ")\nprint("never")\n'); click("#run-btn")
    page.wait_for_selector("#console-output .console-inline-input", timeout=10000)
    click("#run-stop-btn"); page.wait_for_function("!document.getElementById('run-btn').disabled", timeout=5000)
    check("S5. Stop while waiting for input()", "[Program stopped]" in console() and "never" not in console(), console())

    t0 = time.time()
    run_and_wait('import time\nprint("a")\ntime.sleep(0.5)\nprint("b")\n')
    el = time.time() - t0
    check("S6. time.sleep() still waits the right time", console().split() == ["a", "b"] and 0.5 <= el < 5, f"{el:.2f}s")
    start_run('import time\nprint("start")\ntime.sleep(30)\nprint("never")\n')
    r = responsive(); t0 = time.time(); click("#run-stop-btn")
    page.wait_for_function("!document.getElementById('run-btn').disabled", timeout=5000)
    check("S7. Page responsive during time.sleep(30), and Stop interrupts it", r < 1000 and "[Program stopped]" in console() and time.time() - t0 < 2,
          f"timer {r:.0f} ms, stop took {time.time() - t0:.2f}s")

    set_code("while True:\n    pass\n"); page.keyboard.press("F5"); time.sleep(0.8)
    running = status() == "Running"
    page.keyboard.press("Shift+F5"); page.wait_for_function("!document.getElementById('run-btn').disabled", timeout=5000)
    check("S8. F5 runs and Shift+F5 stops", running and "[Program stopped]" in console())

    set_code('def ask():\n    return input("Name? ")\nn = ask()\nprint("Hi " + n)\n'); click("#run-btn")
    page.wait_for_selector("#console-output .console-inline-input", timeout=10000)
    page.fill("#console-output .console-inline-input", "Ada"); page.press("#console-output .console-inline-input", "Enter")
    page.wait_for_function("!document.getElementById('run-btn').disabled")
    check("S9. Run after Stop works, input() inline", "Hi Ada" in console() and status() == "Ready", console())

    set_code('f = input\nx = f("Q? ")\nprint(x * 2)\n'); click("#run-btn")
    page.wait_for_selector("#console-output .console-inline-input", timeout=10000)
    page.fill("#console-output .console-inline-input", "ab"); page.press("#console-output .console-inline-input", "Enter")
    page.wait_for_function("!document.getElementById('run-btn').disabled")
    check("S10. Aliased input() is inline too (used to need a popup)", "abab" in console(), console())

    run_and_wait("raise ValueError('boom')\n")
    check("S11. Ordinary errors still show a traceback", "ValueError: boom" in console() and status() == "Ready")

    run_and_wait('import turtle, time\nt = turtle.Turtle()\nfor _ in range(4):\n    t.forward(40)\n    t.left(90)\n    time.sleep(0.05)\nprint("ok")\n')
    check("S12. Turtle with time.sleep under Run", "ok" in console() and "Error" not in console(), console())

    start_run("def check(v):\n    try:\n        return int(v)\n    except:\n        return None\nwhile True:\n    try:\n        check('x')\n    except Exception:\n        pass\n")
    click("#run-stop-btn"); page.wait_for_function("!document.getElementById('run-btn').disabled", timeout=5000)
    check("S14. Stop gets out even when the loop swallows exceptions", "[Program stopped]" in console(), console())

    timing = page.evaluate("""async () => {
        const src = "t = 0\\nfor i in range(1000000):\\n    t += i\\n";
        let a = performance.now(); await pyodide.runPythonAsync(src, {filename: '<program>'}); const plain = performance.now() - a;
        pyodide.runPython('_pyde_run_guard.start()');
        a = performance.now(); try { await pyodide.runPythonAsync(src, {filename: '<program>'}); } finally { pyodide.runPython('_pyde_run_guard.finish()'); }
        return {plain, guarded: performance.now() - a}; }""")
    check("S13. Stop-guard overhead on a tight 1M loop", timing["guarded"] < timing["plain"] * 5,
          f"{timing['plain']:.0f} ms without, {timing['guarded']:.0f} ms with ({timing['guarded'] / timing['plain']:.1f}x)")

    # ---------------- GCSE layer: trace tables ----------------
    def build_trace(src, inputs=""):
        set_code(src); page.click("button[data-tab=trace]")
        if page.is_checked("#trace-practice"): page.uncheck("#trace-practice")
        page.fill("#trace-inputs", inputs); page.click("#trace-build")
        page.wait_for_function("!document.getElementById('trace-build').disabled", timeout=20000)
        return page.evaluate("pydeTrace.data")
    def table_cells():
        return page.evaluate("""[...document.querySelectorAll('#trace-table tr')].map(tr =>
            [...tr.children].map(td => td.querySelector('input') ? '<' + td.querySelector('input').value + '>' : td.textContent))""")

    COUNT = 'count = 0\nnum = int(input("Number: "))\nwhile num != 0:\n    count = count + 1\n    num = int(input("Number: "))\nprint("Count:", count)\n'
    d = build_trace(COUNT, "5, 3, 0")
    check("T1. Trace table built from pre-set inputs, exam style",
          table_cells() == [["Line", "count", "num", "Output"], ["1", "0", "", ""], ["2", "", "5", ""], ["4", "1", "", ""],
                            ["5", "", "3", ""], ["4", "2", "", ""], ["5", "", "0", ""], ["6", "", "", "Count: 2"]], json.dumps(table_cells()))
    check("T2. Inputs echoed to the console, buttons re-enabled", "Number: 5" in console() and page.is_enabled("#run-btn") and page.is_enabled("#debug-btn"))

    d = build_trace("def square(n):\n    result = n * n\n    return result\n\nx = 3\ny = square(x)\nprint(y)\n")
    hdr = page.evaluate("[...document.querySelectorAll('#trace-table th')].map(th => th.textContent)")
    check("T3. Function parameters on the def line, locals labelled by function",
          [r["line"] for r in d["rows"]] == [5, 1, 2, 6, 7] and hdr == ["Line", "x", "nin square()", "resultin square()", "y", "Output"], f"{[r['line'] for r in d['rows']]} {hdr}")

    page.uncheck("#trace-lines")
    page.locator("#trace-cols label", has_text="result").locator("input").uncheck()
    cells = table_cells()
    check("T4. Hiding a column (and line numbers) drops rows with nothing left to show",
          cells[0] == ["x", "nin square()", "y", "Output"] and len(cells) == 5, json.dumps(cells))
    page.check("#trace-lines")

    d = build_trace('names = []\nfor n in ["Ann", "Bo"]:\n    names.append(n.upper())\nprint(names)\n')
    check("T5. Strings shown in double quotes, lists too", d["rows"][2]["vals"] == {"names": '["ANN"]'} and d["rows"][1]["vals"] == {"n": '"Ann"'}, json.dumps(d["rows"][:3]))

    # practice mode + marking
    build_trace(COUNT, "5, 3, 0")
    page.check("#trace-practice")
    cells = table_cells()
    check("T6. Practice mode blanks every answer cell", all(c in ("<>",) for row in cells[1:] for c in row[1:]) and cells[1][0] == "1", json.dumps(cells[:3]))
    answers = [["0", "", ""], ["", "5", ""], ["1", "", ""], ["", "3", ""], ["2", "", ""], ["", "0", ""], ["", "", "Count: 2"]]
    def fill(ans):
        inputs = page.locator("#trace-table tbody input")
        flat = [v for row in ans for v in row]
        for k, v in enumerate(flat): inputs.nth(k).fill(v)
    fill(answers); page.click("#trace-check")
    check("T7. All-correct answers marked correct", page.inner_text("#trace-status").startswith("All 7 correct"), page.inner_text("#trace-status"))
    wrong = [r[:] for r in answers]; wrong[2][0] = "2"; wrong[1][2] = "oops"; wrong[3][0] = "1"
    fill(wrong); page.click("#trace-check")
    st = page.inner_text("#trace-status")
    check("T8. Mistakes marked: wrong value red, repeating an unchanged value tolerated, stray output counted",
          st.startswith("6 / 7 correct") and "1 cell" in st and page.locator("#trace-table td.wrong").count() == 2, st)
    page.click("#trace-reveal")
    check("T9. Reveal shows the right answer beside wrong cells", page.locator("#trace-table td.wrong .answer").first.inner_text() == "1")

    build_trace('names = []\nfor n in ["Ann", "Bo"]:\n    names.append(n.upper())\nprint(names)\n')
    page.check("#trace-practice")
    fill([["[]", "", ""], ["", "Ann", ""], ["['ANN']", "", ""], ["", "'Bo'", ""], ['[ "ANN","BO" ]', "", ""], ["", "", "['ANN', 'BO']"]])
    page.click("#trace-check")
    check("T10. Lenient marking: quotes optional, list spacing/quote style ignored", page.inner_text("#trace-status").startswith("All 6 correct"), page.inner_text("#trace-status"))

    # inputs typed live (JSPI) when none are pre-set
    set_code('a = input("A? ")\nb = a * 2\n'); page.click("button[data-tab=trace]")
    page.uncheck("#trace-practice"); page.fill("#trace-inputs", ""); page.click("#trace-build")
    page.wait_for_selector("#console-output .console-inline-input", timeout=10000)
    page.fill("#console-output .console-inline-input", "hi"); page.press("#console-output .console-inline-input", "Enter")
    page.wait_for_function("!document.getElementById('trace-build').disabled", timeout=10000); page.click("button[data-tab=trace]")
    check("T11. input() with no pre-set inputs asks in the console", table_cells()[2][2:3] == ['"hihi"'], json.dumps(table_cells()))

    build_trace("while True:\n    x = 1\n")
    check("T12. Infinite loop stops early with a message", "Stopped early" in page.inner_text("#trace-status"))
    build_trace("a = 10\nb = 0\nprint(a / b)\n")
    check("T13. Runtime error reported in the table", "ZeroDivisionError" in page.inner_text("#trace-table") and "line 3" in page.inner_text("#trace-status"))

    # copy (blank worksheet version) and share as a task
    ctx0 = page.context; ctx0.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE.rstrip("/"))
    build_trace(COUNT, "5, 3, 0"); page.check("#trace-practice"); page.click("#trace-copy"); time.sleep(0.3)
    tsv = page.evaluate("navigator.clipboard.readText()")
    check("T14. Copy table gives a blank worksheet table in Practice mode", tsv.splitlines()[0] == "Line\tcount\tnum\tOutput" and tsv.splitlines()[1] == "1\t\t\t", repr(tsv[:80]))
    page.click("#trace-share"); time.sleep(0.3)
    link = page.evaluate("navigator.clipboard.readText()")
    tpage = ctx0.new_page(); tpage.goto(link)
    tpage.wait_for_function("document.getElementById('trace-table') && document.querySelectorAll('#trace-table tbody input').length > 0", timeout=60000)
    check("T15. Shared task link opens in Practice mode with code, inputs and a blank table",
          "#trace=" in link and tpage.is_checked("#trace-practice") and tpage.input_value("#trace-inputs") == "5, 3, 0"
          and tpage.locator("#trace-table tbody tr").count() == 7 and "num != 0" in tpage.evaluate("document.querySelector('.CodeMirror').CodeMirror.getValue()"))
    tpage.close()

    # ---------------- GCSE layer: CODES-folder workspace ----------------
    import tempfile, zipfile
    page.on("dialog", lambda d: d.accept())
    CM = "document.querySelector('.CodeMirror').CodeMirror"
    wsfiles = lambda: page.evaluate("pydeWorkspace.files.map(f => f.name + (f.original ? '*' : ''))")
    wscur = lambda: page.evaluate("pydeWorkspace.current && pydeWorkspace.current.name")
    set_code("print('scratch work')\n")
    page.click("#ws-toggle"); page.click("#ws-sample")
    check("W1. Practice pack loads as CODES originals and opens the first question",
          wsfiles() == ["Q01.py*", "Q02.py*", "Q03.py*", "Q03Data.txt*"] and wscur() == "Q01.py" and page.is_visible("#ws-banner"), f"{wsfiles()} {wscur()}")

    page.evaluate(f"() => {CM}.replaceRange('# my fix\\n', {{line: 0, ch: 0}})")
    badge = page.locator("#ws-codes li[data-name='Q01.py'] .ws-badge").count()
    page.keyboard.press("Control+s")
    prefill = page.input_value("#ws-saveas input")
    page.fill("#ws-saveas input", "Q01.py"); page.click("#ws-saveas .ok")
    refused = "must not overwrite" in page.inner_text("#ws-saveas .err")
    page.fill("#ws-saveas input", "Q01FINISHED"); page.click("#ws-saveas .ok")
    orig_text = page.evaluate("pydeWorkspace.files.find(f => f.name === 'Q01.py').doc.getValue()")
    check("W2. Edited original: badge, Save as starts from its name, refuses to overwrite, adds .py, original untouched",
          badge == 1 and prefill == "Q01.py" and refused and wscur() == "Q01FINISHED.py" and "Q01FINISHED.py" in wsfiles()
          and not orig_text.startswith("# my fix") and page.evaluate(f"{CM}.getValue()").startswith("# my fix"), f"{badge} {prefill} {refused} {wscur()}")

    page.click("#ws-codes li[data-name='Q03.py']")
    page.evaluate(f"""() => {{ const cm = {CM}; cm.setValue(cm.getValue().replace("    # Add your code here\\n    pass",
        "    name, score = line.strip().split(',')\\n    if int(score) > highScore:\\n        highName = name\\n        highScore = int(score)")); }}""")
    page.keyboard.press("Control+s"); page.fill("#ws-saveas input", "Q03FINISHED.py"); page.click("#ws-saveas .ok")
    click("#run-btn"); page.wait_for_function("!document.getElementById('run-btn').disabled")
    check("W3. Run reads the CODES data file", console().strip() == "Dara 91", console())

    page.click("#ws-scratch")
    scratch_ok = page.evaluate(f"{CM}.getValue()") == "print('scratch work')\n"
    set_code('with open("Q03Data.txt") as f:\n    n = len(f.readlines())\nwith open("report.txt", "w") as out:\n    out.write(str(n) + " students")\n')
    click("#run-btn"); page.wait_for_function("!document.getElementById('run-btn').disabled")
    rep = page.evaluate("(pydeWorkspace.files.find(f => f.name === 'report.txt') || {}).content")
    check("W4. Scratch program kept separate; files a program writes appear in My files", scratch_ok and rep == "5 students", f"{scratch_ok} {rep!r}")

    page.click("#ws-mine li[data-name='Q03FINISHED.py']")
    click("#debug-btn"); paused_line(); click("#dbg-continue"); wait_status("document.getElementById('status-text').textContent === 'Finished'")
    dbg_ok = "Dara 91" in console()
    page.click("button[data-tab=trace]"); page.fill("#trace-inputs", ""); page.click("#trace-build")
    page.wait_for_function("!document.getElementById('trace-build').disabled", timeout=20000)
    tdata = page.evaluate("pydeTrace.data")
    check("W5. Debug and Trace table work on a workspace file with its data file (file handles left out, escapes shown)",
          dbg_ok and any(r["vals"].get("highName") == '"Dara"' for r in tdata["rows"]) and "theFile" not in [c["key"] for c in tdata["cols"]]
          and any(r["vals"].get("line") == '"Amira,67\\n"' for r in tdata["rows"]), json.dumps(tdata["rows"][:4]))

    page.click("#ws-codes li[data-name='Q03Data.txt']"); clearConsole = page.evaluate("clearConsole()")
    page.click("#run-btn"); time.sleep(0.3)
    check("W6. Run on a data file is blocked with a message", console().strip() == "" and "data file" in page.inner_text("#toast"))

    page.click("#ws-mine li[data-name='Q03FINISHED.py']")
    before_new = page.evaluate("pydeWorkspace.files.find(f => f.name === 'Q03FINISHED.py').content")
    page.click("#new-btn")
    check("W7. New starts a blank scratch program without touching workspace files",
          wscur() is None and page.evaluate("pydeWorkspace.files.find(f => f.name === 'Q03FINISHED.py').content") == before_new)

    page.click("#ws-codes li[data-name='Q02.py']")
    page.evaluate(f"() => {CM}.replaceRange('# unsaved\\n', {{line: 0, ch: 0}})")
    set_scratch = page.evaluate("pydeWorkspace.open(null)")
    set_code("print('scratch after reload')\n"); time.sleep(1.5)
    page.reload(); page.wait_for_function("document.getElementById('status-text').textContent === 'Ready'", timeout=60000)
    if page.is_visible("#about-close"): page.click("#about-close")
    q2 = page.evaluate("pydeWorkspace.files.find(f => f.name === 'Q02.py')")
    check("W8. Workspace survives a reload; scratch draft is still the scratch program; unsaved edits to an original kept and flagged",
          wsfiles() == ["Q01.py*", "Q02.py*", "Q03.py*", "Q03Data.txt*", "Q01FINISHED.py", "Q03FINISHED.py", "report.txt"]
          and page.evaluate(f"{CM}.getValue()") == "print('scratch after reload')\n"
          and page.evaluate("pydeWorkspace.files.find(f => f.name === 'Q02.py').doc.getValue()").startswith("# unsaved")
          and page.locator("#ws-codes li[data-name='Q02.py'] .ws-badge").count() == 1, json.dumps(wsfiles()))

    with page.expect_download() as dl:
        page.click("#ws-download")
    zpath = dl.value.path()
    names = sorted(zipfile.ZipFile(zpath).namelist())
    check("W9. My files download as a .zip", dl.value.suggested_filename == "my-files.zip" and names == ["Q01FINISHED.py", "Q03FINISHED.py", "report.txt"], str(names))

    tmp = tempfile.mkdtemp()
    with zipfile.ZipFile(os.path.join(tmp, "pack.zip"), "w") as z:
        z.writestr("CODES/Q10.py", "print(open('Q10Data.txt').read().upper())\n"); z.writestr("CODES/Q10Data.txt", "hello\n"); z.writestr("__MACOSX/._Q10.py", "x")
    page.set_input_files("#ws-zip-input", os.path.join(tmp, "pack.zip"))
    page.wait_for_function("pydeWorkspace.files.some(f => f.name === 'Q10.py')", timeout=15000)
    click("#run-btn"); page.wait_for_function("!document.getElementById('run-btn').disabled")
    check("W10. A CODES .zip replaces the originals (My files kept), folders flattened, junk skipped, and runs",
          wsfiles() == ["Q10.py*", "Q10Data.txt*", "Q01FINISHED.py", "Q03FINISHED.py", "report.txt"] and wscur() == "Q10.py" and "HELLO" in console(), json.dumps(wsfiles()))

    fdir = os.path.join(tmp, "CODES"); os.makedirs(fdir)
    open(os.path.join(fdir, "Q20.py"), "w").write("print(20)\n"); open(os.path.join(fdir, "Q20Data.csv"), "w").write("a,b\n")
    page.set_input_files("#ws-folder-input", fdir)
    page.wait_for_function("pydeWorkspace.files.some(f => f.name === 'Q20.py')", timeout=15000)
    check("W11. Open CODES folder loads a whole folder", "Q20.py*" in wsfiles() and "Q20Data.csv*" in wsfiles() and "Q10.py*" not in wsfiles(), json.dumps(wsfiles()))

    open(os.path.join(tmp, "Q20.py"), "w").write("hacked\n"); open(os.path.join(tmp, "mine.py"), "w").write("print('mine')\n")
    page.set_input_files("#ws-add-input", [os.path.join(tmp, "Q20.py"), os.path.join(tmp, "mine.py")])
    page.wait_for_function("pydeWorkspace.files.some(f => f.name === 'mine.py')", timeout=15000)
    check("W12. Add files goes to My files and can't replace an original",
          "mine.py" in wsfiles() and page.evaluate("pydeWorkspace.files.find(f => f.name === 'Q20.py').content") == "print(20)\n")

    li = page.locator("#ws-mine li[data-name='mine.py']"); li.hover(); li.locator(".ws-del").click(); li.locator(".ws-del").click()
    check("W13. Deleting a file needs a second click", "mine.py" not in wsfiles())

    page.click("#ws-share"); time.sleep(0.3)
    link = page.evaluate("navigator.clipboard.readText()")
    spage = page.context.browser.new_context(viewport={"width": 1366, "height": 768})
    spage.route("**/*", route_one_host)
    sp = spage.new_page(); sp.goto(link)
    sp.wait_for_function("window.pydeWorkspace && pydeWorkspace.files.length > 0", timeout=60000)
    check("W14. Share pack link opens the CODES files on another device",
          sp.evaluate("pydeWorkspace.files.map(f => f.name + (f.original ? '*' : ''))") == ["Q20.py*", "Q20Data.csv*"] and sp.is_visible("#ws-side"))
    spage.close()
    check("W15. No uncaught page errors (workspace)", not errors, "; ".join(errors[:3]))

    # ---------------- GCSE layer: pseudocode reference ----------------
    page.click("button[data-tab=pseudo]")
    nrows = page.locator("#tab-pseudo tr[data-search]").count()
    check("P1. Pseudocode tab lists the 4CP0 constructs by section", page.is_visible("#tab-pseudo") and nrows >= 30 and page.locator("#tab-pseudo .pc-sec").count() == 9, str(nrows))
    page.fill("#pc-filter", "repeat")
    shown = page.evaluate("[...document.querySelectorAll('#tab-pseudo tr[data-search]')].filter(tr => tr.style.display !== 'none').map(tr => tr.children[0].textContent.split('\\n')[0])")
    check("P2. Filter narrows to matching constructs", shown == ["REPEAT", "REPEAT <expression> TIMES"], json.dumps(shown))
    page.fill("#pc-filter", "")
    page.locator("#tab-pseudo td.py", has_text="random.randint(0, n)").click(); time.sleep(0.3)
    check("P3. Clicking the Python copies it", page.evaluate("navigator.clipboard.readText()") == "import random\nrandom.randint(0, n)")

    # ---------------- GCSE layer: exam-conditions mock ----------------
    def reload_page():
        page.reload(); page.wait_for_function("document.getElementById('status-text').textContent === 'Ready'", timeout=60000)
        if page.is_visible("#about-close"): page.click("#about-close")
    page.evaluate("localStorage.removeItem('pyde-gcse-workspace')"); reload_page()
    page.click("#mock-btn")
    no_pack = page.is_disabled("#mock-go") and "Load a CODES pack" in page.inner_text("#mock-start .err")
    page.click("#mock-start button:has-text('Cancel')")
    page.evaluate("pydeWorkspace.loadPack(pydeWorkspace.SAMPLE_PACK, 'practice pack')")
    page.evaluate("pydeWorkspace.open('Q02.py')"); page.evaluate(f"() => {CM}.replaceRange('# quick\\n', {{line: 0, ch: 0}})")
    page.keyboard.press("Control+s"); page.fill("#ws-saveas input", "QUICK"); page.click("#ws-saveas .ok"); reload_page()
    check("M0. A file saved just before the tab is reloaded is not lost", "QUICK.py" in wsfiles(), json.dumps(wsfiles()))
    li = page.locator("#ws-mine li[data-name='QUICK.py']"); li.hover(); li.locator(".ws-del").click(); li.locator(".ws-del").click()
    page.evaluate("pydeWorkspace.open('Q02.py')"); page.evaluate(f"() => {CM}.undo()")
    page.click("#mock-btn")
    req = page.input_value("#mock-required").split("\n")
    check("M1. Start needs a CODES pack; required names read from the CODES files; 180 minutes by default",
          no_pack and req == ["Q01FINISHED.py", "Q02FINISHED.py", "Q03FINISHED.py"] and page.input_value("#mock-minutes") == "180", str(req))
    page.click("#mock-go"); time.sleep(1.2)
    hidden = page.evaluate("""['#tidy-btn', '#parsons-btn', '#share-btn', '#upload-btn', 'button[data-tab=trace]', 'button[data-tab=pseudo]', '#ws-load-zip', '#ws-share', '#mock-btn']
        .every(s => getComputedStyle(document.querySelector(s)).display === 'none')""")
    clock = page.inner_text("#mock-bar .clock")
    check("M2. Mock running: countdown shown, aids hidden, Run/Debug/Save as kept",
          page.is_visible("#mock-bar") and clock.startswith("2:59:5") and hidden and page.is_visible("#run-btn") and page.is_visible("#debug-btn") and page.is_visible("#ws-saveas-btn"), clock)
    reload_page(); time.sleep(1.2)
    check("M3. The clock keeps running through a reload", page.evaluate("document.body.classList.contains('mock-on')") and page.inner_text("#mock-bar .clock").startswith("2:59:"), page.inner_text("#mock-bar .clock"))
    page.evaluate("() => { const st = JSON.parse(localStorage.getItem('pyde-gcse-mock')); st.endAt = Date.now() + 4 * 60000; localStorage.setItem('pyde-gcse-mock', JSON.stringify(st)); }")
    reload_page(); time.sleep(1.2)
    check("M4. Under 5 minutes the bar turns urgent", page.get_attribute("#mock-bar", "class") == "urgent" and page.inner_text("#mock-bar .clock").startswith("0:03:"), page.get_attribute("#mock-bar", "class"))

    def save_as(name):
        page.keyboard.press("Control+s"); page.fill("#ws-saveas input", name); page.click("#ws-saveas .ok")
    page.evaluate("pydeWorkspace.open('Q01.py')"); page.evaluate(f"() => {CM}.replaceRange('# fixed\\n', {{line: 0, ch: 0}})"); save_as("Q01FINISHED")
    page.evaluate("pydeWorkspace.open('Q02.py')"); page.evaluate(f"() => {CM}.replaceRange('# done\\n', {{line: 0, ch: 0}})"); save_as("q02finished")
    page.evaluate("pydeWorkspace.open('Q03.py')"); page.evaluate(f"() => {CM}.replaceRange('# not saved\\n', {{line: 0, ch: 0}})")
    page.click("#mock-bar button"); page.wait_for_selector("#mock-summary:not(.hidden)", timeout=5000)
    summ = page.inner_text("#mock-summary .body")
    check("M5. Finish early: summary checks names - saved, near miss, missing - and flags unsaved edits",
          "1 of 3 required files" in summ and "You saved q02finished.py" in summ and "No file with this name" in summ and "Unsaved changes in Q03.py" in summ and "You finished early" in summ, summ.replace("\n", " | "))
    page.click("#mock-summary button:has-text('Close')")
    page.keyboard.press("Control+s")
    locked = (page.evaluate(f"{CM}.getOption('readOnly')") == "nocursor" and not page.is_visible("#run-btn") and not page.is_visible("#debug-btn")
              and page.is_hidden("#ws-saveas") and page.inner_text("#mock-bar .clock") == "Finished")
    page.evaluate("pydeWorkspace.open('Q01FINISHED.py')")
    check("M6. After finishing, editing is locked (also after switching file), Run/Debug/Save as gone", locked and page.evaluate(f"{CM}.getOption('readOnly')") == "nocursor",
          str([page.evaluate(f"{CM}.getOption('readOnly')"), page.is_visible("#run-btn"), page.is_visible("#debug-btn"), page.is_hidden("#ws-saveas"), page.inner_text("#mock-bar .clock")]))
    reload_page()
    check("M7. Still locked after a reload, summary reopens", page.is_visible("#mock-summary") and page.evaluate(f"{CM}.getOption('readOnly')") == "nocursor")
    with page.expect_download() as dl:
        page.click("#mock-zip")
    zn = sorted(zipfile.ZipFile(dl.value.path()).namelist())
    check("M8. Download my files gives a dated mock .zip", re.match(r"mock-\d{4}-\d\d-\d\d\.zip$", dl.value.suggested_filename) is not None and zn == ["Q01FINISHED.py", "q02finished.py"], f"{dl.value.suggested_filename} {zn}")
    page.click("#mock-end")
    check("M9. End mock unlocks everything", not page.is_visible("#mock-bar") and page.is_visible("#run-btn") and page.is_visible("button[data-tab=trace]")
          and page.evaluate(f"{CM}.getOption('readOnly')") is False and page.evaluate("localStorage.getItem('pyde-gcse-mock')") is None)
    page.evaluate("pydeMock.start({minutes: 0.04, required: ['Q01FINISHED.py']})")
    page.wait_for_selector("#mock-summary:not(.hidden)", timeout=8000)
    check("M10. When time runs out the mock finishes by itself", "Time is up" in page.inner_text("#mock-summary .body") and "1 of 1" in page.inner_text("#mock-summary .body"))
    page.click("#mock-end")
    check("M11. No uncaught page errors (mock)", not errors, "; ".join(errors[:3]))

    # ---------------- Help menu and guide viewer ----------------
    check("G1. About button replaced by a Help menu", not page.is_visible("#about-btn") and page.is_visible("#help-btn") and page.is_hidden("#help-menu"))
    page.click("#help-btn")
    items = page.evaluate("[...document.querySelectorAll('#help-menu button')].filter(b => b.offsetParent).map(b => b.textContent)")
    page.click("#help-menu button[data-guide=student]")
    page.wait_for_selector("#guide-body h1", timeout=15000)
    check("G2. Menu lists both guides and About; the student guide renders in the page",
          len(items) == 3 and "Student guide" in items[0] and "Teacher" in items[1] and "About" in items[2]
          and page.inner_text("#guide-body h1").startswith("pyde: student guide") and page.locator("#guide-body table").count() >= 4, json.dumps(items))
    page.keyboard.press("Escape")
    check("G3. Escape closes the guide", page.is_hidden("#guide-overlay"))
    page.evaluate("pydeHelp.openDoc('docs/TEACHER-GUIDE.md', '3-data-protection-and-safeguarding')")
    page.wait_for_function("document.querySelector('#guide-body h1') && document.querySelector('#guide-body h1').textContent.startsWith('pyde (GCSE edition)')", timeout=15000)
    time.sleep(0.3)
    in_view = page.evaluate("(() => { const h = document.getElementById('3-data-protection-and-safeguarding'); const b = document.getElementById('guide-body').getBoundingClientRect(); const r = h.getBoundingClientRect(); return r.top >= b.top - 2 && r.top < b.top + 80; })()")
    page.locator("#guide-body a", has_text="STUDENT-GUIDE.md").first.click()
    page.wait_for_function("(document.querySelector('#guide-body h1') || {textContent: ''}).textContent.startsWith('pyde: student guide')", timeout=15000)
    check("G4. Heading anchors scroll; links between guides open in the viewer", in_view and page.inner_text("#guide-bar .t") == "Student guide")
    page.click("#guide-close")
    page.click("#help-btn"); page.click("#help-about")
    about_links = page.locator("#about-overlay .about-guides a").count()
    page.locator("#about-overlay .about-guides a").nth(1).click()
    page.wait_for_function("document.querySelector('#guide-bar .t').textContent === 'Teacher & tutor guide' && !document.getElementById('guide-overlay').classList.contains('hidden')", timeout=15000)
    check("G5. About pop-up links to both guides", about_links == 2 and page.is_hidden("#about-overlay"))
    page.click("#guide-close")
    gp = page.context.new_page(); gp.goto(BASE + "index.html#guide=student")
    gp.wait_for_selector("#guide-body h1", timeout=60000)
    check("G6. #guide=student opens the guide directly", gp.is_visible("#guide-overlay") and gp.inner_text("#guide-bar .t") == "Student guide")
    gp.close()
    page.evaluate("pydeWorkspace.loadPack(pydeWorkspace.SAMPLE_PACK, 'p')"); page.evaluate("pydeMock.start({minutes: 60, required: []})")
    page.click("#help-btn")
    vis = page.evaluate("[...document.querySelectorAll('#help-menu button')].filter(b => b.offsetParent).map(b => b.id || b.dataset.guide)")
    page.keyboard.press("Escape"); page.evaluate("pydeMock.endMock()")
    check("G7. During a mock only About is offered (the guides contain Python equivalents)", vis == ["help-about"], json.dumps(vis))

    # ---------------- self-hosting ----------------
    set_code("x=[1,2 ,3]\nif x :print( x )\n"); click("#tidy-btn")
    page.wait_for_function("document.querySelector('.CodeMirror').CodeMirror.getValue().startsWith('x = [1, 2, 3]')", timeout=30000)
    check("H2. Tidy works from vendored wheels (no PyPI)", True)
    run_and_wait("import p5\ndef setup():\n    p5.createCanvas(100, 100)\ndef draw():\n    p5.background(200)\n")
    page.wait_for_selector("#p5-container canvas", timeout=15000)
    check("H3. p5 loads from vendor/", page.evaluate("typeof window.p5") == "function")
    fonts = page.evaluate("document.fonts.check('14px \"Fira Code\"')")
    check("H4. Fira Code font served locally", fonts)
    check("H5. No request went to any other host", not external, "; ".join(external[:5]))
    check("H6. No uncaught page errors (second half)", not errors, "; ".join(errors[:3]))

    # ---------------- file:// fallback ----------------
    fpage, ferrs = open_page(b, "file:///" + os.path.join(ROOT, "index.html").replace(os.sep, "/").lstrip("/"), route_file_mode)
    fpage.evaluate("(s) => document.querySelector('.CodeMirror').CodeMirror.setValue(s)", "print(6 * 7)\n")
    fpage.click("#run-btn"); fpage.wait_for_function("!document.getElementById('run-btn').disabled")
    check("F1. file:// still works (Pyodide from jsDelivr, rest local)",
          fpage.inner_text("#status-text") == "Ready" and "42" in fpage.inner_text("#console-output") and not ferrs, "; ".join(ferrs[:3]))
    fpage.context.close()

    # ---------------- browsers without JSPI (Firefox, Safari/iPad) ----------------
    npage, nerrs = open_page(b, BASE + "index.html", route_one_host,
                             init_script="delete WebAssembly.Suspending; delete WebAssembly.promising;")
    check("N1. No JSPI: page loads, Debug disabled", npage.inner_text("#status-text") == "Ready" and npage.is_disabled("#debug-btn"))
    npage.evaluate("(s) => document.querySelector('.CodeMirror').CodeMirror.setValue(s)",
                   'import time\ndef ask():\n    return input("Name? ")\nn = ask()\ntime.sleep(0.1)\nprint("Hi " + n)\n')
    npage.click("#run-btn")
    npage.wait_for_selector("#console-output .console-inline-input", timeout=10000)
    stop_shown = npage.is_visible("#run-stop-btn")
    npage.fill("#console-output .console-inline-input", "Bo"); npage.press("#console-output .console-inline-input", "Enter")
    npage.wait_for_function("!document.getElementById('run-btn').disabled")
    check("N2. No JSPI: Run + inline input via the original AST rewrite, no Stop button",
          "Hi Bo" in npage.inner_text("#console-output") and not stop_shown and not nerrs, npage.inner_text("#console-output") + " ".join(nerrs))
    npage.evaluate("(s) => document.querySelector('.CodeMirror').CodeMirror.setValue(s)", 'n = int(input())\nprint(n * 2)\n')
    npage.click("button[data-tab=trace]"); npage.fill("#trace-inputs", "21"); npage.click("#trace-build")
    npage.wait_for_function("!document.getElementById('trace-build').disabled", timeout=20000)
    check("N3. No JSPI: trace tables work with pre-set inputs", "42" in npage.inner_text("#trace-table") and not nerrs, " ".join(nerrs))
    npage.context.close()
    b.close()

print(f"\n{sum(results)}/{len(results)} passed")
