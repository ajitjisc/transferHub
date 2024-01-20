import type { MetricsResponse, RankedMetric } from '../models/metrics';
import type { TransferIntent } from '../models/transferIntent';
import type { MetadataRepository } from '../repositories/dynamoRepository';
import { roundTo } from '../utils/validation';

interface TransferIntentRecord extends TransferIntent {
  entityType?: string;
}

const sortRanked = (items: Map<string, number>): RankedMetric[] =>
  [...items.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
    .slice(0, 5);

export class MetricsService {
  constructor(private readonly repository: MetadataRepository) {}

  async getMetrics(producer?: string): Promise<MetricsResponse> {
    const items = await this.repository.scanAll<TransferIntentRecord>();
    const intents = items
      .filter((item) => item.entityType === 'TRANSFER_INTENT')
      .filter((item) => (producer ? item.producer === producer : true));

    const topDataProducts = new Map<string, number>();
    const topProducers = new Map<string, number>();

    for (const intent of intents) {
      topDataProducts.set(
        intent.dataProductId,
        (topDataProducts.get(intent.dataProductId) ?? 0) + 1
      );
      topProducers.set(intent.producer, (topProducers.get(intent.producer) ?? 0) + 1);
    }

    const totalDataTransferredBytes = intents.reduce(
      (sum, intent) => sum + (intent.validationResult?.totalBytes ?? 0),
      0
    );

    return {
      totalTransfers: intents.length,
      successfulTransfers: intents.filter((intent) => intent.status === 'VALIDATED').length,
      failedTransfers: intents.filter((intent) => intent.status === 'FAILED').length,
      cancelledTransfers: intents.filter((intent) => intent.status === 'CANCELLED').length,
      totalDataTransferredGb: roundTo(totalDataTransferredBytes / 1024 / 1024 / 1024, 3),
      topDataProducts: sortRanked(topDataProducts),
      topProducers: sortRanked(topProducers),
      latestFailures: intents
        .filter((intent) => intent.status === 'FAILED')
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 5)
        .map((intent) => ({
          intentId: intent.intentId,
          dataProductId: intent.dataProductId,
          producer: intent.producer,
          message:
            intent.validationResult?.messages[0] ?? 'Transfer failed without a recorded message',
          updatedAt: intent.updatedAt
        }))
    };
  }
}
