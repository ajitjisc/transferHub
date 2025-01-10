import { getConfig } from '../config';
import { HttpError } from '../utils/validation';

export const validateApiKey = async (providedApiKey?: string): Promise<string> => {
  if (!providedApiKey) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Missing x-api-key header');
  }

  const apiKeyMap = (await getConfig()).apiKeys;
  const owner = Object.entries(apiKeyMap).find(([, value]) => value === providedApiKey)?.[0];

  if (!owner) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid API key');
  }

  return owner;
};
