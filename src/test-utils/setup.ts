import { vi, beforeEach, afterEach } from 'vitest';

// Global test setup
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Mock environment variables
vi.stubEnv('NETWORK_API_KEY', 'test-api-key');
vi.stubEnv('NETWORK_API_BASE_URL', 'http://localhost:8080');
