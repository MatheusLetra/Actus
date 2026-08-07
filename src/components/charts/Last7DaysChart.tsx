import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useHabits } from '@/context/HabitContext';
import { statisticsService } from '@/services/statisticsService';

export const Last7DaysChart: React.FC = () => {
  const { habits, completions } = useHabits();
  const data = statisticsService.getDailyCompletionsSeries(habits, completions, 7);

  return (
    <div className="w-full h-64 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis dataKey="label" stroke="#888888" fontSize={12} tickLine={false} />
          <YAxis stroke="#888888" fontSize={12} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              borderRadius: '8px',
              color: 'var(--foreground)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            formatter={(value?: any, name?: any) => [
              value,
              name === 'completed' ? 'Concluídos' : 'Agendados',
            ]}
          />
          <Bar dataKey="completed" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="completed" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
