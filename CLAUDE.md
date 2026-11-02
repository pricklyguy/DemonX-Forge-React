# DemonX Forge: notes for AI coding assistants

DemonX Forge is a Fusion-style parametric 3D CAD application by Prickly Guy Creations: sketch, constrain, extrude and so on, with a feature timeline and parameters. It is its own product in its own repository, GPL-3.0-or-later. It shares the look and feel of DemonX CNC and DemonX Design (colours, dark and light), not their code, and it does not talk to their servers. Files leave Forge as STEP, STL, 3MF, OBJ, DXF or SVG. `AGENTS.md` carries the same rules for tools that read that file instead.

## Commands

- `npm install` once. `npm run typecheck` and `npm test` (vitest) must pass before pushing. `npm run build` builds the UI into `web/dist`.
- `npm run dev:server` and `npm run dev:web` for development; `npm start` serves the built app on port 8120.
- The modelling engine is a separate program that is **not in this repo**. Put it where `FORGE_ENGINE` points, or at `data/engine/solidcraft-cli`. Tests that need it skip themselves when it is missing. `engine/SOLIDCRAFT_REF` names the SolidCraft commit the packages are built from; change it only after running the unit tests and `e2e/` against the new engine.
- Browser checks live in `e2e/` (Playwright, real browser, real engine), each with its run instructions in its header. Add or extend one when you change UI behaviour.
- Do not use `pkill -f` to stop a test server (it can kill your own shell). Stop it by port: `fuser -k 8120/tcp`.

## Rules that matter

- **The engine is behind our interface.** Everything modelling-related goes through `server/src/engine/Engine.ts`. No other file may know SolidCraft's command names or MCP. If the engine changes, only the adapter changes.
- **Clean room.** We work from public documentation, general CAD conventions and observed behaviour. Never reverse engineer Autodesk Fusion or any proprietary CAD program, and never read or convert its files. Open-source code (SolidCraft is MIT OR Apache-2.0) may be used under its licence: keep its notices.
- **Every action is a command** with JSON arguments, so buttons, scripts and AI/MCP tools do the same thing.
- **The server decides.** It answers only this computer (loopback address and Host header checked) and validates every request. Never trust the browser. Engine file access stays inside the engine's allowed folders.
- **Silent failures are bugs.** The engine ignores parameters it does not know; our adapter reports unknown ones.
- **Units.** Millimetres and degrees everywhere in the engine; the UI converts for display. Z is up.
- **Say what was tested** (unit test, real browser, real engine, real part) and what was not, in release notes and PR descriptions.
- **Look and feel.** Use the DemonX colour variables (`web/src/styles.css`) and both dark and light modes. No other project's branding.

## Keep the public repository clean

This repository is public. It holds source code, tests, build scripts, user-facing documentation and release notes, and nothing else.

- Never commit chat transcripts, planning conversations, hand-off notes, scratch files, TODO dumps, AI session links, or anything from `data/`. Keep working notes in `docs/private/` (git-ignored) or outside the repository.
- Never commit personal details: addresses, hostnames, e-mail addresses, file paths of anyone's machine, tokens or secrets. Use neutral placeholders in examples and tests.
- Do not add assistant-instruction files for other tools (`.cursor/`, `.github/copilot-instructions.md`, `GEMINI.md` and the like). `CLAUDE.md` and `AGENTS.md` are the only two, and they say the same thing.
- Decisions that outlive a session go into `docs/DESIGN.md` (short, factual, no dialogue). What changed in a version goes into `docs/releases/v<version>.md`.
- Do not put model names in code, comments, commit messages or PR text beyond the attribution lines you are given.

## Documentation

`README.md` (what Forge does, how to install and run it), `docs/WINDOWS.md` and `docs/LINUX.md` (the guides that go into the packages), `docs/MCP.md` (connecting an AI), `docs/guides/` (how-tos), `docs/DESIGN.md` (decisions and engine notes), `docs/releases/` (one file per version; the release workflow attaches it). Change the docs in the same commit as the behaviour.

## Working with pull requests

Work on `main` for small changes; use a branch and open a PR when asked. The owner merges on the web. Commit messages and PR text follow the attribution lines you are given.
