// DS-22: this is an explicitly confirmed NEW session, not an in-place move or
// fork. Never retain the source, read its transcript, copy a selection, or
// inspect workspace files. The chosen WorkspaceView is checked again at submit.
function handoffWorkspaceChoices(snapshot, sourceId, currentWorkspaceId) {
  if (snapshot?.phase !== 'ready' || snapshot.state === 'error' || !Array.isArray(snapshot.items)) return [];
  const rows = snapshot.items.filter(w => w && typeof w.workspaceId === 'string' && w.workspaceId && typeof w.path === 'string' && w.path);
  const owners = rows.filter(w => w.sessionIds?.includes(sourceId));
  // WorkspaceView.sessionIds is the service's actual membership projection.
  // Fail closed for an unaccounted session, a stale hint, or ambiguous membership.
  if (owners.length !== 1 || (currentWorkspaceId && currentWorkspaceId !== owners[0].workspaceId)) return [];
  return rows.filter(w => w.workspaceId !== owners[0].workspaceId);
}
function handoffPointerText(record, includeQuestion = false) {
  const line = v => typeof v === 'string' ? v.replace(/[\r\n\t\0]+/g, ' ').trim().slice(0, 1024) : '';
  const t = record.topic, c = record.context || {}, d = c.doc;
  // Only the separately opted-in original question may contain authored text.
  // Heading/page/line labels locate the source; never include transcript or excerpts.
  return ['Atlas discussion hand-off', `Original DSH session: ${line(record.id)}`,
    t?.path ? 'Filed topic: ' + line(t.path) : 'Filed topic: Unfiled',
    d?.path && 'Document: ' + line(d.path), d?.path && c.page && 'Page: ' + line(c.page),
    d?.path && c.section && 'Section: ' + line(c.section), d?.path && c.lines && 'Lines: ' + line(c.lines),
    ...((Array.isArray(c.attachments) ? c.attachments : []).slice(0, 6).map(a => a?.path && 'Reference: ' + line(a.path))),
    includeQuestion === true && typeof record.question === 'string' && record.question.trim() && 'Original question: ' + record.question.trim(),
    'For prior history, use session_event_search and session_event_read with the original session ID only if authorized for that workspace. If access is unavailable, ask the researcher for context. Files and permissions were not transferred.'
  ].filter(Boolean).join('\n');
}

async function handoffDiscussion({ record, targetId, currentWorkspaceId, confirmed, includeQuestion = false, workspaces, sessions, createRecord, patchRecord }) {
  if (!record?.id || record.movedTo) throw new Error('This discussion is missing or already has a continuation.');
  if (confirmed !== true || !targetId) throw new Error('Choose another workspace and confirm the hand-off.');
  if (typeof workspaces?.list?.getSnapshot !== 'function' || typeof sessions?.create !== 'function' || typeof sessions?.retain !== 'function') throw new Error('This DSH version cannot create a session in another workspace.');
  const targets = handoffWorkspaceChoices(workspaces.list.getSnapshot(), record.id, currentWorkspaceId);
  if (!targets.some(w => w.workspaceId === targetId)) throw new Error('The chosen destination is no longer available, or the source workspace is unknown.');
  const prompt = handoffPointerText(record, includeQuestion);
  const id = await sessions.create({ workspaceId: targetId }); // Never send a cwd or reuse a named session.
  if (typeof id !== 'string' || !id || id === record.id) throw new Error('DSH did not return a new session. Nothing was sent.');
  let attempted = false;
  try {
    // A generated source title can itself quote the question. Do not leak it via rename.
    const title = 'Continuation of session ' + record.id;
    // Durable link before any send: reopening or losing the connection must
    // never replay a hand-off. An incomplete session is recoverable by its id.
    await patchRecord(record.id, { movedTo: id });
    await createRecord({ id, title, topic: null, filing: 'none', context: {}, origin: 'ask', question: '' });
    const ref = sessions.retain(id, { source: 'atlas' });
    try {
      const session = (await ref.ready)?.session;
      if (typeof session?.prompt !== 'function') throw new Error('The new session cannot accept prompts.');
      if (typeof session.rename === 'function') await Promise.resolve(session.rename(title)).catch(() => {});
      attempted = true;
      const result = await session.prompt([{ type:'text', text:prompt }], 'queue');
      if (result?.ok === false) throw new Error(result.error?.message || 'DSH refused the hand-off.');
    } finally { ref.release(); }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw Object.assign(new Error(`DSH created session ${id}. ${attempted ? 'Delivery was not confirmed; check its conversation before sending anything again.' : 'No hand-off was sent.'} ${detail}`), { sessionId: id });
  }
  return id;
}

function DiscussionHandoffDialog({ record, currentWorkspaceId, onOpen, onClose, flash }) {
  const workspaces = svc('workspaces'), sessions = svc('sessions');
  const snap = useAtlasCatalog(workspaces?.list);
  const targets = handoffWorkspaceChoices(snap, record?.id, currentWorkspaceId);
  const [selected, setSelected] = useState(''); // Deliberately no preselected destination.
  const [includeQuestion, setIncludeQuestion] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [partial, setPartial] = useState('');
  const doing = useRef(false), live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const available = typeof sessions?.create === 'function' && typeof sessions?.retain === 'function';
  const chosen = targets.some(w => w.workspaceId === selected);
  const close = () => { if (!doing.current) onClose(); };
  const submit = async () => {
    if (doing.current || partial || record?.movedTo || !chosen || !available) return;
    doing.current = true; setBusy(true); setError('');
    try {
      const fresh = registryGet(record.id);
      if (!fresh) throw new Error('The original Atlas record is no longer available.');
      const id = await handoffDiscussion({ record:fresh, currentWorkspaceId, targetId:selected, confirmed:true, includeQuestion, workspaces, sessions, createRecord:registryCreate, patchRecord:registryPatch });
      if (live.current) { flash?.('Hand-off sent to the new workspace.'); onClose(); onOpen?.(id); }
    } catch (e) { if (live.current) { setError(e.message); if (e.sessionId) setPartial(e.sessionId); } }
    finally { doing.current = false; if (live.current) setBusy(false); }
  };
  const existing = partial || record?.movedTo;
  return h(Dialog, { title: 'Continue in another workspace', onClose: close,
    footer: h(React.Fragment, null, h(Button, { onClick: close, disabled:busy }, 'Cancel'), existing
      ? h(Button, { primary:true, onClick: () => { onClose(); onOpen?.(existing); } }, 'Open continuation')
      : h(Button, { primary:true, disabled:busy || !chosen || !available, onClick:submit }, busy ? 'Starting…' : 'Create and send hand-off')) },
    h('p', null, 'The original session stays here. The new session receives only the source session ID, research pointers, and your question if you choose to include it. The transcript stays here.'),
    !existing && available && targets.length > 0 && h('label', null, 'Destination workspace', h('select', { className:'atlas-control-select', value:selected, disabled:busy, onChange:e=>setSelected(e.target.value) },
      h('option', {value:''}, 'Choose a workspace…'), targets.map(w=>h('option',{key:w.workspaceId,value:w.workspaceId}, `${w.title || 'Workspace'} — ${w.path}`)))),
    existing && !partial && h('p', null, 'This discussion already has a continuation.'),
    !existing && (!available || !targets.length) && h('p', { role:'status' }, !available ? 'DSH session creation is unavailable.' : snap?.phase === 'pending' ? 'Loading DSH workspaces…' : 'No other registered workspace is available, or the source workspace could not be verified.'),
    !existing && record?.question && h('label', null, h('input', { type:'checkbox', checked:includeQuestion, disabled:busy, onChange:e=>setIncludeQuestion(e.target.checked) }), ' Include the original question'),
    !existing && record?.question && h('details', null, h('summary', null, 'Preview the original question'), h('p', null, record.question)),
    !existing && chosen && h('details', null, h('summary', null, 'Preview the hand-off'), h('pre', null, handoffPointerText(record, includeQuestion))),
    error && h('p', { role:'alert' }, error));
}
