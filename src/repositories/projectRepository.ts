import { STORAGE_KEYS } from '@/constants';
import type { Project } from '@/types';
import { storageService } from './storageService';

export const projectRepository = {
  getAll(): Project[] {
    return storageService.getItem<Project[]>(STORAGE_KEYS.projects, []);
  },

  saveAll(projects: Project[]): void {
    storageService.setItem(STORAGE_KEYS.projects, projects);
  },

  add(project: Project): Project[] {
    const updated = [project, ...this.getAll()];
    this.saveAll(updated);
    return updated;
  },

  update(project: Project): Project[] {
    const updated = this.getAll().map((item) => (item.id === project.id ? project : item));
    this.saveAll(updated);
    return updated;
  },

  delete(id: string): Project[] {
    const updated = this.getAll().filter((project) => project.id !== id);
    this.saveAll(updated);
    return updated;
  },
};
