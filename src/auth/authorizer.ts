import type {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent
} from 'aws-lambda';
import { validateApiKey } from './apiKey';
import { verifyJwt } from './jwt';

const buildPolicy = (
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, string>
): APIGatewayAuthorizerResult => ({
  principalId,
  policyDocument: {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource
      }
    ]
  },
  context
});

export const handler = async (
  event: APIGatewayRequestAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  const headers = Object.fromEntries(
    Object.entries(event.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])
  );

  const claims = verifyJwt(headers.authorization);
  const apiKeyOwner = validateApiKey(headers['x-api-key']);

  if (claims.producer !== apiKeyOwner || claims.sub !== apiKeyOwner) {
    throw new Error('Unauthorized');
  }

  return buildPolicy(claims.sub, 'Allow', event.methodArn, {
    principalId: claims.sub,
    producer: claims.producer,
    sub: claims.sub,
    scope: claims.scope.join(','),
    apiKeyOwner
  });
};
