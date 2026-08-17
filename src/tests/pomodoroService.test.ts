import { describe, expect, it } from 'vitest';
import type { Habit, PomodoroSession } from '../types';
import { pomodoroService } from '../services/pomodoroService';

const settings = pomodoroService.getDefaultSettings();

const habits: Habit[] = [
  { id: 'h1', name: 'Estudar Programação', categoryId: 'c1', frequency: 'daily', startDate: '2026-08-01', active: true, createdAt: '2026-08-01' },
  { id: 'h2', name: 'Ler 30 Minutos', categoryId: 'c2', frequency: 'daily', startDate: '2026-08-01', active: true, createdAt: '2026-08-01' },
];

function completedSession(overrides: Partial<PomodoroSession>): PomodoroSession {
  return {
    id: `pomo_${overrides.date || '2026-08-07'}`,
    cycleType: 'focus',
    plannedSeconds: 1500,
    remainingSeconds: 0,
    status: 'completed',
    startedAt: '2026-08-07T10:00:00.000Z',
    completedAt: '2026-08-07T10:25:00.000Z',
    date: '2026-08-07',
    ...overrides,
  };
}

describe('pomodoroService', () => {
  describe('retroactive sessions', () => {
    const now = Date.parse('2026-08-17T18:00:00.000Z');

    it('builds a completed local-time focus session with custom duration', () => {
      const result = pomodoroService.createRetroactiveSession(
        { date: '2026-08-17', startTime: '14:00', durationMinutes: 25, habitId: 'h1', taskId: 'task_1' },
        now,
        ['h1'],
        ['task_1'],
      );

      expect(result.valid).toBe(true);
      expect(result.session).toMatchObject({
        cycleType: 'focus',
        status: 'completed',
        plannedSeconds: 1500,
        remainingSeconds: 0,
        date: '2026-08-17',
        habitId: 'h1',
        taskId: 'task_1',
      });
      expect(result.session?.startedAt).toBe(new Date(2026, 7, 17, 14, 0).toISOString());
      expect(result.session?.completedAt).toBe(new Date(2026, 7, 17, 14, 25).toISOString());
      expect(result.session).not.toHaveProperty('endAt');
    });

    it('accepts yesterday and sessions crossing midnight', () => {
      const result = pomodoroService.createRetroactiveSession(
        { date: '2026-08-16', startTime: '23:50', durationMinutes: 25 },
        now,
      );

      expect(result.valid).toBe(true);
      expect(result.session?.date).toBe('2026-08-16');
      expect(result.session?.completedAt).toBe(new Date(2026, 7, 17, 0, 15).toISOString());
    });

    it.each([
      { durationMinutes: 0, field: 'durationMinutes' },
      { durationMinutes: -1, field: 'durationMinutes' },
      { durationMinutes: 25.5, field: 'durationMinutes' },
    ])('rejects invalid duration $durationMinutes', ({ durationMinutes, field }) => {
      const result = pomodoroService.createRetroactiveSession(
        { date: '2026-08-17', startTime: '14:00', durationMinutes },
        now,
      );

      expect(result.valid).toBe(false);
      expect(result.errors[field as 'durationMinutes']).toBeDefined();
    });

    it('rejects invalid dates, times and future completion', () => {
      expect(pomodoroService.createRetroactiveSession({ date: '2026-02-31', startTime: '14:00', durationMinutes: 25 }, now).valid).toBe(false);
      expect(pomodoroService.createRetroactiveSession({ date: '2026-08-17', startTime: '25:00', durationMinutes: 25 }, now).valid).toBe(false);
      expect(pomodoroService.createRetroactiveSession({ date: '2026-08-17', startTime: '17:50', durationMinutes: 25 }, now).valid).toBe(false);
    });

    it('rejects missing linked entities', () => {
      const result = pomodoroService.createRetroactiveSession(
        { date: '2026-08-17', startTime: '14:00', durationMinutes: 25, habitId: 'missing', taskId: 'missing' },
        now,
        ['h1'],
        ['task_1'],
      );

      expect(result.valid).toBe(false);
      expect(result.errors.habitId).toBeDefined();
      expect(result.errors.taskId).toBeDefined();
    });
  });

  it('should create an absolute deadline and calculate remaining time from it', () => {
    const now = Date.parse('2026-08-10T10:00:00.000Z');
    const endAt = pomodoroService.createDeadline(now, 1500);

    expect(endAt).toBe('2026-08-10T10:25:00.000Z');
    expect(pomodoroService.getRemainingSeconds(endAt, now + 5_001)).toBe(1495);
    expect(pomodoroService.getRemainingSeconds(endAt, now + 1_499_999)).toBe(1);
    expect(pomodoroService.getRemainingSeconds(endAt, now + 1_500_000)).toBe(0);
  });

  it('should clamp invalid or expired deadlines to zero', () => {
    expect(pomodoroService.getRemainingSeconds('invalid', 1000)).toBe(0);
    expect(pomodoroService.getRemainingSeconds('1970-01-01T00:00:00.000Z', 1000)).toBe(0);
  });

  it('should reconcile delayed ticks and detect an expired session', () => {
    const now = Date.parse('2026-08-10T10:00:00.000Z');
    const session = completedSession({
      status: 'running',
      remainingSeconds: 1500,
      endAt: new Date(now + 1500 * 1000).toISOString(),
    });

    expect(pomodoroService.reconcileRunningSession(session, now + 120_000)).toEqual({
      remainingSeconds: 1380,
      expired: false,
    });
    expect(pomodoroService.reconcileRunningSession(session, now + 1500_000)).toEqual({
      remainingSeconds: 0,
      expired: true,
    });
  });

  it('should pause from the real deadline and keep paused time frozen', () => {
    const now = Date.parse('2026-08-10T10:00:00.000Z');
    const session = completedSession({
      status: 'running',
      remainingSeconds: 1500,
      endAt: new Date(now + 1500 * 1000).toISOString(),
    });
    const paused = pomodoroService.pauseSession(session, now + 61_000);

    expect(paused).toEqual({ remainingSeconds: 1439, endAt: undefined });
    expect(pomodoroService.pauseSession({ ...session, ...paused }, now + 600_000)).toEqual(paused);
  });

  it('should resume a paused session with a new deadline', () => {
    const now = Date.parse('2026-08-10T10:00:00.000Z');
    const resumed = pomodoroService.resumeSession(
      completedSession({ status: 'paused', remainingSeconds: 1439, endAt: undefined }),
      now
    );

    expect(resumed.remainingSeconds).toBe(1439);
    expect(resumed.endAt).toBe(new Date(now + 1_439_000).toISOString());
  });

  it('should preserve legacy running sessions without inventing elapsed time', () => {
    const session = completedSession({ status: 'running', remainingSeconds: 600, endAt: undefined });

    expect(pomodoroService.reconcileRunningSession(session, Date.now())).toEqual({
      remainingSeconds: 600,
      expired: false,
    });
  });

  it('should return default settings', () => {
    expect(settings.focusMinutes).toBe(25);
    expect(settings.shortBreakMinutes).toBe(5);
    expect(settings.longBreakMinutes).toBe(15);
    expect(settings.longBreakInterval).toBe(4);
  });

  it('should validate settings correctly', () => {
    const invalid = pomodoroService.validateSettings({ ...settings, focusMinutes: 0, longBreakInterval: 1.5 });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.focusMinutes).toBeDefined();
    expect(invalid.errors.longBreakInterval).toBeDefined();

    const valid = pomodoroService.validateSettings({ ...settings, focusMinutes: 30, longBreakInterval: 4 });
    expect(valid.valid).toBe(true);
    expect(Object.keys(valid.errors)).toHaveLength(0);
  });

  it('should return cycle durations in seconds', () => {
    expect(pomodoroService.getCycleDurationSeconds('focus', settings)).toBe(1500);
    expect(pomodoroService.getCycleDurationSeconds('shortBreak', settings)).toBe(300);
    expect(pomodoroService.getCycleDurationSeconds('longBreak', settings)).toBe(900);
  });

  it('should alternate focus with breaks', () => {
    expect(pomodoroService.getNextCycleType('focus', 1, settings)).toBe('shortBreak');
    expect(pomodoroService.getNextCycleType('shortBreak', 1, settings)).toBe('focus');
    expect(pomodoroService.getNextCycleType('longBreak', 1, settings)).toBe('focus');
  });

  it('should schedule a long break every N focus cycles', () => {
    expect(pomodoroService.getNextCycleType('focus', 4, settings)).toBe('longBreak');
    expect(pomodoroService.getNextCycleType('focus', 8, settings)).toBe('longBreak');
    expect(pomodoroService.getNextCycleType('focus', 3, settings)).toBe('shortBreak');
  });

  it('should find the active session', () => {
    const paused = completedSession({ id: 'p1', status: 'paused', remainingSeconds: 600 });
    const sessions = [completedSession({ id: 'c1' }), paused];
    expect(pomodoroService.getActiveSession(sessions)?.id).toBe('p1');
  });

  it('should aggregate pomodoro stats', () => {
    const sessions: PomodoroSession[] = [
      completedSession({ id: 'c1', habitId: 'h1', date: '2026-08-07' }),
      completedSession({ id: 'c2', habitId: 'h1', date: '2026-08-07' }),
      completedSession({ id: 'c3', habitId: 'h2', date: '2026-08-06' }),
      completedSession({ id: 'c4', cycleType: 'shortBreak', plannedSeconds: 300, date: '2026-08-07' }),
      completedSession({ id: 'c5', status: 'paused', remainingSeconds: 900, date: '2026-08-07' }),
    ];

    const stats = pomodoroService.getPomodoroStats(sessions, habits, '2026-08-07');

    expect(stats.totalCycles).toBe(4);
    expect(stats.totalFocusCycles).toBe(3);
    expect(stats.totalFocusMinutes).toBe(75);
    expect(stats.todayFocusCycles).toBe(2);
    expect(stats.byHabit).toHaveLength(2);
    expect(stats.byHabit[0].habitName).toBe('Estudar Programação');
    expect(stats.byHabit[0].cycles).toBe(2);
    expect(stats.distribution.find((d) => d.cycleType === 'shortBreak')?.count).toBe(1);
    expect(stats.dailySeries[29].date).toBe('2026-08-07');
    expect(stats.dailySeries[29].cycles).toBe(2);
  });
});
