import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useHabits } from '@/context/HabitContext';

export const PomodoroHabitChart: React.FC = () => {
  const { pomodoroStats } = useHabits();
  const data = pomodoroStats.byHabit.map((stat) => ({
    name: stat.habitName,
    cycles: stat.cycles,
    focusMinutes: Math.round(stat.focusSeconds / 60),
  }));

  if (data.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-sm text-muted-foreground">
        Vincule hábitos aos focos para ver a comparação.
      </div>
    );
  }

  return (
    <div className="w-full h-64 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} allowDecimals={false} />
          <YAxis dataKey="name" type="category" stroke="#888888" fontSize={11} tickLine={false} width={100} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              borderRadius: '8px',
              color: 'var(--foreground)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            formatter={(value?: any, _name?: any, entry?: any) => [
              `${value} ciclos · ${entry?.payload?.focusMinutes ?? 0} min`,
              'Focos',
            ]}
          />
          <Bar dataKey="cycles" fill="#10b981" radius={[0, 4, 4, 0]} name="cycles" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
