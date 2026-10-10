import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSkills } from '../learner/skills.mjs';
const skill = { id: 'one', title: 'Cite evidence', instructions: 'Cite every claim.', version: 1, approved: true };
test('only approved chosen skills enter a new task', () => { assert.deepEqual(selectSkills([skill], []), []); assert.throws(() => selectSkills([{ ...skill, approved: false }], ['one']), /not approved/); assert.throws(() => selectSkills([skill], ['missing']), /missing/); });
test('reject duplicate selections and more than three', () => { assert.throws(() => selectSkills([skill], ['one', 'one']), /once/); assert.throws(() => selectSkills([], ['a', 'b', 'c', 'd']), /three/); });
test('task snapshots survive later skill edits', () => { const input = { ...skill }; const [snapshot] = selectSkills([input], ['one']); input.instructions = 'Changed'; assert.equal(snapshot.instructions, skill.instructions); assert.equal(snapshot.version, 1); });
