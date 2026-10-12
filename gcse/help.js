/* pyde GCSE layer: Help menu and in-app guide viewer
   ------------------------------------------------------------------------
   Replaces the toolbar's "About" button with a "Help" menu:
     - Student guide            (docs/STUDENT-GUIDE.md)
     - Teacher & tutor guide    (docs/TEACHER-GUIDE.md)
     - About this page          (pyde's original About pop-up)
   The guides are rendered inside the page from the same site (marked.js,
   vendored and loaded on first use), so they work through a school web
   filter that only allows this one host. Links between guides and to other
   docs in the repo open in the viewer; #headings scroll; external links open
   in a new tab. #guide=student / #guide=teacher opens a guide directly.
   Guides are hidden during a mock exam (they contain the Python
   equivalents that the exam doesn't provide); About stays.

   Self-contained: index.html only needs <script src="gcse/help.js">. */
(function () {
  'use strict';

  const GUIDES = {
    student: { path: 'docs/STUDENT-GUIDE.md', title: 'Student guide', icon: '📘' },
    teacher: { path: 'docs/TEACHER-GUIDE.md', title: 'Teacher & tutor guide', icon: '📗' },
  };
  const MARKED_SRC = 'vendor/marked/15.0.12/marked.umd.js';
  const GITHUB_DOCS = 'https://github.com/ukfootprint/pydeXTD/blob/debugger/';

  const STYLE = `
  .help-wrap{ position:relative; display:inline-flex; }
  #help-menu{ position:absolute; top:calc(100% + 4px); left:0; min-width:15rem; background:var(--bg); border:1px solid var(--comment);
    border-radius:7px; box-shadow:0 6px 24px rgba(0,0,0,.25); padding:.3rem; z-index:1400; display:flex; flex-direction:column; }
  #help-menu.hidden{ display:none; }
  #help-menu button{ all:unset; display:flex; align-items:center; gap:.5rem; padding:.45rem .65rem; border-radius:5px; cursor:pointer;
    font-size:.85rem; color:var(--fg); }
  #help-menu button:hover, #help-menu button:focus-visible{ background:var(--current-line); outline:none; }
  #help-menu hr{ border:none; border-top:1px solid var(--border); margin:.25rem .2rem; }
  body.mock-on #help-menu .help-guide, body.mock-on #help-menu hr, body.mock-on .about-guides{ display:none !important; }
  .about-guides a{ color:var(--cyan); cursor:pointer; }
  #guide-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; z-index:1550; padding:1rem; }
  #guide-overlay.hidden{ display:none; }
  #guide-box{ background:var(--bg); color:var(--fg); border:1px solid var(--comment); border-radius:9px; width:min(900px,96vw); height:min(92vh,1100px);
    display:flex; flex-direction:column; overflow:hidden; }
  #guide-bar{ display:flex; align-items:center; gap:.5rem; padding:.5rem .8rem; border-bottom:1px solid var(--border); background:var(--panel-bg); }
  #guide-bar .t{ flex:1; font-weight:600; color:var(--purple); font-size:.95rem; }
  #guide-bar button{ background:var(--current-line); color:var(--fg); border:1px solid var(--comment); border-radius:5px; padding:.28rem .7rem;
    cursor:pointer; font-size:.8rem; font-weight:600; }
  #guide-body{ flex:1; overflow:auto; padding:1rem 1.6rem 2rem; font-size:.92rem; line-height:1.6; }
  #guide-body h1{ font-size:1.5rem; margin:.2rem 0 .8rem; color:var(--purple); }
  #guide-body h2{ font-size:1.2rem; margin:1.6rem 0 .5rem; padding-bottom:.25rem; border-bottom:1px solid var(--border); }
  #guide-body h3{ font-size:1.02rem; margin:1.2rem 0 .4rem; }
  #guide-body a{ color:var(--cyan); }
  #guide-body code{ font-family:'Fira Code',monospace; font-variant-ligatures:none; font-size:.86em; background:var(--panel-bg); padding:.08rem .3rem; border-radius:3px; }
  #guide-body pre{ background:var(--panel-bg); padding:.7rem .9rem; border-radius:6px; overflow:auto; }
  #guide-body pre code{ background:none; padding:0; }
  #guide-body table{ border-collapse:collapse; margin:.6rem 0 1rem; display:block; overflow-x:auto; }
  #guide-body th, #guide-body td{ border:1px solid var(--border); padding:.35rem .6rem; text-align:left; vertical-align:top; }
  #guide-body th{ background:var(--panel-bg); }
  #guide-body blockquote{ margin:.8rem 0; padding:.4rem .9rem; border-left:4px solid var(--orange); background:var(--panel-bg); border-radius:0 6px 6px 0; }
  #guide-body hr{ border:none; border-top:1px solid var(--border); margin:1.4rem 0; }
  #guide-body li{ margin:.15rem 0; }
  #guide-body input[type=checkbox]{ margin-right:.35rem; }
  @media print{
    body > *:not(#guide-overlay){ display:none !important; }
    #guide-overlay{ position:static; background:none; padding:0; }
    #guide-box{ border:none; width:auto; height:auto; overflow:visible; }
    #guide-bar{ display:none; }
    #guide-body{ overflow:visible; }
  }
  `;

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v !== null && v !== undefined) e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids) if (kid !== null && kid !== undefined) e.append(kid);
    return e;
  }

  /* ---------------- markdown ---------------- */
  let markedLoad = null;
  function loadMarked() {
    if (window.marked) return Promise.resolve();
    if (!markedLoad) markedLoad = new Promise((resolve, reject) => {
      const s = el('script', { src: MARKED_SRC });
      s.onload = resolve; s.onerror = () => { markedLoad = null; reject(new Error('could not load the guide viewer')); };
      document.head.append(s);
    });
    return markedLoad;
  }

  // GitHub-style heading ids, so links like TEACHER-GUIDE.md#3-data-protection-and-safeguarding work
  const slug = (text) => text.toLowerCase().trim().replace(/[^\w\- ]+/g, '').replace(/ /g, '-');

  let currentUrl = null;

  async function openDoc(path, anchor) {
    const overlay = document.getElementById('guide-overlay');
    const body = document.getElementById('guide-body');
    const url = new URL(path, location.href);
    const known = Object.values(GUIDES).find(g => new URL(g.path, location.href).href === url.href);
    document.querySelector('#guide-bar .t').textContent = known ? known.title : url.pathname.split('/').pop();
    overlay.classList.remove('hidden');
    if (currentUrl !== url.href) {
      body.innerHTML = '<p style="color:var(--comment)">Loading…</p>';
      try {
        if (location.protocol === 'file:') throw new Error('file');
        const [resp] = await Promise.all([fetch(url.href, { cache: 'no-cache' }), loadMarked()]);
        if (!resp.ok) throw new Error(resp.status);
        body.innerHTML = window.marked.parse(await resp.text(), { gfm: true });
        currentUrl = url.href;
        fixUp(body, url);
      } catch (e) {
        const repoPath = url.pathname.replace(/^.*?\/(docs|gcse|vendor|DEBUGGER\.md|README\.md)/, '$1');
        body.innerHTML = '';
        body.append(el('p', {}, 'The guide couldn’t be shown here (it needs the published site, not a file opened from disk). ',
          el('a', { href: GITHUB_DOCS + repoPath, target: '_blank', rel: 'noopener' }, 'Open it on GitHub'), ' instead.'));
        currentUrl = null;
      }
    }
    const target = anchor && body.querySelector('#' + CSS.escape(anchor));
    if (target) target.scrollIntoView(); else body.scrollTop = 0;
    document.getElementById('guide-close').focus({ preventScroll: true });
  }

  function fixUp(body, base) {
    body.querySelectorAll('h1,h2,h3,h4').forEach(h => { if (!h.id) h.id = slug(h.textContent); });
    body.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (href.startsWith('#')) {
        a.addEventListener('click', (e) => { e.preventDefault(); const t = body.querySelector('#' + CSS.escape(href.slice(1))); if (t) t.scrollIntoView({ behavior: 'smooth' }); });
        return;
      }
      const u = new URL(href, base);
      if (u.origin === location.origin && /\.md$/i.test(u.pathname)) {
        a.addEventListener('click', (e) => { e.preventDefault(); openDoc(u.pathname, u.hash.slice(1)); });
      } else if (u.origin === location.origin && u.pathname.replace(/\/$/, '') === location.pathname.replace(/\/(index\.html)?$/, '')) {
        a.addEventListener('click', (e) => { e.preventDefault(); closeDoc(); });   // a link to the app itself
      } else {
        a.target = '_blank'; a.rel = 'noopener';
      }
    });
  }

  function closeDoc() {
    document.getElementById('guide-overlay').classList.add('hidden');
    document.getElementById('help-btn').focus({ preventScroll: true });
  }

  /* ---------------- menu ---------------- */
  function install() {
    document.head.append(el('style', {}, STYLE));
    const about = document.getElementById('about-btn');
    about.style.display = 'none';      // still used: its click opens pyde's About pop-up

    const menu = el('div', { id: 'help-menu', class: 'hidden', role: 'menu' },
      el('button', { class: 'help-guide', role: 'menuitem', 'data-guide': 'student' }, GUIDES.student.icon + ' ' + GUIDES.student.title),
      el('button', { class: 'help-guide', role: 'menuitem', 'data-guide': 'teacher' }, GUIDES.teacher.icon + ' ' + GUIDES.teacher.title),
      el('hr', {}),
      el('button', { role: 'menuitem', id: 'help-about' }, 'ℹ️ About this page'));
    const btn = el('button', { id: 'help-btn', class: 'secondary', 'aria-haspopup': 'menu', 'aria-expanded': 'false', title: 'Guides and About' }, '❓ Help ▾');
    const wrap = el('span', { class: 'help-wrap' }, btn, menu);
    about.parentNode.insertBefore(wrap, about);

    const setOpen = (open) => {
      menu.classList.toggle('hidden', !open);
      if (open) {   // open towards whichever side has room (the toolbar wraps on narrow screens)
        menu.style.left = '0'; menu.style.right = 'auto';
        if (menu.getBoundingClientRect().right > window.innerWidth - 8) { menu.style.left = 'auto'; menu.style.right = '0'; }
      }
      btn.setAttribute('aria-expanded', String(open));
      if (open) { const first = [...menu.querySelectorAll('button')].find(b => b.offsetParent !== null); if (first) first.focus(); }
    };
    btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.classList.contains('hidden')); });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) setOpen(false); });
    menu.addEventListener('keydown', (e) => {
      const items = [...menu.querySelectorAll('button')].filter(b => b.offsetParent !== null);
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      if (e.key === 'Escape') { setOpen(false); btn.focus(); }
    });
    menu.querySelectorAll('.help-guide').forEach(b => b.addEventListener('click', () => { setOpen(false); openDoc(GUIDES[b.dataset.guide].path); }));
    document.getElementById('help-about').addEventListener('click', () => { setOpen(false); about.click(); });

    // guide links in pyde's About pop-up too
    const aboutModal = document.querySelector('#about-overlay .about-modal');
    const closeBtn = document.getElementById('about-close');
    const guideLink = (key) => el('a', { onclick: () => { document.getElementById('about-overlay').classList.add('hidden'); openDoc(GUIDES[key].path); } }, GUIDES[key].title.toLowerCase().replace(/^./, c => c.toUpperCase()));
    aboutModal.insertBefore(el('p', { class: 'about-guides' }, el('strong', {}, 'Guides: '), guideLink('student'), ' · ', guideLink('teacher'), ' (also under Help).'), closeBtn);

    // viewer
    document.body.append(el('div', { id: 'guide-overlay', class: 'hidden', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Guide' },
      el('div', { id: 'guide-box' },
        el('div', { id: 'guide-bar' },
          el('span', { class: 't' }, ''),
          el('button', { onclick: () => window.print(), title: 'Print or save as PDF' }, '🖨 Print'),
          el('button', { id: 'guide-close', onclick: closeDoc }, '✕ Close')),
        el('div', { id: 'guide-body' }))));
    document.getElementById('guide-overlay').addEventListener('click', (e) => { if (e.target.id === 'guide-overlay') closeDoc(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.getElementById('guide-overlay').classList.contains('hidden')) closeDoc(); });
  }

  install();
  const m = location.hash.match(/^#guide=(student|teacher)$/);
  if (m && !document.body.classList.contains('mock-on')) openDoc(GUIDES[m[1]].path);
  window.pydeHelp = { openDoc, closeDoc, GUIDES };
})();
