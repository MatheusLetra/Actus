import React, { useState } from 'react';
import { useHabits } from '@/context/HabitContext';
import type { Habit } from '@/types';
import { HabitCard } from '@/components/habits/HabitCard';
import { HabitFormDialog } from '@/components/habits/HabitFormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/common/EmptyState';
import { Plus, Search } from 'lucide-react';

export const HabitsPage: React.FC = () => {
  const { habits, categories } = useHabits();

  const [formOpen, setFormOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const handleCreateNew = () => {
    setEditingHabit(null);
    setFormOpen(true);
  };

  const handleEdit = (habit: Habit) => {
    setEditingHabit(habit);
    setFormOpen(true);
  };

  // Filtering habits
  const filteredHabits = habits.filter((habit) => {
    const matchesSearch =
      habit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (habit.description && habit.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategoryId === 'all' || habit.categoryId === selectedCategoryId;

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && habit.active) ||
      (statusFilter === 'inactive' && !habit.active);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Actions & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search & Category Select Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do hábito..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Category Dropdown Filter */}
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
          >
            <option value="all">Todas as Categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Select Filter */}
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">Todos os Status</option>
            <option value="active">Somente Ativos</option>
            <option value="inactive">Somente Inativos</option>
          </select>
        </div>

        {/* Add Habit Button */}
        <Button onClick={handleCreateNew} className="shadow-sm shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Novo Hábito
        </Button>
      </div>

      {/* Habit Cards Grid - Mobile First */}
      {filteredHabits.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHabits.map((habit) => {
            const category = categories.find((c) => c.id === habit.categoryId);
            return (
              <HabitCard
                key={habit.id}
                habit={habit}
                category={category}
                onEdit={handleEdit}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="Target"
          title="Nenhum hábito encontrado"
          description={
            searchQuery || selectedCategoryId !== 'all' || statusFilter !== 'all'
              ? 'Nenhum hábito corresponde aos filtros selecionados.'
              : 'Você ainda não cadastrou nenhum hábito. Comece agora mesmo!'
          }
          actionLabel="+ Criar Primeiro Hábito"
          onAction={handleCreateNew}
        />
      )}

      {/* Form Dialog (Create & Edit) */}
      <HabitFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        habitToEdit={editingHabit}
      />
    </div>
  );
};
