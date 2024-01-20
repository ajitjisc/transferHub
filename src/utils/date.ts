export const nowIso = (): string => new Date().toISOString();

export const dayKey = (value: string): string => value.slice(0, 10);
