// The list of designs opened or saved lately, kept in this browser (IndexedDB) so the Start page can show them with a picture. The file handle is kept too where the
// browser allows it (Chrome and Edge), so a click can open the file again without asking where it is.
import type { Handle } from './files';

export interface RecentItem { id: string; name: string; ts: number; thumb: string | null; handle: Handle | null }
const MAX = 24;
const DB = 'demonx-forge', STORE = 'recent';

/** The list with `item` first (replacing an older entry of the same name), cut to the newest MAX. Keeps the old picture or file handle when the new entry has none. */
export function mergeRecent(list: RecentItem[], item: RecentItem, max = MAX): RecentItem[] {
  const old = list.find((r) => r.id === item.id);
  const merged: RecentItem = { ...item, thumb: item.thumb ?? old?.thumb ?? null, handle: item.handle ?? old?.handle ?? null };
  return [merged, ...list.filter((r) => r.id !== item.id)].sort((a, b) => b.ts - a.ts).slice(0, max);
}

/** "5 min ago", "Yesterday", "23 Oct". */
export function ago(ts: number, now = Date.now()): string {
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 2 * 86400) return 'Yesterday';
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const open = (): Promise<IDBDatabase> => new Promise((ok, bad) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => { r.result.createObjectStore(STORE, { keyPath: 'id' }); };
  r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
});
const tx = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  return new Promise((ok, bad) => { const r = f(db.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => { db.close(); ok(r.result); }; r.onerror = () => { db.close(); bad(r.error); }; });
};

export async function listRecents(): Promise<RecentItem[]> {
  try { return ((await tx('readonly', (s) => s.getAll())) as RecentItem[]).sort((a, b) => b.ts - a.ts); } catch { return []; }
}
export async function addRecent(item: RecentItem): Promise<RecentItem[]> {
  try {
    const next = mergeRecent(await listRecents(), item);
    for (const r of next.slice(MAX)) await tx('readwrite', (s) => s.delete(r.id));
    const withHandle = next[0]!;
    try { await tx('readwrite', (s) => s.put(withHandle)); } catch { await tx('readwrite', (s) => s.put({ ...withHandle, handle: null })); } // a stand-in handle cannot be stored: keep the entry without it
    return await listRecents();
  } catch { return []; }
}
export async function removeRecent(id: string): Promise<RecentItem[]> {
  try { await tx('readwrite', (s) => s.delete(id)); } catch { /* nothing to remove */ }
  return listRecents();
}
