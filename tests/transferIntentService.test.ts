import { DataProductService } from '../src/services/dataProductService';
import { TransferEventService } from '../src/services/transferEventService';
import { TransferIntentService } from '../src/services/transferIntentService';
import { InMemoryMetadataRepository } from './testSupport';

describe('TransferIntentService', () => {
  it('creates a transfer intent and audit event for a data product', async () => {
    const repository = new InMemoryMetadataRepository();
    const dataProductService = new DataProductService(repository);
    const transferEventService = new TransferEventService(repository);
    const transferIntentService = new TransferIntentService(
      repository,
      dataProductService,
      transferEventService
    );

    const dataProduct = await dataProductService.createDataProduct(
      {
        name: 'Orders Feed',
        description: 'Daily order extracts',
        owner: 'Data Platform',
        environment: 'test',
        expectedFiles: [{ fileName: 'orders.csv' }]
      },
      'customer-a'
    );

    const result = await transferIntentService.createTransferIntent(
      dataProduct.dataProductId,
      {},
      'customer-a'
    );

    expect(result.intent.status).toBe('AWAITING_UPLOAD');
    expect(result.intent.landingPrefix).toContain(result.intent.intentId);
    expect(result.links.generateUploadUrl).toContain(':generateUploadUrl');

    const events = await transferEventService.listEvents(result.intent.intentId);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('INTENT_CREATED');
  });

  it('submits and cancels intents with state transitions', async () => {
    const repository = new InMemoryMetadataRepository();
    const dataProductService = new DataProductService(repository);
    const transferEventService = new TransferEventService(repository);
    const transferIntentService = new TransferIntentService(
      repository,
      dataProductService,
      transferEventService
    );

    const dataProduct = await dataProductService.createDataProduct(
      {
        name: 'Orders Feed',
        description: 'Daily order extracts',
        owner: 'Data Platform',
        environment: 'test',
        expectedFiles: [{ fileName: 'orders.csv' }]
      },
      'customer-a'
    );

    const { intent } = await transferIntentService.createTransferIntent(
      dataProduct.dataProductId,
      {},
      'customer-a'
    );

    const submitted = await transferIntentService.submitTransferIntent(
      intent.intentId,
      'customer-a'
    );
    expect(submitted.status).toBe('SUBMITTED');

    const cancelled = await transferIntentService.cancelTransferIntent(
      intent.intentId,
      'customer-a'
    );
    expect(cancelled.status).toBe('CANCELLED');
  });
});
