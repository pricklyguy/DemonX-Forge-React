// The Export dialog: which bodies, which file type, one file or one per body, and save it or open it in an installed slicer.
import { useState } from 'react';

export type ExportFormatId = 'stl' | 'stla' | '3mf' | 'step' | 'obj';
export interface ExportChoice { bodies: string[]; format: ExportFormatId; perBody: boolean }
export interface SlicerInfo { id: string; name: string }

const FORMATS: { id: ExportFormatId; label: string }[] = [
  { id: '3mf', label: '3MF (each body stays its own object)' }, { id: 'stl', label: 'STL (binary)' }, { id: 'stla', label: 'STL (text)' },
  { id: 'step', label: 'STEP (solid, for other CAD)' }, { id: 'obj', label: 'OBJ' },
];

export function ExportDialog({ names, chosen, slicers, startWithSlicer, busy, onSave, onSlicer, onClose }: {
  names: string[]; chosen: string[]; slicers: SlicerInfo[] | null; startWithSlicer: boolean; busy: boolean;
  onSave(c: ExportChoice): void; onSlicer(c: ExportChoice & { slicer: string }): void; onClose(): void;
}) {
  const [picked, setPicked] = useState<string[]>(chosen.length ? chosen : names);
  const [format, setFormat] = useState<ExportFormatId>('3mf');
  const [perBody, setPerBody] = useState(false);
  const [target, setTarget] = useState<'file' | 'slicer'>(startWithSlicer ? 'slicer' : 'file');
  const [slicer, setSlicer] = useState('');
  const toSlicer = target === 'slicer';
  const meshFormat = format === 'stl' || format === '3mf';
  const slicerId = slicer || slicers?.[0]?.id || '';
  const choice: ExportChoice = { bodies: picked, format: toSlicer && !meshFormat ? '3mf' : format, perBody: !toSlicer && perBody };
  const toggle = (n: string) => setPicked((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));
  const ok = picked.length > 0 && !busy && (!toSlicer || (!!slicerId && meshFormat));
  return (
    <div className="dialog export" data-testid="export-dialog" role="dialog" aria-label="Export">
      <div className="dhead">EXPORT</div>
      <div className="drow"><span>Bodies</span>
        <span className="expbodies">
          {names.map((n) => <label key={n} className="expbody"><input type="checkbox" aria-label={`Export ${n}`} checked={picked.includes(n)} onChange={() => toggle(n)} /> {n}</label>)}
          {names.length > 1 && <span className="explinks"><button onClick={() => setPicked(names)}>All</button><button onClick={() => setPicked([])}>None</button></span>}
        </span>
      </div>
      <label className="drow"><span>File type</span>
        <select aria-label="Export file type" value={format} onChange={(e) => setFormat(e.target.value as ExportFormatId)}>
          {FORMATS.filter((f) => !toSlicer || f.id === 'stl' || f.id === '3mf').map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select></label>
      <label className="drow"><span>Send to</span>
        <select aria-label="Export target" value={target} onChange={(e) => { const t = e.target.value as 'file' | 'slicer'; setTarget(t); if (t === 'slicer' && !meshFormat) setFormat('3mf'); }}>
          <option value="file">A file</option><option value="slicer" disabled={!slicers?.length}>{slicers === null ? 'A slicer (looking…)' : slicers.length ? 'A slicer' : 'A slicer (none found)'}</option>
        </select></label>
      {toSlicer ? (
        <label className="drow"><span>Slicer</span>
          <select aria-label="Slicer" value={slicerId} onChange={(e) => setSlicer(e.target.value)}>{(slicers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      ) : picked.length > 1 && (
        <label className="drow"><span>One file per body</span><input type="checkbox" aria-label="One file per body" checked={perBody} onChange={(e) => setPerBody(e.target.checked)} /></label>
      )}
      <div className="dnote">{toSlicer ? 'Saves the chosen bodies as one mesh and opens it in the slicer. 3MF keeps each body as a separate object; with STL they arrive as one.'
        : perBody && picked.length > 1 ? 'Saves a zip with one file for each chosen body, named after the body.' : format === 'stl' || format === 'stla' ? 'STL has no body names: several bodies land in one file. Tick One file per body for a zip of separate STL files.' : 'The chosen bodies go into one file.'}</div>
      <div className="dbtns"><button onClick={onClose}>Cancel</button>
        <button className="primary" data-testid="export-ok" disabled={!ok} onClick={() => (toSlicer ? onSlicer({ ...choice, slicer: slicerId }) : onSave(choice))}>{toSlicer ? `Open in ${slicers?.find((s) => s.id === slicerId)?.name ?? 'slicer'}` : 'Export'}</button></div>
    </div>
  );
}
