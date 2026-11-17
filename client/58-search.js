// --------------------------------------------------------- search and learn ---
// Search across the notes, the knowledge index and the papers. Learn: a topic's
// question, its reading route and the concepts it uses, read from its own
// notes; nothing here tracks progress or claims mastery.

function Hits({ parts }) {
  return parts.map((p, i) => (p.hit ? h('mark', { key: i }, p.text) : h('span', { key: i }, p.text)));
}

const SEARCH_KINDS = [['all', 'All'], ['note', 'Notes'], ['knowledge', 'Knowledge'], ['paper', 'Papers']];
const KIND_WORD = { note: 'Note', knowledge: 'Knowledge', paper: 'Paper' };

function SearchView({ overview: ov, go, q: wanted, at }) {
  const [q, setQ] = useState(() => wanted || storageGet('last-search', ''));
  const [query, setQuery] = useState(() => wanted || storageGet('last-search', ''));
  const [kind, setKind] = useState('all');
  const input = useRef(null);
  useEffect(() => {
    if (wanted !== undefined && wanted !== null) {
      setQ(wanted);
      setQuery(wanted);
    }
    if (input.current) input.current.focus();
  }, [wanted, at]);
  usePublishFocus({ kind: 'universe', topic: { id: '', title: ov.title || 'Root note', path: ov.rootFile } }, [ov.rootFile]);
  const { data, error, loading } = useApi('search', { q: query, kind }, `${query}|${kind}`);
  const submit = (event) => {
    event.preventDefault();
    setQuery(q.trim());
    storageSet('last-search', q.trim());
  };
  const counts = data ? data.counts : { note: 0, knowledge: 0, paper: 0 };
  const total = counts.note + counts.knowledge + counts.paper;
  const open = (r) => go({ view: 'doc', path: r.kind === 'paper' && r.paper && r.paper.pdf ? r.paper.pdf : r.file });
  return h('div', { className: 'atlas-page atlas-search' },
    h('p', { className: 'atlas-kicker' }, 'Search'),
    h('form', { className: 'atlas-search-form', onSubmit: submit, role: 'search' },
      h(Icon, { name: 'search', size: 18 }),
      h('input', { ref: input, className: 'atlas-input', value: q, onChange: (e) => setQ(e.target.value), placeholder: 'Words in your notes, the knowledge index and your papers', 'aria-label': 'Search' }),
      h('button', { type: 'submit', className: 'atlas-button is-primary', disabled: !q.trim() }, 'Search')),
    query ? h('div', { className: 'atlas-seg is-tabs', role: 'tablist' }, SEARCH_KINDS.map(([key, label]) => h('button', { key, type: 'button', role: 'tab', 'aria-selected': kind === key, className: cx('atlas-seg-item', kind === key && 'is-on'), onClick: () => setKind(key) }, label, h('span', { className: 'atlas-count' }, key === 'all' ? total : counts[key])))) : null,
    !query ? h(Empty, null, 'Every word must appear. Press / anywhere in Atlas to search.') : null,
    query && loading && !data ? h('p', { className: 'atlas-muted' }, 'Reading the notes…') : null,
    error ? h(ErrorNote, { error }) : null,
    data && query && data.results.length === 0 ? h(Empty, null, `Nothing holds all of: ${data.words.join(', ')}.`) : null,
    data ? h('ol', { className: 'atlas-results' }, data.results.map((r, i) => h('li', { key: r.kind + r.file + i, className: 'atlas-result' },
      h('div', { className: 'atlas-result-head' },
        h('span', { className: 'atlas-result-kind' }, KIND_WORD[r.kind] || r.kind),
        h('button', { type: 'button', className: 'atlas-result-title', onClick: () => open(r) }, texText(r.title) || baseName(r.file))),
      h('p', { className: 'atlas-result-where' }, r.topic && !samePath(r.topic.file, r.file) ? `in ${shortTitle(r.topic.title, 60)} · ` : '', r.area ? `${r.area} · ` : '', baseName(r.file)),
      h('p', { className: 'atlas-result-snippet' }, h(Hits, { parts: r.snippet }))))) : null);
}

// ------------------------------------------------------------------ learn ---

/** Topics under a direction about learning; otherwise every topic, most recent first. */
function learningTopics(ov) {
  const dirs = (ov.directions || []).filter((d) => /learn|study|teach|course|lecture|read/i.test(d.heading));
  const ids = new Set(dirs.flatMap((d) => d.topics || []));
  const all = Object.values(ov.topics).filter((t) => t.id !== '' && t.reached !== false);
  const own = all.filter((t) => ids.has(t.id) || ids.has(String(t.id).split('/')[0]));
  const rest = all.filter((t) => !own.includes(t)).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return { own, rest };
}

function LearnView({ overview: ov, go, flash, path }) {
  const actions = React.useContext(AtlasActions);
  const { own, rest } = useMemo(() => learningTopics(ov), [ov]);
  const [chosen, setChosen] = useState(() => path || storageGet('learn-topic', '') || (own[0] || rest[0] || {}).file || '');
  useEffect(() => {
    if (path) setChosen(path);
  }, [path]);
  const choose = (file) => {
    setChosen(file);
    storageSet('learn-topic', file);
  };
  const topic = Object.values(ov.topics).find((t) => samePath(t.file, chosen)) || null;
  const { data, error, loading } = useApi('learn', topic ? { path: topic.file } : { path: '' }, topic ? topic.file : 'none');
  usePublishFocus({ kind: 'topic', topic: topic ? { id: topic.id, title: topic.title, path: topic.file } : null }, [topic ? topic.file : '']);
  const context = topic ? focusContext({ topic: { id: topic.id, title: topic.title, path: topic.file } }) : focusContext({});
  const explain = () => actions.ask(context, 'explain', data && data.question ? `My question: ${data.question}` : '', 'Explain at my level');
  const check = () => actions.ask(context, 'ask', 'Ask me two or three short questions that would show whether I understand the current question of this topic; wait for my answers before explaining anything.', 'Check my understanding');
  const writeOwn = async () => {
    if (!topic) return;
    const date = new Date().toISOString().slice(0, 10);
    const file = joinPath(dirOf(topic.file), `notes/what-i-understand-${date}.md`);
    const text = `# What I understand: ${(data && data.question) || topic.title}\n\n*In my own words, ${date}. The AI can check it when I ask; nothing here claims mastery.*\n\n## What I can explain\n\n\n## Where I am unsure\n\n\n## What I want to check next\n\n`;
    try {
      await api('save', { method: 'POST', body: { path: file, text, create: true } });
      go({ view: 'doc', path: file, edit: true, created: true });
    } catch (error) {
      if (error.status === 409) go({ view: 'doc', path: file, edit: true });
      else flash(error.message);
    }
  };
  const edgesFrom = new Map();
  if (data) for (const [a, b] of data.concepts.edges) edgesFrom.set(a, [...(edgesFrom.get(a) || []), b]);
  const title = (file) => (data ? (data.concepts.nodes.find((n) => samePath(n.file, file)) || {}).title || baseName(file) : baseName(file));
  const linked = new Set(data ? data.concepts.edges.flat().map((f) => f.toLowerCase()) : []);
  return h('div', { className: 'atlas-page is-wide atlas-learn' },
    h('p', { className: 'atlas-kicker' }, 'Learn'),
    h('div', { className: 'atlas-learn-pick' },
      h('select', { className: 'atlas-input', value: topic ? topic.file : '', onChange: (e) => choose(e.target.value), 'aria-label': 'Topic' },
        own.length ? h('optgroup', { label: 'Learning' }, own.map((t) => h('option', { key: t.file, value: t.file }, t.title))) : null,
        h('optgroup', { label: own.length ? 'Other topics' : 'Topics' }, rest.map((t) => h('option', { key: t.file, value: t.file }, t.title))))),
    !topic ? h(Empty, null, 'Choose a topic.') : null,
    topic && loading && !data ? h(Loading, { label: 'Reading the topic…' }) : null,
    error ? h(ErrorNote, { error }) : null,
    data ? h('div', { className: 'atlas-learn-grid' },
      h('section', { className: 'atlas-learn-main' },
        h('h1', null, h(TextButton, { onClick: () => go({ view: 'doc', path: data.topic.file }) }, data.topic.title)),
        h('p', { className: 'atlas-label' }, 'Current question'),
        h('p', { className: 'atlas-learn-question' }, data.question || 'The note states no question in its opening.'),
        data.current ? h('p', { className: 'atlas-muted' }, 'Now: ', data.current.name, data.current.status ? ` · ${data.current.status}` : '', data.current.date ? ` · ${data.current.date}` : '') : null,
        h('div', { className: 'atlas-actions' },
          h(Button, { primary: true, icon: 'spark', onClick: explain }, 'Explain at my level'),
          h(Button, { icon: 'note', onClick: writeOwn }, 'Write what I understand'),
          h(Button, { quiet: true, onClick: check }, 'Check my understanding')),
        h('h2', { className: 'atlas-learn-h' }, data.route ? data.route.heading : 'Reading route'),
        data.route && data.route.from ? h('p', { className: 'atlas-muted atlas-learn-from' }, 'From ', h(TextButton, { onClick: () => go({ view: 'doc', path: data.route.from }) }, baseName(data.route.from)), ', the topic’s own route.') : null,
        data.route && data.route.items.length
          ? h('ol', { className: 'atlas-route' }, data.route.items.map((item, i) => h('li', { key: i },
            item.file ? h(TextButton, { onClick: () => go({ view: 'doc', path: item.file }) }, item.text)
              : item.url ? h('a', { href: item.url, target: '_blank', rel: 'noreferrer' }, item.text) : h('span', null, item.text))))
          : h(Empty, null, 'The note has no reading-route section (a “## Reading route” list); the route lives in the note, not in Atlas.'),
        h('p', { className: 'atlas-muted atlas-learn-foot' }, 'From the topic’s own note; nothing here tracks progress.')),
      h('aside', { className: 'atlas-learn-side' },
        h('h2', { className: 'atlas-learn-h' }, 'Concept map'),
        data.concepts.nodes.length === 0 ? h(Empty, null, 'No knowledge entry is linked to this topic yet.') : null,
        h('ul', { className: 'atlas-concepts' },
          [...edgesFrom.entries()].map(([from, tos]) => h('li', { key: from },
            h('button', { type: 'button', className: 'atlas-concept', onClick: () => go({ view: 'doc', path: from }) }, title(from)),
            h('span', { className: 'atlas-concept-arrow', 'aria-hidden': true }, '→'),
            tos.map((to) => h('button', { key: to, type: 'button', className: 'atlas-concept', onClick: () => go({ view: 'doc', path: to }) }, title(to))))),
          data.concepts.nodes.filter((n) => !linked.has(String(n.file).toLowerCase())).map((n) => h('li', { key: n.file },
            h('button', { type: 'button', className: 'atlas-concept', onClick: () => go({ view: 'doc', path: n.file }), title: n.support || '' }, n.title)))),
        data.concepts.nodes.length ? h('p', { className: 'atlas-muted atlas-learn-foot' }, 'Drawn from links between the knowledge entries the topic uses; each opens its entry.') : null)) : null);
}
