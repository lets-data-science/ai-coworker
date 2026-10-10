# Design and architecture

## Visual direction

A quiet, usable research task desk. The work is the center of the screen: a brief becomes a report, and the adjacent activity trail shows why the report exists. There are no invented productivity numbers, staged model responses, or decorative animated dashboards.

- Paper: `#ffffff`; workspace: `#f7f8f7`; ink: `#191a19`; muted text: `#676c68`; action accent: `#ffd12f`; completed review state: `#267354`.
- Arial/Helvetica system sans-serif: no external font requests, consistent with the simple LDS companion-app treatment. 36px main title, 20px task headings, 14px report body, 12–13px controls.
- Desktop: compact task list left, generous work surface right. Tablet keeps this hierarchy with a smaller task list. Mobile moves tasks into a horizontal strip above the work surface.
- White LDS mark sits at 43px in the header; action emphasis uses black and yellow. Green only communicates readiness or a completed run awaiting review.
- The report, source evidence, and event log are separate views of the same task. A real running-state indicator is the only unsolicited motion. Reduced-motion preference disables it.
- Keyboard focus is visible. Dialogs use native focus management, field labels are explicit, and task actions are named in plain language.

```
Brand / runtime status                                  Setup / New task
Your work, with a head start.
Task list          Brief | live activity | reviewable report
Your skills        Source notes and approved procedures
```

## Request flow

Browser → same-origin Node API → validated brief and immutable skill snapshots → isolated Python process → actual Hermes AIAgent → Gemini → restricted tools → JSON events → persisted workspace → browser polling while work is active.

The four tools are list_sources, read_source, save_report and suggest_skill. Hermes's general terminal/files/browser tools are not available. The allowlist is checked both before and after agent initialization. Tool-search indirection is disabled in this application's isolated Hermes profile so an upstream change cannot silently expand the surface.

The Python tool handlers expose only task payload data. They never accept a host path. Reports are passed back as text, validated by Node, and stored with the task. A filename is a display/download name, never a filesystem target supplied by the model.

## Why a skill library

Hermes can support autonomous persistent memory in its wider product. This course intentionally teaches a narrower, inspectable pattern. The learner approves a short procedure, selects it for the next run, and can edit or remove it later. A task records the exact selected version so a later edit cannot rewrite history. This is application-managed procedural memory around Hermes, not a claim that the model's weights change or every Hermes memory feature is implemented.

## Reliability boundaries

Local single-user process; JSON snapshots are atomically replaced. Only one agent runs at once. App restart marks unfinished work interrupted. A successful final response is insufficient: the agent must complete and save exactly one report. Partial reports remain accessible but are labeled as partial. Provider errors remain failures. No automatic retry spends more quota.

The dependency pin is in lib/hermes.mjs. requirements.lock pins the tested Python environment. No unrelated root-project services, email credentials, Supabase keys, or personal folders are passed to the bridge. Native dependency wheels are platform-specific; Windows/Linux installation needs independent verification before release claims are made.
