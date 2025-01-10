import { resetConfigCache } from '../src/config';
import { handler } from '../src/auth/authorizer';

describe('authorizer', () => {
  beforeEach(() => {
    process.env.API_KEYS_JSON = '{"customer-a":"local-api-key-a"}';
    resetConfigCache();
  });

  it('allows requests with a valid API key', async () => {
    const response = await handler({
      type: 'REQUEST',
      methodArn: 'arn:aws:execute-api:eu-west-2:123456789012:api/prod/GET/v1/data-products',
      headers: {
        'x-api-key': 'local-api-key-a'
      }
    } as never);

    expect(response.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(response.context?.producer).toBe('customer-a');
    expect(response.context?.principalId).toBe('customer-a');
  });

  it('rejects requests with an invalid API key', async () => {
    await expect(
      handler({
        type: 'REQUEST',
        methodArn: 'arn:aws:execute-api:eu-west-2:123456789012:api/prod/GET/v1/data-products',
        headers: {
          'x-api-key': 'wrong-key'
        }
      } as never)
    ).rejects.toThrow('Invalid API key');
  });
});
