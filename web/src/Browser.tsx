import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { Body, ConstructionPlane, Parameter, Sketch } from './api';
import { Icon } from './icons';

interface Props {
  docName: string;
  bodies: Body[]; sketches: Sketch[]; parameters: Parameter[];
  hiddenBodies: Set<string>; hiddenSketches: Set<number>; showOrigin: boolean; busy: boolean;
  pickingPlane: boolean; onPickPlane(plane: string): void;
  planes: ConstructionPlane[]; hiddenPlanes: Set<string>; onTogglePlane(name: string): void; onPlaneMenu(name: string, x: number, y: number): void;
  onToggleBody(name: string): void; onToggleSketch(id: number): void; onToggleOrigin(): void; onEditSketch(name: string): void;
  onSetParam(name: string, value: string): Promise<boolean>;
  /** Whole-body selection and naming: a click selects, Ctrl or Shift adds, double-click (or F2) renames, right-click opens the menu. */
  selectedBodies: string[]; renaming: string | null;
  onSelectBody(name: string, additive: boolean): void; onStartRename(name: string): void; onRenameBody(from: string, to: string): void; onBodyMenu(name: string, x: number, y: number): void;
}

function Node({ label, children, eye, onEye, open: init = true, id, active, onDouble, selected, onClick, onContext }: { selected?: boolean; onClick?: (e: MouseEvent) => void; onContext?: (e: MouseEvent) => void; label: ReactNode; children?: ReactNode; eye?: boolean; onEye?: () => void; open?: boolean; id: string; active?: boolean; onDouble?: () => void }) {
  const [open, setOpen] = useState(init);
  return (
    <div>
      <div className={`bnode${active ? ' active' : ''}${selected ? ' selected' : ''}`} data-testid={`node-${id}`} aria-selected={selected} onClick={onClick} onContextMenu={onContext} onDoubleClick={onDouble} title={onDouble ? (id.startsWith('body-') ? 'Click to select, double-click to rename' : 'Double-click to edit') : undefined}>
        <span className={`bcaret${children ? (open ? ' open' : '') : ' none'}`} onClick={() => children && setOpen(!open)}><Icon.caret /></span>
        {onEye && <button className="beye" aria-label={`${eye ? 'Hide' : 'Show'} ${id}`} onClick={onEye}>{eye ? <Icon.eye /> : <Icon.eyeOff />}</button>}
        <span className="blabel">{label}</span>
      </div>
      {children && open && <div className="bchildren">{children}</div>}
    </div>
  );
}

function ParamRow({ name, expression, disabled, onSet }: { name: string; expression: string; disabled: boolean; onSet: (v: string) => Promise<boolean> }) {
  const [text, setText] = useState(expression);
  const commit = () => { if (text.trim() && text.trim() !== expression) void onSet(text.trim()).then((ok) => { if (!ok) setText(expression); }); else setText(expression); };
  return (
    <div className="param"><label htmlFor={`p-${name}`}>{name}</label>
      <input id={`p-${name}`} type="text" value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
    </div>
  );
}

/** The name box that replaces a body's name while it is being renamed. */
function RenameBox({ name, onDone }: { name: string; onDone(to: string | null): void }) {
  const [text, setText] = useState(name), ref = useRef<HTMLInputElement>(null), done = useRef(false);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const finish = (to: string | null) => { if (done.current) return; done.current = true; onDone(to); };
  return <input ref={ref} className="brename" data-testid="rename-box" aria-label={`New name for ${name}`} value={text} onChange={(e) => setText(e.target.value)} onClick={(e) => e.stopPropagation()}
    onBlur={() => finish(text.trim() && text.trim() !== name ? text.trim() : null)}
    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') finish(text.trim() && text.trim() !== name ? text.trim() : null); else if (e.key === 'Escape') finish(null); }} />;
}

/** The browser tree: document, origin, bodies, sketches (and the named parameters). */
export function Browser(p: Props) {
  return (
    <aside className="browser" data-testid="browser">
      <div className="bhead">BROWSER</div>
      <Node id="root" label={p.docName}>
        <Node id="settings" label="Document Settings"><div className="bleaf">Units: mm</div></Node>
        <Node id="origin" label="Origin" eye={p.showOrigin} onEye={p.onToggleOrigin} open={false}>
          {(['XY', 'XZ', 'YZ'] as const).map((plane) => <div className="bleaf" key={plane}>{p.pickingPlane ? <button onClick={() => p.onPickPlane(plane)}>{plane} / {plane === 'XY' ? 'Top' : plane === 'XZ' ? 'Front' : 'Side'}</button> : `${plane} plane`}</div>)}
        </Node>
        <Node id="bodies" label={`Bodies (${p.bodies.length})`}>
          {p.bodies.map((b) => <Node key={b.name} id={`body-${b.name}`} selected={p.selectedBodies.includes(b.name)} eye={!p.hiddenBodies.has(b.name)} onEye={() => p.onToggleBody(b.name)}
            onClick={(e) => p.onSelectBody(b.name, e.ctrlKey || e.metaKey || e.shiftKey)} onContext={(e) => { e.preventDefault(); p.onBodyMenu(b.name, e.clientX, e.clientY); }} onDouble={() => p.onStartRename(b.name)}
            label={p.renaming === b.name ? <RenameBox name={b.name} onDone={(to) => (to ? p.onRenameBody(b.name, to) : p.onRenameBody(b.name, b.name))} /> : b.name} />)}
        </Node>
        {p.planes.length > 0 && (
          <Node id="construction" label={`Construction (${p.planes.length})`}>
            {p.planes.map((c) => (
              <Node key={c.name} id={`plane-${c.name}`} label={p.pickingPlane ? <button onClick={() => p.onPickPlane(c.name)}>{c.name}</button> : c.name}
                eye={!p.hiddenPlanes.has(c.name) && !!c.frame} onEye={c.frame ? () => p.onTogglePlane(c.name) : undefined}
                onContext={(e) => { e.preventDefault(); p.onPlaneMenu(c.name, e.clientX, e.clientY); }} />
            ))}
          </Node>
        )}
        <Node id="sketches" label={`Sketches (${p.sketches.length})`}>
          {p.sketches.map((s) => <Node key={s.id} id={`sketch-${s.name}`} active={s.active} onDouble={() => p.onEditSketch(s.name)} label={s.name} eye={s.visible} onEye={() => p.onToggleSketch(s.id)} />)}
        </Node>
        <Node id="params" label={`Parameters (${p.parameters.length})`}>
          {p.parameters.map((q) => <ParamRow key={`${q.name}:${q.expression}`} name={q.name} expression={q.expression} disabled={p.busy} onSet={(v) => p.onSetParam(q.name, v)} />)}
        </Node>
      </Node>
    </aside>
  );
}
