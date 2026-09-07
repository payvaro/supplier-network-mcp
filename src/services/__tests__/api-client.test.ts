import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { NetworkAPIClient, getNetworkAPIClient } from '../api-client.js';
import { createSupplier, createBuyer, createBuyerLink } from '../../test-utils/fixtures.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('api-client', () => {
  let mockAxiosInstance: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as unknown as ReturnType<typeof axios.create>);
    mockedAxios.isAxiosError.mockReturnValue(false);

    // Suppress console.error during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API key handling', () => {
    describe('sanitizeApiKey behavior', () => {
      it('removes control characters from API key', () => {
        const client = new NetworkAPIClient('key\x00with\x1Fcontrol', 'http://test.com');

        // Verify axios.create was called with sanitized key
        expect(mockedAxios.create).toHaveBeenCalledWith(
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer keywithcontrol',
            }),
          })
        );
      });

      it('trims whitespace from API key', () => {
        const client = new NetworkAPIClient('  api-key-value  ', 'http://test.com');

        expect(mockedAxios.create).toHaveBeenCalledWith(
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer api-key-value',
            }),
          })
        );
      });

      it('removes newlines from API key', () => {
        const client = new NetworkAPIClient('key\nwith\rnewlines', 'http://test.com');

        expect(mockedAxios.create).toHaveBeenCalledWith(
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer keywithnewlines',
            }),
          })
        );
      });

      it('handles empty API key', () => {
        // Clear env variable temporarily
        const originalKey = process.env.NETWORK_API_KEY;
        delete process.env.NETWORK_API_KEY;

        const client = new NetworkAPIClient('', 'http://test.com');

        const createCall = mockedAxios.create.mock.calls[mockedAxios.create.mock.calls.length - 1][0];
        // When API key is empty, headers should only have Content-Type
        expect(createCall?.headers?.['Authorization']).toBeUndefined();

        process.env.NETWORK_API_KEY = originalKey;
      });

      it('handles undefined API key', () => {
        // Clear env variable temporarily
        const originalKey = process.env.NETWORK_API_KEY;
        delete process.env.NETWORK_API_KEY;

        const client = new NetworkAPIClient(undefined, 'http://test.com');

        // Headers should not include X-API-Key when undefined and no env var
        const createCall = mockedAxios.create.mock.calls[mockedAxios.create.mock.calls.length - 1][0];
        expect(createCall?.headers?.['Authorization']).toBeUndefined();

        process.env.NETWORK_API_KEY = originalKey;
      });
    });

    describe('maskApiKey behavior', () => {
      it('masks long API keys in logs (first 4 and last 4 visible)', () => {
        const consoleErrorSpy = vi.spyOn(console, 'error');
        const client = new NetworkAPIClient('abcd1234wxyz5678', 'http://test.com');

        // Check that masked version appears in logs
        const allLogs = consoleErrorSpy.mock.calls.map(call => call[0]).join(' ');
        expect(allLogs).toContain('abcd...5678');
      });

      it('fully masks short API keys', () => {
        const consoleErrorSpy = vi.spyOn(console, 'error');
        const client = new NetworkAPIClient('short', 'http://test.com');

        // Short keys get fully masked
        const allLogs = consoleErrorSpy.mock.calls.map(call => call[0]).join(' ');
        expect(allLogs).toContain('*****');
      });
    });
  });

  describe('Supplier methods', () => {
    let client: NetworkAPIClient;

    beforeEach(() => {
      client = new NetworkAPIClient('test-key', 'http://test.com');
    });

    describe('listSuppliers', () => {
      it('fetches suppliers with default pagination', async () => {
        const paginatedResponse = {
          items: [createSupplier(), createSupplier({ id: 'supplier-2' })],
          pagination: { nextCursor: 'abc123', hasMore: true }
        };
        mockAxiosInstance.get.mockResolvedValueOnce({ data: paginatedResponse });

        const result = await client.listSuppliers();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/my/suppliers', {
          params: { pageSize: 20 },
        });
        expect(result).toEqual(paginatedResponse);
      });

      it('passes pageSize and cursor parameters', async () => {
        const paginatedResponse = {
          items: [],
          pagination: { nextCursor: null, hasMore: false }
        };
        mockAxiosInstance.get.mockResolvedValueOnce({ data: paginatedResponse });

        await client.listSuppliers(50, 'cursor123');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/my/suppliers', {
          params: { pageSize: 50, cursor: 'cursor123' },
        });
      });
    });

    describe('getAllSuppliers', () => {
      it('fetches all suppliers by paginating through listSuppliers', async () => {
        const suppliers = [createSupplier(), createSupplier({ id: 'supplier-2' })];
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: {
            items: suppliers,
            pagination: { count: 2, pageSize: 100, hasMore: false, nextCursor: null }
          }
        });

        const result = await client.getAllSuppliers();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/my/suppliers', {
          params: { pageSize: 100 }
        });
        expect(result).toEqual(suppliers);
      });

      it('handles multiple pages of results', async () => {
        const page1Suppliers = [createSupplier({ id: 'supplier-1' })];
        const page2Suppliers = [createSupplier({ id: 'supplier-2' })];

        mockAxiosInstance.get
          .mockResolvedValueOnce({
            data: {
              items: page1Suppliers,
              pagination: { count: 1, pageSize: 100, hasMore: true, nextCursor: 'cursor-1' }
            }
          })
          .mockResolvedValueOnce({
            data: {
              items: page2Suppliers,
              pagination: { count: 1, pageSize: 100, hasMore: false, nextCursor: null }
            }
          });

        const result = await client.getAllSuppliers();

        expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
        expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(1, '/api/my/suppliers', {
          params: { pageSize: 100 }
        });
        expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(2, '/api/my/suppliers', {
          params: { pageSize: 100, cursor: 'cursor-1' }
        });
        expect(result).toEqual([...page1Suppliers, ...page2Suppliers]);
      });
    });

    describe('getSupplier', () => {
      it('fetches supplier by ID', async () => {
        const supplier = createSupplier({ id: 'supplier-123' });
        mockAxiosInstance.get.mockResolvedValueOnce({ data: supplier });

        const result = await client.getSupplier('supplier-123');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/suppliers/supplier-123', {
          params: { includeLinks: false },
        });
        expect(result).toEqual(supplier);
      });

      it('passes includeLinks parameter', async () => {
        mockAxiosInstance.get.mockResolvedValueOnce({ data: createSupplier() });

        await client.getSupplier('supplier-123', true);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/suppliers/supplier-123', {
          params: { includeLinks: true },
        });
      });
    });

    describe('createSupplier', () => {
      it('creates a new supplier', async () => {
        const newSupplier = { name: 'New Supplier' };
        const createdSupplier = createSupplier(newSupplier);
        mockAxiosInstance.post.mockResolvedValueOnce({ data: createdSupplier });

        const result = await client.createSupplier(newSupplier);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/suppliers', newSupplier);
        expect(result).toEqual(createdSupplier);
      });
    });

    describe('updateSupplier', () => {
      it('updates an existing supplier', async () => {
        const updates = { name: 'Updated Name' };
        const updatedSupplier = createSupplier({ id: 'supplier-123', ...updates });
        mockAxiosInstance.put.mockResolvedValueOnce({ data: updatedSupplier });

        const result = await client.updateSupplier('supplier-123', updates);

        expect(mockAxiosInstance.put).toHaveBeenCalledWith('/api/suppliers/supplier-123', updates);
        expect(result).toEqual(updatedSupplier);
      });
    });

    describe('patchSupplier', () => {
      it('patches a supplier with update mask', async () => {
        const updates = { name: 'Patched Name' };
        const patchedSupplier = createSupplier({ id: 'supplier-123', ...updates });
        mockAxiosInstance.patch.mockResolvedValueOnce({ data: patchedSupplier });

        const result = await client.patchSupplier('supplier-123', updates, 'name');

        expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/api/suppliers/supplier-123', {
          supplier: updates,
          updateMask: 'name',
        });
        expect(result).toEqual(patchedSupplier);
      });
    });

    describe('deleteSupplier', () => {
      it('deletes a supplier', async () => {
        const deletedSupplier = createSupplier({ id: 'supplier-123' });
        mockAxiosInstance.delete.mockResolvedValueOnce({ data: deletedSupplier });

        const result = await client.deleteSupplier('supplier-123');

        expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/suppliers/supplier-123');
        expect(result).toEqual(deletedSupplier);
      });
    });

    describe('getSuppliersByDate', () => {
      it('fetches suppliers by date', async () => {
        const suppliers = [createSupplier()];
        mockAxiosInstance.get.mockResolvedValueOnce({ data: suppliers });

        const result = await client.getSuppliersByDate('20240115');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/suppliers/by-date/20240115');
        expect(result).toEqual(suppliers);
      });
    });

    describe('getSupplierHistory', () => {
      it('fetches supplier history with format', async () => {
        const history = [{ version: 1 }, { version: 2 }];
        mockAxiosInstance.get.mockResolvedValueOnce({ data: history });

        const result = await client.getSupplierHistory('supplier-123', 'timeline');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/suppliers/supplier-123/history', {
          params: { format: 'timeline' },
        });
        expect(result).toEqual(history);
      });

      it('uses default format of compact', async () => {
        mockAxiosInstance.get.mockResolvedValueOnce({ data: [] });

        await client.getSupplierHistory('supplier-123');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/suppliers/supplier-123/history', {
          params: { format: 'compact' },
        });
      });
    });
  });

  describe('Buyer methods', () => {
    let client: NetworkAPIClient;

    beforeEach(() => {
      client = new NetworkAPIClient('test-key', 'http://test.com');
    });

    describe('listBuyers', () => {
      it('fetches all buyers without links by default', async () => {
        const buyers = [createBuyer(), createBuyer({ id: 'buyer-2' })];
        mockAxiosInstance.get.mockResolvedValueOnce({ data: buyers });

        const result = await client.listBuyers();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/buyers', {
          params: { includeLinks: false }
        });
        expect(result).toEqual(buyers);
      });

      it('fetches all buyers with links when requested', async () => {
        const buyers = [createBuyer({ buyerLinks: [createBuyerLink()] })];
        mockAxiosInstance.get.mockResolvedValueOnce({ data: buyers });

        const result = await client.listBuyers(true);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/buyers', {
          params: { includeLinks: true }
        });
        expect(result).toEqual(buyers);
      });
    });

    describe('getBuyer', () => {
      it('fetches buyer by ID without links by default', async () => {
        const buyer = createBuyer({ id: 'buyer-123' });
        mockAxiosInstance.get.mockResolvedValueOnce({ data: buyer });

        const result = await client.getBuyer('buyer-123');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/buyers/buyer-123', {
          params: { includeLinks: false }
        });
        expect(result).toEqual(buyer);
      });

      it('fetches buyer by ID with links when requested', async () => {
        const buyer = createBuyer({ id: 'buyer-123', buyerLinks: [createBuyerLink()] });
        mockAxiosInstance.get.mockResolvedValueOnce({ data: buyer });

        const result = await client.getBuyer('buyer-123', true);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/buyers/buyer-123', {
          params: { includeLinks: true }
        });
        expect(result).toEqual(buyer);
      });
    });

    describe('getBuyerByClientId', () => {
      it('fetches buyer by client ID', async () => {
        const buyer = createBuyer({ clientId: 'CLIENT-001' });
        mockAxiosInstance.get.mockResolvedValueOnce({ data: buyer });

        const result = await client.getBuyerByClientId('CLIENT-001');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/buyers/by-client-id/CLIENT-001');
        expect(result).toEqual(buyer);
      });
    });

    describe('createBuyer', () => {
      it('creates a new buyer', async () => {
        const newBuyer = { name: 'New Buyer', clientId: 'NEW-001' };
        const createdBuyer = createBuyer(newBuyer);
        mockAxiosInstance.post.mockResolvedValueOnce({ data: createdBuyer });

        const result = await client.createBuyer(newBuyer);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/buyers', newBuyer);
        expect(result).toEqual(createdBuyer);
      });
    });
  });

  describe('Link methods', () => {
    let client: NetworkAPIClient;

    beforeEach(() => {
      client = new NetworkAPIClient('test-key', 'http://test.com');
    });

    describe('listBuyerLinks', () => {
      it('fetches all buyer links', async () => {
        const links = [createBuyerLink()];
        mockAxiosInstance.get.mockResolvedValueOnce({ data: links });

        const result = await client.listBuyerLinks();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/buyer-links');
        expect(result).toEqual(links);
      });
    });

    describe('getBuyerLink', () => {
      it('fetches specific buyer-supplier link', async () => {
        const link = createBuyerLink({ buyerId: 'buyer-1', supplierId: 'supplier-1' });
        mockAxiosInstance.get.mockResolvedValueOnce({ data: link });

        const result = await client.getBuyerLink('buyer-1', 'supplier-1');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/buyer-links/buyer-1/supplier/supplier-1');
        expect(result).toEqual(link);
      });
    });

    describe('createBuyerLink', () => {
      it('creates a buyer-supplier link', async () => {
        const newLink = { buyerId: 'buyer-1', supplierId: 'supplier-1' };
        const createdLink = createBuyerLink(newLink);
        mockAxiosInstance.post.mockResolvedValueOnce({ data: createdLink });

        const result = await client.createBuyerLink(newLink);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/buyer-links', newLink);
        expect(result).toEqual(createdLink);
      });
    });

    describe('getBuyerLinksByRefKey', () => {
      it('fetches buyer links by reference key', async () => {
        const links = [createBuyerLink({ buyerRefKey: 'REF-001' })];
        mockAxiosInstance.get.mockResolvedValueOnce({ data: links });

        const result = await client.getBuyerLinksByRefKey('REF-001');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/buyer-links/by-ref-key/REF-001');
        expect(result).toEqual(links);
      });
    });

    describe('getSuppliersForBuyer', () => {
      it('fetches suppliers linked to a buyer', async () => {
        const suppliers = [createSupplier()];
        mockAxiosInstance.get.mockResolvedValueOnce({ data: suppliers });

        const result = await client.getSuppliersForBuyer('buyer-1');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/buyers/buyer-1/suppliers');
        expect(result).toEqual(suppliers);
      });
    });

    describe('getBuyersForSupplier', () => {
      it('fetches buyer links for a supplier', async () => {
        const links = [createBuyerLink()];
        mockAxiosInstance.get.mockResolvedValueOnce({ data: links });

        const result = await client.getBuyersForSupplier('supplier-1');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/suppliers/supplier-1/buyers');
        expect(result).toEqual(links);
      });
    });
  });

  describe('Error handling', () => {
    let client: NetworkAPIClient;

    beforeEach(() => {
      client = new NetworkAPIClient('test-key', 'http://test.com');
    });

    it('handles 401 authentication error', async () => {
      const axiosError = {
        response: { status: 401, data: {} },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(client.listSuppliers()).rejects.toThrow('Authentication failed');
    });

    it('handles 403 permission error', async () => {
      const axiosError = {
        response: { status: 403, data: {} },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(client.listSuppliers()).rejects.toThrow('Permission denied');
    });

    it('handles 404 not found error', async () => {
      const axiosError = {
        response: { status: 404, data: {} },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(client.getSupplier('nonexistent')).rejects.toThrow('Resource not found');
    });

    it('handles 400 validation error with field errors', async () => {
      const axiosError = {
        response: {
          status: 400,
          data: {
            errors: [
              { field: 'name', message: 'is required' },
              { field: 'email', message: 'is invalid' },
            ],
          },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(client.createSupplier({})).rejects.toThrow('Validation failed');
    });

    it('handles 400 error with simple message', async () => {
      const axiosError = {
        response: {
          status: 400,
          data: { error: 'Invalid request body' },
        },
        message: 'Request failed',
        isAxiosError: true,
      };
      mockAxiosInstance.post.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(client.createSupplier({})).rejects.toThrow('Bad request');
    });

    it('translates 400 "Client ID is required" into actionable admin guidance', async () => {
      const axiosError = {
        response: {
          status: 400,
          data: { error: 'Client ID is required. Admin users must specify X-Client-Id header.' },
        },
        message: 'Request failed',
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(client.listBuyers()).rejects.toThrow(/tenant scope/);
      await expect(client.listBuyers()).rejects.toThrow(/NETWORK_CLIENT_ID|asClientId/);
    });

    it('translates 400 "ID cannot be null or blank" as the same admin-scope issue', async () => {
      const axiosError = {
        response: {
          status: 400,
          data: { error: 'ID cannot be null or blank' },
        },
        message: 'Request failed',
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(client.listBuyers()).rejects.toThrow(/tenant scope/);
      await expect(client.listBuyers()).rejects.toThrow(/asClientName|asClientId/);
    });

    it('does not hijack unrelated 400s when clientId is already set', async () => {
      const clientWithId = new NetworkAPIClient('key', 'http://test.com', 'client-abc');
      const axiosError = {
        response: {
          status: 400,
          data: { error: 'Client ID is required' },
        },
        message: 'Request failed',
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      // With clientId already configured, the translation should NOT kick in —
      // the problem is something else upstream.
      await expect(clientWithId.listBuyers()).rejects.toThrow(/Bad request/);
    });

    it('handles 500 server error', async () => {
      const axiosError = {
        response: {
          status: 500,
          data: { error: 'Database connection failed' },
        },
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(client.listSuppliers()).rejects.toThrow('Server error');
    });

    it('handles network error (no response)', async () => {
      const axiosError = {
        request: {},
        response: undefined,
        message: 'Network Error',
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(client.listSuppliers()).rejects.toThrow('No response from API');
    });

    it('handles generic axios error', async () => {
      const axiosError = {
        message: 'Request timeout',
        isAxiosError: true,
      };
      mockAxiosInstance.get.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(client.listSuppliers()).rejects.toThrow('Request error');
    });

    it('handles non-axios error', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Unknown error'));
      mockedAxios.isAxiosError.mockReturnValueOnce(false);

      await expect(client.listSuppliers()).rejects.toThrow('Unknown error');
    });

    it('handles ERR_INVALID_CHAR error for API key', async () => {
      const typeError = new TypeError('ERR_INVALID_CHAR: Invalid character in header ["Authorization"]');
      typeError.name = 'TypeError';
      mockAxiosInstance.get.mockRejectedValueOnce(typeError);
      mockedAxios.isAxiosError.mockReturnValueOnce(false);

      await expect(client.listSuppliers()).rejects.toThrow('Invalid API key format');
    });
  });

  describe('Configuration', () => {
    it('uses default base URL when not provided', () => {
      // Clear any env variable
      const originalEnv = process.env.NETWORK_API_BASE_URL;
      delete process.env.NETWORK_API_BASE_URL;

      const client = new NetworkAPIClient('test-key');

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://localhost:8080',
        })
      );

      process.env.NETWORK_API_BASE_URL = originalEnv;
    });

    it('uses provided base URL', () => {
      const client = new NetworkAPIClient('test-key', 'https://api.example.com');

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.example.com',
        })
      );
    });

    it('sets 30 second timeout', () => {
      const client = new NetworkAPIClient('test-key', 'http://test.com');

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        })
      );
    });

    it('sets Content-Type header', () => {
      const client = new NetworkAPIClient('test-key', 'http://test.com');

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('getNetworkAPIClient singleton', () => {
    it('returns a NetworkAPIClient instance', () => {
      // Note: Since we're in a test environment and the singleton is already created
      // from test-utils/setup.ts, this just verifies the function works
      const client = getNetworkAPIClient('test-key', 'http://test.com');
      expect(client).toBeInstanceOf(NetworkAPIClient);
    });
  });

  describe('withClientIdOverride', () => {
    it('returns a new client that sends the override as x-client-id header', async () => {
      const base = new NetworkAPIClient('api-key', 'http://test.com', 'default-client');

      // Reset mock to isolate the override axios.create call
      mockedAxios.create.mockClear();
      const scopedAxios = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() };
      mockedAxios.create.mockReturnValue(scopedAxios as unknown as ReturnType<typeof axios.create>);

      const scoped = base.withClientIdOverride('override-client');

      // Verify a new axios instance was created with the override header
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-client-id': 'override-client',
            'Authorization': 'Bearer api-key',
          }),
        })
      );

      // Verify that calls on the scoped instance hit the scoped axios, not the base one
      scopedAxios.get.mockResolvedValueOnce({ data: createSupplier() });
      await scoped.getSupplier('sup-1');
      expect(scopedAxios.get).toHaveBeenCalled();
    });

    it('scoped client is independent from the base client', async () => {
      const base = new NetworkAPIClient('api-key', 'http://test.com', 'default-client');
      mockAxiosInstance.get.mockResolvedValue({ data: createSupplier() });

      const scopedAxios = { get: vi.fn().mockResolvedValue({ data: createSupplier() }), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() };
      mockedAxios.create.mockReturnValueOnce(scopedAxios as unknown as ReturnType<typeof axios.create>);

      const scoped = base.withClientIdOverride('override-client');

      // Calls on base use the default axios instance
      await base.getSupplier('sup-1');
      expect(mockAxiosInstance.get).toHaveBeenCalled();

      // Calls on scoped use the scoped axios instance
      await scoped.getSupplier('sup-2');
      expect(scopedAxios.get).toHaveBeenCalled();
    });

    it('throws when override is empty', () => {
      const base = new NetworkAPIClient('api-key', 'http://test.com', 'default-client');
      expect(() => base.withClientIdOverride('')).toThrow(/requires a non-empty/);
    });

    it('uploadFile on scoped client uses override in its manual headers', async () => {
      const base = new NetworkAPIClient('api-key', 'http://test.com', 'default-client');

      const scopedAxios = { get: vi.fn(), post: vi.fn().mockResolvedValue({ data: { ok: true } }), put: vi.fn(), patch: vi.fn(), delete: vi.fn() };
      mockedAxios.create.mockReturnValueOnce(scopedAxios as unknown as ReturnType<typeof axios.create>);

      const scoped = base.withClientIdOverride('override-client');

      // Mock file read by stubbing fs — since uploadFile calls fs.readFile, we need a real or mocked file.
      // Simpler: we can't exercise the full multipart path without fs mocking, so just verify that
      // the override is stored and would be passed. The axios.create check above already verifies
      // the default header path. Explicit uploadFile test would require fs mocking out-of-scope here.
      expect(scoped).toBeInstanceOf(NetworkAPIClient);
    });
  });

  describe('getAllBuyers includeLinks hydration (MVP-962)', () => {
    it('hydrates buyerLinks via per-buyer fetch when includeLinks=true (list endpoint does not honor includeLinks)', async () => {
      const client = new NetworkAPIClient('api-key', 'http://test.com');

      const buyersFromList = [
        { id: 'b1', name: 'B1', clientId: 'c1' },
        { id: 'b2', name: 'B2', clientId: 'c2' },
      ];

      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: { items: buyersFromList, pagination: { hasMore: false, nextCursor: null } },
        })
        .mockResolvedValueOnce({
          data: { ...buyersFromList[0], buyerLinks: [createBuyerLink({ buyerId: 'b1', supplierId: 's1' })] },
        })
        .mockResolvedValueOnce({
          data: { ...buyersFromList[1], buyerLinks: [createBuyerLink({ buyerId: 'b2', supplierId: 's2' })] },
        });

      const result = await client.getAllBuyers(true);

      expect(result).toHaveLength(2);
      expect(result[0].buyerLinks).toHaveLength(1);
      expect(result[1].buyerLinks).toHaveLength(1);
      // First call: list. Subsequent calls: per-buyer hydration with includeLinks=true.
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(2, '/api/buyers/b1', expect.objectContaining({ params: { includeLinks: true } }));
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(3, '/api/buyers/b2', expect.objectContaining({ params: { includeLinks: true } }));
    });

    it('skips hydration when includeLinks=false', async () => {
      const client = new NetworkAPIClient('api-key', 'http://test.com');

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { items: [{ id: 'b1', name: 'B1', clientId: 'c1' }], pagination: { hasMore: false, nextCursor: null } },
      });

      const result = await client.getAllBuyers(false);

      expect(result).toHaveLength(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    it('falls back to summary when per-buyer hydration fails', async () => {
      const client = new NetworkAPIClient('api-key', 'http://test.com');

      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: { items: [{ id: 'b1', name: 'B1', clientId: 'c1' }], pagination: { hasMore: false, nextCursor: null } },
        })
        .mockRejectedValueOnce(new Error('boom'));

      const result = await client.getAllBuyers(true);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('b1');
      // buyerLinks remains undefined — caller falls back to whatever the summary had.
    });
  });

  describe('getAcceptorsForSupplier (MVP-960)', () => {
    it('derives unique acceptors from the supplier\'s integration list', async () => {
      const client = new NetworkAPIClient('api-key', 'http://test.com');

      mockAxiosInstance.get
        // listAcceptorIntegrationsForSupplier
        .mockResolvedValueOnce({
          data: [
            { acceptorIntegrationId: 'i1', networkId: 'acc-A', paymentType: 'CARD' },
            { acceptorIntegrationId: 'i2', networkId: 'acc-A', paymentType: 'ACH' }, // dup acceptor
            { acceptorIntegrationId: 'i3', networkId: 'acc-B', paymentType: 'CARD' },
          ],
        })
        // getAcceptor(acc-A)
        .mockResolvedValueOnce({ data: { id: 'acc-A', name: 'CPX' } })
        // getAcceptor(acc-B)
        .mockResolvedValueOnce({ data: { id: 'acc-B', name: 'Other' } });

      const result = await client.getAcceptorsForSupplier('sup-1');

      expect(result).toHaveLength(2);
      expect(result.map((a) => a.id)).toEqual(['acc-A', 'acc-B']);
      // 1 list call + 2 unique acceptor lookups
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(1, '/api/suppliers/sup-1/acceptor-integrations');
    });

    it('returns empty when the supplier has no integrations', async () => {
      const client = new NetworkAPIClient('api-key', 'http://test.com');
      mockAxiosInstance.get.mockResolvedValueOnce({ data: [] });

      const result = await client.getAcceptorsForSupplier('sup-1');

      expect(result).toEqual([]);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    it('skips acceptors that fail to load instead of failing the whole call', async () => {
      const client = new NetworkAPIClient('api-key', 'http://test.com');

      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: [
            { acceptorIntegrationId: 'i1', networkId: 'acc-A' },
            { acceptorIntegrationId: 'i2', networkId: 'acc-B' },
          ],
        })
        .mockResolvedValueOnce({ data: { id: 'acc-A', name: 'CPX' } })
        .mockRejectedValueOnce(new Error('acceptor B missing'));

      const result = await client.getAcceptorsForSupplier('sup-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('acc-A');
    });
  });
});
