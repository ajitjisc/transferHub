import type { ObjectStorageRepository } from '../repositories/s3Repository';
import { TransferEventService } from './transferEventService';
import { TransferIntentService } from './transferIntentService';

export class UploadUrlService {
  constructor(
    private readonly storageRepository: ObjectStorageRepository,
    private readonly transferIntentService: TransferIntentService,
    private readonly transferEventService: TransferEventService,
    private readonly uploadUrlExpirySeconds: number
  ) {}

  async generateUploadUrls(intentId: string, authenticatedProducer: string): Promise<{
    intentId: string;
    expiresInSeconds: number;
    uploadUrls: Array<{
      fileName: string;
      key: string;
      contentType?: string;
      uploadUrl: string;
    }>;
  }> {
    const intent = await this.transferIntentService.getTransferIntent(
      intentId,
      authenticatedProducer
    );

    const uploadUrls = await Promise.all(
      intent.expectedFiles.map(async (file) => {
        const key = `${intent.landingPrefix}${file.fileName}`;
        const uploadUrl = await this.storageRepository.createPresignedPutUrl(
          key,
          file.contentType
        );

        return {
          fileName: file.fileName,
          key,
          contentType: file.contentType,
          uploadUrl
        };
      })
    );

    await this.transferEventService.createEvent(
      intent.intentId,
      intent.dataProductId,
      'UPLOAD_URL_GENERATED',
      'Pre-signed upload URLs generated',
      {
        uploadCount: uploadUrls.length
      }
    );

    return {
      intentId: intent.intentId,
      expiresInSeconds: this.uploadUrlExpirySeconds,
      uploadUrls
    };
  }
}
