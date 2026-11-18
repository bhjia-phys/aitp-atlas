// Atlas prepares text; only the approved lead can call DSH's subagent tool. Reads here
// are limited to this fixed manifest of shipped resources, never a researcher's files.
import { readFileSync } from 'node:fs';

const roles = ['theorist', 'numerics', 'literature', 'referee', 'writer'];
const resourceNames = ['charter', 'lead-brief', 'seat-call', 'state', 'roles/README', 'roles/lead', ...roles.map((role) => `roles/${role}`)];
const source = Object.fromEntries(resourceNames.map((key) => [key, readFileSync(new URL(`../templates/team/${key}.md`, import.meta.url), 'utf8')]));

// Presets seed the form, not the scheduler. Only the researcher's final seats are rendered.
export const TEAM_PRESETS = [
  ['derive-check', 'Derive and check', ['theorist', 'referee']],
  ['theory-numerics', 'Theory and numerics', ['theorist', 'numerics', 'referee']],
  ['literature-survey', 'Literature survey', ['literature', 'literature-2', 'referee']],
  ['write-up', 'Write-up', ['writer', 'referee']], ['custom', 'Custom', []],
].map(([id, label, names]) => ({ id, label, seats: names.map((name) => ({ name, role: name.split('-')[0], mode: 'core', model: null })) }));

function invalid(message) { throw Object.assign(new Error(message), { statusCode: 400, code: 'INVALID_TEAM' }); }
function record(v, key) { if (!v || typeof v !== 'object' || Array.isArray(v)) invalid(`Expected ${key} to be an object.`); return v; }
function text(v, key, { required = false, single = false, max = 8000 } = {}) {
  if (v == null) v = '';
  if (typeof v !== 'string' || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(v) || (single && /[\r\n\t\u2028\u2029]/u.test(v))) invalid(`Invalid ${key}.`);
  const s = v.replace(/\r\n?/g, '\n').trim();
  if (required && !s) invalid(`Missing ${key}.`);
  return s;
}
function list(v, key) {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > 128) invalid(`Invalid ${key} list.`);
  return v.map((item) => text(item, key, { required: true, single: true, max: 4096 }));
}
function choice(v, key, allowed) { if (!allowed.includes(v)) invalid(`Invalid ${key}.`); return v; }
function modelSelection(v) {
  if (v == null) return null;
  record(v, 'model selection');
  const one = { required: true, single: true, max: 300 };
  const provider = text(v.provider, 'model provider', one), model = text(v.model, 'model id', one);
  const effort = text(v.effort, 'reasoning effort', { single: true, max: 100 });
  return { provider, model, ...(effort ? { effort } : {}) };
}
function shortGoal(goal) {
  const s = goal.replace(/\s+/gu, ' ').trim(), chars = Array.from(s);
  if (chars.length <= 120) return s;
  const cut = chars.slice(0, 120).join('');
  if (chars[120] === ' ') return cut;
  return cut.replace(/\s+\S*$/u, '') || cut;
}

/** Validate data *before* creating a run or session. The caller resolves the canonical
 * topic path and enforces its read/write boundary; pointers here are inert strings. */
export function validateTeamDraft(raw) {
  record(raw, 'team draft');
  const goal = text(raw.goal, 'goal', { required: true }), doneWhen = text(raw.doneWhen, 'done when', { required: true });
  const name = text(raw.name, 'team name', { single: true, max: 180 }) || shortGoal(goal);
  const t = record(raw.topic, 'topic');
  if (typeof t.id !== 'string') invalid('Missing topic id (use an explicit empty id for the root).');
  const topic = { id: text(t.id, 'topic id', { single: true }), title: text(t.title, 'topic title', { single: true, required: true }), path: text(t.path, 'topic path', { single: true, required: true }) };
  const inputs = list(raw.inputs, 'inputs');
  if (!Array.isArray(raw.seats) || raw.seats.length > 32) invalid('Specify a crew of zero to 32 members.');
  const seen = new Set();
  const seats = raw.seats.map((value) => {
    const seat = record(value, 'member'), name = seat.name;
    // Names become both DSH identities and file/directory components on Windows and Unix.
    if (typeof name !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(name) || /^(?:lead|readme|con|aux|prn|nul|com[1-9]|lpt[1-9])$/.test(name)) invalid(`Invalid or reserved member name: ${name}.`);
    if (seen.has(name)) invalid(`Duplicate member name: ${name}.`);
    seen.add(name);
    const role = choice(seat.role, 'member role', [...roles, 'custom']);
    const mode = choice(seat.mode ?? 'core', 'member mode', ['core', 'one-shot']);
    const task = text(seat.task, 'first task');
    const roleCard = text(seat.roleCard, 'role card', { required: role === 'custom', max: 16000 });
    const seatInputs = list(seat.inputs, 'member inputs');
    if (seatInputs.some((ref) => !inputs.includes(ref) || /(?:[/\\]$|(?:^|[/\\])\.{1,2}$|[*])/.test(ref))) invalid('A member input must name a specific input in the charter.');
    return { name, role, mode, model: modelSelection(seat.model), ...(task ? { task } : {}), ...(roleCard ? { roleCard } : {}), ...(seatInputs.length ? { inputs: seatInputs } : {}) };
  });
  return { name, goal, doneWhen, topic, conventions: text(raw.conventions, 'conventions'), extraAllowed: list(raw.extraAllowed, 'extra allowed files'),
    extraAsk: list(raw.extraAsk, 'extra approval rules'), inputs, seats, template: choice(raw.template ?? 'custom', 'team template', TEAM_PRESETS.map((p) => p.id)), leadModel: modelSelection(raw.leadModel) };
}

// Single pass: a dollar sign, brace pair or placeholder in a scientific expression
// or filename is literal user data, not a second substitution or a filename to read.
function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error(`Unknown field in shipped team template: ${key}`);
    return values[key];
  });
}
function bullets(items) { return items.map((item) => `- ${item}`).join('\n'); }
function routeLabel(route) { return route ? `${route.provider}/${route.model}${route.effort ? ` · ${route.effort}` : ''}` : 'Same as the lead'; }
function tableCell(v) { return v.replaceAll('\\', '\\\\').replaceAll('|', '\\|'); }

// No invented run, hunt through the workspace, or automatically assigned investigation.
// Even without a user-written first task, each fresh child receives a bounded question.
const firstQuestions = {
  theorist: 'Identify the physical assumptions and one limiting case that would discriminate between answers; tell the lead before extending the derivation.',
  numerics: 'Propose one small falsifiable local benchmark for the physical question, with its observable and limiting value. Do not launch a calculation without an agreed task.',
  literature: 'Identify the specific result and regime for which a source is needed. Ask the lead for a source pointer if none is named; do not begin a broad search.',
  referee: 'Ask the lead for the first named report and claim to check independently. Until one is supplied, do not invent a result or a review.',
  writer: 'Ask the lead which accepted claim and audience the first passage should address. Without an accepted report, do not draft a conclusion.',
  custom: 'Identify the part of the physical question your role card can settle and ask the lead to confirm its scope before proceeding.',
};
function seatArgs(seat, draft, dir) {
  const card = `${dir}/roles/${seat.name}.md`, area = seat.role === 'referee' ? 'reviews' : 'reports';
  const prompt = [
    `You are the ${seat.role} seat (${seat.name}). Physical question: ${draft.goal}`,
    `Done when: ${draft.doneWhen}`, `First task: ${seat.task || firstQuestions[seat.role]}`,
    `Read ${card} first, then ${dir}/state.md and the rules in ${dir}/charter.md.`,
    ...(seat.inputs?.length ? [`Task-specific inputs (read only):\n${bullets(seat.inputs)}`] : []),
    `Do not scan whole folders. If another file is needed, ask the lead for the exact path. Write only in ${dir}/work/${seat.name}/ and your own files in ${dir}/${area}/ within the charter.`,
    `Never submit a cluster job or edit a research note. Return your result, assumptions, evidence paths, actual checks and outstanding questions to the lead; use ${dir}/roles/README.md for the format.`,
    ...(seat.mode === 'one-shot' ? ['One task only; finish after reporting.'] : []),
  ].join('\n');
  const route = seat.model;
  return { name: seat.name, description: `${seat.role} for: ${shortGoal(draft.goal)}. Read ${card} first.`, prompt,
    ...(route ? { provider: route.provider, model: route.model, ...(route.effort ? { reasoning_effort: route.effort } : {}) } : {}) };
}

/** Render (never execute or write) the prepared files + exact, schema-complete
 * arguments for the lead's calls. Use the same function for preview and create. */
export function renderTeamKit(raw, { runDir, date } = {}) {
  const d = validateTeamDraft(raw), dir = text(runDir, 'run directory', { required: true, single: true }).replaceAll('\\', '/').replace(/\/+$/, '');
  if (!dir || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) invalid('Expected a run directory and calendar date (YYYY-MM-DD).');
  const seatCalls = d.seats.map((s) => seatArgs(s, d, dir));
  const callLines = seatCalls.map(({ name, description, prompt, ...route }, i) => fill(source['seat-call'].trimEnd(), {
    name: JSON.stringify(name), description: JSON.stringify(description), prompt: JSON.stringify(prompt),
    routeFields: Object.entries(route).map(([k, v]) => `, ${k}=${JSON.stringify(v)}`).join(''),
    oneShot: d.seats[i].mode === 'one-shot' ? '  (one-shot: give it one task; it finishes after reporting)' : '',
  }));
  const seatTable = [
    '| Seat | Role | Model | Mode |', '| --- | --- | --- | --- |', `| lead | lead | ${tableCell(d.leadModel ? routeLabel(d.leadModel) : 'DSH default')} | core |`,
    ...d.seats.map((s) => `| ${s.name} | ${s.role} | ${tableCell(routeLabel(s.model))} | ${s.mode} |`),
  ].join('\n');
  const files = {
    'charter.md': fill(source.charter, { teamNameYaml: JSON.stringify(d.name), date, topicPathYaml: JSON.stringify(d.topic.path), teamName: d.name, goal: d.goal, doneWhen: d.doneWhen, conventions: d.conventions || 'None specified.', seatTable, extraAllowed: bullets(d.extraAllowed), extraAsk: bullets(d.extraAsk), inputs: bullets(d.inputs) || 'None specified.' }),
    'state.md': source.state, 'roles/README.md': source['roles/README'], 'roles/lead.md': source['roles/lead'],
  };
  for (const s of d.seats) files[`roles/${s.name}.md`] = s.roleCard ? `${s.roleCard}\n` : fill(source[`roles/${s.role}`], { name: s.name });
  const brief = fill(source['lead-brief'], {
    topicTitle: d.topic.title, topicPath: d.topic.path, runDir: dir,
    startMembers: d.seats.length ? 'Start the members now, one `subagent` call each, exactly as listed. Give each its role card path and\nonly the files its first task needs, never whole folders:' : 'This charter names no members. Work as lead only; do not start a subagent.',
    seatCalls: callLines.join('\n'),
  });
  return { brief, files, seatCalls };
}
