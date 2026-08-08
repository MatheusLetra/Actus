import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useHabits } from '@/context/HabitContext';

export const PomodoroDailyChart: React.FC = () => {
  const { pomodoroStats } = useHabits();
  const data = pomodoroStats.dailySeries;

  if (data.every((d) => d.cycles === 0)) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-sm text-muted-foreground">
        Nenhum ciclo de foco registrado ainda.
      </div>
    );
  }

  return (
    <div className="w-full h-64 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey="label" stroke="#888888" fontSize={11} tickLine={false} />
          <YAxis stroke="#888888" fontSize={12} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              borderRadius: '8px',
              color: 'var(--foreground)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            formatter={(value?: any, name?: any, entry?: any) => [
              `${value} ciclos · ${entry?.payload?.focusMinutes ?? 0} min`,
              name === 'cycles' ? 'Focos' : name,
            ]}
          />
          <Bar dataKey="cycles" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="cycles" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
