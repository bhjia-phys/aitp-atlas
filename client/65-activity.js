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

function parentOf(row) {
  return row ? row.parentSessionId || row.parentId || '' : '';
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

// Optional DSH Agent Teams capability registered in 90-register.
let teamScope = null;
