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
  const completedSessionIdsRef = useRef(new Set<string>());
  const cancelledSessionIdsRef = useRef(new Set<string>());

  const activeSession: PomodoroSession | null = pomodoroService.getActiveSession(pomodoroSessions);

  const stopTick = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const completeCycle = useCallback(
    (sessionToComplete: PomodoroSession | null = activeSession) => {
      if (!sessionToComplete || completedSessionIdsRef.current.has(sessionToComplete.id)) return;
      if (
        cancelledSessionIdsRef.current.has(sessionToComplete.id) ||
        (sessionToComplete.status !== 'running' && sessionToComplete.status !== 'paused')
      ) return;

      completedSessionIdsRef.current.add(sessionToComplete.id);
      stopTick();
      setIsRunning(false);

      updatePomodoroSession(sessionToComplete.id, {
        status: 'completed',
        remainingSeconds: 0,
        endAt: undefined,
        completedAt: new Date().toISOString(),
      });

      if (sessionToComplete.cycleType === 'focus' && sessionToComplete.habitId) {
        const linked = habits.find((h) => h.id === sessionToComplete.habitId);
        if (linked && linked.active && streakService.isHabitScheduledOnDate(linked, sessionToComplete.date)) {
          completeHabitCompletion(linked.id, sessionToComplete.date);
        }
      }

      if (sessionToComplete.cycleType === 'focus' && sessionToComplete.taskId) {
        const linkedTask = kanbanTasks.find((t) => t.id === sessionToComplete.taskId);
        if (linkedTask) {
          setPendingAdvanceTask({
            taskId: linkedTask.id,
            taskTitle: linkedTask.title,
            currentColumnId: linkedTask.columnId,
          });
        }
      }

      if (settings.notificationsEnabled) {
        const title = sessionToComplete.cycleType === 'focus' ? 'Foco concluído!' : 'Pausa concluída!';
        const body = sessionToComplete.cycleType === 'focus' ? 'Hora de uma pausa.' : 'Hora de focar.';
        notificationService.notify(title, body);
      }
      if (settings.soundEnabled) {
        audioService.playChime();
      }

      const todayStr = dateService.getTodayString();
      const completedFocusToday = pomodoroSessions.filter(
        (s) => s.status === 'completed' && s.cycleType === 'focus' && s.date === todayStr
      ).length;
      const focusCount = sessionToComplete.cycleType === 'focus' ? completedFocusToday + 1 : completedFocusToday;
      const nextType = pomodoroService.getNextCycleType(sessionToComplete.cycleType, focusCount, settings);
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
    },
    [activeSession, completeHabitCompletion, habits, kanbanTasks, pomodoroSessions, settings, stopTick, updatePomodoroSession]
  );

  const reconcile = useCallback(
    (now = Date.now(), sessionToReconcile: PomodoroSession | null = activeSession) => {
      if (!sessionToReconcile || sessionToReconcile.status !== 'running') return false;
      const result = pomodoroService.reconcileRunningSession(sessionToReconcile, now);
      setRemainingSeconds(result.remainingSeconds);
      if (result.expired) {
        completeCycle(sessionToReconcile);
      }
      return result.expired;
    },
    [activeSession, completeCycle]
  );

  const beginCycle = useCallback(
    (type: PomodoroCycleType, autoRun = true) => {
      restoredRef.current = true;
      const duration = pomodoroService.getCycleDurationSeconds(type, settings);
      const now = Date.now();
      createPomodoroSession({
        habitId: type === 'focus' ? (settings.linkedHabitId ?? null) : null,
        taskId: type === 'focus' ? (settings.linkedTaskId ?? null) : null,
        cycleType: type,
        plannedSeconds: duration,
        remainingSeconds: duration,
        status: autoRun ? 'running' : 'paused',
        startedAt: new Date(now).toISOString(),
        endAt: autoRun ? pomodoroService.createDeadline(now, duration) : undefined,
        date: dateService.getTodayString(),
      });
      setCycleType(type);
      setRemainingSeconds(duration);
      setHasStarted(true);
      setIsRunning(autoRun);
    },
    [createPomodoroSession, settings]
  );

  useEffect(() => {
    if (!isRunning) return;
    const tick = () => reconcile();
    tick();
    intervalRef.current = window.setInterval(tick, 1000);
    return stopTick;
  }, [isRunning, reconcile, stopTick]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') reconcile();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [reconcile]);

  useEffect(() => {
    if (restoredRef.current) return;
    const active = pomodoroService.getActiveSession(pomodoroSessions);
    if (!active) return;

    restoredRef.current = true;
    setCycleType(active.cycleType);
    setHasStarted(true);

    if (active.status === 'running' && active.endAt) {
      const result = pomodoroService.reconcileRunningSession(active, Date.now());
      if (result.expired) {
        completeCycle(active);
        return;
      }
      updatePomodoroSession(active.id, { status: 'paused', remainingSeconds: result.remainingSeconds, endAt: undefined });
      setRemainingSeconds(result.remainingSeconds);
    } else {
      setRemainingSeconds(Math.max(0, active.remainingSeconds));
    }
    setIsRunning(false);
  }, [completeCycle, pomodoroSessions, updatePomodoroSession]);

  useEffect(() => {
    if (!hasStarted) {
      setRemainingSeconds(pomodoroService.getCycleDurationSeconds(cycleType, settings));
    }
  }, [settings, hasStarted, cycleType]);

  const start = useCallback(() => {
    beginCycle(cycleType, true);
  }, [beginCycle, cycleType]);

  const pause = useCallback(() => {
    if (!activeSession || activeSession.status !== 'running') return;
    const now = Date.now();
    if (reconcile(now, activeSession)) return;
    const paused = pomodoroService.pauseSession(activeSession, now);
    setIsRunning(false);
    setRemainingSeconds(paused.remainingSeconds);
    updatePomodoroSession(activeSession.id, { status: 'paused', ...paused });
  }, [activeSession, reconcile, updatePomodoroSession]);

  const resume = useCallback(() => {
    if (!activeSession || activeSession.status !== 'paused' || remainingSeconds <= 0) return;
    const resumed = pomodoroService.resumeSession({ ...activeSession, remainingSeconds }, Date.now());
    cancelledSessionIdsRef.current.delete(activeSession.id);
    updatePomodoroSession(activeSession.id, { status: 'running', ...resumed });
    setIsRunning(true);
  }, [activeSession, remainingSeconds, updatePomodoroSession]);

  const skip = useCallback(() => {
    if (activeSession) {
      cancelledSessionIdsRef.current.add(activeSession.id);
      removePomodoroSession(activeSession.id);
    }
    const todayStr = dateService.getTodayString();
    const completedFocusToday = pomodoroSessions.filter(
      (s) => s.status === 'completed' && s.cycleType === 'focus' && s.date === todayStr
    ).length;
    const nextType = pomodoroService.getNextCycleType(cycleType, completedFocusToday, settings);
    stopTick();
    setCycleType(nextType);
    setRemainingSeconds(pomodoroService.getCycleDurationSeconds(nextType, settings));
    setHasStarted(false);
    setIsRunning(false);
    restoredRef.current = true;
  }, [activeSession, cycleType, pomodoroSessions, removePomodoroSession, settings, stopTick]);

  const reset = useCallback(() => {
    stopTick();
    if (activeSession) {
      cancelledSessionIdsRef.current.add(activeSession.id);
      removePomodoroSession(activeSession.id);
    }
    const duration = pomodoroService.getCycleDurationSeconds('focus', settings);
    setCycleType('focus');
    setRemainingSeconds(duration);
    setHasStarted(false);
    setIsRunning(false);
    restoredRef.current = true;
  }, [activeSession, removePomodoroSession, settings, stopTick]);

  const confirmAdvanceTask = useCallback(
    (targetColumnId: string) => {
      if (pendingAdvanceTask) moveKanbanTask(pendingAdvanceTask.taskId, targetColumnId);
      setPendingAdvanceTask(null);
    },
    [moveKanbanTask, pendingAdvanceTask]
  );

  const dismissAdvanceTask = useCallback(() => setPendingAdvanceTask(null), []);

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
