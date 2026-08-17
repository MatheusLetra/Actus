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

export interface RetroactiveSessionInput {
  date: string;
  startTime: string;
  durationMinutes: number;
  habitId?: string | null;
  taskId?: string | null;
}

export interface RetroactiveSessionValidation {
  valid: boolean;
  errors: Partial<Record<'date' | 'startTime' | 'durationMinutes' | 'habitId' | 'taskId', string>>;
  session?: Omit<PomodoroSession, 'id'>;
}

export const pomodoroService = {
  createRetroactiveSession(
    input: RetroactiveSessionInput,
    now: number,
    validHabitIds?: readonly string[],
    validTaskIds?: readonly string[],
  ): RetroactiveSessionValidation {
    const errors: RetroactiveSessionValidation['errors'] = {};
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date);
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(input.startTime);

    if (!dateMatch) {
      errors.date = 'Informe uma data válida.';
    }
    if (!timeMatch) {
      errors.startTime = 'Informe um horário válido.';
    }
    if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0) {
      errors.durationMinutes = 'Informe uma duração inteira maior que zero.';
    }
    if (input.habitId && validHabitIds && !validHabitIds.includes(input.habitId)) {
      errors.habitId = 'O hábito selecionado não existe mais.';
    }
    if (input.taskId && validTaskIds && !validTaskIds.includes(input.taskId)) {
      errors.taskId = 'A tarefa selecionada não existe mais.';
    }

    if (dateMatch && timeMatch) {
      const year = Number(dateMatch[1]);
      const month = Number(dateMatch[2]);
      const day = Number(dateMatch[3]);
      const hour = Number(timeMatch[1]);
      const minute = Number(timeMatch[2]);
      const datePartsValid = month >= 1 && month <= 12 && day >= 1 && day <= 31;
      const timePartsValid = hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
      if (!datePartsValid) errors.date = 'Informe uma data existente.';
      if (!timePartsValid) errors.startTime = 'Informe um horário existente.';

      const start = new Date(year, month - 1, day, hour, minute, 0, 0);
      const dateIsNormalized = start.getFullYear() === year
        && start.getMonth() === month - 1
        && start.getDate() === day
        && start.getHours() === hour
        && start.getMinutes() === minute;

      if (datePartsValid && timePartsValid && (!dateIsNormalized || !Number.isFinite(start.getTime()))) {
        errors.date = 'Informe uma data e horário existentes.';
      } else if (datePartsValid && timePartsValid && Number.isInteger(input.durationMinutes) && input.durationMinutes > 0) {
        const durationSeconds = input.durationMinutes * 60;
        const completedAt = start.getTime() + durationSeconds * 1000;
        const end = new Date(completedAt);
        if (!Number.isFinite(completedAt) || !Number.isFinite(end.getTime()) || completedAt > now) {
          errors.startTime = 'A sessão não pode terminar no futuro.';
        }

        if (Object.keys(errors).length === 0) {
          return {
            valid: true,
            errors: {},
            session: {
              habitId: input.habitId || undefined,
              taskId: input.taskId || undefined,
              cycleType: 'focus',
              plannedSeconds: durationSeconds,
              remainingSeconds: 0,
              status: 'completed',
              startedAt: start.toISOString(),
              completedAt: end.toISOString(),
              date: input.date,
            },
          };
        }
      }
    }

    return { valid: false, errors };
  },

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
