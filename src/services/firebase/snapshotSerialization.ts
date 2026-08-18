export function normalizeForSync<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForSync(item)) as T;
  }

  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (nestedValue !== undefined) sanitized[key] = normalizeForSync(nestedValue);
    }
    return sanitized as T;
  }

  return value;
}

export function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return `string:${JSON.stringify(value)}`;
  if (typeof value === 'number') return `number:${Number.isNaN(value) ? 'NaN' : value}`;
  if (typeof value === 'boolean') return `boolean:${value}`;
  if (typeof value === 'bigint') return `bigint:${value.toString()}`;
  if (typeof value === 'function') return 'function';
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;

  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, nestedValue]) => nestedValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableSerialize(nestedValue)}`)
      .join(',')}}`;
  }

  return `${typeof value}:${String(value)}`;
}

export function sanitizeForFirestore<T>(value: T): T {
  return normalizeForSync(value);
}
