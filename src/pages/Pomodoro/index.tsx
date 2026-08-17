import React, { useState } from 'react';
import { useHabits } from '@/context/HabitContext';
import { PomodoroTimer } from '@/components/pomodoro/PomodoroTimer';
import { PomodoroSettingsForm } from '@/components/pomodoro/PomodoroSettingsForm';
import { PomodoroSessionLog } from '@/components/pomodoro/PomodoroSessionLog';
import { PomodoroDailyChart } from '@/components/charts/PomodoroDailyChart';
import { PomodoroHabitChart } from '@/components/charts/PomodoroHabitChart';
import { PomodoroCycleDistribution } from '@/components/charts/PomodoroCycleDistribution';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PomodoroRetroactiveDialog } from '@/components/pomodoro/PomodoroRetroactiveDialog';
import { Flame, Clock, Repeat, CalendarCheck, History } from 'lucide-react';

export const PomodoroPage: React.FC = () => {
  const { pomodoroStats } = useHabits();
  const [retroactiveOpen, setRetroactiveOpen] = useState(false);

  const statCards = [
    {
      label: 'Focos Hoje',
      value: pomodoroStats.todayFocusCycles,
      icon: CalendarCheck,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'Total de Focos',
      value: pomodoroStats.totalFocusCycles,
      icon: Flame,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    {
      label: 'Minutos de Foco',
      value: pomodoroStats.totalFocusMinutes,
      icon: Clock,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Total de Ciclos',
      value: pomodoroStats.totalCycles,
      icon: Repeat,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Pomodoro</h2>
          <p className="text-xs text-muted-foreground">
            Técnica de foco em blocos de tempo, com pausas curtas e longas. Configurável, com registro automático de ciclos.
          </p>
        </div>
        <Button variant="outline" onClick={() => setRetroactiveOpen(true)} className="w-full sm:w-auto">
          <History className="mr-2 h-4 w-4" />
          Registrar Pomodoro
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase">{stat.label}</span>
                <div className={`w-8 h-8 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <h3 className="mt-3 text-2xl font-black text-foreground">{stat.value}</h3>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PomodoroTimer />
        </div>
        <div>
          <PomodoroSettingsForm />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-bold">Ciclos de Foco — Últimos 30 Dias</CardTitle>
            <CardDescription>Quantidade de focos concluídos por dia.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <PomodoroDailyChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-bold">Distribuição de Ciclos</CardTitle>
            <CardDescription>Foco, pausa curta e pausa longa.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <PomodoroCycleDistribution />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-5 pb-2">
          <CardTitle className="text-sm font-bold">Focos por Hábito Vinculado</CardTitle>
          <CardDescription>Compare o esforço investido em cada hábito.</CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <PomodoroHabitChart />
        </CardContent>
      </Card>

      <PomodoroSessionLog />
      <PomodoroRetroactiveDialog open={retroactiveOpen} onOpenChange={setRetroactiveOpen} />
    </div>
  );
};
