import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lookupClientId } from '../clients.js';

// Mock the client lookup service
const mockLookupByName = vi.fn();
const mockGetAllClientNames = vi.fn();

vi.mock('../../services/client-lookup.js', () => ({
  getClientLookupService: () => ({
    lookupByName: mockLookupByName,
    getAllClientNames: mockGetAllClientNames,
  }),
}));

describe('lookupClientId tool handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns formatted match result', async () => {
    mockLookupByName.mockResolvedValue({
      clientId: '89aed99d-2bc2-4d14-bffc-9445b69cfdc2',
      name: 'Comet Electric Non-Prod',
    });

    const result = await lookupClientId({ name: 'Comet Electric', environment: 'dev' });

    expect(result.content[0].text).toContain('Comet Electric Non-Prod');
    expect(result.content[0].text).toContain('89aed99d-2bc2-4d14-bffc-9445b69cfdc2');
    expect(result.content[0].text).toContain('dev');
    expect(result.isError).toBeUndefined();
  });

  it('returns available names when no match found', async () => {
    mockLookupByName.mockResolvedValue(null);
    mockGetAllClientNames.mockResolvedValue(['Comet Electric Non-Prod', 'aroma_non_prod']);

    const result = await lookupClientId({ name: 'Nonexistent', environment: 'dev' });

    expect(result.content[0].text).toContain('No match found');
    expect(result.content[0].text).toContain('Comet Electric Non-Prod');
    expect(result.content[0].text).toContain('aroma_non_prod');
    expect(result.isError).toBe(true);
  });

  it('passes dev environment through', async () => {
    mockLookupByName.mockResolvedValue({
      clientId: 'abc',
      name: 'Test Client',
    });

    await lookupClientId({ name: 'Test', environment: 'dev' });

    expect(mockLookupByName).toHaveBeenCalledWith('Test', 'dev');
  });

  it('passes prod environment through', async () => {
    mockLookupByName.mockResolvedValue({
      clientId: 'abc',
      name: 'Test Prod',
    });

    await lookupClientId({ name: 'Test', environment: 'prod' });

    expect(mockLookupByName).toHaveBeenCalledWith('Test', 'prod');
  });

  it('handles S3 errors gracefully', async () => {
    mockLookupByName.mockRejectedValue(new Error('Access Denied'));

    const result = await lookupClientId({ name: 'Test', environment: 'dev' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
  });
});
