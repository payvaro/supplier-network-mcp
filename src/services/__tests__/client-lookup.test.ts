import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClientLookupService } from '../client-lookup.js';
import type { NetworkPartnerSummary } from '../../types.js';

function fakeApiClient(partners: NetworkPartnerSummary[]) {
  return {
    listAllNetworkPartners: vi.fn().mockResolvedValue(partners),
  } as unknown as Parameters<typeof ClientLookupService.prototype.constructor>[0];
}

describe('ClientLookupService', () => {
  let service: ClientLookupService;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('lookupByName', () => {
    it('returns exact match by name', async () => {
      const api = fakeApiClient([
        { id: '89aed99d-2bc2-4d14-bffc-9445b69cfdc2', name: 'Comet Electric Non-Prod' },
        { id: '24e6d02e-1809-4cf7-88db-c330153345e9', name: 'aroma_non_prod' },
      ]);
      service = new ClientLookupService(api as never);

      const result = await service.lookupByName('Comet Electric');
      expect(result).not.toBeNull();
      expect(result!.clientId).toBe('89aed99d-2bc2-4d14-bffc-9445b69cfdc2');
      expect(result!.name).toBe('Comet Electric Non-Prod');
    });

    it('returns fuzzy match', async () => {
      const api = fakeApiClient([
        { id: 'b2114a65-ea84-4546-9f24-417a7dcada15', name: 'Acumatica non-prod' },
      ]);
      service = new ClientLookupService(api as never);

      const result = await service.lookupByName('acumatica');
      expect(result).not.toBeNull();
      expect(result!.clientId).toBe('b2114a65-ea84-4546-9f24-417a7dcada15');
    });

    it('returns null when no match found', async () => {
      const api = fakeApiClient([
        { id: 'abc', name: 'Comet Electric Non-Prod' },
      ]);
      service = new ClientLookupService(api as never);

      const result = await service.lookupByName('Nonexistent Corp');
      expect(result).toBeNull();
    });

    it('calls the network partners endpoint', async () => {
      const api = fakeApiClient([{ id: 'abc', name: 'Test Client' }]);
      service = new ClientLookupService(api as never);

      await service.lookupByName('Test');

      expect((api as { listAllNetworkPartners: ReturnType<typeof vi.fn> }).listAllNetworkPartners)
        .toHaveBeenCalledTimes(1);
    });
  });

  describe('caching', () => {
    it('uses cached data on second call', async () => {
      const api = fakeApiClient([{ id: 'abc', name: 'Comet Electric Non-Prod' }]);
      service = new ClientLookupService(api as never);

      await service.lookupByName('Comet Electric');
      await service.lookupByName('Comet Electric');

      expect((api as { listAllNetworkPartners: ReturnType<typeof vi.fn> }).listAllNetworkPartners)
        .toHaveBeenCalledTimes(1);
    });

    it('refetches after TTL expires', async () => {
      vi.useFakeTimers();
      const api = fakeApiClient([{ id: 'abc', name: 'Test Client' }]);
      service = new ClientLookupService(api as never);

      await service.lookupByName('Test');
      vi.advanceTimersByTime(5 * 60 * 1000 + 1); // 5 min + 1ms
      await service.lookupByName('Test');

      expect((api as { listAllNetworkPartners: ReturnType<typeof vi.fn> }).listAllNetworkPartners)
        .toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });

  describe('getAllClientNames', () => {
    it('returns all client names', async () => {
      const api = fakeApiClient([
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' },
        { id: 'c', name: 'Gamma' },
      ]);
      service = new ClientLookupService(api as never);

      const names = await service.getAllClientNames();
      expect(names).toEqual(['Alpha', 'Beta', 'Gamma']);
    });
  });

  describe('error propagation', () => {
    beforeEach(() => {
      service = new ClientLookupService({
        listAllNetworkPartners: vi.fn().mockRejectedValue(new Error('Authentication failed')),
      } as never);
    });

    it('surfaces API errors from lookupByName', async () => {
      await expect(service.lookupByName('foo')).rejects.toThrow(/Authentication failed/);
    });

    it('surfaces API errors from getAllClientNames', async () => {
      await expect(service.getAllClientNames()).rejects.toThrow(/Authentication failed/);
    });
  });
});
