// ---------------------------------------------------------------- threads ---
// A discussion is a real DSH session about one thing in the research: a topic,
// a note, a PDF page or a passage. Atlas starts it in the background, names it,
// and shows DSH's own conversation (transcript, input box, approvals) in the
// companion pane beside what you are reading. The session's first message says
// what it is about; Atlas only keeps a small index to list discussions by topic.

/** The props DSH gives Atlas's main slot (SessionProvider, renderSlot), for nested components. */
const SlotKit = React.createContext({});
/** What views can do with the AI; the shell provides it. */
const AtlasActions = React.createContext({ ask() {}, openThread() {}, startAsk() {}, addToThread() {}, current: null });
const CONVERSATION_SLOT = 'atlas.companion.conversation';

function svc(name) {
  try {
    return pluginCtx && pluginCtx.get ? pluginCtx.get(name) : undefined;
  } catch {
    return undefined;
  }
}

function externalStore(initial, key) {
  const store = { value: key ? storageGet(key, initial) : initial, listeners: new Set() };
  store.set = (next) => {
    store.value = next;
    if (key) storageSet(key, next);
    for (const listener of [...store.listeners]) listener();
  };
  store.subscribe = (listener) => {
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
  };
  store.get = () => store.value;
  return store;
}

// The discussion index and the view in focus.
const threadStore = externalStore([], 'threads');
const focusStore = externalStore({ kind: 'universe' });

function useThreadIndex() {
  return React.useSyncExternalStore(threadStore.subscribe, threadStore.get);
}

function useFocus() {
  return React.useSyncExternalStore(focusStore.subscribe, focusStore.get);
}

/** Views say what they show; the ask bar, the chips and Ctrl+J read it. */
function usePublishFocus(value, deps) {
  useEffect(() => {
    focusStore.set(value);
  }, deps);
}

function patchThread(id, patch) {
  threadStore.set(threadStore.get().map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

/** DSH's live session list: running state and titles. */
function useSessionRows() {
  const sessions = svc('sessions');
  const list = sessions && sessions.list;
  const subscribe = useCallback((listener) => (list && list.subscribe ? list.subscribe(listener) : () => {}), [list]);
  const get = useCallback(() => (list && list.getSnapshot ? list.getSnapshot() : null), [list]);
  return React.useSyncExternalStore(subscribe, get);
}

function rowOf(rows, id) {
  return rows && rows.byId ? rows.byId[id] : undefined;
}

/** A discussion DSH no longer knows (deleted there) drops out of Atlas's lists. */
function knownThread(rows, t) {
  return !(rows && rows.phase === 'ready' && rows.byId && !rows.byId[t.id]);
}

// --------------------------------------------------------------- context ---

const INTENTS = {
  ask: { label: 'Ask', icon: 'spark' },
  explain: { label: 'Explain', icon: 'knowledge', text: 'Explain this to me step by step, at my level; show the derivation where it helps.' },
  derive: { label: 'Derive', icon: 'writing', text: 'Derive this step by step, stating each assumption where it is used, and check a limiting case.' },
  check: { label: 'Check', icon: 'report', text: 'Check this: is it correct as stated? Rederive or recompute the decisive step and say exactly what holds.' },
  papers: { label: 'Papers', icon: 'paper', text: 'Where is this established in the literature? Start from my library and knowledge collection, and say what each source shows.' },
  task: { label: 'Make a task', icon: 'plus', text: 'Turn this into a concrete research task: what to compute or prove, the first step, and what would settle it. Propose it and wait for my agreement before starting.' },
};
const INTENT_ORDER = ['ask', 'explain', 'derive', 'check', 'papers', 'task'];

/** The context of what is in focus, plus what a selection adds. */
function focusContext(focus, extra = {}) {
  return {
    topic: focus.topic || null,
    doc: focus.doc || null,
    page: extra.page || focus.page || '',
    section: extra.section || '',
    lines: extra.lines || '',
    selection: extra.selection || '',
  };
}

function docIsTopic(c) {
  return Boolean(c.doc && c.topic && c.doc.path === c.topic.path);
}

/** The block that opens a discussion: pointers and the selected passage, never whole files. */
function contextBlock(c) {
  const lines = ['Atlas context (what I am looking at):'];
  if (c.topic) lines.push(`- Topic: ${c.topic.title} — ${c.topic.path}`);
  if (c.doc && !docIsTopic(c)) lines.push(`- ${TYPE_LABEL[c.doc.type] || 'Document'}: ${c.doc.title || baseName(c.doc.path)} — ${c.doc.path}`);
  if (c.section) lines.push(`- Section: ${c.section}`);
  if (c.lines) lines.push(`- Lines: ${c.lines}`);
  if (c.page) lines.push(`- Page: ${c.page}`);
  if (c.selection) {
    lines.push('- Selected passage:');
    for (const line of String(c.selection).split('\n').slice(0, 80)) lines.push(`  > ${line}`);
  }
  if (lines.length === 1) lines.push('- The research programme as a whole.');
  return lines.join('\n');
}

/** The labels shown with a discussion: exactly what it was given. */
function chipsOf(c) {
  const chips = [];
  if (c.topic) chips.push({ label: c.topic.id === '' ? 'Root' : 'Topic', text: shortTitle(c.topic.title, 30), title: c.topic.path });
  if (c.doc && !docIsTopic(c)) chips.push({ label: TYPE_LABEL[c.doc.type] || 'Document', text: shortTitle(c.doc.title || baseName(c.doc.path), 30), title: c.doc.path });
  if (c.section) chips.push({ label: '§', text: shortTitle(c.section, 34), title: c.section });
  if (c.lines) chips.push({ label: 'Lines', text: c.lines });
  if (c.page) chips.push({ label: 'Page', text: c.page });
  if (c.selection) chips.push({ label: 'Passage', text: shortTitle(c.selection.replace(/\s+/g, ' '), 38), title: c.selection, accent: true });
  return chips;
}

function ContextChips({ context, label }) {
  const chips = chipsOf(context);
  if (chips.length === 0) chips.push({ label: 'Scope', text: 'the whole research' });
  return h('div', { className: 'atlas-chips', 'aria-label': label || 'What the AI is given' },
    chips.map((c, i) => h('span', { key: i, className: cx('atlas-ctx', c.accent && 'is-accent'), title: c.title || c.text },
      h('span', { className: 'atlas-ctx-label' }, c.label), h('span', { className: 'atlas-ctx-text' }, c.text))));
}

function anchorName(c) {
  if (c.selection) return `“${shortTitle(c.selection.replace(/\s+/g, ' '), 30)}”`;
  if (c.section) return c.section;
  if (c.page && c.doc) return `page ${c.page}`;
  if (c.doc && !docIsTopic(c)) return c.doc.title || baseName(c.doc.path);
  if (c.topic) return c.topic.title;
  return 'the research';
}

function askText(intent, question) {
  const kind = INTENTS[intent] || INTENTS.ask;
  const asked = String(question || '').trim();
  return intent === 'ask' || !kind.text ? asked : kind.text + (asked ? `\n\n${asked}` : '');
}

/** The first message of a discussion: the context block, then the question. */
function promptOf(context, intent, question) {
  return `${contextBlock(context)}\n\n${askText(intent, question)}`;
}

function threadTitle(context, intent, question, label) {
  const kind = INTENTS[intent] || INTENTS.ask;
  const topic = context.topic ? shortTitle(context.topic.title, 24) : 'Research';
  const what = label || (intent === 'ask' ? String(question || '').trim() : `${kind.label} ${anchorName(context)}`);
  return `Atlas · ${topic} · ${shortTitle(what.replace(/\s+/g, ' '), 52)}`;
}

/**
 * Start a discussion: a DSH session in the research workspace, titled, opened
 * with the context and the question. `onCreated` fires as soon as the session
 * exists, so the companion can show it while the first message is sent.
 */
async function startThread({ root, context, intent, question, label, onCreated }) {
  const sessions = svc('sessions');
  const workspaces = svc('workspaces');
  if (!sessions || typeof sessions.create !== 'function' || typeof sessions.retain !== 'function') {
    const error = new Error('This DSH version cannot hold a discussion inside Atlas.');
    error.fallback = true;
    throw error;
  }
  let workspaceId;
  if (workspaces && typeof workspaces.create === 'function') {
    const workspace = await workspaces.create({ path: root });
    workspaceId = workspace && (workspace.id || workspace.workspaceId);
  }
  const id = await sessions.create(workspaceId ? { workspaceId } : { cwd: root });
  await keepBaseline(id, context);
  const title = threadTitle(context, intent, question, label);
  const record = { id, title, created: Date.now(), status: 'open', intent, label: label || '', question: intent === 'ask' ? String(question || '').trim() : '', context };
  threadStore.set([...threadStore.get().filter((t) => t.id !== id), record].slice(-400));
  if (onCreated) onCreated(record);
  const reference = sessions.retain(id, { source: 'atlas' });
  try {
    const binding = await reference.ready;
    const session = (binding && binding.session) || ((sessions.binding && sessions.binding(id)) || {}).session;
    if (!session) throw new Error('DSH did not open the new discussion.');
    if (typeof session.rename === 'function') await Promise.resolve(session.rename(title)).catch(() => {});
    const result = await session.prompt([{ type: 'text', text: promptOf(context, intent, question) }], 'queue');
    if (result && result.ok === false) throw new Error((result.error && result.error.message) || 'DSH did not accept the question.');
  } finally {
    reference.release();
  }
  return record;
}

/** Copies of the notes a discussion is about, so that its edits can be reviewed (the server widens a topic note to its parent and branches). */
async function keepBaseline(session, context) {
  const files = [context.topic && context.topic.path, context.doc && /\.(md|tex|bib)$/i.test(context.doc.path) ? context.doc.path : ''].filter(Boolean);
  if (!files.length) return;
  try {
    await api('review/baseline', { method: 'POST', body: { session, files } });
  } catch (error) {
    console.warn('[aitp-atlas] review baseline:', error.message);
  }
}

/** Put text into a discussion's input box, for the researcher to finish and send. */
function draftIntoThread(id, text) {
  const sessions = svc('sessions');
  const conversation = svc('conversation');
  const binding = sessions && sessions.binding ? sessions.binding(id) : null;
  if (!binding || !conversation || !conversation.input || typeof conversation.input.requestDraftInitialization !== 'function') return false;
  try {
    return conversation.input.requestDraftInitialization(binding, { prompt: text, whenDraftExists: 'append' }) !== 'blocked';
  } catch {
    return false;
  }
}

// ------------------------------------------------------- where you are ---

/** The last heading in `text` (a LaTeX sectioning command or a Markdown heading). */
function headingBefore(text) {
  const tex = [...String(text).matchAll(/\\(?:sub)*section\*?\{([^}]*)\}/g)];
  const md = [...String(text).matchAll(/^#{1,4}\s+(.+?)\s*#*$/gm)];
  const last = [tex[tex.length - 1], md[md.length - 1]].filter(Boolean).sort((a, b) => b.index - a.index)[0];
  return last ? last[1].trim() : '';
}

function nearestHeading(el, stop) {
  for (let cur = el; cur && cur !== stop; cur = cur.parentElement) {
    if (/^H[1-4]$/.test(cur.tagName)) return cur.textContent.trim();
    for (let sib = cur.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (/^H[1-4]$/.test(sib.tagName)) return sib.textContent.trim();
      const inner = sib.querySelectorAll ? sib.querySelectorAll('h1,h2,h3,h4') : [];
      if (inner.length) return inner[inner.length - 1].textContent.trim();
    }
  }
  return '';
}

/** Where a selected node sits: a Current work entry, an account section, a heading, a LaTeX section. */
function sectionOf(node, container) {
  const el = node && (node.nodeType === 1 ? node : node.parentElement);
  if (!el || !el.closest) return '';
  const line = el.closest('.atlas-lines li');
  if (line) {
    const before = [];
    for (let s = line; s; s = s.previousElementSibling) before.push(s.textContent);
    return headingBefore(before.reverse().join('\n'));
  }
  const md = el.closest('.atlas-markdown');
  const inNote = md ? nearestHeading(el, md) : '';
  const join = (...parts) => parts.filter(Boolean).join(' › ');
  const entry = el.closest('.atlas-thread');
  if (entry) {
    const name = entry.querySelector('.atlas-thread-name');
    return join('Current work', name && name.textContent.trim(), inNote);
  }
  const fold = el.closest('.atlas-fold');
  if (fold && container.contains(fold)) {
    const title = fold.querySelector('.atlas-fold-title');
    return join(title && title.textContent.trim(), inNote);
  }
  if (el.closest('.atlas-opening')) return join('Opening', inNote);
  return inNote || nearestHeading(el, container);
}

/** For source views: the line numbers a selection covers. */
/** The PDF page(s) a selection sits on: "13" or "13–14". */
function pageOf(range) {
  const page = (n) => {
    const el = n && (n.nodeType === 1 ? n : n.parentElement);
    const box = el && el.closest ? el.closest('.atlas-pdf-page') : null;
    return box ? Number(box.dataset.page) || 0 : 0;
  };
  const a = page(range.startContainer);
  const b = page(range.endContainer);
  if (!a && !b) return '';
  if (!a || !b || a === b) return String(a || b);
  return `${Math.min(a, b)}–${Math.max(a, b)}`;
}

function linesOf(range) {
  const li = (n) => {
    const el = n && (n.nodeType === 1 ? n : n.parentElement);
    return el && el.closest ? el.closest('.atlas-lines li') : null;
  };
  const a = li(range.startContainer);
  const b = li(range.endContainer);
  if (!a || !b) return '';
  const index = (x) => [...x.parentElement.children].indexOf(x) + 1;
  const [s, e] = [index(a), index(b)].sort((x, y) => x - y);
  return s === e ? String(s) : `${s}–${e}`;
}

/** A selected passage of a library PDF, kept under "Your reading" of its paper map with a link to its page. */
async function keepPassage(reading, pick) {
  const first = String(pick.page).split('–')[0];
  const link = `${relPath(dirOf(reading.map), reading.pdf)}#page=${first}`;
  const quote = String(pick.selection).replace(/\s+/g, ' ').trim().slice(0, 600);
  await api('append', { method: 'POST', body: { path: reading.map, heading: 'Your reading', line: `- [p. ${pick.page}](${link}): “${quote}”` } });
  readingStore.set({ ...readingStore.get(), at: Date.now() });
}

/** Selected text without the invisible placeholders of empty source lines. */
function cleanSelection(text) {
  return String(text || '').replace(/​/g, '').trim();
}

/** What is selected now: text in the reader, or a range in the editor. */
function captureSelection(main) {
  const active = document.activeElement;
  if (active && active.tagName === 'TEXTAREA' && active.classList.contains('atlas-editor-text') && active.selectionEnd > active.selectionStart) {
    const value = active.value;
    const before = value.slice(0, active.selectionStart);
    const first = before.split('\n').length;
    const last = value.slice(0, active.selectionEnd).split('\n').length;
    return { selection: value.slice(active.selectionStart, active.selectionEnd).slice(0, 6000), lines: first === last ? String(first) : `${first}–${last}`, section: headingBefore(before) };
  }
  const sel = window.getSelection();
  const text = sel && sel.rangeCount ? cleanSelection(sel.toString()) : '';
  if (!text || !main || !main.contains(sel.anchorNode)) return {};
  const range = sel.getRangeAt(0);
  return { selection: text.slice(0, 6000), section: sectionOf(range.startContainer, main), lines: linesOf(range), page: pageOf(range) };
}

// ------------------------------------------------------------- companion ---

function AtlasChatView(props) {
  return props.renderSlot('conversation.session', { view: 'chat' });
}

/** DSH's own conversation in its embedded form, inside a session scope (registered as a slot). */
function AtlasConversationPanel({ sessionId, useSession, useConversation, useSessions, renderFactorySlot }) {
  const session = useSession((value) => value);
  const conversation = useConversation((value) => value);
  const summaryBlank = useSessions((state) => (state.byId[sessionId] ? state.byId[sessionId].blank : undefined));
  const active = (conversation && conversation.activeTargets && conversation.activeTargets.size > 0) || (!session.blank && !session.awaitingFirstTurn) || session.running;
  const shell = active ? 'active' : session.promptAttempted ? 'engaging' : 'blank';
  const settling = shell === 'blank' && session.openState === 'loading' && summaryBlank !== true;
  const hero = shell === 'blank' && (session.openState === 'open' || summaryBlank === true);
  return renderFactorySlot('conversation.content', { variant: 'embedded', phase: settling ? 'settling' : hero ? 'hero' : 'active', hero }, { slots: { views: AtlasChatView } });
}

function EmbeddedConversation({ sessionId, onOpenChat }) {
  const kit = React.useContext(SlotKit);
  const [state, setState] = useState({ reference: null, error: null });
  useEffect(() => {
    const sessions = svc('sessions');
    if (!sessions || typeof sessions.retain !== 'function') {
      setState({ reference: null, error: new Error('This DSH version cannot show the discussion here.') });
      return undefined;
    }
    let reference = null;
    try {
      reference = sessions.retain(sessionId, { source: 'atlas' });
      setState({ reference, error: null });
    } catch (error) {
      setState({ reference: null, error });
    }
    return () => {
      if (reference) reference.release();
    };
  }, [sessionId]);
  if (state.error || !kit.SessionProvider || !kit.renderSlot) {
    return h('div', { className: 'atlas-companion-fallback' },
      h('p', null, state.error ? state.error.message : 'This DSH version cannot show the discussion beside the document.'),
      h(Button, { icon: 'external', onClick: onOpenChat }, 'Open in chat'));
  }
  if (!state.reference) return h('div', { className: 'atlas-companion-wait' }, h('span', { className: 'atlas-orbit', 'aria-hidden': true }), 'Opening the discussion…');
  return h('div', { className: 'atlas-embedded' }, h(kit.SessionProvider, { session: state.reference }, kit.renderSlot(CONVERSATION_SLOT, {})));
}

const COMPANION_MIN = 340;

function Companion({ threadId, pending, onClose, flash, width, onWidth }) {
  const threads = useThreadIndex();
  const rows = useSessionRows();
  const focus = useFocus();
  const thread = threads.find((t) => t.id === threadId);
  const row = rowOf(rows, threadId);
  const running = Boolean(pending || (row && row.running));
  const uiWorkspace = svc('uiWorkspace');
  const resolved = Boolean(thread && thread.status === 'resolved');
  const openChat = async () => {
    if (!uiWorkspace || typeof uiWorkspace.openSession !== 'function') {
      flash('This DSH version cannot open the conversation directly.');
      return;
    }
    // A resolved discussion is archived in DSH; bring it back before opening it there.
    if (resolved) {
      patchThread(threadId, { status: 'open' });
      try {
        await uiWorkspace.unarchiveSession(threadId);
      } catch {
        // Opening still works when DSH keeps archived sessions reachable.
      }
    }
    uiWorkspace.openSession(threadId);
  };
  const resolve = async () => {
    if (!resolved) {
      const pending = await api('review/changes', { query: { session: threadId } }).catch(() => null);
      const count = pending ? pending.files.reduce((n, f) => n + f.edits.length, 0) : 0;
      if (count && !window.confirm(`${plural(count, 'edit')} of this discussion are not reviewed. Resolve anyway? They stay in the notes as they are.`)) return;
      api('review/forget', { method: 'POST', body: { session: threadId } }).catch(() => {});
    }
    patchThread(threadId, { status: resolved ? 'open' : 'resolved' });
    try {
      if (resolved) await uiWorkspace.unarchiveSession(threadId);
      else await uiWorkspace.archiveSession(threadId);
    } catch {
      // Archiving only tidies DSH's session list; the discussion is marked either way.
    }
    flash(resolved ? 'The discussion is open again.' : 'Resolved: it stays listed with its topic and leaves DSH’s session list.');
  };
  const addView = () => {
    const text = contextBlock(focusContext(focus));
    if (draftIntoThread(threadId, text + '\n\n')) flash('What you are viewing is in the input box: add your question and send it.');
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => flash('Copied what you are viewing; paste it into the discussion.'), () => flash('Atlas could not add it here.'));
  };
  const startResize = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startW = width;
    const host = event.currentTarget.closest('.atlas-body');
    const max = host ? host.clientWidth * 0.66 : 900;
    const move = (e) => onWidth(Math.round(Math.min(max, Math.max(COMPANION_MIN, startW + (startX - e.clientX)))), false);
    const up = (e) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onWidth(Math.round(Math.min(max, Math.max(COMPANION_MIN, startW + (startX - e.clientX)))), true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const title = pending ? 'Starting the discussion…' : thread ? thread.title.replace(/^Atlas · /, '') : (row && row.title) || 'Discussion';
  return h('aside', { className: 'atlas-companion', 'aria-label': 'Discussion', style: { '--companion-w': width + 'px' } },
    h('div', { className: 'atlas-companion-resize', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Resize the discussion pane', onPointerDown: startResize }),
    h('header', { className: 'atlas-companion-head' },
      h('span', { className: cx('atlas-light', running && 'is-running', resolved && 'is-done'), 'aria-hidden': true }),
      h('span', { className: 'atlas-companion-title', title: thread ? thread.title : title }, title),
      h('button', { type: 'button', className: 'atlas-icon-button', title: 'Open in DSH’s chat view', 'aria-label': 'Open in chat', onClick: openChat, disabled: pending }, h(Icon, { name: 'external', size: 15 })),
      h('button', { type: 'button', className: 'atlas-icon-button', title: 'Close the pane (the discussion is kept)', 'aria-label': 'Close the pane', onClick: onClose }, h(Icon, { name: 'close', size: 15 }))),
    thread ? h(ContextChips, { context: thread.context, label: 'What this discussion was given' }) : null,
    pending ? null : h('div', { className: 'atlas-companion-actions' },
      h(TextButton, { onClick: addView, title: 'Put a pointer to what you are viewing now into the input box' }, h(Icon, { name: 'plus', size: 13 }), 'Add what I’m viewing'),
      h('span', { className: 'atlas-spacer' }),
      h(TextButton, { onClick: resolve, title: resolved ? 'Bring it back to DSH’s session list' : 'Mark it settled and archive the session' }, resolved ? 'Reopen' : 'Resolve')),
    pending ? null : h(ReviewPanel, { key: 'review:' + threadId, sessionId: threadId, running, flash }),
    h('div', { className: 'atlas-companion-body' }, pending
      ? h('div', { className: 'atlas-companion-wait' }, h('span', { className: 'atlas-orbit', 'aria-hidden': true }), 'Starting a session for this…')
      : h(EmbeddedConversation, { key: threadId, sessionId: threadId, onOpenChat: openChat })));
}

// ----------------------------------------------------------- ask surfaces ---

/** The ask bar (Ctrl+J or the Ask button): a question, or a research move, about what is in focus. */
function AskBar({ preset, onClose }) {
  const actions = React.useContext(AtlasActions);
  const focus = useFocus();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const box = useRef(null);
  const context = focusContext(focus, preset || {});
  useEffect(() => {
    const close = (event) => {
      if (box.current && !box.current.contains(event.target)) onClose();
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [onClose]);
  const send = (intent) => {
    if (intent === 'ask' && !text.trim()) {
      setError('Write a question, or pick one of the moves below.');
      return;
    }
    actions.ask(context, intent, text.trim());
    onClose();
  };
  return h('div', { className: 'atlas-askbar', role: 'dialog', 'aria-label': 'Ask about what you are viewing', ref: box },
    h(ContextChips, { context }),
    h('form', { className: 'atlas-askbar-row', onSubmit: (e) => { e.preventDefault(); send('ask'); } },
      h(Icon, { name: 'spark' }),
      h('input', { className: 'atlas-askbar-input', autoFocus: true, value: text, onChange: (e) => { setText(e.target.value); setError(''); }, onKeyDown: (e) => { if (e.key === 'Escape') onClose(); }, placeholder: `Ask about ${shortTitle(anchorName(context), 44)}…`, 'aria-label': 'Your question' }),
      h('button', { type: 'submit', className: 'atlas-button is-primary is-small' }, 'Ask')),
    error ? h('p', { className: 'atlas-askbar-error', role: 'alert' }, error) : null,
    h('div', { className: 'atlas-askbar-moves' },
      INTENT_ORDER.filter((k) => k !== 'ask').map((k) => h('button', { key: k, type: 'button', className: 'atlas-move', onClick: () => send(k), title: INTENTS[k].text }, h(Icon, { name: INTENTS[k].icon, size: 14 }), INTENTS[k].label)),
      h('span', { className: 'atlas-spacer' }),
      h('span', { className: 'atlas-hint' }, h('kbd', null, 'Enter'), ' ask · ', h('kbd', null, 'Esc'), ' close')));
}

/** The moves over a text selection: ask in place, a research move, or add it to the open discussion. */
function SelectionTools({ container, host }) {
  const actions = React.useContext(AtlasActions);
  const focus = useFocus();
  const reading = React.useSyncExternalStore(readingStore.subscribe, readingStore.get);
  const [pick, setPick] = useState(null);
  const [asking, setAsking] = useState(false);
  const [text, setText] = useState('');
  const askingRef = useRef(false);
  askingRef.current = asking;
  useEffect(() => {
    const el = container.current;
    if (!el) return undefined;
    const update = () => {
      if (askingRef.current) return;
      const sel = window.getSelection();
      const value = sel && sel.rangeCount ? cleanSelection(sel.toString()) : '';
      if (!value || value.length < 2 || !el.contains(sel.anchorNode) || !host.current) {
        setPick(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const frame = host.current.getBoundingClientRect();
      const width = Math.min(560, frame.width - 16);
      setText('');
      setPick({
        selection: value.slice(0, 6000),
        section: sectionOf(range.startContainer, el),
        lines: linesOf(range),
        page: pageOf(range),
        top: rect.top - frame.top < 52 ? rect.bottom - frame.top + 8 : rect.top - frame.top - 46,
        left: Math.max(8, Math.min(rect.left - frame.left, frame.width - width - 8)),
      });
    };
    const onUp = () => setTimeout(update, 0);
    const onScroll = () => {
      if (!askingRef.current) setPick(null);
    };
    el.addEventListener('mouseup', onUp);
    el.addEventListener('keyup', onUp);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('mouseup', onUp);
      el.removeEventListener('keyup', onUp);
      el.removeEventListener('scroll', onScroll);
    };
  }, [container.current]);
  if (!pick) return null;
  const context = focusContext(focus, pick);
  const keepable = Boolean(pick.page && reading.map && focus.doc && samePath(reading.pdf, focus.doc.path));
  const done = () => {
    setPick(null);
    setAsking(false);
    if (window.getSelection()) window.getSelection().removeAllRanges();
  };
  const go = (intent) => {
    actions.ask(context, intent, intent === 'ask' ? text.trim() : '');
    done();
  };
  const keep = (e) => {
    if (e.target.tagName !== 'INPUT') e.preventDefault();
  };
  return h('div', { className: 'atlas-seltools', style: { top: Math.max(4, pick.top), left: pick.left }, onMouseDown: keep, onMouseUp: (e) => e.stopPropagation() },
    asking
      ? h('form', { className: 'atlas-seltools-ask', onSubmit: (e) => { e.preventDefault(); if (text.trim()) go('ask'); } },
        h(Icon, { name: 'spark', size: 14 }),
        h('input', { className: 'atlas-seltools-input', autoFocus: true, value: text, onChange: (e) => setText(e.target.value), onKeyDown: (e) => { if (e.key === 'Escape') done(); }, placeholder: 'Ask about this passage…', 'aria-label': 'Your question about the passage' }),
        h('button', { type: 'submit', className: 'atlas-button is-primary is-small', disabled: !text.trim() }, 'Ask'))
      : [
        ...INTENT_ORDER.map((k) => h('button', { key: k, type: 'button', className: cx('atlas-seltool', k === 'ask' && 'is-primary'), title: INTENTS[k].text || 'Ask your own question about this passage', onClick: () => (k === 'ask' ? setAsking(true) : go(k)) }, k === 'ask' ? h(Icon, { name: 'spark', size: 13 }) : null, INTENTS[k].label)),
        actions.current ? h('span', { key: 'sep', className: 'atlas-seltools-sep', 'aria-hidden': true }) : null,
        actions.current ? h('button', { key: 'add', type: 'button', className: 'atlas-seltool', title: 'Put this passage into the open discussion’s input box', onClick: () => { actions.addToThread(context); done(); } }, h(Icon, { name: 'plus', size: 13 }), 'Add to discussion') : null,
        keepable ? h('button', { key: 'keep', type: 'button', className: 'atlas-seltool', title: 'Add this passage, with a link to its page, to the paper map’s “Your reading”', onClick: () => { keepPassage(reading, pick).catch((e) => console.warn('[aitp-atlas] keep:', e.message)); done(); } }, h(Icon, { name: 'note', size: 13 }), 'Keep in note') : null,
      ]);
}

// ------------------------------------------------------------ discussions ---

function threadLabel(t) {
  return t.label || t.question || t.title.replace(/^Atlas( team)? · [^·]+ · /, '');
}

function ThreadRow({ t, row, onOpen, current }) {
  const running = Boolean(row && row.running);
  const where = t.context.section ? `§ ${t.context.section}` : t.context.doc && !docIsTopic(t.context) ? baseName(t.context.doc.path) : t.context.page ? `page ${t.context.page}` : '';
  return h('button', { type: 'button', className: cx('atlas-item atlas-thread-item', current && 'is-current'), onClick: onOpen, title: t.title },
    h('span', { className: cx('atlas-light', running && 'is-running', t.status === 'resolved' && 'is-done'), 'aria-hidden': true }),
    h('span', { className: 'atlas-item-text' },
      h('span', { className: 'atlas-item-label' }, threadLabel(t)),
      h('span', { className: 'atlas-item-sub' }, [where, ago(t.created)].filter(Boolean).join(' · '))),
    t.kind === 'team' ? h(Chip, { title: 'An agent team: the lead and its members' }, 'team') : null,
    running ? h(Chip, { dot: '#9db8ff' }, 'working') : null);
}

/** The discussions about a topic (its documents included), or across the research. */
function Discussions({ match, title, emptyText, compact, limit }) {
  const actions = React.useContext(AtlasActions);
  const threads = useThreadIndex();
  const rows = useSessionRows();
  const list = threads.filter((t) => t.context && match(t) && knownThread(rows, t)).sort((a, b) => b.created - a.created);
  const open = list.filter((t) => t.status !== 'resolved');
  const resolved = list.filter((t) => t.status === 'resolved');
  if (compact && list.length === 0) return null;
  const shown = limit ? open.slice(0, limit) : open;
  const row = (t) => h('li', { key: t.id }, h(ThreadRow, { t, row: rowOf(rows, t.id), current: actions.current === t.id, onOpen: () => actions.openThread(t.id) }));
  return h('section', { className: 'atlas-side-block atlas-discussions' },
    h('h2', null, h(Icon, { name: 'spark' }), title || 'Discussions', open.length ? h('span', { className: 'atlas-count' }, open.length) : null),
    shown.length ? h('ul', { className: 'atlas-items' }, shown.map(row)) : h(Empty, null, emptyText || 'No discussions yet. Select a passage, or press Ctrl+J, to ask about it here.'),
    !limit && resolved.length ? h(Fold, { id: 'resolved:' + (title || 'topic'), title: 'Resolved', count: resolved.length }, () => h('ul', { className: 'atlas-items' }, resolved.map(row))) : null,
    compact ? null : h(Button, { small: true, icon: 'spark', onClick: () => actions.startAsk({}) }, 'Ask about this topic'));
}

/** A line under a document's head: the discussions about this document. */
function DocThreads({ path }) {
  const actions = React.useContext(AtlasActions);
  const threads = useThreadIndex();
  const rows = useSessionRows();
  const list = threads.filter((t) => t.context && t.context.doc && t.context.doc.path === path && t.status !== 'resolved' && knownThread(rows, t)).sort((a, b) => b.created - a.created);
  if (list.length === 0) return null;
  return h('p', { className: 'atlas-linked atlas-doc-threads' },
    h('span', { className: 'atlas-label' }, 'Discussed'), ' ',
    list.slice(0, 4).map((t, i) => h('span', { key: t.id }, i ? ' · ' : '',
      h(TextButton, { onClick: () => actions.openThread(t.id), title: t.title }, h('span', { className: cx('atlas-light', rowOf(rows, t.id) && rowOf(rows, t.id).running && 'is-running'), 'aria-hidden': true }), shortTitle(threadLabel(t), 40)))),
    list.length > 4 ? ` · ${list.length - 4} more in the topic` : null);
}
