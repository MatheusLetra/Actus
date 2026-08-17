import { describe, expect, it } from 'vitest';
import { projectService } from '../services/projectService';

describe('projectService', () => {
  it('validates the required name and supported color', () => {
    expect(projectService.validate({ name: '  ', color: '#8b5cf6' }).valid).toBe(false);
    expect(projectService.validate({ name: 'Actus', color: '#000000' }).valid).toBe(false);
    expect(projectService.validate({ name: 'Actus', color: '#8b5cf6' }).valid).toBe(true);
  });

  it('creates a project with immutable creation time and version timestamp', () => {
    const created = projectService.create({ name: '  Actus  ', color: '#8b5cf6' }, '2026-08-17T10:00:00.000Z');

    expect(created.id).toMatch(/^project_/);
    expect(created.name).toBe('Actus');
    expect(created.createdAt).toBe('2026-08-17T10:00:00.000Z');
    expect(created.updatedAt).toBe(created.createdAt);
  });

  it('updates name and color without changing createdAt', () => {
    const created = projectService.create({ name: 'Actus', color: '#8b5cf6' }, '2026-08-17T10:00:00.000Z');
    const updated = projectService.update(created, { name: 'Trabalho', color: '#3b82f6' }, '2026-08-17T11:00:00.000Z');

    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).toBe('2026-08-17T11:00:00.000Z');
    expect(updated.name).toBe('Trabalho');
    expect(updated.color).toBe('#3b82f6');
  });

  it('sorts projects by creation time and id', () => {
    const projects = [
      projectService.create({ name: 'B', color: '#8b5cf6' }, '2026-08-02T00:00:00.000Z'),
      projectService.create({ name: 'A', color: '#8b5cf6' }, '2026-08-01T00:00:00.000Z'),
    ];

    expect(projectService.sort(projects).map((project) => project.name)).toEqual(['A', 'B']);
  });
});
