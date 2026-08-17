import type { Habit, PomodoroCycleType, PomodoroSession, PomodoroSettings, PomodoroStats } from '@/types';
import { dateService } from './dateService';

const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  notificationsEnabled: true,
  soundEnabled: true,
  linkedHabitId: null,
  linkedTaskId: null,
};

export const pomodoroService = {
  createDeadline(now: number, remainingSeconds: number): string {
    return new Date(now + Math.max(0, remainingSeconds) * 1000).toISOString();
  },

  getRemainingSeconds(endAt: string, now: number): number {
    const deadline = new Date(endAt).getTime();
    if (!Number.isFinite(deadline)) return 0;
    return Math.max(0, Math.ceil((deadline - now) / 1000));
  },

  reconcileRunningSession(session: PomodoroSession, now: number): { remainingSeconds: number; expired: boolean } {
    if (session.status !== 'running' || !session.endAt) {
      return { remainingSeconds: Math.max(0, session.remainingSeconds), expired: false };
    }
    const remainingSeconds = this.getRemainingSeconds(session.endAt, now);
    return { remainingSeconds, expired: remainingSeconds === 0 };
  },

  pauseSession(session: PomodoroSession, now: number): Pick<PomodoroSession, 'remainingSeconds' | 'endAt'> {
    const remainingSeconds = session.endAt
      ? this.getRemainingSeconds(session.endAt, now)
      : Math.max(0, session.remainingSeconds);
    return { remainingSeconds, endAt: undefined };
  },

  resumeSession(session: PomodoroSession, now: number): Pick<PomodoroSession, 'remainingSeconds' | 'endAt'> {
    const remainingSeconds = Math.max(0, session.remainingSeconds);
    return { remainingSeconds, endAt: this.createDeadline(now, remainingSeconds) };
  },

  getDefaultSettings(): PomodoroSettings {
    return { ...DEFAULT_SETTINGS };
  },

  validateSettings(settings: PomodoroSettings): { valid: boolean; errors: Partial<Record<'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakInterval', string>> } {
    const errors: Partial<Record<'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakInterval', string>> = {};

    if (!Number.isFinite(settings.focusMinutes) || settings.focusMinutes < 1) {
      errors.focusMinutes = 'Informe um valor mínimo de 1 minuto.';
    }
    if (!Number.isFinite(settings.shortBreakMinutes) || settings.shortBreakMinutes < 1) {
      errors.shortBreakMinutes = 'Informe um valor mínimo de 1 minuto.';
    }
    if (!Number.isFinite(settings.longBreakMinutes) || settings.longBreakMinutes < 1) {
      errors.longBreakMinutes = 'Informe um valor mínimo de 1 minuto.';
    }
    if (!Number.isInteger(settings.longBreakInterval) || settings.longBreakInterval < 1) {
      errors.longBreakInterval = 'Informe um valor mínimo de 1 ciclo.';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  },

  getCycleDurationSeconds(cycleType: PomodoroCycleType, settings: PomodoroSettings): number {
    switch (cycleType) {
      case 'focus':
        return settings.focusMinutes * 60;
      case 'shortBreak':
        return settings.shortBreakMinutes * 60;
      case 'longBreak':
        return settings.longBreakMinutes * 60;
      default:
        return 0;
    }
  },

  getNextCycleType(currentCycleType: PomodoroCycleType, completedFocusCount: number, settings: PomodoroSettings): PomodoroCycleType {
    if (currentCycleType === 'focus') {
      if (completedFocusCount > 0 && completedFocusCount % settings.longBreakInterval === 0) {
        return 'longBreak';
      }
      return 'shortBreak';
    }
    return 'focus';
  },

  getActiveSession(sessions: PomodoroSession[]): PomodoroSession | null {
    return sessions.find((s) => s.status === 'running' || s.status === 'paused') ?? null;
  },

  getPomodoroStats(sessions: PomodoroSession[], habits: Habit[], referenceDate = dateService.getTodayString()): PomodoroStats {
    const completed = sessions.filter((s) => s.status === 'completed');
    const focusCompleted = completed.filter((s) => s.cycleType === 'focus');

    const totalFocusSeconds = focusCompleted.reduce((acc, s) => acc + s.plannedSeconds, 0);
    const todayFocus = focusCompleted.filter((s) => s.date === referenceDate);

    const byHabit = habits
      .map((habit) => {
        const habitSessions = focusCompleted.filter((s) => s.habitId === habit.id);
        return {
          habitId: habit.id,
          habitName: habit.name,
          cycles: habitSessions.length,
          focusSeconds: habitSessions.reduce((acc, s) => acc + s.plannedSeconds, 0),
        };
      })
      .filter((stat) => stat.cycles > 0);

    const dates = dateService.getLastNDays(30, referenceDate);
    const dailySeries = dates.map((dateStr) => {
      const daySessions = focusCompleted.filter((s) => s.date === dateStr);
      return {
        date: dateStr,
        label: dateService.formatDisplayDate(dateStr, { short: true }),
        cycles: daySessions.length,
        focusMinutes: Math.round(daySessions.reduce((acc, s) => acc + s.plannedSeconds, 0) / 60),
      };
    });

    const cycleTypes: PomodoroCycleType[] = ['focus', 'shortBreak', 'longBreak'];
    const distribution = cycleTypes.map((cycleType) => ({
      cycleType,
      label: cycleType === 'focus' ? 'Foco' : cycleType === 'shortBreak' ? 'Pausa Curta' : 'Pausa Longa',
      count: completed.filter((s) => s.cycleType === cycleType).length,
    }));

    return {
      totalCycles: completed.length,
      totalFocusCycles: focusCompleted.length,
      totalFocusSeconds,
      totalFocusMinutes: Math.round(totalFocusSeconds / 60),
      todayFocusCycles: todayFocus.length,
      byHabit,
      dailySeries,
      distribution,
    };
  },
};
