import type {
  Category,
  Habit,
  HabitCompletion,
  KanbanBoard,
  KanbanColumn,
  KanbanTask,
  PomodoroSession,
  PomodoroSettings,
  Project,
  SyncTombstone,
  TombstoneKind,
} from '@/types';
import { kanbanService } from './kanbanService';
import { pomodoroService } from './pomodoroService';
import { projectService } from './projectService';

export interface ActusData {
  version: number;
  categories: Category[];
  projects: Project[];
  habits: Habit[];
  completions: HabitCompletion[];
  pomodoroSettings: PomodoroSettings;
  pomodoroSessions: PomodoroSession[];
  kanbanBoard: KanbanBoard;
  kanbanColumns: KanbanColumn[];
  kanbanTasks: KanbanTask[];
  tombstones: SyncTombstone[];
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

function getItemStamp(item: { updatedAt?: string; completedAt?: string; endAt?: string; startedAt?: string }, fallback: number): number {
  const own = toMilliseconds(item.completedAt) || toMilliseconds(item.updatedAt) || toMilliseconds(item.endAt) || toMilliseconds(item.startedAt);
  return own > 0 ? own : fallback;
}

function getHabitStamp(habit: Habit): number {
  return toMilliseconds(habit.updatedAt);
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
    const stamp = (value: T) => getItemStamp(value as { updatedAt?: string; completedAt?: string; endAt?: string; startedAt?: string }, 0);
    const localStamp = stamp(existing) || localUpdatedAt;
    const remoteStamp = stamp(item) || remoteUpdatedAt;
    if (remoteStamp > localStamp) map.set(item.id, item);
  }
  return Array.from(map.values());
}

function mergeHabits(
  localHabits: Habit[],
  remoteHabits: Habit[],
  localUpdatedAt: number,
  remoteUpdatedAt: number
): Habit[] {
  const map = new Map<string, Habit>();
  for (const habit of localHabits) map.set(habit.id, habit);
  for (const remoteHabit of remoteHabits) {
    const localHabit = map.get(remoteHabit.id);
    if (!localHabit) {
      map.set(remoteHabit.id, remoteHabit);
      continue;
    }

    const localStamp = getHabitStamp(localHabit);
    const remoteStamp = getHabitStamp(remoteHabit);
    const shouldUseRemote = localStamp > 0 && remoteStamp > 0
      ? remoteStamp > localStamp
      : localStamp === 0 && remoteStamp > 0
        ? true
        : localStamp > 0 && remoteStamp === 0
          ? false
          : remoteUpdatedAt > localUpdatedAt;

    if (shouldUseRemote) map.set(remoteHabit.id, remoteHabit);
  }
  return Array.from(map.values());
}

function mergeProjects(localProjects: Project[], remoteProjects: Project[]): Project[] {
  const map = new Map<string, Project>();
  for (const project of localProjects) map.set(project.id, project);
  for (const remoteProject of remoteProjects) {
    const localProject = map.get(remoteProject.id);
    if (!localProject) {
      map.set(remoteProject.id, remoteProject);
      continue;
    }

    const localStamp = toMilliseconds(localProject.updatedAt);
    const remoteStamp = toMilliseconds(remoteProject.updatedAt);
    if (remoteStamp > localStamp || (remoteStamp === localStamp && JSON.stringify(remoteProject) > JSON.stringify(localProject))) {
      map.set(remoteProject.id, remoteProject);
    }
  }
  return projectService.sort(Array.from(map.values()));
}

function mergeCompletions(local: HabitCompletion[], remote: HabitCompletion[]): HabitCompletion[] {
  const map = new Map<string, HabitCompletion>();
  const key = (c: HabitCompletion) => `${c.habitId}|${c.date}`;
  const stamp = (c: HabitCompletion) => toMilliseconds(c.updatedAt) || 0;
  for (const c of local) map.set(key(c), c);
  for (const c of remote) {
    const k = key(c);
    const existing = map.get(k);
    if (!existing) {
      map.set(k, c);
      continue;
    }
    if (existing.completed !== c.completed) {
      if (c.completed) map.set(k, c);
      continue;
    }
    if (stamp(c) > stamp(existing)) map.set(k, c);
  }
  return Array.from(map.values());
}

const TOMBSTONE_KEY = (t: SyncTombstone) => `${t.kind}|${t.id}`;

function mergeTombstones(local: SyncTombstone[], remote: SyncTombstone[]): SyncTombstone[] {
  const map = new Map<string, SyncTombstone>();
  for (const t of local) {
    const key = TOMBSTONE_KEY(t);
    const existing = map.get(key);
    if (!existing || t.deletedAt > existing.deletedAt) map.set(key, t);
  }
  for (const t of remote) {
    const key = TOMBSTONE_KEY(t);
    const existing = map.get(key);
    if (!existing || t.deletedAt > existing.deletedAt) map.set(key, t);
  }
  return Array.from(map.values());
}

function toPerItemStamp(item: {
  updatedAt?: string;
  completedAt?: string;
  endAt?: string;
  startedAt?: string;
  createdAt?: string;
}): number {
  return (
    toMilliseconds(item.updatedAt) ||
    toMilliseconds(item.completedAt) ||
    toMilliseconds(item.endAt) ||
    toMilliseconds(item.startedAt) ||
    toMilliseconds(item.createdAt) ||
    0
  );
}

// Remove itens que possuam um tombstone ativo (exclusão mais recente que o próprio item).
// Um item pode "reviver" se tiver um carimbo próprio mais novo que a exclusão (ex.: re-marcação).
function filterTombstoned<T extends { id: string }>(
  items: T[],
  runningTombstones: SyncTombstone[],
  kind: TombstoneKind,
  keyOf: (item: T) => string,
  stampOf: (item: T) => number
): T[] {
  const kept: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    const idx = runningTombstones.findIndex((t) => t.kind === kind && t.id === key);
    if (idx === -1) {
      kept.push(item);
      continue;
    }
    const itemStamp = stampOf(item);
    if (itemStamp > 0 && itemStamp > runningTombstones[idx].deletedAt) {
      runningTombstones.splice(idx, 1);
      kept.push(item);
    }
  }
  return kept;
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
    const localTerminal = existing.status === 'completed' || existing.status === 'cancelled';
    const remoteTerminal = session.status === 'completed' || session.status === 'cancelled';
    if (localTerminal !== remoteTerminal) {
      if (remoteTerminal) map.set(session.id, session);
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

function normalizeTaskProjectReferences(tasks: KanbanTask[], projects: Project[]): KanbanTask[] {
  const projectIds = new Set(projects.map((project) => project.id));
  return tasks.map((task) =>
    task.projectId && !projectIds.has(task.projectId)
      ? { ...task, projectId: null }
      : task
  );
}

function normalizeProjectSnapshot(snapshot: ActusSnapshot): ActusSnapshot {
  const tombstones = [...snapshot.tombstones];
  const projects = filterTombstoned(
    snapshot.projects ?? [],
    tombstones,
    'project',
    (project) => project.id,
    (project) => toPerItemStamp(project)
  );
  return {
    ...snapshot,
    projects: projectService.sort(projects),
    kanbanTasks: normalizeTaskProjectReferences(snapshot.kanbanTasks, projects),
    tombstones,
  };
}

export const syncMergeService = {
  buildData(data: Partial<ActusData>): ActusData {
    return {
      version: data.version ?? SYNC_VERSION,
      categories: data.categories ?? [],
      projects: data.projects ?? [],
      habits: data.habits ?? [],
      completions: data.completions ?? [],
      pomodoroSettings: data.pomodoroSettings ?? pomodoroService.getDefaultSettings(),
      pomodoroSessions: data.pomodoroSessions ?? [],
      kanbanBoard: data.kanbanBoard ?? kanbanService.getDefaultBoard(),
      kanbanColumns: data.kanbanColumns ?? [],
      kanbanTasks: data.kanbanTasks ?? [],
      tombstones: data.tombstones ?? [],
    };
  },

  dataToJson(data: ActusData): string {
    return JSON.stringify(data);
  },

  snapshotToData(snapshot: ActusSnapshot): ActusData {
    const { updatedAt: _updatedAt, ...data } = snapshot;
    return data;
  },

  dataEquals(a: ActusData, b: ActusData): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  },

  mergeSnapshots(local: ActusSnapshot | null, remote: ActusSnapshot | null): ActusSnapshot | null {
    if (!local) return remote ? normalizeProjectSnapshot({ ...remote, projects: remote.projects ?? [] }) : null;
    if (!remote) return normalizeProjectSnapshot({ ...local, projects: local.projects ?? [] });

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

    const mergedTombstones = mergeTombstones(local.tombstones, remote.tombstones);
    const activeTombstones = [...mergedTombstones];

    const byId = (item: { id: string }) => item.id;
    const categories = filterTombstoned(local.categories, activeTombstones, 'category', byId, (c) =>
      toPerItemStamp(c)
    );
    const remoteCategories = filterTombstoned(remote.categories, activeTombstones, 'category', byId, (c) =>
      toPerItemStamp(c)
    );
    const localProjects = filterTombstoned(local.projects ?? [], activeTombstones, 'project', byId, (project) =>
      toPerItemStamp(project)
    );
    const remoteProjects = filterTombstoned(remote.projects ?? [], activeTombstones, 'project', byId, (project) =>
      toPerItemStamp(project)
    );
    const habits = filterTombstoned(local.habits, activeTombstones, 'habit', byId, (h) => toPerItemStamp(h));
    const remoteHabits = filterTombstoned(remote.habits, activeTombstones, 'habit', byId, (h) => toPerItemStamp(h));
    const localCompletions = filterTombstoned(
      local.completions,
      activeTombstones,
      'completion',
      (c) => `${c.habitId}|${c.date}`,
      (c) => toMilliseconds(c.updatedAt) || 0
    );
    const remoteCompletions = filterTombstoned(
      remote.completions,
      activeTombstones,
      'completion',
      (c) => `${c.habitId}|${c.date}`,
      (c) => toMilliseconds(c.updatedAt) || 0
    );
    const localSessions = filterTombstoned(
      local.pomodoroSessions,
      activeTombstones,
      'pomodoroSession',
      byId,
      (s) => toPerItemStamp(s)
    );
    const remoteSessions = filterTombstoned(
      remote.pomodoroSessions,
      activeTombstones,
      'pomodoroSession',
      byId,
      (s) => toPerItemStamp(s)
    );
    const localColumns = filterTombstoned(
      local.kanbanColumns,
      activeTombstones,
      'kanbanColumn',
      byId,
      (c) => toPerItemStamp(c)
    );
    const remoteColumns = filterTombstoned(
      remote.kanbanColumns,
      activeTombstones,
      'kanbanColumn',
      byId,
      (c) => toPerItemStamp(c)
    );
    const localTasks = filterTombstoned(local.kanbanTasks, activeTombstones, 'kanbanTask', byId, (t) =>
      toPerItemStamp(t)
    );
    const remoteTasks = filterTombstoned(remote.kanbanTasks, activeTombstones, 'kanbanTask', byId, (t) =>
      toPerItemStamp(t)
    );

    const mergedColumns = kanbanService.reindexColumns(
      kanbanService.sortColumns(mergeById(localColumns, remoteColumns, localUpdatedAt, remoteUpdatedAt))
    );
    const mergedTasks = kanbanService.reindexTasks(
      kanbanService.sortTasks(mergeById(localTasks, remoteTasks, localUpdatedAt, remoteUpdatedAt))
    );
    const projects = mergeProjects(localProjects, remoteProjects);

    return {
      version: SYNC_VERSION,
      updatedAt,
      categories: mergeById(categories, remoteCategories, localUpdatedAt, remoteUpdatedAt),
      projects,
      habits: mergeHabits(habits, remoteHabits, localUpdatedAt, remoteUpdatedAt),
      completions: mergeCompletions(localCompletions, remoteCompletions),
      pomodoroSettings: mergeSettings,
      pomodoroSessions: mergeSessions(localSessions, remoteSessions, localUpdatedAt, remoteUpdatedAt),
      kanbanBoard: mergeBoard,
      kanbanColumns: mergedColumns,
      kanbanTasks: normalizeTaskProjectReferences(mergedTasks, projects),
      tombstones: activeTombstones,
    };
  },

  toSnapshot(data: ActusData, updatedAt: number): ActusSnapshot {
    return { ...data, updatedAt };
  },
};
