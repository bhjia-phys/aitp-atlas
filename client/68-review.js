// ------------------------------------------------------------------ review ---
// What changed since this discussion's saved copies (not who made it): each edit with
// the section it sits in, the removed and added words marked, and Keep or
// Revert. Atlas kept a copy of the notes when it started the discussion; the
// server compares against it and only reverts where the note still shows the
// edit.

/** Word-level marks for a changed passage: segments of the old and new text, changed ones flagged. */
function wordDiff(before, after) {
  // A token is a word with the space after it, so that a run of changed words reads as one mark.
  const a = String(before).match(/\S+\s*|\s+/g) || [];
  const b = String(after).match(/\S+\s*|\s+/g) || [];
  if (a.length * b.length > 250000) return { before: [{ text: String(before), changed: true }], after: [{ text: String(after), changed: true }] };
  const dp = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) for (let j = b.length - 1; j >= 0; j -= 1) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const left = [];
  const right = [];
  const add = (list, text, changed) => {
    const last = list[list.length - 1];
    if (last && last.changed === changed) last.text += text;
    else list.push({ text, changed });
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      add(left, a[i], false);
      add(right, b[j], false);
      i += 1;
      j += 1;
    } else if (j < b.length && (i === a.length || dp[i][j + 1] >= dp[i + 1][j])) {
      add(right, b[j], true);
      j += 1;
    } else {
      add(left, a[i], true);
      i += 1;
    }
  }
  return { before: left, after: right };
}

function Marked({ parts, kind }) {
  return parts.map((p, i) => (p.changed ? h(kind, { key: i }, p.text) : h('span', { key: i }, p.text)));
}

function EditCard({ file, edit, busy, shared, onKeep, onRevert }) {
  const marks = useMemo(() => wordDiff(edit.removed.join('\n'), edit.added.join('\n')), [edit.id]);
  return h('div', { className: 'atlas-edit' },
    h('div', { className: 'atlas-edit-where' }, `${baseName(file)} · ${edit.where || `line ${edit.line}`}`),
    edit.removed.length ? h('div', { className: 'atlas-edit-del' }, h('span', { className: 'atlas-edit-sign', 'aria-label': 'removed' }, '−'), h('span', { className: 'atlas-edit-text' }, h(Marked, { parts: marks.before, kind: 'del' }))) : null,
    edit.added.length ? h('div', { className: 'atlas-edit-ins' }, h('span', { className: 'atlas-edit-sign', 'aria-label': 'added' }, '+'), h('span', { className: 'atlas-edit-text' }, h(Marked, { parts: marks.after, kind: 'ins' }))) : null,
    h('div', { className: 'atlas-edit-actions' },
      h(Button, { small: true, disabled: Boolean(busy), onClick: onKeep }, 'Keep'),
      shared ? h('span', { className: 'atlas-muted' }, 'Shared or legacy baseline · inspect the note before changing it')
        : h(Button, { small: true, quiet: true, disabled: Boolean(busy), onClick: onRevert, title: 'Put the earlier text back' }, 'Revert')));
}

function ReviewPanel({ sessionId, running, flash, expectedRoot, verifyOwner }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const load = useCallback(() => api('review/changes', { query: { session: sessionId, expectedRoot } }).then(setData, () => {}), [sessionId, expectedRoot]);
  // Poll more frequently while running; a change can also come from outside this session.
  useEffect(() => {
    load();
    const timer = setInterval(load, running ? 4000 : 15000);
    return () => clearInterval(timer);
  }, [running, load]);
  const files = data ? data.files.filter((f) => f.edits.length) : [];
  const count = files.reduce((n, f) => n + f.edits.length, 0);
  if (!count) return null;
  const act = async (kind, file, id) => {
    setBusy(`${kind}:${id}`);
    try {
      if(expectedRoot) { if(typeof verifyOwner!=='function') throw new Error('Cannot verify this review’s research workspace.'); verifyOwner(); }
      setData(await api(`review/${kind}`, { method: 'POST', query:{expectedRoot}, body: { session: sessionId, path: file, id } },20));
      if (kind === 'revert') flash('Reverted: the earlier text is back in the note.');
      return true;
    } catch (error) {
      flash(error.message);
      load();
      return false;
    } finally {
      setBusy('');
    }
  };
  const keepAll = async () => {
    for (const f of files) if (!await act('keep', f.path, f.keepAllId)) return;
    flash('Kept: the edits stay in the notes.');
  };
  const draft = (text) => {
    if (draftIntoThread(sessionId, text)) flash('It is in the discussion’s input box: send it when ready.');
    else flash('Atlas could not put it into the discussion.');
  };
  const names = files.map((f) => baseName(f.path)).join(', ');
  return h('section', { className: 'atlas-review', 'aria-label': 'Changes since this discussion’s baseline' },
    h('button', { type: 'button', className: 'atlas-review-head', 'aria-expanded': open, onClick: () => setOpen(!open) },
      h('span', null, 'Changes since the baseline'),
      h('span', { className: 'atlas-chip is-new' }, plural(count, 'edit')),
      h('span', { className: 'atlas-review-toggle' }, open ? 'Hide' : 'Show')),
    open ? h('div', { className: 'atlas-review-body' },
      h('p', { className: 'atlas-muted' }, 'Compared with the copies saved for this discussion. These changes are already in the notes; the comparison does not identify who made them. Keep accepts the current text. Revert restores the earlier text.'),
      files.map((f) => f.edits.map((e) => h(EditCard, { key: f.path + e.id, file: f.path, edit: e, busy, shared: f.shared, onKeep: () => act('keep', f.path, e.id), onRevert: () => act('revert', f.path, e.id) }))),
      h('div', { className: 'atlas-review-actions' },
        h(Button, { small: true, primary: true, disabled: Boolean(busy), onClick: keepAll }, count > 1 ? 'Keep all' : 'Keep it'),
        h(Button, { small: true, quiet: true, onClick: () => draft(`Independently review the changes observed in ${names} since this discussion’s baseline. Check each against the work it reports; do not assume who wrote it.`) }, 'Run an independent review'),
        h(Button, { small: true, quiet: true, onClick: () => draft('File the settled result where AITP says it belongs; your edits will appear in Atlas for my review.') }, 'File the settled result'))) : null);
}

/** On a topic page: sessions whose baseline differs from the note. Baselines can overlap. */
function PendingEdits({ path, at }) {
  const actions = React.useContext(AtlasActions);
  const threads = useThreadIndex();
  const { data } = useApi('review/pending', { path }, path, at);
  const list = data ? data.sessions : [];
  if (!list.length) return null;
  return h('div', { className: 'atlas-banner atlas-pending', role: 'status' },
    h(Icon, { name: 'edit' }),
    h('span', null, 'Changes compared with saved baselines:'),
    list.map((s) => {
      const t = threads.find((x) => x.id === s.session);
      return h(TextButton, { key: s.session, onClick: () => actions.openThread(s.session), title: 'Review the comparison in this discussion' }, `${t ? shortTitle(threadLabel(t), 48) : 'Discussion'} · ${plural(s.edits, 'edit')}`);
    }));
}
