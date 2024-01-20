import type { TransferEvent } from './transferEvent';
import type { TransferIntent } from './transferIntent';

export interface RankedMetric {
  key: string;
  count: number;
}

export interface LatestFailure {
  intentId: string;
  dataProductId: string;
  producer: string;
  message: string;
  updatedAt: string;
}

export interface MetricsResponse {
  totalTransfers: number;
  successfulTransfers: number;
  failedTransfers: number;
  cancelledTransfers: number;
  totalDataTransferredGb: number;
  topDataProducts: RankedMetric[];
  topProducers: RankedMetric[];
  latestFailures: LatestFailure[];
}

export interface DashboardResponse {
  activeTransfers: number;
  transfersToday: number;
  failuresToday: number;
  dataTransferredTodayGb: number;
  recentEvents: TransferEvent[];
  latestValidatedTransfers: TransferIntent[];
}
