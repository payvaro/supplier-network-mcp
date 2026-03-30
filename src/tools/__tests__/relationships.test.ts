import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRelationships } from '../relationships.js';
import { createMockNetworkAPIClient, type MockNetworkAPIClient } from '../../__mocks__/api-client.mock.js';
import { createSupplier, createBuyerLink } from '../../test-utils/fixtures.js';

// Mock the api-client module
vi.mock('../../services/api-client.js', () => ({
  getNetworkAPIClient: vi.fn(),
}));

import { getNetworkAPIClient } from '../../services/api-client.js';

describe('handleRelationships', () => {
  let mockClient: MockNetworkAPIClient;

  beforeEach(() => {
    mockClient = createMockNetworkAPIClient();
    vi.mocked(getNetworkAPIClient).mockReturnValue(mockClient as never);
  });

  it('dispatches for_buyer action', async () => {
    const suppliers = [createSupplier({ id: 'sup-1', name: 'Supplier A' })];
    mockClient.getSuppliersForBuyer.mockResolvedValue(suppliers);

    const result = await handleRelationships({ action: 'for_buyer', buyerId: 'buyer-1' });

    expect(mockClient.getSuppliersForBuyer).toHaveBeenCalledWith('buyer-1');
    expect(result.content[0].text).toContain('buyer-1');
  });

  it('dispatches for_supplier action', async () => {
    const links = [createBuyerLink({ buyerId: 'buyer-1' })];
    mockClient.getBuyersForSupplier.mockResolvedValue(links);

    const result = await handleRelationships({ action: 'for_supplier', supplierId: 'sup-1' });

    expect(mockClient.getBuyersForSupplier).toHaveBeenCalledWith('sup-1');
    expect(result.content[0].text).toContain('sup-1');
  });

  it('dispatches link action', async () => {
    const link = createBuyerLink({ buyerId: 'buyer-1', supplierId: 'sup-1' });
    mockClient.createBuyerLink.mockResolvedValue(link);

    const result = await handleRelationships({
      action: 'link',
      buyerId: 'buyer-1',
      supplierId: 'sup-1',
      buyerSupplierRefId: 'ref-001',
      buyerRefKey: 'key-abc',
    });

    expect(mockClient.createBuyerLink).toHaveBeenCalledWith(
      expect.objectContaining({ buyerId: 'buyer-1', supplierId: 'sup-1' })
    );
    expect(result.content[0].text).toContain('Link');
  });

  it('wraps errors with createActionableError', async () => {
    mockClient.getSuppliersForBuyer.mockRejectedValue(new Error('Request failed with status code 404'));

    const result = await handleRelationships({ action: 'for_buyer', buyerId: 'buyer-999' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ Error:');
  });
});
