import { DataProductService } from '../src/services/dataProductService';
import { InMemoryMetadataRepository } from './testSupport';

describe('DataProductService', () => {
  it('creates a data product with a derived landing prefix', async () => {
    const repository = new InMemoryMetadataRepository();
    const service = new DataProductService(repository);

    const dataProduct = await service.createDataProduct(
      {
        name: 'Orders Feed',
        description: 'Daily order extracts',
        owner: 'Data Platform',
        environment: 'dev',
        expectedFiles: [
          {
            fileName: 'orders.csv',
            contentType: 'text/csv',
            minSizeBytes: 1
          }
        ],
        validationRules: [
          {
            ruleType: 'contentType',
            target: 'orders.csv',
            value: 'text/csv'
          }
        ]
      },
      'customer-a'
    );

    expect(dataProduct.dataProductId).toMatch(/^dp_/);
    expect(dataProduct.landingBasePrefix).toBe(
      `landing/customer-a/${dataProduct.dataProductId}/dev/`
    );
    expect(dataProduct.expectedFiles).toHaveLength(1);
  });

  it('lists products only for the authenticated producer', async () => {
    const repository = new InMemoryMetadataRepository();
    const service = new DataProductService(repository);

    await service.createDataProduct(
      {
        name: 'Orders Feed',
        description: 'Daily order extracts',
        owner: 'Data Platform',
        environment: 'dev',
        expectedFiles: [{ fileName: 'orders.csv' }]
      },
      'customer-a'
    );
    await service.createDataProduct(
      {
        name: 'Invoices Feed',
        description: 'Invoice extracts',
        owner: 'Finance',
        environment: 'dev',
        expectedFiles: [{ fileName: 'invoices.csv' }]
      },
      'customer-b'
    );

    const products = await service.listDataProducts('customer-a');
    expect(products).toHaveLength(1);
    expect(products[0].producer).toBe('customer-a');
  });
});
