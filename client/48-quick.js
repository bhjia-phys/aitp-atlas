// ------------------------------------------------------------------ write ---
// Adding and writing from anywhere. The + button (or N) opens a small panel over the page: a paper
// (looked up, then added to the library for a topic), a note, or a LaTeX document (created in a
// topic's folder and opened: a note in a tab beside the page, a document as the page with its Preview beside it).
// Each starts with the topic in view. The Write page lists the LaTeX documents the notes link.

const QUICK_TABS = [['paper', 'Paper', 'paper'], ['note', 'Note', 'note'], ['tex', 'LaTeX', 'writing']];

/** A file name from a title: lower case, letters, digits and hyphens. */
function noteSlug(title) {
  return String(title || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60);
}

/** Where a new note or LaTeX document goes: `<topic folder>/<folder>/<slug>.<ext>`, or '' until it has a topic and a name. */
function writeTarget(topicFile, folder, title, kind) {
  const slug = noteSlug(title);
  if (!slug || !topicFile) return '';
  return joinPath(dirOf(topicFile), `${String(folder || '').replace(/^[\\/]+|[\\/]+$/g, '') || '.'}/${slug}.${kind}`);
}

/** The topic in view (in the pane used last), if a file can be filed under it. */
function topicInView(ov) {
  const focus = paneFocus(focusStore.get(), 'global');
  const file = focus.topic && focus.topic.path;
  return file && topicChoices(ov).some((c) => pathKey(c.file) === pathKey(file)) ? file : '';
}

function QuickAdd({ tab: initial, overview: ov, go, flash, onClose }) {
  const [tab, setTab] = useState(initial || 'paper');
  const trigger = useRef(typeof document === 'undefined' ? null : document.activeElement);
  const entry = useRef(null);
  const topic = useMemo(() => topicInView(ov), [ov]);
  const done = (next) => {
    onClose();
    go(next);
  };
  return h(Dialog, { className: 'atlas-add-write-dialog', title: 'Add or write', onClose, returnFocusRef: trigger, initialFocusRef: entry },
    h(Segmented, { label: 'What to add', value: tab, options: QUICK_TABS.map(([value, label]) => ({ value, label })), onChange: setTab }),
    tab === 'paper' ? h(QuickPaper, { ov, topic, done, flash, entry }) : h(QuickNote, { key: tab, kind: tab === 'tex' ? 'tex' : 'md', ov, topic, done, flash, entry }),
    h('p', { className: 'atlas-quick-more' }, 'A lecture or files: ', h(TextButton, { onClick: () => done({ view: 'library', tab: 'discover', add: Date.now() }) }, 'Library › Discover and add'), ' · ', h('kbd', null, 'Esc'), ' closes'));
}

/** A paper by its identifier: looked up, then added for a topic (or read first, in a tab). */
function QuickPaper({ ov, topic, done, flash, entry }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const look = async (event) => {
    event.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setError('');
    setFound(null);
    try {
      setFound(await api('web/lookup', { query: { q: q.trim() } }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const url = found ? (found.kind === 'arxiv' ? `https://arxiv.org/abs/${found.id}${found.version}` : found.doi ? `https://doi.org/${found.doi}` : '') : '';
  const authors = found && found.authors ? found.authors : [];
  let actions = null;
  if (found && found.inLibrary && found.inLibrary.pdf) {
    actions = h('div', { className: 'atlas-actions' }, h('span', { className: 'atlas-muted' }, 'Already in your library.'),
      h(Button, { small: true, primary: true, icon: 'paper', onClick: () => done({ view: 'doc', path: found.inLibrary.pdf, link: true }) }, 'Open it'));
  } else if (found && found.kind === 'arxiv') {
    actions = h('div', null,
      h(AddToLibrary, { entry: found, ov, preferred: topic, go: (next) => done({ ...next, stay: false, link: true }), flash }),
      h(Button, { small: true, quiet: true, icon: 'paper', onClick: () => done({ view: 'paper', url, topic }) }, 'Read it first'));
  } else if (found) {
    actions = h('p', { className: 'atlas-muted' }, 'It has no arXiv edition, so only its details can be shown. ', url ? h(TextButton, { onClick: () => done({ view: 'paper', url, topic }) }, 'Show them') : null);
  }
  return h('div', { className: 'atlas-quick-body' },
    h('form', { className: 'atlas-quick-row', onSubmit: look },
      h(Input, { className: 'atlas-input', inputRef: entry, value: q, onChange: (e) => setQ(e.target.value), placeholder: 'arXiv ID or link, DOI, or INSPIRE link', 'aria-label': 'The paper' }),
      h(Button, { type: 'submit', small: true, primary: true, disabled: busy || !q.trim() }, busy ? 'Looking…' : 'Look up')),
    error ? h('p', { className: 'atlas-askbar-error', role: 'alert' }, error) : null,
    found ? h('div', { className: 'atlas-quick-found' },
      h('p', { className: 'atlas-quick-title' }, found.title || q),
      h('p', { className: 'atlas-muted' }, [authors.slice(0, 4).join(', ') + (authors.length > 4 ? ', et al.' : ''), found.year, found.journal].filter(Boolean).join(' · ')),
      actions) : null);
}

/** A note or a LaTeX document in a topic's folder, made from the template and opened for writing. */
function QuickNote({ kind, ov, topic, done, flash, entry }) {
  const choices = useMemo(() => topicChoices(ov), [ov]);
  const [title, setTitle] = useState('');
  const [forTopic, setForTopic] = useState(topic || '');
  const [folder, setFolder] = useState(kind === 'tex' ? 'manuscript' : 'notes');
  const [busy, setBusy] = useState(false);
  const target = writeTarget(forTopic, folder, title, kind);
  const create = async (event) => {
    event.preventDefault();
    if (!target) return;
    setBusy(true);
    try {
      await api('save', { method: 'POST', body: { path: target, text: TEMPLATES[kind](title.trim()), create: true } });
      // A note opens in a tab beside the page; a LaTeX document as the page, its PDF in a Preview tab beside it.
      done(kind === 'tex' ? { view: 'doc', path: target, edit: true, created: true, full: true } : { view: 'doc', path: target, edit: true, created: true, link: true });
    } catch (error) {
      flash(error.status === 409 ? `There is already a file called ${baseName(target)} there.` : error.message);
    } finally {
      setBusy(false);
    }
  };
  return h('form', { className: 'atlas-quick-body', onSubmit: create },
    h(Input, { className: 'atlas-input', inputRef: entry, value: title, onChange: (e) => setTitle(e.target.value), placeholder: kind === 'tex' ? 'Title of the document' : 'Title of the note', 'aria-label': 'Title' }),
    h('div', { className: 'atlas-quick-row' },
      h('label', { className: 'atlas-ref-for' }, h('span', null, 'For'),
        h(Select, { className: 'atlas-input', value: forTopic, onChange: (e) => setForTopic(e.target.value), 'aria-label': 'The topic it belongs to' },
          h('option', { value: '' }, 'Choose a topic…'),
          choices.map((c) => h('option', { key: c.file, value: c.file }, c.label)))),
      h('label', { className: 'atlas-ref-for atlas-quick-folder' }, h('span', null, 'In'),
        h(Input, { className: 'atlas-input', value: folder, onChange: (e) => setFolder(e.target.value), 'aria-label': 'The folder inside the topic' }))),
    h('div', { className: 'atlas-quick-row' },
      h('span', { className: 'atlas-path' }, target ? target.slice(dirOf(forTopic).length + 1) : forTopic ? 'Name it to see where it goes' : 'Choose the topic it belongs to'),
      h('span', { className: 'atlas-spacer' }),
      h(Button, { type: 'submit', primary: true, small: true, disabled: busy || !target }, busy ? 'Creating…' : kind === 'tex' ? 'Create and open' : 'Create and write')));
}

/** The Write page: the LaTeX documents the notes link, by topic, newest first, each with its build state. */
function WriteView({ overview: ov, go, version, onQuick }) {
  const { data, error, loading } = useApi('write', version ? { fresh: 1 } : null, 'write', version);
  usePublishFocus({ kind: 'write' }, []);
  const groups = useMemo(() => {
    const out = [];
    for (const d of (data && data.documents) || []) {
      const key = d.topic ? d.topic.id : '';
      let group = out.find((g) => g.key === key);
      if (!group) out.push((group = { key, topic: d.topic, docs: [] }));
      group.docs.push(d);
    }
    return out;
  }, [data]);
  return h('div', { className: 'atlas-page is-wide atlas-write-page' },
    h('p', { className: 'atlas-kicker' }, h(Icon, { name: 'writing', size: 14 }), 'Write'),
    h('h1', null, 'Your writing'),
    h('p', { className: 'atlas-lede' }, 'The LaTeX documents your topic notes link, newest first. Open one to write it, with its PDF in a Preview tab beside it; Build is Ctrl+B. New notes, documents and papers also start from + anywhere (or N).'),
    h('div', { className: 'atlas-actions' },
      h(Button, { primary: true, icon: 'writing', onClick: () => onQuick('tex') }, 'New LaTeX document'),
      h(Button, { icon: 'note', onClick: () => onQuick('note') }, 'New note'),
      h(Button, { icon: 'paper', onClick: () => onQuick('paper') }, 'Add a paper')),
    loading && !data ? h(Loading, { label: 'Finding the documents your notes link…' }) : null,
    error ? h(ErrorNote, { error }) : null,
    data && groups.length === 0 ? h(Empty, null, 'No topic note links a LaTeX document yet. Link one from its topic’s note, or start one with New LaTeX document.') : null,
    groups.map((g) => h('section', { key: g.key, className: 'atlas-section' },
      h('h2', null, g.topic ? h(TextButton, { 'data-atlas-open': true, onClick: () => go({ view: 'doc', path: g.topic.file }) }, g.topic.title) : 'Outside the topics', h('span', { className: 'atlas-count' }, g.docs.length)),
      h('ul', { className: 'atlas-items' }, g.docs.map((d) => h('li', { key: d.file }, h(WriteRow, { d, go })))))));
}

function WriteRow({ d, go }) {
  const built = Boolean(d.pdf && d.pdf.mtimeMs >= d.mtimeMs - 1000);
  const state = !d.pdf ? 'not built yet' : built ? `PDF ${dateOf(d.pdf.mtimeMs)}` : 'PDF older than the source';
  return h('div', { className: 'atlas-write-row' },
    h('button', { type: 'button', className: 'atlas-item', 'data-atlas-open': true, title: d.file, onClick: () => go({ view: 'doc', path: d.file, edit: true, full: true }) },
      h(Icon, { name: 'writing', size: 15 }),
      h('span', { className: 'atlas-item-text' }, h('span', { className: 'atlas-item-label' }, d.title), h('span', { className: 'atlas-item-sub' }, `${baseName(d.file)} · changed ${dateOf(d.mtimeMs)}`)),
      h(Chip, { dot: !d.pdf ? 'var(--status-other)' : built ? 'var(--status-done)' : 'var(--status-waiting)' }, state)),
    d.pdf ? h(Button, { small: true, quiet: true, icon: 'paper', 'data-atlas-open': true, title: 'Open the PDF in a tab beside the page', onClick: () => go({ view: 'doc', path: d.pdf.path, link: true }) }, 'PDF') : null);
}
