import type { DashboardResponse } from '../models/metrics';
import type { TransferIntent } from '../models/transferIntent';
import type { MetadataRepository } from '../repositories/dynamoRepository';
import { dayKey } from '../utils/date';
import { roundTo } from '../utils/validation';
import { TransferEventService } from './transferEventService';
import { TransferIntentService } from './transferIntentService';

interface TransferIntentRecord extends TransferIntent {
  entityType?: string;
}

export class DashboardService {
  constructor(
    private readonly repository: MetadataRepository,
    private readonly transferIntentService: TransferIntentService,
    private readonly transferEventService: TransferEventService
  ) {}

  async getDashboard(producer?: string): Promise<DashboardResponse> {
    const items = await this.repository.scanAll<TransferIntentRecord>();
    const intents = items
      .filter((item) => item.entityType === 'TRANSFER_INTENT')
      .filter((item) => (producer ? item.producer === producer : true));
    const today = dayKey(new Date().toISOString());
    const ownedIntentIds = producer
      ? await this.transferIntentService.listOwnedIntentIds(producer)
      : new Set(intents.map((intent) => intent.intentId));

    const dataTransferredTodayBytes = intents
      .filter((intent) => dayKey(intent.updatedAt) === today)
      .reduce((sum, intent) => sum + (intent.validationResult?.totalBytes ?? 0), 0);

    return {
      activeTransfers: intents.filter((intent) =>
        ['AWAITING_UPLOAD', 'UPLOADED', 'SUBMITTED', 'VALIDATING'].includes(intent.status)
      ).length,
      transfersToday: intents.filter((intent) => dayKey(intent.createdAt) === today).length,
      failuresToday: intents.filter(
        (intent) => intent.status === 'FAILED' && dayKey(intent.updatedAt) === today
      ).length,
      dataTransferredTodayGb: roundTo(
        dataTransferredTodayBytes / 1024 / 1024 / 1024,
        3
      ),
      recentEvents: await this.transferEventService.listRecentEvents(producer, 10, ownedIntentIds),
      latestValidatedTransfers: intents
        .filter((intent) => intent.status === 'VALIDATED')
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 5)
    };
  }
}
