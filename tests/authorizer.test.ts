import jwt from 'jsonwebtoken';
import { resetConfigCache } from '../src/config';
import { handler } from '../src/auth/authorizer';

describe('authorizer', () => {
  beforeEach(() => {
    process.env.JWT_ISSUER = 'https://auth.example.com';
    process.env.JWT_AUDIENCE = 'transferhub-api';
    process.env.JWT_SECRET = 'local-dev-secret';
    process.env.API_KEYS_JSON = '{"customer-a":"local-api-key-a"}';
    resetConfigCache();
  });

  it('allows requests when JWT and API key match the same producer', async () => {
    const token = jwt.sign(
      {
        sub: 'customer-a',
        producer: 'customer-a',
        scope: ['transfer:create']
      },
      process.env.JWT_SECRET as string,
      {
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
        expiresIn: '1h'
      }
    );

    const response = await handler({
      type: 'REQUEST',
      methodArn: 'arn:aws:execute-api:eu-west-2:123456789012:api/prod/GET/v1/data-products',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-api-key': 'local-api-key-a'
      }
    } as never);

    expect(response.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(response.context?.producer).toBe('customer-a');
    expect(response.context?.scope).toContain('transfer:create');
  });

  it('rejects requests when the API key owner does not match the JWT producer', async () => {
    const token = jwt.sign(
      {
        sub: 'customer-a',
        producer: 'customer-a',
        scope: ['transfer:create']
      },
      process.env.JWT_SECRET as string,
      {
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
        expiresIn: '1h'
      }
    );

    await expect(
      handler({
        type: 'REQUEST',
        methodArn: 'arn:aws:execute-api:eu-west-2:123456789012:api/prod/GET/v1/data-products',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-api-key': 'wrong-key'
        }
      } as never)
    ).rejects.toThrow('Invalid API key');
  });
});
