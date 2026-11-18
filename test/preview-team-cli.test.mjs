import assert from 'node:assert/strict';
import test from 'node:test';
import { previewCliOptions } from '../scripts/preview.mjs';

// No DSH or fixture on disk: exercise the same setup callback invoked by main.
const fx = { root: 'synthetic-fixture-placeholder' };
test('ordinary and debug preview never enable team tools', () => {
  for (const args of [[], ['--debug']]) {
    const opts = previewCliOptions(args);
    assert.equal(opts.debug, args.includes('--debug'));
    assert.equal(opts.prepare({ fx, model: {} }), '');
  }
});
test('team mode enables exactly the tested two-seat scenario, with reproducible operator steps', () => {
  for (const args of [['--team'], ['--team', '--debug'], ['--debug', '--team']]) {
    const calls = [], opts = previewCliOptions(args);
    const text = opts.prepare({ fx, model: { enableFixtureTeam: (...a) => calls.push(a) } });
    assert.deepEqual(calls, [[fx.root, 'numerics']]);
    assert.equal(opts.debug, args.includes('--debug'));
    for (const requirement of ['Check the fixture limiting coefficient and convention.', 'Both named fixture seats have read their independent role cards.', 'mc/worm', 'Theory and numerics', 'remove “theorist”', 'numerics and referee', 'Same as the lead']) assert.ok(text.includes(requirement), requirement);
  }
});
test('team flag cannot take an external path, host, worker, or duplicated switch', () => {
  for (const args of [['--team', 'external'], ['--team', '--host', 'other'], ['--team', '--worker'], ['--team', '--team'], ['--team=external']]) assert.throws(() => previewCliOptions(args), /Usage:/);
});
