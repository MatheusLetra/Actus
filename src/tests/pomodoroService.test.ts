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
