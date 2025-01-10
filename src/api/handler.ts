import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getConfig } from '../config';
import { DynamoRepository } from '../repositories/dynamoRepository';
import { S3Repository } from '../repositories/s3Repository';
import { DashboardService } from '../services/dashboardService';
import { DataProductService } from '../services/dataProductService';
import { MetricsService } from '../services/metricsService';
import { TransferEventService } from '../services/transferEventService';
import { TransferIntentService } from '../services/transferIntentService';
import { UploadUrlService } from '../services/uploadUrlService';
import { ValidationService } from '../services/validationService';
import { routeRequest, type ApiServices } from './routes';

const buildServices = async (): Promise<ApiServices> => {
  const config = await getConfig();
  const dynamoDocumentClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: config.awsRegion
    }),
    {
      marshallOptions: {
        removeUndefinedValues: true
      }
    }
  );
  const s3Client = new S3Client({
    region: config.awsRegion
  });

  const repository = new DynamoRepository(config.transferTable, dynamoDocumentClient);
  const s3Repository = new S3Repository(
    config.landingBucket,
    s3Client,
    config.uploadUrlExpirySeconds
  );

  const dataProductService = new DataProductService(repository);
  const transferEventService = new TransferEventService(repository);
  const transferIntentService = new TransferIntentService(
    repository,
    dataProductService,
    transferEventService
  );
  const uploadUrlService = new UploadUrlService(
    s3Repository,
    transferIntentService,
    transferEventService,
    config.uploadUrlExpirySeconds
  );
  const validationService = new ValidationService(
    s3Repository,
    transferIntentService,
    dataProductService,
    transferEventService
  );
  const metricsService = new MetricsService(repository);
  const dashboardService = new DashboardService(
    repository,
    transferIntentService,
    transferEventService
  );

  return {
    dataProductService,
    transferIntentService,
    uploadUrlService,
    validationService,
    transferEventService,
    metricsService,
    dashboardService
  };
};

const servicesPromise = buildServices();

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => routeRequest(event, await servicesPromise);

export { buildServices };
