import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dateService } from '@/services/dateService';
import { streakService } from '@/services/streakService';
import type { Habit, HabitCompletion } from '@/types';
import { DAYS_OF_WEEK } from '@/constants';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

interface CalendarHeatmapProps {
  habit: Habit;
  completions: HabitCompletion[];
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ habit, completions }) => {
  const [currentDateStr, setCurrentDateStr] = useState(dateService.getTodayString());
  const todayStr = dateService.getTodayString();

  const [year, month] = currentDateStr.split('-').map(Number);
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const firstDayOfMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const startDayOfWeek = dateService.getDayOfWeek(firstDayOfMonthStr); // 0 (Sun) to 6 (Sat)
  const lastDayOfMonth = new Date(year, month, 0).getDate();

  const handlePrevMonth = () => {
    const prevMonthDate = new Date(year, month - 2, 1);
    setCurrentDateStr(dateService.formatDateString(prevMonthDate));
  };

  const handleNextMonth = () => {
    const nextMonthDate = new Date(year, month, 1);
    setCurrentDateStr(dateService.formatDateString(nextMonthDate));
  };

  // Build grid padding
  const paddingCells = Array.from({ length: startDayOfWeek });
  const dayCells = Array.from({ length: lastDayOfMonth }, (_, i) => i + 1);

  return (
    <div className="flex flex-col space-y-4 p-4 border rounded-xl bg-card shadow-xs">
      {/* Month Header Navigation */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm capitalize text-foreground">{monthName}</h4>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-muted-foreground">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d.id} className="py-1">
            {d.short}
          </div>
        ))}
      </div>

      {/* Days Grid Heatmap */}
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {paddingCells.map((_, idx) => (
          <div key={`pad-${idx}`} className="h-9 rounded-md bg-transparent" />
        ))}

        {dayCells.map((dayNum) => {
          const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const isToday = dayStr === todayStr;
          const isFuture = dateService.isAfter(dayStr, todayStr);
          const isBeforeStart = dateService.isBefore(dayStr, habit.startDate);
          const scheduled = streakService.isHabitScheduledOnDate(habit, dayStr);
          const completed = streakService.isCompletedOnDate(habit.id, dayStr, completions);

          let bgClass = 'bg-muted/40 text-muted-foreground';
          let borderClass = 'border-transparent';

          if (isBeforeStart || isFuture) {
            bgClass = 'bg-accent/20 text-muted-foreground/40 cursor-not-allowed';
          } else if (scheduled) {
            if (completed) {
              bgClass = 'bg-emerald-500 text-white font-bold shadow-xs';
            } else {
              bgClass = 'bg-red-500/15 text-red-600 dark:text-red-400 font-medium';
            }
          } else {
            bgClass = 'bg-muted/20 text-muted-foreground/60';
          }

          if (isToday) {
            borderClass = 'ring-2 ring-primary ring-offset-1';
          }

          return (
            <div
              key={dayStr}
              className={cn(
                'h-9 rounded-lg flex items-center justify-center text-xs transition-all relative select-none',
                bgClass,
                borderClass
              )}
              title={`${dateService.formatFullDate(dayStr)}: ${
                completed ? 'Concluído' : scheduled ? 'Não concluído' : 'Não agendado'
              }`}
            >
              {dayNum}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 border-t">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-xs bg-emerald-500" />
          <span>Concluído</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-xs bg-red-500/30" />
          <span>Pendente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-xs bg-muted/30" />
          <span>Folga</span>
        </div>
      </div>
    </div>
  );
};
