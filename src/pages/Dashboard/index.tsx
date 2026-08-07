import React from 'react';
import { useHabits } from '@/context/HabitContext';
import { streakService } from '@/services/streakService';
import { dateService } from '@/services/dateService';
import { TodayHabitItem } from '@/components/dashboard/TodayHabitItem';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Last7DaysChart } from '@/components/charts/Last7DaysChart';
import { CategoryDistributionChart } from '@/components/charts/CategoryDistributionChart';
import { HabitPerformanceChart } from '@/components/charts/HabitPerformanceChart';
import { EmptyState } from '@/components/common/EmptyState';
import {
  CheckCircle2,
  Flame,
  Trophy,
  Activity,
  CalendarCheck,
  TrendingUp,
  Award,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { habits, categories, dashboardStats } = useHabits();
  const navigate = useNavigate();
  const todayStr = dateService.getTodayString();

  // Active habits scheduled for today
  const activeHabits = habits.filter((h) => h.active);
  const todaysHabits = activeHabits.filter((h) => streakService.isHabitScheduledOnDate(h, todayStr));

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Overview Stat Cards Grid - Mobile First Responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Hábitos Ativos */}
        <Card className="p-4 flex flex-col justify-between hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Hábitos Ativos</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-foreground">{dashboardStats.activeHabitsCount}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Em acompanhamento</p>
          </div>
        </Card>

        {/* Card 2: Concluídos Hoje */}
        <Card className="p-4 flex flex-col justify-between hover:border-emerald-500/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Hoje</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-foreground">
              {dashboardStats.completedTodayCount} <span className="text-sm font-medium text-muted-foreground">/ {todaysHabits.length}</span>
            </h3>
            <div className="mt-1.5">
              <Progress value={dashboardStats.todayCompletionRate} indicatorColor="bg-emerald-500" />
            </div>
          </div>
        </Card>

        {/* Card 3: Streak Atual */}
        <Card className="p-4 flex flex-col justify-between hover:border-orange-500/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Streak Atual</span>
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <Flame className="w-4 h-4 fill-orange-500" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-foreground">{dashboardStats.overallCurrentStreak} <span className="text-xs font-normal text-muted-foreground">dias</span></h3>
            <p className="text-xs text-muted-foreground mt-0.5">Sequência ativa</p>
          </div>
        </Card>

        {/* Card 4: Maior Streak */}
        <Card className="p-4 flex flex-col justify-between hover:border-amber-500/50 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Maior Streak</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Trophy className="w-4 h-4 fill-amber-500" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-foreground">{dashboardStats.overallLongestStreak} <span className="text-xs font-normal text-muted-foreground">dias</span></h3>
            <p className="text-xs text-muted-foreground mt-0.5">Recorde histórico</p>
          </div>
        </Card>
      </div>

      {/* Secondary Metrics Bar (7d & 30d Rates) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Conclusões</p>
              <p className="text-lg font-bold text-foreground">{dashboardStats.totalCompletions}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Taxa 7 Dias</p>
              <p className="text-lg font-bold text-foreground">{dashboardStats.last7DaysRate}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Taxa 30 Dias</p>
              <p className="text-lg font-bold text-foreground">{dashboardStats.last30DaysRate}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Layout: Hábitos de Hoje (Left 7 Cols) + Charts (Right 5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Section: Hábitos de Hoje */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Hábitos de Hoje</h2>
              <p className="text-xs text-muted-foreground">
                {todaysHabits.length > 0
                  ? `Você tem ${todaysHabits.length} hábito(s) agendado(s) para hoje`
                  : 'Nenhum hábito agendado para hoje'}
              </p>
            </div>
          </div>

          {todaysHabits.length > 0 ? (
            <div className="space-y-3">
              {todaysHabits.map((habit) => {
                const category = categories.find((c) => c.id === habit.categoryId);
                return <TodayHabitItem key={habit.id} habit={habit} category={category} />;
              })}
            </div>
          ) : (
            <EmptyState
              icon="CheckCircle2"
              title="Tudo em dia para hoje!"
              description="Nenhum hábito pendente para o dia de hoje. Aproveite seu dia ou cadastre novos hábitos."
              actionLabel="+ Novo Hábito"
              onAction={() => navigate('/habits')}
            />
          )}
        </div>

        {/* Right Section: Quick Analytics */}
        <div className="lg:col-span-5 space-y-6">
          {/* Last 7 Days Bar Chart */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold">Desempenho dos Últimos 7 Dias</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Last7DaysChart />
            </CardContent>
          </Card>

          {/* Category Distribution Chart */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold">Distribuição por Categoria</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <CategoryDistributionChart />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Section: Habit Performance Comparison */}
      <Card>
        <CardHeader className="p-5 pb-2">
          <CardTitle className="text-base font-bold">Comparativo de Desempenho dos Hábitos</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <HabitPerformanceChart />
        </CardContent>
      </Card>
    </div>
  );
};
