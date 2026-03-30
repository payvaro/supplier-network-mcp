import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchSuppliers,
  listSuppliers,
  getSupplier,
  getSuppliersByDate,
  getSupplierHistory,
  uploadFile,
  handleSuppliers,
} from '../suppliers.js';
import { createMockNetworkAPIClient, type MockNetworkAPIClient } from '../../__mocks__/api-client.mock.js';
import { createSupplier, createAddress } from '../../test-utils/fixtures.js';
import { ResponseFormat, HistoryFormat } from '../../constants.js';

// Mock the api-client module
vi.mock('../../services/api-client.js', () => ({
  getNetworkAPIClient: vi.fn(),
}));

import { getNetworkAPIClient } from '../../services/api-client.js';

describe('supplier tools', () => {
  let mockClient: MockNetworkAPIClient;

  beforeEach(() => {
    mockClient = createMockNetworkAPIClient();
    vi.mocked(getNetworkAPIClient).mockReturnValue(mockClient as never);
  });

  describe('searchSuppliers', () => {
    it('returns matches for name search', async () => {
      const suppliers = [
        createSupplier({ id: 's1', name: 'Acme Corporation' }),
        createSupplier({ id: 's2', name: 'Beta Corp' }),
      ];
      mockClient.getAllSuppliers.mockResolvedValue(suppliers);

      const result = await searchSuppliers({
        name: 'Acme',
        minMatchScore: 0.4,
        maxResults: 10,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Acme');
      expect(result.structuredContent).toBeDefined();
    });

    it('returns no matches message when nothing found', async () => {
      mockClient.getAllSuppliers.mockResolvedValue([]);

      const result = await searchSuppliers({
        name: 'Nonexistent',
        minMatchScore: 0.4,
        maxResults: 10,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('No supplier matches found');
    });

    it('limits results to maxResults', async () => {
      const suppliers = Array.from({ length: 20 }, (_, i) =>
        createSupplier({ id: `s${i}`, name: `Supplier ${i}` })
      );
      mockClient.getAllSuppliers.mockResolvedValue(suppliers);

      const result = await searchSuppliers({
        name: 'Supplier',
        minMatchScore: 0.1,
        maxResults: 5,
        response_format: ResponseFormat.JSON,
      });

      expect(result.structuredContent?.matches.length).toBeLessThanOrEqual(5);
    });

    it('searches by email', async () => {
      const suppliers = [
        createSupplier({ id: 's1', name: 'Company A', email: 'info@company-a.com' }),
        createSupplier({ id: 's2', name: 'Company B', email: 'contact@company-b.com' }),
      ];
      mockClient.getAllSuppliers.mockResolvedValue(suppliers);

      const result = await searchSuppliers({
        email: 'info@company-a.com',
        minMatchScore: 0.4,
        maxResults: 10,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.structuredContent).toBeDefined();
      expect(mockClient.getAllSuppliers).toHaveBeenCalled();
    });

    it('searches by address', async () => {
      const suppliers = [
        createSupplier({
          id: 's1',
          name: 'Chicago Store',
          address: createAddress({ city: 'Chicago', stateProvince: 'IL' }),
        }),
      ];
      mockClient.getAllSuppliers.mockResolvedValue(suppliers);

      const result = await searchSuppliers({
        address: { city: 'Chicago' },
        minMatchScore: 0.4,
        maxResults: 10,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(mockClient.getAllSuppliers).toHaveBeenCalled();
    });

    it('handles API errors gracefully', async () => {
      mockClient.getAllSuppliers.mockRejectedValue(new Error('API connection failed'));

      const result = await searchSuppliers({
        name: 'Test',
        minMatchScore: 0.4,
        maxResults: 10,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('API connection failed');
    });

    it('returns JSON format when specified', async () => {
      const suppliers = [createSupplier({ name: 'Test Corp' })];
      mockClient.getAllSuppliers.mockResolvedValue(suppliers);

      const result = await searchSuppliers({
        name: 'Test',
        minMatchScore: 0.4,
        maxResults: 10,
        response_format: ResponseFormat.JSON,
      });

      // JSON format returns stringified data
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });
  });

  describe('listSuppliers', () => {
    it('returns formatted list of suppliers', async () => {
      const suppliers = [
        createSupplier({ name: 'Supplier A' }),
        createSupplier({ name: 'Supplier B' }),
      ];
      mockClient.listSuppliers.mockResolvedValue({
        items: suppliers,
        pagination: { count: 2, pageSize: 20, hasMore: false, nextCursor: null }
      });

      const result = await listSuppliers({
        pageSize: 20,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Supplier');
      expect(result.structuredContent?.count).toBe(2);
    });

    it('passes pagination parameters', async () => {
      mockClient.listSuppliers.mockResolvedValue({
        items: [],
        pagination: { count: 0, pageSize: 50, hasMore: false, nextCursor: null }
      });

      await listSuppliers({
        pageSize: 50,
        cursor: 'cursor123',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(mockClient.listSuppliers).toHaveBeenCalledWith(50, 'cursor123');
    });

    it('returns empty list gracefully', async () => {
      mockClient.listSuppliers.mockResolvedValue({
        items: [],
        pagination: { count: 0, pageSize: 20, hasMore: false, nextCursor: null }
      });

      const result = await listSuppliers({
        pageSize: 20,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.structuredContent?.count).toBe(0);
      expect(result.content[0].text).toContain('0 supplier(s)');
    });

    it('handles API errors', async () => {
      mockClient.listSuppliers.mockRejectedValue(new Error('Network error'));

      const result = await listSuppliers({
        pageSize: 20,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Network error');
    });
  });

  describe('getSupplier', () => {
    it('returns supplier details', async () => {
      const supplier = createSupplier({
        id: 'supplier-123',
        name: 'Test Supplier',
        email: 'test@supplier.com',
      });
      mockClient.getSupplier.mockResolvedValue(supplier);

      const result = await getSupplier({
        id: 'supplier-123',
        includeLinks: false,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Test Supplier');
      expect(result.structuredContent).toEqual(supplier);
    });

    it('includes links when requested', async () => {
      const supplier = createSupplier({ id: 'supplier-123' });
      mockClient.getSupplier.mockResolvedValue(supplier);

      await getSupplier({
        id: 'supplier-123',
        includeLinks: true,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(mockClient.getSupplier).toHaveBeenCalledWith('supplier-123', true);
    });

    it('handles not found error', async () => {
      mockClient.getSupplier.mockRejectedValue(new Error('Resource not found.'));

      const result = await getSupplier({
        id: 'nonexistent',
        includeLinks: false,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    it('returns JSON format when specified', async () => {
      const supplier = createSupplier({ name: 'JSON Test' });
      mockClient.getSupplier.mockResolvedValue(supplier);

      const result = await getSupplier({
        id: 'supplier-123',
        includeLinks: false,
        response_format: ResponseFormat.JSON,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.name).toBe('JSON Test');
    });
  });

  describe('getSuppliersByDate', () => {
    it('returns suppliers updated on date', async () => {
      const suppliers = [
        createSupplier({ name: 'Updated Supplier', updatedAt: '2024-01-15T10:00:00Z' }),
      ];
      mockClient.getSuppliersByDate.mockResolvedValue(suppliers);

      const result = await getSuppliersByDate({
        date: '20240115',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('20240115');
      expect(result.structuredContent?.count).toBe(1);
    });

    it('returns empty list when no updates', async () => {
      mockClient.getSuppliersByDate.mockResolvedValue([]);

      const result = await getSuppliersByDate({
        date: '20240115',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.structuredContent?.count).toBe(0);
    });

    it('handles API errors', async () => {
      mockClient.getSuppliersByDate.mockRejectedValue(new Error('Invalid date format'));

      const result = await getSuppliersByDate({
        date: '20240115',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid date format');
    });
  });

  describe('getSupplierHistory', () => {
    it('returns supplier history', async () => {
      const history = {
        versions: [
          { version: 1, timestamp: '2024-01-01T00:00:00Z', changes: [] },
          { version: 2, timestamp: '2024-01-15T00:00:00Z', changes: ['name'] },
        ],
      };
      mockClient.getSupplierHistory.mockResolvedValue(history);

      const result = await getSupplierHistory({
        id: 'supplier-123',
        format: HistoryFormat.TIMELINE,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('supplier-123');
      expect(result.structuredContent?.history).toEqual(history);
    });

    it('passes format parameter to API', async () => {
      mockClient.getSupplierHistory.mockResolvedValue({});

      await getSupplierHistory({
        id: 'supplier-123',
        format: HistoryFormat.COMPACT,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(mockClient.getSupplierHistory).toHaveBeenCalledWith('supplier-123', 'compact');
    });

    it('handles not found error', async () => {
      mockClient.getSupplierHistory.mockRejectedValue(new Error('Supplier not found'));

      const result = await getSupplierHistory({
        id: 'nonexistent',
        format: HistoryFormat.DEFAULT,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Supplier not found');
    });
  });

  describe('uploadFile', () => {
    it('uploads file successfully', async () => {
      const uploadResponse = { status: 'success', fileId: 'file-123' };
      mockClient.uploadFile.mockResolvedValue(uploadResponse);

      const result = await uploadFile({
        filePath: '/path/to/data.csv',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('File Upload Successful');
      expect(result.content[0].text).toContain('data.csv');
    });

    it('uses custom filename when provided', async () => {
      mockClient.uploadFile.mockResolvedValue({ status: 'success' });

      const result = await uploadFile({
        filePath: '/path/to/data.csv',
        fileName: 'custom_name.csv',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('custom_name.csv');
    });

    it('handles file not found error', async () => {
      mockClient.uploadFile.mockRejectedValue(new Error('File not found: /invalid/path.csv'));

      const result = await uploadFile({
        filePath: '/invalid/path.csv',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('File not found');
    });

    it('handles permission denied error', async () => {
      mockClient.uploadFile.mockRejectedValue(new Error('Permission denied'));

      const result = await uploadFile({
        filePath: '/restricted/file.csv',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Permission denied');
    });

    it('returns JSON format when specified', async () => {
      const uploadResponse = { status: 'success', fileId: 'file-123' };
      mockClient.uploadFile.mockResolvedValue(uploadResponse);

      const result = await uploadFile({
        filePath: '/path/to/data.csv',
        response_format: ResponseFormat.JSON,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.status).toBe('success');
    });
  });

  describe('handleSuppliers', () => {
    it('dispatches list action', async () => {
      mockClient.listSuppliers.mockResolvedValue({
        items: [createSupplier({ name: 'Supplier A' })],
        pagination: { count: 1, pageSize: 20, hasMore: false, nextCursor: null },
      });

      const result = await handleSuppliers({ action: 'list', pageSize: 20, includeLinks: false });

      expect(mockClient.listSuppliers).toHaveBeenCalledWith(20, undefined);
      expect(result.content[0].text).toContain('Supplier');
    });

    it('dispatches get action by id', async () => {
      const supplier = createSupplier({ id: 'sup-1', name: 'Acme' });
      mockClient.getSupplier.mockResolvedValue(supplier);

      const result = await handleSuppliers({ action: 'get', id: 'sup-1', pageSize: 20, includeLinks: false });

      expect(mockClient.getSupplier).toHaveBeenCalledWith('sup-1', false);
      expect(result.content[0].text).toContain('Acme');
    });

    it('dispatches history action', async () => {
      mockClient.getSupplierHistory.mockResolvedValue({ versions: [] });

      const result = await handleSuppliers({ action: 'history', id: 'sup-1', pageSize: 20, includeLinks: false });

      expect(mockClient.getSupplierHistory).toHaveBeenCalledWith('sup-1', HistoryFormat.COMPACT);
      expect(result.content[0].text).toContain('sup-1');
    });

    it('dispatches by_date action', async () => {
      mockClient.getSuppliersByDate.mockResolvedValue([createSupplier({ name: 'Updated' })]);

      const result = await handleSuppliers({ action: 'by_date', date: '20260101', pageSize: 20, includeLinks: false });

      expect(mockClient.getSuppliersByDate).toHaveBeenCalledWith('20260101');
      expect(result.content[0].text).toContain('20260101');
    });

    it('wraps errors with createActionableError', async () => {
      mockClient.listSuppliers.mockRejectedValue(new Error('Request failed with status code 404'));

      const result = await handleSuppliers({ action: 'list', pageSize: 20, includeLinks: false });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error:');
    });
  });
});
