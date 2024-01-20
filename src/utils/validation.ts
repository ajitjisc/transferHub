export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const assertDefined = <T>(
  value: T | undefined | null,
  statusCode: number,
  code: string,
  message: string
): T => {
  if (value === undefined || value === null) {
    throw new HttpError(statusCode, code, message);
  }

  return value;
};

export const assertNonEmptyString = (
  value: unknown,
  fieldName: string
): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, 'VALIDATION_ERROR', `${fieldName} must be a non-empty string`);
  }

  return value.trim();
};

export const assertArray = <T>(value: unknown, fieldName: string): T[] => {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${fieldName} must be an array`);
  }

  return value as T[];
};

export const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
