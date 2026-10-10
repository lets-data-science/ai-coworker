# AI Coworker

An LDS build-along project: build a local task desk around the **real Hermes Agent** runtime. Give it a brief and source notes, review the report and tool history, then turn a correction into a reusable skill you approve.

The local app is a learning project, not the hosted LDS website. Version **1.0.0**. Built by LDS Team.

## Start here

Requirements: Node.js 22.13+, Git, current [uv](https://docs.astral.sh/uv/getting-started/installation/), and access to a Gemini model. The Hermes environment uses **stable Python 3.14**; setup installs it locally when needed. Network access is needed for installation and model calls. Windows PowerShell, macOS, and Linux commands are the same.

```bash
npm ci
npm run setup
npm run setup:hermes
```

Open `.env.local` in your editor. Add your own `GEMINI_API_KEY`, then:

```bash
npm start
```

Open **http://localhost:3081**. Follow [the seven-step guide](docs/BUILD.md). If another app uses 3081, change `PORT` in `.env.local` and restart. No application framework or build service is required for the UI.

- `npm test` runs offline unit/API tests. They use explicit test adapters, not paid model calls.
- `npm run check` adds JavaScript syntax checks.
- `npm run check:brief`, `check:skills`, and `check:result` check the three learner functions.
- `npm run restore -- brief` restores one completed checkpoint after backing up your work.

The completed reference contains finished `learner/` files. Starter packages replace those three files with the corresponding `teaching/starter/` files; everything else stays the same. The starter UI runs immediately, but Start task correctly reports an unfinished learner function until the exercise is implemented. Restore one checkpoint at a time if stuck.

## What actually runs

The Node server starts a Python subprocess that imports `run_agent.AIAgent` from a pinned official Hermes revision. Hermes runs its real model/tool loop with Gemini's OpenAI-compatible API. Four application tools let it list supplied notes, read notes, save one Markdown report, and suggest one skill. No model shortcut or scripted success response substitutes for Hermes.

The skill library is this application's explicit, human-approved procedural memory. It illustrates reuse across Hermes tasks without enabling Hermes's autonomous host memory, terminal, web browsing, or general file tools. A saved skill is a prompt procedure, **not model training**. No agent is allowed to self-approve a skill.

## Data and usage

- The server binds only to `127.0.0.1`. It rejects cross-origin mutations and unexpected Host headers.
- Source notes, task history, reports, and skills are stored in `.local-data/` on this computer. They are not uploaded to LDS.
- When you click Start task, your brief, selected skill text, and source notes read by the agent go to your configured Gemini provider. Provider billing and data policies apply.
- One active task, up to five pending/running tasks, eight agent iterations, and a two-minute run budget. These are limits, not a monetary spending guarantee. Cancellation does not refund an API call already in progress.
- The bridge gets an allowlisted environment, not every key from your shell. Credentials never enter the browser or downloaded report by design.
- Supplied text can still contain prompt injection. Tools are restricted in code; the prompt alone is not a security boundary. Citation IDs are checked, but humans must verify that cited notes actually support each claim.
- No email, external posting, background schedules, or access to arbitrary folders is included.
- This is a trusted single-user local app, not a multi-tenant hosted service. Do not expose its port to a public network.

## Files

| Location | Purpose |
| --- | --- |
| `learner/brief.mjs` | Evidence boundary and selected-skill prompt |
| `learner/skills.mjs` | Validate selections and freeze skill versions |
| `learner/result.mjs` | Honest completed/partial/cancelled classification |
| `bridge/hermes_runner.py` | Actual Hermes integration and four restricted tools |
| `lib/hermes.mjs` | Isolated process, timeout, explicit environment |
| `server.mjs` | Local API, queue, storage, download, origin checks |
| `ui/` | Responsive task desk, activity, report, source and skill views |
| `requirements.lock` | Tested Python dependency pins |
| `.runtime/` | Downloaded Hermes and Python runtime; excluded from releases |
| `.local-data/` | Your local workspace; excluded from releases |

## License and upstream

LDS code is [Apache 2.0](LICENSE). Hermes is an independently installed MIT-licensed dependency. See [NOTICE](NOTICE). Logos and project names do not imply Nous Research or Google endorsement.

Official references: [Hermes programmatic integration](https://hermes-agent.nousresearch.com/docs/developer-guide/programmatic-integration), [Hermes tools runtime](https://hermes-agent.nousresearch.com/docs/developer-guide/tools-runtime), [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai).
