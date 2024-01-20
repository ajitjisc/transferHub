import { DataProductService } from '../src/services/dataProductService';
import { TransferEventService } from '../src/services/transferEventService';
import { TransferIntentService } from '../src/services/transferIntentService';
import { ValidationService } from '../src/services/validationService';
import {
  InMemoryMetadataRepository,
  InMemoryObjectStorageRepository
} from './testSupport';

describe('ValidationService', () => {
  it('passes validation when required files exist and match rules', async () => {
    const metadataRepository = new InMemoryMetadataRepository();
    const objectRepository = new InMemoryObjectStorageRepository();
    const dataProductService = new DataProductService(metadataRepository);
    const transferEventService = new TransferEventService(metadataRepository);
    const transferIntentService = new TransferIntentService(
      metadataRepository,
      dataProductService,
      transferEventService
    );
    const validationService = new ValidationService(
      objectRepository,
      transferIntentService,
      dataProductService,
      transferEventService
    );

    const dataProduct = await dataProductService.createDataProduct(
      {
        name: 'Orders Feed',
        description: 'Daily order extracts',
        owner: 'Data Platform',
        environment: 'dev',
        expectedFiles: [
          {
            fileName: 'orders.csv',
            contentType: 'text/csv',
            minSizeBytes: 10
          }
        ],
        validationRules: [
          {
            ruleType: 'minSizeBytes',
            target: 'orders.csv',
            value: 10
          }
        ]
      },
      'customer-a'
    );
    const { intent } = await transferIntentService.createTransferIntent(
      dataProduct.dataProductId,
      {},
      'customer-a'
    );

    objectRepository.putObject({
      key: `${intent.landingPrefix}orders.csv`,
      sizeBytes: 64,
      contentType: 'text/csv'
    });

    const validationResult = await validationService.validateTransferIntent(
      intent.intentId,
      'customer-a'
    );

    expect(validationResult.status).toBe('PASSED');
    expect(validationResult.totalFilesFound).toBe(1);

    const updatedIntent = await transferIntentService.getTransferIntent(
      intent.intentId,
      'customer-a'
    );
    expect(updatedIntent.status).toBe('VALIDATED');
  });

  it('fails validation when a required file is missing', async () => {
    const metadataRepository = new InMemoryMetadataRepository();
    const objectRepository = new InMemoryObjectStorageRepository();
    const dataProductService = new DataProductService(metadataRepository);
    const transferEventService = new TransferEventService(metadataRepository);
    const transferIntentService = new TransferIntentService(
      metadataRepository,
      dataProductService,
      transferEventService
    );
    const validationService = new ValidationService(
      objectRepository,
      transferIntentService,
      dataProductService,
      transferEventService
    );

    const dataProduct = await dataProductService.createDataProduct(
      {
        name: 'Orders Feed',
        description: 'Daily order extracts',
        owner: 'Data Platform',
        environment: 'dev',
        expectedFiles: [{ fileName: 'orders.csv' }]
      },
      'customer-a'
    );
    const { intent } = await transferIntentService.createTransferIntent(
      dataProduct.dataProductId,
      {},
      'customer-a'
    );

    const validationResult = await validationService.validateTransferIntent(
      intent.intentId,
      'customer-a'
    );

    expect(validationResult.status).toBe('FAILED');
    expect(validationResult.messages[0]).toContain('orders.csv');
  });
});
