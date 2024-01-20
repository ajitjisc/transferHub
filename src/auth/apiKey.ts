import { getConfig } from '../config';
import { HttpError } from '../utils/validation';

export const validateApiKey = (providedApiKey?: string): string => {
  if (!providedApiKey) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Missing x-api-key header');
  }

  const apiKeyMap = getConfig().apiKeys;
  const owner = Object.entries(apiKeyMap).find(([, value]) => value === providedApiKey)?.[0];

  if (!owner) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid API key');
  }

  return owner;
};
