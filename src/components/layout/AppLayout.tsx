import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const TITLE_MAP: Record<string, string> = {
  '/': 'Dashboard Geral',
  '/habits': 'Meus Hábitos',
  '/categories': 'Categorias',
  '/history': 'Histórico de Conclusões',
  '/settings': 'Configurações & Dados',
  '/tools': 'Ferramentas Úteis',
  '/tools/pomodoro': 'Pomodoro',
};

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const title = TITLE_MAP[location.pathname] || 'Habit Tracker';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Desktop Permanent Sidebar */}
      <div className="hidden lg:block h-full">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6 pb-12">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
