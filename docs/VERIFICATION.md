# Verification record

Local verification on 2026-10-03. This is an evidence record, not a claim of universal production readiness.

- Node 23.7.0; real HTTP API tests passed on localhost.
- Hermes source: `158fd638da1629c8e62caf9ade1515d162def8ab`.
- Hermes live runtime: stable Python 3.14.7. An initial Python 3.14 release candidate was rejected after a typing compatibility failure; setup now refuses a prerelease interpreter.
- Real Gemini-backed Hermes calls exercised list_sources, read_source for each note, save_report, and explicit completed=true. The model received only the four scoped tools.
- Two actual UI-created tasks completed. The second selected an approved skill; its report began with a comparison table and included missing information. The stored task retained that skill's version.
- Offline tests cover brief/evidence separation, approval and version snapshots, duplicate/maximum skill selections, complete/partial/cancelled classification, origin checks, missing provider setup, local persistence, artifact downloading, queue cancellation and bounded input/filenames.
- Chrome browser checks at 1440×900, 768×1024 and 375×667 reported no horizontal page overflow or JavaScript errors for the task desk. Additional report/skill checks are part of the recording QA artifacts.
- No TTS requests made during implementation or verification.

Remaining release boundaries: other operating systems require native-runtime verification. Internet/API availability and model adherence can change. Citation ID validation does not prove semantic claim support. The app is intended for one trusted local user, not a public multi-user server. Public publication and website deployment are separate actions.

The maintainers keep raw test outputs, screenshots and recordings outside the downloadable code package. Unit/API tests inject an explicit test runner and must not be described as a live model test; the actual provider-backed runs are verified separately.
