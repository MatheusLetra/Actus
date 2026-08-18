import type { ActusData, ActusSnapshot } from '@/services/syncMergeService';
import { stableSerialize } from './snapshotSerialization';

export type SyncDiagnosticEvent =
  | 'SYNC_SESSION_START'
  | 'SYNC_SESSION_STOP'
  | 'INITIAL_SYNC_START'
  | 'INITIAL_SYNC_END'
  | 'WATCH_START'
  | 'WATCH_STOP'
  | 'REMOTE_CORE'
  | 'REMOTE_COMPLETIONS'
  | 'REMOTE_POMODORO'
  | 'REMOTE_SNAPSHOT_READY'
  | 'REMOTE_RECEIVED'
  | 'REMOTE_DEFERRED'
  | 'REMOTE_RECONCILED'
  | 'REMOTE_STALE'
  | 'REMOTE_IGNORED'
  | 'REMOTE_IMPORTED'
  | 'REMOTE_WRITEBACK_REQUESTED'
  | 'MANIFEST_READ'
  | 'MANIFEST_CHANGED'
  | 'REVISION_READ_START'
  | 'REVISION_READ_END'
  | 'REVISION_WRITE_START'
  | 'REVISION_CORE_WRITTEN'
  | 'REVISION_SHARD_WRITTEN'
  | 'REVISION_WRITE_END'
  | 'MANIFEST_CAS_START'
  | 'MANIFEST_CAS_SUCCESS'
  | 'MANIFEST_CAS_CONFLICT'
  | 'CAS_RETRY'
  | 'LOCAL_CHANGED'
  | 'PUSH_SCHEDULED'
  | 'PUSH_ENQUEUED'
  | 'PUSH_START'
  | 'PUSH_SUCCESS'
  | 'PUSH_ERROR'
  | 'WRITE_SNAPSHOT_START'
  | 'WRITE_CORE'
  | 'WRITE_COMPLETION_SHARD'
  | 'WRITE_POMODORO_SHARD'
  | 'DELETE_COMPLETION_SHARD'
  | 'DELETE_POMODORO_SHARD'
  | 'WRITE_SNAPSHOT_END'
  | 'QUOTA_GUARD_BLOCKED';

export type SyncDiagnosticMode = 'normal' | 'no-writes' | 'no-listeners';
export type SyncDiagnosticMetadata = Record<string, unknown>;

export interface SyncFingerprint {
  raw: string;
  canonical: string;
}

export interface SyncDataSummary {
  snapshotHash: string;
  snapshotRawHash: string;
  coreHash: string;
  coreRawHash: string;
  completionsHash: string;
  completionsRawHash: string;
  pomodoroHash: string;
  pomodoroRawHash: string;
  counts: Record<string, number>;
  completionShards: number;
  pomodoroShards: number;
}

const HASH_MASK = 0xffffffff;

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) & HASH_MASK;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function serialize(value: unknown, sortKeys: boolean): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return `string:${JSON.stringify(value)}`;
  if (typeof value === 'number') return `number:${Number.isNaN(value) ? 'NaN' : value}`;
  if (typeof value === 'boolean') return `boolean:${value}`;
  if (typeof value === 'bigint') return `bigint:${value.toString()}`;
  if (typeof value === 'function') return 'function';
  if (Array.isArray(value)) return `[${value.map((item) => serialize(item, sortKeys)).join(',')}]`;

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (sortKeys) entries.sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${serialize(nested, sortKeys)}`).join(',')}}`;
  }

  return `${typeof value}:${String(value)}`;
}

export function fingerprint(value: unknown): SyncFingerprint {
  return {
    raw: hashText(serialize(value, false)),
    canonical: hashText(stableSerialize(value)),
  };
}

function getMonthCount(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return new Set(items.map((item) => (
    item && typeof item === 'object' && typeof (item as { date?: unknown }).date === 'string'
      ? (item as { date: string }).date.slice(0, 7)
      : ''
  )).filter(Boolean)).size;
}

export function summarizeData(data: ActusData | ActusSnapshot): SyncDataSummary {
  const { updatedAt: _updatedAt, ...snapshotData } = data as ActusSnapshot;
  const core = {
    categories: data.categories,
    projects: data.projects,
    habits: data.habits,
    pomodoroSettings: data.pomodoroSettings,
    kanbanBoard: data.kanbanBoard,
    kanbanColumns: data.kanbanColumns,
    kanbanTasks: data.kanbanTasks,
    tombstones: data.tombstones,
  };
  const snapshotFingerprint = fingerprint(snapshotData);
  const coreFingerprint = fingerprint(core);
  const completionsFingerprint = fingerprint(data.completions);
  const pomodoroFingerprint = fingerprint(data.pomodoroSessions);
  return {
    snapshotHash: snapshotFingerprint.canonical,
    snapshotRawHash: snapshotFingerprint.raw,
    coreHash: coreFingerprint.canonical,
    coreRawHash: coreFingerprint.raw,
    completionsHash: completionsFingerprint.canonical,
    completionsRawHash: completionsFingerprint.raw,
    pomodoroHash: pomodoroFingerprint.canonical,
    pomodoroRawHash: pomodoroFingerprint.raw,
    counts: {
      categories: data.categories.length,
      projects: data.projects.length,
      habits: data.habits.length,
      completions: data.completions.length,
      pomodoroSessions: data.pomodoroSessions.length,
      kanbanColumns: data.kanbanColumns.length,
      kanbanTasks: data.kanbanTasks.length,
      tombstones: data.tombstones.length,
    },
    completionShards: getMonthCount(data.completions),
    pomodoroShards: getMonthCount(data.pomodoroSessions),
  };
}

function getDefaultMode(): SyncDiagnosticMode {
  if (!import.meta.env.DEV || typeof window === 'undefined') return 'normal';
  const mode = new URLSearchParams(window.location.search).get('actusSyncMode');
  return mode === 'no-writes' || mode === 'no-listeners' ? mode : 'normal';
}

export interface SyncDiagnosticsOptions {
  enabled: boolean;
  mode?: SyncDiagnosticMode;
  output?: (line: string) => void;
}

export function createSyncDiagnostics({ enabled, mode = getDefaultMode(), output = console.log }: SyncDiagnosticsOptions) {
  let sequence = 0;

  return {
    enabled,
    mode,
    writesEnabled: mode !== 'no-writes' && mode !== 'no-listeners',
    listenersEnabled: mode !== 'no-listeners',
    fingerprint,
    summarizeData,
    log(event: SyncDiagnosticEvent, metadata?: SyncDiagnosticMetadata | (() => SyncDiagnosticMetadata)) {
      if (!enabled) return;
      sequence += 1;
      const resolved = typeof metadata === 'function' ? metadata() : metadata;
      const fields = Object.entries(resolved ?? {})
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
        .join(' ');
      output(`[ACTUS_SYNC #${String(sequence).padStart(3, '0')}] event=${event}${fields ? ` ${fields}` : ''}`);
    },
  };
}

export const syncDiagnostics = createSyncDiagnostics({
  enabled: import.meta.env.DEV,
});
