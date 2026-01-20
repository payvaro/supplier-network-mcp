import { describe, it, expect, beforeEach } from 'vitest';
import { analyzeNetwork } from '../network-analyzer.js';
import { createMockNetworkAPIClient, type MockNetworkAPIClient } from '../../__mocks__/api-client.mock.js';

describe('network-analyzer', () => {
  let mockClient: MockNetworkAPIClient;

  beforeEach(() => {
    mockClient = createMockNetworkAPIClient();
  });

  describe('analyzeNetwork', () => {
    it('throws "not yet implemented" error', async () => {
      await expect(analyzeNetwork(mockClient as never)).rejects.toThrow(
        'Network analysis not yet implemented'
      );
    });

    it('throws error with descriptive message about the feature', async () => {
      await expect(analyzeNetwork(mockClient as never, {})).rejects.toThrow(
        'analyze buyer-supplier connections'
      );
    });

    it('throws regardless of options provided', async () => {
      await expect(
        analyzeNetwork(mockClient as never, {
          includeSuggestions: true,
          minConnectionsForHub: 10,
        })
      ).rejects.toThrow('not yet implemented');
    });
  });
});
