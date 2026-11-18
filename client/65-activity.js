// Read-only legacy team index and Current work decision controls. Discussions and needs live in the registry.

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
      `My decision on "${thread.name}": ${o.letter}: ${o.text}. Record it in the owning note's decisions with today's date and these words, update this Current work entry, and continue within it.`, `Decide ${thread.name}`, { origin: 'decide', targetId: 'new' });
    if (onDone) onDone();
  };
  return h('div', { className: 'atlas-decide', role: 'group', 'aria-label': 'Choose an option' },
    options.map((o) => h('button', { key: o.letter, type: 'button', className: 'atlas-decide-option', onClick: () => decide(o), title: `Decide ${o.letter}: a discussion records it in the note` },
      h('span', { className: 'atlas-decide-letter' }, o.letter), h('span', null, o.text))));
}

function sessionState(row, record) {
  if (row && row.running) return { label: 'working', className: 'is-running' };
  if (record && record.status === 'resolved') return { label: 'resolved', className: 'is-done' };
  if (row && row.archived) return { label: 'archived', className: '' };
  return { label: 'idle', className: '' };
}

function parentOf(row) {
  return row ? row.parentSessionId || row.parentId || '' : '';
}

/** Preserve topic groupings and historical labels; live child projections count
 * towards the Running filter. Ordinary discussions belong to the registry. */
function legacyTeamGroups(index, rows, filter = '') {
  const groups = new Map(), indexed = new Set();
  const running = (id, row) => row?.running || membersOf(rows, id).some(m => m.row?.running);
  for (const t of index) {
    const row = rowOf(rows, t.id);
    if (!knownThread(rows,t) || parentOf(row) || (t.kind !== 'team' && !teamOf(row))) continue;
    indexed.add(t.id);
    if (filter === 'running' && !running(t.id,row)) continue;
    const topic = t.context?.topic || null, key = topic?.path || '';
    if (!groups.has(key)) groups.set(key, { key, topic, latest: 0, items: [] });
    const group = groups.get(key);
    group.items.push(t);
    group.latest = Math.max(group.latest, t.created || 0);
  }
  for (const group of groups.values()) group.items.sort((a,b) => (b.created || 0) - (a.created || 0));
  const others = Object.entries(rows?.byId || {}).filter(([id,row]) => !indexed.has(id) && !parentOf(row) && !row.archived && !row.blank && teamOf(row) && (filter !== 'running' || running(id,row)))
    .map(([id,row]) => ({id,row}));
  return {groups: [...groups.values()].sort((a,b) => b.latest - a.latest), others};
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

function LegacyTeamRow({ id, kind, title, row, record, onOpen, children }) {
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

function LegacyTeamsPlace({overview: ov, go, filter = ''}) {
  const actions = React.useContext(AtlasActions), index = useThreadIndex(), rows = useSessionRows();
  const {groups, others} = useMemo(() => legacyTeamGroups(index,rows,filter), [index,rows,filter]);
  usePublishFocus({kind:'universe', topic:{id:'',title:ov.title || 'Root note',path:ov.rootFile}}, [ov.rootFile,ov.title]);
  const teamRow = (id, record, row) => h(LegacyTeamRow, {
    key:id, id, row, record, kind:'Team', title:(record && threadLabel(record)) || row?.displayTitle || row?.title || 'Untitled team',
    onOpen:() => actions.openThread(id),
  }, h(TeamMembers,{rows,leadId:id,onOpen:actions.openThread}));
  return h('div',{className:'atlas-page is-wide atlas-activity'},
    h('p',{className:'atlas-kicker'},'Research desk'), h('h1',null,'Teams'),
    h('p',{className:'atlas-lede'},'Inspect existing team leads, members and task counts from DSH.'),
    h('div',{className:'atlas-actions',role:'group','aria-label':'Filter teams'},
      [['','All'],['running','Running']].map(([value,label])=>h('button',{type:'button',key:value,'aria-pressed':filter===value,className:cx('atlas-button is-small',filter===value && 'is-primary'),onClick:()=>go({view:'teams',filter:value})},label))),
    groups.length > 0 && h('section',{className:'atlas-section'},h('h2',null,'By topic'),groups.map(g =>
      h('div',{className:'atlas-activity-group',key:g.key},h('h3',null,g.topic ? h(TextButton,{'data-atlas-open':true,onClick:()=>go({view:'doc',path:g.topic.path})},g.topic.title) : 'The research programme'),
        h('ul',null,g.items.map(t=>teamRow(t.id,t,rowOf(rows,t.id))))))),
    others.length > 0 && h('section',{className:'atlas-section'},h('h2',null,'Other teams in DSH'),h('ul',{className:'atlas-activity-others'},others.map(({id,row})=>teamRow(id,null,row)))),
    !groups.length && !others.length && h(Empty,null,filter==='running' ? 'No teams are running.' : 'No existing teams to show.'));
}

// Optional DSH Agent Teams capability installed by 90-register. No M2
// launcher calls it. Team mutations and new rooms belong to M3.
let teamScope = null;
