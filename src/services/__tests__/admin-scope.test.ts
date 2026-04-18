import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockLookupByName = vi.fn();
const mockGetAllClientNames = vi.fn();

vi.mock('../client-lookup.js', () => ({
  getClientLookupService: () => ({
    lookupByName: mockLookupByName,
    getAllClientNames: mockGetAllClientNames,
  }),
}));

import { resolveAdminScope, isAdminScopeRejection } from '../admin-scope.js';

describe('resolveAdminScope', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NETWORK_ADMIN_MODE;
    delete process.env.NETWORK_ENVIRONMENT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns undefined clientId when neither override is provided', async () => {
    const result = await resolveAdminScope({}, 'suppliers');
    expect(isAdminScopeRejection(result)).toBe(false);
    if (!isAdminScopeRejection(result)) expect(result.clientId).toBeUndefined();
  });

  it('passes asClientId through unchanged when admin mode enabled', async () => {
    process.env.NETWORK_ADMIN_MODE = 'true';
    const result = await resolveAdminScope({ asClientId: 'client-abc' }, 'suppliers');
    expect(isAdminScopeRejection(result)).toBe(false);
    if (!isAdminScopeRejection(result)) expect(result.clientId).toBe('client-abc');
    expect(mockLookupByName).not.toHaveBeenCalled();
  });

  it('rejects asClientId when admin mode disabled', async () => {
    const result = await resolveAdminScope({ asClientId: 'x' }, 'suppliers');
    expect(isAdminScopeRejection(result)).toBe(true);
    if (isAdminScopeRejection(result)) {
      expect(result.content[0].text).toContain('NETWORK_ADMIN_MODE');
    }
  });

  it('rejects when both asClientId and asClientName are provided', async () => {
    process.env.NETWORK_ADMIN_MODE = 'true';
    const result = await resolveAdminScope(
      { asClientId: 'id', asClientName: 'name' },
      'buyers',
    );
    expect(isAdminScopeRejection(result)).toBe(true);
    if (isAdminScopeRejection(result)) {
      expect(result.content[0].text).toMatch(/Provide only one|mutually exclusive/i);
    }
  });

  it('resolves asClientName via client-lookup service', async () => {
    process.env.NETWORK_ADMIN_MODE = 'true';
    mockLookupByName.mockResolvedValue({ clientId: 'uuid-123', name: 'Comet Electric' });

    const result = await resolveAdminScope({ asClientName: 'Comet' }, 'suppliers');

    expect(mockLookupByName).toHaveBeenCalledWith('Comet', 'dev');
    expect(isAdminScopeRejection(result)).toBe(false);
    if (!isAdminScopeRejection(result)) expect(result.clientId).toBe('uuid-123');
  });

  it('uses NETWORK_ENVIRONMENT when set', async () => {
    process.env.NETWORK_ADMIN_MODE = 'true';
    process.env.NETWORK_ENVIRONMENT = 'prod';
    mockLookupByName.mockResolvedValue({ clientId: 'x', name: 'y' });

    await resolveAdminScope({ asClientName: 'foo' }, 'suppliers');

    expect(mockLookupByName).toHaveBeenCalledWith('foo', 'prod');
  });

  it('returns actionable error with available names when asClientName has no match', async () => {
    process.env.NETWORK_ADMIN_MODE = 'true';
    mockLookupByName.mockResolvedValue(null);
    mockGetAllClientNames.mockResolvedValue(['Alpha', 'Beta']);

    const result = await resolveAdminScope({ asClientName: 'ZZZ' }, 'suppliers');

    expect(isAdminScopeRejection(result)).toBe(true);
    if (isAdminScopeRejection(result)) {
      expect(result.content[0].text).toContain('No client matched');
      expect(result.content[0].text).toContain('Alpha');
      expect(result.content[0].text).toContain('Beta');
    }
  });

  it('wraps S3/lookup errors with guidance to use asClientId fallback', async () => {
    process.env.NETWORK_ADMIN_MODE = 'true';
    mockLookupByName.mockRejectedValue(new Error('Access Denied'));

    const result = await resolveAdminScope({ asClientName: 'X' }, 'suppliers');

    expect(isAdminScopeRejection(result)).toBe(true);
    if (isAdminScopeRejection(result)) {
      expect(result.content[0].text).toContain('Failed to resolve');
      expect(result.content[0].text).toContain('asClientId');
      expect(result.content[0].text).toContain('Access Denied');
    }
  });

  it('rejects asClientName when admin mode disabled', async () => {
    const result = await resolveAdminScope({ asClientName: 'X' }, 'suppliers');
    expect(isAdminScopeRejection(result)).toBe(true);
    expect(mockLookupByName).not.toHaveBeenCalled();
  });
});
