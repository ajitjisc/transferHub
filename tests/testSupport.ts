import type { MetadataRepository } from '../src/repositories/dynamoRepository';
import type {
  ObjectStorageRepository,
  S3ObjectInfo
} from '../src/repositories/s3Repository';

export class InMemoryMetadataRepository implements MetadataRepository {
  public readonly items: Array<Record<string, unknown>> = [];

  async putItem(item: object): Promise<void> {
    const typedItem = item as Record<string, unknown>;
    const existingIndex = this.items.findIndex(
      (candidate) => candidate.PK === typedItem.PK && candidate.SK === typedItem.SK
    );

    if (existingIndex >= 0) {
      this.items[existingIndex] = { ...typedItem };
      return;
    }

    this.items.push({ ...typedItem });
  }

  async getItem<T>(pk: string, sk: string): Promise<T | undefined> {
    return this.items.find((item) => item.PK === pk && item.SK === sk) as T | undefined;
  }

  async queryByPk<T>(pk: string, beginsWithSk?: string): Promise<T[]> {
    return this.items.filter(
      (item) =>
        item.PK === pk &&
        (beginsWithSk ? String(item.SK).startsWith(beginsWithSk) : true)
    ) as T[];
  }

  async queryByStatus<T>(status: string): Promise<T[]> {
    return this.items.filter((item) => item.GSI1PK === `STATUS#${status}`) as T[];
  }

  async scanAll<T>(): Promise<T[]> {
    return this.items as T[];
  }
}

export class InMemoryObjectStorageRepository implements ObjectStorageRepository {
  constructor(private readonly objects: Map<string, S3ObjectInfo> = new Map()) {}

  async createPresignedPutUrl(key: string): Promise<string> {
    return `https://example.test/upload/${encodeURIComponent(key)}`;
  }

  async listObjects(prefix: string): Promise<S3ObjectInfo[]> {
    return [...this.objects.values()].filter((item) => item.key.startsWith(prefix));
  }

  async headObject(key: string): Promise<S3ObjectInfo | undefined> {
    return this.objects.get(key);
  }

  putObject(object: S3ObjectInfo): void {
    this.objects.set(object.key, object);
  }
}
