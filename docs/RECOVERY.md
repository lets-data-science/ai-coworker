# Recovery

Stop the server with Ctrl+C before changing its learner modules.

Each checkpoint restores exactly one file and saves your previous version in `.backups/`:

```bash
npm run restore -- brief
npm run check:brief
npm run restore -- skills
npm run check:skills
npm run restore -- result
npm run check:result
npm run check
npm start
```

Do not restore all files by default: inspect the failing function and test first.

Keep `.local-data/` for your tasks, reports and approved skills. Back up that whole folder while the server is stopped. If JSON data is damaged, preserve the original folder and use your last known-good backup; do not erase it to make the error go away. A task interrupted by a server restart must be reviewed before deliberately rerunning it.

The dependency environment can be recreated without deleting task data. Extract a clean reference package into a separate folder and run setup there. Add only your own key and, if wanted, copy the backed-up `.local-data/` while both servers are stopped. Never copy runtime data or credentials into public releases.
