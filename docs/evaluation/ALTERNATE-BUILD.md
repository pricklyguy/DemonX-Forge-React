# The alternate build (`codex/fusion-parity`) compared with this app

Date: 2026-10-25. What was read: the branch's `docs/modernization/*`, its `prototype/` folder and the React/server diff against `main` (`git diff main...origin/codex/fusion-parity`), and SolidCraft v0.19.0's own app source (`crates/ui-egui`, `workspace.rs` for the ribbon, `context_menu.rs` for the body menu), plus the engine's live command list (`list_commands`, 407 commands, built from v0.19.0). The alternate app was **not run** here; what is said about it comes from source.

## What the branch is

Not a second React app. It is the **native SolidCraft desktop app** (Rust, egui) with a thin DemonX overlay (name, logo, theme, drag-to-draw) applied at build time, plus Windows packaging and an MCP bridge. Its docs record the 2026-10-22 decision to make it the primary product and say not to build Fusion-style parity in React. The owner has now asked for the missing tools in this app instead, so this app stays the line, and the branch is a source of *design and engine commands*, not of code to merge. Its screens cannot be ported; the engine behind both apps is the same, so most of its tools are commands this app can call.

## Small things worth taking from the branch's own React/server changes

- `server/src/commands.ts`: an explicit list of engine commands that read or write file paths (`sketch.export_dxf`, `sketch.insert_dxf`, `sketch.insert_svg`, `sketch.text`, `sketch.edit_text`, `parameters.export/import`, `timeline.export_script`, `component.insert_design/update_links/relink`) refused on the generic route, applied to both the batch route and `isAllowedCommand`. Worth having before we open up more command families. Not done yet: planned for 0.28.0, before the allowed list is widened.
- The Slot width box is moved out from under the pointer (`web/src/sketch/tools.ts`). Tiny.
- Not taken: the `single_undo` option and the Scripts runner (they need the native app), the Node 22/vite 8/vitest 5 upgrades (untested here), the native packaging scripts.

## The alternate app's ribbon

Tabs, in order: **MODEL, SURFACE, ASSEMBLE, INSERT, INSPECT, MANAGE, VIEW, SHEET METAL** (and PLASTIC, RENDER, MESH when relevant; SKETCH appears while a sketch is open). Each tab is panels; each panel shows a few "promoted" big buttons and the rest in the panel's ▾ menu. The user can drag commands between panels and pin them; narrow windows move buttons into "More".

| Tab | Panels (promoted buttons) and what is in the ▾ |
|---|---|
| MODEL | SKETCH (New Sketch; edit, 3D line/spline/point) · CREATE (Extrude, Revolve, Hole; Sweep, Loft, Box, Cylinder, Sphere, Torus, Pipe, Coil, Rib, Web, Emboss, Thread, Boundary Fill, Bounding Solid, patterns) · MODIFY (Fillet, Chamfer, Shell, Press Pull; Combine, Scale, Draft, Offset Face, Split Face/Body, Replace Face, Delete Face, Remove) · ARRANGE (Move/Copy, Mirror, Rectangular pattern; Circular, Path pattern, Align) · CONFIGURE (Parameters, Config Table) · CONSTRUCT (Offset Plane; plane at angle, midplane, tangent, 3 points, 2 edges, along path; axes; points) |
| SURFACE | Extrude, Revolve, Sweep, Loft; Trim, Untrim, Extend, Stitch; Thicken, Patch, Boundary, Offset, Ruled, Blend, Fillet, Match, Fair; Continuity analysis |
| ASSEMBLE | COMPONENTS (New Component, From Bodies, Insert, Parts) · JOINTS (several kinds) · POSITION · MOTION (Motion Study, Trace, Exploded View) · CONTACT |
| INSERT | FILES (Insert STEP, Insert Mesh, Insert Design, **Save As Mesh**) · IMAGES (Canvas, Decal) · 2D (Insert DXF, Insert SVG) · LIBRARY (Fastener, Parts) · LINKS |
| INSPECT | MEASURE (Measure, Center of Mass, Properties) · SECTION · CHECK (Interference, Draft, Accessibility, Compare) · SURFACE QUALITY (Zebra, Curvature, Isocurve, Environment map, ...) · HISTORY |
| MANAGE | PARAMETERS (Change, Graph, Import/Export) · CONFIGURATIONS · MATERIALS (Physical Material, Appearance) · RULES · DESIGN (Units, Compute All, Checkpoints) |
| VIEW | Saved views (apply, save, rename, delete), view navigation, selection filter |
| SHEET METAL | New Sketch, Flange, Hem, Fold, Perforate, Convert; Unfold/Refold/Flat Pattern; export DXF and bend table; Rules |
| SKETCH (open) | CREATE (Line, Rectangle, Circle, Arc; 3-point rectangle, rounded rectangle, 3-point circle, tangent circles, center-point arc, tangent arc, polygons (3 kinds), slots (5), ellipse, splines (fit, control point), conic, point, centerline, text, project, intersect) · CONSTRAINTS (15 kinds, AutoConstrain) · MODIFY (Trim, Offset, Fillet, chamfers (3), Extend, Break, Scale, Move, Blend curve, Copy/Cut/Paste) · INSERT (DXF, SVG, canvas) · PATTERN (Mirror, Circular, Rectangular) · FINISH SKETCH (and Finish with AutoConstrain) |

## Your four asks, against the engine

| Ask | In the alternate app | In this app now | What it takes |
|---|---|---|---|
| Rename bodies | Browser right click > Rename (`body.rename`; features that use the body follow the new name) | Not possible | The command exists. `body.` is not in our allowed list: add it (checked), a rename box in the browser (double click or F2 / right click) |
| Select whole bodies | Click a body row; body context menu (Show/Hide, Isolate, Lock, Delete, Properties, Find in Timeline, Export, Save As Mesh) | Body rows only have the eye | Row selection + click a body in the view (there is already a body highlight for some tools); the same context menu items that make sense here |
| Export one chosen body | Context menu Export / Save As Mesh pass the chosen body names (`file.save_mesh bodies`, `file.export bodies`) | `/api/export` has no body argument, so everything goes into one file | Add a body list to the export route, check the names against the design, and a dialog: which bodies, STL or 3MF, one file or one STL per body (a zip). 3MF keeps each body as its own named object; STL cannot |
| Export straight to the slicer | `file.slicers` lists the slicers installed on the machine; `file.save_mesh slicer:<id>` writes the file and opens it there | Not possible | The Forge server runs on the owner's PC, so it works the same. List the slicers, offer "Open in <Slicer>" next to Export. Path handling stays inside our checked temp folder |
| Mesh / Export on the main toolbar | MESH (Save As Mesh) and INSERT/FILES tabs | MESH tab has Insert Mesh, Mesh to Solid, Scale; Export only under File | Add an EXPORT group to the MESH tab (Selected body, All bodies, Open in slicer) and a short "Export" button on the SOLID tab's INSERT group |

## Tools the alternate app has and we do not

Ranked by usefulness for the owner's work (printing and sheet parts) and by cost. "Cost" assumes our existing pattern: a dialog, a live preview and one engine command.

1. **Body handling and export** (above). Small to medium. Biggest daily win; needs no new engine work.
2. **Box, Cylinder, Sphere, Torus** (CREATE): single dialogs, `solid.box` etc. Small.
3. **Construct group**: Offset Plane, Plane at Angle, Midplane, Plane Through 3 Points, Axes, Points; then a sketch can start on any of them. Medium (the plane picker must list them).
4. **More sketch tools**: polygons, ellipse, rounded rectangle, 3-point rectangle and circle, center-point arc, tangent arc, point, centerline, splines, text (needs the font file route), sketch mirror and patterns, project/intersect edges of other bodies, Insert DXF/SVG (needs checked upload). Each tool is a small addition to `tools.ts` and the ribbon; ~one release for a batch of 6 to 8.
5. **More constraints** (collinear, symmetry, curvature, polygon) and **AutoConstrain**. Small to medium.
6. **Solid MODIFY gaps**: Delete Face, Split Face, Replace Face, Align, Path pattern, Compute All, Boundary Fill, Bounding Solid. Small each.
7. **Inspect**: Center of Mass and Properties (we have Measure and Section to DXF), Interference between bodies, Draft analysis, Section analysis, Curvature/Zebra. Medium.
8. **Appearance / Physical Material**, saved **Views**, **Units**, **Checkpoints**. Small to medium; materials matter little for printing.
9. **Surface tab** (Patch, Thicken, Stitch, Trim...). Large; later.
10. **Sheet Metal** and **Plastic** (Boss, Lip, Snap Fit): useful for enclosures like the wled_case; each needs its own dialogs. Plastic's Boss/Lip/Snap Fit are the nearest to the owner's work. Large, one at a time.
11. **Assemble / joints / motion / contact**, **Render**: large, and little use for single printed parts. Not recommended yet.

## Keeping what works

Everything above adds ribbon buttons, dialogs and engine commands behind `Engine.ts`; none of it changes sketch snapping, intersection finding (`regions.ts`), edge picking or the timeline. Each addition gets an e2e script like the others and the whole suite is run before pushing.

## Suggested order

0.28.0: body rename and select, per-body export (STL zip, 3MF), open in slicer, Export on the MESH tab. Then primitives and Construct planes, then a batch of sketch tools.
