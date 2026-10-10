import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { openStore } from './lib/store.mjs';
import { taskInput, skillInput, safeName } from './lib/validation.mjs';
import { buildBrief } from './learner/brief.mjs';
import { selectSkills } from './learner/skills.mjs';
import { classifyResult } from './learner/result.mjs';
import { runtimeStatus, runHermes } from './lib/hermes.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
export async function createApp({ dataDir = path.join(ROOT, '.local-data'), getRuntime = () => runtimeStatus(ROOT), runner = (payload, onEvent) => runHermes(ROOT, dataDir, payload, onEvent) } = {}) {
  const store = await openStore(dataDir);
  let active = null;
  const event = (task, title, detail = '') => { task.events.push({ id: randomUUID(), at: new Date().toISOString(), title, detail }); };
  async function processQueue() {
    if (active) return;
    const task = store.state.tasks.find((item) => item.status === 'queued');
    if (!task) return;
    task.status = 'running'; task.startedAt = new Date().toISOString(); active = { task, cancel: null };
    event(task, 'Run started', 'Hermes receives this brief, your supplied notes, and the selected skill versions.');
    await store.save();
    let result;
    try {
      const handle = await runner({ sources: task.sources, prompt: task.prompt, brief: task.brief }, (message) => {
        if (task.status === 'cancelled') return;
        if (message.kind === 'ready') event(task, 'Hermes connected', 'Four scoped tools. No shell or general filesystem access.');
        else if (message.kind === 'action') event(task, `${message.tool}: ${message.phase}`, String(message.detail || '').slice(0, 200));
        else if (message.kind === 'artifact') { const filename = safeName(message.filename); if (typeof message.content !== 'string' || message.content.length > 30000 || task.artifacts.length) throw new Error('Invalid report event.'); task.artifacts.push({ filename, content: message.content }); }
        else if (message.kind === 'suggestion') task.suggestion = skillInput(message);
        else if (message.kind === 'result') { result = message; task.response = String(message.response || '').slice(0, 30000); }
        else if (message.kind === 'error') task.error = String(message.message || 'The agent run failed.').slice(0, 400);
        void store.save();
      });
      active.cancel = handle.cancel;
      if (task.status === 'cancelled') handle.cancel();
      const exit = await handle.done;
      if (task.status !== 'cancelled') {
        task.status = classifyResult({ ...result, error: Boolean(result?.error || task.error || exit?.code !== 0) }, task.artifacts.length);
        if (task.status !== 'completed' && !task.error) task.error = 'The agent did not finish a complete report within this run. Any partial output needs review.';
      }
    } catch { task.status = 'failed'; task.error = 'This run could not finish. Check your setup and learner functions before trying again.'; }
    task.finishedAt = new Date().toISOString();
    event(task, task.status === 'completed' ? 'Ready for your review' : `Run ${task.status}`, task.error || 'Check every claim against the source notes.');
    active = null;
    await store.save();
    void processQueue();
  }
  const server = http.createServer(async (req, res) => {
    const allowedHosts = new Set([`localhost:${server.address()?.port}`, `127.0.0.1:${server.address()?.port}`]);
    if (!allowedHosts.has(req.headers.host)) { res.writeHead(403); res.end('Local access only'); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      let body;
      if (req.method === 'POST') {
        if (req.headers.origin !== `http://${req.headers.host}` || !String(req.headers['content-type']).startsWith('application/json')) return json(403, { error: 'Open the local app to make changes.' });
        let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 80000) return json(413, { error: 'This request is too large.' }); }
        try { body = JSON.parse(raw); } catch { return json(400, { error: 'The request must contain valid JSON.' }); }
      }
      if (req.method === 'GET' && url.pathname === '/api/state') return json(200, { ...store.state, runtime: await getRuntime() });
      if (req.method === 'POST' && url.pathname === '/api/tasks') {
        const runtime = await getRuntime();
        if (!runtime.ready) return json(409, { error: 'Set up Hermes and your Gemini key first. Your task has not been sent.' });
        if (store.state.tasks.length >= 100) return json(409, { error: 'This workspace has reached 100 tasks. Back up .local-data and start a separate workspace.' });
        if (store.state.tasks.filter((item) => ['queued', 'running'].includes(item.status)).length >= 5) return json(409, { error: 'Five tasks are already in progress. Wait or cancel one.' });
        const input = taskInput(body); const skills = selectSkills(store.state.skills, body.skillIds || []); const brief = buildBrief(input, skills);
        const task = { ...input, id: randomUUID(), status: 'queued', createdAt: new Date().toISOString(), skills, brief, events: [], artifacts: [] };
        event(task, 'Task added', `${input.sources.length} source notes · ${skills.length} approved skills selected`);
        store.state.tasks.push(task); await store.save(); void processQueue(); return json(201, { id: task.id });
      }
      if (req.method === 'POST' && url.pathname === '/api/cancel') {
        const task = store.state.tasks.find((item) => item.id === body.id);
        if (!task) return json(404, { error: 'Task not found.' });
        if (['running', 'queued'].includes(task.status)) { task.status = 'cancelled'; event(task, 'Cancelled by you', 'A request already sent to the model may still incur usage.'); if (active?.task.id === task.id) active.cancel?.(); await store.save(); }
        return json(200, { ok: true });
      }
      if (req.method === 'POST' && url.pathname === '/api/skills') {
        const input = skillInput(body); const old = body.id && store.state.skills.find((item) => item.id === body.id);
        if (body.id && !old) return json(404, { error: 'Skill not found.' });
        if (!old && store.state.skills.length >= 30) return json(409, { error: 'Keep up to 30 focused skills in this workspace.' });
        const skill = { ...input, id: old?.id || randomUUID(), approved: true, version: (old?.version || 0) + 1, updatedAt: new Date().toISOString() };
        if (old) store.state.skills[store.state.skills.indexOf(old)] = skill; else store.state.skills.push(skill);
        await store.save(); return json(200, { skill });
      }
      if (req.method === 'POST' && url.pathname === '/api/skills/remove') {
        store.state.skills = store.state.skills.filter((item) => item.id !== body.id); await store.save(); return json(200, { ok: true });
      }
      if (req.method === 'GET' && url.pathname === '/api/report') {
        const task = store.state.tasks.find((item) => item.id === url.searchParams.get('task'));
        const report = task?.artifacts[0]; if (!report) return json(404, { error: 'Report not found.' });
        res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${safeName(report.filename)}"` }); res.end(report.content); return;
      }
      if (req.method === 'GET' && ['/', '/app.js', '/style.css', '/lds-logo.svg'].includes(url.pathname)) {
        const filename = url.pathname === '/' ? 'index.html' : url.pathname.slice(1); const content = await readFile(path.join(ROOT, 'ui', filename)); res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] }); res.end(content); return;
      }
      json(404, { error: 'Not found.' });
    } catch (error) { json(400, { error: error.message || 'Check your input and try again.' }); }
  });
  return { server, close: async () => { if (active) { active.task.status = 'interrupted'; active.cancel?.(); } await store.save(); await new Promise((resolve) => server.close(resolve)); } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await createApp();
  const port = Number(process.env.PORT || 3081);
  app.server.listen(port, '127.0.0.1', () => console.log(`AI Coworker: http://localhost:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0); });
}
