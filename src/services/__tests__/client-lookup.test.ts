import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClientLookupService } from '../client-lookup.js';

// Mock @aws-sdk/client-s3
const mockSend = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: class {
      send = mockSend;
      destroy = vi.fn();
    },
    GetObjectCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

function createS3Response(clients: Array<{ id: string; name: string }>) {
  const body = JSON.stringify({
    clients: clients.map(c => ({
      ...c,
      tokens: ['fake-token'],
      networkAccessList: ['READ', 'WRITE'],
      paymentsAccessList: ['READ', 'WRITE'],
    })),
  });
  return {
    Body: {
      transformToString: vi.fn().mockResolvedValue(body),
    },
  };
}

describe('ClientLookupService', () => {
  let service: ClientLookupService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClientLookupService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('lookupByName', () => {
    it('returns exact match by name', async () => {
      mockSend.mockResolvedValue(createS3Response([
        { id: '89aed99d-2bc2-4d14-bffc-9445b69cfdc2', name: 'Comet Electric Non-Prod' },
        { id: '24e6d02e-1809-4cf7-88db-c330153345e9', name: 'aroma_non_prod' },
      ]));

      const result = await service.lookupByName('Comet Electric');
      expect(result).not.toBeNull();
      expect(result!.clientId).toBe('89aed99d-2bc2-4d14-bffc-9445b69cfdc2');
      expect(result!.name).toBe('Comet Electric Non-Prod');
    });

    it('returns fuzzy match', async () => {
      mockSend.mockResolvedValue(createS3Response([
        { id: 'b2114a65-ea84-4546-9f24-417a7dcada15', name: 'Acumatica non-prod' },
      ]));

      const result = await service.lookupByName('acumatica');
      expect(result).not.toBeNull();
      expect(result!.clientId).toBe('b2114a65-ea84-4546-9f24-417a7dcada15');
    });

    it('returns null when no match found', async () => {
      mockSend.mockResolvedValue(createS3Response([
        { id: 'abc', name: 'Comet Electric Non-Prod' },
      ]));

      const result = await service.lookupByName('Nonexistent Corp');
      expect(result).toBeNull();
    });

    it('fetches from correct S3 bucket for dev', async () => {
      mockSend.mockResolvedValue(createS3Response([
        { id: 'abc', name: 'Test Client' },
      ]));

      await service.lookupByName('Test', 'dev');

      const command = mockSend.mock.calls[0][0];
      expect(command.input).toEqual({
        Bucket: 'payvaro-configuration-dev',
        Key: 'clients.json',
      });
    });

    it('fetches from correct S3 bucket for prod', async () => {
      mockSend.mockResolvedValue(createS3Response([
        { id: 'abc', name: 'Test Client' },
      ]));

      await service.lookupByName('Test', 'prod');

      const command = mockSend.mock.calls[0][0];
      expect(command.input).toEqual({
        Bucket: 'payvaro-configuration-prod',
        Key: 'clients.json',
      });
    });
  });

  describe('caching', () => {
    it('uses cached data on second call', async () => {
      mockSend.mockResolvedValue(createS3Response([
        { id: 'abc', name: 'Comet Electric Non-Prod' },
      ]));

      await service.lookupByName('Comet Electric', 'dev');
      await service.lookupByName('Comet Electric', 'dev');

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('caches per environment independently', async () => {
      mockSend.mockResolvedValue(createS3Response([
        { id: 'abc', name: 'Comet Electric Non-Prod' },
      ]));

      await service.lookupByName('Comet Electric', 'dev');
      await service.lookupByName('Comet Electric', 'prod');

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('refetches after TTL expires', async () => {
      vi.useFakeTimers();
      mockSend.mockResolvedValue(createS3Response([
        { id: 'abc', name: 'Test Client' },
      ]));

      await service.lookupByName('Test', 'dev');
      vi.advanceTimersByTime(5 * 60 * 1000 + 1); // 5 min + 1ms
      await service.lookupByName('Test', 'dev');

      expect(mockSend).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });

  describe('getAllClientNames', () => {
    it('returns all client names for an environment', async () => {
      mockSend.mockResolvedValue(createS3Response([
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' },
        { id: 'c', name: 'Gamma' },
      ]));

      const names = await service.getAllClientNames('dev');
      expect(names).toEqual(['Alpha', 'Beta', 'Gamma']);
    });
  });
});
