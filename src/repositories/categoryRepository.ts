import { STORAGE_KEYS } from '@/constants';
import type { Category } from '@/types';
import { storageService } from './storageService';

export const categoryRepository = {
  getAll(): Category[] {
    return storageService.getItem<Category[]>(STORAGE_KEYS.categories, []);
  },

  saveAll(categories: Category[]): void {
    storageService.setItem(STORAGE_KEYS.categories, categories);
  },

  add(category: Category): Category[] {
    const list = this.getAll();
    const updated = [category, ...list];
    this.saveAll(updated);
    return updated;
  },

  update(updatedCategory: Category): Category[] {
    const list = this.getAll();
    const updated = list.map((c) => (c.id === updatedCategory.id ? updatedCategory : c));
    this.saveAll(updated);
    return updated;
  },

  delete(id: string): Category[] {
    const list = this.getAll();
    const updated = list.filter((c) => c.id !== id);
    this.saveAll(updated);
    return updated;
  },
};
