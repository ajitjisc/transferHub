import type { TransferEvent, TransferEventType } from '../models/transferEvent';
import type { MetadataRepository } from '../repositories/dynamoRepository';
import { nowIso } from '../utils/date';
import { createId } from '../utils/id';
import { HttpError } from '../utils/validation';

interface TransferEventRecord extends TransferEvent {
  PK: string;
  SK: string;
  entityType: 'TRANSFER_EVENT';
}

const TRANSFER_EVENT_ENTITY = 'TRANSFER_EVENT';

const toRecord = (event: TransferEvent): TransferEventRecord => ({
  PK: `INTENT#${event.intentId}`,
  SK: `EVENT#${event.createdAt}#${event.eventId}`,
  entityType: TRANSFER_EVENT_ENTITY,
  ...event
});

const fromRecord = (record: TransferEventRecord): TransferEvent => {
  const { PK, SK, entityType, ...event } = record;
  return event;
};

export class TransferEventService {
  constructor(private readonly repository: MetadataRepository) {}

  async createEvent(
    intentId: string,
    dataProductId: string,
    eventType: TransferEventType,
    message: string,
    details?: Record<string, unknown>
  ): Promise<TransferEvent> {
    const event: TransferEvent = {
      eventId: createId('evt'),
      intentId,
      dataProductId,
      eventType,
      message,
      details,
      createdAt: nowIso()
    };

    await this.repository.putItem(toRecord(event));
    return event;
  }

  async listEvents(intentId: string): Promise<TransferEvent[]> {
    const records = await this.repository.queryByPk<TransferEventRecord>(
      `INTENT#${intentId}`,
      'EVENT#'
    );

    return records
      .filter((record) => record.entityType === TRANSFER_EVENT_ENTITY)
      .map(fromRecord)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async listRecentEvents(
    producer?: string,
    limit = 10,
    ownedIntentIds?: Set<string>
  ): Promise<TransferEvent[]> {
    const records = await this.repository.scanAll<TransferEventRecord>();

    return records
      .filter((record) => record.entityType === TRANSFER_EVENT_ENTITY)
      .map(fromRecord)
      .filter((event) => (producer && ownedIntentIds ? ownedIntentIds.has(event.intentId) : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async requireEventAccess(intentId: string, ownedIntentIds: Set<string>): Promise<void> {
    if (!ownedIntentIds.has(intentId)) {
      throw new HttpError(403, 'FORBIDDEN', 'Producer is not allowed to access these events');
    }
  }
}
