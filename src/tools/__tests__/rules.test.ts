import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleRules } from '../rules.js';
import { createMockNetworkAPIClient, type MockNetworkAPIClient } from '../../__mocks__/api-client.mock.js';

vi.mock('../../services/api-client.js', () => ({
  getNetworkAPIClient: vi.fn(),
}));

import { getNetworkAPIClient } from '../../services/api-client.js';

describe('rules tool', () => {
  let mockClient: MockNetworkAPIClient;

  beforeEach(() => {
    mockClient = createMockNetworkAPIClient();
    vi.mocked(getNetworkAPIClient).mockReturnValue(mockClient as never);
  });

  describe('action: list', () => {
    it('calls listConfigRules with scopeType+scopeId and returns rules', async () => {
      mockClient.listConfigRules.mockResolvedValue({
        items: [{ ruleId: 'r-1', directiveType: 'NETTING', scopeType: 'BUYER', scopeId: 'BUY-1' }],
        pagination: { count: 1, pageSize: 20, hasMore: false, nextCursor: null },
      });

      const result = await handleRules({
        action: 'list',
        scopeType: 'BUYER',
        scopeId: 'BUY-1',
        pageSize: 20,
        format: 'compact',
      });

      expect(mockClient.listConfigRules).toHaveBeenCalledWith('BUYER', 'BUY-1', 20, undefined);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('r-1');
    });
  });

  describe('action: effective', () => {
    const rawEffective = {
      targetEntityType: 'BUYER',
      targetEntityId: 'BUY-IT-001',
      hierarchyLevels: [
        {
          scope: 'BUYER',
          entityId: 'BUY-IT-001',
          entityName: 'Example Buyer',
          rules: [
            {
              configRuleId: 'r-123',
              ruleType: 'NETTING',
              ruleKey: 'netting',
              ruleValue: '50.00',
              status: 'ACTIVE',
            },
          ],
        },
      ],
      effectiveRules: [
        {
          ruleType: 'NETTING',
          ruleKey: 'netting',
          effectiveValue: '50.00',
          mergeStrategy: 'MOST_SPECIFIC_WINS',
          contributingRuleIds: ['r-123'],
          explanation: 'Scope BUYER wins',
        },
      ],
    };

    it('returns compact shape by default', async () => {
      mockClient.getEffectiveRules.mockResolvedValue(rawEffective);

      const result = await handleRules({
        action: 'effective',
        entityType: 'BUYER',
        entityId: 'BUY-IT-001',
        pageSize: 20,
        format: 'compact',
      });

      expect(mockClient.getEffectiveRules).toHaveBeenCalledWith('BUYER', 'BUY-IT-001');
      expect(result.structuredContent).toMatchObject({
        entity: { type: 'BUYER', id: 'BUY-IT-001' },
      });
      expect(result.structuredContent?.effective).toBeInstanceOf(Array);
      expect(result.structuredContent?.hierarchy).toBeInstanceOf(Array);
    });

    it('returns raw shape when format=full', async () => {
      mockClient.getEffectiveRules.mockResolvedValue(rawEffective);

      const result = await handleRules({
        action: 'effective',
        entityType: 'BUYER',
        entityId: 'BUY-IT-001',
        pageSize: 20,
        format: 'full',
      });

      expect(result.structuredContent).toEqual(rawEffective);
    });

    it('surfaces 404 from API with actionable error text', async () => {
      mockClient.getEffectiveRules.mockRejectedValue(
        new Error('Request failed with status code 404'),
      );

      const result = await handleRules({
        action: 'effective',
        entityType: 'BUYER',
        entityId: 'missing',
        pageSize: 20,
        format: 'compact',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Not found');
    });
  });

  describe('action: trace', () => {
    const rawTrace = {
      buyerId: 'BUY-1',
      supplierId: 'SUP-1',
      resolved: { acceptorId: 'ACC-1', paymentType: 'CARD' },
      trace: {
        chosenPath: [{ step: 'acceptor-selection', outcome: 'WEX wins', ruleId: 'r-612' }],
        eliminated: [{ acceptorId: 'ACC-2', reason: 'require-clear failed', ruleId: 'r-555' }],
      },
    };

    it('passes optional filters through to the client and returns compact shape', async () => {
      mockClient.resolveIntegrationTrace.mockResolvedValue(rawTrace);

      const result = await handleRules({
        action: 'trace',
        buyerId: 'BUY-1',
        supplierId: 'SUP-1',
        paymentType: 'CARD',
        acceptorId: 'ACC-1',
        requireClear: true,
        pageSize: 20,
        format: 'compact',
      });

      expect(mockClient.resolveIntegrationTrace).toHaveBeenCalledWith({
        buyerId: 'BUY-1',
        supplierId: 'SUP-1',
        paymentType: 'CARD',
        acceptorId: 'ACC-1',
        requireClear: true,
      });
      expect(result.structuredContent).toMatchObject({
        pair: { buyerId: 'BUY-1', supplierId: 'SUP-1' },
      });
      expect(result.structuredContent?.chosenPath).toHaveLength(1);
      expect(result.structuredContent?.eliminated).toHaveLength(1);
    });

    it('returns raw shape when format=full', async () => {
      mockClient.resolveIntegrationTrace.mockResolvedValue(rawTrace);

      const result = await handleRules({
        action: 'trace',
        buyerId: 'BUY-1',
        supplierId: 'SUP-1',
        pageSize: 20,
        format: 'full',
      });

      expect(result.structuredContent).toEqual(rawTrace);
    });

    it('surfaces API errors', async () => {
      mockClient.resolveIntegrationTrace.mockRejectedValue(
        new Error('Request failed with status code 500'),
      );

      const result = await handleRules({
        action: 'trace',
        buyerId: 'BUY-1',
        supplierId: 'SUP-1',
        pageSize: 20,
        format: 'compact',
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('handleRules admin override (asClientId)', () => {
    const ORIG = process.env.NETWORK_ADMIN_MODE;
    afterEach(() => {
      if (ORIG === undefined) delete process.env.NETWORK_ADMIN_MODE;
      else process.env.NETWORK_ADMIN_MODE = ORIG;
    });

    it('rejects asClientId when admin mode is disabled', async () => {
      delete process.env.NETWORK_ADMIN_MODE;

      const result = await handleRules({
        action: 'list',
        scopeType: 'BUYER',
        scopeId: 'BUY-1',
        pageSize: 20,
        format: 'compact',
        asClientId: 'client-abc',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('NETWORK_ADMIN_MODE=true');
      expect(mockClient.withClientIdOverride).not.toHaveBeenCalled();
      expect(mockClient.listConfigRules).not.toHaveBeenCalled();
    });

    it('invokes withClientIdOverride and dispatches when admin mode is enabled', async () => {
      process.env.NETWORK_ADMIN_MODE = 'true';
      mockClient.listConfigRules.mockResolvedValue({
        items: [],
        pagination: { count: 0, pageSize: 20, hasMore: false, nextCursor: null },
      });

      const result = await handleRules({
        action: 'list',
        scopeType: 'BUYER',
        scopeId: 'BUY-1',
        pageSize: 20,
        format: 'compact',
        asClientId: 'client-abc',
      });

      expect(mockClient.withClientIdOverride).toHaveBeenCalledWith('client-abc');
      expect(mockClient.listConfigRules).toHaveBeenCalled();
      expect(result.isError).toBeUndefined();
    });

    it('does not invoke withClientIdOverride when asClientId is omitted', async () => {
      process.env.NETWORK_ADMIN_MODE = 'true';
      mockClient.listConfigRules.mockResolvedValue({
        items: [],
        pagination: { count: 0, pageSize: 20, hasMore: false, nextCursor: null },
      });

      await handleRules({
        action: 'list',
        scopeType: 'BUYER',
        scopeId: 'BUY-1',
        pageSize: 20,
        format: 'compact',
      });

      expect(mockClient.withClientIdOverride).not.toHaveBeenCalled();
    });
  });
});
