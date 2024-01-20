export type TransferEventType =
  | 'INTENT_CREATED'
  | 'UPLOAD_URL_GENERATED'
  | 'INTENT_SUBMITTED'
  | 'INTENT_CANCELLED'
  | 'VALIDATION_STARTED'
  | 'VALIDATION_PASSED'
  | 'VALIDATION_FAILED';

export interface TransferEvent {
  eventId: string;
  intentId: string;
  dataProductId: string;
  eventType: TransferEventType;
  message: string;
  details?: Record<string, unknown>;
  createdAt: string;
}
