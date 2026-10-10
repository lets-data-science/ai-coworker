import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server.mjs';
import { taskInput, safeName } from '../lib/validation.mjs';
const input = { title: 'A useful comparison', prompt: 'Compare these products using the source evidence.', sources: [{ title: 'Product A', content: 'Product A runs locally and exports CSV.' }], skillIds: [] };
async function app(t, options = {}) { const dir = await mkdtemp(path.join(os.tmpdir(), 'lds-coworker-test-')); const application = await createApp({ dataDir: dir, getRuntime: async () => ({ ready: true }), ...options }); await new Promise((resolve) => application.server.listen(0, '127.0.0.1', resolve)); const base = `http://127.0.0.1:${application.server.address().port}`; t.after(async () => { await application.close(); await rm(dir, { recursive: true, force: true }); }); return { ...application, base, dir, post: (url, value) => fetch(base + url, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify(value) }), state: async () => (await fetch(base + '/api/state')).json() }; }
async function settled(workspace) { for (let i = 0; i < 60; i++) { const state = await workspace.state(); if (state.tasks[0] && !['running', 'queued'].includes(state.tasks[0].status)) return state; await new Promise((resolve) => setTimeout(resolve, 15)); } throw new Error('Task did not settle.'); }
test('API enforces same-origin JSON before mutating', async (t) => { const workspace = await app(t); const response = await fetch(workspace.base + '/api/skills', { method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' }, body: JSON.stringify({ title: 'bad', instructions: 'do bad things now' }) }); assert.equal(response.status, 403); assert.equal((await workspace.state()).skills.length, 0); });
test('missing provider setup creates no task and never calls runner', async (t) => { const workspace = await app(t, { getRuntime: async () => ({ ready: false }), runner: () => { throw new Error('must not run'); } }); assert.equal((await workspace.post('/api/tasks', input)).status, 409); assert.equal((await workspace.state()).tasks.length, 0); });
test('real lifecycle plumbing saves report, activity, approved skill snapshots and download', async (t) => {
  const workspace = await app(t, { runner: async (payload, emit) => { assert.match(payload.brief, /Keep the table first/); emit({ kind: 'action', tool: 'read_source', phase: 'completed', detail: 'S1' }); emit({ kind: 'artifact', filename: 'brief.md', content: '# Comparison\n\nProduct A runs locally [S1].' }); emit({ kind: 'result', completed: true, response: 'Report ready.' }); return { done: Promise.resolve({ code: 0 }), cancel() {} }; } });
  const saved = await (await workspace.post('/api/skills', { title: 'Comparison format', instructions: 'Keep the table first in every comparison.' })).json();
  const response = await workspace.post('/api/tasks', { ...input, skillIds: [saved.skill.id] }); assert.equal(response.status, 201); const id = (await response.json()).id;
  const state = await settled(workspace); assert.equal(state.tasks[0].status, 'completed'); assert.equal(state.tasks[0].skills[0].version, 1); assert.ok(state.tasks[0].events.some((event) => event.title === 'read_source: completed'));
  await workspace.post('/api/skills', { id: saved.skill.id, title: 'Comparison format', instructions: 'Explain the conclusion before the table.' });
  assert.equal((await workspace.state()).tasks[0].skills[0].version, 1);
  const download = await fetch(workspace.base + `/api/report?task=${id}`); assert.match(download.headers.get('content-disposition'), /brief.md/); assert.match(await download.text(), /\[S1\]/);
  assert.equal(JSON.parse(await readFile(path.join(workspace.dir, 'workspace.json'), 'utf8')).tasks[0].status, 'completed');
});
test('partial provider output remains failed even when a report was written', async (t) => { const workspace = await app(t, { runner: async (_, emit) => { emit({ kind: 'artifact', filename: 'partial.md', content: 'A partial result requiring human review [S1].' }); emit({ kind: 'result', completed: false, partial: true }); return { done: Promise.resolve(), cancel() {} }; } }); await workspace.post('/api/tasks', input); const state = await settled(workspace); assert.equal(state.tasks[0].status, 'failed'); assert.equal(state.tasks[0].artifacts.length, 1); });
test('cancellation stops a running task without marking it completed', async (t) => { let finish, cancelled = false; const workspace = await app(t, { runner: async () => ({ done: new Promise((resolve) => { finish = resolve; }), cancel() { cancelled = true; finish(); } }) }); const created = await (await workspace.post('/api/tasks', input)).json(); await workspace.post('/api/cancel', { id: created.id }); const state = await settled(workspace); assert.equal(state.tasks[0].status, 'cancelled'); assert.equal(cancelled, true); });
test('input and artifact paths are bounded', () => { assert.throws(() => safeName('../secret.md')); assert.throws(() => safeName('report.html')); assert.equal(safeName('report-1.md'), 'report-1.md'); assert.throws(() => taskInput({ ...input, sources: [] })); assert.throws(() => taskInput({ ...input, sources: Array(7).fill(input.sources[0]) })); });

for (const failure of ['nonzero exit', 'late bridge error', 'missing exit status']) {
  test(`a completed provider message cannot hide ${failure}`, async (t) => {
    const workspace = await app(t, { runner: async (_, emit) => {
      emit({ kind: 'artifact', filename: 'review.md', content: 'A report that still needs a clean runtime exit [S1].' });
      emit({ kind: 'result', completed: true });
      if (failure === 'late bridge error') emit({ kind: 'error', message: 'Runtime cleanup failed.' });
      return { done: Promise.resolve(failure === 'missing exit status' ? undefined : { code: failure === 'nonzero exit' ? 1 : 0 }), cancel() {} };
    } });
    await workspace.post('/api/tasks', input);
    const state = await settled(workspace);
    assert.equal(state.tasks[0].status, 'failed');
    assert.equal(state.tasks[0].artifacts.length, 1, 'Keep the partial report for review');
  });
}
