import React, { useState } from 'react';
import { useHabits } from '@/context/HabitContext';
import { dateService } from '@/services/dateService';
import { streakService } from '@/services/streakService';
import type { DateFilterOption } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { IconRenderer } from '@/components/common/IconRenderer';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { Last30DaysChart } from '@/components/charts/Last30DaysChart';
import { cn } from '@/utils/cn';

export const HistoryPage: React.FC = () => {
  const { habits, categories, completions } = useHabits();
  const todayStr = dateService.getTodayString();

  const [dateFilter, setDateFilter] = useState<DateFilterOption>('last7');
  const [selectedHabitId, setSelectedHabitId] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState(dateService.subtractDays(todayStr, 14));
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  // Compute date range based on filter
  const dateRange = React.useMemo(() => {
    switch (dateFilter) {
      case 'today':
        return [todayStr];
      case 'last7':
        return dateService.getLastNDays(7, todayStr);
      case 'last30':
        return dateService.getLastNDays(30, todayStr);
      case 'thisMonth': {
        const start = dateService.getStartOfMonth(todayStr);
        return dateService.getDateRange(start, todayStr);
      }
      case 'custom':
        return dateService.getDateRange(customStartDate, customEndDate);
      default:
        return dateService.getLastNDays(7, todayStr);
    }
  }, [dateFilter, todayStr, customStartDate, customEndDate]);

  // Compute history list (Reverse chronological)
  const historyData = React.useMemo(() => {
    const reversedDates = [...dateRange].reverse();
    const activeHabits = habits.filter((h) => selectedHabitId === 'all' || h.id === selectedHabitId);

    return reversedDates.map((dateStr) => {
      const dayLogs = activeHabits.map((habit) => {
        const category = categories.find((c) => c.id === habit.categoryId);
        const scheduled = streakService.isHabitScheduledOnDate(habit, dateStr);
        const completed = streakService.isCompletedOnDate(habit.id, dateStr, completions);

        return {
          habit,
          category,
          scheduled,
          completed,
        };
      });

      const scheduledLogs = dayLogs.filter((l) => l.scheduled);
      const completedCount = scheduledLogs.filter((l) => l.completed).length;

      return {
        dateStr,
        displayDate: dateService.formatFullDate(dateStr),
        dayLogs,
        scheduledCount: scheduledLogs.length,
        completedCount,
        rate: scheduledLogs.length > 0 ? Math.round((completedCount / scheduledLogs.length) * 100) : 0,
      };
    });
  }, [dateRange, habits, categories, completions, selectedHabitId]);

  // Aggregate Period Summary
  const periodSummary = React.useMemo(() => {
    let totalScheduled = 0;
    let totalCompleted = 0;

    historyData.forEach((day) => {
      totalScheduled += day.scheduledCount;
      totalCompleted += day.completedCount;
    });

    const completionRate = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;

    return {
      totalScheduled,
      totalCompleted,
      totalPending: totalScheduled - totalCompleted,
      completionRate,
    };
  }, [historyData]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Filter Controls */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Period Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <Filter className="w-4 h-4 text-muted-foreground mr-1 shrink-0" />
            {[
              { id: 'today', label: 'Hoje' },
              { id: 'last7', label: 'Últimos 7 Dias' },
              { id: 'last30', label: 'Últimos 30 Dias' },
              { id: 'thisMonth', label: 'Este Mês' },
              { id: 'custom', label: 'Personalizado' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setDateFilter(option.id as DateFilterOption)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                  dateFilter === option.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Habit Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Label className="text-xs font-semibold text-muted-foreground shrink-0">Hábito:</Label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedHabitId}
              onChange={(e) => setSelectedHabitId(e.target.value)}
            >
              <option value="all">Todos os Hábitos</option>
              {habits.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Range Inputs */}
        {dateFilter === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <div className="space-y-1">
              <Label className="text-xs">Data Inicial</Label>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Data Final</Label>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Period Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Agendados no Período</p>
          <h4 className="text-2xl font-black text-foreground mt-1">{periodSummary.totalScheduled}</h4>
        </Card>

        <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Total Concluídos</p>
          <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{periodSummary.totalCompleted}</h4>
        </Card>

        <Card className="p-4 border-red-500/30 bg-red-500/5">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase">Total Pendentes</p>
          <h4 className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{periodSummary.totalPending}</h4>
        </Card>

        <Card className="p-4 border-primary/30 bg-primary/5">
          <p className="text-xs font-semibold text-primary uppercase">Taxa de Sucesso</p>
          <h4 className="text-2xl font-black text-primary mt-1">{periodSummary.completionRate}%</h4>
        </Card>
      </div>

      {/* 30-Day Trend Chart */}
      <Card>
        <CardHeader className="p-5 pb-2">
          <CardTitle className="text-base font-bold">Evolução Diária de Conclusões</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <Last30DaysChart />
        </CardContent>
      </Card>

      {/* History Log List by Date */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-primary" />
          <span>Registros Detalhados por Dia</span>
        </h3>

        {historyData.map((day) => (
          <Card key={day.dateStr} className="overflow-hidden">
            <div className="p-4 bg-muted/20 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground capitalize">{day.displayDate}</span>
                {day.dateStr === todayStr && (
                  <Badge variant="default" className="text-[10px] py-0">
                    Hoje
                  </Badge>
                )}
              </div>

              <span className="text-xs font-bold text-muted-foreground">
                {day.completedCount} / {day.scheduledCount} ({day.rate}%)
              </span>
            </div>

            <div className="p-4 space-y-2.5">
              {day.dayLogs.length > 0 ? (
                day.dayLogs.map((log) => (
                  <div
                    key={log.habit.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: log.habit.color || log.category?.color || '#8b5cf6' }}
                      >
                        <IconRenderer name={log.habit.icon || log.category?.icon || 'Target'} size={16} />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-foreground">{log.habit.name}</p>
                        {log.category && (
                          <span className="text-xs font-medium text-muted-foreground">{log.category.name}</span>
                        )}
                      </div>
                    </div>

                    <div>
                      {log.scheduled ? (
                        log.completed ? (
                          <Badge variant="success" className="gap-1 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Concluído
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <XCircle className="w-3.5 h-3.5" />
                            Pendente
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Não Agendado
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-2">
                  Nenhum hábito configurado para esta data.
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
