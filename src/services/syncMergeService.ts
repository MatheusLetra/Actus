import type {
  Category,
  Habit,
  HabitCompletion,
  KanbanBoard,
  KanbanColumn,
  KanbanTask,
  PomodoroSession,
  PomodoroSettings,
} from '@/types';
import { kanbanService } from './kanbanService';
import { pomodoroService } from './pomodoroService';

export interface ActusData {
  version: number;
  categories: Category[];
  habits: Habit[];
  completions: HabitCompletion[];
  pomodoroSettings: PomodoroSettings;
  pomodoroSessions: PomodoroSession[];
  kanbanBoard: KanbanBoard;
  kanbanColumns: KanbanColumn[];
  kanbanTasks: KanbanTask[];
}

export interface ActusSnapshot extends ActusData {
  updatedAt: number;
}

export const SYNC_VERSION = 3;

function toMilliseconds(input?: string): number {
  if (!input) return 0;
  const ms = new Date(input).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function getItemStamp(item: { updatedAt?: string; completedAt?: string; startedAt?: string }, fallback: number): number {
  const own = toMilliseconds(item.completedAt) || toMilliseconds(item.updatedAt) || toMilliseconds(item.startedAt);
  return own > 0 ? own : fallback;
}

function mergeById<T extends { id: string }>(
  localItems: T[],
  remoteItems: T[],
  localUpdatedAt: number,
  remoteUpdatedAt: number
): T[] {
  const map = new Map<string, T>();
  for (const item of localItems) map.set(item.id, item);
  for (const item of remoteItems) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      continue;
    }
    const stamp = (value: T) => getItemStamp(value as { updatedAt?: string; completedAt?: string; startedAt?: string }, 0);
    const localStamp = stamp(existing) || localUpdatedAt;
    const remoteStamp = stamp(item) || remoteUpdatedAt;
    if (remoteStamp > localStamp) map.set(item.id, item);
  }
  return Array.from(map.values());
}

function mergeCompletions(local: HabitCompletion[], remote: HabitCompletion[]): HabitCompletion[] {
  const map = new Map<string, HabitCompletion>();
  const key = (c: HabitCompletion) => `${c.habitId}|${c.date}`;
  for (const c of local) map.set(key(c), c);
  for (const c of remote) {
    const k = key(c);
    const existing = map.get(k);
    if (!existing || (!existing.completed && c.completed)) map.set(k, c);
  }
  return Array.from(map.values());
}

function mergeSessions(
  local: PomodoroSession[],
  remote: PomodoroSession[],
  localUpdatedAt: number,
  remoteUpdatedAt: number
): PomodoroSession[] {
  const stamp = (session: PomodoroSession) => getItemStamp(session, 0);
  const map = new Map<string, PomodoroSession>();
  for (const session of local) map.set(session.id, session);
  for (const session of remote) {
    const existing = map.get(session.id);
    if (!existing) {
      map.set(session.id, session);
      continue;
    }
    const localStamp = stamp(existing) || localUpdatedAt;
    const remoteStamp = stamp(session) || remoteUpdatedAt;
    if (remoteStamp > localStamp) map.set(session.id, session);
  }
  return Array.from(map.values());
}

function pickByTimestamp<T>(
  local: T,
  remote: T,
  localUpdatedAt: number,
  remoteUpdatedAt: number,
  stamp?: (value: T) => number
): T {
  const localStamp = stamp ? (stamp(local) || localUpdatedAt) : localUpdatedAt;
  const remoteStamp = stamp ? (stamp(remote) || remoteUpdatedAt) : remoteUpdatedAt;
  return remoteStamp > localStamp ? remote : local;
}

export const syncMergeService = {
  buildData(data: Partial<ActusData>): ActusData {
    return {
      version: data.version ?? SYNC_VERSION,
      categories: data.categories ?? [],
      habits: data.habits ?? [],
      completions: data.completions ?? [],
      pomodoroSettings: data.pomodoroSettings ?? pomodoroService.getDefaultSettings(),
      pomodoroSessions: data.pomodoroSessions ?? [],
      kanbanBoard: data.kanbanBoard ?? kanbanService.getDefaultBoard(),
      kanbanColumns: data.kanbanColumns ?? [],
      kanbanTasks: data.kanbanTasks ?? [],
    };
  },

  dataToJson(data: ActusData): string {
    return JSON.stringify(data);
  },

  dataEquals(a: ActusData, b: ActusData): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  },

  mergeSnapshots(local: ActusSnapshot | null, remote: ActusSnapshot | null): ActusSnapshot | null {
    if (!local) return remote ? { ...remote } : null;
    if (!remote) return { ...local };

    const localUpdatedAt = local.updatedAt || 0;
    const remoteUpdatedAt = remote.updatedAt || 0;
    const updatedAt = Math.max(localUpdatedAt, remoteUpdatedAt);

    const mergeSettings = pickByTimestamp(local.pomodoroSettings, remote.pomodoroSettings, localUpdatedAt, remoteUpdatedAt);
    const mergeBoard = pickByTimestamp(
      local.kanbanBoard,
      remote.kanbanBoard,
      localUpdatedAt,
      remoteUpdatedAt,
      (board: KanbanBoard) => toMilliseconds(board.updatedAt) || 0
    );

    const columns = kanbanService.reindexColumns(
      kanbanService.sortColumns(mergeById(local.kanbanColumns, remote.kanbanColumns, localUpdatedAt, remoteUpdatedAt))
    );
    const tasks = kanbanService.reindexTasks(
      kanbanService.sortTasks(mergeById(local.kanbanTasks, remote.kanbanTasks, localUpdatedAt, remoteUpdatedAt))
    );

    return {
      version: SYNC_VERSION,
      updatedAt,
      categories: mergeById(local.categories, remote.categories, localUpdatedAt, remoteUpdatedAt),
      habits: mergeById(local.habits, remote.habits, localUpdatedAt, remoteUpdatedAt),
      completions: mergeCompletions(local.completions, remote.completions),
      pomodoroSettings: mergeSettings,
      pomodoroSessions: mergeSessions(local.pomodoroSessions, remote.pomodoroSessions, localUpdatedAt, remoteUpdatedAt),
      kanbanBoard: mergeBoard,
      kanbanColumns: columns,
      kanbanTasks: tasks,
    };
  },

  toSnapshot(data: ActusData, updatedAt: number): ActusSnapshot {
    return { ...data, updatedAt };
  },
};