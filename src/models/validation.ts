export interface FileValidationResult {
  fileName: string;
  key: string;
  exists: boolean;
  sizeBytes: number;
  contentType?: string;
  passed: boolean;
  messages: string[];
}

export interface ValidationResult {
  status: 'PASSED' | 'FAILED';
  checkedAt: string;
  totalFilesExpected: number;
  totalFilesFound: number;
  totalBytes: number;
  fileResults: FileValidationResult[];
  messages: string[];
}
