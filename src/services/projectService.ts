import { COLOR_OPTIONS } from '@/constants';
import type { Project } from '@/types';

export interface ProjectValidation {
  valid: boolean;
  errors: Partial<Record<'name' | 'color', string>>;
}

function createProjectId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    try {
      return `project_${globalThis.crypto.randomUUID()}`;
    } catch {
    }
  }
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    try {
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
      return `project_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    } catch {
    }
  }
  return `project_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export const projectService = {
  createId: createProjectId,

  validate(project: Pick<Project, 'name' | 'color'>): ProjectValidation {
    const errors: ProjectValidation['errors'] = {};
    if (!project.name || !project.name.trim()) errors.name = 'O nome do projeto é obrigatório.';
    if (!COLOR_OPTIONS.some((option) => option.value === project.color)) {
      errors.color = 'Selecione uma cor válida.';
    }
    return { valid: Object.keys(errors).length === 0, errors };
  },

  create(input: Pick<Project, 'name' | 'color'>, now = nowIso()): Project {
    const project: Project = {
      id: createProjectId(),
      name: input.name.trim(),
      color: input.color,
      createdAt: now,
      updatedAt: now,
    };
    return project;
  },

  update(project: Project, changes: Pick<Project, 'name' | 'color'>, now = nowIso()): Project {
    return {
      ...project,
      name: changes.name.trim(),
      color: changes.color,
      updatedAt: now,
    };
  },

  sort(projects: Project[]): Project[] {
    return [...projects].sort((a, b) => {
      const createdAt = a.createdAt.localeCompare(b.createdAt);
      return createdAt || a.id.localeCompare(b.id);
    });
  },
};
