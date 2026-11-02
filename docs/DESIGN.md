# DemonX Forge: design decisions and engine notes

What is settled about how Forge is built, and what we know about the modelling engine underneath it. Release by release changes are in `docs/releases/`; how the code is laid out is in the README.

## Decisions

- **Its own product.** Forge shares the look (colour variables, dark and light, layout habits) with DemonX CNC and DemonX Design, not code. It does not talk to their servers; files leave Forge as STEP, STL, 3MF, OBJ, DXF or SVG.
- **Fusion-style layout and keys:** browser tree, sketch then features, a timeline strip, parameters, view cube, sketch palette; E extrude, L line, R rectangle, C circle, D dimension, H hole, F fillet, M move, Ctrl+Z / Ctrl+Y. Z is up everywhere, and the TOP view looks down Z.
- **Clean room.** We work from public documentation, general CAD conventions and observed behaviour. We never reverse engineer Autodesk Fusion or any proprietary CAD program, and never read or convert its files. Open-source code (SolidCraft is MIT OR Apache-2.0) is used under its licence, with its notices kept.
- **The engine is replaceable.** All modelling goes through `server/src/engine/Engine.ts`. Today the one implementation drives SolidCraft's headless `solidcraft-cli mcp` over stdio; no other file knows SolidCraft's command names. If the engine changes, only the adapter changes.
- **Every action is a command** with JSON arguments, so buttons, scripts and AI (MCP) tools all do the same thing. The server checks every command against an allow-list; commands that touch files are refused on the generic route and have their own routes.
- **Local only.** The server answers only this computer (loopback address and Host header checked) and validates every request.
- **Units:** millimetres and degrees in the engine; the UI converts for display.
- **Licence:** GPL-3.0-or-later.
- **Our file is `.forge`:** a zip holding `forge.json` (format `demonx-forge`, version, app version, engine, time) and `design.solidcraft`, the engine's own container, which keeps the whole history. It is the most faithful round trip the engine has, and the header makes the file ours and checkable.

## Direction: packaging as a desktop app

The DemonX suite is moving from browser-based tools to installed desktop apps built on Electron. Forge and DemonX Design have no need of the network (only the CNC client needs LAN access, which Electron keeps), so how they are packaged is open. Intended shape: an Electron shell that starts the Forge server and the engine itself (no "start the server, then open the browser" steps, no console window), native menus and file dialogs, file associations for `.forge`, and an updater that replaces the present Update now. The server stays loopback-only until it can be reached by IPC instead of a port. Until then Forge runs as a local server with an installable web app window (File > Install Forge as an app).

**Platforms:** Forge must run on both Windows and Linux (x86-64; ARM where practical), with Linux a first-class target, not an afterthought. Any packaging or toolkit choice is checked against that: Windows-only options (WebView2 shells, WinUI) are out; Tauri is weak on Linux (WebKitGTK); Electron gives the same Chromium on both, but needs a graphics fallback setting, a sandbox profile for newer Ubuntu releases, and testing under both Wayland and X11.

## The engine, and how it is pinned

SolidCraft's headless CLI (`tangency-labs/solidcraft`, MIT OR Apache-2.0) does the modelling. Forge does not bundle its source: the Windows and Linux packages are built by GitHub Actions (`.github/workflows/package.yml`), which compiles `solidcraft-cli` from the commit named in `engine/SOLIDCRAFT_REF`, smoke-tests it, and bundles it with the server, the web app, its own Node and the engine's licence files.

SolidCraft changes daily and its command names are not stable, so the commit is pinned on purpose. To try a newer engine: build it, put it where `FORGE_ENGINE` points (or at `data/engine/solidcraft-cli`), run `npm test` and the `e2e/` scripts against it, and only then change `engine/SOLIDCRAFT_REF`. Tests that need the engine skip themselves when it is missing.

## What we know about the engine

- **A sketch on a face needs an exact pick:** `sketch.create` with `plane: {face: [x,y,z], body, index}`; a point and body alone are refused.
- **Standard planes:** XY is x right, y up (normal +Z); the engine's XZ has sketch y pointing down the world's Z (normal +Y), which is the Front plane seen from behind and upside down, so Forge creates it with `flip: true` (SolidCraft 0.29): x right, y = world Z, normal -Y, seen from the front. YZ has x = world Y, y = world Z (normal +X). The camera's up vector follows the sketch's y axis.
- **Unknown parameters are silently ignored** by the engine; our adapter checks names against the engine's command list and reports unknown ones (`unknownParamNames`).
- **A failed batch comes back as JSON** with `rolled_back: true`; the adapter turns it into a sentence and the design is unchanged.
- **Centre Rectangle also draws two construction diagonals:** four solid lines and two construction lines.
- **A full circle extrudes to two half-cylinder faces** (`c1#1`, `c1#2`), so clicking a hole's wall picks half of it.
- **A cut goes along the sketch normal by default,** which for a sketch on a top face is away from the body. Forge flips a Cut toward the body, as Fusion does; a negative distance flips it back.
- **A second dimension on the same line is refused** (over-constrained). To change one, set its parameter (`d1`, `d2`, ...): the line follows.
- **Rectangles and constraints:** a rectangle's sides carry Horizontal and Vertical constraints, which hold them in place. Turning a selection first removes those constraints on the chosen lines or the shape collapses. A rectangle drawn from the origin corner is pinned to the origin.
- **The engine hides a sketch** as soon as a feature uses it; `browser.visibility` shows it again.
- **Saving:** `save` writes a zip container, `open` replaces the design, and `dirty` in `inspect_design` tracks unsaved changes. Opening a missing or junk file gives a clear error and leaves the design alone.
- **Editing:** `timeline.edit {feature, set}` changes a feature in place (one undo step); `sketch.edit` reopens a sketch and `sketch.finish` rebuilds what depends on it; `timeline.roll_to` moves the history marker; `timeline.dependents` says what a delete takes with it.
- **Face areas from `body_topology` are approximate** (about 0.05 % high). Use `measure` for any number shown as a dimension; the face list is for picking and display only.
- **Edges** are named `A|B` after the two faces they join (`A|B~k` when there are several); `solid.fillet` and `solid.chamfer` take `edges: [{body, index}]`, and the blend follows edges that continue smoothly. Forge matches the mesh boundary between two face ids to the engine's edge by name pair and nearest midpoint.
- **Construction planes** are described by `timeline.inspect`; an earlier plane is referred to by name (SolidCraft up to 0.19) or by feature number (0.29). The adapter accepts both.
- **Torus joins are slow** in the engine (seconds for an overlapping join), so a Torus starts as a New Body.
- **Section DXF:** SolidCraft 0.19 leaves out the side of a section piece that meets a hole; 0.29 gives closed pieces.
- **The move / turn gizmo** (`web/src/triad.ts`, drawn in `Viewport.tsx` as an SVG layer over the view) is built from a spec (origin, arrow axes, ring axes, callbacks), so Move in a sketch and on a body share it. Parts: arrows, a square between two arrows, a centre dot, rings. Drags are worked out on the screen (pixels per millimetre along each axis at the gizmo's depth) and give millimetres and degrees.
- **Keyboard focus:** a ticked checkbox must not block shortcuts. Only text boxes, lists and text areas own the keyboard.
