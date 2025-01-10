import type {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent
} from 'aws-lambda';
import { validateApiKey } from './apiKey';

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

  const apiKeyOwner = await validateApiKey(headers['x-api-key']);

  return buildPolicy(apiKeyOwner, 'Allow', event.methodArn, {
    principalId: apiKeyOwner,
    producer: apiKeyOwner,
    apiKeyOwner
  });
};
