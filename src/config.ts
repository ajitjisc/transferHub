import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export interface AppConfig {
  transferTable: string;
  landingBucket: string;
  awsRegion: string;
  uploadUrlExpirySeconds: number;
  apiKeys: Record<string, string>;
  apiKeySecretId?: string;
}

interface AuthSecretPayload {
  API_KEYS_JSON?: unknown;
}

let cachedConfigPromise: Promise<AppConfig> | undefined;
let cachedSecretsClient: SecretsManagerClient | undefined;

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseApiKeys = (value: unknown): Record<string, string> => {
  if (!value) {
    return {};
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === 'string' && typeof entry[1] === 'string'
      )
    );
  }

  if (typeof value !== 'string') {
    throw new Error('API_KEYS_JSON must be a JSON string or object');
  }

  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === 'string' && typeof entry[1] === 'string'
      )
    );
  } catch (error) {
    throw new Error(`Failed to parse API_KEYS_JSON: ${(error as Error).message}`);
  }
};

const getSecretsManagerClient = (region: string): SecretsManagerClient => {
  if (!cachedSecretsClient) {
    cachedSecretsClient = new SecretsManagerClient({
      region
    });
  }

  return cachedSecretsClient;
};

const loadSecretOverrides = async (
  region: string,
  secretId: string
): Promise<Partial<AppConfig>> => {
  const response = await getSecretsManagerClient(region).send(
    new GetSecretValueCommand({
      SecretId: secretId
    })
  );

  if (!response.SecretString) {
    throw new Error(`Secrets Manager secret ${secretId} did not contain SecretString`);
  }

  const payload = JSON.parse(response.SecretString) as AuthSecretPayload;

  return {
    apiKeys:
      payload.API_KEYS_JSON === undefined ? undefined : parseApiKeys(payload.API_KEYS_JSON)
  };
};

export const getConfig = async (): Promise<AppConfig> => {
  if (!cachedConfigPromise) {
    cachedConfigPromise = (async () => {
      const baseConfig: AppConfig = {
        transferTable: process.env.TRANSFER_TABLE ?? 'transferhub-transfers',
        landingBucket: process.env.LANDING_BUCKET ?? 'transferhub-landing',
        awsRegion: process.env.AWS_REGION ?? 'eu-west-2',
        uploadUrlExpirySeconds: parseNumber(process.env.UPLOAD_URL_EXPIRY_SECONDS, 900),
        apiKeys: parseApiKeys(process.env.API_KEYS_JSON),
        apiKeySecretId: process.env.API_KEY_SECRET_ID
      };

      if (!baseConfig.apiKeySecretId) {
        return baseConfig;
      }

      const secretOverrides = await loadSecretOverrides(
        baseConfig.awsRegion,
        baseConfig.apiKeySecretId
      );

      return {
        ...baseConfig,
        ...secretOverrides,
        apiKeys: secretOverrides.apiKeys ?? baseConfig.apiKeys
      };
    })();
  }

  return cachedConfigPromise;
};

export const resetConfigCache = (): void => {
  cachedConfigPromise = undefined;
  cachedSecretsClient = undefined;
};
