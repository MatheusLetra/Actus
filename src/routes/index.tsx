import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/pages/Dashboard';
import { HabitsPage } from '@/pages/Habits';
import { CategoriesPage } from '@/pages/Categories';
import { HistoryPage } from '@/pages/History';
import { SettingsPage } from '@/pages/Settings';
import { ToolsPage } from '@/pages/Tools';
import { PomodoroPage } from '@/pages/Pomodoro';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'habits',
        element: <HabitsPage />,
      },
      {
        path: 'categories',
        element: <CategoriesPage />,
      },
      {
        path: 'history',
        element: <HistoryPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'tools',
        element: <ToolsPage />,
      },
      {
        path: 'tools/pomodoro',
        element: <PomodoroPage />,
      },
    ],
  },
]);

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};
