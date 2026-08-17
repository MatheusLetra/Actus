import { describe, expect, it } from 'vitest';
import type {
  Habit,
  HabitCompletion,
  KanbanBoard,
  KanbanColumn,
  KanbanTask,
  PomodoroSession,
  PomodoroSettings,
  SyncTombstone,
} from '../types';
import { syncMergeService, type ActusSnapshot } from '../services/syncMergeService';
import { pomodoroService } from '../services/pomodoroService';

const nowIso = '2026-08-10T10:00:00.000Z';
const oldIso = '2026-01-01T10:00:00.000Z';

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit_1',
    name: 'Beber água',
    categoryId: 'cat_1',
    icon: 'Droplets',
    color: '#3b82f6',
    frequency: 'daily',
    startDate: '2026-08-01',
    active: true,
    createdAt: nowIso,
    ...overrides,
  };
}

function completion(habitId: string, date: string, completed = true, updatedAt?: string): HabitCompletion {
  return { id: `c_${habitId}_${date}`, habitId, date, completed, updatedAt };
}

function tombstone(kind: SyncTombstone['kind'], id: string, deletedAt: number): SyncTombstone {
  return { kind, id, deletedAt };
}

function session(overrides: Partial<PomodoroSession> = {}): PomodoroSession {
  return {
    id: 'pomo_1',
    cycleType: 'focus',
    plannedSeconds: 1500,
    remainingSeconds: 0,
    status: 'completed',
    startedAt: nowIso,
    completedAt: nowIso,
    date: '2026-08-10',
    ...overrides,
  };
}

function board(overrides: Partial<KanbanBoard> = {}): KanbanBoard {
  return { id: 'board_1', name: 'Meu Quadro', color: '#8b5cf6', createdAt: nowIso, updatedAt: nowIso, ...overrides };
}

function column(overrides: Partial<KanbanColumn> = {}): KanbanColumn {
  return { id: 'col_1', name: 'A Fazer', color: '#ef4444', order: 0, createdAt: nowIso, ...overrides };
}

function task(overrides: Partial<KanbanTask> = {}): KanbanTask {
  return {
    id: 'task_1',
    columnId: 'col_1',
    title: 'Estudar',
    order: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides,
  };
}

function settings(overrides: Partial<PomodoroSettings> = {}): PomodoroSettings {
  return { ...pomodoroService.getDefaultSettings(), ...overrides };
}

function snapshot(overrides: Partial<ActusSnapshot> = {}): ActusSnapshot {
  return {
    version: 3,
    updatedAt: 1000,
    categories: [],
    habits: [],
    completions: [],
    pomodoroSettings: settings(),
    pomodoroSessions: [],
    kanbanBoard: board(),
    kanbanColumns: [],
    kanbanTasks: [],
    tombstones: [],
    ...overrides,
  };
}

describe('syncMergeService', () => {
  it('should return null when both snapshots are null', () => {
    expect(syncMergeService.mergeSnapshots(null, null)).toBeNull();
  });

  it('should return the remote snapshot when local is null', () => {
    const remote = snapshot({ updatedAt: 500 });
    const merged = syncMergeService.mergeSnapshots(null, remote);
    expect(merged).toEqual(remote);
  });

  it('should return the local snapshot when remote is null', () => {
    const local = snapshot({ updatedAt: 500 });
    const merged = syncMergeService.mergeSnapshots(local, null);
    expect(merged).toEqual(local);
  });

  it('should preserve items that exist only on one side (union)', () => {
    const local = snapshot({ habits: [habit({ id: 'habit_local' })] });
    const remote = snapshot({ habits: [habit({ id: 'habit_remote' })] });
    const merged = syncMergeService.mergeSnapshots(local, remote);
    expect(merged!.habits.map((h) => h.id).sort()).toEqual(['habit_local', 'habit_remote']);
  });

  it('should keep the newer version of an item present on both sides', () => {
    const local = snapshot({
      updatedAt: 100,
      habits: [habit({ id: 'habit_1', name: 'Local' })],
    });
    const remote = snapshot({
      updatedAt: 200,
      habits: [habit({ id: 'habit_1', name: 'Remoto' })],
    });
    const merged = syncMergeService.mergeSnapshots(local, remote);
    expect(merged!.habits).toHaveLength(1);
    expect(merged!.habits[0].name).toBe('Remoto');
  });

  it('should merge completions by habitId+date, preferring completed', () => {
    const local = snapshot({ completions: [completion('habit_1', '2026-08-01')] });
    const remote = snapshot({
      completions: [
        completion('habit_1', '2026-08-01', false),
        completion('habit_1', '2026-08-02', true),
      ],
    });
    const merged = syncMergeService.mergeSnapshots(local, remote);
    expect(merged!.completions).toHaveLength(2);
    const first = merged!.completions.find((c) => c.date === '2026-08-01');
    expect(first!.completed).toBe(true);
  });

  it('should merge pomodoro sessions by id, keeping the most recently completed', () => {
    const local = snapshot({
      pomodoroSessions: [session({ id: 'pomo_1', completedAt: oldIso })],
    });
    const remote = snapshot({
      pomodoroSessions: [session({ id: 'pomo_1', completedAt: nowIso })],
    });
    const merged = syncMergeService.mergeSnapshots(local, remote);
    expect(merged!.pomodoroSessions).toHaveLength(1);
    expect(merged!.pomodoroSessions[0].completedAt).toBe(nowIso);
  });

  it('should preserve an active session deadline during sync', () => {
    const endAt = '2026-08-10T10:25:00.000Z';
    const local = snapshot({
      pomodoroSessions: [session({ id: 'pomo_1', status: 'running', completedAt: undefined, endAt })],
    });
    const remote = snapshot({ pomodoroSessions: [] });

    const merged = syncMergeService.mergeSnapshots(local, remote);

    expect(merged!.pomodoroSessions[0].endAt).toBe(endAt);
  });

  it('should prefer a terminal session over a stale active copy', () => {
    const local = snapshot({
      pomodoroSessions: [session({ id: 'pomo_1', status: 'completed', completedAt: nowIso })],
    });
    const remote = snapshot({
      pomodoroSessions: [
        session({ id: 'pomo_1', status: 'running', completedAt: undefined, endAt: '2026-08-10T10:30:00.000Z' }),
      ],
    });

    const merged = syncMergeService.mergeSnapshots(local, remote);

    expect(merged!.pomodoroSessions[0].status).toBe('completed');
  });

  it('should pick settings from the side with the newer snapshot timestamp', () => {
    const local = snapshot({ updatedAt: 100, pomodoroSettings: settings({ focusMinutes: 25 }) });
    const remote = snapshot({ updatedAt: 200, pomodoroSettings: settings({ focusMinutes: 50 }) });
    const merged = syncMergeService.mergeSnapshots(local, remote);
    expect(merged!.pomodoroSettings.focusMinutes).toBe(50);
  });

  it('should pick kanban board by its own updatedAt', () => {
    const local = snapshot({ kanbanBoard: board({ updatedAt: oldIso }) });
    const remote = snapshot({ kanbanBoard: board({ updatedAt: nowIso }) });
    const merged = syncMergeService.mergeSnapshots(local, remote);
    expect(merged!.kanbanBoard.updatedAt).toBe(nowIso);
  });

  it('should take the greatest updatedAt of both snapshots', () => {
    const local = snapshot({ updatedAt: 500 });
    const remote = snapshot({ updatedAt: 600 });
    expect(syncMergeService.mergeSnapshots(local, remote)!.updatedAt).toBe(600);
  });

  it('should sort and reindex merged kanban columns/tasks by order', () => {
    const local = snapshot({
      kanbanColumns: [column({ id: 'col_1', order: 1 }), column({ id: 'col_2', order: 2 })],
      kanbanTasks: [task({ id: 'task_2', columnId: 'col_2', order: 5 })],
    });
    const remote = snapshot({
      kanbanColumns: [column({ id: 'col_0', order: 0 })],
      kanbanTasks: [task({ id: 'task_1', columnId: 'col_1', order: 0 })],
    });
    const merged = syncMergeService.mergeSnapshots(local, remote);
    expect(merged!.kanbanColumns.map((c) => c.id)).toEqual(['col_0', 'col_1', 'col_2']);
    expect(merged!.kanbanColumns.map((c) => c.order)).toEqual([0, 1, 2]);
    expect(merged!.kanbanTasks.map((t) => t.order)).toEqual([0, 1]);
  });

  it('should detect data equality by serialization', () => {
    const a = snapshot({ habits: [habit()] });
    const b = snapshot({ habits: [habit()] });
    expect(syncMergeService.dataEquals(a, b)).toBe(true);
  });

  it('should propagate a completion unmark as a tombstone (removing the remote record)', () => {
    const local = snapshot({
      updatedAt: 200,
      completions: [completion('habit_1', '2026-08-01', true, '2026-08-10T08:00:00.000Z')],
    });
    const remote = snapshot({
      updatedAt: 300,
      tombstones: [tombstone('completion', 'habit_1|2026-08-01', dateMs('2026-08-10T09:00:00.000Z'))],
    });
    const merged = syncMergeService.mergeSnapshots(local, remote);
    expect(merged!.completions).toHaveLength(0);
    expect(merged!.tombstones).toHaveLength(1);
  });

  it('should revive a completion when re-marked with a newer updatedAt than the tombstone', () => {
    const local = snapshot({
      updatedAt: 500,
      tombstones: [tombstone('completion', 'habit_1|2026-08-01', dateMs('2026-08-10T08:00:00.000Z'))],
    });
    const remote = snapshot({
      updatedAt: 400,
      completions: [completion('habit_1', '2026-08-01', true, '2026-08-10T09:00:00.000Z')],
    });
    const merged = syncMergeService.mergeSnapshots(local, remote);
    expect(merged!.completions).toHaveLength(1);
    expect(merged!.completions[0].completed).toBe(true);
    expect(merged!.tombstones).toHaveLength(0);
  });

  it('should drop a habit covered by a habit tombstone', () => {
    const local = snapshot({
      updatedAt: 200,
      habits: [habit({ id: 'habit_1', createdAt: oldIso })],
    });
    const remote = snapshot({
      updatedAt: 300,
      tombstones: [tombstone('habit', 'habit_1', dateMs('2026-01-15T00:00:00.000Z'))],
    });
    const merged = syncMergeService.mergeSnapshots(local, remote);
    expect(merged!.habits).toHaveLength(0);
  });

  it('should keep the newest tombstone when both sides have the same key', () => {
    const local = snapshot({
      tombstones: [tombstone('habit', 'habit_1', 100)],
    });
    const remote = snapshot({
      tombstones: [tombstone('habit', 'habit_1', 200)],
    });
    const merged = syncMergeService.mergeSnapshots(local, remote);
    expect(merged!.tombstones).toEqual([{ kind: 'habit', id: 'habit_1', deletedAt: 200 }]);
  });

  it('should default tombstones to an empty array in buildData', () => {
    const data = syncMergeService.buildData({ categories: [] });
    expect(data.tombstones).toEqual([]);
  });
});

function dateMs(iso: string): number {
  return new Date(iso).getTime();
}
