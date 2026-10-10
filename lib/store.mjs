import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
export async function openStore(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'workspace.json');
  let state;
  try { state = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Workspace data could not be read. Preserve .local-data and restore your backup.'); state = { tasks: [], skills: [] }; }
  for (const task of state.tasks) if (task.status === 'running' || task.status === 'queued') { task.status = 'interrupted'; task.error = 'The app restarted before this task finished. Review the partial output, then create a new task.'; }
  let pending = Promise.resolve();
  const save = () => { const snapshot = JSON.stringify(state, null, 2); pending = pending.then(async () => { const temp = `${file}.tmp`; await writeFile(temp, snapshot, { mode: 0o600 }); await rename(temp, file); }); return pending; };
  await save();
  return { state, save };
}
