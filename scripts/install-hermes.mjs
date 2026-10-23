import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERMES_REVISION } from '../lib/hermes.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const runtime = path.join(root, '.runtime');
const source = path.join(runtime, 'hermes-agent');
const venv = path.join(runtime, 'venv');
const python = path.join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
mkdirSync(runtime, { recursive: true });
// Keep Python, its launchers and the cache inside .runtime/, never in the user's own bin folder.
const env = { ...process.env, UV_PYTHON_INSTALL_DIR: path.join(runtime, 'python'), UV_PYTHON_INSTALL_BIN: '0', UV_PYTHON_BIN_DIR: path.join(runtime, 'bin'), UV_CACHE_DIR: path.join(runtime, 'uv-cache') };
function run(command, args) { const result = spawnSync(command, args, { env, stdio: 'inherit', cwd: root, shell: false }); if (result.error || result.status !== 0) { console.error(`Setup stopped at ${command}. Install current Git and uv, check network access, then rerun this command. Existing data was kept.`); process.exit(1); } }
if (!existsSync(path.join(source, '.git'))) run('git', ['clone', '--filter=blob:none', '--no-checkout', 'https://github.com/NousResearch/hermes-agent.git', source]);
run('git', ['-C', source, 'fetch', '--depth', '1', 'origin', HERMES_REVISION]);
run('git', ['-C', source, 'checkout', '--detach', HERMES_REVISION]);
run('uv', ['python', 'install', '3.14']);
if (!existsSync(python)) run('uv', ['venv', '--python', '3.14', venv]);
// An older uv picks a 3.14 release candidate; Hermes needs the final release.
const probe = spawnSync(python, ['-c', 'import sys; print(sys.version.split()[0], sys.version_info.releaselevel)'], { encoding: 'utf8' });
const [found = 'unknown', level = ''] = (probe.stdout || '').trim().split(' ');
if (probe.status !== 0 || level !== 'final') {
  console.error([
    `Hermes needs a stable Python 3.14 release, but .runtime/venv has Python ${found}.`,
    'Your uv is older than the final Python 3.14 release, so it chose a release candidate. To fix it:',
    '  1. Update uv: uv self update (if you installed uv with Homebrew or pip, update it that way)',
    '  2. Delete the .runtime/venv folder',
    '  3. Run npm run setup:hermes again',
  ].join('\n'));
  process.exit(1);
}
run('uv', ['pip', 'install', '--python', python, '-r', path.join(root, 'requirements.lock')]);
run('uv', ['pip', 'install', '--python', python, '--no-deps', '-e', source]);
console.log('Hermes is installed in .runtime/. Add GEMINI_API_KEY to .env.local, then run npm start.');
