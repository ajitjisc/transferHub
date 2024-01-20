import { HttpError } from '../utils/validation';

export const ensureScopes = (availableScopes: string[], requiredScopes: string[]): void => {
  const missingScopes = requiredScopes.filter((scope) => !availableScopes.includes(scope));

  if (missingScopes.length > 0) {
    throw new HttpError(
      403,
      'FORBIDDEN',
      `Missing required scope(s): ${missingScopes.join(', ')}`
    );
  }
};
