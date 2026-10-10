import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyResult } from '../learner/result.mjs';
test('a completed result needs one report and no error/partial flag', () => { assert.equal(classifyResult({ completed: true }, 1), 'completed'); for (const result of [{}, { completed: true, error: true }, { completed: true, partial: true }, { completed: false, response: 'looks done' }]) assert.equal(classifyResult(result, 1), 'failed'); for (const count of [0, 2]) assert.equal(classifyResult({ completed: true }, count), 'failed'); });
test('interruption is never completion', () => { assert.equal(classifyResult({ interrupted: true, completed: true }, 1), 'cancelled'); });
