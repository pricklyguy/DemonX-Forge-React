# Construction planes: a short how-to

A **construction plane** is a flat, invisible sheet you place yourself. It carries no material. It exists so you can **sketch somewhere there is no face**: halfway up a part, tilted, or exactly level with something else. You sketch on it, then Extrude or Cut like any sketch.

## Why you would use one

- **A feature in mid-air.** A rib that starts 12 mm above the base, with nothing there to click: make a plane 12 mm above the base, sketch on it.
- **A tilted feature.** A lid that leans 15 degrees, a sloped face for a display: tilt a plane 15 degrees, sketch on it.
- **The middle of something.** A plane halfway between two faces, for a centred slot or to mirror about.
- **Level with a face, but out in front of it.** A plane 5 mm above the top of a part, to start a sketch that Extrudes down into the part.

## The three tools (SOLID tab, CONSTRUCT group)

1. **Offset Plane** (the button on the bar). Pick the plane to start from (XY, XZ, YZ, or a plane you made earlier), or click a flat face of a body. Type how far to move it: a positive number moves it along the plane's normal, a negative one the other way. For XY that is up and down; for a face it is out of the part and into it.
2. **Plane at Angle** (CONSTRUCT ▾). Pick the base plane, the axis it turns about (X, Y or Z through the origin) and the angle. Base XY, axis X, 90 degrees stands the plane up on edge facing Y.
3. **Midplane** (CONSTRUCT ▾). Pick two parallel planes, or click two flat faces: the new plane sits exactly halfway.

All three show the new plane in the view while the box is open, and Name is optional (a name like `Lid_top` helps later). Press OK to keep it.

## Sketching on one

- **Create Sketch**, then click the plane's name in the list (or its amber sheet in the view).
- Or open the **Construction** folder in the browser, right-click the plane, **Create Sketch**.

## Tidying

- The eye in the browser hides or shows a plane's sheet. A hidden plane still works; it just is not drawn.
- Right-click > Rename or Delete, as for any step in the timeline.
- Planes are steps in the timeline, so Ctrl+Z takes the last one back. Changing a plane's number after the fact is not in Forge yet: delete it and make it again (anything sketched on it will need the new plane).

## A first exercise

1. Make a 40 x 30 x 10 box (the Box tool).
2. Offset Plane: Base XY, Offset 25, Name `Up25`. OK.
3. Create Sketch, pick `Up25`, draw a 10 mm circle, Finish Sketch.
4. Extrude the circle 15 mm **down** (a negative distance, or flip the direction): it ends at z = 10, exactly on the top face of the box, and joins it as a 15 mm post standing out from the top.
5. Right-click `Up25` in the browser and Hide it.

## Things to know

- A plane's number can be a parameter name, so a plane can follow a size you change in Parameters. A plane made that way still works for sketching, but its amber sheet is not drawn yet (Forge needs a plain number to place the sheet).
- Plane at Angle turns about a **world** axis through the origin for now; to turn about a line elsewhere, make an Offset Plane first and turn that.
- Planes made from three points, two edges, along a path or tangent to a round face exist in the engine and are not in Forge yet.
