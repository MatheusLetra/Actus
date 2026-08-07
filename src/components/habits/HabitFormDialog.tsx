import React, { useEffect, useState } from 'react';
import type { Habit, HabitFrequency } from '@/types';
import { DAYS_OF_WEEK } from '@/constants';
import { useHabits } from '@/context/HabitContext';
import { dateService } from '@/services/dateService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { IconPicker } from '@/components/common/IconPicker';
import { ColorPicker } from '@/components/common/ColorPicker';
import { cn } from '@/utils/cn';

interface HabitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habitToEdit?: Habit | null;
}

export const HabitFormDialog: React.FC<HabitFormDialogProps> = ({
  open,
  onOpenChange,
  habitToEdit,
}) => {
  const { categories, addHabit, updateHabit } = useHabits();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [icon, setIcon] = useState('Target');
  const [color, setColor] = useState('#8b5cf6');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [targetDays, setTargetDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startDate, setStartDate] = useState(dateService.getTodayString());
  const [active, setActive] = useState(true);

  const [errors, setErrors] = useState<{ name?: string; categoryId?: string; startDate?: string }>({});

  useEffect(() => {
    if (habitToEdit) {
      setName(habitToEdit.name);
      setDescription(habitToEdit.description || '');
      setCategoryId(habitToEdit.categoryId);
      setIcon(habitToEdit.icon || 'Target');
      setColor(habitToEdit.color || '#8b5cf6');
      setFrequency(habitToEdit.frequency);
      setTargetDays(habitToEdit.targetDays || [1, 2, 3, 4, 5]);
      setStartDate(habitToEdit.startDate);
      setActive(habitToEdit.active);
    } else {
      setName('');
      setDescription('');
      setCategoryId(categories.length > 0 ? categories[0].id : '');
      setIcon('Target');
      setColor('#8b5cf6');
      setFrequency('daily');
      setTargetDays([1, 2, 3, 4, 5]);
      setStartDate(dateService.getTodayString());
      setActive(true);
    }
    setErrors({});
  }, [habitToEdit, open, categories]);

  const toggleTargetDay = (dayId: number) => {
    if (targetDays.includes(dayId)) {
      setTargetDays(targetDays.filter((d) => d !== dayId));
    } else {
      setTargetDays([...targetDays, dayId].sort());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { name?: string; categoryId?: string; startDate?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'O nome do hábito é obrigatório.';
    }
    if (!categoryId) {
      newErrors.categoryId = 'Selecione uma categoria.';
    }
    if (!startDate) {
      newErrors.startDate = 'Data inicial é obrigatória.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (habitToEdit) {
      updateHabit({
        ...habitToEdit,
        name: name.trim(),
        description: description.trim(),
        categoryId,
        icon,
        color,
        frequency,
        targetDays: frequency === 'custom' ? targetDays : undefined,
        startDate,
        active,
      });
    } else {
      addHabit({
        name: name.trim(),
        description: description.trim(),
        categoryId,
        icon,
        color,
        frequency,
        targetDays: frequency === 'custom' ? targetDays : undefined,
        startDate,
        active,
      });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {habitToEdit ? 'Editar Hábito' : 'Novo Hábito'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="habit-name">Nome do Hábito *</Label>
            <Input
              id="habit-name"
              placeholder="Ex: Beber 2L de água, Meditar, Estudar React..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <p className="text-xs font-medium text-destructive">{errors.name}</p>}
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="habit-description">Descrição (Opcional)</Label>
            <Input
              id="habit-description"
              placeholder="Detalhes ou metas específicas..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Categoria & Data Inicial (2 Cols Desktop) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="habit-category">Categoria *</Label>
              <select
                id="habit-category"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && <p className="text-xs font-medium text-destructive">{errors.categoryId}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="habit-startdate">Data de Início *</Label>
              <Input
                id="habit-startdate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              {errors.startDate && <p className="text-xs font-medium text-destructive">{errors.startDate}</p>}
            </div>
          </div>

          {/* Frequência */}
          <div className="space-y-2">
            <Label>Frequência *</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'daily', label: 'Diário' },
                { id: 'weekly', label: 'Semanal' },
                { id: 'custom', label: 'Dias Específicos' },
              ].map((freq) => (
                <button
                  key={freq.id}
                  type="button"
                  onClick={() => setFrequency(freq.id as HabitFrequency)}
                  className={cn(
                    'py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer',
                    frequency === freq.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-background hover:bg-accent text-foreground'
                  )}
                >
                  {freq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target Days for Custom Frequency */}
          {frequency === 'custom' && (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/20">
              <Label className="text-xs text-muted-foreground">Selecione os dias da semana:</Label>
              <div className="flex flex-wrap gap-1.5 justify-between">
                {DAYS_OF_WEEK.map((day) => {
                  const selected = targetDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleTargetDay(day.id)}
                      className={cn(
                        'w-9 h-9 rounded-full text-xs font-bold transition-all cursor-pointer',
                        selected
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-background border text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Visual Icon Selection Grid */}
          <div className="space-y-1.5">
            <Label>Ícone</Label>
            <IconPicker selectedIcon={icon} onSelectIcon={setIcon} />
          </div>

          {/* Color Selection */}
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <ColorPicker selectedColor={color} onSelectColor={setColor} />
          </div>

          {/* Status Ativo Toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
            <div>
              <Label className="font-semibold text-sm">Hábito Ativo</Label>
              <p className="text-xs text-muted-foreground">Hábitos inativos não aparecem no acompanhamento diário.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>

            <Button type="submit">
              {habitToEdit ? 'Salvar Alterações' : 'Criar Hábito'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
