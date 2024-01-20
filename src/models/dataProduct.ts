export type DataProductStatus = 'ACTIVE' | 'INACTIVE';

export interface ExpectedFileDefinition {
  fileName: string;
  required?: boolean;
  contentType?: string;
  minSizeBytes?: number;
  description?: string;
}

export type ValidationRuleType =
  | 'contentType'
  | 'minSizeBytes'
  | 'maxSizeBytes'
  | 'fileNameMatches';

export interface ValidationRule {
  ruleType: ValidationRuleType;
  target?: string;
  value: string | number;
}

export interface DataProduct {
  dataProductId: string;
  name: string;
  description: string;
  owner: string;
  producer: string;
  environment: string;
  expectedFiles: ExpectedFileDefinition[];
  validationRules: ValidationRule[];
  landingBasePrefix: string;
  status: DataProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDataProductInput {
  name: string;
  description: string;
  owner: string;
  producer?: string;
  environment: string;
  expectedFiles: ExpectedFileDefinition[];
  validationRules?: ValidationRule[];
  status?: DataProductStatus;
}
