import { describe, expect, it } from 'vitest';
import { ago, mergeRecent, type RecentItem } from './recent';

const item = (id: string, ts: number, extra: Partial<RecentItem> = {}): RecentItem => ({ id, name: id, ts, thumb: null, handle: null, ...extra });

describe('recent designs', () => {
  it('puts the newest first and does not list a design twice', () => {
    const list = mergeRecent(mergeRecent([], item('a', 1)), item('b', 2));
    expect(list.map((r) => r.id)).toEqual(['b', 'a']);
    expect(mergeRecent(list, item('a', 3)).map((r) => r.id)).toEqual(['a', 'b']);
  });
  it('keeps the old picture and file when the new entry has none', () => {
    const h = { name: 'a.forge' } as never;
    const list = mergeRecent([], item('a', 1, { thumb: 'data:x', handle: h }));
    const next = mergeRecent(list, item('a', 5));
    expect(next[0]).toMatchObject({ thumb: 'data:x', handle: h, ts: 5 });
    expect(mergeRecent(list, item('a', 5, { thumb: 'data:y' }))[0]!.thumb).toBe('data:y');
  });
  it('keeps only the newest ones', () => {
    let list: RecentItem[] = [];
    for (let i = 0; i < 30; i++) list = mergeRecent(list, item(`d${i}`, i));
    expect(list).toHaveLength(24); expect(list[0]!.id).toBe('d29'); expect(list.at(-1)!.id).toBe('d6');
  });
  it('says how long ago in words', () => {
    const now = new Date('2026-10-26T12:00:00Z').getTime();
    expect(ago(now - 10_000, now)).toBe('just now');
    expect(ago(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(ago(now - 5 * 3600_000, now)).toBe('5 h ago');
    expect(ago(now - 30 * 3600_000, now)).toBe('Yesterday');
  });
});
