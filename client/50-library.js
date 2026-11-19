// ---------------------------------------------------------------- library ---
// Papers, sources and the knowledge collection, sorted three ways: the shelf,
// by topic (what each line of research reads), and the knowledge index.

function yearOf(key) {
  const modern = /^(\d\d)(\d\d)\.\d{4,5}$/.exec(key);
  if (modern) return 2000 + Number(modern[1]);
  const old = /\/(\d\d)\d{5}$/.exec(key);
  if (old) return Number(old[1]) > 90 ? 1900 + Number(old[1]) : 2000 + Number(old[1]);
  return 0;
}

function LibraryView({ overview: ov, go, flash, filter, version, tab: wanted, focusAdd }) {
  const { data, error, loading } = useApi('knowledge', version ? { fresh: 1 } : null, 'knowledge', version);
  const [tab, setTab] = useState(() => wanted || storageGet('library-tab', 'shelf'));
  useEffect(() => {
    if (wanted) setTab(wanted);
  }, [wanted, focusAdd]);
  const [sort, setSort] = useState(() => storageGet('library-sort', 'newest'));
  const words = useWords(filter);
  const navigate = useNavigate(go, flash);
  usePublishFocus({ kind: 'library', topic: null, doc: null }, []);
  if (loading && !data) return h(Loading, { label: 'Opening the library…' });
  if (error) return h(ErrorNote, { error });
  const choose = (next) => {
    setTab(next);
    storageSet('library-tab', next);
  };
  const entryCount = data.index ? data.index.areas.reduce((n, a) => n + a.entries.length, 0) : 0;
  const tabs = [['shelf', 'Shelf', data.papers.length], ['topics', 'By topic', data.byTopic.length], ['knowledge', 'Knowledge index', entryCount], ['discover', 'Discover and add', null]];
  let body;
  if (tab === 'topics') body = h(ByTopic, { data, ov, go, words, navigate });
  else if (tab === 'knowledge') body = h(KnowledgeIndex, { data, go, words, navigate, flash });
  else if (tab === 'discover') body = h(DiscoverPanel, { ov, data, go, flash, focusAdd });
  else body = h(Shelf, { data, go, words, sort, setSort });
  return h('div', { className: 'atlas-page is-wide atlas-library' },
    h('header', { className: 'atlas-doc-head' },
      h('p', { className: 'atlas-kicker' }, h(Icon, { name: 'library', size: 14 }), 'Library'),
      h('h1', null, 'Papers, sources and knowledge'),
      h('div', { className: 'atlas-meta' },
        h('span', null, plural(data.papers.length, 'paper')), h('span', null, plural(data.papers.filter((p) => p.pdf).length, 'PDF')), h('span', null, plural(entryCount, 'knowledge entry', 'knowledge entries')),
        data.index ? h(TextButton, { onClick: () => go({ view: 'doc', path: data.index.file }) }, 'Open the index') : null),
      h(Segmented,{label:'Library view',value:tab,onChange:choose,options:tabs.map(([value,label,n])=>({value,label:n===null?label:`${label} (${n})`}))})),
    body);
}

function Shelf({ data, go, words, sort, setSort }) {
  const papers = useMemo(() => {
    const list = data.papers.filter((p) => matches(words, p.key, p.title));
    const by = {
      newest: (a, b) => yearOf(b.key) - yearOf(a.key) || compareKey(b.key, a.key),
      cited: (a, b) => b.usedBy.length - a.usedBy.length || yearOf(b.key) - yearOf(a.key),
      title: (a, b) => String(a.title || a.key).localeCompare(String(b.title || b.key)),
    }[sort];
    return [...list].sort(by);
  }, [data, words, sort]);
  return h('section', { className: 'atlas-section' },
    h('div', { className: 'atlas-toolbar' },
      h('span', { className: 'atlas-label' }, 'Sort'),
      h(Segmented,{label:'Sort papers',value:sort,onChange:k=>{setSort(k);storageSet('library-sort',k);},options:[{value:'newest',label:'Newest'},{value:'cited',label:'Most cited'},{value:'title',label:'Title'}]})),
    papers.length === 0 ? h(Empty, null, data.library ? 'No paper matches.' : 'No papers library was found.') : null,
    h('ul', { className: 'atlas-shelf' }, papers.map((p) => h('li', { key: p.key }, h(PaperRow, { p, go })))));
}

function compareKey(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function PaperRow({ p, go }) {
  const year = yearOf(p.key);
  return h('article', { className: 'atlas-paper' },
    h('div', { className: 'atlas-paper-spine', 'aria-hidden': true }, year || '—'),
    h('div', { className: 'atlas-paper-main' },
      h('button', { type: 'button', className: 'atlas-paper-title', onClick: () => go({ view: 'doc', path: p.pdf || p.map }), disabled: !p.pdf && !p.map }, p.title || p.key),
      h('div', { className: 'atlas-paper-meta' },
        h('span', { className: 'atlas-path' }, p.key),
        p.sections ? h('span', null, plural(p.sections, 'section note')) : null,
        p.versions.length ? h('span', { className: 'atlas-muted' }, p.versions.join(', ')) : null),
      p.usedBy.length ? h(LinkedFrom, { refs: p.usedBy, go, label: 'Cited by' }) : null),
    h('div', { className: 'atlas-paper-actions' },
      p.pdf ? h(Button, { small: true, icon: 'paper', onClick: () => go({ view: 'doc', path: p.pdf }) }, 'Read') : null,
      p.map ? h(Button, { small: true, quiet: true, icon: 'note', onClick: () => go({ view: 'doc', path: p.map }) }, 'Notes') : null));
}

function ByTopic({ data, ov, go, words, navigate }) {
  const papersOf = (id) => data.papers.filter((p) => p.usedBy.some((u) => u.id === id));
  const order = (t) => {
    const slug = topicDirection(ov, t.id);
    const i = ov.directions.findIndex((d) => d.slug === slug);
    return i < 0 ? 99 : i;
  };
  const topics = [...data.byTopic].sort((a, b) => order(a) - order(b) || a.title.localeCompare(b.title));
  const shown = topics.filter((t) => matches(words, t.title, ...papersOf(t.id).map((p) => p.title), ...t.pdfs.map((p) => p.label)));
  if (shown.length === 0) return h(Empty, null, 'No topic cites a paper yet.');
  return h('div', { className: 'atlas-bytopic' }, shown.map((t) => {
    const color = directionColor(ov, topicDirection(ov, t.id));
    const lib = papersOf(t.id);
    const libKeys = new Set(lib.map((p) => p.key));
    const outside = t.arxiv.filter((id) => !libKeys.has(id));
    return h('section', { key: t.id, className: 'atlas-side-block', style: { '--dir': color } },
      h('h2', null, h('span', { className: 'atlas-dot', style: { background: color } }), h(TextButton, { onClick: () => go({ view: 'doc', path: t.file }) }, t.title)),
      h('ul', { className: 'atlas-items' },
        lib.map((p) => h('li', { key: p.key }, h('button', { type: 'button', className: 'atlas-item', onClick: () => go({ view: 'doc', path: p.pdf || p.map }) }, h(Icon, { name: 'paper', size: 15 }), h('span', { className: 'atlas-item-text' }, h('span', { className: 'atlas-item-label' }, p.title || p.key), h('span', { className: 'atlas-item-sub' }, `${p.key} · in the library`))))),
        t.pdfs.map((pdf, i) => h('li', { key: 'pdf' + i }, h('button', { type: 'button', className: 'atlas-item', onClick: () => navigate({ path: pdf.path }) }, h(Icon, { name: 'paper', size: 15 }), h('span', { className: 'atlas-item-text' }, h('span', { className: 'atlas-item-label' }, pdf.label), h('span', { className: 'atlas-item-sub' }, baseName(pdf.path) + ' · in the topic'))))),
        outside.map((id) => h('li', { key: 'ax' + id }, h('button', { type: 'button', className: 'atlas-item', onClick: () => go({ view: 'paper', url: `https://arxiv.org/abs/${id}`, topic: t.file }) }, h(Icon, { name: 'web', size: 15 }), h('span', { className: 'atlas-item-text' }, h('span', { className: 'atlas-item-label' }, 'arXiv ' + id), h('span', { className: 'atlas-item-sub' }, 'cited, not in the library')), h(Icon, { name: 'external', size: 13 }))))));
  }));
}

function KnowledgeIndex({ data, go, words, navigate, flash }) {
  const index = data.index;
  if (!index) return h(Empty, null, 'The knowledge collection has no index.md.');
  return h('div', { className: 'atlas-knowledge' }, index.areas.map((area) => {
    const entries = area.entries.filter((e) => matches(words, e.title, e.kind, e.scope, e.support));
    if (words.length > 0 && entries.length === 0) return null;
    return h('section', { key: area.slug, className: 'atlas-section' },
      h('h2', null, area.heading, entries.length ? h('span', { className: 'atlas-count' }, entries.length) : null),
      h('div', { className: 'atlas-entries' }, entries.map((e, i) => h(EntryRow, { key: i, e, go, navigate, flash }))),
      area.prose && words.length === 0 ? h(Fold, { id: 'knowledge#' + area.slug, title: entries.length ? 'Notes in this section' : 'This section', defaultOpen: entries.length === 0 }, () => h(Markdown, { text: area.prose, baseFile: index.file, onNavigate: navigate })) : null);
  }));
}

function supportDot(support) {
  const s = String(support || '').toLowerCase();
  if (/confirm/.test(s)) return 'var(--status-done)';
  if (/provisional|awaiting|unreviewed|pending|unchecked/.test(s)) return 'var(--status-waiting)';
  return 'var(--status-other)';
}

function EntryRow({ e, go, navigate }) {
  return h('article', { className: 'atlas-entry' },
    h('div', { className: 'atlas-entry-head' },
      e.note ? h(TextButton, { className: 'atlas-entry-title', onClick: () => navigate({ path: e.note }) }, e.title) : h('span', { className: 'atlas-entry-title' }, e.title),
      h('span', { className: 'atlas-entry-tags' },
        e.kind ? h(Chip, null, e.kind) : null,
        e.support ? h(Chip, { dot: supportDot(e.support), title: e.support }, e.support.length > 30 ? e.support.slice(0, 28) + '…' : e.support) : null)),
    e.scope ? h('p', { className: 'atlas-entry-scope' }, e.scope) : null,
    e.pdfs.length > 0 || e.usedBy.length > 0
      ? h('div', { className: 'atlas-entry-foot' },
        e.pdfs.map((p) => h(TextButton, { key: p.id, onClick: () => go({ view: 'doc', path: p.pdf }) }, h(Icon, { name: 'paper', size: 13 }), ' ', p.id)),
        e.usedBy.length > 0 ? h(LinkedFrom, { refs: e.usedBy, go, label: 'used by' }) : null)
      : null);
}
