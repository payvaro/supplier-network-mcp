import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleImports } from '../imports.js';
import { createMockNetworkAPIClient, type MockNetworkAPIClient } from '../../__mocks__/api-client.mock.js';
import type { FileImportJob, DataValidationResult } from '../../types.js';

// Mock the api-client module
vi.mock('../../services/api-client.js', () => ({
  getNetworkAPIClient: vi.fn(),
}));

// Mock the data-validator module
vi.mock('../../services/data-validator.js', () => ({
  validateImportData: vi.fn(),
}));

import { getNetworkAPIClient } from '../../services/api-client.js';
import { validateImportData } from '../../services/data-validator.js';

const createFileImportJob = (overrides: Partial<FileImportJob> = {}): FileImportJob => ({
  id: 'job-1',
  clientId: 'client-1',
  sourceFilename: 'data.csv',
  status: 'COMPLETED',
  createdEntityCount: 10,
  entityTypeSummaries: {},
  fileProcessingRecordIds: [],
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const createDataValidationResult = (overrides: Partial<DataValidationResult> = {}): DataValidationResult => ({
  generatedAt: '2024-01-01T00:00:00Z',
  summary: {
    totalSuppliersScanned: 5,
    suppliersWithIssues: 0,
    totalIssues: 0,
    issuesBySeverity: { error: 0, warning: 0, info: 0 },
    issuesByField: {},
    issuesByRule: {},
  },
  suppliers: [],
  recommendations: [],
  ...overrides,
});

describe('handleImports', () => {
  let mockClient: MockNetworkAPIClient;

  beforeEach(() => {
    mockClient = createMockNetworkAPIClient();
    vi.mocked(getNetworkAPIClient).mockReturnValue(mockClient as never);
  });

  it('dispatches upload action', async () => {
    mockClient.uploadFile.mockResolvedValue({ status: 'success', fileId: 'f-1' });

    const result = await handleImports({ action: 'upload', filePath: '/path/to/data.csv', limit: 20 });

    expect(mockClient.uploadFile).toHaveBeenCalledWith('/path/to/data.csv', undefined);
    expect(result.content[0].text).toContain('File Upload Successful');
  });

  it('dispatches batches action', async () => {
    const jobs = [createFileImportJob()];
    mockClient.listFileImportJobs.mockResolvedValue(jobs);

    const result = await handleImports({ action: 'batches', limit: 20 });

    expect(mockClient.listFileImportJobs).toHaveBeenCalledWith(20);
    expect(result.content[0].text).toContain('File Import Batches');
  });

  it('dispatches validate action', async () => {
    const validationResult = createDataValidationResult();
    vi.mocked(validateImportData).mockResolvedValue(validationResult);

    const result = await handleImports({ action: 'validate', limit: 20 });

    expect(validateImportData).toHaveBeenCalled();
    expect(result.content[0].text).toContain('Data Validation Report');
  });

  it('passes dateRange and buyerId to validate', async () => {
    const validationResult = createDataValidationResult();
    vi.mocked(validateImportData).mockResolvedValue(validationResult);

    await handleImports({
      action: 'validate',
      limit: 20,
      dateRange: { from: '20260101', to: '20260131' },
      buyerId: 'buyer-1',
    });

    expect(validateImportData).toHaveBeenCalledWith(
      expect.anything(),
      { from: '20260101', to: '20260131' },
      'buyer-1'
    );
  });

  it('wraps errors with createActionableError', async () => {
    mockClient.uploadFile.mockRejectedValue(new Error('Request failed with status code 404'));

    const result = await handleImports({ action: 'upload', filePath: '/missing.csv', limit: 20 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ Error:');
  });
});
