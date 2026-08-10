import { STORAGE_KEYS } from '@/constants';
import type { SyncTombstone, TombstoneKind } from '@/types';
import { storageService } from './storageService';

export const COMPLETION_TOMBSTONE_KEY = (habitId: string, date: string) => `${habitId}|${date}`;

export const tombstoneRepository = {
  getAll(): SyncTombstone[] {
    return storageService.getItem<SyncTombstone[]>(STORAGE_KEYS.tombstones, []);
  },

  saveAll(tombstones: SyncTombstone[]): void {
    storageService.setItem(STORAGE_KEYS.tombstones, tombstones);
  },

  add(kind: TombstoneKind, id: string, deletedAt = Date.now()): SyncTombstone[] {
    const updated = [...this.getAll().filter((t) => !(t.kind === kind && t.id === id)), { kind, id, deletedAt }];
    this.saveAll(updated);
    return updated;
  },

  addAll(tombstones: SyncTombstone[]): SyncTombstone[] {
    const map = new Map<string, SyncTombstone>();
    for (const t of this.getAll()) map.set(`${t.kind}|${t.id}`, t);
    for (const t of tombstones) map.set(`${t.kind}|${t.id}`, t);
    const updated = Array.from(map.values());
    this.saveAll(updated);
    return updated;
  },

  remove(kind: TombstoneKind, id: string): SyncTombstone[] {
    const updated = this.getAll().filter((t) => !(t.kind === kind && t.id === id));
    this.saveAll(updated);
    return updated;
  },

  removeCompletion(habitId: string, date: string): SyncTombstone[] {
    return this.remove('completion', COMPLETION_TOMBSTONE_KEY(habitId, date));
  },

  addCompletion(habitId: string, date: string, deletedAt = Date.now()): SyncTombstone[] {
    return this.add('completion', COMPLETION_TOMBSTONE_KEY(habitId, date), deletedAt);
  },
};