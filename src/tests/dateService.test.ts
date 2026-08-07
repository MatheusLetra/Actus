import { describe, expect, it } from 'vitest';
import { dateService } from '../services/dateService';

describe('dateService', () => {
  it('should parse and format date strings consistently', () => {
    const dateStr = '2026-08-07';
    const parsed = dateService.parseDate(dateStr);
    expect(dateService.formatDateString(parsed)).toBe(dateStr);
  });

  it('should add and subtract days accurately', () => {
    expect(dateService.addDays('2026-08-07', 3)).toBe('2026-08-10');
    expect(dateService.subtractDays('2026-08-07', 7)).toBe('2026-07-31');
  });

  it('should calculate day of week correctly', () => {
    // 2026-08-07 is Friday (5)
    expect(dateService.getDayOfWeek('2026-08-07')).toBe(5);
  });

  it('should generate date ranges', () => {
    const range = dateService.getDateRange('2026-08-01', '2026-08-03');
    expect(range).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
  });

  it('should calculate start and end of week', () => {
    // 2026-08-07 is Friday. Sunday start = 2026-08-02, Saturday end = 2026-08-08
    expect(dateService.getStartOfWeek('2026-08-07')).toBe('2026-08-02');
    expect(dateService.getEndOfWeek('2026-08-07')).toBe('2026-08-08');
  });
});
