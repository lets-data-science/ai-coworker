import { spawn } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
export const HERMES_REVISION = '158fd638da1629c8e62caf9ade1515d162def8ab';
export function runtimeConfig(root) {
  return {
    source: process.env.HERMES_SOURCE_DIR || path.join(root, '.runtime', 'hermes-agent'),
    python: process.env.HERMES_PYTHON || path.join(root, '.runtime', 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'),
  };
}
export async function runtimeStatus(root) {
  const config = runtimeConfig(root);
  let installed = true;
  try { await Promise.all([access(config.python), access(path.join(config.source, 'run_agent.py'))]); } catch { installed = false; }
  return { installed, configured: Boolean(process.env.GEMINI_API_KEY), model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', ready: installed && Boolean(process.env.GEMINI_API_KEY), revision: HERMES_REVISION };
}
export async function runHermes(root, dataDir, payload, onEvent) {
  const config = runtimeConfig(root);
  const home = path.join(dataDir, 'hermes');
  await mkdir(home, { recursive: true, mode: 0o700 });
  await writeFile(path.join(home, 'config.yaml'), 'tools:\n  tool_search:\n    enabled: \"off\"\n', { mode: 0o600 });
  // Explicit environment allowlist: unrelated LDS service keys never enter Hermes.
  const env = Object.fromEntries(['PATH', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'LANG', 'SSL_CERT_FILE'].filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  Object.assign(env, { HERMES_HOME: home, HERMES_SOURCE_DIR: config.source, GEMINI_API_KEY: process.env.GEMINI_API_KEY || '', GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash', PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8', HERMES_MAX_ITERATIONS: '8', HERMES_DISABLE_TELEMETRY: '1' });
  const child = spawn(config.python, [path.join(root, 'bridge/hermes_runner.py')], { cwd: home, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let pending = '', stderr = '', outputBytes = 0, ended = false;
  const timeout = setTimeout(() => { if (!ended) { onEvent({ kind: 'error', message: 'The two-minute run limit was reached. Review any partial report before trying again.' }); child.kill('SIGKILL'); } }, 125000);
  child.stdout.on('data', (chunk) => {
    outputBytes += chunk.length;
    if (outputBytes > 400000) { child.kill('SIGKILL'); return; }
    pending += chunk.toString('utf8');
    let newline;
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
      try { onEvent(JSON.parse(line)); } catch { /* Third-party noise is not trusted protocol data. */ }
    }
  });
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-2000); });
  const done = new Promise((resolve) => {
    child.on('error', () => { onEvent({ kind: 'error', message: 'The Hermes Python runtime could not start. Run npm run setup:hermes.' }); });
    child.on('close', (code) => { ended = true; clearTimeout(timeout); resolve({ code, diagnosticAvailable: Boolean(stderr), diagnostic: stderr.replaceAll(process.env.GEMINI_API_KEY || 'NO_API_KEY', '[redacted]') }); });
  });
  child.stdin.on('error', () => {});
  child.stdin.end(JSON.stringify(payload));
  return { done, cancel: () => child.kill('SIGKILL') };
}
