import React, { useState } from 'react';
import type { Habit, Category } from '@/types';
import { useHabits } from '@/context/HabitContext';
import { streakService } from '@/services/streakService';
import { dateService } from '@/services/dateService';
import { IconRenderer } from '@/components/common/IconRenderer';
import { Check, Flame, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/badge';

interface TodayHabitItemProps {
  habit: Habit;
  category?: Category;
}

export const TodayHabitItem: React.FC<TodayHabitItemProps> = ({ habit, category }) => {
  const { completions, toggleHabitCompletion } = useHabits();
  const todayStr = dateService.getTodayString();

  const isCompleted = streakService.isCompletedOnDate(habit.id, todayStr, completions);
  const currentStreak = streakService.calculateCurrentStreak(habit, completions, todayStr);

  const [animating, setAnimating] = useState(false);

  const handleToggle = () => {
    setAnimating(true);
    toggleHabitCompletion(habit.id, todayStr);
    setTimeout(() => setAnimating(false), 500);
  };

  return (
    <div
      className={cn(
        'group relative flex items-center justify-between p-4 rounded-xl border transition-all duration-200 bg-card hover:shadow-md select-none',
        isCompleted ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20' : 'hover:border-primary/40'
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Toggle Check Button */}
        <button
          type="button"
          onClick={handleToggle}
          className={cn(
            'relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 cursor-pointer shadow-xs',
            isCompleted
              ? 'bg-emerald-500 text-white scale-105 shadow-emerald-500/20'
              : 'border-2 border-input bg-background hover:border-primary hover:bg-primary/5 text-transparent'
          )}
          aria-label={`Marcar ${habit.name} como ${isCompleted ? 'não concluído' : 'concluído'}`}
        >
          <Check className={cn('w-5 h-5 transition-transform duration-200', isCompleted ? 'scale-100' : 'scale-0')} />
          {animating && isCompleted && (
            <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-amber-400 animate-ping" />
          )}
        </button>

        {/* Habit Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4
              className={cn(
                'font-semibold text-base tracking-tight truncate transition-colors',
                isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
              )}
            >
              {habit.name}
            </h4>

            {category && (
              <Badge
                variant="outline"
                className="text-[11px] font-medium border-transparent shrink-0"
                style={{ backgroundColor: `${category.color}18`, color: category.color }}
              >
                <IconRenderer name={category.icon} size={12} className="mr-1" />
                {category.name}
              </Badge>
            )}
          </div>

          {habit.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{habit.description}</p>
          )}
        </div>
      </div>

      {/* Streak Badge */}
      <div className="flex items-center gap-1 pl-3 shrink-0">
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all',
            currentStreak > 0
              ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30'
              : 'bg-muted text-muted-foreground'
          )}
          title={`Streak atual: ${currentStreak} dias consecutivos`}
        >
          <Flame className={cn('w-3.5 h-3.5', currentStreak > 0 ? 'fill-orange-500 text-orange-500' : '')} />
          <span>{currentStreak}d</span>
        </div>
      </div>
    </div>
  );
};
