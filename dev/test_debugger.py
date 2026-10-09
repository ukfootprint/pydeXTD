"""End-to-end tests for pyde (debugger, Run Stop, self-hosting), in headless Chromium.

The page is served from a local HTTP server and *every* request to any other
host is blocked and recorded, which proves the site needs only one host.
The file:// fallback (which loads Pyodide from jsDelivr) is tested by serving
jsDelivr URLs from a local npm copy of the same Pyodide release.

    pip install playwright && python -m playwright install chromium
    npm install pyodide@0.29.5          # only for the file:// fallback check
    PYDE_NODE_MODULES=path/to/node_modules python dev/test_debugger.py
"""
import http.server, json, mimetypes, os, socketserver, sys, threading, time
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
    npage.context.close()
    b.close()

print(f"\n{sum(results)}/{len(results)} passed")
