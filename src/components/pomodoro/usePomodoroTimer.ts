import { useCallback, useEffect, useRef, useState } from 'react';
import type { PomodoroCycleType, PomodoroSession } from '@/types';
import { useHabits } from '@/context/HabitContext';
import { pomodoroService } from '@/services/pomodoroService';
import { dateService } from '@/services/dateService';
import { streakService } from '@/services/streakService';
import { notificationService } from '@/services/notificationService';
import { audioService } from '@/services/audioService';

export interface PendingAdvanceTask {
  taskId: string;
  taskTitle: string;
  currentColumnId: string;
}

export const usePomodoroTimer = () => {
  const {
    pomodoroSettings: settings,
    pomodoroSessions,
    habits,
    kanbanTasks,
    createPomodoroSession,
    updatePomodoroSession,
    removePomodoroSession,
    completeHabitCompletion,
    moveKanbanTask,
  } = useHabits();

  const [cycleType, setCycleType] = useState<PomodoroCycleType>('focus');
  const [remainingSeconds, setRemainingSeconds] = useState(() => pomodoroService.getCycleDurationSeconds('focus', settings));
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [pendingAdvanceTask, setPendingAdvanceTask] = useState<PendingAdvanceTask | null>(null);

  const restoredRef = useRef(false);
  const intervalRef = useRef<number | null>(null);

  const activeSession: PomodoroSession | null = pomodoroService.getActiveSession(pomodoroSessions);

  const stopTick = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return stopTick;
  }, [isRunning]);

  const completeCycle = useCallback(() => {
    if (activeSession) {
      updatePomodoroSession(activeSession.id, {
        status: 'completed',
        remainingSeconds: 0,
        completedAt: new Date().toISOString(),
      });
    }

    if (activeSession?.cycleType === 'focus' && activeSession.habitId) {
      const linked = habits.find((h) => h.id === activeSession.habitId);
      if (linked && linked.active && streakService.isHabitScheduledOnDate(linked, activeSession.date)) {
        completeHabitCompletion(linked.id, activeSession.date);
      }
    }

    if (activeSession?.cycleType === 'focus' && activeSession.taskId) {
      const linkedTask = kanbanTasks.find((t) => t.id === activeSession.taskId);
      if (linkedTask) {
        setPendingAdvanceTask({
          taskId: linkedTask.id,
          taskTitle: linkedTask.title,
          currentColumnId: linkedTask.columnId,
        });
      }
    }

    if (settings.notificationsEnabled) {
      const title = cycleType === 'focus' ? 'Foco concluído!' : 'Pausa concluída!';
      const body = cycleType === 'focus' ? 'Hora de uma pausa.' : 'Hora de focar.';
      notificationService.notify(title, body);
    }
    if (settings.soundEnabled) {
      audioService.playChime();
    }

    const todayStr = dateService.getTodayString();
    const completedFocusToday = pomodoroSessions.filter(
      (s) => s.status === 'completed' && s.cycleType === 'focus' && s.date === todayStr
    ).length;
    const focusCount = cycleType === 'focus' ? completedFocusToday + 1 : completedFocusToday;

    const nextType = pomodoroService.getNextCycleType(cycleType, focusCount, settings);
    const nextDuration = pomodoroService.getCycleDurationSeconds(nextType, settings);
    const autoRun = nextType === 'focus' ? settings.autoStartFocus : settings.autoStartBreaks;

    setCycleType(nextType);
    setRemainingSeconds(nextDuration);
    setHasStarted(false);
    setIsRunning(false);
    restoredRef.current = true;

    if (autoRun) {
      beginCycle(nextType);
    }
  }, [activeSession, cycleType, settings, pomodoroSessions, habits, kanbanTasks, completeHabitCompletion]);

  const beginCycle = useCallback(
    (type: PomodoroCycleType, autoRun = true) => {
      restoredRef.current = true;
      const duration = pomodoroService.getCycleDurationSeconds(type, settings);
      createPomodoroSession({
        habitId: type === 'focus' ? (settings.linkedHabitId ?? null) : null,
        taskId: type === 'focus' ? (settings.linkedTaskId ?? null) : null,
        cycleType: type,
        plannedSeconds: duration,
        remainingSeconds: duration,
        status: autoRun ? 'running' : 'paused',
        startedAt: new Date().toISOString(),
        date: dateService.getTodayString(),
      });
      setCycleType(type);
      setRemainingSeconds(duration);
      setHasStarted(true);
      setIsRunning(autoRun);
    },
    [settings, createPomodoroSession]
  );

  // Restore a persisted running/paused session after the provider loads data.
  useEffect(() => {
    if (restoredRef.current) return;
    const active = pomodoroService.getActiveSession(pomodoroSessions);
    if (active) {
      restoredRef.current = true;
      setCycleType(active.cycleType);
      setRemainingSeconds(active.remainingSeconds);
      setHasStarted(true);
      setIsRunning(false);
    }
  }, [pomodoroSessions]);

  // When settings load/change and no cycle has started, reflect the configured duration.
  useEffect(() => {
    if (!hasStarted) {
      setRemainingSeconds(pomodoroService.getCycleDurationSeconds(cycleType, settings));
    }
  }, [settings, hasStarted, cycleType]);

  // Complete when the countdown reaches zero.
  useEffect(() => {
    if (isRunning && hasStarted && remainingSeconds === 0) {
      setIsRunning(false);
      stopTick();
      completeCycle();
    }
  }, [remainingSeconds, isRunning, hasStarted, completeCycle]);

  const start = useCallback(() => {
    beginCycle(cycleType, true);
  }, [beginCycle, cycleType]);

  const pause = useCallback(() => {
    setIsRunning(false);
    if (activeSession) {
      updatePomodoroSession(activeSession.id, { status: 'paused', remainingSeconds });
    }
  }, [activeSession, remainingSeconds]);

  const resume = useCallback(() => {
    if (!activeSession || remainingSeconds <= 0) return;
    updatePomodoroSession(activeSession.id, { status: 'running' });
    setIsRunning(true);
  }, [activeSession, remainingSeconds]);

  const skip = useCallback(() => {
    if (activeSession) {
      removePomodoroSession(activeSession.id);
    }
    const todayStr = dateService.getTodayString();
    const completedFocusToday = pomodoroSessions.filter(
      (s) => s.status === 'completed' && s.cycleType === 'focus' && s.date === todayStr
    ).length;
    const nextType = pomodoroService.getNextCycleType(cycleType, completedFocusToday, settings);
    setCycleType(nextType);
    setRemainingSeconds(pomodoroService.getCycleDurationSeconds(nextType, settings));
    setHasStarted(false);
    setIsRunning(false);
    restoredRef.current = true;
  }, [activeSession, cycleType, settings, pomodoroSessions]);

  const reset = useCallback(() => {
    stopTick();
    if (activeSession) {
      removePomodoroSession(activeSession.id);
    }
    const duration = pomodoroService.getCycleDurationSeconds('focus', settings);
    setCycleType('focus');
    setRemainingSeconds(duration);
    setHasStarted(false);
    setIsRunning(false);
    restoredRef.current = true;
  }, [activeSession, settings]);

  const confirmAdvanceTask = useCallback(
    (targetColumnId: string) => {
      if (pendingAdvanceTask) {
        moveKanbanTask(pendingAdvanceTask.taskId, targetColumnId);
      }
      setPendingAdvanceTask(null);
    },
    [pendingAdvanceTask, moveKanbanTask]
  );

  const dismissAdvanceTask = useCallback(() => {
    setPendingAdvanceTask(null);
  }, []);

  const plannedSeconds = activeSession?.plannedSeconds ?? pomodoroService.getCycleDurationSeconds(cycleType, settings);
  const progress = plannedSeconds > 0 ? Math.round(((plannedSeconds - remainingSeconds) / plannedSeconds) * 100) : 0;

  return {
    settings,
    cycleType,
    remainingSeconds,
    isRunning,
    hasStarted,
    activeSession,
    progress,
    pendingAdvanceTask,
    confirmAdvanceTask,
    dismissAdvanceTask,
    start,
    pause,
    resume,
    finishNow: completeCycle,
    skip,
    reset,
  };
};
