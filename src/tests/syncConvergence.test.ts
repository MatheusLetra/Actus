import { describe, expect, it } from 'vitest';
import type { ActusData, ActusSnapshot } from '../services/syncMergeService';
import { sanitizeForFirestore } from '../services/firebase/snapshotSerialization';
import { syncMergeService } from '../services/syncMergeService';

const date = '2026-01-01T00:00:00.000Z';

function data(overrides: Partial<ActusData> = {}): ActusData {
  return {
    version: 3,
    categories: [],
    projects: [],
    habits: [],
    completions: [],
    pomodoroSettings: {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      longBreakInterval: 4,
      autoStartBreaks: false,
      autoStartFocus: false,
      notificationsEnabled: false,
      soundEnabled: false,
      linkedHabitId: null,
      linkedTaskId: null,
    },
    pomodoroSessions: [],
    kanbanBoard: {
      id: 'board_1',
      name: 'Board',
      color: '#8b5cf6',
      createdAt: date,
      updatedAt: date,
    },
    kanbanColumns: [],
    kanbanTasks: [],
    tombstones: [],
    ...overrides,
  };
}

function roundTrip(value: ActusData): ActusData {
  const sanitized = sanitizeForFirestore(value);
  return syncMergeService.buildData(JSON.parse(JSON.stringify(sanitized)));
}

function mergeRoundTrip(value: ActusData): ActusData {
  const remote = syncMergeService.toSnapshot(roundTrip(value), 2);
  const local = syncMergeService.toSnapshot(value, 1);
  return syncMergeService.snapshotToData(syncMergeService.mergeSnapshots(local, remote)!);
}

describe('sync convergence characterization', () => {
  it('treats undefined and absent optional fields as equal but preserves null', () => {
    const withUndefined = data({ kanbanTasks: [{
      id: 'task_1', columnId: 'column_1', title: 'Task', projectId: undefined, order: 0,
      createdAt: date, updatedAt: date,
    }] });
    const absent = data({ kanbanTasks: [{
      id: 'task_1', columnId: 'column_1', title: 'Task', order: 0,
      createdAt: date, updatedAt: date,
    }] });
    const withNull = data({ kanbanTasks: [{
      id: 'task_1', columnId: 'column_1', title: 'Task', projectId: null, order: 0,
      createdAt: date, updatedAt: date,
    }] });
    expect(syncMergeService.dataEquals(withUndefined, absent)).toBe(true);
    expect(syncMergeService.dataEquals(withUndefined, withNull)).toBe(false);
  });

  it('preserves independent Habit and KanbanTask changes when both snapshots are observed', () => {
    const base = data({
      kanbanColumns: [{ id: 'column_1', name: 'Todo', color: '#000000', order: 0, createdAt: date }],
    });
    const habitChange = data({
      ...base,
      habits: [{
        id: 'habit_1', name: 'Habit', categoryId: 'category_1', frequency: 'daily',
        startDate: '2026-01-01', active: true, createdAt: date, updatedAt: '2026-01-02T00:00:00.000Z',
      }],
    });
    const taskChange = data({
      ...base,
      kanbanTasks: [{
        id: 'task_1', columnId: 'column_1', title: 'Task', order: 0,
        createdAt: date, updatedAt: '2026-01-02T00:00:00.000Z',
      }],
    });
    const merged = syncMergeService.mergeSnapshots(
      syncMergeService.toSnapshot(habitChange, 2),
      syncMergeService.toSnapshot(taskChange, 2),
    )!;
    expect(merged.habits).toHaveLength(1);
    expect(merged.kanbanTasks).toHaveLength(1);
  });

  it('preserves Pomodoro additions from both observed devices in one month', () => {
    const makeSession = (id: string) => ({
      id, cycleType: 'focus' as const, plannedSeconds: 1500, remainingSeconds: 0,
      status: 'completed' as const, startedAt: date, completedAt: date, date: '2026-01-01',
    });
    const a = data({ pomodoroSessions: [makeSession('p1')] });
    const b = data({ pomodoroSessions: [makeSession('p2')] });
    const merged = syncMergeService.mergeSnapshots(
      syncMergeService.toSnapshot(a, 2),
      syncMergeService.toSnapshot(b, 2),
    )!;
    expect(merged.pomodoroSessions.map((session) => session.id).sort()).toEqual(['p1', 'p2']);
  });

  it('preserves an observed external tombstone while another snapshot is merged', () => {
    const local = data({
      habits: [{
        id: 'habit_1', name: 'Habit', categoryId: 'category_1', frequency: 'daily',
        startDate: '2026-01-01', active: true, createdAt: date, updatedAt: date,
      }],
    });
    const remote = data({ tombstones: [{ kind: 'habit', id: 'habit_1', deletedAt: 2_000_000_000_000 }] });
    const merged = syncMergeService.mergeSnapshots(
      syncMergeService.toSnapshot(local, 1),
      syncMergeService.toSnapshot(remote, 2),
    )!;
    expect(merged.habits).toHaveLength(0);
    expect(merged.tombstones).toEqual([{ kind: 'habit', id: 'habit_1', deletedAt: 2_000_000_000_000 }]);
  });
  it('characterizes legacy projectId absence and explicit null', () => {
    const legacy = data({
      kanbanTasks: [{
        id: 'task_1', columnId: 'column_1', title: 'Task', order: 0,
        createdAt: date, updatedAt: date,
      }],
    });
    const explicitNull = data({
      kanbanTasks: [{
        id: 'task_1', columnId: 'column_1', title: 'Task', projectId: null, order: 0,
        createdAt: date, updatedAt: date,
      }],
    });
    expect(roundTrip(legacy).kanbanTasks[0].projectId).toBeUndefined();
    expect(roundTrip(explicitNull).kanbanTasks[0].projectId).toBeNull();
  });

  it('characterizes running and paused Pomodoro sessions', () => {
    const running = data({ pomodoroSessions: [{
      id: 'pomo_running', cycleType: 'focus', plannedSeconds: 1500, remainingSeconds: 1200,
      status: 'running', startedAt: date, endAt: '2026-01-01T00:25:00.000Z', date: '2026-01-01',
    }] });
    const paused = data({ pomodoroSessions: [{
      id: 'pomo_paused', cycleType: 'focus', plannedSeconds: 1500, remainingSeconds: 1200,
      status: 'paused', startedAt: date, date: '2026-01-01',
    }] });
    expect(roundTrip(running).pomodoroSessions[0].endAt).toBe('2026-01-01T00:25:00.000Z');
    expect(roundTrip(paused).pomodoroSessions[0].endAt).toBeUndefined();
  });

  it('characterizes Projects, orphan references, tombstones and multiple months', () => {
    const value = data({
      projects: [{
        id: 'project_1', name: 'Project', color: '#8b5cf6', createdAt: date, updatedAt: date,
      }],
      completions: [
        { id: 'completion_jan', habitId: 'habit_1', date: '2026-01-02', completed: true, updatedAt: date },
        { id: 'completion_feb', habitId: 'habit_1', date: '2026-02-02', completed: true, updatedAt: date },
      ],
      kanbanTasks: [
        {
          id: 'task_valid', columnId: 'column_1', title: 'Valid', projectId: 'project_1', order: 0,
          createdAt: date, updatedAt: date,
        },
        {
          id: 'task_orphan', columnId: 'column_1', title: 'Orphan', projectId: 'missing', order: 1,
          createdAt: date, updatedAt: date,
        },
      ],
      tombstones: [{ kind: 'project', id: 'project_deleted', deletedAt: 2 }],
    });
    const result = mergeRoundTrip(value);
    expect(result.projects).toHaveLength(1);
    expect(result.kanbanTasks.find((task) => task.id === 'task_valid')?.projectId).toBe('project_1');
    expect(result.kanbanTasks.find((task) => task.id === 'task_orphan')?.projectId).toBeNull();
    expect(result.tombstones).toEqual([{ kind: 'project', id: 'project_deleted', deletedAt: 2 }]);
    expect(new Set(result.completions.map((completion) => completion.date))).toEqual(new Set(['2026-01-02', '2026-02-02']));
  });

  it('repeats the round-trip merge to identify a stable fixed point', () => {
    let current = data({
      kanbanColumns: [{ id: 'column_1', name: 'Todo', color: '#000000', order: 4, createdAt: date }],
      kanbanTasks: [{
        id: 'task_1', columnId: 'column_1', title: 'Task', projectId: null, order: 9,
        createdAt: date, updatedAt: date,
      }],
    });
    const states: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      current = mergeRoundTrip(current);
      states.push(JSON.stringify(current));
    }
    expect(states[states.length - 1]).toBe(states[states.length - 2]);
  });

  it('characterizes a fragmented snapshot as a merge result without changing production logic', () => {
    const oldData = data({ completions: [] });
    const newData = data({ completions: [{
      id: 'completion_1', habitId: 'habit_1', date: '2026-01-01', completed: true, updatedAt: date,
    }] });
    const oldSnapshot = syncMergeService.toSnapshot(oldData, 1);
    const newSnapshot = syncMergeService.toSnapshot(newData, 2);
    const fragmented: ActusSnapshot = { ...newSnapshot, completions: oldSnapshot.completions };
    const result = syncMergeService.mergeSnapshots(oldSnapshot, fragmented)!;
    expect(result.completions).toEqual([]);
    expect(result.updatedAt).toBe(2);
  });
});
