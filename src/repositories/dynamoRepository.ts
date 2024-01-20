import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand
} from '@aws-sdk/lib-dynamodb';

export interface MetadataRepository {
  putItem(item: object): Promise<void>;
  getItem<T>(pk: string, sk: string): Promise<T | undefined>;
  queryByPk<T>(pk: string, beginsWithSk?: string): Promise<T[]>;
  queryByStatus<T>(status: string): Promise<T[]>;
  scanAll<T>(): Promise<T[]>;
}

export class DynamoRepository implements MetadataRepository {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoDBDocumentClient
  ) {}

  async putItem(item: object): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item
      })
    );
  }

  async getItem<T>(pk: string, sk: string): Promise<T | undefined> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: pk,
          SK: sk
        }
      })
    );

    return response.Item as T | undefined;
  }

  async queryByPk<T>(pk: string, beginsWithSk?: string): Promise<T[]> {
    const expressionAttributeValues: Record<string, unknown> = {
      ':pk': pk
    };

    const params = beginsWithSk
      ? {
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ...expressionAttributeValues,
            ':sk': beginsWithSk
          }
        }
      : {
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: expressionAttributeValues
        };

    const response = await this.client.send(new QueryCommand(params));
    return (response.Items ?? []) as T[];
  }

  async queryByStatus<T>(status: string): Promise<T[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `STATUS#${status}`
        }
      })
    );

    return (response.Items ?? []) as T[];
  }

  async scanAll<T>(): Promise<T[]> {
    const items: T[] = [];
    let exclusiveStartKey: Record<string, unknown> | undefined;

    do {
      const response = await this.client.send(
        new ScanCommand({
          TableName: this.tableName,
          ExclusiveStartKey: exclusiveStartKey
        })
      );

      items.push(...((response.Items ?? []) as T[]));
      exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (exclusiveStartKey);

    return items;
  }
}
