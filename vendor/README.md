# Vendored dependencies

Everything the page needs is served from this repository, so a school web
filter (for example Smoothwall) only has to allow **one host**: wherever this
site is published. There are no third-party CDNs, and the versions can't change
underneath pupils.

Opening `index.html` directly from disk (`file://`) is a special case. Browsers
won't let a `file://` page fetch the Pyodide WebAssembly and stdlib, so it falls
back to loading Pyodide from jsDelivr. The other libraries load locally either way.

| Folder | What | Version | Licence |
|---|---|---|---|
| `pyodide/0.29.5/` | Pyodide core: CPython 3.13 compiled to WebAssembly (`pyodide.js`, `pyodide.asm.js`, `pyodide.asm.wasm`, `python_stdlib.zip`, `pyodide-lock.json`) | 0.29.5 | MPL-2.0 (`pyodide/LICENSE`) |
| `codemirror/5.65.16/` | Editor, Python mode, Dracula and Eclipse themes, bracket addons, search cursor | 5.65.16 | MIT |
| `lz-string/1.5.0/` | Compresses share links | 1.5.0 | MIT |
| `p5/1.9.4/` | p5.js, loaded on demand for sketches | 1.9.4 | LGPL-2.1 (unmodified) |
| `fonts/fira-code/` | Fira Code latin 400/500/600 woff2 (from @fontsource) | 5.3.0 | SIL OFL 1.1 |
| `wheels/` | `autopep8` and `pycodestyle` wheels, used by the Tidy button. They're unpacked straight into site-packages, so no micropip and no PyPI access are needed. | 2.3.2 / 2.15.0 | MIT (inside each wheel's `dist-info`) |

## Updating

The files come unmodified from the npm packages (`pyodide`, `codemirror`,
`lz-string`, `p5`, `@fontsource/fira-code`) and from PyPI. When you bump a
version:

- Put the new files in a new versioned folder.
- Update the paths in `index.html`. Search for `vendor/`.
- For Pyodide, also update the `PYODIDE_CDN` fallback URL.
- Run `dev/test_debugger.py`.
