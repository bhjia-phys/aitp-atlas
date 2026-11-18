// --------------------------------------------------------------- activity ---
// What is waiting on the researcher, what is running across topics, and agent
// teams started from a topic. Everything here is read from the notes (Current
// work dispositions) and from DSH's own session list; Atlas keeps only its
// small index of which session is about what.

/** A Current work disposition that waits on the researcher's decision. */
function isWaiting(status) {
  return /^waiting on (the )?(researcher|learner|you)\b/i.test(String(status || '').trim());
}

/** Plain text of a thread's entry, without its lead, status and date: the start of what it says. */
function entrySummary(th, max = 220) {
  const text = entryBody(th)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[((?:[^\[\]]|\[[^\]]*\])*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`|\$/g, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : text;
}

/**
 * Every Current work entry that waits on the researcher, in the notes the root
 * reaches, newest first. A parent's pointer entry ("name → owner") is shown
 * once, at its owner, when the owner lists its own waiting entry.
 */
function waitingItems(ov) {
  const topics = ov && ov.topics ? Object.values(ov.topics).filter((t) => t.reached !== false) : [];
  const owners = new Set(topics.filter((t) => (t.waiting || []).some((th) => !th.owner)).map((t) => pathKey(t.file)));
  const out = [];
  for (const t of topics) {
    for (const th of t.waiting || []) {
      if (!isWaiting(th.status) || (th.owner && owners.has(pathKey(th.owner)))) continue;
      out.push({ topic: t, thread: th, summary: entrySummary(th) });
    }
  }
  return out.sort((a, b) => String(b.thread.date || '').localeCompare(String(a.thread.date || '')));
}

/** The lettered options an entry lays out ("A: …", "(B) …", "route C. …"), when it lays out at least A and B. */
function optionsOf(text) {
  const found = new Map();
  for (const m of String(text || '').matchAll(/(?:^|[\s(·;:—–-])(?:option\s+|route\s+)?\(?([A-Da-d])\)?[:.)]\s+([^;·\n]{3,160})/g)) {
    const letter = m[1].toUpperCase();
    if (!found.has(letter)) found.set(letter, m[2].replace(/\s+/g, ' ').replace(/[.,]\s*$/, '').trim());
  }
  const letters = [...found.keys()].sort();
  if (letters[0] !== 'A' || letters[1] !== 'B') return [];
  return letters.filter((l, i) => l === 'ABCD'[i]).map((letter) => ({ letter, text: found.get(letter) }));
}

function DecideButtons({ topic, thread, onDone }) {
  const actions = React.useContext(AtlasActions);
  const options = optionsOf(entryBody(thread));
  if (options.length < 2) return null;
  const decide = (o) => {
    actions.ask(focusContext({ kind: 'topic', topic: { id: topic.id, title: topic.title, path: topic.file } }, { section: 'Current work › ' + thread.name }), 'ask',
      `My decision on "${thread.name}": ${o.letter}: ${o.text}. Record it in the owning note's decisions with today's date and these words, update this Current work entry, and continue within it.`, `Decide ${thread.name}`);
    if (onDone) onDone();
  };
  return h('div', { className: 'atlas-decide', role: 'group', 'aria-label': 'Choose an option' },
    options.map((o) => h('button', { key: o.letter, type: 'button', className: 'atlas-decide-option', onClick: () => decide(o), title: `Decide ${o.letter}: a discussion records it in the note` },
      h('span', { className: 'atlas-decide-letter' }, o.letter), h('span', null, o.text))));
}

function WaitingList({ ov, go, compact, limit }) {
  const actions = React.useContext(AtlasActions);
  const items = useMemo(() => waitingItems(ov), [ov]);
  if (items.length === 0) return compact ? null : h('section', { className: 'atlas-waiting is-empty' }, h('h2', null, 'Waiting on you'), h(Empty, null, 'Nothing in your notes waits on a decision from you.'));
  const shown = limit ? items.slice(0, limit) : items;
  return h('section', { className: cx('atlas-waiting', compact && 'is-compact'), 'aria-label': 'Waiting on you' },
    h('h2', null, 'Waiting on you', h('span', { className: 'atlas-count' }, items.length)),
    h('ul', null, shown.map(({ topic, thread, summary }, i) => h('li', { key: topic.id + ':' + thread.name + ':' + i, className: 'atlas-waiting-item' },
      h('div', { className: 'atlas-waiting-head' },
        h('button', { type: 'button', className: 'atlas-waiting-title', onClick: () => go({ view: 'doc', path: topic.file, anchor: 'current-work' }) }, thread.name),
        thread.date ? h('span', { className: 'atlas-date' }, thread.date) : null),
      h('p', { className: 'atlas-waiting-topic' }, topic.id === '' ? 'Root note' : shortTitle(topic.title, 60)),
      compact ? null : h('p', { className: 'atlas-waiting-text' }, summary),
      compact ? null : h('div', { className: 'atlas-waiting-actions' },
        h(Button, { small: true, onClick: () => go({ view: 'doc', path: topic.file, anchor: 'current-work' }) }, 'Open the thread'),
        h(Button, { small: true, quiet: true, onClick: () => actions && actions.ask(focusContext({ kind: 'topic', topic: { id: topic.id, title: topic.title, path: topic.file } }, { section: 'Current work › ' + thread.name }), 'ask', `Help me decide "${thread.name}": lay out the options my note records, what each would settle, and what you would recommend.`, 'Decide ' + thread.name) }, 'Discuss'),
        h(Button, { small: true, quiet: true, icon: 'team', onClick: () => go({ view: 'team', path: topic.file, thread: thread.name }) }, 'Start a team')),
      compact ? null : h(DecideButtons, { topic, thread })))),
    compact && items.length > shown.length ? h(TextButton, { onClick: () => go({ view: 'activity' }) }, `All ${items.length} in Activity`) : null);
}

// ------------------------------------------------------------- the list ---

function sessionState(row, record) {
  if (row && row.running) return { label: 'working', className: 'is-running' };
  if (record && record.status === 'resolved') return { label: 'resolved', className: 'is-done' };
  if (row && row.archived) return { label: 'archived', className: '' };
  return { label: 'idle', className: '' };
}

function parentOf(row) {
  return row ? row.parentSessionId || row.parentId || '' : '';
}

/** Discussions and teams Atlas started, by topic; DSH's other recent sessions after them. */
function activityGroups(index, rows) {
  const byTopic = new Map();
  const seen = new Set();
  for (const t of index) {
    if (!knownThread(rows, t)) continue;
    seen.add(t.id);
    const topic = (t.context && t.context.topic) || null;
    const key = topic ? topic.path : '';
    if (!byTopic.has(key)) byTopic.set(key, { key, topic, items: [], latest: 0 });
    const group = byTopic.get(key);
    group.items.push(t);
    group.latest = Math.max(group.latest, t.created || 0);
  }
  for (const group of byTopic.values()) group.items.sort((a, b) => (b.created || 0) - (a.created || 0));
  const groups = [...byTopic.values()].sort((a, b) => b.latest - a.latest);
  const others = rows && rows.byId ? Object.entries(rows.byId)
    .map(([id, row]) => ({ id, row }))
    .filter(({ id, row }) => !seen.has(id) && !parentOf(row) && !row.archived && !row.blank)
    .slice(-12).reverse() : [];
  return { groups, others };
}

/** What DSH's session list says about a session (its projection), or nothing. */
function projectionOf(row) {
  return (row && row.projectionValues) || {};
}

/** A root session with Agent Teams on leads a team; its board is the shared task list. */
function teamOf(row) {
  const team = projectionOf(row).agentTeam;
  return team && team.enabled ? team : null;
}

/** "[fixer] Runs the checks" → the role and the task, as Oh-My-BBFF labels a seat. */
function memberLabel(label, name) {
  const m = /^\[([^\]]+)\]\s*([\s\S]*)$/.exec(String(label || ''));
  return { name: name || '', role: m ? m[1] : '', task: (m ? m[2] : String(label || '')).trim() };
}

/** A lead's members: its catalog of subagents (names and role labels), each with its live row. */
function membersOf(rows, leadId) {
  if (!rows || !rows.byId) return [];
  const catalog = projectionOf(rowOf(rows, leadId)).subagentCatalog;
  if (Array.isArray(catalog) && catalog.length) {
    return catalog.map((c) => ({ id: c.id, row: rowOf(rows, c.id) || null, ...memberLabel(c.label, c.name) }));
  }
  return Object.entries(rows.byId)
    .filter(([, row]) => parentOf(row) === leadId)
    .map(([id, row]) => ({ id, row, ...memberLabel((projectionOf(row).subagent || {}).label || row.title, '') }));
}

/** The team board in a few words: how many tasks, how many done and in progress. */
function boardSummary(team) {
  const tasks = team && Array.isArray(team.tasks) ? team.tasks : [];
  if (tasks.length === 0) return '';
  const status = (t) => String(t.status || '').toLowerCase().replace(/[\s-]+/g, '_');
  const done = tasks.filter((t) => status(t) === 'completed').length;
  const active = tasks.filter((t) => status(t) === 'in_progress').length;
  return `${tasks.length} task${tasks.length === 1 ? '' : 's'} on the board: ${done} done${active ? `, ${active} in progress` : ''}`;
}

function modelOf(row) {
  const selection = projectionOf(row).modelSelection;
  return selection && selection.lastUsed ? selection.lastUsed.model || '' : '';
}

function TeamMembers({ rows, leadId, onOpen }) {
  const members = membersOf(rows, leadId);
  const board = boardSummary(teamOf(rowOf(rows, leadId)));
  return h('div', { className: 'atlas-activity-team' },
    board ? h('p', { className: 'atlas-muted' }, board) : null,
    h('ul', { className: 'atlas-activity-members' },
      members.map((m) => h('li', { key: m.id },
        h('span', { className: cx('atlas-light', m.row && m.row.running && 'is-running'), 'aria-hidden': true }),
        h(TextButton, { onClick: () => onOpen(m.id), title: m.task }, m.name || m.role || 'Member'),
        m.role && m.name ? h('span', { className: 'atlas-chip' }, m.role) : null,
        h('span', { className: 'atlas-activity-task' }, m.task),
        modelOf(m.row) ? h('span', { className: 'atlas-date' }, modelOf(m.row)) : null)),
      members.length === 0 ? h('li', { className: 'atlas-muted' }, 'No members yet: the lead staffs the seats in its first turn.') : null));
}

function ActivityRow({ id, kind, title, row, record, onOpen, children }) {
  const state = sessionState(row, record);
  const when = record && record.created ? new Date(record.created).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  return h('li', { className: 'atlas-activity-row' },
    h('span', { className: 'atlas-activity-kind' }, kind),
    h('span', { className: 'atlas-activity-main' },
      h(TextButton, { onClick: onOpen, title }, title),
      children),
    h('span', { className: 'atlas-activity-state' }, h('span', { className: cx('atlas-light', state.className), 'aria-hidden': true }), state.label),
    when ? h('span', { className: 'atlas-date' }, when) : h('span', null));
}

function ActivityView({ overview: ov, go }) {
  const actions = React.useContext(AtlasActions);
  const index = useThreadIndex();
  const rows = useSessionRows();
  usePublishFocus({ kind: 'universe', topic: { id: '', title: ov.title || 'Root note', path: ov.rootFile } }, [ov.rootFile, ov.title]);
  const { groups, others } = useMemo(() => activityGroups(index, rows), [index, rows]);
  const topicColor = (topic) => {
    const t = topic && Object.values(ov.topics).find((x) => x.file === topic.path);
    return t ? directionColor(ov, topicDirection(ov, t.id)) : 'var(--accent)';
  };
  const label = (t) => (t.kind === 'team' || teamOf(rowOf(rows, t.id)) ? 'Team' : 'Discussion');
  return h('div', { className: 'atlas-page is-wide atlas-activity' },
    h('p', { className: 'atlas-kicker' }, 'Activity'),
    h('h1', null, "What's running"),
    h('p', { className: 'atlas-lede' }, 'Decisions your notes wait on, and the discussions, teams and other sessions in DSH, grouped by topic.'),
    h(WaitingList, { ov, go }),
    h('section', { className: 'atlas-section' },
      h('h2', null, 'By topic', h('span', { className: 'atlas-count' }, groups.length)),
      groups.length === 0 ? h(Empty, null, 'Nothing started from Atlas yet. Ask about a topic, or start a team from a thread that waits on you.') : null,
      groups.map((group) => h('div', { key: group.key || 'none', className: 'atlas-activity-group' },
        h('h3', null,
          h('span', { className: 'atlas-dot', style: { background: topicColor(group.topic) } }),
          group.topic ? h(TextButton, { onClick: () => go({ view: 'doc', path: group.topic.path }) }, group.topic.title) : 'The research programme'),
        h('ul', null, group.items.map((t) => h(ActivityRow, { key: t.id, id: t.id, kind: label(t), title: threadLabel(t), row: rowOf(rows, t.id), record: t, onOpen: () => actions.openThread(t.id) },
          t.kind === 'team' || teamOf(rowOf(rows, t.id)) ? h(TeamMembers, { rows, leadId: t.id, onOpen: actions.openThread }) : null)))))),
    others.length > 0
      ? h('section', { className: 'atlas-section' },
        h('h2', null, 'Other sessions in DSH', h('span', { className: 'atlas-count' }, others.length)),
        h('ul', { className: 'atlas-activity-others' }, others.map(({ id, row }) => h(ActivityRow, { key: id, id, kind: teamOf(row) ? 'Team' : 'Session', title: row.displayTitle || row.title || 'Untitled session', row, onOpen: () => actions.openThread(id) },
          teamOf(row) ? h(TeamMembers, { rows, leadId: id, onOpen: actions.openThread }) : null))))
      : null);
}

// ------------------------------------------------------------- teams ---

/** DSH's Agent Teams service, set while it is loaded (see the registration). */
let teamScope = null;

/**
 * The roles Oh-My-BBFF Team ships with. A one-shot role is dispatched for a
 * bounded job (bbff_team_dispatch); the others can also be hired as a core
 * member that keeps its context (bbff_team_hire). The researcher can change
 * the catalog in BBFF Settings; the brief asks the Lead to check it.
 */
const TEAM_ROLES = [
  { id: 'librarian', name: 'Librarian', kind: 'oneshot', hint: 'Finds and reads sources; reads, never edits' },
  { id: 'explorer', name: 'Explorer', kind: 'oneshot', hint: 'Maps code, data and notes quickly' },
  { id: 'oracle', name: 'Oracle', kind: 'oneshot', hint: 'Reviews and judges: the independent check' },
  { id: 'fixer', name: 'Fixer', kind: 'both', hint: 'Implements and runs the checks or calculations' },
  { id: 'writer', name: 'Writer', kind: 'both', hint: 'Drafts and revises text' },
  { id: 'laborer', name: 'Laborer', kind: 'both', hint: 'Bounded routine work' },
  { id: 'designer', name: 'Designer', kind: 'both', hint: 'Designs interfaces and figures' },
];
const SEAT_MODES = [['member', 'Core member'], ['oneshot', 'One-shot job']];

function roleOf(id) {
  return TEAM_ROLES.find((r) => r.id === id) || { id, name: id, kind: 'both', hint: '' };
}

/** How a seat is filled: a one-shot role is always dispatched. */
function seatMode(m) {
  return roleOf(m.role).kind === 'oneshot' ? 'oneshot' : m.mode === 'oneshot' ? 'oneshot' : 'member';
}

function defaultMembers() {
  return [
    { role: 'librarian', mode: 'oneshot', purpose: 'Literature scout: find and read the sources the goal needs. Reads, never edits.', model: '' },
    { role: 'fixer', mode: 'member', purpose: 'Runs the derivation checks or calculations the goal needs, within the limits.', model: '' },
    { role: 'oracle', mode: 'oneshot', purpose: 'Reviewer: checks the record against the work before anything enters research.md.', model: '' },
  ];
}

function slugOf(text) {
  return String(text || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 40) || 'team';
}

/** The Lead's first message: where it is, what to settle, the limits, the seats and the rules. */
function teamBrief({ context, goal, limits, members, reportDir }) {
  const line = (m) => `- ${m.role}${m.purpose ? ` — ${m.purpose}` : ''}${m.model ? ` (model tier: ${m.model})` : ''}`;
  const seats = members.filter((m) => m.role);
  const core = seats.filter((m) => seatMode(m) === 'member').map(line);
  const jobs = seats.filter((m) => seatMode(m) === 'oneshot').map(line);
  const rules = [
    "Use the bbff-team-leading skill to staff and brief the team, and AITP's Skills for the research itself.",
    'Check bbff_team_roles first: if a role or model tier named here is not in the catalog, use the closest one and say so.',
    'Give each member only the pointers above and the files its task needs, never whole folders.',
    `Each member writes its own report under ${reportDir}/.`,
    'Only you propose edits to the notes, after the reviewer has checked them; say what changed and why.',
    "Prepare any cluster job as the exact command and stop: a submission needs the researcher's yes.",
  ];
  return [
    contextBlock(context),
    '',
    'Start an agent team for this goal and lead it.',
    '',
    `Goal: ${String(goal || '').trim()}`,
    limits && limits.trim() ? `Limits:\n${limits.trim().split(/\n+/).map((l) => '- ' + l.replace(/^[-*]\s*/, '')).join('\n')}` : '',
    core.length ? `Core members to hire (bbff_team_hire):\n${core.join('\n')}` : '',
    jobs.length ? `One-shot jobs to dispatch when their turn comes (bbff_team_dispatch):\n${jobs.join('\n')}` : '',
    `Rules:\n${rules.map((r) => '- ' + r).join('\n')}`,
  ].filter(Boolean).join('\n');
}

/**
 * Start a team: a DSH session in the research workspace with Agent Teams on,
 * titled and briefed. The Lead hires the seats itself (Oh-My-BBFF Team tools).
 */
async function startTeam({ root, context, goal, limits, members, label, onCreated }) {
  const sessions = svc('sessions');
  const workspaces = svc('workspaces');
  const teams = teamScope && teamScope.remote ? teamScope.remote.agentTeams : null;
  if (!sessions || typeof sessions.create !== 'function' || typeof sessions.retain !== 'function') throw new Error('This DSH version cannot start sessions from Atlas.');
  if (!teams || typeof teams.setEnabled !== 'function') throw new Error("DSH's Agent Teams is not available here, so a team cannot start.");
  let workspaceId;
  if (workspaces && typeof workspaces.create === 'function') {
    const workspace = await workspaces.create({ path: root });
    workspaceId = workspace && (workspace.id || workspace.workspaceId);
  }
  const id = await sessions.create(workspaceId ? { workspaceId } : { cwd: root });
  await keepBaseline(id, context);
  const topicTitle = context.topic ? shortTitle(context.topic.title, 24) : 'Research';
  const title = `Atlas team · ${topicTitle} · ${shortTitle(String(goal || '').replace(/\s+/g, ' '), 52)}`;
  const topicDir = context.topic && context.topic.path ? dirOf(context.topic.path) : root;
  const reportDir = joinPath(topicDir, `calculations/team-${slugOf(goal)}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
  const record = { id, kind: 'team', title, created: Date.now(), status: 'open', intent: 'team', label: label || shortTitle(String(goal || '').replace(/\s+/g, ' '), 90), question: String(goal || '').trim(), context, team: { goal, limits, members, reportDir } };
  threadStore.set([...threadStore.get().filter((t) => t.id !== id), record].slice(-400));
  if (onCreated) onCreated(record);
  const reference = sessions.retain(id, { source: 'atlas' });
  try {
    const binding = await reference.ready;
    const session = (binding && binding.session) || ((sessions.binding && sessions.binding(id)) || {}).session;
    if (!session) throw new Error('DSH did not open the team session.');
    if (typeof session.rename === 'function') await Promise.resolve(session.rename(title)).catch(() => {});
    const brief = teamBrief({ context, goal, limits, members, reportDir });
    const enabled = await Promise.resolve(teams.setEnabled(id, true)).catch((error) => ({ ok: false, error }));
    if (!enabled || enabled.ok === false) {
      // The session exists: leave the brief in its input box for the researcher to send once Agent Teams is on.
      const reason = (enabled && enabled.error && enabled.error.message) || 'DSH did not turn Agent Teams on.';
      const drafted = draftIntoThread(id, brief);
      throw new Error(`${reason} The team's session is open${drafted ? ' with the brief in its input box' : ''}: turn on Use Agent Teams in its model menu, then send the brief.`);
    }
    const result = await session.prompt([{ type: 'text', text: brief }], 'queue');
    if (result && result.ok === false) throw new Error((result.error && result.error.message) || 'DSH did not accept the brief.');
  } finally {
    reference.release();
  }
  return record;
}

function TeamView({ overview: ov, go, flash, path, thread }) {
  const actions = React.useContext(AtlasActions);
  const topic = useMemo(() => Object.values(ov.topics).find((t) => t.file === path) || null, [ov, path]);
  // The overview carries a topic's waiting entries; any other thread is known by its name.
  const th = topic && thread ? (topic.waiting || []).find((x) => x.name === thread) || { name: thread, markdown: '' } : null;
  const [goal, setGoal] = useState(() => (th ? `Settle "${th.name}"${th.markdown ? ': ' + entrySummary(th, 400) : '.'}` : ''));
  const [limits, setLimits] = useState("No cluster submission without the researcher's yes\nNo change to acceptance criteria");
  const [members, setMembers] = useState(defaultMembers);
  const [busy, setBusy] = useState(false);
  const context = focusContext(topic ? { kind: 'topic', topic: { id: topic.id, title: topic.title, path: topic.file } } : { kind: 'universe' }, th ? { section: 'Current work › ' + th.name } : {});
  usePublishFocus({ kind: 'topic', topic: topic ? { id: topic.id, title: topic.title, path: topic.file } : null }, [path]);
  const setMember = (i, patch) => setMembers(members.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const start = async (event) => {
    event.preventDefault();
    if (!goal.trim()) return flash('Say what the team should settle first.');
    setBusy(true);
    try {
      await startTeam({ root: ov.root, context, goal, limits, members, label: th ? th.name : '', onCreated: (record) => actions.openThread(record.id) });
      flash('The team started: its lead is staffing the seats. Follow it here or in Activity.');
      go({ view: 'activity' });
    } catch (error) {
      flash(error.message || String(error));
    } finally {
      setBusy(false);
    }
  };
  const crumbs = [{ label: 'Universe', go: { view: 'home' } }];
  if (topic) crumbs.push({ label: shortTitle(topic.title, 40), go: { view: 'doc', path: topic.file } });
  crumbs.push({ label: 'Start a team' });
  return h('div', { className: 'atlas-page atlas-team' },
    h(Crumbs, { items: crumbs, go }),
    h('p', { className: 'atlas-kicker' }, 'Agent team'),
    h('h1', null, th ? th.name : 'Start a team'),
    h('p', { className: 'atlas-lede' }, 'A DSH session with Agent Teams on leads the work. Oh-My-BBFF Team gives each seat a role, its permissions and a model tier: a core member keeps its context across the work, a one-shot job ends with its report. You review what the team proposes for your notes.'),
    h('form', { className: 'atlas-team-form', onSubmit: start },
      h('label', { className: 'atlas-field' }, h('span', null, 'Goal'), h('textarea', { className: 'atlas-input', rows: 4, value: goal, onChange: (e) => setGoal(e.target.value), placeholder: 'What should the team settle?' })),
      h('label', { className: 'atlas-field' }, h('span', null, 'Limits, one per line'), h('textarea', { className: 'atlas-input', rows: 3, value: limits, onChange: (e) => setLimits(e.target.value) })),
      h('fieldset', { className: 'atlas-team-seats' },
        h('legend', null, 'Seats'),
        members.map((m, i) => {
          const role = roleOf(m.role);
          return h('div', { key: i, className: 'atlas-team-seat' },
            h('label', { className: 'atlas-seat-role' }, h('span', null, 'Role'), h('select', { className: 'atlas-input', value: m.role, title: role.hint, onChange: (e) => setMember(i, { role: e.target.value }) }, TEAM_ROLES.map((r) => h('option', { key: r.id, value: r.id, title: r.hint }, r.name)))),
            h('label', { className: 'atlas-seat-how' }, h('span', null, 'As'), h('select', { className: 'atlas-input', value: seatMode(m), disabled: role.kind === 'oneshot', title: role.kind === 'oneshot' ? 'This role only takes one-shot jobs' : 'A core member keeps its context across the work; a one-shot job ends with its report', onChange: (e) => setMember(i, { mode: e.target.value }) }, SEAT_MODES.map(([key, label]) => h('option', { key, value: key }, label)))),
            h('label', { className: 'atlas-seat-task' }, h('span', null, 'Task'), h('input', { className: 'atlas-input', value: m.purpose, onChange: (e) => setMember(i, { purpose: e.target.value }) })),
            h('label', { className: 'atlas-seat-model' }, h('span', null, 'Model tier'), h('input', { className: 'atlas-input', value: m.model, placeholder: 'role default', title: "A tier label from the role's model list in BBFF Settings", onChange: (e) => setMember(i, { model: e.target.value }) })),
            h('button', { type: 'button', className: 'atlas-icon-button atlas-seat-remove', 'aria-label': 'Remove this seat', onClick: () => setMembers(members.filter((_, j) => j !== i)) }, h(Icon, { name: 'close', size: 14 })));
        }),
        h(TextButton, { onClick: () => setMembers([...members, { role: 'explorer', mode: 'oneshot', purpose: '', model: '' }]) }, '+ Add a seat')),
      h('p', { className: 'atlas-muted' }, 'Each seat gets the Atlas context block (the topic note and the thread), never whole folders. Reports go to the topic\'s calculations folder; note edits come back to you.'),
      h('div', { className: 'atlas-actions' },
        h('button', { type: 'submit', className: 'atlas-button is-primary', disabled: busy || !ov.root }, busy ? 'Starting…' : 'Start the team'),
        h(Button, { quiet: true, onClick: () => go({ back: true }) }, 'Cancel'))));
}
