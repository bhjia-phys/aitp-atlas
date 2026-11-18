// ------------------------------------------------------------------ topic ---
// One topic as a workspace: what the root says, the opening, Current work as a
// timeline, the account, and everything the note cites, sorted by kind.

/** Links inside notes: what Atlas can show opens beside the page (a link), the rest with the system's app. */
function useNavigate(go, flash) {
  const pane = usePaneName();
  return useCallback(({ path, anchor, url }) => {
    // A paper's web address: read it beside the page, offered for the topic in view.
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

function TopicWorkspace({ data, ov, go, flash, navigate, anchor, anchorAt }) {
  const t = data.topic;
  const parts = useMemo(() => splitNote(data.body), [data.body]);
  const account = parts.sections.filter((s) => !/^current work/i.test(s.heading));
  const [reveal, setReveal] = useState({ key: '', n: 0 });
  // Section ids are per pane: the same topic can be open as the page and beside it.
  const sec = usePaneName() === 'side' ? 'atlas-side-sec-' : 'atlas-sec-';
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
  const crumbs = [{ label: 'Universe', go: { view: 'home' } }];
  if (t.directionHeading) crumbs.push({ label: t.directionHeading.replace(/^\d+\.\s*/, ''), dot: color, go: { view: 'home', anchor: dirSlug } });
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
        h(AskMenu, { asks: t.isRoot ? [{ key: 'continue', label: 'Continue the research', hint: 'Resume the authorized task', prompt: 'Continue the research.' }] : topicAsks() }),
        data.editable ? h(Button, { icon: 'edit', onClick: () => go({ view: 'doc', path: data.path, edit: true }) }, 'Edit note') : null,
        h(Button, { icon: 'plus', onClick: () => setCreating(!creating) }, 'New note'),
        h(Button, { icon: 'folder', quiet: true, onClick: () => go({ view: 'doc', path: dirOf(data.path) }) }, 'Folder')),
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
        h(Discussions, { match: (d) => Boolean(d.context.topic && d.context.topic.path === data.path) }),
        t.children.length > 0
          ? h('section', { className: 'atlas-side-block' },
            h('h2', null, h(Icon, { name: 'branch' }), 'Branches', h('span', { className: 'atlas-count' }, t.children.length)),
            t.children.map((c) => h('button', { key: c.id, type: 'button', className: 'atlas-branch', onClick: () => go({ view: 'doc', path: c.file }) },
              h('span', { className: 'atlas-branch-title' }, c.title),
              c.latest ? h('span', { className: 'atlas-branch-latest' }, c.latest.status ? h(StatusTag, { status: c.latest.status }) : null, h('span', null, c.latest.name)) : c.lead ? h('span', { className: 'atlas-branch-latest' }, c.lead) : null,
              h('span', { className: 'atlas-date' }, c.date))))
          : null,
        h('section', { className: 'atlas-side-block' },
          h('h2', null, h(Icon, { name: 'library' }), 'Contents'),
          groups.length === 0 ? h(Empty, null, 'This note links no files yet.') : null,
          groups.map((g) => h(Fold, { key: g.key, id: data.path + '#contents:' + g.key, title: g.title, count: g.items.length, icon: GROUP_ICON[g.key], defaultOpen: g.items.length <= 8 && ['notes', 'papers', 'writing'].includes(g.key) },
            () => h('ul', { className: 'atlas-items' }, g.items.map((item, i) => h('li', { key: i }, h(ContentItem, { item, go, navigate }))))))),
        h(LinkedFrom, { refs: data.linkedFrom.filter((r) => !t.children.some((c) => c.id === r.id)), go }))));
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
  return h('button', { type: 'button', className: cx('atlas-item', missing && 'is-missing'), onClick, disabled: missing, title: item.url || item.path },
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
    h('label', null, h('span', null, 'Title'), h('input', { className: 'atlas-input', value: title, onChange: (e) => setTitle(e.target.value), placeholder: 'e.g. Spectral flow and the edge anomaly', autoFocus: true })),
    h('label', null, h('span', null, 'Folder'), h('input', { className: 'atlas-input', value: folder, onChange: (e) => setFolder(e.target.value) })),
    h('div', { className: 'atlas-seg', role: 'radiogroup', 'aria-label': 'Kind' },
      [['md', 'Markdown note'], ['tex', 'LaTeX']].map(([k, label]) => h('button', { key: k, type: 'button', role: 'radio', 'aria-checked': kind === k, className: cx('atlas-seg-item', kind === k && 'is-on'), onClick: () => setKind(k) }, label))),
    h('div', { className: 'atlas-newnote-foot' },
      h('span', { className: 'atlas-path' }, target ? target.slice(dir.length + 1) : 'Name the note to see its path'),
      h(Button, { quiet: true, onClick: onClose }, 'Cancel'),
      h('button', { type: 'submit', className: 'atlas-button is-primary', disabled: busy || !target }, busy ? 'Creating…' : 'Create and edit')));
}
