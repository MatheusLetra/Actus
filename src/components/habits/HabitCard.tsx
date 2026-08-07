import React, { useState } from 'react';
import type { Habit, Category } from '@/types';
import { useHabits } from '@/context/HabitContext';
import { streakService } from '@/services/streakService';
import { IconRenderer } from '@/components/common/IconRenderer';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Edit2, Trash2, Calendar, Flame, Trophy } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/common/DeleteConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarHeatmap } from './CalendarHeatmap';

interface HabitCardProps {
  habit: Habit;
  category?: Category;
  onEdit: (habit: Habit) => void;
}

export const HabitCard: React.FC<HabitCardProps> = ({ habit, category, onEdit }) => {
  const { completions, toggleHabitActive, deleteHabit } = useHabits();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const streakInfo = streakService.getHabitStreakInfo(habit, completions);

  const frequencyLabels: Record<string, string> = {
    daily: 'Diário',
    weekly: 'Semanal',
    custom: 'Dias Específicos',
  };

  return (
    <>
      <Card className="flex flex-col justify-between hover:shadow-md transition-shadow">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                style={{ backgroundColor: habit.color || category?.color || '#8b5cf6' }}
              >
                <IconRenderer name={habit.icon || category?.icon || 'Target'} size={22} />
              </div>

              <div>
                <h3 className="font-bold text-base text-foreground leading-tight">{habit.name}</h3>
                {category && (
                  <span
                    className="inline-block text-xs font-semibold mt-0.5"
                    style={{ color: category.color }}
                  >
                    {category.name}
                  </span>
                )}
              </div>
            </div>

            {/* Active Toggle Switch */}
            <div className="flex items-center gap-1.5 shrink-0" title={habit.active ? 'Hábito Ativo' : 'Hábito Inativo'}>
              <Switch
                checked={habit.active}
                onCheckedChange={() => toggleHabitActive(habit.id)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-1 space-y-4 flex-1">
          {habit.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{habit.description}</p>
          )}

          {/* Frequência & Status Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs font-medium">
              {frequencyLabels[habit.frequency] || 'Diário'}
            </Badge>

            <Badge variant={habit.active ? 'success' : 'outline'} className="text-xs font-medium">
              {habit.active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>

          {/* Streaks Row */}
          <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/30 text-xs">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase">Streak Atual</p>
                <p className="font-extrabold text-sm text-foreground">{streakInfo.currentStreak} dias</p>
              </div>
            </div>

            <div className="flex items-center gap-2 border-l pl-2">
              <Trophy className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase">Maior Streak</p>
                <p className="font-extrabold text-sm text-foreground">{streakInfo.longestStreak} dias</p>
              </div>
            </div>
          </div>

          {/* Monthly Completion Rate Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-muted-foreground">Conclusão Mensal</span>
              <span className="font-bold text-foreground">{streakInfo.monthlyCompletionRate}%</span>
            </div>
            <Progress value={streakInfo.monthlyCompletionRate} />
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0 border-t flex items-center justify-between gap-2 mt-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCalendarOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            Ver Heatmap
          </Button>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(habit)}
              title="Editar Hábito"
            >
              <Edit2 className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
              title="Excluir Hábito"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir Hábito"
        description={`Tem certeza que deseja excluir o hábito "${habit.name}"? Todo o histórico de conclusões deste hábito será removido.`}
        onConfirm={() => deleteHabit(habit.id)}
      />

      {/* Calendar Heatmap Dialog */}
      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconRenderer name={habit.icon || 'Target'} size={20} style={{ color: habit.color }} />
              <span>{habit.name} — Calendário</span>
            </DialogTitle>
          </DialogHeader>
          <CalendarHeatmap habit={habit} completions={completions} />
        </DialogContent>
      </Dialog>
    </>
  );
};
