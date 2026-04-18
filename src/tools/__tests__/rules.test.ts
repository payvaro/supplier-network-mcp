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
});
