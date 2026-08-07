import React from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { HabitProvider } from '@/context/HabitContext';
import { AppRouter } from '@/routes';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <HabitProvider>
        <AppRouter />
      </HabitProvider>
    </ThemeProvider>
  );
};

export default App;
