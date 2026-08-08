import React, { useState } from 'react';
import { useHabits } from '@/context/HabitContext';
import { dateService } from '@/services/dateService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/EmptyState';
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog';
import { IconRenderer } from '@/components/common/IconRenderer';
import { History as HistoryIcon, Trash2 } from 'lucide-react';

export const PomodoroSessionLog: React.FC = () => {
  const { pomodoroSessions, clearPomodoroSessions, habits } = useHabits();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const completedSessions = pomodoroSessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => (b.completedAt || b.startedAt).localeCompare(a.completedAt || a.startedAt));

  return (
    <Card>
      <CardHeader className="p-5 pb-2 flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-primary" />
            <span>Ciclos Registrados</span>
          </CardTitle>
          <CardDescription>Focos concluídos e seus vínculos.</CardDescription>
        </div>
        {completedSessions.length > 0 && (
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setConfirmOpen(true)} title="Limpar histórico">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-5 pt-2">
        {completedSessions.length === 0 ? (
          <EmptyState
            icon="Timer"
            title="Nenhum ciclo concluído"
            description="Conclua ciclos de foco no timer para vê-los registrados aqui."
          />
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {completedSessions.map((session) => {
              const habit = session.habitId ? habits.find((h) => h.id === session.habitId) : undefined;
              const minutes = Math.round(session.plannedSeconds / 60);
              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: habit?.color || '#8b5cf6' }}
                    >
                      <IconRenderer name={habit?.icon || (session.cycleType === 'focus' ? 'Flame' : 'Coffee')} size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {session.cycleType === 'focus' ? 'Foco' : session.cycleType === 'shortBreak' ? 'Pausa curta' : 'Pausa longa'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate capitalize">
                        {dateService.formatFullDate(session.date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {session.cycleType === 'focus' && habit && (
                      <Badge variant="secondary" className="text-[10px] font-medium max-w-40 truncate">
                        {habit.name}
                      </Badge>
                    )}
                    <span className="text-xs font-bold text-muted-foreground tabular-nums">{minutes} min</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <DeleteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Limpar Histórico de Ciclos"
        description="Esta ação remove todos os ciclos de pomodoro registrados. Deseja continuar?"
        onConfirm={clearPomodoroSessions}
      />
    </Card>
  );
};
