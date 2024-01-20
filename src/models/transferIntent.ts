import type { ExpectedFileDefinition } from './dataProduct';
import type { ValidationResult } from './validation';

export type TransferStatus =
  | 'AWAITING_UPLOAD'
  | 'UPLOADED'
  | 'SUBMITTED'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'FAILED'
  | 'CANCELLED';

export interface TransferIntent {
  intentId: string;
  dataProductId: string;
  producer: string;
  environment: string;
  expectedFiles: ExpectedFileDefinition[];
  landingPrefix: string;
  status: TransferStatus;
  validationResult?: ValidationResult;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  cancelledAt?: string;
}

export interface CreateTransferIntentInput {
  environment?: string;
}
