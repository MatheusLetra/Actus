import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useHabits } from '@/context/HabitContext';
import { POMODORO_DISTRIBUTION_COLORS } from '@/constants';

export const PomodoroCycleDistribution: React.FC = () => {
  const { pomodoroStats } = useHabits();

  const data = pomodoroStats.distribution
    .filter((d) => d.count > 0)
    .map((d) => ({ name: d.label, value: d.count, color: POMODORO_DISTRIBUTION_COLORS[d.cycleType] }));

  if (data.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-sm text-muted-foreground">
        Nenhum ciclo registrado ainda.
      </div>
    );
  }

  return (
    <div className="w-full h-64 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={4}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              borderRadius: '8px',
              color: 'var(--foreground)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            formatter={(value?: any) => [`${value} ciclos`, 'Total']}
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
