import {
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface S3ObjectInfo {
  key: string;
  sizeBytes: number;
  contentType?: string;
}

export interface ObjectStorageRepository {
  createPresignedPutUrl(key: string, contentType?: string): Promise<string>;
  listObjects(prefix: string): Promise<S3ObjectInfo[]>;
  headObject(key: string): Promise<S3ObjectInfo | undefined>;
}

export class S3Repository implements ObjectStorageRepository {
  constructor(
    private readonly bucketName: string,
    private readonly client: S3Client,
    private readonly uploadUrlExpirySeconds: number
  ) {}

  async createPresignedPutUrl(key: string, contentType?: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ...(contentType ? { ContentType: contentType } : {})
    });

    return getSignedUrl(this.client, command, {
      expiresIn: this.uploadUrlExpirySeconds
    });
  }

  async listObjects(prefix: string): Promise<S3ObjectInfo[]> {
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix
      })
    );

    return (response.Contents ?? []).map((item) => ({
      key: item.Key ?? '',
      sizeBytes: item.Size ?? 0
    }));
  }

  async headObject(key: string): Promise<S3ObjectInfo | undefined> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key
        })
      );

      return {
        key,
        sizeBytes: response.ContentLength ?? 0,
        contentType: response.ContentType
      };
    } catch (error) {
      const typedError = error as { $metadata?: { httpStatusCode?: number } };
      if (typedError.$metadata?.httpStatusCode === 404) {
        return undefined;
      }

      throw error;
    }
  }
}
