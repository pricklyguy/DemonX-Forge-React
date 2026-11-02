# DemonX Forge: notes for AI coding assistants

The rules for this repository are in [`CLAUDE.md`](CLAUDE.md); they apply to every assistant. In short:

- `npm run typecheck` and `npm test` must pass before pushing; `npm run build` builds the UI; `npm start` serves it on port 8120. Browser checks are in `e2e/`.
- All modelling goes through `server/src/engine/Engine.ts`; no other file knows the engine's command names.
- Every action is a command with JSON arguments. The server validates everything and answers only this computer.
- Millimetres and degrees, Z up. Clean room: never reverse engineer or read the files of any proprietary CAD program.
- This repository is public: no chat transcripts, planning conversations, hand-off notes, scratch files, personal details, secrets or `data/`. Working notes belong in `docs/private/` (git-ignored) or outside the repo. Do not add instruction files for other tools.
- Say plainly what was tested and what was not.
