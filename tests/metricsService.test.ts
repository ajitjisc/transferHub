import { MetricsService } from '../src/services/metricsService';
import { InMemoryMetadataRepository } from './testSupport';

describe('MetricsService', () => {
  it('aggregates transfer metrics and rankings', async () => {
    const repository = new InMemoryMetadataRepository();
    const createdAt = new Date('2026-06-27T12:00:00.000Z').toISOString();

    await repository.putItem({
      PK: 'INTENT#1',
      SK: 'METADATA',
      entityType: 'TRANSFER_INTENT',
      GSI1PK: 'STATUS#VALIDATED',
      GSI1SK: createdAt,
      intentId: '1',
      dataProductId: 'dp-1',
      producer: 'customer-a',
      environment: 'dev',
      expectedFiles: [],
      landingPrefix: 'landing/customer-a/dp-1/dev/1/',
      status: 'VALIDATED',
      createdAt,
      updatedAt: createdAt,
      validationResult: {
        status: 'PASSED',
        checkedAt: createdAt,
        totalFilesExpected: 1,
        totalFilesFound: 1,
        totalBytes: 1024 * 1024 * 1024,
        fileResults: [],
        messages: []
      }
    });
    await repository.putItem({
      PK: 'INTENT#2',
      SK: 'METADATA',
      entityType: 'TRANSFER_INTENT',
      GSI1PK: 'STATUS#FAILED',
      GSI1SK: createdAt,
      intentId: '2',
      dataProductId: 'dp-2',
      producer: 'customer-a',
      environment: 'dev',
      expectedFiles: [],
      landingPrefix: 'landing/customer-a/dp-2/dev/2/',
      status: 'FAILED',
      createdAt,
      updatedAt: createdAt,
      validationResult: {
        status: 'FAILED',
        checkedAt: createdAt,
        totalFilesExpected: 1,
        totalFilesFound: 0,
        totalBytes: 0,
        fileResults: [],
        messages: ['missing file']
      }
    });

    const service = new MetricsService(repository);
    const metrics = await service.getMetrics('customer-a');

    expect(metrics.totalTransfers).toBe(2);
    expect(metrics.successfulTransfers).toBe(1);
    expect(metrics.failedTransfers).toBe(1);
    expect(metrics.totalDataTransferredGb).toBe(1);
    expect(metrics.topDataProducts[0].key).toBe('dp-1');
    expect(metrics.latestFailures[0].message).toBe('missing file');
  });
});
