import React from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { HabitProvider } from '@/context/HabitContext';
import { FirebaseProvider } from '@/context/FirebaseContext';
import { AppRouter } from '@/routes';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <HabitProvider>
        <FirebaseProvider>
          <AppRouter />
        </FirebaseProvider>
      </HabitProvider>
    </ThemeProvider>
  );
};

export default App;
