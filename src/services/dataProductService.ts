import type {
  CreateDataProductInput,
  DataProduct,
  ExpectedFileDefinition,
  ValidationRule
} from '../models/dataProduct';
import type { MetadataRepository } from '../repositories/dynamoRepository';
import { nowIso } from '../utils/date';
import { createId } from '../utils/id';
import {
  HttpError,
  assertArray,
  assertDefined,
  assertNonEmptyString
} from '../utils/validation';

interface DataProductRecord extends DataProduct {
  PK: string;
  SK: string;
  entityType: 'DATA_PRODUCT';
  GSI1PK: string;
  GSI1SK: string;
}

const DATA_PRODUCT_ENTITY = 'DATA_PRODUCT';

const toRecord = (dataProduct: DataProduct): DataProductRecord => ({
  PK: `DATAPRODUCT#${dataProduct.dataProductId}`,
  SK: 'METADATA',
  entityType: DATA_PRODUCT_ENTITY,
  GSI1PK: `STATUS#${dataProduct.status}`,
  GSI1SK: dataProduct.createdAt,
  ...dataProduct
});

const fromRecord = (record: DataProductRecord): DataProduct => {
  const { PK, SK, entityType, GSI1PK, GSI1SK, ...dataProduct } = record;
  return dataProduct;
};

const normalizeExpectedFiles = (value: unknown): ExpectedFileDefinition[] =>
  assertArray<Record<string, unknown>>(value, 'expectedFiles').map((file, index) => ({
    fileName: assertNonEmptyString(file.fileName, `expectedFiles[${index}].fileName`),
    required: file.required === undefined ? true : Boolean(file.required),
    contentType:
      file.contentType === undefined
        ? undefined
        : assertNonEmptyString(file.contentType, `expectedFiles[${index}].contentType`),
    minSizeBytes:
      file.minSizeBytes === undefined ? undefined : Number(file.minSizeBytes),
    description:
      file.description === undefined
        ? undefined
        : assertNonEmptyString(file.description, `expectedFiles[${index}].description`)
  }));

const normalizeValidationRules = (value: unknown): ValidationRule[] =>
  value === undefined
    ? []
    : assertArray<Record<string, unknown>>(value, 'validationRules').map((rule, index) => ({
        ruleType: assertNonEmptyString(rule.ruleType, `validationRules[${index}].ruleType`) as ValidationRule['ruleType'],
        target:
          rule.target === undefined
            ? undefined
            : assertNonEmptyString(rule.target, `validationRules[${index}].target`),
        value:
          typeof rule.value === 'string' || typeof rule.value === 'number'
            ? rule.value
            : (() => {
                throw new HttpError(
                  400,
                  'VALIDATION_ERROR',
                  `validationRules[${index}].value must be a string or number`
                );
              })()
      }));

export class DataProductService {
  constructor(private readonly repository: MetadataRepository) {}

  async createDataProduct(
    input: CreateDataProductInput,
    authenticatedProducer: string
  ): Promise<DataProduct> {
    const producer = input.producer
      ? assertNonEmptyString(input.producer, 'producer')
      : authenticatedProducer;
    const environment = assertNonEmptyString(input.environment, 'environment');
    const dataProductId = createId('dp');
    const createdAt = nowIso();
    const expectedFiles = normalizeExpectedFiles(input.expectedFiles);

    const dataProduct: DataProduct = {
      dataProductId,
      name: assertNonEmptyString(input.name, 'name'),
      description: assertNonEmptyString(input.description, 'description'),
      owner: assertNonEmptyString(input.owner, 'owner'),
      producer,
      environment,
      expectedFiles,
      validationRules: normalizeValidationRules(input.validationRules),
      landingBasePrefix: `landing/${producer}/${dataProductId}/${environment}/`,
      status: input.status ?? 'ACTIVE',
      createdAt,
      updatedAt: createdAt
    };

    await this.repository.putItem(toRecord(dataProduct));
    return dataProduct;
  }

  async listDataProducts(producer?: string): Promise<DataProduct[]> {
    const records = await this.repository.scanAll<DataProductRecord>();
    return records
      .filter((record) => record.entityType === DATA_PRODUCT_ENTITY)
      .map(fromRecord)
      .filter((record) => (producer ? record.producer === producer : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getDataProduct(
    dataProductId: string,
    producer?: string
  ): Promise<DataProduct> {
    const record = assertDefined(
      await this.repository.getItem<DataProductRecord>(
        `DATAPRODUCT#${dataProductId}`,
        'METADATA'
      ),
      404,
      'NOT_FOUND',
      `Data product ${dataProductId} was not found`
    );

    const dataProduct = fromRecord(record);
    if (producer && dataProduct.producer !== producer) {
      throw new HttpError(403, 'FORBIDDEN', 'Producer is not allowed to access this data product');
    }

    return dataProduct;
  }
}
