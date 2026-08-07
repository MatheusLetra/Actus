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

export const HabitPerformanceChart: React.FC = () => {
  const { habits, completions } = useHabits();
  const data = statisticsService.getHabitPerformanceSeries(habits, completions);

  if (data.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-sm text-muted-foreground">
        Nenhum hábito ativo disponível.
      </div>
    );
  }

  return (
    <div className="w-full h-64 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
          <XAxis type="number" stroke="#888888" fontSize={12} unit="%" domain={[0, 100]} />
          <YAxis dataKey="name" type="category" stroke="#888888" fontSize={11} tickLine={false} width={100} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              borderRadius: '8px',
              color: 'var(--foreground)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            formatter={(value?: any) => [`${value}%`, 'Conclusão Mensal']}
          />
          <Bar dataKey="completionRate" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
