import type { ValidationRule } from '../models/dataProduct';
import type { TransferIntent } from '../models/transferIntent';
import type { FileValidationResult, ValidationResult } from '../models/validation';
import type { ObjectStorageRepository, S3ObjectInfo } from '../repositories/s3Repository';
import { nowIso } from '../utils/date';
import { HttpError } from '../utils/validation';
import { DataProductService } from './dataProductService';
import { TransferEventService } from './transferEventService';
import { TransferIntentService } from './transferIntentService';

const matchesRule = (
  rule: ValidationRule,
  fileResult: FileValidationResult,
  objectInfo: S3ObjectInfo | undefined
): string[] => {
  const messages: string[] = [];

  if (rule.target && rule.target !== fileResult.fileName) {
    return messages;
  }

  switch (rule.ruleType) {
    case 'contentType':
      if (objectInfo?.contentType !== String(rule.value)) {
        messages.push(
          `Expected content type ${String(rule.value)} but found ${objectInfo?.contentType ?? 'unknown'}`
        );
      }
      break;
    case 'minSizeBytes':
      if (fileResult.sizeBytes < Number(rule.value)) {
        messages.push(`Expected file size >= ${Number(rule.value)} bytes`);
      }
      break;
    case 'maxSizeBytes':
      if (fileResult.sizeBytes > Number(rule.value)) {
        messages.push(`Expected file size <= ${Number(rule.value)} bytes`);
      }
      break;
    case 'fileNameMatches':
      if (!new RegExp(String(rule.value)).test(fileResult.fileName)) {
        messages.push(`File name did not match rule ${String(rule.value)}`);
      }
      break;
    default:
      break;
  }

  return messages;
};

export class ValidationService {
  constructor(
    private readonly storageRepository: ObjectStorageRepository,
    private readonly transferIntentService: TransferIntentService,
    private readonly dataProductService: DataProductService,
    private readonly transferEventService: TransferEventService
  ) {}

  async validateTransferIntent(
    intentId: string,
    authenticatedProducer: string
  ): Promise<ValidationResult> {
    const intent = await this.transferIntentService.getTransferIntent(
      intentId,
      authenticatedProducer
    );

    if (intent.status === 'CANCELLED') {
      throw new HttpError(409, 'CONFLICT', 'Cancelled intents cannot be validated');
    }

    await this.transferIntentService.updateTransferIntentStatus(
      intentId,
      authenticatedProducer,
      'VALIDATING'
    );
    await this.transferEventService.createEvent(
      intent.intentId,
      intent.dataProductId,
      'VALIDATION_STARTED',
      'Validation started'
    );

    const dataProduct = await this.dataProductService.getDataProduct(
      intent.dataProductId,
      authenticatedProducer
    );
    const listedObjects = await this.storageRepository.listObjects(intent.landingPrefix);
    const objectMap = new Map(listedObjects.map((item) => [item.key, item]));

    const fileResults = await Promise.all(
      intent.expectedFiles.map(async (file) => {
        const key = `${intent.landingPrefix}${file.fileName}`;
        const objectInfo = objectMap.get(key) ?? (await this.storageRepository.headObject(key));
        const messages: string[] = [];
        const exists = Boolean(objectInfo);
        const sizeBytes = objectInfo?.sizeBytes ?? 0;

        if (!exists && file.required !== false) {
          messages.push('Expected file was not uploaded');
        }

        if (exists && sizeBytes <= 0) {
          messages.push('File size must be greater than zero');
        }

        if (file.contentType && objectInfo?.contentType && objectInfo.contentType !== file.contentType) {
          messages.push(
            `Expected content type ${file.contentType} but found ${objectInfo.contentType}`
          );
        }

        if (file.minSizeBytes !== undefined && sizeBytes < file.minSizeBytes) {
          messages.push(`Expected file size >= ${file.minSizeBytes} bytes`);
        }

        for (const rule of dataProduct.validationRules) {
          messages.push(
            ...matchesRule(
              rule,
              {
                fileName: file.fileName,
                key,
                exists,
                sizeBytes,
                contentType: objectInfo?.contentType,
                passed: true,
                messages: []
              },
              objectInfo
            )
          );
        }

        return {
          fileName: file.fileName,
          key,
          exists,
          sizeBytes,
          contentType: objectInfo?.contentType,
          passed: messages.length === 0,
          messages
        } satisfies FileValidationResult;
      })
    );

    const allPassed = fileResults.every((fileResult) => fileResult.passed);
    const totalBytes = fileResults.reduce((sum, fileResult) => sum + fileResult.sizeBytes, 0);
    const checkedAt = nowIso();
    const validationResult: ValidationResult = {
      status: allPassed ? 'PASSED' : 'FAILED',
      checkedAt,
      totalFilesExpected: intent.expectedFiles.length,
      totalFilesFound: fileResults.filter((fileResult) => fileResult.exists).length,
      totalBytes,
      fileResults,
      messages: allPassed
        ? ['All expected files were present and passed validation']
        : fileResults.flatMap((fileResult) =>
            fileResult.messages.map((message) => `${fileResult.fileName}: ${message}`)
          )
    };

    const updatedIntent: TransferIntent = {
      ...intent,
      status: allPassed ? 'VALIDATED' : 'FAILED',
      validationResult,
      updatedAt: checkedAt
    };

    await this.transferIntentService.saveTransferIntent(updatedIntent);
    await this.transferEventService.createEvent(
      intent.intentId,
      intent.dataProductId,
      allPassed ? 'VALIDATION_PASSED' : 'VALIDATION_FAILED',
      allPassed ? 'Validation passed' : 'Validation failed',
      {
        status: validationResult.status,
        totalFilesFound: validationResult.totalFilesFound,
        totalFilesExpected: validationResult.totalFilesExpected
      }
    );

    return validationResult;
  }

  async getValidationResult(
    intentId: string,
    authenticatedProducer: string
  ): Promise<ValidationResult | null> {
    const intent = await this.transferIntentService.getTransferIntent(
      intentId,
      authenticatedProducer
    );

    return intent.validationResult ?? null;
  }
}
