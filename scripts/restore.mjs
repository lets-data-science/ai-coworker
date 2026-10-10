import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const name = process.argv[2];
if (!['brief', 'skills', 'result'].includes(name)) { console.error('Usage: npm run restore -- brief|skills|result'); process.exitCode = 1; }
else { await mkdir(path.join(root, '.backups'), { recursive: true }); await copyFile(path.join(root, 'learner', `${name}.mjs`), path.join(root, '.backups', `${name}-${Date.now()}.mjs`)); await copyFile(path.join(root, 'checkpoints', `${name}.mjs`), path.join(root, 'learner', `${name}.mjs`)); console.log(`Restored ${name}; your previous work is in .backups/. Run npm run check:${name}, then restart npm start.`); }
