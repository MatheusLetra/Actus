import React from 'react';
import { useHabits } from '@/context/HabitContext';
import { POMODORO_CYCLE_LABELS } from '@/constants';
import { usePomodoroTimer } from './usePomodoroTimer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconRenderer } from '@/components/common/IconRenderer';
import { Play, Pause, SkipForward, RotateCcw, CheckCircle2, Timer as TimerIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

const CYCLE_COLORS: Record<string, string> = {
  focus: 'var(--primary)',
  shortBreak: '#10b981',
  longBreak: '#3b82f6',
};

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export const PomodoroTimer: React.FC = () => {
  const { habits } = useHabits();
  const {
    cycleType,
    remainingSeconds,
    isRunning,
    hasStarted,
    activeSession,
    progress,
    start,
    pause,
    resume,
    finishNow,
    skip,
    reset,
  } = usePomodoroTimer();

  const color = CYCLE_COLORS[cycleType] || CYCLE_COLORS.focus;
  const linkedHabit = activeSession?.habitId ? habits.find((h) => h.id === activeSession.habitId) : undefined;
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Card>
      <CardHeader className="p-5 pb-2">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <TimerIcon className="w-5 h-5 text-primary" />
          <span>Timer Pomodoro</span>
          <Badge className="text-[10px] py-0 px-2" style={{ backgroundColor: `${color}22`, color }}>
            {POMODORO_CYCLE_LABELS[cycleType]}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-5 flex flex-col items-center gap-6">
        <div className="relative w-[220px] h-[220px]">
          <svg viewBox="0 0 260 260" className="w-full h-full -rotate-90">
            <circle cx="130" cy="130" r={radius} className="stroke-muted/60" strokeWidth="12" fill="none" />
            <circle
              cx="130"
              cy="130"
              r={radius}
              stroke={color}
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black tracking-tight tabular-nums text-foreground">
              {formatTime(remainingSeconds)}
            </span>
            <span className="text-xs font-semibold text-muted-foreground mt-1">
              {POMODORO_CYCLE_LABELS[cycleType]}
            </span>
            {linkedHabit && (
              <span className="flex items-center gap-1 mt-2 text-xs font-medium text-foreground bg-muted/50 rounded-full px-2.5 py-1">
                <IconRenderer name={linkedHabit.icon || 'Target'} size={12} style={{ color: linkedHabit.color }} />
                {linkedHabit.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {!hasStarted ? (
            <Button onClick={start} className="min-w-36" size="lg">
              <Play className="w-4 h-4 mr-2" />
              Iniciar
            </Button>
          ) : isRunning ? (
            <Button onClick={pause} variant="secondary" className="min-w-36" size="lg">
              <Pause className="w-4 h-4 mr-2" />
              Pausar
            </Button>
          ) : (
            <Button onClick={resume} className="min-w-36" size="lg">
              <Play className="w-4 h-4 mr-2" />
              Retomar
            </Button>
          )}

          {hasStarted && (
            <Button onClick={finishNow} variant="outline" className="min-w-32">
              <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
              Concluir agora
            </Button>
          )}

          <Button onClick={skip} variant="ghost" title="Pular fase">
            <SkipForward className="w-4 h-4 mr-1.5" />
            Pular
          </Button>

          <Button
            onClick={reset}
            variant="ghost"
            size="icon"
            title="Reiniciar"
            className={cn(hasStarted ? '' : 'text-muted-foreground')}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center max-w-sm">
          Ciclos de foco concluídos são registrados automaticamente e, se houver um hábito vinculado, sua conclusão é marcada no dia.
          Você pode pausar um ciclo e retomá-lo depois.
        </p>
      </CardContent>
    </Card>
  );
};
