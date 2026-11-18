// ------------------------------------------------------------------ topic ---
// One topic as a workspace: what the root says, the opening, Current work as a
// timeline, the account, and everything the note cites, sorted by kind.

/** Links inside notes: what Atlas can show opens in a tab of its own (a link), the rest with the system's app. */
function useNavigate(go, flash) {
  const pane = usePaneName();
  return useCallback(({ path, anchor, url }) => {
    // A paper's web address: read it in a tab, offered for the topic in view.
    if (url) {
      const focus = paneFocus(focusStore.get(), pane);
      go({ view: 'paper', url, topic: focus.topic ? focus.topic.path : '' });
      return;
    }
    if (!path) return;
    if (READ_HERE.has(typeOf(path))) go({ view: 'doc', path, anchor, link: true });
    else openFile(path).then(() => flash('Opened with the system app.')).catch((error) => flash(error.message));
  }, [go, flash, pane]);
}

/** The opening (before the first `##`) and the `##` sections of a note. */
function splitNote(body) {
  const out = { opening: [], sections: [] };
  let current = null;
  let fence = false;
  let titled = false;
  for (const line of String(body || '').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const heading = !fence && /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      current = { heading: heading[1].replace(/<[^>]+>/g, '').replace(/\*\*|`/g, '').trim(), lines: [] };
      out.sections.push(current);
      continue;
    }
    if (!current && !titled && !fence && /^#\s/.test(line)) {
      titled = true;
      continue;
    }
    (current ? current.lines : out.opening).push(line);
  }
  return {
    opening: out.opening.join('\n').trim(),
    sections: out.sections.map((s, i) => ({ heading: s.heading, key: i + ':' + s.heading, index: i, text: s.lines.join('\n').trim() })),
  };
}

// Limit each group independently; collapsing one does not throw away the remaining records.
function TopicShelf({ id, title, icon, items, renderItem, defaultOpen = true, empty, footer, hint }) {
  const [all, setAll] = useState(false);
  return h(Fold, { id, title, icon, count: items.length, defaultOpen }, () => h(React.Fragment, null,
    hint ? h('p', { className: 'atlas-shelf-hint' }, hint) : null,
    items.length ? h('ul', { className: 'atlas-items' }, (all ? items : items.slice(0, 5)).map((item, i) => h('li', { key: item.id || item.key || `${i}:${item.path || item.url || ''}` }, renderItem(item)))) : empty,
    items.length > 5 ? h('button', { type: 'button', className: 'atlas-shelf-more', 'aria-expanded': all, 'aria-label': all ? `Show fewer: ${title}` : `Show all ${items.length}: ${title}`, onClick: () => setAll(!all) }, all ? 'Show fewer' : `Show all (${items.length})`) : null,
    footer));
}

// Current filing lives in the registry. The initial context is historical and
// must not make a moved discussion appear under its previous topic.
function TopicDiscussionShelf({ file }) {
  const actions = React.useContext(AtlasActions);
  const threads = useThreadIndex();
  const rows = useSessionRows();
  const list = threads.filter((t) => t.kind !== 'team' && t.topic?.path && pathKey(t.topic.path) === pathKey(file) && knownThread(rows, t))
    .sort((a, b) => Number(a.status === 'resolved') - Number(b.status === 'resolved') || b.created - a.created);
  return h(TopicShelf, { id: `${file}#discussions`, title: 'Discussions', icon: 'spark', items: list,
    hint: 'Filed to this topic in the workspace discussion registry.',
    empty: h(Empty, null, 'No discussions about this topic yet.'),
    renderItem: (t) => h(React.Fragment, null, h(ThreadRow, { t, row: rowOf(rows, t.id), current: actions.current === t.id, onOpen: () => actions.openThread(t.id) }), t.status === 'resolved' ? h('span', { className: 'atlas-shelf-hint' }, 'Resolved') : null),
    footer: h(Button, { small: true, icon: 'spark', onClick: () => actions.startAsk({}) }, 'Ask about this topic') });
}

function TopicWorkspace({ data, ov, go, flash, navigate, anchor, anchorAt }) {
  const t = data.topic, actions = React.useContext(AtlasActions);
  const discuss = () => actions.ask(focusContext({ topic: { id: t.id, title: t.title || 'Root note', path: data.path } }), 'ask', 'Discuss this topic.', '', { targetId: 'new', origin: 'topic' });
  const parts = useMemo(() => splitNote(data.body), [data.body]);
  const account = parts.sections.filter((s) => !/^current work/i.test(s.heading));
  const [reveal, setReveal] = useState({ key: '', n: 0 });
  // Section ids are per tab: the same topic can be open as the page and in a tab beside it.
  const tabId = usePaneName();
  const sec = tabId === 'page' ? 'atlas-sec-' : `atlas-${tabId.replace(/[^\w-]/g, '-')}-sec-`;
  // A link to a section of this note: the opening, Current work, or an account fold opened and scrolled to.
  useEffect(() => {
    if (!anchor) return undefined;
    const target = anchorTarget(data.body, anchor);
    if (!target) return undefined;
    const section = target.section >= 0 ? parts.sections[target.section] : null;
    if (section && !/^current work/i.test(section.heading)) setReveal((r) => ({ key: section.key, n: r.n + 1 }));
    const timer = setTimeout(() => {
      if (!section) return revealElement(document.getElementById(sec + 'opening'));
      if (/^current work/i.test(section.heading)) return revealElement(document.getElementById(sec + 'current'));
      const box = document.getElementById(sec + section.index);
      const inner = target.sub > 0 && box ? nthHeading(box.querySelector('.atlas-fold-body'), target.sub - 1) : null;
      return revealElement(inner || box);
    }, 140);
    return () => clearTimeout(timer);
  }, [anchor, anchorAt, data.body, parts, sec]);
  const dirSlug = t.directionSlug || topicDirection(ov, t.id);
  const color = t.isRoot ? 'var(--gold)' : directionColor(ov, dirSlug);
  const [creating, setCreating] = useState(false);
  usePublishFocus({ kind: 'topic', topic: { id: t.id, title: t.title || 'Root note', path: data.path } }, [data.path, t.title]);
  const crumbs = [{ label: 'Desk', go: { view: 'home' } }];
  if (t.directionHeading) crumbs.push({ label: t.directionHeading.replace(/^\d+\.\s*/, ''), dot: color, go: { view: 'map', anchor: dirSlug } });
  for (const a of t.ancestors.filter((a) => a.id !== '')) crumbs.push({ label: shortTitle(a.title, 34), go: { view: 'doc', path: a.file } });
  crumbs.push({ label: t.isRoot ? 'Root note' : shortTitle(t.title, 40) });
  const counts = t.counts || {};
  const facts = [
    t.threads.length ? plural(t.threads.length, 'Current work entry', 'Current work entries') : null,
    t.children.length ? plural(t.children.length, 'branch', 'branches') : null,
    counts.notes ? plural(counts.notes, 'note') : null,
    counts.papers ? plural(counts.papers, 'paper or source', 'papers and sources') : null,
  ].filter(Boolean);
  const groups = (t.contents || []).filter((g) => g.key !== 'branches');
  const incoming = data.linkedFrom.filter((r) => !t.children.some((c) => c.id === r.id));
  return h('div', { className: 'atlas-page is-wide atlas-topic', style: { '--dir': color } },
    h(Crumbs, { items: crumbs, go }),
    h('header', { className: 'atlas-topic-head' },
      h('p', { className: 'atlas-kicker' }, t.isRoot ? 'Root note' : t.ancestors.length > 1 ? 'Branch' : 'Topic'),
      h('h1', null, t.title),
      h('div', { className: 'atlas-meta' },
        h('span', { className: 'atlas-path' }, data.shown),
        h('span', { className: 'atlas-date' }, 'changed ' + dateOf(data.mtimeMs)),
        facts.map((f) => h('span', { key: f, className: 'atlas-meta-fact' }, f)),
        t.reached ? null : h(Chip, { dot: 'var(--status-waiting)', title: 'No link from the root or a parent note reaches this note' }, 'not linked')),
      h('div', { className: 'atlas-actions' },
        h(Button, { primary: true, icon: 'chat', onClick: discuss }, 'Discuss'),
        h(Button, { icon: 'team', disabled: !actions.startTeam, title: actions.startTeam ? 'Start a team for this topic' : 'Native team setup arrives in M3.', onClick: () => actions.startTeam?.({ topic: t.id }) }, 'Start a team'),
        data.editable ? h(Button, { icon: 'edit', onClick: () => go({ view: 'doc', path: data.path, edit: true }) }, 'Edit note') : null,
        h(Button, { icon: 'plus', onClick: () => setCreating(!creating) }, 'New note'),
        h(Button, { icon: 'folder', quiet: true, 'data-atlas-open': true, onClick: () => go({ view: 'doc', path: dirOf(data.path) }) }, 'Folder')),
      creating ? h(NewNote, { dir: dirOf(data.path), go, flash, onClose: () => setCreating(false) }) : null),
    t.context ? h('blockquote', { className: 'atlas-context' }, h('span', { className: 'atlas-label' }, 'The root says'), h('span', null, t.context)) : null,
    h(PendingEdits, { path: data.path, at: data.mtimeMs }),
    h('div', { className: 'atlas-topic-grid' },
      h('main', { className: 'atlas-topic-main' },
        parts.opening ? h('section', { className: 'atlas-opening', id: sec + 'opening' }, h(Markdown, { text: parts.opening, baseFile: data.path, onNavigate: navigate })) : null,
        h(ThreadList, { threads: t.threads, baseFile: data.path, navigate, domId: sec + 'current' }),
        account.length > 0
          ? h('section', { className: 'atlas-section' },
            h('h2', null, 'The account', h('span', { className: 'atlas-count' }, plural(account.length, 'section'))),
            account.map((s) => h(Fold, { key: s.key, id: data.path + '#' + s.key, domId: sec + s.index, reveal: reveal.key === s.key ? reveal.n : 0, title: s.heading }, () => h(Markdown, { text: s.text, baseFile: data.path, onNavigate: navigate }))))
          : null),
      h('aside', { className: 'atlas-topic-side', 'aria-label': 'What this topic holds' },
        h(TopicDiscussionShelf, { key: data.path, file: data.path }),
        t.children.length ? h(TopicShelf, { key: `${data.path}#branches`, id: `${data.path}#branches`, title: 'Branches', icon: 'branch', items: t.children,
          renderItem: (c) => h('button', { type: 'button', className: 'atlas-branch', 'data-atlas-open': true, onClick: () => go({ view: 'doc', path: c.file }) },
            h('span', { className: 'atlas-branch-title' }, c.title),
            c.latest ? h('span', { className: 'atlas-branch-latest' }, c.latest.status ? h(StatusTag, { status: c.latest.status }) : null, h('span', null, c.latest.name)) : c.lead ? h('span', { className: 'atlas-branch-latest' }, c.lead) : null,
            h('span', { className: 'atlas-date' }, c.date)) }) : null,
        h(TopicShelf, { key: `${data.path}#contents`, id: `${data.path}#contents`, title: 'Contents', icon: 'library', items: groups,
          empty: h(Empty, null, 'This note links no files yet.'),
          renderItem: (g) => h(TopicShelf, { id: `${data.path}#contents:${g.key}`, title: g.title, items: g.items, icon: GROUP_ICON[g.key],
            defaultOpen: g.items.length <= 8 && ['notes', 'papers', 'writing'].includes(g.key), renderItem: (item) => h(ContentItem, { item, navigate }) }) }),
        incoming.length ? h(TopicShelf, { key: `${data.path}#incoming`, id: `${data.path}#incoming`, title: 'Linked from', icon: 'note', items: incoming,
          renderItem: (r) => h('button', { type: 'button', className: 'atlas-item', 'data-atlas-open': true, onClick: () => go({ view: 'doc', path: r.file }) }, r.title) }) : null)));
}

function ContentItem({ item, navigate }) {
  const missing = item.exists === false;
  const onClick = () => {
    if (item.url) {
      if (paperLink(item.url)) navigate({ url: item.url });
      else window.open(item.url, '_blank', 'noopener');
    }
    else if (!missing) navigate({ path: item.path, anchor: item.anchor });
  };
  return h('button', { type: 'button', 'data-atlas-open': !missing && (item.url ? paperLink(item.url) : READ_HERE.has(typeOf(item.path))) || undefined, className: cx('atlas-item', missing && 'is-missing'), onClick, disabled: missing, title: item.url || item.path },
    h(Icon, { name: TYPE_ICON[item.type] || 'note', size: 15 }),
    h('span', { className: 'atlas-item-text' },
      h('span', { className: 'atlas-item-label' }, item.label),
      h('span', { className: 'atlas-item-sub' }, item.shown, item.section ? ` · § ${item.section}` : '', item.count > 1 ? ` · cited ${item.count}×` : '')),
    missing ? h(Chip, { dot: 'var(--status-blocked)' }, 'missing') : item.url ? h(Icon, { name: 'external', size: 13 }) : null);
}

/** Current work entries, newest first, as a timeline: thread, status, date, then the entry as written. */
function ThreadList({ threads, baseFile, navigate, bare, domId }) {
  if (!threads || threads.length === 0) return null;
  const list = h('ol', { className: 'atlas-timeline' }, threads.map((th, i) => h('li', { key: i, className: 'atlas-thread' },
    h('span', { className: 'atlas-thread-node', 'aria-hidden': true }),
    h('div', { className: 'atlas-thread-head' },
      h('span', { className: 'atlas-thread-name' }, th.name || 'Entry'),
      th.status ? h(StatusTag, { status: th.status }) : null,
      th.owner ? h(TextButton, { onClick: () => navigate({ path: th.owner }), title: 'The note that owns this thread' }, 'owner →') : null,
      h('span', { className: 'atlas-date' }, th.date)),
    h(Markdown, { text: entryBody(th), baseFile, onNavigate: navigate, compact: true }))));
  return bare ? list : h('section', { className: 'atlas-section', id: domId }, h('h2', null, 'Current work', h('span', { className: 'atlas-count' }, threads.length)), list);
}

/** The entry without what its header shows: the bold lead and a leading "status · date". */
function entryBody(th) {
  let text = String(th.markdown || '').replace(/^\*\*[\s\S]+?\*\*\s*/, '').replace(/^[—–:-]+\s*/, '');
  if (th.status) text = text.replace(/^[^·\n]{1,40}?\s*·\s*20\d\d-\d\d-\d\d[.:;,]?\s*/, '');
  return text;
}

const TEMPLATES = {
  md: (title) => `# ${title}\n\n`,
  tex: (title) => `\\documentclass[11pt]{article}\n\\usepackage{amsmath,amssymb,amsthm}\n\\usepackage[margin=1in]{geometry}\n\\usepackage{hyperref}\n\n\\title{${title}}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\n\\section{Introduction}\n\n\n\\end{document}\n`,
};

/** Create a note or LaTeX file in a topic's folder, then open it in the editor. */
function NewNote({ dir, go, flash, onClose }) {
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('notes');
  const [kind, setKind] = useState('md');
  const [busy, setBusy] = useState(false);
  const slug = noteSlug(title);
  const target = slug ? joinPath(dir, `${folder.replace(/^[\\/]+|[\\/]+$/g, '') || '.'}/${slug}.${kind}`) : '';
  const create = async (event) => {
    event.preventDefault();
    if (!target) return;
    setBusy(true);
    try {
      await api('save', { method: 'POST', body: { path: target, text: TEMPLATES[kind](title.trim()), create: true } });
      onClose();
      go({ view: 'doc', path: target, edit: true, created: true, full: kind === 'tex' });
    } catch (error) {
      flash(error.message);
    } finally {
      setBusy(false);
    }
  };
  return h('form', { className: 'atlas-newnote', onSubmit: create },
    h('label', null, h('span', null, 'Title'), h(Input, { className: 'atlas-input', value: title, onChange: (e) => setTitle(e.target.value), placeholder: 'e.g. Spectral flow and the edge anomaly', autoFocus: true })),
    h('label', null, h('span', null, 'Folder'), h(Input, { className: 'atlas-input', value: folder, onChange: (e) => setFolder(e.target.value) })),
    h(Segmented, { label: 'Kind', value: kind, onChange: setKind, options: [{ value: 'md', label: 'Markdown note' }, { value: 'tex', label: 'LaTeX' }] }),
    h('div', { className: 'atlas-newnote-foot' },
      h('span', { className: 'atlas-path' }, target ? target.slice(dir.length + 1) : 'Name the note to see its path'),
      h(Button, { quiet: true, onClick: onClose }, 'Cancel'),
      h(Button, { type: 'submit', primary: true, disabled: busy || !target }, busy ? 'Creating…' : 'Create and edit')));
}
