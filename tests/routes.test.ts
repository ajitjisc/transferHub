import type { APIGatewayProxyEvent } from 'aws-lambda';
import { routeRequest, type ApiServices } from '../src/api/routes';

const createEvent = (overrides: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent =>
  ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/v1/health',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '/',
    requestContext: {
      accountId: '123',
      apiId: 'api',
      httpMethod: overrides.httpMethod ?? 'GET',
      identity: {} as never,
      path: overrides.path ?? '/v1/health',
      protocol: 'HTTP/1.1',
      requestId: 'req-1',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource',
      resourcePath: overrides.path ?? '/v1/health',
      stage: 'prod'
    },
    ...overrides
  }) as APIGatewayProxyEvent;

describe('routeRequest', () => {
  const services = {
    dataProductService: {
      createDataProduct: jest.fn().mockResolvedValue({ dataProductId: 'dp-1' }),
      listDataProducts: jest.fn(),
      getDataProduct: jest.fn()
    },
    transferIntentService: {
      createTransferIntent: jest.fn(),
      listTransferIntents: jest.fn(),
      getTransferIntent: jest.fn(),
      submitTransferIntent: jest.fn(),
      cancelTransferIntent: jest.fn()
    },
    uploadUrlService: {
      generateUploadUrls: jest.fn()
    },
    validationService: {
      validateTransferIntent: jest.fn(),
      getValidationResult: jest.fn()
    },
    transferEventService: {
      listEvents: jest.fn()
    },
    metricsService: {
      getMetrics: jest.fn()
    },
    dashboardService: {
      getDashboard: jest.fn()
    }
  } as unknown as ApiServices;

  it('returns health without authorizer context', async () => {
    const response = await routeRequest(createEvent({}), services);
    const parsed = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(parsed.data.status).toBe('ok');
  });

  it('requires authorizer context for protected routes', async () => {
    const response = await routeRequest(
      createEvent({
        httpMethod: 'GET',
        path: '/v1/metrics'
      }),
      services
    );

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 201 for data product creation', async () => {
    const response = await routeRequest(
      createEvent({
        httpMethod: 'POST',
        path: '/v1/data-products',
        body: JSON.stringify({
          name: 'Orders Feed',
          description: 'Daily order extracts',
          owner: 'Data Platform',
          environment: 'dev',
          expectedFiles: [{ fileName: 'orders.csv' }]
        }),
        requestContext: {
          accountId: '123',
          apiId: 'api',
          httpMethod: 'POST',
          identity: {} as never,
          path: '/v1/data-products',
          protocol: 'HTTP/1.1',
          requestId: 'req-3',
          requestTimeEpoch: Date.now(),
          resourceId: 'resource',
          resourcePath: '/v1/data-products',
          stage: 'prod',
          authorizer: {
            principalId: 'customer-a',
            producer: 'customer-a',
            apiKeyOwner: 'customer-a'
          }
        } as never
      }),
      services
    );

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body).data.dataProductId).toBe('dp-1');
  });
});
