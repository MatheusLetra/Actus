import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, FolderHeart, History, Settings, Flame } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useHabits } from '@/context/HabitContext';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/habits', label: 'Hábitos', icon: CheckSquare },
  { path: '/categories', label: 'Categorias', icon: FolderHeart },
  { path: '/history', label: 'Histórico', icon: History },
  { path: '/settings', label: 'Configurações', icon: Settings },
];

export const Sidebar: React.FC<{ onItemClick?: () => void }> = ({ onItemClick }) => {
  const { dashboardStats } = useHabits();

  return (
    <aside className="flex flex-col h-full bg-card border-r w-64 p-4 shrink-0 select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-2 py-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-primary to-purple-400 text-white flex items-center justify-center shadow-md">
          <Flame className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight tracking-tight text-foreground">Actus</h1>
          <p className="text-xs text-muted-foreground font-medium">Controle de Hábitos</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-1.5 flex-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onItemClick}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Streak Footer Highlight */}
      <div className="mt-auto p-3.5 rounded-xl bg-linear-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
            <span className="text-xs font-semibold text-foreground">Streak Atual</span>
          </div>
          <span className="text-sm font-extrabold text-orange-600 dark:text-orange-400">
            {dashboardStats.overallCurrentStreak} dias
          </span>
        </div>
      </div>
    </aside>
  );
};
