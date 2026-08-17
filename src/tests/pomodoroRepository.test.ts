import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PomodoroSession } from '../types';
import { pomodoroRepository } from '../repositories/pomodoroRepository';

const running: PomodoroSession = {
  id: 'pomo_running',
  cycleType: 'focus',
  plannedSeconds: 1500,
  remainingSeconds: 1200,
  status: 'running',
  startedAt: '2026-08-17T14:00:00.000Z',
  endAt: '2026-08-17T14:25:00.000Z',
  date: '2026-08-17',
};

const paused: PomodoroSession = { ...running, id: 'pomo_paused', status: 'paused', endAt: undefined };
const completed: PomodoroSession = { ...running, id: 'pomo_completed', status: 'completed', remainingSeconds: 0, endAt: undefined, completedAt: '2026-08-17T14:25:00.000Z' };

function setupStorage(initial: PomodoroSession[] = []) {
  let value = JSON.stringify(initial);
  vi.stubGlobal('localStorage', {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
  });
}

describe('pomodoroRepository', () => {
  beforeEach(() => setupStorage());

  it('adds a completed session without removing a running session', () => {
    setupStorage([running]);
    const result = pomodoroRepository.add(completed);

    expect(result.map((session) => session.id)).toEqual(['pomo_completed', 'pomo_running']);
    expect(result.find((session) => session.id === running.id)?.status).toBe('running');
  });

  it('adds a completed session without removing a paused session', () => {
    setupStorage([paused]);
    const result = pomodoroRepository.add(completed);

    expect(result.map((session) => session.id)).toEqual(['pomo_completed', 'pomo_paused']);
    expect(result.find((session) => session.id === paused.id)?.status).toBe('paused');
  });

  it('continues removing previous active sessions when adding a new active session', () => {
    setupStorage([running]);
    const next = { ...running, id: 'pomo_next' };
    const result = pomodoroRepository.add(next);

    expect(result.map((session) => session.id)).toEqual(['pomo_next']);
  });

  it('removes only completed sessions through the history deletion method', () => {
    setupStorage([running, completed]);
    const result = pomodoroRepository.removeCompleted(completed.id);

    expect(result.map((session) => session.id)).toEqual(['pomo_running']);
    expect(pomodoroRepository.removeCompleted(running.id)).toEqual([running]);
  });
});
