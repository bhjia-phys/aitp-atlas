// --------------------------------------------------------------- discover ---
// The way in for new material: what arXiv posted under a topic's saved
// searches, who cites what the topic relies on (INSPIRE), and one box that adds
// a paper, a lecture or files. A lookup reads metadata only; Add downloads, into
// the knowledge collection, as ordinary files beside the notes.

const discoverStore = externalStore(null);
let discoverWrites = Promise.resolve();

async function loadDiscover() {
  const state = await api('discover');
  discoverStore.set(state);
  return state;
}

/** Change the saved searches and marks one at a time, from the latest state. */
function updateDiscover(change) {
  const run = async () => {
    const current = discoverStore.get() || (await loadDiscover());
    const next = change(current);
    discoverStore.set(next);
    discoverStore.set(await api('discover/save', { method: 'POST', body: next }));
  };
  discoverWrites = discoverWrites.catch(() => {}).then(run);
  return discoverWrites;
}

function useDiscover() {
  const state = React.useSyncExternalStore(discoverStore.subscribe, discoverStore.get);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!state) loadDiscover().catch(setError);
  }, [state]);
  return { state, error };
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Two paths name the same file (Windows paths compare without case). */
function samePath(a, b) {
  const norm = (p) => String(p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  return Boolean(a) && norm(a) === norm(b);
}

const TEX_SYMBOLS = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω', infty: '∞', hbar: 'ħ', ell: 'ℓ', partial: '∂', times: '×', to: '→', rightarrow: '→', leq: '≤', geq: '≥', sim: '∼', approx: '≈', pm: '±', cdot: '·' };

/** A paper title as readable text: inline TeX such as $\eta$ or $\mathrm{MoTe}_2$ becomes η and MoTe2. */
function texText(text) {
  return String(text || '').replace(/\$([^$]+)\$/g, (_, math) => math
    .replace(/\\(?:mathrm|text|textrm|mathcal|mathbb|mathbf|mathit|mathsf|operatorname)\s*\{([^}]*)\}/g, '$1')
    .replace(/\\([A-Za-z]+)/g, (all, name) => TEX_SYMBOLS[name] || name)
    .replace(/[{}^_\\]/g, ''))
    .replace(/---/g, '—').replace(/--/g, '–').replace(/~/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function shortAuthors(list) {
  const names = (list || []).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} et al.`;
}

function topicRefOf(t) {
  return t ? { id: t.id, title: t.title, path: t.file } : null;
}

// ------------------------------------------------------------ the page ---

function DiscoverPanel({ ov, data, go, flash, focusAdd }) {
  // The topics with the most recent Current work first: the likeliest to need new reading.
  const topics = useMemo(() => Object.values(ov.topics).filter((t) => t.id !== '' && t.reached !== false).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || a.title.localeCompare(b.title)), [ov]);
  const [topicFile, setTopicFile] = useState(() => storageGet('discover-topic', ''));
  const topic = topics.find((t) => samePath(t.file, topicFile)) || topics[0] || null;
  const choose = (file) => {
    setTopicFile(file);
    storageSet('discover-topic', file);
  };
  const online = ov.online !== false;
  return h('div', { className: 'atlas-discover' },
    h('div', { className: 'atlas-discover-main' },
      h('label', { className: 'atlas-discover-for' },
        h('span', { className: 'atlas-label' }, 'Discover for'),
        h('select', { className: 'atlas-input', value: topic ? topic.file : '', onChange: (e) => choose(e.target.value) },
          topics.map((t) => h('option', { key: t.file, value: t.file }, t.title)))),
      online ? null : h('p', { className: 'atlas-panel' }, 'Outside requests are off in the Atlas config (web: false), so Discover asks arXiv and INSPIRE nothing.'),
      topic && online ? h(SavedSearches, { key: 's:' + topic.file, topic, flash, go }) : null,
      topic && online ? h(CitedWork, { key: 'c:' + topic.file, topic, data, flash, go }) : null,
      topic ? h(OpenQuestions, { topic }) : null),
    h(AddAnything, { ov, data, go, flash, topics, topic, focus: focusAdd }));
}

function SavedSearches({ topic, flash, go }) {
  const { state, error } = useDiscover();
  const [draft, setDraft] = useState('');
  const searches = state ? state.searches.filter((s) => samePath(s.topic, topic.file)) : [];
  const save = (event) => {
    event.preventDefault();
    const query = draft.trim();
    if (!query) return;
    updateDiscover((cur) => ({ ...cur, searches: [...cur.searches, { query, topic: topic.file, created: todayIso() }] }))
      .then(() => setDraft(''), (e) => flash(e.message));
  };
  const remove = (search) => updateDiscover((cur) => ({ ...cur, searches: cur.searches.filter((s) => !(s.id === search.id && samePath(s.topic, search.topic))) })).catch((e) => flash(e.message));
  return h('section', { className: 'atlas-section' },
    h('h2', null, 'Saved searches', h('span', { className: 'atlas-count' }, searches.length)),
    error ? h('p', { className: 'atlas-muted' }, 'The saved searches could not be read: ', error.message) : null,
    searches.length ? h('div', { className: 'atlas-search-chips' }, searches.map((s) => h('span', { key: s.id, className: 'atlas-search-chip' },
      s.query,
      h('button', { type: 'button', className: 'atlas-search-x', 'aria-label': `Stop searching for ${s.query}`, title: 'Remove this search', onClick: () => remove(s) }, h(Icon, { name: 'close', size: 12 }))))) : null,
    h('form', { className: 'atlas-inline-form', onSubmit: save },
      h('input', { className: 'atlas-input', value: draft, onChange: (e) => setDraft(e.target.value), placeholder: 'Words for arXiv: long-range Heisenberg · level statistics', 'aria-label': 'A new saved search' }),
      h('button', { type: 'submit', className: 'atlas-button is-small', disabled: !draft.trim() }, h(Icon, { name: 'plus', size: 14 }), h('span', null, 'Save a search'))),
    searches.length === 0 ? h(Empty, null, 'Save the words you would search arXiv for; Atlas shows what was posted under them, newest first. Phrases separated by · must all appear.') : null,
    searches.map((s) => h(SearchResults, { key: s.id, search: s, topic, flash, go })));
}

function SearchResults({ search, topic, flash, go }) {
  const { state } = useDiscover();
  const { data, error, loading } = useApi('web/search', { q: search.query, max: 6 }, search.query);
  const seenKey = 'search:' + search.id;
  const lastSeen = useRef(null);
  if (lastSeen.current === null && state) lastSeen.current = (state.seen && state.seen[seenKey]) || '';
  useEffect(() => {
    if (data && state && state.seen[seenKey] !== todayIso()) updateDiscover((cur) => ({ ...cur, seen: { ...cur.seen, [seenKey]: todayIso() } })).catch(() => {});
  }, [Boolean(data)]);
  const entries = data ? data.entries.filter((e) => !(state && state.dismissed && state.dismissed[e.id])) : [];
  return h('div', { className: 'atlas-search-results' },
    h('h3', null, `New under “${search.query}”`),
    loading ? h('p', { className: 'atlas-muted' }, 'Asking arXiv…') : null,
    error ? h('p', { className: 'atlas-muted' }, 'arXiv: ', error.message) : null,
    data && entries.length === 0 ? h(Empty, null, 'Nothing here that you have not set aside.') : null,
    entries.length ? h('ul', { className: 'atlas-paper-cards' }, entries.map((e) => h(PaperCard, { key: e.id, e, topic, flash, go, fresh: Boolean(lastSeen.current) && String(e.published).slice(0, 10) > lastSeen.current, why: `matches “${search.query}”` }))) : null);
}

/** A paper from arXiv or INSPIRE: read its abstract, add it, ask about it, or set it aside. */
function PaperCard({ e, why, fresh, topic, flash, go }) {
  const actions = React.useContext(AtlasActions);
  const [busy, setBusy] = useState('');
  const [added, setAdded] = useState(null);
  const id = e.id || e.arxiv || '';
  const add = async (note) => {
    setBusy(note ? 'note' : 'add');
    try {
      const r = await api('web/add', { method: 'POST', body: { id, version: e.version || '', note, topic: topic ? topic.file : '', meta: e } });
      setAdded(r);
      flash(r.existed ? `arXiv:${id} is already in the library.` : `Added arXiv:${id}${r.version} to the library${r.map && !r.map.existed ? ', with a paper map' : ''}.`);
    } catch (error) {
      flash(error.message);
    } finally {
      setBusy('');
    }
  };
  const setAside = () => updateDiscover((cur) => ({ ...cur, dismissed: { ...cur.dismissed, [id]: todayIso() } })).catch((err) => flash(err.message));
  const ask = () => actions.ask(focusContext({ topic: topicRefOf(topic) }), 'ask',
    `Is arXiv:${id} (“${e.title}”) relevant to this topic? Read its abstract, say which of my questions it bears on and what it would change in my notes, and whether it is worth adding to the library. Add nothing yet.`, `arXiv:${id}`);
  const meta = [shortAuthors(e.authors), id ? `arXiv:${id}` : '', String(e.published || e.date || '').slice(0, 10), (e.categories || []).slice(0, 3).join(', '), e.journal || ''].filter(Boolean).join(' · ');
  return h('li', { className: 'atlas-paper-card' },
    h('div', { className: 'atlas-paper-card-head' },
      fresh ? h('span', { className: 'atlas-chip is-new', title: 'Posted since you last looked' }, 'new') : null,
      id ? h('a', { className: 'atlas-paper-name', href: `https://arxiv.org/abs/${id}`, target: '_blank', rel: 'noreferrer' }, texText(e.title)) : h('span', { className: 'atlas-paper-name' }, texText(e.title)),
      typeof e.citations === 'number' && e.citations > 0 ? h('span', { className: 'atlas-date' }, `cited ${e.citations}×`) : null),
    h('p', { className: 'atlas-paper-meta' }, meta),
    why ? h('p', { className: 'atlas-paper-why' }, h('span', { className: 'atlas-label' }, 'Why it surfaced'), ' ', why) : null,
    e.summary ? h('details', { className: 'atlas-abstract' }, h('summary', null, 'Abstract'), h('p', null, e.summary)) : null,
    h('div', { className: 'atlas-paper-actions' },
      added && added.pdf ? h(Button, { small: true, icon: 'paper', onClick: () => go({ view: 'doc', path: added.pdf }) }, 'Read it') : null,
      added && added.map && added.map.file ? h(Button, { small: true, quiet: true, icon: 'note', onClick: () => go({ view: 'doc', path: added.map.file }) }, 'Paper map') : null,
      !added && id ? h(Button, { small: true, disabled: Boolean(busy), onClick: () => add(false) }, busy === 'add' ? 'Adding…' : 'Add to library') : null,
      !added && id ? h(Button, { small: true, quiet: true, disabled: Boolean(busy), onClick: () => add(true) }, busy === 'note' ? 'Adding…' : 'Add and start a reading note') : null,
      h(Button, { small: true, quiet: true, icon: 'spark', onClick: ask }, 'Ask about it'),
      !added && id ? h(Button, { small: true, quiet: true, onClick: setAside, title: 'Hide it from these searches' }, 'Not relevant') : null));
}

/** INSPIRE: how often what the topic relies on is cited, and who cited it recently. */
function CitedWork({ topic, data, flash, go }) {
  const { state } = useDiscover();
  const entry = data && data.byTopic ? data.byTopic.find((t) => samePath(t.file, topic.file)) : null;
  const ids = entry ? entry.arxiv.slice(0, 12) : [];
  const papers = data ? new Map(data.papers.map((p) => [p.key, p])) : new Map();
  const counts = useApi('web/citations', { arxiv: ids.join(',') }, ids.join(','));
  const [open, setOpen] = useState(null);
  if (ids.length === 0) return h('section', { className: 'atlas-section' }, h('h2', null, 'INSPIRE: who cites what you rely on'), h(Empty, null, 'This topic’s note names no arXiv paper yet.'));
  const rows = ids.map((id) => {
    const c = counts.data && counts.data.counts ? counts.data.counts[id] : null;
    const seen = state && state.seen ? Number(state.seen['cites:' + id]) : NaN;
    return { id, c, title: texText((c && c.title) || (papers.get(id) && papers.get(id).title) || `arXiv:${id}`), fresh: c && Number.isFinite(seen) ? Math.max(0, c.citations - seen) : 0 };
  });
  const show = (row) => {
    setOpen(open === row.id ? null : row.id);
    if (row.c) updateDiscover((cur) => ({ ...cur, seen: { ...cur.seen, ['cites:' + row.id]: String(row.c.citations) } })).catch(() => {});
  };
  return h('section', { className: 'atlas-section' },
    h('h2', null, 'INSPIRE: who cites what you rely on', h('span', { className: 'atlas-count' }, ids.length)),
    counts.loading ? h('p', { className: 'atlas-muted' }, 'Asking INSPIRE…') : null,
    counts.error ? h('p', { className: 'atlas-muted' }, 'INSPIRE: ', counts.error.message) : null,
    h('ul', { className: 'atlas-cited' }, rows.map((row) => h('li', { key: row.id },
      h('div', { className: 'atlas-cited-row' },
        h('span', { className: 'atlas-cited-title' }, row.title),
        h('span', { className: 'atlas-cited-count' }, row.c ? `cited by ${row.c.citations}` : counts.data ? 'not in INSPIRE' : '', row.fresh ? h('span', { className: 'atlas-chip is-new' }, `${row.fresh} new since your last visit`) : null),
        row.c ? h(TextButton, { onClick: () => show(row) }, open === row.id ? 'Hide' : 'Show citing papers') : null),
      open === row.id ? h(CitingList, { id: row.id, topic, flash, go }) : null))));
}

function CitingList({ id, topic, flash, go }) {
  const { data, error, loading } = useApi('web/citing', { arxiv: id, size: 6 }, id);
  if (loading) return h('p', { className: 'atlas-muted' }, 'Reading the newest citing papers…');
  if (error) return h('p', { className: 'atlas-muted' }, error.message);
  return h('ul', { className: 'atlas-paper-cards is-nested' }, data.recent.map((r) => h(PaperCard, {
    key: r.recid,
    e: { id: r.arxiv, title: r.title, authors: r.authors, published: r.date, citations: r.citations, journal: r.journal },
    why: `cites arXiv:${id}`,
    topic,
    flash,
    go,
  })));
}

function OpenQuestions({ topic }) {
  const actions = React.useContext(AtlasActions);
  const ask = () => actions.ask(focusContext({ topic: topicRefOf(topic) }), 'papers',
    "Read this topic's Current work and open questions, then search arXiv and INSPIRE for papers that bear on them. For each paper say which question it bears on and why, and whether my library already has it. Add nothing and change no note.",
    'Papers for my open questions');
  return h('section', { className: 'atlas-section' },
    h('h2', null, 'From your open questions'),
    h('p', { className: 'atlas-muted' }, 'A discussion reads this topic’s Current work, searches arXiv and INSPIRE, and says which papers bear on which question. It adds nothing.'),
    h(Button, { icon: 'spark', onClick: ask }, 'Find papers for my open questions'));
}

// ------------------------------------------------------------ add anything ---

function AddAnything({ ov, data, go, flash, topics, topic, focus }) {
  const [mode, setMode] = useState(() => storageGet('add-mode', 'paper'));
  const choose = (next) => {
    setMode(next);
    storageSet('add-mode', next);
  };
  const modes = [['paper', 'Paper'], ['lecture', 'Lecture video'], ['files', 'Files']];
  return h('aside', { className: 'atlas-add', 'aria-label': 'Add anything' },
    h('h2', null, 'Add anything'),
    h('div', { className: 'atlas-seg', role: 'tablist' }, modes.map(([key, label]) => h('button', { key, type: 'button', role: 'tab', 'aria-selected': mode === key, className: cx('atlas-seg-item', mode === key && 'is-on'), onClick: () => choose(key) }, label))),
    mode === 'paper' ? h(AddPaper, { ov, go, flash, topics, topic, focus }) : null,
    mode === 'lecture' ? h(AddLecture, { go, flash, topics, topic }) : null,
    mode === 'files' ? h(AddFiles, { data, go, flash, topics, topic }) : null,
    h('p', { className: 'atlas-add-note' }, 'Nothing is downloaded until you press Add. Everything lands as ordinary files beside your notes.'));
}

function TopicSelect({ topics, value, onChange, label = 'Link to' }) {
  return h('label', { className: 'atlas-field' },
    h('span', null, label),
    h('select', { className: 'atlas-input', value: value || '', onChange: (e) => onChange(e.target.value) },
      h('option', { value: '' }, 'No topic'),
      topics.map((t) => h('option', { key: t.file, value: t.file }, t.title))));
}

function AddPaper({ ov, go, flash, topics, topic, focus }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState('');
  const [why, setWhy] = useState('');
  const [link, setLink] = useState(topic ? topic.file : '');
  const [source, setSource] = useState(true);
  const [result, setResult] = useState(null);
  const input = useRef(null);
  useEffect(() => {
    if (focus && input.current) input.current.focus();
  }, [focus]);
  useEffect(() => {
    if (topic && !link) setLink(topic.file);
  }, [topic && topic.file]);
  const look = async (event) => {
    event.preventDefault();
    if (!q.trim()) return;
    setBusy('look');
    setFound(null);
    setResult(null);
    try {
      setFound(await api('web/lookup', { query: { q: q.trim() } }));
    } catch (error) {
      flash(error.message);
    } finally {
      setBusy('');
    }
  };
  const add = async (note) => {
    setBusy(note ? 'note' : 'add');
    try {
      const r = await api('web/add', { method: 'POST', body: { id: found.id, version: found.version, source, note, why, topic: link, meta: found } });
      setResult(r);
      const parts = [r.existed ? 'This edition was already in the library' : `Added ${found.id}${r.version}`];
      if (r.source && r.source.files) parts.push(`${plural(r.source.files, 'source file')}`);
      if (r.source && r.source.error) parts.push(`the source was not added (${r.source.error})`);
      if (r.map) parts.push(r.map.existed ? 'its paper map already exists' : 'a paper map was started');
      flash(parts.join('; ') + '.');
    } catch (error) {
      flash(error.message);
    } finally {
      setBusy('');
    }
  };
  if (ov.online === false) return h('p', { className: 'atlas-muted' }, 'Outside requests are off in the Atlas config (web: false). Add papers by dropping their PDFs under Files.');
  const dir = found && found.kind === 'arxiv' ? `library/arxiv/${String(found.id).replace('/', '_')}${found.version}/` : '';
  return h('div', { className: 'atlas-add-body' },
    h('form', { className: 'atlas-inline-form', onSubmit: look },
      h('input', { ref: input, className: 'atlas-input', value: q, onChange: (e) => setQ(e.target.value), placeholder: 'arXiv ID or link, DOI, INSPIRE link', 'aria-label': 'A paper to look up' }),
      h('button', { type: 'submit', className: 'atlas-button is-small', disabled: !q.trim() || busy === 'look' }, busy === 'look' ? 'Looking…' : 'Look up')),
    found && found.kind === 'record' ? h('div', { className: 'atlas-found' },
      h('p', { className: 'atlas-found-title' }, texText(found.title)),
      h('p', { className: 'atlas-paper-meta' }, [shortAuthors(found.authors), found.journal, found.year].filter(Boolean).join(' · ')),
      h('p', { className: 'atlas-muted' }, 'INSPIRE lists no arXiv version, so there is no open PDF to add. ', found.doi ? h('a', { href: `https://doi.org/${found.doi}`, target: '_blank', rel: 'noreferrer' }, 'Open the DOI') : null)) : null,
    found && found.kind === 'arxiv' ? h('div', { className: 'atlas-found' },
      h('p', { className: 'atlas-found-title' }, texText(found.title)),
      h('p', { className: 'atlas-paper-meta' }, [shortAuthors(found.authors), found.journal, `arXiv:${found.id}${found.version}`, found.version !== found.latest ? `latest ${found.latest}` : '', found.inspire ? `cited ${found.inspire.citations}× (INSPIRE)` : ''].filter(Boolean).join(' · ')),
      found.mentionedBy.length ? h('p', { className: 'atlas-found-line' }, h('span', { className: 'atlas-label' }, 'Already cited in'), ' ',
        found.mentionedBy.map((t, i) => h('span', { key: t.file }, i ? ', ' : '', h(TextButton, { onClick: () => go({ view: 'doc', path: t.file }) }, shortTitle(t.title, 50))))) : null,
      found.inLibrary ? h('p', { className: 'atlas-found-line' }, h('span', { className: 'atlas-label' }, 'In your library'), ' ', found.inLibrary.versions.join(', ') || 'a paper map',
        found.inLibrary.pdf ? h('span', null, ' · ', h(TextButton, { onClick: () => go({ view: 'doc', path: found.inLibrary.pdf }) }, 'read it')) : null,
        found.inLibrary.map ? h('span', null, ' · ', h(TextButton, { onClick: () => go({ view: 'doc', path: found.inLibrary.map }) }, 'paper map')) : null) : null,
      found.summary ? h('details', { className: 'atlas-abstract' }, h('summary', null, 'Abstract'), h('p', null, found.summary)) : null,
      h('p', { className: 'atlas-found-line' }, h('span', { className: 'atlas-label' }, 'PDF and source go to'), ' ', h('code', null, dir)),
      h('label', { className: 'atlas-check' }, h('input', { type: 'checkbox', checked: source, onChange: (e) => setSource(e.target.checked) }), 'Also the TeX source (unpacked into source/)'),
      h('label', { className: 'atlas-field' }, h('span', null, "Why I'm reading it"), h('input', { className: 'atlas-input', value: why, onChange: (e) => setWhy(e.target.value), placeholder: 'Optional: goes into the paper map’s “Your reading”' })),
      h(TopicSelect, { topics, value: link, onChange: setLink }),
      result ? h('div', { className: 'atlas-actions' },
        result.pdf ? h(Button, { small: true, primary: true, icon: 'paper', onClick: () => go({ view: 'doc', path: result.pdf }) }, 'Read it') : null,
        result.map ? h(Button, { small: true, icon: 'note', onClick: () => go({ view: 'doc', path: result.map.file }) }, 'Paper map') : null)
        : h('div', { className: 'atlas-actions' },
          h(Button, { small: true, primary: true, disabled: Boolean(busy), onClick: () => add(true) }, busy === 'note' ? 'Adding…' : 'Add and start a reading note'),
          h(Button, { small: true, disabled: Boolean(busy), onClick: () => add(false) }, busy === 'add' ? 'Adding…' : 'Add to library'))) : null);
}

function AddLecture({ go, flash, topics, topic }) {
  const [form, setForm] = useState({ url: '', title: '', speaker: '', venue: '', why: '' });
  const [link, setLink] = useState(topic ? topic.file : '');
  const [transcript, setTranscript] = useState(null);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const pick = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return setTranscript(null);
    if (file.size > 5 * 1024 * 1024) {
      flash('That transcript is larger than 5 MB.');
      return setTranscript(null);
    }
    setTranscript({ name: file.name, text: await file.text() });
  };
  const add = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const r = await api('lecture', { method: 'POST', body: { ...form, topic: link, transcript } });
      setMade(r);
      flash('The lecture has a source note' + (r.transcript ? ', with its transcript.' : '.'));
    } catch (error) {
      flash(error.message);
    } finally {
      setBusy(false);
    }
  };
  if (made) {
    return h('div', { className: 'atlas-add-body' },
      h('p', null, 'Added. The source note links the recording; a note can point at a moment as [12:30](link&t=750).'),
      h('div', { className: 'atlas-actions' },
        h(Button, { small: true, primary: true, icon: 'note', onClick: () => go({ view: 'doc', path: made.file }) }, 'Open the note'),
        made.transcript ? h(Button, { small: true, onClick: () => go({ view: 'doc', path: made.transcript }) }, 'Transcript') : null,
        h(Button, { small: true, quiet: true, onClick: () => { setMade(null); setForm({ url: '', title: '', speaker: '', venue: '', why: '' }); setTranscript(null); } }, 'Add another')));
  }
  return h('form', { className: 'atlas-add-body', onSubmit: add },
    h('label', { className: 'atlas-field' }, h('span', null, 'Link to the recording'), h('input', { className: 'atlas-input', value: form.url, onChange: set('url'), placeholder: 'https://…', required: true })),
    h('label', { className: 'atlas-field' }, h('span', null, 'Title'), h('input', { className: 'atlas-input', value: form.title, onChange: set('title'), required: true })),
    h('div', { className: 'atlas-field-row' },
      h('label', { className: 'atlas-field' }, h('span', null, 'Speaker'), h('input', { className: 'atlas-input', value: form.speaker, onChange: set('speaker') })),
      h('label', { className: 'atlas-field' }, h('span', null, 'School or venue'), h('input', { className: 'atlas-input', value: form.venue, onChange: set('venue') }))),
    h('label', { className: 'atlas-field' }, h('span', null, 'Transcript (.vtt, .srt, .txt), optional'), h('input', { type: 'file', accept: '.vtt,.srt,.txt,.md', onChange: pick })),
    h('label', { className: 'atlas-field' }, h('span', null, "Why I'm watching it"), h('input', { className: 'atlas-input', value: form.why, onChange: set('why') })),
    h(TopicSelect, { topics, value: link, onChange: setLink }),
    h('p', { className: 'atlas-muted' }, 'Stored as a source note in sources/, the transcript in library/lectures/. Atlas does not download the video.'),
    h('div', { className: 'atlas-actions' }, h('button', { type: 'submit', className: 'atlas-button is-primary is-small', disabled: busy || !form.url.trim() || !form.title.trim() }, busy ? 'Adding…' : 'Add the lecture')));
}

async function uploadFile(dir, file) {
  const res = await fetch(`${API}/upload?${new URLSearchParams({ dir, name: file.name })}`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/octet-stream' }, body: file });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) throw new Error((json && json.error && json.error.message) || `${res.status} ${res.statusText}`);
  return json;
}

function AddFiles({ data, go, flash, topics, topic }) {
  const [where, setWhere] = useState('');
  const [over, setOver] = useState(false);
  const [done, setDone] = useState([]);
  const [busy, setBusy] = useState(false);
  const knowledge = data && data.knowledge ? data.knowledge : '';
  const places = [
    ...(topic ? [[joinPath(dirOf(topic.file), 'readings'), `${shortTitle(topic.title, 40)} › readings/`]] : []),
    ...(knowledge ? [[joinPath(knowledge, 'library/files'), 'Knowledge › library/files/']] : []),
  ];
  const target = where || (places[0] ? places[0][0] : '');
  const send = async (files) => {
    if (!target || files.length === 0) return;
    setBusy(true);
    const results = [];
    for (const file of files) {
      try {
        const r = await uploadFile(target, file);
        results.push({ name: file.name, path: r.path });
      } catch (error) {
        results.push({ name: file.name, error: error.message });
      }
    }
    setDone((prev) => [...results, ...prev].slice(0, 20));
    setBusy(false);
    const ok = results.filter((r) => r.path).length;
    flash(ok === results.length ? `Added ${plural(ok, 'file')}.` : `Added ${ok} of ${results.length}; see the list.`);
  };
  return h('div', { className: 'atlas-add-body' },
    h('label', { className: 'atlas-field' }, h('span', null, 'Put them in'),
      h('select', { className: 'atlas-input', value: target, onChange: (e) => setWhere(e.target.value) }, places.map(([dir, label]) => h('option', { key: dir, value: dir }, label)))),
    h('label', {
      className: cx('atlas-drop', over && 'is-over'),
      onDragOver: (e) => { e.preventDefault(); setOver(true); },
      onDragLeave: () => setOver(false),
      onDrop: (e) => { e.preventDefault(); setOver(false); send([...e.dataTransfer.files]); },
    },
    h('input', { type: 'file', multiple: true, className: 'atlas-drop-input', onChange: (e) => { send([...e.target.files]); e.target.value = ''; } }),
    h(Icon, { name: 'plus', size: 18 }),
    h('span', null, busy ? 'Adding…' : 'Drop PDFs, slides or lecture notes here, or choose files')),
    done.length ? h('ul', { className: 'atlas-dropped' }, done.map((d, i) => h('li', { key: i },
      d.path ? h(TextButton, { onClick: () => go({ view: 'doc', path: d.path }) }, d.name) : h('span', null, d.name),
      d.error ? h('span', { className: 'atlas-muted' }, ` — ${d.error}`) : null))) : null);
}
