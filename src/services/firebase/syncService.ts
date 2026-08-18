import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import type { HabitCompletion, PomodoroSession } from '@/types';
import { db } from './config';
import { syncMergeService, SYNC_VERSION, type ActusData, type ActusSnapshot } from '../syncMergeService';
import { sanitizeForFirestore } from './snapshotSerialization';
import { fingerprint, syncDiagnostics } from './syncDiagnostics';

export const FIREBASE_FORMAT_VERSION = 2;
const MAX_CAS_RETRIES = 3;
const MAX_BATCH_OPERATIONS = 450;

export interface SyncManifest {
  formatVersion: 2;
  currentRevision: string;
  previousRevision: string | null;
  publishedAt: number;
  shardMonths: {
    completions: string[];
    pomodoro: string[];
  };
}

export interface PublishedSnapshot {
  snapshot: ActusSnapshot | null;
  formatVersion: 1 | 2;
  revision: string | null;
  manifest: SyncManifest | null;
}

export interface PublishResult {
  data: ActusData;
  revision: string | null;
  published: boolean;
  publishedAt: number;
}

export class SyncCasConflictError extends Error {
  readonly code = 'sync-cas-conflict';

  constructor() {
    super('The Firebase manifest changed during publication.');
  }
}

export class SyncRevisionInvalidError extends Error {
  readonly code = 'sync-revision-invalid';

  constructor(message: string) {
    super(message);
  }
}

interface StoredCore {
  updatedAt: number;
  data: Omit<ActusData, 'completions' | 'pomodoroSessions'>;
}

interface StoredRevisionCore {
  revision: string;
  baseRevision: string | null;
  createdAt: number;
  data: Omit<ActusData, 'completions' | 'pomodoroSessions'>;
}

interface StoredShard<T> {
  revision: string;
  items: T[];
}

function requireDb() {
  if (!db) throw new Error('Firebase não configurado. Verifique o arquivo .env.');
  return db;
}

function maskUid(uid: string): string {
  return fingerprint(uid).canonical;
}

function createRevisionId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const random = Math.random().toString(36).slice(2);
  return `rev_${Date.now().toString(36)}_${random}`;
}

function groupByMonth<T extends { date: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const month = item.date?.slice(0, 7);
    if (!month) continue;
    const list = groups.get(month);
    if (list) list.push(item);
    else groups.set(month, [item]);
  }
  return groups;
}

export function isSyncManifest(value: unknown): value is SyncManifest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SyncManifest>;
  return candidate.formatVersion === FIREBASE_FORMAT_VERSION
    && typeof candidate.currentRevision === 'string'
    && candidate.currentRevision.length > 0
    && (candidate.previousRevision === null || typeof candidate.previousRevision === 'string')
    && typeof candidate.publishedAt === 'number'
    && Array.isArray(candidate.shardMonths?.completions)
    && Array.isArray(candidate.shardMonths?.pomodoro)
    && candidate.shardMonths.completions.every((month) => typeof month === 'string')
    && candidate.shardMonths.pomodoro.every((month) => typeof month === 'string');
}

export function getManifestRevision(value: unknown): string | null {
  return isSyncManifest(value) ? value.currentRevision : null;
}

export function manifestMatchesBase(value: unknown, expectedRevision: string | null): boolean {
  return getManifestRevision(value) === expectedRevision;
}

function coreData(data: ActusData): Omit<ActusData, 'completions' | 'pomodoroSessions'> {
  return {
    version: SYNC_VERSION,
    categories: data.categories,
    projects: data.projects,
    habits: data.habits,
    pomodoroSettings: data.pomodoroSettings,
    kanbanBoard: data.kanbanBoard,
    kanbanColumns: data.kanbanColumns,
    kanbanTasks: data.kanbanTasks,
    tombstones: data.tombstones,
  };
}

function revisionRef(uid: string, revision: string) {
  return doc(requireDb(), 'users', uid, 'revisions', revision);
}

function shardRef(uid: string, revision: string, kind: 'completions' | 'pomodoro', month: string) {
  return doc(requireDb(), 'users', uid, 'revisions', revision, kind, month);
}

function manifestRef(uid: string) {
  return doc(requireDb(), 'users', uid, 'manifest', 'current');
}

async function readLegacySnapshot(uid: string, core: StoredCore): Promise<ActusSnapshot> {
  const instance = requireDb();
  const legacyCollectionRead = async (kind: 'completions' | 'pomodoro') => {
    const result = await getDocs(collection(instance, 'users', uid, kind));
    return result.docs.flatMap((item) => (Array.isArray(item.data().items) ? item.data().items : []));
  };
  const [completions, pomodoroSessions] = await Promise.all([
    legacyCollectionRead('completions'),
    legacyCollectionRead('pomodoro'),
  ]);
  const data = syncMergeService.buildData({ ...core.data, completions, pomodoroSessions });
  return syncMergeService.toSnapshot(data, core.updatedAt || 0);
}

async function readRevisionSnapshot(uid: string, manifest: SyncManifest): Promise<ActusSnapshot> {
  const revision = manifest.currentRevision;
  syncDiagnostics.log('REVISION_READ_START', { revision });
  const revisionSnapshot = await getDoc(revisionRef(uid, revision));
  if (!revisionSnapshot.exists()) throw new SyncRevisionInvalidError('Revision core is missing.');
  const storedCore = revisionSnapshot.data() as StoredRevisionCore;
  if (storedCore.revision !== revision || storedCore.baseRevision !== manifest.previousRevision || !storedCore.data) {
    throw new SyncRevisionInvalidError('Revision core does not match the manifest.');
  }

  const completionMonths = [...manifest.shardMonths.completions].sort();
  const pomodoroMonths = [...manifest.shardMonths.pomodoro].sort();
  const completionDocs = await Promise.all(completionMonths.map((month) => getDoc(shardRef(uid, revision, 'completions', month))));
  const pomodoroDocs = await Promise.all(pomodoroMonths.map((month) => getDoc(shardRef(uid, revision, 'pomodoro', month))));

  const readShard = <T>(snapshot: { exists: () => boolean; data: () => DocumentData | undefined }, kind: string): T[] => {
    if (!snapshot.exists()) throw new SyncRevisionInvalidError(`${kind} shard is missing.`);
    const shard = snapshot.data() as StoredShard<T> | undefined;
    if (!shard || shard.revision !== revision || !Array.isArray(shard.items)) {
      throw new SyncRevisionInvalidError(`${kind} shard revision is invalid.`);
    }
    return shard.items;
  };

  const completions = completionDocs.flatMap((snapshot) => readShard<HabitCompletion>(snapshot, 'Completion'));
  const pomodoroSessions = pomodoroDocs.flatMap((snapshot) => readShard<PomodoroSession>(snapshot, 'Pomodoro'));
  const data = syncMergeService.buildData({ ...storedCore.data, completions, pomodoroSessions });
  syncDiagnostics.log('REVISION_READ_END', { revision, completions: completions.length, pomodoroSessions: pomodoroSessions.length });
  return syncMergeService.toSnapshot(data, manifest.publishedAt);
}

async function readPublishedSnapshot(uid: string): Promise<PublishedSnapshot> {
  syncDiagnostics.log('MANIFEST_READ', { uid: maskUid(uid) });
  const manifestSnapshot = await getDoc(manifestRef(uid));
  if (manifestSnapshot.exists()) {
    const raw = manifestSnapshot.data();
    if (!isSyncManifest(raw)) throw new SyncRevisionInvalidError('Firebase manifest is invalid.');
    const snapshot = await readRevisionSnapshot(uid, raw);
    return { snapshot, formatVersion: 2, revision: raw.currentRevision, manifest: raw };
  }

  const legacySnapshot = await getDoc(doc(requireDb(), 'users', uid));
  if (!legacySnapshot.exists()) return { snapshot: null, formatVersion: 1, revision: null, manifest: null };
  const raw = legacySnapshot.data();
  const legacy = await readLegacySnapshot(uid, raw as StoredCore);
  return { snapshot: legacy, formatVersion: 1, revision: null, manifest: null };
}

async function writeRevision(uid: string, revision: string, baseRevision: string | null, data: ActusData): Promise<SyncManifest> {
  const createdAt = Date.now();
  const completionGroups = groupByMonth(data.completions);
  const pomodoroGroups = groupByMonth(data.pomodoroSessions);
  const operations: Array<{ reference: ReturnType<typeof doc>; value: unknown }> = [
    {
      reference: revisionRef(uid, revision),
      value: sanitizeForFirestore({ revision, baseRevision, createdAt, data: coreData(data) }),
    },
  ];

  for (const [month, items] of [...completionGroups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    operations.push({
      reference: shardRef(uid, revision, 'completions', month),
      value: sanitizeForFirestore({ revision, items }),
    });
  }
  for (const [month, items] of [...pomodoroGroups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    operations.push({
      reference: shardRef(uid, revision, 'pomodoro', month),
      value: sanitizeForFirestore({ revision, items }),
    });
  }

  syncDiagnostics.log('REVISION_WRITE_START', () => ({
    revision,
    baseRevision,
    operations: operations.length,
    completionShards: completionGroups.size,
    pomodoroShards: pomodoroGroups.size,
  }));
  for (let index = 0; index < operations.length; index += MAX_BATCH_OPERATIONS) {
    const batch = writeBatch(requireDb());
    for (const operation of operations.slice(index, index + MAX_BATCH_OPERATIONS)) batch.set(operation.reference, operation.value);
    await batch.commit();
  }
  syncDiagnostics.log('REVISION_CORE_WRITTEN', { revision });
  syncDiagnostics.log('REVISION_SHARD_WRITTEN', {
    revision,
    completionShards: completionGroups.size,
    pomodoroShards: pomodoroGroups.size,
  });
  syncDiagnostics.log('REVISION_WRITE_END', { revision });
  return {
    formatVersion: FIREBASE_FORMAT_VERSION,
    currentRevision: revision,
    previousRevision: baseRevision,
    publishedAt: Date.now(),
    shardMonths: {
      completions: [...completionGroups.keys()].sort(),
      pomodoro: [...pomodoroGroups.keys()].sort(),
    },
  };
}

async function publishManifest(uid: string, manifest: SyncManifest, expectedRevision: string | null): Promise<void> {
  const currentManifestRef = manifestRef(uid);
  syncDiagnostics.log('MANIFEST_CAS_START', { revision: manifest.currentRevision, baseRevision: expectedRevision });
  try {
    await runTransaction(requireDb(), async (transaction) => {
      const current = await transaction.get(currentManifestRef);
      const currentData = current.exists() ? current.data() : null;
      if (!manifestMatchesBase(currentData, expectedRevision)) throw new SyncCasConflictError();
      transaction.set(currentManifestRef, manifest);
    });
  } catch (error) {
    if (error instanceof SyncCasConflictError) syncDiagnostics.log('MANIFEST_CAS_CONFLICT', { revision: manifest.currentRevision });
    throw error;
  }
  syncDiagnostics.log('MANIFEST_CAS_SUCCESS', { revision: manifest.currentRevision });
}

let watchSequence = 0;

async function watchLegacySnapshot(uid: string, callback: (snapshot: ActusSnapshot | null) => void): Promise<() => void> {
  const instance = requireDb();
  let core: StoredCore | null | undefined;
  let completions: HabitCompletion[] | undefined;
  let pomodoroSessions: PomodoroSession[] | undefined;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const emit = () => {
    if (stopped || core === undefined || completions === undefined || pomodoroSessions === undefined) return;
    if (!core) return callback(null);
    callback(syncMergeService.toSnapshot(syncMergeService.buildData({ ...core.data, completions, pomodoroSessions }), core.updatedAt || 0));
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; emit(); }, 120);
  };
  const unsubCore = onSnapshot(doc(instance, 'users', uid), (snapshot) => { core = snapshot.exists() ? snapshot.data() as StoredCore : null; schedule(); });
  const unsubCompletions = onSnapshot(collection(instance, 'users', uid, 'completions'), (snapshot) => {
    completions = snapshot.docs.flatMap((item) => (Array.isArray(item.data().items) ? item.data().items : [])) as HabitCompletion[];
    schedule();
  });
  const unsubPomodoro = onSnapshot(collection(instance, 'users', uid, 'pomodoro'), (snapshot) => {
    pomodoroSessions = snapshot.docs.flatMap((item) => (Array.isArray(item.data().items) ? item.data().items : [])) as PomodoroSession[];
    schedule();
  });
  return () => { stopped = true; if (timer) clearTimeout(timer); unsubCore(); unsubCompletions(); unsubPomodoro(); };
}

export const syncService = {
  async readSnapshot(uid: string): Promise<ActusSnapshot | null> {
    return (await readPublishedSnapshot(uid)).snapshot;
  },

  async publishSnapshot(uid: string, localData: ActusData): Promise<PublishResult> {
    let lastConflict: unknown = null;
    for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt += 1) {
      const published = await readPublishedSnapshot(uid);
      const localSnapshot = syncMergeService.toSnapshot(localData, Date.now());
      const merged = syncMergeService.mergeSnapshots(localSnapshot, published.snapshot);
      if (!merged) throw new SyncRevisionInvalidError('Unable to build a publishable snapshot.');
      const mergedData = syncMergeService.snapshotToData(merged);
      const remoteData = published.snapshot ? syncMergeService.snapshotToData(published.snapshot) : null;
      if (remoteData && syncMergeService.dataEquals(mergedData, remoteData)) {
        return { data: remoteData, revision: published.revision, published: false, publishedAt: published.manifest?.publishedAt ?? 0 };
      }

      const revision = createRevisionId();
      const manifest = await writeRevision(uid, revision, published.revision, mergedData);
      try {
        await publishManifest(uid, manifest, published.revision);
        return { data: mergedData, revision, published: true, publishedAt: manifest.publishedAt };
      } catch (error) {
        if (!(error instanceof SyncCasConflictError)) throw error;
        lastConflict = error;
        syncDiagnostics.log('CAS_RETRY', { attempt: attempt + 1, revision });
      }
    }
    throw lastConflict ?? new SyncCasConflictError();
  },

  async writeSnapshot(uid: string, data: ActusData): Promise<void> {
    await this.publishSnapshot(uid, data);
  },

  watchSnapshot(uid: string, callback: (snapshot: ActusSnapshot | null) => void): () => void {
    const watchId = ++watchSequence;
    let stopped = false;
    let legacyUnsubscribe: (() => void) | null = null;
    let legacyStarting = false;
    let usingV2 = false;
    let lastRevision: string | null = null;
    let readToken = 0;
    syncDiagnostics.log('WATCH_START', { watch: watchId, uid: maskUid(uid), mode: 'manifest_or_legacy' });

    const stopLegacy = () => {
      legacyUnsubscribe?.();
      legacyUnsubscribe = null;
    };
    const manifestUnsubscribe = onSnapshot(manifestRef(uid), (snapshot) => {
      if (stopped) return;
      const raw = snapshot.exists() ? snapshot.data() : null;
      if (!isSyncManifest(raw)) {
        if (!legacyUnsubscribe && !legacyStarting) {
          legacyStarting = true;
          void watchLegacySnapshot(uid, callback).then((unsubscribe) => {
            legacyStarting = false;
            if (stopped || usingV2) unsubscribe();
            else legacyUnsubscribe = unsubscribe;
          });
        }
        return;
      }
      usingV2 = true;
      stopLegacy();
      if (raw.currentRevision === lastRevision) return;
      lastRevision = raw.currentRevision;
      const token = ++readToken;
      syncDiagnostics.log('MANIFEST_CHANGED', { watch: watchId, revision: raw.currentRevision });
      void readRevisionSnapshot(uid, raw).then((revisionSnapshot) => {
        if (!stopped && token === readToken) callback(revisionSnapshot);
      }).catch((error) => {
        syncDiagnostics.log('PUSH_ERROR', { watch: watchId, code: (error as { code?: string }).code });
      });
    });

    return () => {
      stopped = true;
      readToken += 1;
      stopLegacy();
      manifestUnsubscribe();
      syncDiagnostics.log('WATCH_STOP', { watch: watchId, uid: maskUid(uid) });
    };
  },
};
