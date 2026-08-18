import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncService } from '../services/firebase/syncService';
import { syncMergeService, type ActusData } from '../services/syncMergeService';

const fake = vi.hoisted(() => {
  const documents = new Map<string, unknown>();
  let injectConflict = false;
  let getDocsCalls = 0;
  const ref = (parts: string[]) => ({ path: parts.join('/') });
  const snapshot = (path: string) => ({
    exists: () => documents.has(path),
    data: () => documents.get(path),
  });
  return {
    documents,
    ref,
    snapshot,
    getDocsCalls: () => getDocsCalls,
    reset() {
      documents.clear();
      injectConflict = false;
      getDocsCalls = 0;
    },
    injectNextConflict() { injectConflict = true; },
    firestore: {
      doc: (_db: unknown, ...parts: string[]) => ref(parts),
      collection: (_db: unknown, ...parts: string[]) => ref(parts),
      getDoc: async (document: { path: string }) => snapshot(document.path),
      getDocs: async (collectionRef: { path: string }) => {
        getDocsCalls += 1;
        const prefix = `${collectionRef.path}/`;
        return {
          docs: [...documents.entries()]
            .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
            .map(([path]) => ({ id: path.slice(prefix.length), data: () => documents.get(path) })),
        };
      },
      writeBatch: () => {
        const operations: Array<{ path: string; value: unknown }> = [];
        return {
          set(document: { path: string }, value: unknown) { operations.push({ path: document.path, value }); },
          async commit() {
            for (const operation of operations) documents.set(operation.path, operation.value);
            if (injectConflict && documents.has('users/u1/manifest/current')) {
              injectConflict = false;
              documents.set('users/u1/manifest/current', {
                formatVersion: 2,
                currentRevision: 'RB',
                previousRevision: 'R1',
                publishedAt: 2,
                shardMonths: { completions: [], pomodoro: [] },
              });
              documents.set('users/u1/revisions/RB', {
                revision: 'RB', baseRevision: 'R1', createdAt: 2,
                data: baseDataForConflict(),
              });
            }
          },
        };
      },
      async runTransaction(_db: unknown, callback: (transaction: {
        get(document: { path: string }): Promise<ReturnType<typeof snapshot>>;
        set(document: { path: string }, value: unknown): void;
      }) => Promise<void>) {
        const writes: Array<{ path: string; value: unknown }> = [];
        await callback({
          get: async (document) => snapshot(document.path),
          set(document, value) { writes.push({ path: document.path, value }); },
        });
        for (const write of writes) documents.set(write.path, write.value);
      },
      onSnapshot: () => () => undefined,
    },
  };
});

function baseDataForConflict(): ActusData {
  return {
    ...baseData(),
    completions: [],
    pomodoroSessions: [],
  };
}

vi.mock('firebase/firestore', () => fake.firestore);
vi.mock('../services/firebase/config', () => ({ db: {} }));

const baseData = (): ActusData => ({
  version: 3,
  categories: [],
  projects: [],
  habits: [],
  completions: [{ id: 'c1', habitId: 'h1', date: '2026-01-01', completed: true }],
  pomodoroSettings: {
    focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakInterval: 4,
    autoStartBreaks: false, autoStartFocus: false, notificationsEnabled: false, soundEnabled: false,
  },
  pomodoroSessions: [{
    id: 'p1', cycleType: 'focus', plannedSeconds: 1500, remainingSeconds: 0,
    status: 'completed', startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:25:00.000Z', date: '2026-01-01',
  }],
  kanbanBoard: {
    id: 'board_1', name: 'Board', color: '#8b5cf6',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
  kanbanColumns: [],
  kanbanTasks: [],
  tombstones: [],
});

describe('versioned syncService', () => {
  beforeEach(() => fake.reset());

  it('publishes revision documents before an isolated manifest and reads only declared v2 shards', async () => {
    const result = await syncService.publishSnapshot('u1', baseData());
    expect(result.published).toBe(true);
    expect(fake.documents.has('users/u1/manifest/current')).toBe(true);
    expect(fake.documents.has(`users/u1/revisions/${result.revision}`)).toBe(true);
    expect(fake.documents.has(`users/u1/revisions/${result.revision}/completions/2026-01`)).toBe(true);
    expect(fake.documents.has(`users/u1/revisions/${result.revision}/pomodoro/2026-01`)).toBe(true);

    const callsBeforeRead = fake.getDocsCalls();
    const snapshot = await syncService.readSnapshot('u1');
    expect(snapshot?.completions).toHaveLength(1);
    expect(snapshot?.pomodoroSessions).toHaveLength(1);
    expect(fake.getDocsCalls()).toBe(callsBeforeRead);
  });

  it('retries CAS conflict by rereading the published revision and preserving the latest base', async () => {
    fake.documents.set('users/u1/manifest/current', {
      formatVersion: 2,
      currentRevision: 'R1',
      previousRevision: null,
      publishedAt: 1,
      shardMonths: { completions: [], pomodoro: [] },
    });
    fake.documents.set('users/u1/revisions/R1', {
      revision: 'R1', baseRevision: null, createdAt: 1,
      data: syncMergeService.snapshotToData(syncMergeService.toSnapshot(baseData(), 1)),
    });
    fake.injectNextConflict();

    const result = await syncService.publishSnapshot('u1', {
      ...baseData(),
      habits: [{
        id: 'h1', name: 'A', categoryId: 'c1', frequency: 'daily', startDate: '2026-01-01', active: true,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
      }],
    });
    expect(result.published).toBe(true);
    const manifest = fake.documents.get('users/u1/manifest/current') as { currentRevision: string; previousRevision: string };
    expect(manifest.currentRevision).toBe(result.revision);
    expect(manifest.previousRevision).toBe('RB');
  });

  it('rejects a manifest that points to a missing revision shard', async () => {
    fake.documents.set('users/u1/manifest/current', {
      formatVersion: 2,
      currentRevision: 'R2',
      previousRevision: 'R1',
      publishedAt: 2,
      shardMonths: { completions: ['2026-01'], pomodoro: [] },
    });
    fake.documents.set('users/u1/revisions/R2', {
      revision: 'R2', baseRevision: 'R1', createdAt: 2, data: syncMergeService.snapshotToData(syncMergeService.toSnapshot(baseData(), 2)),
    });
    await expect(syncService.readSnapshot('u1')).rejects.toThrow('Completion shard is missing');
  });
});
