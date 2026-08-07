/**
 * Timezone-safe Date Service operating on 'YYYY-MM-DD' strings.
 */

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0); // Noon to prevent timezone shifts
}

function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayString(): string {
  const now = new Date();
  return formatDateString(now);
}

function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateString(d);
}

function subtractDays(dateStr: string, days: number): string {
  return addDays(dateStr, -days);
}

function getDayOfWeek(dateStr: string): number {
  return parseDate(dateStr).getDay();
}

function isSameDay(dateStr1: string, dateStr2: string): boolean {
  return dateStr1 === dateStr2;
}

function isBefore(dateStr1: string, dateStr2: string): boolean {
  return dateStr1 < dateStr2;
}

function isAfter(dateStr1: string, dateStr2: string): boolean {
  return dateStr1 > dateStr2;
}

function getDateRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  let curr = startDateStr;
  while (curr <= endDateStr) {
    dates.push(curr);
    curr = addDays(curr, 1);
  }
  return dates;
}

function getLastNDays(n: number, endDateStr = getTodayString()): string[] {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    dates.push(subtractDays(endDateStr, i));
  }
  return dates;
}

function getStartOfWeek(dateStr = getTodayString()): string {
  const d = parseDate(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day; // Sunday is start of week
  const start = new Date(d.setDate(diff));
  return formatDateString(start);
}

function getEndOfWeek(dateStr = getTodayString()): string {
  const start = getStartOfWeek(dateStr);
  return addDays(start, 6);
}

function getStartOfMonth(dateStr = getTodayString()): string {
  const [year, month] = dateStr.split('-');
  return `${year}-${month}-01`;
}

function getEndOfMonth(dateStr = getTodayString()): string {
  const [year, month] = dateStr.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(lastDay).padStart(2, '0');
  return `${year}-${monthStr}-${dayStr}`;
}

function formatDisplayDate(dateStr: string, options?: { short?: boolean }): string {
  const date = parseDate(dateStr);
  if (options?.short) {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    weekday: 'short',
  });
}

function formatFullDate(dateStr: string): string {
  const date = parseDate(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export const dateService = {
  getTodayString,
  parseDate,
  formatDateString,
  addDays,
  subtractDays,
  getDayOfWeek,
  isSameDay,
  isBefore,
  isAfter,
  getDateRange,
  getLastNDays,
  getStartOfWeek,
  getEndOfWeek,
  getStartOfMonth,
  getEndOfMonth,
  formatDisplayDate,
  formatFullDate,
};
