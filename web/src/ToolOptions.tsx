// The strip that shows above a sketch while a drawing tool is chosen: the other ways of drawing the same kind of shape (the rectangle tools, the circle tools…), one click away.
import type { ReactNode } from 'react';
import { Icon } from './icons';
import type { Tool } from './sketch/tools';

interface Variant { tool: Tool; label: string; icon: ReactNode }
const FAMILIES: { name: string; tools: Variant[] }[] = [
  { name: 'Line', tools: [{ tool: 'line', label: 'Line', icon: <Icon.line /> }, { tool: 'lineMid', label: 'Midpoint Line', icon: <Icon.tLineMid /> }] },
  { name: 'Rectangle', tools: [{ tool: 'rect', label: '2-Point Rectangle', icon: <Icon.rect /> }, { tool: 'rect3', label: '3-Point Rectangle', icon: <Icon.tRect3 /> }, { tool: 'rectCenter', label: 'Center Rectangle', icon: <Icon.rectCenter /> }, { tool: 'rectRound', label: 'Rounded Rectangle', icon: <Icon.tRectRound /> }] },
  { name: 'Circle', tools: [{ tool: 'circle', label: 'Center Circle', icon: <Icon.circle /> }, { tool: 'circle2', label: '2-Point Circle', icon: <Icon.circle2 /> }, { tool: 'circle3', label: '3-Point Circle', icon: <Icon.tCircle3 /> }] },
  { name: 'Arc', tools: [{ tool: 'arc3', label: '3-Point Arc', icon: <Icon.arc3 /> }, { tool: 'arcC', label: 'Center Point Arc', icon: <Icon.tArcC /> }] },
  { name: 'Polygon', tools: [{ tool: 'polyIn', label: 'Inscribed Polygon', icon: <Icon.tPolyIn /> }, { tool: 'polyOut', label: 'Circumscribed Polygon', icon: <Icon.tPolyOut /> }, { tool: 'polyEdge', label: 'Edge Polygon', icon: <Icon.tPolyEdge /> }] },
];

/** The family a tool belongs to, or null when it has no sisters. */
export const familyOf = (tool: Tool | null) => FAMILIES.find((f) => f.tools.some((v) => v.tool === tool)) ?? null;

export function ToolOptions({ tool, onTool, sides, onSides }: { tool: Tool | null; onTool(t: Tool): void; sides: string; onSides(v: string): void }) {
  const fam = familyOf(tool); if (!fam) return null;
  return (
    <div className="toolopts" data-testid="tool-options" role="toolbar" aria-label={`${fam.name} options`}>
      <span className="toname">{fam.name}</span>
      {fam.tools.map((v) => <button key={v.tool} className={v.tool === tool ? 'on' : ''} aria-pressed={v.tool === tool} title={v.label} aria-label={v.label} data-testid={`opt-${v.tool}`} onClick={() => onTool(v.tool)}>{v.icon}</button>)}
      <span className="toline">{fam.tools.find((v) => v.tool === tool)?.label}</span>
      {fam.name === 'Polygon' && <label className="tosides">Sides <input type="number" min={3} max={64} aria-label="Sides" value={sides} onChange={(e) => onSides(e.target.value)} /></label>}
    </div>
  );
}
