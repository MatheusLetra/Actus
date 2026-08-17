import React, { useEffect, useMemo, useState } from 'react';
import { useHabits } from '@/context/HabitContext';
import type { RetroactiveSessionInput } from '@/services/pomodoroService';
import { dateService } from '@/services/dateService';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, History } from 'lucide-react';

interface PomodoroRetroactiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getTodayInputValue(): string {
  return dateService.getTodayString();
}

function getCurrentTimeInputValue(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getSummary(date: string, startTime: string, durationMinutes: number): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(startTime);
  if (!dateMatch || !timeMatch || !Number.isInteger(durationMinutes) || durationMinutes <= 0) return null;

  const start = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  if (!Number.isFinite(start.getTime())) return null;

  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const formatTime = (value: Date) => `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  const dayOffset = dateService.formatDateString(end) !== date ? ' (+1 dia)' : '';
  return `${formatTime(start)} → ${formatTime(end)}${dayOffset} · ${durationMinutes} ${durationMinutes === 1 ? 'minuto' : 'minutos'}`;
}

export const PomodoroRetroactiveDialog: React.FC<PomodoroRetroactiveDialogProps> = ({ open, onOpenChange }) => {
  const {
    pomodoroSettings,
    habits,
    kanbanColumns,
    kanbanTasks,
    createRetroactivePomodoro,
  } = useHabits();
  const [date, setDate] = useState(getTodayInputValue);
  const [startTime, setStartTime] = useState(getCurrentTimeInputValue);
  const [durationMinutes, setDurationMinutes] = useState(pomodoroSettings.focusMinutes);
  const [habitId, setHabitId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'date' | 'startTime' | 'durationMinutes' | 'habitId' | 'taskId', string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const validHabitId = pomodoroSettings.linkedHabitId && habits.some((habit) => habit.id === pomodoroSettings.linkedHabitId)
    ? pomodoroSettings.linkedHabitId
    : '';
  const validTaskId = pomodoroSettings.linkedTaskId && kanbanTasks.some((task) => task.id === pomodoroSettings.linkedTaskId)
    ? pomodoroSettings.linkedTaskId
    : '';

  useEffect(() => {
    if (!open) return;
    setDate(getTodayInputValue());
    setStartTime(getCurrentTimeInputValue());
    setDurationMinutes(pomodoroSettings.focusMinutes);
    setHabitId(validHabitId);
    setTaskId(validTaskId);
    setErrors({});
    setSubmitting(false);
  }, [open, pomodoroSettings.focusMinutes, validHabitId, validTaskId]);

  const input: RetroactiveSessionInput = useMemo(() => ({
    date,
    startTime,
    durationMinutes: Number(durationMinutes),
    habitId: habitId || null,
    taskId: taskId || null,
  }), [date, startTime, durationMinutes, habitId, taskId]);
  const summary = getSummary(date, startTime, Number(durationMinutes));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const result = createRetroactivePomodoro(input);
    if (!result.valid) {
      setErrors(result.errors);
      setSubmitting(false);
      return;
    }
    onOpenChange(false);
  };

  const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Registrar Pomodoro
          </DialogTitle>
          <DialogDescription>Registre um período de foco realizado fora do Actus.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="retroactive-date">Data</Label>
              <Input id="retroactive-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-invalid={Boolean(errors.date)} />
              {errors.date && <p className="text-xs font-medium text-destructive">{errors.date}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="retroactive-start">Hora de início</Label>
              <Input id="retroactive-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} aria-invalid={Boolean(errors.startTime)} />
              {errors.startTime && <p className="text-xs font-medium text-destructive">{errors.startTime}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="retroactive-duration">Duração (minutos)</Label>
            <Input
              id="retroactive-duration"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              aria-invalid={Boolean(errors.durationMinutes)}
            />
            {errors.durationMinutes && <p className="text-xs font-medium text-destructive">{errors.durationMinutes}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="retroactive-habit">Hábito (opcional)</Label>
            <select id="retroactive-habit" className={selectClass} value={habitId} onChange={(event) => setHabitId(event.target.value)}>
              <option value="">Nenhum</option>
              {habits.map((habit) => <option key={habit.id} value={habit.id}>{habit.name}</option>)}
            </select>
            {errors.habitId && <p className="text-xs font-medium text-destructive">{errors.habitId}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="retroactive-task">Tarefa (opcional)</Label>
            <select id="retroactive-task" className={selectClass} value={taskId} onChange={(event) => setTaskId(event.target.value)}>
              <option value="">Nenhuma</option>
              {kanbanColumns
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((column) => (
                  <optgroup key={column.id} label={column.name}>
                    {kanbanTasks
                      .filter((task) => task.columnId === column.id)
                      .sort((a, b) => a.order - b.order)
                      .map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                  </optgroup>
                ))}
            </select>
            {errors.taskId && <p className="text-xs font-medium text-destructive">{errors.taskId}</p>}
          </div>

          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground" aria-live="polite">
            <span className="font-semibold text-foreground">Resumo: </span>
            {summary || 'Informe uma data, horário e duração válidos.'}
          </div>

          <DialogFooter className="mt-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {submitting ? 'Registrando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
