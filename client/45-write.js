// ------------------------------------------------------------------ write ---
// A manuscript and its PDF side by side: the LaTeX source with line numbers,
// Build (Ctrl+B) with the TeX installations this computer has, the compiled PDF
// in its own Preview tab in the other pane, the log's problems by line, SyncTeX
// both ways (Ctrl+click), and citations from the document's .bib and the papers
// library. Saving keeps the editor's rule: never over a file that changed on
// disk meanwhile.

function lineOfOffset(text, offset) {
  return String(text).slice(0, offset).split('\n').length;
}

function offsetOfLine(text, line) {
  let pos = 0;
  for (let i = 1; i < line; i += 1) {
    const next = text.indexOf('\n', pos);
    if (next < 0) return text.length;
    pos = next + 1;
  }
  return pos;
}

/** The key being typed inside \cite{…} just before the caret: where it starts and what it is so far. */
function citeContext(text, caret) {
  const before = String(text).slice(Math.max(0, caret - 400), caret);
  const m = /\\(?:no)?cite[a-zA-Z]*\*?(?:\[[^\]]*\]){0,2}\{([^{}]*)$/.exec(before);
  if (!m) return null;
  const tail = m[1].slice(m[1].lastIndexOf(',') + 1);
  const lead = tail.length - tail.trimStart().length;
  return { partial: tail.trim(), start: caret - tail.length + lead };
}

/** Text and caret after citing `key`: completes a \cite{… being typed, or inserts \cite{key}. */
function insertCite(text, caret, key) {
  const ctx = citeContext(text, caret);
  if (ctx) return { text: text.slice(0, ctx.start) + key + text.slice(caret), caret: ctx.start + key.length };
  const ins = `\\cite{${key}}`;
  return { text: text.slice(0, caret) + ins + text.slice(caret), caret: caret + ins.length };
}

/** Sections of LaTeX source with their lines. */
function texOutline(text) {
  const out = [];
  const lines = String(text).split('\n');
  for (let i = 0; i < lines.length && out.length < 200; i += 1) {
    const m = /^[^%]*\\(part|chapter|section|subsection|subsubsection)\*?\{([^}]*)\}/.exec(lines[i]);
    if (m) out.push({ level: m[1], title: m[2], line: i + 1 });
  }
  return out;
}

/** Each LaTeX document's compiled PDF, for its Preview tab, by the document's key: { main, pdf, builtAt, mark, sync, topic }. */
const texPreviewStore = externalStore({});
/** What a Preview tab asks of the source open in the editor (Ctrl+click → the source line), by the document's key. */
const previewHandlers = new Map();

/** The helper panels beside the source; the compiled PDF has its own tab (Preview). */
const WRITE_PANELS = [['outline', 'Outline'], ['problems', 'Problems'], ['cite', 'Cite']];

function TexWorkspace({ data, go, flash, onSaved, anchor, anchorAt }) {
  const pane = usePaneName();
  const actions = React.useContext(AtlasActions);
  // The source, and a helper panel beside it when one is open; their share is the researcher's, remembered.
  const [split, setSplit] = useState(() => storageGet('write-aux-split', 64));
  const [panel, setPanel] = useState(() => storageGet('write-panel', ''));
  const splitBox = useRef(null);
  const saveSplit = (value) => {
    setSplit(value);
    storageSet('write-aux-split', value);
  };
  const showPanel = (key) => {
    setPanel(key);
    storageSet('write-panel', key);
  };
  const startSplit = (event) => {
    event.preventDefault();
    const box = splitBox.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const at = (x) => Math.round(Math.min(80, Math.max(30, ((x - rect.left) / rect.width) * 100)));
    const move = (e) => setSplit(at(e.clientX));
    const up = (e) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      saveSplit(at(e.clientX));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const original = data.raw !== undefined ? data.raw : data.body;
  const [text, setText] = useState(original);
  const [base, setBase] = useState({ text: original, mtimeMs: data.mtimeMs });
  const [status, setStatus] = useState({ kind: 'clean' });
  const [engines, setEngines] = useState({ list: null, main: '' });
  const [engine, setEngine] = useState(() => storageGet('tex-engine:' + data.path, ''));
  const [built, setBuilt] = useState(null);
  const [building, setBuilding] = useState(false);
  const [mark, setMark] = useState(null);
  const [pdfExists, setPdfExists] = useState(false);
  const area = useRef(null);
  const gutter = useRef(null);
  const caret = useRef(0);
  const textRef = useRef(text);
  textRef.current = text;
  const dirty = text !== base.text;

  useEffect(() => {
    editorDirty[pane] = dirty;
  }, [dirty]);
  useEffect(() => () => {
    editorDirty[pane] = false;
  }, []);
  useEffect(() => {
    let live = true;
    api('latex/engines', { query: { path: data.path } }).then((r) => {
      if (!live) return;
      setEngines({ list: r.engines, main: r.main || '' });
      if (r.main) api('dir', { query: { path: dirOf(r.main) } }).then((d) => live && setPdfExists(d.entries.some((e) => samePath(e.path, r.main.replace(/\.tex$/i, '.pdf')))), () => {});
    }, (e) => live && setEngines({ list: [], main: '', error: e.message }));
    return () => {
      live = false;
    };
  }, [data.path]);

  const chosen = engines.list ? engines.list.find((e) => e.id === engine) || engines.list[0] || null : null;
  const main = engines.main || '';
  const pdf = (built && built.pdf) || (main && pdfExists ? main.replace(/\.tex$/i, '.pdf') : '');
  const docKey = main ? pathKey(main) : '';

  const goToLine = useCallback((n) => {
    const el = area.current;
    if (!el) return;
    const value = textRef.current;
    const start = offsetOfLine(value, n);
    const endNext = value.indexOf('\n', start);
    el.focus();
    el.setSelectionRange(start, endNext < 0 ? value.length : endNext);
    caret.current = start;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.scrollTop = Math.max(0, (n - 6) * lineHeight);
    if (gutter.current) gutter.current.scrollTop = el.scrollTop;
  }, []);

  // A link to a line (from SyncTeX or a problem in another file) opens there.
  useEffect(() => {
    const m = /^L(\d+)$/i.exec(String(anchor || ''));
    if (!m) return undefined;
    const timer = setTimeout(() => goToLine(Number(m[1])), 80);
    return () => clearTimeout(timer);
  }, [anchor, anchorAt, goToLine]);

  const save = async (overwrite) => {
    setStatus({ kind: 'saving' });
    try {
      const res = await api('save', { method: 'POST', body: { path: data.path, text: textRef.current, mtimeMs: base.mtimeMs, overwrite: Boolean(overwrite) } });
      setBase({ text: textRef.current, mtimeMs: res.mtimeMs });
      setStatus({ kind: 'saved', at: Date.now() });
      editorDirty[pane] = false;
      return true;
    } catch (error) {
      if (error.status === 409 && error.body && error.body.conflict) setStatus({ kind: 'conflict' });
      else setStatus({ kind: 'error', message: error.message });
      return false;
    }
  };
  const reload = async () => {
    const fresh = await api('note', { query: { path: data.path, fresh: 1 } });
    const value = fresh.raw !== undefined ? fresh.raw : fresh.body;
    setText(value);
    setBase({ text: value, mtimeMs: fresh.mtimeMs });
    setStatus({ kind: 'clean' });
  };
  const preview = (file, activate) => {
    if (main && file) actions.openPreview({ main, pdf: file, from: pane, activate });
  };
  const runBuild = async () => {
    if (building || !chosen) return;
    if (textRef.current !== base.text && !(await save(false))) return;
    setBuilding(true);
    try {
      const r = await api('latex/build', { method: 'POST', body: { path: data.path, engine: chosen.id } });
      setBuilt(r);
      setMark(null);
      if (r.pdf) setPdfExists(true);
      const errors = r.problems.filter((p) => p.severity === 'error').length;
      if (errors) showPanel('problems');
      preview(r.pdf, !errors);
      flash(errors ? `Built with ${plural(errors, 'error')}: see Problems.` : `Built: ${plural(r.pages, 'page')} in ${(r.durationMs / 1000).toFixed(1)} s.`);
    } catch (error) {
      flash(error.message);
    } finally {
      setBuilding(false);
    }
  };
  const chooseEngine = (id) => {
    setEngine(id);
    storageSet('tex-engine:' + data.path, id);
  };
  const syncToPdf = async () => {
    if (!chosen || !chosen.sync) return flash('SyncTeX needs the synctex program: choose a TeX Live in WSL.');
    if (!pdf) return flash('Build the document first.');
    try {
      const r = await api('latex/sync/view', { query: { path: data.path, line: lineOfOffset(textRef.current, caret.current), engine: chosen.id } });
      preview(pdf, true);
      setMark({ ...r, at: Date.now() });
    } catch (error) {
      flash(error.message);
    }
  };
  const syncToSource = async (page, x, y) => {
    if (!chosen || !chosen.sync) return flash('SyncTeX needs the synctex program: choose a TeX Live in WSL.');
    try {
      const r = await api('latex/sync/edit', { query: { pdf, page, x: x.toFixed(2), y: y.toFixed(2), engine: chosen.id } });
      if (samePath(r.file, data.path)) goToLine(r.line);
      else go({ view: 'doc', path: r.file, edit: true, anchor: 'L' + r.line, stay: true });
    } catch (error) {
      flash(error.message);
    }
  };

  // The Preview tab reads the PDF from here and asks this editor for the source of a place in it.
  const syncRef = useRef(syncToSource);
  syncRef.current = syncToSource;
  useEffect(() => {
    if (!docKey) return undefined;
    const handler = { syncToSource: (page, x, y) => syncRef.current(page, x, y) };
    previewHandlers.set(docKey, handler);
    const editing = (value) => {
      const all = texPreviewStore.get();
      texPreviewStore.set({ ...all, [docKey]: { ...(all[docKey] || {}), editing: value } });
    };
    editing(true);
    return () => {
      if (previewHandlers.get(docKey) !== handler) return;
      previewHandlers.delete(docKey);
      editing(false);
    };
  }, [docKey]);
  const builtAt = built ? built.at : 0;
  const sync = Boolean(chosen && chosen.sync);
  const owner = data.owner || null;
  useEffect(() => {
    if (!docKey) return;
    const all = texPreviewStore.get();
    const topic = owner ? { id: owner.id, title: owner.title, path: owner.file } : null;
    texPreviewStore.set({ ...all, [docKey]: { ...(all[docKey] || {}), main, pdf: pdf || (all[docKey] && all[docKey].pdf) || '', builtAt: builtAt || (all[docKey] && all[docKey].builtAt) || 0, mark, sync, topic, source: data.path } });
  }, [docKey, pdf, builtAt, mark, sync, owner ? owner.file : '']);
  // A document that has a PDF shows it beside the source as soon as it opens.
  const shownOnce = useRef(false);
  useEffect(() => {
    if (!main || !pdf || shownOnce.current) return;
    shownOnce.current = true;
    preview(pdf, true);
  }, [main, pdf]);

  const insertKey = (key) => {
    const next = insertCite(textRef.current, caret.current, key);
    setText(next.text);
    caret.current = next.caret;
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
    });
  };
  const onKeyDown = (e) => {
    const key = String(e.key).toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 's') {
      e.preventDefault();
      if (dirty) save(false);
    } else if ((e.ctrlKey || e.metaKey) && key === 'b') {
      e.preventDefault();
      runBuild();
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const el = e.target;
      const start = el.selectionStart;
      setText(text.slice(0, start) + '  ' + text.slice(el.selectionEnd));
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  };
  const track = (e) => {
    caret.current = e.target.selectionStart;
  };
  const lines = useMemo(() => text.split('\n').length, [text]);
  const numbers = useMemo(() => Array.from({ length: lines }, (_, i) => i + 1).join('\n'), [lines]);
  const problems = built ? built.problems : [];
  const errors = problems.filter((p) => p.severity === 'error').length;
  const statusText = status.kind === 'saving' ? 'Saving…'
    : status.kind === 'error' ? status.message
      : dirty ? 'Unsaved changes'
        : status.kind === 'saved' ? `Saved ${new Date(status.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';
  const builtText = building ? 'Building…'
    : built ? `Built ${new Date(built.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${plural(built.pages, 'page')}${errors ? ` · ${plural(errors, 'error')}` : ''}` : '';
  const open = WRITE_PANELS.some(([key]) => key === panel) ? panel : '';
  return h('div', { className: 'atlas-write' },
    status.kind === 'conflict' ? h('div', { className: 'atlas-banner is-warn', role: 'alert' },
      h('span', null, 'This file changed on disk since you opened it (perhaps an AI session edited it).'),
      h(TextButton, { onClick: reload }, 'Load the disk version'),
      h(TextButton, { onClick: () => save(true) }, 'Keep mine and overwrite')) : null,
    h('div', { className: 'atlas-write-bar' },
      h(Button, { primary: true, icon: 'save', disabled: !dirty || status.kind === 'saving', onClick: () => save(false), title: 'Save (Ctrl+S)' }, 'Save'),
      h(Button, { disabled: building || !chosen, onClick: runBuild, title: 'Save and build (Ctrl+B)' }, building ? 'Building…' : 'Build'),
      h(Button, { icon: 'paper', disabled: !pdf, onClick: () => preview(pdf, true), title: pdf ? 'Show the compiled PDF in its Preview tab, beside the source' : 'No PDF yet: press Build (Ctrl+B)' }, 'Preview'),
      engines.list && engines.list.length
        ? h('select', { className: 'atlas-input atlas-write-engine', value: chosen ? chosen.id : '', onChange: (e) => chooseEngine(e.target.value), 'aria-label': 'TeX engine' },
          engines.list.map((e) => h('option', { key: e.id, value: e.id }, e.label + (e.sync ? '' : ' · no SyncTeX'))))
        : h('span', { className: 'atlas-muted' }, engines.list ? engines.error || 'No TeX installation found' : 'Looking for TeX…'),
      h('div', { className: 'atlas-seg atlas-write-panels', role: 'group', 'aria-label': 'Beside the source' }, WRITE_PANELS.map(([key, label]) => h('button', {
        key,
        type: 'button',
        'aria-pressed': open === key,
        className: cx('atlas-seg-item', open === key && 'is-on', key === 'problems' && errors && 'is-alert'),
        title: open === key ? 'Hide it' : `Show ${label.toLowerCase()} beside the source`,
        onClick: () => showPanel(open === key ? '' : key),
      }, key === 'problems' && problems.length ? `${label} (${problems.length})` : label))),
      h('span', { className: cx('atlas-editor-status', dirty && 'is-dirty', status.kind === 'error' && 'is-error') }, [statusText, builtText].filter(Boolean).join(' · ')),
      h(Button, { quiet: true, disabled: !dirty, onClick: () => setText(base.text) }, 'Revert'),
      h(Button, { quiet: true, onClick: () => { if (!dirty || window.confirm('Discard your unsaved changes?')) { editorDirty[pane] = false; go({ view: 'doc', path: data.path }); } } }, 'Done')),
    main && !samePath(main, data.path) ? h('p', { className: 'atlas-muted atlas-write-main' }, 'Part of ', h(TextButton, { onClick: () => go({ view: 'doc', path: main, edit: true, stay: true }) }, baseName(main)), ': Build builds that document.') : null,
    h('div', { className: cx('atlas-write-split', !open && 'is-solo'), ref: splitBox, style: { '--write-split': split + '%' } },
      h('div', { className: 'atlas-write-source' },
        h('pre', { className: 'atlas-write-gutter', ref: gutter, 'aria-hidden': true }, numbers),
        h('textarea', {
          ref: area,
          className: 'atlas-write-text atlas-editor-text',
          value: text,
          wrap: 'off',
          spellCheck: false,
          onChange: (e) => {
            setText(e.target.value);
            caret.current = e.target.selectionStart;
          },
          onKeyDown,
          onKeyUp: track,
          onSelect: track,
          onMouseUp: (e) => {
            track(e);
            if (e.ctrlKey || e.metaKey) syncToPdf();
          },
          onScroll: (e) => {
            if (gutter.current) gutter.current.scrollTop = e.target.scrollTop;
          },
          'aria-label': 'Source of ' + baseName(data.path),
          title: sync ? 'Ctrl+click a line to find it in the Preview' : 'Source',
        })),
      open ? h('div', { className: 'atlas-write-divider', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Resize the source and the panel beside it', title: 'Drag to resize; double-click to reset', onPointerDown: startSplit, onDoubleClick: () => saveSplit(64) }) : null,
      open ? h('div', { className: 'atlas-write-side' },
        h('div', { className: 'atlas-write-side-head' },
          h('span', null, (WRITE_PANELS.find(([key]) => key === open) || [])[1]),
          h('button', { type: 'button', className: 'atlas-icon-button', title: 'Hide the panel', 'aria-label': 'Hide the panel', onClick: () => showPanel('') }, h(Icon, { name: 'close', size: 13 }))),
        h('div', { className: 'atlas-write-pane' },
          open === 'problems' ? h(ProblemList, { built, current: data.path, goToLine, go }) : null,
          open === 'cite' ? h(CitePanel, { path: data.path, text, caret, onInsert: insertKey, flash }) : null,
          open === 'outline' ? h(TexOutline, { text, goToLine }) : null)) : null),
    pdf && chosen ? h('p', { className: 'atlas-write-hint' }, chosen.sync ? 'The PDF is in the Preview tab: Ctrl+click in it to jump to the source line, Ctrl+click a source line to find it there.' : 'This engine has no synctex program: choose TeX Live in WSL to jump between the source and the Preview.') : null);
}

/**
 * A LaTeX document's compiled PDF in its own tab, beside the source: it reloads after each build,
 * shows where a Ctrl+clicked source line landed, and Ctrl+click in it jumps to the source.
 */
function TexPreview({ tab, flash, go }) {
  const all = React.useSyncExternalStore(texPreviewStore.subscribe, texPreviewStore.get);
  const key = pathKey(tab.main);
  const entry = all[key] || {};
  const pdf = entry.pdf || tab.pdf || '';
  const lastPage = useRef(0);
  usePublishFocus({ kind: 'doc', topic: entry.topic || null, doc: { type: 'pdf', title: 'Preview of ' + baseName(tab.main), path: pdf || tab.main } }, [pdf, tab.main, entry.topic ? entry.topic.path : '']);
  const toSource = (page, x, y) => {
    const handler = previewHandlers.get(key);
    if (handler) handler.syncToSource(page, x, y);
    else flash('Open the source in the editor to jump from the Preview to it.');
  };
  const mark = entry.mark || null;
  const builtAt = entry.builtAt || 0;
  return h('div', { className: 'atlas-preview' },
    h('header', { className: 'atlas-preview-head' },
      h('span', { className: 'atlas-preview-label' }, h(Icon, { name: 'paper', size: 14 }), 'Preview'),
      h('span', { className: 'atlas-preview-of', title: tab.main }, 'of ', h(TextButton, { onClick: () => go({ view: 'doc', path: entry.source || tab.main, edit: true, full: true }), title: 'Edit the source' }, baseName(entry.source || tab.main))),
      builtAt ? h('span', { className: 'atlas-date' }, 'built ' + new Date(builtAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : null,
      h('span', { className: 'atlas-spacer' }),
      entry.sync && entry.editing ? h('span', { className: 'atlas-hint' }, h('kbd', null, 'Ctrl'), '+click jumps to the source') : null),
    pdf
      ? h(PdfView, {
        key: pdf + ':' + builtAt,
        path: pdf,
        flash,
        anchor: mark ? 'page=' + mark.page : lastPage.current ? 'page=' + lastPage.current : '',
        anchorAt: mark ? mark.at : builtAt,
        marker: mark,
        onPage: (n) => {
          lastPage.current = n;
        },
        onPageClick: toSource,
      })
      : h(Empty, null, 'No PDF yet: build the document (Ctrl+B in the editor).'));
}

function ProblemList({ built, current, goToLine, go }) {
  if (!built) return h(Empty, null, 'Build the document to see what its log reports.');
  if (built.problems.length === 0) return h(Empty, null, `No problems: ${plural(built.pages, 'page')}, built with ${built.label}.`);
  const open = (p) => {
    if (!p.file || samePath(p.file, current)) goToLine(p.line || 1);
    else go({ view: 'doc', path: p.file, edit: true, anchor: 'L' + (p.line || 1), stay: true });
  };
  return h('ul', { className: 'atlas-problems' }, built.problems.map((p, i) => h('li', { key: i, className: 'is-' + p.severity },
    h('span', { className: 'atlas-problem-kind' }, p.severity),
    h('span', { className: 'atlas-problem-text' }, p.message),
    p.line ? h(TextButton, { onClick: () => open(p), title: p.file || '' }, `${p.file ? baseName(p.file) : 'line'}:${p.line}`) : null)));
}

function TexOutline({ text, goToLine }) {
  const outline = useMemo(() => texOutline(text), [text]);
  if (outline.length === 0) return h(Empty, null, 'No sections in this file.');
  return h('ol', { className: 'atlas-outline atlas-write-outline' }, outline.map((o, i) => h('li', { key: i, className: 'is-' + o.level },
    h(TextButton, { onClick: () => goToLine(o.line) }, o.title), h('span', { className: 'atlas-date' }, o.line))));
}

/** Cite from the document's .bib, from the papers library (its entry is added), or from an arXiv search. */
function CitePanel({ path, text, caret, onInsert, flash }) {
  const [version, setVersion] = useState(0);
  const { data, error, loading } = useApi('latex/cite-index', { path }, path, version);
  const [q, setQ] = useState(() => {
    const ctx = citeContext(text, caret.current);
    return ctx ? ctx.partial : '';
  });
  const [busy, setBusy] = useState('');
  const [web, setWeb] = useState(null);
  const words = useWords(q);
  if (loading && !data) return h('p', { className: 'atlas-muted' }, 'Reading the bibliography…');
  if (error) return h('p', { className: 'atlas-muted' }, error.message);
  const bib = data.bibs[0] ? data.bibs[0].file : '';
  const inBib = new Set(data.entries.map((e) => (e.eprint || '').replace(/v\d+$/, '')).filter(Boolean));
  const entries = data.entries.filter((e) => matches(words, e.key, e.title, e.author, e.year)).slice(0, 40);
  const library = data.library.filter((p) => !inBib.has(p.arxiv) && matches(words, p.arxiv, p.title, (p.authors || []).join(' '), p.year)).slice(0, 40);
  const citeArxiv = async (id, meta) => {
    if (!bib) return flash('This document names no .bib file: add \\bibliography{refs} first.');
    setBusy(id);
    try {
      const r = await api('latex/cite', { method: 'POST', body: { bib, arxiv: id, meta } });
      onInsert(r.key);
      flash(r.added ? `Added ${r.key} to ${baseName(bib)} and cited it.` : `Cited ${r.key}.`);
      setVersion(Date.now());
    } catch (e) {
      flash(e.message);
    } finally {
      setBusy('');
    }
  };
  const searchWeb = async (event) => {
    if (event) event.preventDefault();
    if (!q.trim()) return;
    setWeb({ loading: true, entries: [] });
    try {
      const r = await api('web/search', { query: { q: q.trim(), max: 6 } });
      setWeb({ loading: false, entries: r.entries });
    } catch (e) {
      setWeb({ loading: false, entries: [], error: e.message });
    }
  };
  const first = entries[0] ? () => onInsert(entries[0].key) : library[0] ? () => citeArxiv(library[0].arxiv, library[0]) : null;
  return h('div', { className: 'atlas-cite' },
    h('form', { className: 'atlas-inline-form', onSubmit: (e) => { e.preventDefault(); if (first) first(); } },
      h('input', { className: 'atlas-input', autoFocus: true, value: q, onChange: (e) => setQ(e.target.value), placeholder: 'Author, title, key or arXiv ID', 'aria-label': 'Find a reference' }),
      data.online ? h(Button, { small: true, quiet: true, onClick: searchWeb }, 'Search arXiv') : null),
    h('p', { className: 'atlas-muted atlas-cite-note' }, bib ? `Enter cites the first match. A paper not yet in ${baseName(bib)} gets its entry added (from INSPIRE when it answers).` : 'This document names no .bib file; add \\bibliography{refs} to cite from your library.'),
    entries.length ? h('h3', null, `In ${data.bibs.map((b) => baseName(b.file)).join(', ')}`) : null,
    h('ul', { className: 'atlas-cite-list' }, entries.map((e) => h('li', { key: e.key },
      h('button', { type: 'button', className: 'atlas-cite-item', onClick: () => onInsert(e.key) },
        h('span', { className: 'atlas-cite-title' }, texText(e.title) || e.key),
        h('span', { className: 'atlas-cite-meta' }, [e.author.split(' and ')[0], e.year, e.journal].filter(Boolean).join(' · ')),
        h('code', null, e.key))))),
    library.length ? h('h3', null, 'In your library, not yet cited') : null,
    h('ul', { className: 'atlas-cite-list' }, library.map((p) => h('li', { key: p.arxiv },
      h('button', { type: 'button', className: 'atlas-cite-item', disabled: busy === p.arxiv || !bib, onClick: () => citeArxiv(p.arxiv, p) },
        h('span', { className: 'atlas-cite-title' }, texText(p.title) || p.arxiv),
        h('span', { className: 'atlas-cite-meta' }, [shortAuthors(p.authors), p.year, `arXiv:${p.arxiv}`].filter(Boolean).join(' · ')),
        h('span', { className: 'atlas-chip' }, busy === p.arxiv ? 'adding…' : 'adds the entry'))))),
    web ? h('div', { className: 'atlas-cite-web' },
      h('h3', null, 'From arXiv'),
      web.loading ? h('p', { className: 'atlas-muted' }, 'Asking arXiv…') : null,
      web.error ? h('p', { className: 'atlas-muted' }, web.error) : null,
      h('ul', { className: 'atlas-cite-list' }, web.entries.map((e) => h('li', { key: e.id },
        h('button', { type: 'button', className: 'atlas-cite-item', disabled: busy === e.id || !bib, onClick: () => citeArxiv(e.id, e) },
          h('span', { className: 'atlas-cite-title' }, texText(e.title)),
          h('span', { className: 'atlas-cite-meta' }, [shortAuthors(e.authors), e.year, `arXiv:${e.id}`].filter(Boolean).join(' · ')),
          h('span', { className: 'atlas-chip' }, busy === e.id ? 'adding…' : 'cite')))))) : null,
    !entries.length && !library.length && !web ? h(Empty, null, q ? 'Nothing matches here; search arXiv instead.' : 'Type to find a reference.') : null);
}
