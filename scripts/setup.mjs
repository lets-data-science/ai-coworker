import { copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try { await access(path.join(root, '.env.local')); console.log('Your existing .env.local was kept.'); }
catch { await copyFile(path.join(root, '.env.example'), path.join(root, '.env.local')); console.log('Created .env.local. Add your own Gemini key there.'); }
console.log('Next: npm run setup:hermes. Then npm start.');
