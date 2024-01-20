export interface AppConfig {
  transferTable: string;
  landingBucket: string;
  awsRegion: string;
  uploadUrlExpirySeconds: number;
  jwtIssuer: string;
  jwtAudience: string;
  jwtSecret: string;
  apiKeys: Record<string, string>;
}

let cachedConfig: AppConfig | undefined;

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseApiKeys = (value: string | undefined): Record<string, string> => {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
    );
  } catch (error) {
    throw new Error(`Failed to parse API_KEYS_JSON: ${(error as Error).message}`);
  }
};

export const getConfig = (): AppConfig => {
  if (!cachedConfig) {
    cachedConfig = {
      transferTable: process.env.TRANSFER_TABLE ?? 'transferhub-transfers',
      landingBucket: process.env.LANDING_BUCKET ?? 'transferhub-landing',
      awsRegion: process.env.AWS_REGION ?? 'eu-west-2',
      uploadUrlExpirySeconds: parseNumber(process.env.UPLOAD_URL_EXPIRY_SECONDS, 900),
      jwtIssuer: process.env.JWT_ISSUER ?? 'https://auth.example.com',
      jwtAudience: process.env.JWT_AUDIENCE ?? 'transferhub-api',
      jwtSecret: process.env.JWT_SECRET ?? 'local-dev-secret',
      apiKeys: parseApiKeys(process.env.API_KEYS_JSON)
    };
  }

  return cachedConfig;
};

export const resetConfigCache = (): void => {
  cachedConfig = undefined;
};
