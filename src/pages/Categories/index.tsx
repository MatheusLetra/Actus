import React, { useState } from 'react';
import { useHabits } from '@/context/HabitContext';
import type { Category } from '@/types';
import { CategoryCard } from '@/components/categories/CategoryCard';
import { CategoryFormDialog } from '@/components/categories/CategoryFormDialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { Plus } from 'lucide-react';

export const CategoriesPage: React.FC = () => {
  const { categories } = useHabits();
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const handleCreateNew = () => {
    setEditingCategory(null);
    setFormOpen(true);
  };

  const handleEdit = (cat: Category) => {
    setEditingCategory(cat);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Gerenciar Categorias</h2>
          <p className="text-xs text-muted-foreground">Organize seus hábitos por áreas da sua vida</p>
        </div>

        <Button onClick={handleCreateNew} className="shadow-sm">
          <Plus className="w-4 h-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      {/* Category Cards Grid - Mobile First */}
      {categories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} onEdit={handleEdit} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="FolderHeart"
          title="Nenhuma categoria cadastrada"
          description="Crie categorias para agrupar e organizar seus hábitos (ex: Saúde, Estudos, Finanças)."
          actionLabel="+ Nova Categoria"
          onAction={handleCreateNew}
        />
      )}

      {/* Form Dialog */}
      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        categoryToEdit={editingCategory}
      />
    </div>
  );
};
