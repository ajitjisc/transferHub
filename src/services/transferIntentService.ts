import type { DataProduct } from '../models/dataProduct';
import type { TransferIntent, TransferStatus } from '../models/transferIntent';
import type { MetadataRepository } from '../repositories/dynamoRepository';
import { nowIso } from '../utils/date';
import { createId } from '../utils/id';
import { HttpError, assertDefined } from '../utils/validation';
import { DataProductService } from './dataProductService';
import { TransferEventService } from './transferEventService';

interface TransferIntentRecord extends TransferIntent {
  PK: string;
  SK: string;
  entityType: 'TRANSFER_INTENT';
  GSI1PK: string;
  GSI1SK: string;
}

const TRANSFER_INTENT_ENTITY = 'TRANSFER_INTENT';

const toRecord = (intent: TransferIntent): TransferIntentRecord => ({
  PK: `INTENT#${intent.intentId}`,
  SK: 'METADATA',
  entityType: TRANSFER_INTENT_ENTITY,
  GSI1PK: `STATUS#${intent.status}`,
  GSI1SK: intent.createdAt,
  ...intent
});

const fromRecord = (record: TransferIntentRecord): TransferIntent => {
  const { PK, SK, entityType, GSI1PK, GSI1SK, ...intent } = record;
  return intent;
};

const cloneDataProductExpectedFiles = (dataProduct: DataProduct) =>
  dataProduct.expectedFiles.map((file) => ({ ...file }));

export class TransferIntentService {
  constructor(
    private readonly repository: MetadataRepository,
    private readonly dataProductService: DataProductService,
    private readonly transferEventService: TransferEventService
  ) {}

  async createTransferIntent(
    dataProductId: string,
    input: { environment?: string },
    authenticatedProducer: string
  ): Promise<{
    intent: TransferIntent;
    links: Record<string, string>;
  }> {
    const dataProduct = await this.dataProductService.getDataProduct(
      dataProductId,
      authenticatedProducer
    );
    const intentId = createId('ti');
    const createdAt = nowIso();
    const environment = input.environment ?? dataProduct.environment;

    const intent: TransferIntent = {
      intentId,
      dataProductId,
      producer: dataProduct.producer,
      environment,
      expectedFiles: cloneDataProductExpectedFiles(dataProduct),
      landingPrefix: `landing/${dataProduct.producer}/${dataProductId}/${environment}/${intentId}/`,
      status: 'AWAITING_UPLOAD',
      createdAt,
      updatedAt: createdAt
    };

    await this.repository.putItem(toRecord(intent));
    await this.transferEventService.createEvent(
      intentId,
      dataProductId,
      'INTENT_CREATED',
      'Transfer intent created',
      {
        landingPrefix: intent.landingPrefix,
        expectedFileCount: intent.expectedFiles.length
      }
    );

    return {
      intent,
      links: {
        self: `/v1/transfer-intents/${intentId}`,
        generateUploadUrl: `/v1/transfer-intents/${intentId}:generateUploadUrl`,
        submit: `/v1/transfer-intents/${intentId}:submit`,
        cancel: `/v1/transfer-intents/${intentId}:cancel`,
        validate: `/v1/transfer-intents/${intentId}:validate`,
        events: `/v1/transfer-intents/${intentId}/events`,
        validation: `/v1/transfer-intents/${intentId}/validation`
      }
    };
  }

  async listTransferIntents(
    dataProductId: string,
    authenticatedProducer: string
  ): Promise<TransferIntent[]> {
    await this.dataProductService.getDataProduct(dataProductId, authenticatedProducer);
    const records = await this.repository.scanAll<TransferIntentRecord>();

    return records
      .filter((record) => record.entityType === TRANSFER_INTENT_ENTITY)
      .map(fromRecord)
      .filter(
        (intent) =>
          intent.dataProductId === dataProductId && intent.producer === authenticatedProducer
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getTransferIntent(
    intentId: string,
    authenticatedProducer: string
  ): Promise<TransferIntent> {
    const record = assertDefined(
      await this.repository.getItem<TransferIntentRecord>(`INTENT#${intentId}`, 'METADATA'),
      404,
      'NOT_FOUND',
      `Transfer intent ${intentId} was not found`
    );

    const intent = fromRecord(record);
    this.ensureProducerAccess(intent, authenticatedProducer);
    return intent;
  }

  async submitTransferIntent(
    intentId: string,
    authenticatedProducer: string
  ): Promise<TransferIntent> {
    const intent = await this.getTransferIntent(intentId, authenticatedProducer);
    if (intent.status === 'CANCELLED') {
      throw new HttpError(409, 'CONFLICT', 'Cancelled intents cannot be submitted');
    }

    const submittedAt = nowIso();
    const updatedIntent: TransferIntent = {
      ...intent,
      status: 'SUBMITTED',
      submittedAt,
      updatedAt: submittedAt
    };

    await this.saveTransferIntent(updatedIntent);
    await this.transferEventService.createEvent(
      intentId,
      intent.dataProductId,
      'INTENT_SUBMITTED',
      'Transfer intent submitted',
      {
        submittedAt
      }
    );

    return updatedIntent;
  }

  async cancelTransferIntent(
    intentId: string,
    authenticatedProducer: string
  ): Promise<TransferIntent> {
    const intent = await this.getTransferIntent(intentId, authenticatedProducer);
    if (intent.status === 'VALIDATED') {
      throw new HttpError(409, 'CONFLICT', 'Validated intents cannot be cancelled');
    }

    const cancelledAt = nowIso();
    const updatedIntent: TransferIntent = {
      ...intent,
      status: 'CANCELLED',
      cancelledAt,
      updatedAt: cancelledAt
    };

    await this.saveTransferIntent(updatedIntent);
    await this.transferEventService.createEvent(
      intentId,
      intent.dataProductId,
      'INTENT_CANCELLED',
      'Transfer intent cancelled',
      {
        cancelledAt
      }
    );

    return updatedIntent;
  }

  async updateTransferIntentStatus(
    intentId: string,
    authenticatedProducer: string,
    status: TransferStatus,
    updates: Partial<TransferIntent> = {}
  ): Promise<TransferIntent> {
    const intent = await this.getTransferIntent(intentId, authenticatedProducer);
    const updatedIntent: TransferIntent = {
      ...intent,
      ...updates,
      status,
      updatedAt: nowIso()
    };

    await this.saveTransferIntent(updatedIntent);
    return updatedIntent;
  }

  async saveTransferIntent(intent: TransferIntent): Promise<void> {
    await this.repository.putItem(toRecord(intent));
  }

  async listOwnedIntentIds(producer: string): Promise<Set<string>> {
    const records = await this.repository.scanAll<TransferIntentRecord>();
    return new Set(
      records
        .filter((record) => record.entityType === TRANSFER_INTENT_ENTITY)
        .map(fromRecord)
        .filter((intent) => intent.producer === producer)
        .map((intent) => intent.intentId)
    );
  }

  private ensureProducerAccess(
    intent: TransferIntent,
    authenticatedProducer: string
  ): void {
    if (intent.producer !== authenticatedProducer) {
      throw new HttpError(403, 'FORBIDDEN', 'Producer is not allowed to access this transfer intent');
    }
  }
}
