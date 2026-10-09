"""End-to-end tests for the pyde debugger, in headless Chromium (Playwright).

CDN requests are served from local npm copies so the tests run offline:
    npm install pyodide@0.29.5 codemirror@5.65.16 lz-string@1.5.0
    pip install playwright && python -m playwright install chromium
    PYDE_NODE_MODULES=path/to/node_modules python dev/test_debugger.py [path/to/index.html]
"""
import json, mimetypes, os, sys, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
PYDE = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "index.html"))
NM = os.environ.get("PYDE_NODE_MODULES", os.path.join(HERE, "node_modules"))
SHOTS = os.path.join(HERE, "screenshots")
os.makedirs(SHOTS, exist_ok=True)
CDN = {
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css": "codemirror/lib/codemirror.css",
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/theme/dracula.min.css": "codemirror/theme/dracula.css",
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/theme/eclipse.min.css": "codemirror/theme/eclipse.css",
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js": "codemirror/lib/codemirror.js",
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/python/python.min.js": "codemirror/mode/python/python.js",
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/edit/matchbrackets.min.js": "codemirror/addon/edit/matchbrackets.js",
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/edit/closebrackets.min.js": "codemirror/addon/edit/closebrackets.js",
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/search/searchcursor.min.js": "codemirror/addon/search/searchcursor.js",
    "https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js": "lz-string/libs/lz-string.min.js",
}
PYODIDE_PREFIX = "https://cdn.jsdelivr.net/pyodide/v0.29.5/full/"

def route(r):
    url = r.request.url
    path = None
    if url in CDN:
        path = os.path.join(NM, CDN[url])
    elif url.startswith(PYODIDE_PREFIX):
        path = os.path.join(NM, "pyodide", url[len(PYODIDE_PREFIX):].split("?")[0])
    elif url.startswith("file://"):
        return r.continue_()
    if path and os.path.exists(path):
        ct = mimetypes.guess_type(path)[0] or "application/octet-stream"
        if path.endswith(".wasm"): ct = "application/wasm"
        return r.fulfill(path=path, content_type=ct, headers={"Access-Control-Allow-Origin": "*"})
    return r.abort()

results = []
def check(name, cond, detail=""):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + (f"  -- {detail}" if detail else ""))

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1366, "height": 768})
    ctx.route("**/*", route)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("file:///" + PYDE.replace(os.sep, "/").lstrip("/"))
    page.wait_for_function("document.getElementById('status-text').textContent === 'Ready'", timeout=60000)
    if page.is_visible("#about-close"): page.click("#about-close")

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
    click("#dbg-stop")
    b.close()

print(f"\n{sum(results)}/{len(results)} passed")
