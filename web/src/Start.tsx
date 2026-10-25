// The Start page: begin a design, open one, or pick up a recent one. It fills the view of an empty design, and opens over everything from the Home button.
import type { RecentItem } from './recent';
import { ago } from './recent';

interface Props {
  recents: RecentItem[]; busy: boolean;
  /** Set when it is the full page over a design (it has a way back and the file commands on the left); not when it only fills an empty view. */
  overlay?: { docName: string; canSave: boolean };
  onNew(): void; onOpen(): void; onImport(): void; onDemo(): void;
  onRecent(r: RecentItem): void; onForget(r: RecentItem): void;
  onClose?(): void; onSave?(): void; onSaveAs?(): void; onPrefs?(): void; onKeys?(): void; onUpdates?(): void;
}

function Card({ id, title, note, icon, onClick, disabled }: { id: string; title: string; note: string; icon: string; onClick(): void; disabled?: boolean }) {
  return <button className="scard" data-testid={id} disabled={disabled} onClick={onClick}><span className="sicon" aria-hidden="true">{icon}</span><span><b>{title}</b><small>{note}</small></span></button>;
}

export function Start(p: Props) {
  const body = (
    <div className="startbody" data-testid="start-page">
      <h1>Start</h1>
      <p className="muted">Begin a design, open one, or pick up where you left off.</p>
      <h2>New</h2>
      <div className="scards">
        <Card id="start-new" icon="＋" title="New design" note="Millimetres · bodies, sketches and a timeline" onClick={p.onNew} disabled={p.busy} />
        <Card id="start-open" icon="▤" title="Open…" note="A .forge design" onClick={p.onOpen} disabled={p.busy} />
        <Card id="start-import" icon="⇩" title="Import…" note="STEP, IGES, STL, OBJ or 3MF into the design" onClick={p.onImport} disabled={p.busy} />
      </div>
      <h2>Recent</h2>
      {p.recents.length === 0 ? <p className="muted" data-testid="recent-none">Designs you save or open show up here.</p> : (
        <ul className="srecent" data-testid="recent-list">
          {p.recents.map((r) => (
            <li key={r.id} data-testid={`recent-${r.id}`}>
              <button className="srow" onClick={() => p.onRecent(r)} title={r.handle ? `Open ${r.name}` : `Open ${r.name} (you will be asked to choose the file)`}>
                <span className="sthumb">{r.thumb ? <img src={r.thumb} alt="" width={64} height={40} /> : <span aria-hidden="true">▣</span>}</span>
                <span className="sname">{r.name}</span><span className="swhen">{ago(r.ts)}</span>
              </button>
              <button className="sforget" aria-label={`Remove ${r.name} from the list`} title="Remove from this list (the file is not touched)" onClick={() => p.onForget(r)}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <h2>Samples</h2>
      <div className="scards">
        <Card id="demo" icon="⌘" title="Demo bracket" note="A small part to look around in" onClick={p.onDemo} disabled={p.busy} />
      </div>
    </div>
  );
  if (!p.overlay) return <div className="startstage">{body}</div>;
  return (
    <div className="startpage" data-testid="start-overlay" role="dialog" aria-label="Start">
      <nav className="snav">
        <button className="sback" data-testid="start-back" onClick={p.onClose}>‹ Back to {p.overlay.docName} <kbd>Esc</kbd></button>
        <button className="active">Start</button>
        <button onClick={p.onNew}>New</button><button onClick={p.onOpen}>Open</button>
        <hr />
        <button disabled={!p.overlay.canSave} onClick={p.onSave}>Save</button><button disabled={!p.overlay.canSave} onClick={p.onSaveAs}>Save As…</button>
        <hr />
        <button onClick={p.onPrefs}>Preferences</button><button onClick={p.onKeys}>Keyboard shortcuts</button><button onClick={p.onUpdates}>Updates</button>
      </nav>
      <div className="smain">{body}</div>
    </div>
  );
}
