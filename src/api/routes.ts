import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { AuthorizerContext } from '../models/auth';
import { errorResponse, successResponse } from './response';
import { HttpError, assertNonEmptyString } from '../utils/validation';
import { createId } from '../utils/id';
import { DashboardService } from '../services/dashboardService';
import { DataProductService } from '../services/dataProductService';
import { MetricsService } from '../services/metricsService';
import { TransferEventService } from '../services/transferEventService';
import { TransferIntentService } from '../services/transferIntentService';
import { UploadUrlService } from '../services/uploadUrlService';
import { ValidationService } from '../services/validationService';

export interface ApiServices {
  dataProductService: DataProductService;
  transferIntentService: TransferIntentService;
  uploadUrlService: UploadUrlService;
  validationService: ValidationService;
  transferEventService: TransferEventService;
  metricsService: MetricsService;
  dashboardService: DashboardService;
}

interface RouteDefinition {
  method: string;
  pattern: RegExp;
  params: string[];
  protected?: boolean;
  handler: (args: {
    event: APIGatewayProxyEvent;
    body: unknown;
    params: Record<string, string>;
    auth?: AuthorizerContext;
    services: ApiServices;
  }) => Promise<unknown>;
  statusCode?: number;
}

const normalizePath = (event: APIGatewayProxyEvent): string => {
  let path = event.path || '/';
  const stagePrefix = event.requestContext.stage
    ? `/${event.requestContext.stage}`
    : undefined;

  if (stagePrefix && path.startsWith(`${stagePrefix}/v1/`)) {
    path = path.slice(stagePrefix.length);
  } else if (stagePrefix && path === stagePrefix) {
    path = '/';
  }

  return path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path;
};

const parseBody = (body: string | null): unknown => {
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Request body must be valid JSON');
  }
};

const getAuthorizerContext = (event: APIGatewayProxyEvent): AuthorizerContext | undefined => {
  const context = event.requestContext.authorizer;
  if (!context) {
    return undefined;
  }

  if (
    typeof context.principalId !== 'string' ||
    typeof context.producer !== 'string' ||
    typeof context.apiKeyOwner !== 'string'
  ) {
    return undefined;
  }

  return {
    principalId: context.principalId,
    producer: context.producer,
    apiKeyOwner: context.apiKeyOwner
  };
};

const routes: RouteDefinition[] = [
  {
    method: 'GET',
    pattern: /^\/v1\/health$/,
    params: [],
    protected: false,
    handler: async () => ({
      status: 'ok',
      service: 'transferhub',
      timestamp: new Date().toISOString()
    })
  },
  {
    method: 'POST',
    pattern: /^\/v1\/data-products$/,
    params: [],
    statusCode: 201,
    handler: async ({ body, auth, services }) =>
      services.dataProductService.createDataProduct(body as never, auth!.producer)
  },
  {
    method: 'GET',
    pattern: /^\/v1\/data-products$/,
    params: [],
    handler: async ({ auth, services }) =>
      services.dataProductService.listDataProducts(auth!.producer)
  },
  {
    method: 'GET',
    pattern: /^\/v1\/data-products\/([^/]+)$/,
    params: ['dataProductId'],
    handler: async ({ params, auth, services }) =>
      services.dataProductService.getDataProduct(params.dataProductId, auth!.producer)
  },
  {
    method: 'POST',
    pattern: /^\/v1\/data-products\/([^/]+)\/transfer-intents$/,
    params: ['dataProductId'],
    statusCode: 201,
    handler: async ({ params, body, auth, services }) =>
      services.transferIntentService.createTransferIntent(
        params.dataProductId,
        body as { environment?: string },
        auth!.producer
      )
  },
  {
    method: 'GET',
    pattern: /^\/v1\/data-products\/([^/]+)\/transfer-intents$/,
    params: ['dataProductId'],
    handler: async ({ params, auth, services }) =>
      services.transferIntentService.listTransferIntents(params.dataProductId, auth!.producer)
  },
  {
    method: 'GET',
    pattern: /^\/v1\/transfer-intents\/([^/]+)$/,
    params: ['intentId'],
    handler: async ({ params, auth, services }) =>
      services.transferIntentService.getTransferIntent(params.intentId, auth!.producer)
  },
  {
    method: 'POST',
    pattern: /^\/v1\/transfer-intents\/([^/]+):generateUploadUrl$/,
    params: ['intentId'],
    handler: async ({ params, auth, services }) =>
      services.uploadUrlService.generateUploadUrls(params.intentId, auth!.producer)
  },
  {
    method: 'POST',
    pattern: /^\/v1\/transfer-intents\/([^/]+):submit$/,
    params: ['intentId'],
    handler: async ({ params, auth, services }) => {
      await services.transferIntentService.submitTransferIntent(params.intentId, auth!.producer);
      const validationResult = await services.validationService.validateTransferIntent(
        params.intentId,
        auth!.producer
      );
      const intent = await services.transferIntentService.getTransferIntent(
        params.intentId,
        auth!.producer
      );

      return {
        intent,
        validationResult
      };
    }
  },
  {
    method: 'POST',
    pattern: /^\/v1\/transfer-intents\/([^/]+):cancel$/,
    params: ['intentId'],
    handler: async ({ params, auth, services }) =>
      services.transferIntentService.cancelTransferIntent(params.intentId, auth!.producer)
  },
  {
    method: 'POST',
    pattern: /^\/v1\/transfer-intents\/([^/]+):validate$/,
    params: ['intentId'],
    handler: async ({ params, auth, services }) =>
      services.validationService.validateTransferIntent(params.intentId, auth!.producer)
  },
  {
    method: 'GET',
    pattern: /^\/v1\/transfer-intents\/([^/]+)\/events$/,
    params: ['intentId'],
    handler: async ({ params, auth, services }) => {
      await services.transferIntentService.getTransferIntent(params.intentId, auth!.producer);
      return services.transferEventService.listEvents(params.intentId);
    }
  },
  {
    method: 'GET',
    pattern: /^\/v1\/transfer-events$/,
    params: [],
    handler: async ({ event, auth, services }) => {
      const intentId = assertNonEmptyString(
        event.queryStringParameters?.intentId,
        'intentId'
      );
      await services.transferIntentService.getTransferIntent(intentId, auth!.producer);
      return services.transferEventService.listEvents(intentId);
    }
  },
  {
    method: 'GET',
    pattern: /^\/v1\/transfer-intents\/([^/]+)\/validation$/,
    params: ['intentId'],
    handler: async ({ params, auth, services }) =>
      services.validationService.getValidationResult(params.intentId, auth!.producer)
  },
  {
    method: 'GET',
    pattern: /^\/v1\/metrics$/,
    params: [],
    handler: async ({ auth, services }) => services.metricsService.getMetrics(auth!.producer)
  },
  {
    method: 'GET',
    pattern: /^\/v1\/dashboard$/,
    params: [],
    handler: async ({ auth, services }) => services.dashboardService.getDashboard(auth!.producer)
  }
];

export const routeRequest = async (
  event: APIGatewayProxyEvent,
  services: ApiServices
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext.requestId ?? createId('req');

  try {
    const path = normalizePath(event);
    const route = routes.find(
      (candidate) =>
        candidate.method === event.httpMethod && candidate.pattern.test(path)
    );

    if (!route) {
      throw new HttpError(404, 'NOT_FOUND', `No route found for ${event.httpMethod} ${path}`);
    }

    const match = path.match(route.pattern);
    const params = route.params.reduce<Record<string, string>>((accumulator, key, index) => {
      accumulator[key] = match?.[index + 1] ?? '';
      return accumulator;
    }, {});
    const auth = getAuthorizerContext(event);

    if (route.protected !== false) {
      if (!auth) {
        throw new HttpError(401, 'UNAUTHORIZED', 'Missing authorizer context');
      }
    }

    const data = await route.handler({
      event,
      body: parseBody(event.body),
      params,
      auth,
      services
    });

    return successResponse(data, requestId, route.statusCode ?? 200);
  } catch (error) {
    const typedError = error as HttpError;
    if (typedError instanceof HttpError) {
      return errorResponse(
        typedError.code,
        typedError.message,
        requestId,
        typedError.statusCode
      );
    }

    return errorResponse(
      'INTERNAL_SERVER_ERROR',
      (error as Error).message || 'Unexpected error',
      requestId,
      500
    );
  }
};
