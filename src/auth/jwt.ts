import jwt from 'jsonwebtoken';
import { getConfig } from '../config';
import type { JwtClaims } from '../models/auth';
import { HttpError } from '../utils/validation';

const extractBearerToken = (authorizationHeader?: string): string => {
  if (!authorizationHeader) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Missing Authorization header');
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Authorization header must use Bearer token');
  }

  return token;
};

export const verifyJwt = (authorizationHeader?: string): JwtClaims => {
  const token = extractBearerToken(authorizationHeader);
  const config = getConfig();

  const decoded = jwt.verify(token, config.jwtSecret, {
    issuer: config.jwtIssuer,
    audience: config.jwtAudience
  }) as JwtClaims | string;

  if (typeof decoded === 'string') {
    throw new HttpError(401, 'UNAUTHORIZED', 'JWT payload was not an object');
  }

  const rawScope: unknown = (decoded as unknown as Record<string, unknown>).scope;
  const scope = Array.isArray(rawScope)
    ? rawScope.filter((item): item is string => typeof item === 'string')
    : typeof rawScope === 'string'
      ? String(rawScope).split(' ').filter(Boolean)
      : [];

  return {
    ...decoded,
    scope
  };
};
