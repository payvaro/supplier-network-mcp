import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listBuyers,
  getBuyer,
  getBuyerByClientId,
  getSuppliersForBuyer,
  getBuyersForSupplier,
  createBuyerLink,
  createBuyer,
  handleBuyers,
} from '../buyers.js';
import { createMockNetworkAPIClient, type MockNetworkAPIClient } from '../../__mocks__/api-client.mock.js';
import { createBuyer as createBuyerFixture, createSupplier, createBuyerLink as createBuyerLinkFixture, createAddress, createContact } from '../../test-utils/fixtures.js';
import { ResponseFormat } from '../../constants.js';

// Mock the api-client module
vi.mock('../../services/api-client.js', () => ({
  getNetworkAPIClient: vi.fn(),
}));

import { getNetworkAPIClient } from '../../services/api-client.js';

describe('buyer tools', () => {
  let mockClient: MockNetworkAPIClient;

  beforeEach(() => {
    mockClient = createMockNetworkAPIClient();
    vi.mocked(getNetworkAPIClient).mockReturnValue(mockClient as never);
  });

  describe('listBuyers', () => {
    it('returns formatted list of buyers', async () => {
      const buyers = [
        createBuyerFixture({ name: 'Buyer A', clientId: 'client-a' }),
        createBuyerFixture({ name: 'Buyer B', clientId: 'client-b' }),
      ];
      mockClient.listBuyers.mockResolvedValue(buyers);

      const result = await listBuyers({
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Buyer');
      expect(result.structuredContent?.count).toBe(2);
    });

    it('returns empty list gracefully', async () => {
      mockClient.listBuyers.mockResolvedValue([]);

      const result = await listBuyers({
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.structuredContent?.count).toBe(0);
      expect(result.content[0].text).toContain('0 buyer(s)');
    });

    it('handles API errors', async () => {
      mockClient.listBuyers.mockRejectedValue(new Error('Connection failed'));

      const result = await listBuyers({
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Connection failed');
    });

    it('includes buyer details in markdown format', async () => {
      const buyers = [
        createBuyerFixture({
          name: 'Test Buyer',
          franchiseName: 'Test Franchise',
          storeIdentifier: 'STORE-001',
          clientId: 'CLIENT-001',
          status: 'ACTIVE',
        }),
      ];
      mockClient.listBuyers.mockResolvedValue(buyers);

      const result = await listBuyers({
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Test Buyer');
      expect(result.content[0].text).toContain('Test Franchise');
      expect(result.content[0].text).toContain('STORE-001');
      expect(result.content[0].text).toContain('CLIENT-001');
      expect(result.content[0].text).toContain('ACTIVE');
    });
  });

  describe('getBuyer', () => {
    it('returns buyer details', async () => {
      const buyer = createBuyerFixture({
        id: 'buyer-123',
        name: 'Test Buyer',
        clientId: 'client-123',
      });
      mockClient.getBuyer.mockResolvedValue(buyer);

      const result = await getBuyer({
        id: 'buyer-123',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Test Buyer');
      expect(result.structuredContent).toEqual(buyer);
    });

    it('includes addresses in output', async () => {
      const buyer = createBuyerFixture({
        id: 'buyer-123',
        addresses: [createAddress({ city: 'Chicago', stateProvince: 'IL' })],
      });
      mockClient.getBuyer.mockResolvedValue(buyer);

      const result = await getBuyer({
        id: 'buyer-123',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Addresses');
      expect(result.content[0].text).toContain('Chicago');
    });

    it('includes contacts in output', async () => {
      const buyer = createBuyerFixture({
        id: 'buyer-123',
        contacts: [createContact({ name: 'John Doe', email: 'john@test.com' })],
      });
      mockClient.getBuyer.mockResolvedValue(buyer);

      const result = await getBuyer({
        id: 'buyer-123',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Contacts');
      expect(result.content[0].text).toContain('John Doe');
    });

    it('handles not found error', async () => {
      mockClient.getBuyer.mockRejectedValue(new Error('Resource not found.'));

      const result = await getBuyer({
        id: 'nonexistent',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    it('returns JSON format when specified', async () => {
      const buyer = createBuyerFixture({ name: 'JSON Test' });
      mockClient.getBuyer.mockResolvedValue(buyer);

      const result = await getBuyer({
        id: 'buyer-123',
        response_format: ResponseFormat.JSON,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.name).toBe('JSON Test');
    });
  });

  describe('getBuyerByClientId', () => {
    it('returns buyer by client ID', async () => {
      const buyer = createBuyerFixture({
        id: 'buyer-123',
        name: 'Client Test',
        clientId: 'CLIENT-001',
      });
      mockClient.getBuyerByClientId.mockResolvedValue(buyer);

      const result = await getBuyerByClientId({
        clientId: 'CLIENT-001',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('CLIENT-001');
      expect(result.content[0].text).toContain('Client Test');
      expect(result.structuredContent).toEqual(buyer);
    });

    it('handles not found error', async () => {
      mockClient.getBuyerByClientId.mockRejectedValue(new Error('Buyer not found'));

      const result = await getBuyerByClientId({
        clientId: 'nonexistent',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('getSuppliersForBuyer', () => {
    it('returns suppliers linked to buyer', async () => {
      const suppliers = [
        createSupplier({ name: 'Supplier A' }),
        createSupplier({ name: 'Supplier B' }),
      ];
      mockClient.getSuppliersForBuyer.mockResolvedValue(suppliers);

      const result = await getSuppliersForBuyer({
        buyerId: 'buyer-123',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('buyer-123');
      expect(result.structuredContent?.count).toBe(2);
    });

    it('returns empty list when no suppliers linked', async () => {
      mockClient.getSuppliersForBuyer.mockResolvedValue([]);

      const result = await getSuppliersForBuyer({
        buyerId: 'buyer-123',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.structuredContent?.count).toBe(0);
    });

    it('handles API errors', async () => {
      mockClient.getSuppliersForBuyer.mockRejectedValue(new Error('Buyer not found'));

      const result = await getSuppliersForBuyer({
        buyerId: 'nonexistent',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Buyer not found');
    });
  });

  describe('getBuyersForSupplier', () => {
    it('returns buyer links for supplier', async () => {
      const buyerLinks = [
        createBuyerLinkFixture({ buyerId: 'buyer-1', supplierId: 'supplier-123' }),
        createBuyerLinkFixture({ buyerId: 'buyer-2', supplierId: 'supplier-123' }),
      ];
      mockClient.getBuyersForSupplier.mockResolvedValue(buyerLinks);

      const result = await getBuyersForSupplier({
        supplierId: 'supplier-123',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('supplier-123');
      expect(result.structuredContent?.count).toBe(2);
    });

    it('includes link details in markdown', async () => {
      const buyerLinks = [
        createBuyerLinkFixture({
          buyerId: 'buyer-1',
          buyerSupplierRefId: 'REF-001',
          buyerRefKey: 'KEY-001',
          connectionStatus: 'ACTIVE',
        }),
      ];
      mockClient.getBuyersForSupplier.mockResolvedValue(buyerLinks);

      const result = await getBuyersForSupplier({
        supplierId: 'supplier-123',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('REF-001');
      expect(result.content[0].text).toContain('KEY-001');
      expect(result.content[0].text).toContain('ACTIVE');
    });

    it('returns empty list when no buyers linked', async () => {
      mockClient.getBuyersForSupplier.mockResolvedValue([]);

      const result = await getBuyersForSupplier({
        supplierId: 'supplier-123',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.structuredContent?.count).toBe(0);
    });

    it('handles API errors', async () => {
      mockClient.getBuyersForSupplier.mockRejectedValue(new Error('Supplier not found'));

      const result = await getBuyersForSupplier({
        supplierId: 'nonexistent',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Supplier not found');
    });
  });

  describe('createBuyerLink', () => {
    it('creates link successfully', async () => {
      const link = createBuyerLinkFixture({
        buyerId: 'buyer-123',
        supplierId: 'supplier-456',
        buyerSupplierRefId: 'REF-001',
      });
      mockClient.createBuyerLink.mockResolvedValue(link);

      const result = await createBuyerLink({
        buyerId: 'buyer-123',
        supplierId: 'supplier-456',
        buyerSupplierRefId: 'REF-001',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Link Created');
      expect(result.content[0].text).toContain('buyer-123');
      expect(result.content[0].text).toContain('supplier-456');
    });

    it('includes optional fields when provided', async () => {
      const link = createBuyerLinkFixture({
        buyerId: 'buyer-123',
        supplierId: 'supplier-456',
        buyerSupplierRefId: 'REF-001',
        buyerRefKey: 'KEY-001',
      });
      mockClient.createBuyerLink.mockResolvedValue(link);

      const result = await createBuyerLink({
        buyerId: 'buyer-123',
        supplierId: 'supplier-456',
        buyerSupplierRefId: 'REF-001',
        buyerRefKey: 'KEY-001',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('REF-001');
      expect(result.content[0].text).toContain('KEY-001');
    });

    it('handles duplicate link error', async () => {
      mockClient.createBuyerLink.mockRejectedValue(new Error('Link already exists'));

      const result = await createBuyerLink({
        buyerId: 'buyer-123',
        supplierId: 'supplier-456',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('already exists');
    });

    it('handles validation errors', async () => {
      mockClient.createBuyerLink.mockRejectedValue(new Error('Invalid buyer ID'));

      const result = await createBuyerLink({
        buyerId: 'invalid',
        supplierId: 'supplier-456',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid');
    });
  });

  describe('createBuyer', () => {
    it('creates buyer successfully', async () => {
      const buyer = createBuyerFixture({
        id: 'new-buyer-123',
        name: 'New Buyer',
        clientId: 'CLIENT-NEW',
      });
      mockClient.createBuyer.mockResolvedValue(buyer);

      const result = await createBuyer({
        name: 'New Buyer',
        clientId: 'CLIENT-NEW',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Buyer Created');
      expect(result.content[0].text).toContain('New Buyer');
      expect(result.content[0].text).toContain('CLIENT-NEW');
    });

    it('includes all provided fields', async () => {
      const buyer = createBuyerFixture({
        id: 'new-buyer-123',
        name: 'Full Buyer',
        franchiseName: 'Test Franchise',
        storeIdentifier: 'STORE-001',
        clientId: 'CLIENT-001',
        status: 'ACTIVE',
      });
      mockClient.createBuyer.mockResolvedValue(buyer);

      const result = await createBuyer({
        name: 'Full Buyer',
        franchiseName: 'Test Franchise',
        storeIdentifier: 'STORE-001',
        clientId: 'CLIENT-001',
        status: 'ACTIVE',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Full Buyer');
      expect(result.content[0].text).toContain('Test Franchise');
      expect(result.content[0].text).toContain('STORE-001');
    });

    it('includes addresses in response', async () => {
      const buyer = createBuyerFixture({
        id: 'new-buyer-123',
        addresses: [createAddress({ city: 'Chicago', stateProvince: 'IL' })],
      });
      mockClient.createBuyer.mockResolvedValue(buyer);

      const result = await createBuyer({
        clientId: 'CLIENT-001',
        addresses: [{ city: 'Chicago', stateProvince: 'IL' }],
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Addresses');
      expect(result.content[0].text).toContain('Chicago');
    });

    it('includes contacts in response', async () => {
      const buyer = createBuyerFixture({
        id: 'new-buyer-123',
        contacts: [createContact({ name: 'Jane Doe', email: 'jane@test.com' })],
      });
      mockClient.createBuyer.mockResolvedValue(buyer);

      const result = await createBuyer({
        clientId: 'CLIENT-001',
        contacts: [{ name: 'Jane Doe', email: 'jane@test.com' }],
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Contacts');
      expect(result.content[0].text).toContain('Jane Doe');
    });

    it('handles duplicate client ID error', async () => {
      mockClient.createBuyer.mockRejectedValue(new Error('Client ID already exists'));

      const result = await createBuyer({
        clientId: 'existing-client',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('already exists');
    });

    it('handles validation errors', async () => {
      mockClient.createBuyer.mockRejectedValue(new Error('Validation failed: clientId is required'));

      const result = await createBuyer({
        clientId: '',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Validation failed');
    });

    it('returns JSON format when specified', async () => {
      const buyer = createBuyerFixture({ name: 'JSON Buyer', clientId: 'JSON-001' });
      mockClient.createBuyer.mockResolvedValue(buyer);

      const result = await createBuyer({
        name: 'JSON Buyer',
        clientId: 'JSON-001',
        response_format: ResponseFormat.JSON,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.name).toBe('JSON Buyer');
    });
  });

  describe('handleBuyers', () => {
    it('dispatches list action', async () => {
      const buyers = [createBuyerFixture({ name: 'Buyer A', clientId: 'client-a' })];
      mockClient.listBuyers.mockResolvedValue(buyers);

      const result = await handleBuyers({ action: 'list' });

      expect(mockClient.listBuyers).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Buyer');
    });

    it('dispatches get action by id', async () => {
      const buyer = createBuyerFixture({ id: 'buyer-1', name: 'Acme Buyer' });
      mockClient.getBuyer.mockResolvedValue(buyer);

      const result = await handleBuyers({ action: 'get', id: 'buyer-1' });

      expect(mockClient.getBuyer).toHaveBeenCalledWith('buyer-1');
      expect(result.content[0].text).toContain('Acme Buyer');
    });

    it('dispatches get action by clientId when clientId is provided', async () => {
      const buyer = createBuyerFixture({ id: 'buyer-1', name: 'Acme Buyer', clientId: 'client-abc' });
      mockClient.getBuyerByClientId.mockResolvedValue(buyer);

      const result = await handleBuyers({ action: 'get', clientId: 'client-abc' });

      expect(mockClient.getBuyerByClientId).toHaveBeenCalledWith('client-abc');
      expect(mockClient.getBuyer).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain('client-abc');
    });

    it('dispatches create action', async () => {
      const buyer = createBuyerFixture({ id: 'buyer-new', name: 'New Buyer', clientId: 'client-new' });
      mockClient.createBuyer.mockResolvedValue(buyer);

      const result = await handleBuyers({ action: 'create', clientId: 'client-new', name: 'New Buyer' });

      expect(mockClient.createBuyer).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Buyer Created');
    });

    it('wraps errors with createActionableError', async () => {
      mockClient.listBuyers.mockRejectedValue(new Error('Request failed with status code 404'));

      const result = await handleBuyers({ action: 'list' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error:');
    });
  });

  describe('handleBuyers admin override (asClientId)', () => {
    const ORIG = process.env.NETWORK_ADMIN_MODE;
    afterEach(() => {
      if (ORIG === undefined) delete process.env.NETWORK_ADMIN_MODE;
      else process.env.NETWORK_ADMIN_MODE = ORIG;
    });

    it('rejects asClientId when admin mode is disabled', async () => {
      delete process.env.NETWORK_ADMIN_MODE;

      const result = await handleBuyers({ action: 'list', asClientId: 'client-abc' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('admin mode');
      expect(result.content[0].text).toContain('NETWORK_ADMIN_MODE=true');
      expect(mockClient.withClientIdOverride).not.toHaveBeenCalled();
      expect(mockClient.listBuyers).not.toHaveBeenCalled();
    });

    it('rejects asClientId when NETWORK_ADMIN_MODE is set to something other than "true"', async () => {
      process.env.NETWORK_ADMIN_MODE = 'yes';

      const result = await handleBuyers({ action: 'list', asClientId: 'client-abc' });

      expect(result.isError).toBe(true);
      expect(mockClient.withClientIdOverride).not.toHaveBeenCalled();
    });

    it('invokes withClientIdOverride and dispatches normally when admin mode is enabled', async () => {
      process.env.NETWORK_ADMIN_MODE = 'true';
      mockClient.listBuyers.mockResolvedValue([
        createBuyerFixture({ name: 'Alpha', clientId: 'client-abc' }),
      ]);

      const result = await handleBuyers({ action: 'list', asClientId: 'client-abc' });

      expect(mockClient.withClientIdOverride).toHaveBeenCalledWith('client-abc');
      expect(mockClient.listBuyers).toHaveBeenCalled();
      expect(result.isError).toBeUndefined();
    });

    it('does not invoke withClientIdOverride when asClientId is omitted', async () => {
      process.env.NETWORK_ADMIN_MODE = 'true';
      mockClient.listBuyers.mockResolvedValue([]);

      await handleBuyers({ action: 'list' });

      expect(mockClient.withClientIdOverride).not.toHaveBeenCalled();
    });
  });
});
