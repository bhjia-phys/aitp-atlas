// ----------------------------------------------------------------- reader ---
// Every document opens inside DSH: topics as workspaces, notes and LaTeX in a
// reader that turns into an editor, PDFs page by page, figures, notebooks, data
// and folders. Selected text can be handed to an AI session.

/** Unsaved edits, per tab: leaving one tab never asks about another's. */
const editorDirty = {};
const TYPE_LABEL = { markdown: 'Note', pdf: 'PDF', tex: 'LaTeX', bib: 'Bibliography', code: 'Code', notebook: 'Notebook', image: 'Figure', video: 'Video', audio: 'Audio', table: 'Table', text: 'Text', folder: 'Folder', other: 'File' };

function DocView({ path, overview: ov, go, flash, version, edit, created, anchor, anchorAt }) {
  const type = typeOf(path);
  const navigate = useNavigate(go, flash);
  if (['pdf', 'image', 'video', 'audio', 'folder', 'other'].includes(type)) {
    return h(DocFrame, { path, type, ov, go, flash, navigate }, (frame) => {
      if (type === 'pdf') return h(PdfLayout, { path, flash, go, navigate, anchor, anchorAt });
      if (type === 'image') return h('figure', { className: 'atlas-figure' }, h('img', { src: rawUrl(path), alt: baseName(path) }));
      if (type === 'video') return h('video', { className: 'atlas-video', src: rawUrl(path), controls: true, preload: 'metadata' });
      if (type === 'audio') return h('audio', { src: rawUrl(path), controls: true });
      if (type === 'folder') return h(FolderView, { path, go, navigate, onInfo: frame.setInfo });
      return h('div', { className: 'atlas-panel' }, h('p', null, `Atlas does not show .${extOf(path)} files.`), h(Button, { icon: 'external', onClick: () => openFile(path).catch((e) => flash(e.message)) }, 'Open with the system app'));
    });
  }
  return h(TextDoc, { path, ov, go, flash, version, edit, created, navigate, anchor, anchorAt });
}

function TextDoc({ path, ov, go, flash, version, edit, created, navigate, anchor, anchorAt }) {
  const [local, setLocal] = useState(0);
  const { data, error, loading } = useApi('note', version || local ? { path, fresh: 1 } : { path }, path, `${version}:${local}`);
  if (loading && !data) return h(Loading, { label: 'Opening ' + baseName(path) + '…' });
  if (error) return h(ErrorNote, { error });
  if (data.topic && !edit) return h(TopicWorkspace, { data, ov, go, flash, navigate, anchor, anchorAt });
  return h(DocFrame, { path, type: data.type, ov, go, flash, navigate, data, editing: Boolean(edit && data.editable) },
    () => (edit && data.editable
      ? (data.type === 'tex' ? h(TexWorkspace, { data, go, flash, anchor, anchorAt }) : h(Editor, { data, go, flash, created, onSaved: () => setLocal(Date.now()) }))
      : h(TextBody, { data, navigate, anchor, anchorAt })));
}

/** The frame every document shares: where it is, what it is, what can be done with it. */
function DocFrame({ path, type, ov, go, flash, navigate, data, editing, children }) {
  const [info, setInfo] = useState(null);
  const [fileOwner, setFileOwner] = useState(null);
  const body = useRef(null);
  // A PDF, figure or other file has no note payload: its folder says which topic it belongs to.
  useEffect(() => {
    if (data || type === 'folder') return undefined;
    let live = true;
    api('dir', { query: { path: dirOf(path) } }).then((d) => live && setFileOwner(d.owner || null), () => {});
    return () => {
      live = false;
    };
  }, [path, type, Boolean(data)]);
  const owner = (data && data.owner) || (info && info.owner) || fileOwner || null;
  const color = owner ? directionColor(ov, owner.direction || topicDirection(ov, owner.id)) : 'var(--link)';
  const title = (data && data.title) || baseName(path) || path;
  const crumbs = [{ label: 'Universe', go: { view: 'home' } }];
  if (owner) crumbs.push({ label: shortTitle(owner.title, 34), dot: color, go: { view: 'doc', path: owner.file } });
  crumbs.push({ label: baseName(path) || path });
  const editable = data && data.editable && !editing;
  const shown = (data && data.shown) || (info && info.shown) || path;
  const plainTitle = title.replace(/\*\*|`/g, '');
  usePublishFocus({ kind: 'doc', topic: owner ? { id: owner.id, title: owner.title, path: owner.file } : null, doc: { type, title: plainTitle, path } }, [path, owner ? owner.file : '', plainTitle, type]);
  const asks = [
    { key: 'discuss', label: 'Discuss this', hint: 'Read it together', prompt: 'Read this document and discuss it with me.' },
    { key: 'explain', label: 'Explain it to me', hint: 'Step by step, at my level', prompt: 'Explain this document to me step by step, at my level, with a figure where it helps.' },
    { key: 'check', label: 'Check it', hint: 'Derivations, numbers, references', prompt: 'Check this document: the derivations, numbers and references; report what holds and what does not.' },
    { key: 'continue', label: 'Continue from it', hint: 'The next step it implies', prompt: 'Continue the work in this document: propose the next step and carry it out within what I have agreed.' },
  ];
  return h('div', { className: 'atlas-page is-wide atlas-doc', style: { '--dir': color } },
    h(Crumbs, { items: crumbs, go }),
    h('header', { className: 'atlas-doc-head' },
      h('p', { className: 'atlas-kicker' }, h(Icon, { name: TYPE_ICON[type] || 'note', size: 14 }), TYPE_LABEL[type] || 'File'),
      h('h1', null, plainTitle),
      h('div', { className: 'atlas-meta' },
        h('span', { className: 'atlas-path' }, shown),
        data && data.size ? h('span', null, sizeOf(data.size)) : null,
        data && data.mtimeMs ? h('span', { className: 'atlas-date' }, 'changed ' + dateOf(data.mtimeMs)) : null),
      h('div', { className: 'atlas-actions' },
        type === 'folder' ? null : h(AskMenu, { asks }),
        editable ? h(Button, { icon: 'edit', onClick: () => go({ view: 'doc', path, edit: true, full: type === 'tex' }), title: type === 'tex' ? 'Write it as the page, with its PDF in a Preview tab beside it' : undefined }, 'Edit') : null,
        type === 'folder' ? null : h(Button, { quiet: true, icon: 'folder', onClick: () => go({ view: 'doc', path: dirOf(path) }) }, 'Folder'),
        h(Button, { quiet: true, icon: 'external', title: 'Open with the system app', onClick: () => openFile(path).then(() => flash('Opened with the system app.')).catch((e) => flash(e.message)) }, 'System app'))),
    data ? h(LinkedFrom, { refs: data.linkedFrom, go, label: 'Cited by' }) : null,
    h(DocThreads, { path }),
    h('div', { className: 'atlas-doc-body', ref: body }, children({ setInfo })));
}

function TextBody({ data, navigate, anchor, anchorAt }) {
  const article = useRef(null);
  const text = data.type === 'markdown' ? data.body.replace(/^\s*#\s+.+\n/, '') : '';
  // A link to a section of this note scrolls to its heading (or an explicit anchor's place);
  // a line reference (`#L849`) scrolls source, LaTeX or code to that line.
  useEffect(() => {
    if (!anchor) return undefined;
    const line = /^l(\d+)/i.exec(String(anchor));
    let find = null;
    if (line && data.type !== 'markdown') find = () => (article.current ? article.current.querySelectorAll('.atlas-lines > li')[Number(line[1]) - 1] : null);
    else if (text) {
      const target = anchorTarget(text, anchor);
      if (target) find = () => (target.heading >= 0 ? nthHeading(article.current, target.heading) || article.current : article.current);
    }
    if (!find) return undefined;
    const timer = setTimeout(() => revealElement(find()), 120);
    return () => clearTimeout(timer);
  }, [text, anchor, anchorAt, data.type]);
  if (data.type === 'markdown') return h('article', { className: 'atlas-reading', ref: article }, h(Markdown, { text, baseFile: data.path, onNavigate: navigate }));
  if (data.type === 'notebook') return h(NotebookView, { text: data.body, path: data.path });
  if (data.type === 'table') return h(TableView, { text: data.body, tab: /\.tsv$/i.test(data.path) });
  return h('div', { ref: article }, h(SourceView, { text: data.body, tex: data.type === 'tex' || data.type === 'bib', truncated: data.truncated }));
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** LaTeX and BibTeX get a light touch: commands, math and comments; other source stays plain. */
function highlightTex(line) {
  let html = escapeHtml(line);
  const comment = /(^|[^\\])(%.*)$/.exec(html);
  let tail = '';
  if (comment) {
    tail = `<span class="c">${comment[2]}</span>`;
    html = html.slice(0, comment.index + comment[1].length);
  }
  html = html.replace(/(\$\$?)([^$]+?)\1/g, '<span class="m">$&</span>').replace(/\\[a-zA-Z@]+\*?/g, '<span class="k">$&</span>');
  return html + tail;
}

function SourceView({ text, tex, truncated }) {
  const lines = useMemo(() => String(text).split('\n'), [text]);
  const light = tex && text.length < 400000;
  return h('div', { className: 'atlas-source' },
    h('ol', { className: 'atlas-lines' }, lines.map((line, i) => (light
      ? h('li', { key: i, dangerouslySetInnerHTML: { __html: highlightTex(line) || '&#8203;' } })
      : h('li', { key: i }, line || '​')))),
    truncated ? h('p', { className: 'atlas-muted' }, 'Showing the first 2 MB.') : null);
}

function TableView({ text, tab }) {
  const rows = useMemo(() => {
    const out = [];
    for (const line of String(text).split(/\r?\n/).slice(0, 401)) {
      if (!line.trim()) continue;
      const cells = [];
      let cell = '';
      let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
          if (quoted && line[i + 1] === '"') {
            cell += '"';
            i += 1;
          } else quoted = !quoted;
        } else if (!quoted && ch === (tab ? '\t' : ',')) {
          cells.push(cell);
          cell = '';
        } else cell += ch;
      }
      cells.push(cell);
      out.push(cells);
    }
    return out;
  }, [text, tab]);
  if (rows.length === 0) return h(Empty, null, 'The table is empty.');
  return h('div', { className: 'atlas-table-wrap' },
    h('table', { className: 'atlas-table' },
      h('thead', null, h('tr', null, rows[0].map((c, i) => h('th', { key: i }, c)))),
      h('tbody', null, rows.slice(1).map((r, i) => h('tr', { key: i }, r.map((c, j) => h('td', { key: j }, c)))))),
    rows.length > 400 ? h('p', { className: 'atlas-muted' }, 'Showing the first 400 rows.') : null);
}

function NotebookView({ text, path }) {
  const nb = useMemo(() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }, [text]);
  if (!nb || !Array.isArray(nb.cells)) return h(SourceView, { text });
  const src = (s) => (Array.isArray(s) ? s.join('') : String(s || ''));
  return h('div', { className: 'atlas-notebook' }, nb.cells.map((cell, i) => h('section', { key: i, className: cx('atlas-cell', 'is-' + cell.cell_type) },
    cell.cell_type === 'markdown'
      ? h(Markdown, { text: src(cell.source), baseFile: path })
      : h('pre', { className: 'atlas-cell-code' }, src(cell.source)),
    (cell.outputs || []).map((out, j) => {
      const d = out.data || {};
      if (d['image/png']) return h('img', { key: j, className: 'atlas-cell-img', alt: 'output', src: 'data:image/png;base64,' + src(d['image/png']).replace(/\s/g, '') });
      if (d['image/svg+xml']) return h('img', { key: j, className: 'atlas-cell-img', alt: 'output', src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src(d['image/svg+xml'])) });
      const textOut = out.text || d['text/plain'];
      return textOut ? h('pre', { key: j, className: 'atlas-cell-out' }, src(textOut)) : null;
    }))));
}

/** PDF pages drawn by PDF.js inside Atlas, rendered as they scroll into view. */
/** `src` reads the PDF from elsewhere (a paper through Atlas's web route); `path` still names it. */
function PdfView({ path, src, flash, anchor, anchorAt, marker, onPage, onPageClick }) {
  const [doc, setDoc] = useState(null);
  const onPageRef = useRef(onPage);
  onPageRef.current = onPage;
  const [aspect, setAspect] = useState(1.294);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(760);
  const box = useRef(null);
  const pane = usePaneName();
  useEffect(() => {
    let cancelled = false;
    let task = null;
    setDoc(null);
    setError(null);
    loadPdfjs()
      .then((lib) => {
        task = lib.getDocument({ url: src || rawUrl(path), withCredentials: true });
        return task.promise;
      })
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        // Placeholders take the first page's shape, so a jump to a page lands on it.
        d.getPage(1).then((page) => {
          const v = page.getViewport({ scale: 1 });
          if (!cancelled && v.width > 0) setAspect(v.height / v.width);
        }, () => {});
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
      if (task) task.destroy();
    };
  }, [path, src]);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setWidth(Math.min(980, Math.max(320, el.clientWidth - 8))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The page most in view is part of what you are looking at.
  useEffect(() => {
    const el = box.current;
    if (!el || !doc || typeof IntersectionObserver === 'undefined') return undefined;
    const ratios = new Map();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) ratios.set(Number(entry.target.dataset.page), entry.intersectionRatio);
      let best = 0;
      let page = 0;
      for (const [n, r] of ratios) {
        if (r > best) {
          best = r;
          page = n;
        }
      }
      if (page && onPageRef.current) onPageRef.current(page);
      const all = focusStore.get();
      const focus = all.byTab[pane];
      if (page && focus && focus.doc && focus.doc.path === path && focus.page !== String(page)) focusStore.set({ ...all, byTab: { ...all.byTab, [pane]: { ...focus, page: String(page) } } });
    }, { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] });
    el.querySelectorAll('.atlas-pdf-page').forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, [doc, path]);
  // SyncTeX's place for a source line: a highlight over its box, for a few seconds.
  useEffect(() => {
    if (!doc || !marker || !box.current) return undefined;
    let tries = 0;
    let timer = null;
    let mark = null;
    const place = () => {
      const el = box.current && box.current.querySelector(`.atlas-pdf-page[data-page="${marker.page}"]`);
      const scale = el ? Number(el.style.getPropertyValue('--total-scale-factor')) : 0;
      if (!el || !scale) {
        tries += 1;
        if (tries < 40) timer = setTimeout(place, 150);
        return;
      }
      const b = marker.box && marker.box.w > 0 ? marker.box : { x: Math.max(0, marker.x - 40), y: marker.y - 10, w: 80, h: 14 };
      mark = document.createElement('div');
      mark.className = 'atlas-sync-mark';
      Object.assign(mark.style, { left: `${b.x * scale}px`, top: `${b.y * scale}px`, width: `${Math.max(12, b.w * scale)}px`, height: `${Math.max(8, b.h * scale)}px` });
      el.appendChild(mark);
      timer = setTimeout(() => mark && mark.remove(), 3200);
    };
    timer = setTimeout(place, 150);
    return () => {
      clearTimeout(timer);
      if (mark) mark.remove();
    };
  }, [doc, marker && marker.at]);
  // Ctrl+click on a page asks SyncTeX for the source of that place (in PDF points from the top left).
  const onBoxClick = (e) => {
    if (!onPageClick || !(e.ctrlKey || e.metaKey)) return;
    const pageEl = e.target && e.target.closest ? e.target.closest('.atlas-pdf-page') : null;
    if (!pageEl) return;
    const scale = Number(pageEl.style.getPropertyValue('--total-scale-factor')) || 1;
    const r = pageEl.getBoundingClientRect();
    e.preventDefault();
    onPageClick(Number(pageEl.dataset.page), (e.clientX - r.left) / scale, (e.clientY - r.top) / scale);
  };
  // A link to a page (paper.pdf#page=13) opens the PDF there.
  useEffect(() => {
    const m = /^page=(\d+)/i.exec(String(anchor || ''));
    if (!doc || !m || !box.current) return undefined;
    const n = Math.min(doc.numPages, Math.max(1, Number(m[1])));
    const timer = setTimeout(() => {
      const el = box.current && box.current.querySelector(`.atlas-pdf-page[data-page="${n}"]`);
      if (el) revealElement(el);
    }, 80);
    return () => clearTimeout(timer);
  }, [doc, anchor, anchorAt, aspect]);
  if (error) {
    return h('div', { className: 'atlas-panel' }, h('p', null, 'This PDF could not be shown here: ', String(error.message || error)),
      src ? h(Button, { icon: 'external', onClick: () => window.open(path, '_blank', 'noopener') }, 'Open in the browser')
        : h(Button, { icon: 'external', onClick: () => openFile(path).catch((e) => flash(e.message)) }, 'Open with the system app'));
  }
  return h('div', { className: cx('atlas-pdf', onPageClick && 'is-synced'), ref: box, onClick: onBoxClick },
    h('div', { className: 'atlas-pdf-bar' },
      h('span', { className: 'atlas-muted' }, doc ? plural(doc.numPages, 'page') : 'Loading…'),
      h('span', { className: 'atlas-pdf-zoom' },
        h(Button, { small: true, quiet: true, onClick: () => setZoom(Math.max(0.5, zoom - 0.15)), title: 'Smaller' }, '−'),
        h('span', { className: 'atlas-muted' }, Math.round(zoom * 100) + '%'),
        h(Button, { small: true, quiet: true, onClick: () => setZoom(Math.min(2.5, zoom + 0.15)), title: 'Larger' }, '+'),
        h(Button, { small: true, quiet: true, onClick: () => setZoom(1), title: 'Fit the width' }, 'Fit'))),
    doc ? Array.from({ length: doc.numPages }, (_, i) => h(PdfPage, { key: i, doc, number: i + 1, width: width * zoom, aspect })) : h(Loading, { label: 'Opening the PDF…' }));
}

/** One page: drawn when near the view, with PDF.js's text layer over it so its text can be selected. */
function PdfPage({ doc, number, width, aspect = 1.294 }) {
  const holder = useRef(null);
  const canvas = useRef(null);
  const text = useRef(null);
  const [visible, setVisible] = useState(number <= 2);
  const [size, setSize] = useState(null);
  useEffect(() => {
    const el = holder.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible(true);
    }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    let render = null;
    let layer = null;
    Promise.all([doc.getPage(number), loadPdfjs()]).then(([page, lib]) => {
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / base.width });
      const ratio = window.devicePixelRatio || 1;
      const c = canvas.current;
      if (!c) return;
      c.width = Math.floor(viewport.width * ratio);
      c.height = Math.floor(viewport.height * ratio);
      c.style.width = `${Math.floor(viewport.width)}px`;
      c.style.height = `${Math.floor(viewport.height)}px`;
      setSize({ w: viewport.width, h: viewport.height, scale: viewport.scale });
      render = page.render({ canvas: c, canvasContext: c.getContext('2d'), viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
      const div = text.current;
      if (div && lib.TextLayer) {
        div.replaceChildren();
        div.parentElement.style.setProperty('--total-scale-factor', String(viewport.scale));
        layer = new lib.TextLayer({ textContentSource: page.streamTextContent(), container: div, viewport });
        layer.render().catch(() => {});
      }
      return render.promise;
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (render) render.cancel();
      if (layer) layer.cancel();
    };
  }, [visible, doc, number, width]);
  return h('div', { ref: holder, className: 'atlas-pdf-page', 'data-page': number, style: { width: size ? size.w : width, height: size ? size.h : width * aspect } },
    h('canvas', { ref: canvas, role: 'img', 'aria-label': `Page ${number}` }),
    h('div', { ref: text, className: 'textLayer atlas-pdf-text' }),
    h('span', { className: 'atlas-pdf-num' }, number));
}

/** For each library PDF open now, its paper map: what "Keep in note" adds to (each tab holds one). */
const readingStore = externalStore({ maps: {}, at: 0 });

/** The reading note of an open PDF: `{ pdf, map }` (map '' when the paper has none yet), or null. */
function readingOf(reading, pdf) {
  const map = reading && reading.maps ? reading.maps[pathKey(pdf)] : undefined;
  return map === undefined ? null : { pdf, map };
}

function setReading(pdf, map) {
  const maps = { ...readingStore.get().maps };
  if (map === null) delete maps[pathKey(pdf)];
  else maps[pathKey(pdf)] = map;
  readingStore.set({ maps, at: Date.now() });
}

/** A PDF, and beside it the reading note when the PDF is a paper of the library. */
function PdfLayout({ path, flash, go, navigate, anchor, anchorAt }) {
  const library = useApi('knowledge', null, 'knowledge');
  const paper = library.data ? library.data.papers.find((p) => p.pdf && samePath(p.pdf, path)) || null : null;
  return h('div', { className: cx('atlas-pdf-layout', paper && 'has-aside') },
    h(PdfView, { path, flash, anchor, anchorAt }),
    paper ? h(PaperAside, { key: paper.key, paper, path, go, flash, navigate, topics: library.data.byTopic }) : null);
}

/** The "## Your reading" section of a note (an "[Imported]"-style label is allowed). */
function readingSection(markdown) {
  const lines = String(markdown || '').split('\n');
  const start = lines.findIndex((l) => /^##\s+(\[[^\]]*\]\s*)?Your reading\s*$/i.test(l));
  if (start < 0) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,2}\s/.test(l));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n').trim();
}

/** A relative link from a note's folder to a file, the way notes write them. */
function relPath(fromDir, to) {
  const split = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').split('/');
  const a = split(fromDir);
  const b = split(to);
  let i = 0;
  while (i < a.length && i < b.length && a[i].toLowerCase() === b[i].toLowerCase()) i += 1;
  return [...a.slice(i).map(() => '..'), ...b.slice(i).map((s) => encodeURIComponent(s))].join('/');
}

function PaperAside({ paper, path, go, flash, navigate, topics }) {
  const actions = React.useContext(AtlasActions);
  const reading = React.useSyncExternalStore(readingStore.subscribe, readingStore.get);
  const [why, setWhy] = useState('');
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const version = (paper.versions || []).find((v) => String(path).replace(/\\/g, '/').includes(`/${v}/`)) || (paper.versions || [])[0] || '';
  const edition = version ? version.replace(/_/, '/') : paper.key;
  useEffect(() => {
    setReading(path, paper.map || '');
    return () => {
      if (readingOf(readingStore.get(), path)) setReading(path, null);
    };
  }, [path, paper.map]);
  const start = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const m = /^(.*?)(v\d+)?$/.exec(edition);
      const made = await api('paper-map', { method: 'POST', body: { id: paper.key, version: (m && m[2]) || '', why, topic } });
      setReading(path, made.file);
      flash(made.existed ? 'The paper map already exists.' : 'Started the paper map; passages you keep go into its “Your reading”.');
    } catch (error) {
      flash(error.message);
    } finally {
      setBusy(false);
    }
  };
  const discuss = () => actions.ask(focusContext({ doc: { type: 'pdf', title: paper.title || paper.key, path } }), 'ask', 'Read this paper with me: start from its paper map if it has one, tell me what it establishes and where it compresses, and wait for my questions.', 'Read ' + (paper.title ? shortTitle(paper.title, 40) : paper.key));
  const current = readingOf(reading, path);
  const map = current && current.map ? current.map : paper.map;
  const users = (paper.usedBy || []).filter((t) => t && t.file);
  return h('aside', { className: 'atlas-paper-aside', 'aria-label': 'Reading note' },
    h('h2', null, 'Reading note'),
    map ? h(PaperNote, { map, path, navigate, go, at: reading.at })
      : h('form', { className: 'atlas-paper-start', onSubmit: start },
        h('p', { className: 'atlas-muted' }, 'No paper map yet. Start one from the collection’s template; passages you keep from the PDF go into its “Your reading”.'),
        h('label', { className: 'atlas-field' }, h('span', null, "Why I'm reading it"), h('input', { className: 'atlas-input', value: why, onChange: (e) => setWhy(e.target.value) })),
        h('label', { className: 'atlas-field' }, h('span', null, 'For'), h('select', { className: 'atlas-input', value: topic, onChange: (e) => setTopic(e.target.value) }, h('option', { value: '' }, 'No topic'), (topics || []).map((t) => h('option', { key: t.file, value: t.file }, t.title)))),
        h('button', { type: 'submit', className: 'atlas-button is-small is-primary', disabled: busy }, busy ? 'Starting…' : 'Start a reading note')),
    h('div', { className: 'atlas-actions' },
      h(Button, { small: true, icon: 'spark', onClick: discuss }, 'Discuss this paper'),
      /^\d{4}\.\d{4,5}$|^[a-z-]+\/\d{7}$/.test(paper.key) ? h('a', { className: 'atlas-button is-small is-quiet', href: `https://arxiv.org/abs/${edition}`, target: '_blank', rel: 'noreferrer' }, h(Icon, { name: 'external', size: 14 }), h('span', null, 'arXiv')) : null),
    users.length ? h('div', { className: 'atlas-paper-users' }, h('h2', null, 'Cited in'), users.map((t) => h(TextButton, { key: t.file, onClick: () => go({ view: 'doc', path: t.file }) }, shortTitle(t.title, 48)))) : null,
    h('p', { className: 'atlas-muted atlas-paper-tip' }, 'Select text in the PDF to ask about it or keep it in the note. A link such as paper.pdf#page=13 opens here at that page.'));
}

function PaperNote({ map, navigate, go, at }) {
  const { data, error, loading } = useApi('note', { path: map, fresh: 1 }, map, at);
  if (loading && !data) return h('p', { className: 'atlas-muted' }, 'Reading the note…');
  if (error) return h('p', { className: 'atlas-muted' }, error.message);
  const yours = readingSection(data.body);
  return h('div', { className: 'atlas-paper-note' },
    h(TextButton, { className: 'atlas-paper-note-title', onClick: () => go({ view: 'doc', path: map }) }, data.title || baseName(map)),
    yours ? h('div', { className: 'atlas-paper-yours' }, h(Markdown, { text: yours, baseFile: map, onNavigate: navigate, compact: true }))
      : h('p', { className: 'atlas-muted' }, 'Nothing under “Your reading” yet.'));
}

function FolderView({ path, go, navigate, onInfo }) {
  const { data, error, loading } = useApi('dir', { path }, path);
  useEffect(() => {
    if (data && onInfo) onInfo({ owner: data.owner, shown: data.shown });
  }, [data]);
  if (loading && !data) return h(Loading, { label: 'Listing the folder…' });
  if (error) return h(ErrorNote, { error });
  const readme = data.entries.find((e) => /^readme\.md$/i.test(e.name));
  const folders = data.entries.filter((e) => e.folder);
  const files = data.entries.filter((e) => !e.folder);
  const row = (e) => h('li', { key: e.path }, h('button', { type: 'button', className: 'atlas-item', onClick: () => navigate({ path: e.path }) },
    h(Icon, { name: TYPE_ICON[e.type] || (e.folder ? 'folder' : 'note'), size: 15 }),
    h('span', { className: 'atlas-item-text' }, h('span', { className: 'atlas-item-label' }, e.name), h('span', { className: 'atlas-item-sub' }, e.folder ? 'folder' : `${TYPE_LABEL[e.type] || 'File'} · ${sizeOf(e.size)}`)),
    h('span', { className: 'atlas-date' }, dateOf(e.mtimeMs))));
  return h('div', { className: 'atlas-folder' },
    data.topic ? h('p', null, h(Button, { icon: 'topics', onClick: () => go({ view: 'doc', path: data.topic.file }) }, 'Open the topic: ' + shortTitle(data.topic.title, 50))) : null,
    readme ? h(Readme, { path: readme.path }) : null,
    folders.length ? h('section', { className: 'atlas-side-block' }, h('h2', null, h(Icon, { name: 'folder' }), 'Folders', h('span', { className: 'atlas-count' }, folders.length)), h('ul', { className: 'atlas-items' }, folders.map(row))) : null,
    files.length ? h('section', { className: 'atlas-side-block' }, h('h2', null, h(Icon, { name: 'note' }), 'Files', h('span', { className: 'atlas-count' }, files.length)), h('ul', { className: 'atlas-items' }, files.map(row))) : null,
    data.entries.length === 0 ? h(Empty, null, 'This folder is empty.') : null);
}

function Readme({ path }) {
  const { data } = useApi('note', { path }, path);
  if (!data) return null;
  return h('section', { className: 'atlas-readme' }, h(Markdown, { text: data.body, baseFile: path, compact: true }));
}

/** The editor: source on the left, the rendered note on the right; saves only what has not changed on disk meanwhile. */
function Editor({ data, go, flash, created, onSaved }) {
  const original = data.raw !== undefined ? data.raw : data.body;
  const [text, setText] = useState(original);
  const [base, setBase] = useState({ text: original, mtimeMs: data.mtimeMs });
  const [status, setStatus] = useState({ kind: 'clean' });
  const [preview, setPreview] = useState(() => storageGet('editor-preview', true));
  const [shown, setShown] = useState(original);
  const area = useRef(null);
  const pane = usePaneName();
  const dirty = text !== base.text;
  const isMarkdown = data.type === 'markdown';
  useEffect(() => {
    editorDirty[pane] = dirty;
    const warn = (e) => {
      if (Object.values(editorDirty).some(Boolean)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => () => {
    editorDirty[pane] = false;
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setShown(text), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const save = async (overwrite) => {
    setStatus({ kind: 'saving' });
    try {
      const res = await api('save', { method: 'POST', body: { path: data.path, text, mtimeMs: base.mtimeMs, overwrite: Boolean(overwrite) } });
      setBase({ text, mtimeMs: res.mtimeMs });
      setStatus({ kind: 'saved', at: Date.now() });
      editorDirty[pane] = false;
      if (onSaved) onSaved();
    } catch (error) {
      if (error.status === 409 && error.body && error.body.conflict) setStatus({ kind: 'conflict' });
      else setStatus({ kind: 'error', message: error.message });
    }
  };
  const reload = async () => {
    const fresh = await api('note', { query: { path: data.path, fresh: 1 } });
    const value = fresh.raw !== undefined ? fresh.raw : fresh.body;
    setText(value);
    setBase({ text: value, mtimeMs: fresh.mtimeMs });
    setStatus({ kind: 'clean' });
  };
  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (dirty) save(false);
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const el = e.target;
      const start = el.selectionStart;
      const next = text.slice(0, start) + '  ' + text.slice(el.selectionEnd);
      setText(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  };
  const statusText = status.kind === 'saving' ? 'Saving…'
    : status.kind === 'saved' && !dirty ? `Saved ${new Date(status.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : status.kind === 'error' ? status.message
        : dirty ? 'Unsaved changes' : 'No changes';
  const relLink = baseName(data.path);
  const done = () => go({ view: 'doc', path: data.path });
  return h('div', { className: 'atlas-editor' },
    created ? h('div', { className: 'atlas-banner' },
      h(Icon, { name: 'spark' }),
      h('span', null, 'New file. Link it from its topic’s research.md so the topic reaches it:'),
      h('code', null, `[${data.title || relLink}](${relLink})`),
      h(TextButton, { onClick: () => navigator.clipboard && navigator.clipboard.writeText(`[${data.title || relLink}](${relLink})`).then(() => flash('Link copied; paste it where the note is used.')) }, 'Copy link')) : null,
    status.kind === 'conflict' ? h('div', { className: 'atlas-banner is-warn', role: 'alert' },
      h('span', null, 'This file changed on disk since you opened it (perhaps an AI session edited it).'),
      h(TextButton, { onClick: reload }, 'Load the disk version'),
      h(TextButton, { onClick: () => save(true) }, 'Keep mine and overwrite')) : null,
    h('div', { className: 'atlas-editor-bar' },
      h(Button, { primary: true, icon: 'save', disabled: !dirty || status.kind === 'saving', onClick: () => save(false), title: 'Save (Ctrl+S)' }, 'Save'),
      h(Button, { quiet: true, disabled: !dirty, onClick: () => setText(base.text) }, 'Revert'),
      isMarkdown ? h(Button, { quiet: true, onClick: () => { setPreview(!preview); storageSet('editor-preview', !preview); } }, preview ? 'Hide preview' : 'Show preview') : null,
      h('span', { className: cx('atlas-editor-status', dirty && 'is-dirty', status.kind === 'error' && 'is-error') }, statusText),
      h(Button, { quiet: true, onClick: () => { if (!dirty || window.confirm('Discard your unsaved changes?')) { editorDirty[pane] = false; done(); } } }, 'Done')),
    h('div', { className: cx('atlas-editor-split', isMarkdown && preview && 'has-preview') },
      h('textarea', { ref: area, className: 'atlas-editor-text', value: text, spellCheck: false, onChange: (e) => setText(e.target.value), onKeyDown, 'aria-label': 'Source of ' + baseName(data.path) }),
      isMarkdown && preview ? h('div', { className: 'atlas-editor-preview atlas-reading' }, h(Markdown, { text: shown.replace(/^---\n[\s\S]*?\n---\n/, ''), baseFile: data.path })) : null,
      !isMarkdown && data.type === 'tex' ? h(TexAside, { text: shown, path: data.path, go }) : null));
}

/** Beside LaTeX source: its outline, and the compiled PDF when one sits next to it. */
function TexAside({ text, path, go }) {
  const outline = useMemo(() => {
    const out = [];
    const re = /\\(part|chapter|section|subsection|subsubsection)\*?\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(text)) && out.length < 80) out.push({ level: m[1], title: m[2] });
    return out;
  }, [text]);
  const folder = useApi('dir', { path: dirOf(path) }, dirOf(path));
  const own = baseName(path).replace(/\.tex$/i, '.pdf').toLowerCase();
  const pdfs = folder.data ? folder.data.entries.filter((e) => e.type === 'pdf').sort((a, b) => (a.name.toLowerCase() === own ? -1 : b.name.toLowerCase() === own ? 1 : a.name === 'main.pdf' ? -1 : b.name === 'main.pdf' ? 1 : 0)) : [];
  return h('aside', { className: 'atlas-tex-aside' },
    h('h2', null, 'Outline'),
    outline.length ? h('ol', { className: 'atlas-outline' }, outline.map((o, i) => h('li', { key: i, className: 'is-' + o.level }, o.title))) : h(Empty, null, 'No sections in this file.'),
    h('h2', null, 'Compiled'),
    pdfs.length
      ? pdfs.slice(0, 6).map((p) => h(Button, { key: p.path, small: true, icon: 'paper', onClick: () => go({ view: 'doc', path: p.path }) }, `${p.name} · ${dateOf(p.mtimeMs)}`))
      : h(Empty, null, folder.data ? 'No PDF in this folder yet.' : 'Looking…'));
}
