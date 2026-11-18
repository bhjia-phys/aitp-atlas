import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEAM_PRESETS, validateTeamDraft, renderTeamKit } from '../lib/team-templates.js';

// Synthetic charter; none of these paths need to exist. Rendering must never open them.
const dir = '/fixture/runs/team-20261118-limit';
const at = { runDir: dir, date: '2026-11-18' };
const topic = { id: '', title: 'Synthetic research', path: '/fixture/research.md' };
const seat = { name: 'theorist', role: 'theorist', task: 'Derive the zero-frequency limit.' };
const draft = { name: 'Limit check', goal: 'Does the limit commute?', doneWhen: 'Both orders of limits are compared.', topic,
  conventions: 'Natural units.', extraAsk: ['A web download.'], extraAllowed: [], inputs: ['equations.md', 'spectrum.csv'],
  seats: [{ ...seat, inputs: ['equations.md'] }, { name: 'numerics', role: 'numerics', mode: 'one-shot', model: { provider: 'demo', model: 'local', effort: 'high' } }, { name: 'referee', role: 'referee', model: { provider: 'other', model: 'independent' } }], template: 'theory-numerics' };

function examplePrompt(name, role, task, inputs, oneShot) {
  return [
    `You are the ${role} seat (${name}). Physical question: Does the limit commute?`,
    'Done when: Both orders of limits are compared.', `First task: ${task}`,
    `Read ${dir}/roles/${name}.md first, then ${dir}/state.md and the rules in ${dir}/charter.md.`,
    ...(inputs ? ['Task-specific inputs (read only):\n- equations.md'] : []),
    `Do not scan whole folders. If another file is needed, ask the lead for the exact path. Write only in ${dir}/work/${name}/ and your own files in ${dir}/${role === 'referee' ? 'reviews' : 'reports'}/ within the charter.`,
    `Never submit a cluster job or edit a research note. Return your result, assumptions, evidence paths, actual checks and outstanding questions to the lead; use ${dir}/roles/README.md for the format.`,
    ...(oneShot ? ['One task only; finish after reporting.'] : []),
  ].join('\n');
}

test('a three-member lead brief uses exact, ordered native calls, not placeholders or seat descriptions as prompts', () => {
  const kit = renderTeamKit(draft, at);
  const expected = [
    ['theorist', 'Derive the zero-frequency limit.', true, false, {}],
    ['numerics', 'Propose one small falsifiable local benchmark for the physical question, with its observable and limiting value. Do not launch a calculation without an agreed task.', false, true, { provider: 'demo', model: 'local', reasoning_effort: 'high' }],
    ['referee', 'Ask the lead for the first named report and claim to check independently. Until one is supplied, do not invent a result or a review.', false, false, { provider: 'other', model: 'independent' }],
  ].map(([name, task, inputs, oneShot, route]) => ({ name, description: `${name} for: Does the limit commute?. Read ${dir}/roles/${name}.md first.`, prompt: examplePrompt(name, name, task, inputs, oneShot), ...route }));
  assert.deepEqual(kit.seatCalls, expected);
  const lines = expected.map((call, i) => `- subagent(${Object.entries(call).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')})${i === 1 ? '  (one-shot: give it one task; it finishes after reporting)' : ''}`);
  assert.deepEqual(kit.brief.split('\n').filter((l) => l.startsWith('- subagent(')), lines);
  // The specified lead template is preserved around two deliberate adaptations:
  // the tool now requires prompt, and the brief foregrounds the physics rather than a queue.
  const approved = readFileSync(new URL('../design/1.0/team-templates/lead-brief.md', import.meta.url), 'utf8');
  const physics = "For a listed call with no route fields (Same as the lead), omit them; use DSH's inherited or\nconfigured child route. Check that this session can actually call `subagent` with the listed\nfields. If a seat or route cannot start, report the failure and stop that branch. Do not\nsubstitute another tool, seat or model, or treat a catalog entry as proof of permission.\n\nPut the physics first. State the physical question, assumptions and conventions before choosing a\nmethod. Explain which limit, derivation, measurement or source would distinguish the alternatives.\nThe board records that agreed work; it is not an instruction to invent more tasks. Do not start\nadditional seats, pursue a new branch or change the success criterion without the researcher.\nName an independent review task `Review RNN: <check>` with the actual report id, so its reviewer\nand the researcher can tell which claim is being tested.\n\n";
  assert.equal(kit.brief, approved.replaceAll('{{topicTitle}}', topic.title).replaceAll('{{topicPath}}', topic.path).replaceAll('{{runDir}}', dir).replace('{{seatCalls}}', () => lines.join('\n')).replace('Then:', physics + 'Then:'));
  assert.doesNotMatch(kit.brief, /spectrum\.csv/);
  assert.ok(kit.files['charter.md'].includes('- spectrum.csv'), 'full inventory belongs to the charter, not the delegation prompt');
  assert.deepEqual(kit, renderTeamKit(validateTeamDraft(draft), at), 'same result for preview, validated create and retry');
});

test('shipped presets include the approved positions; each run materializes only its named cards', () => {
  assert.deepEqual(TEAM_PRESETS.map((p) => [p.id, ...p.seats.map((s) => s.name)]), [
    ['derive-check', 'theorist', 'referee'], ['theory-numerics', 'theorist', 'numerics', 'referee'],
    ['literature-survey', 'literature', 'literature-2', 'referee'], ['write-up', 'writer', 'referee'], ['custom'],
  ]);
  const kit = renderTeamKit({ ...draft, seats: TEAM_PRESETS[2].seats }, at);
  assert.deepEqual(Object.keys(kit.files).sort(), ['charter.md', 'roles/README.md', 'roles/lead.md', 'roles/literature-2.md', 'roles/literature.md', 'roles/referee.md', 'state.md']);
  assert.match(kit.files['roles/literature-2.md'], /Only `work\/literature-2\//);
  for (const card of ['lead', 'literature', 'referee', 'README']) {
    const doc = readFileSync(new URL(`../design/1.0/team-templates/roles/${card}.md`, import.meta.url), 'utf8');
    assert.equal(kit.files[`roles/${card}.md`], doc.replaceAll('{{name}}', card));
  }
  assert.equal(kit.files['state.md'], readFileSync(new URL('../design/1.0/team-templates/state.md', import.meta.url), 'utf8'));
  assert.match(kit.files['charter.md'], /Any edit to a note: proposed by the lead only, reviewed by me in Atlas/);
  assert.match(kit.files['charter.md'], /Any cluster job: the lead writes the exact command as a decision request and waits/);
  assert.match(kit.files['charter.md'], /\| literature-2 \| literature \| Same as the lead \| core \|/);
  const solo = renderTeamKit({ ...draft, seats: [] }, at);
  assert.deepEqual(solo.seatCalls, []);
  assert.match(solo.brief, /Work as lead only; do not start a subagent/);
  assert.doesNotMatch(solo.brief, /Start the members now|subagent\(name=/);
});

test('inputs remain literal: YAML metadata, role cards, scientific formulas and quoted model ids', () => {
  const weird = { ...draft, name: 'Test: "A # B"', topic: { ...topic, path: 'C:\\x #1\\research.md' }, goal: '$& and {{seatCalls}}\nWhy?',
    seats: [{ name: 'critical', role: 'custom', roleCard: 'Only test the {{name}} symbol.', task: 'Compare "small" and $&.', model: { provider: 'test', model: 'local|v1' } }] };
  const kit = renderTeamKit(weird, { ...at, runDir: 'C:\\x #1\\runs\\test' });
  const md = kit.files['charter.md'];
  assert.equal(md.split('\n')[2], `team: ${JSON.stringify(weird.name)}`);
  assert.equal(md.split('\n')[4], `topic: ${JSON.stringify(weird.topic.path)}`);
  assert.ok(md.includes('test/local\\|v1'));
  assert.equal(kit.files['roles/critical.md'], 'Only test the {{name}} symbol.\n');
  assert.ok(kit.brief.includes('Compare \\"small\\" and $&.'));
  assert.ok(kit.seatCalls[0].prompt.includes('Read C:/x #1/runs/test/roles/critical.md first'));
  const long = 'A field '.repeat(20) + 'diverges.';
  const call = renderTeamKit({ ...draft, goal: long }, at).seatCalls[0];
  assert.match(call.description, /^theorist for: (?:A field ){14}A field\. Read /);
  assert.ok(call.prompt.includes(long), 'the display cut never truncates the actual question');
});

test('invalid drafts fail before any preparation, including unsafe file collisions and unscoped inputs', () => {
  const rejects = (d) => assert.throws(() => renderTeamKit(d, at), (e) => e.code === 'INVALID_TEAM' && e.statusCode === 400);
  for (const name of ['lead', 'Lead', 'CON', 'aux', 'nul', 'readme', 'com2', 'lpt9', 'a.b', '../outside', 'a/b', 'a b', 'a'.repeat(33)]) rejects({ ...draft, seats: [{ ...seat, name }] });
  for (const seats of [[seat, seat], ['../name'], [{ ...seat, role: '../lead' }], [{ ...seat, role: 'custom' }], [{ ...seat, mode: 'auto' }],
    [{ ...seat, model: { effort: 'high' } }], [{ ...seat, model: { provider: 'local' } }], [{ ...seat, inputs: ['undeclared.md'] }],
    [{ ...seat, task: 'bad\0task' }]]) rejects({ ...draft, seats });
  for (const more of [{ seats: null }, { topic: null }, { goal: ' ' }, { doneWhen: '' }, { template: 'unknown' }, { inputs: 'notes' }, { name: 'Name\n---' },
    { inputs: ['../'], seats: [{ ...seat, inputs: ['../'] }] }]) rejects({ ...draft, ...more });
  for (const date of ['not-date', '2026-02-31', '2026-11-18\nextra']) assert.throws(() => renderTeamKit(draft, { ...at, date }), /calendar date/);
});
