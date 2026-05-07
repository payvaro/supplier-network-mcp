import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { lookupClientId } from '../clients.js';

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

    const result = await lookupClientId({ action: 'resolve', name: 'Comet Electric', environment: 'dev' });

    expect(result.content[0].text).toContain('Comet Electric Non-Prod');
    expect(result.content[0].text).toContain('89aed99d-2bc2-4d14-bffc-9445b69cfdc2');
    expect(result.isError).toBeUndefined();
  });

  it('returns available names when no match found', async () => {
    mockLookupByName.mockResolvedValue(null);
    mockGetAllClientNames.mockResolvedValue(['Comet Electric Non-Prod', 'aroma_non_prod']);

    const result = await lookupClientId({ action: 'resolve', name: 'Nonexistent', environment: 'dev' });

    expect(result.content[0].text).toContain('No match found');
    expect(result.content[0].text).toContain('Comet Electric Non-Prod');
    expect(result.content[0].text).toContain('aroma_non_prod');
    expect(result.isError).toBe(true);
  });

  it('passes name through without env scoping', async () => {
    mockLookupByName.mockResolvedValue({
      clientId: 'abc',
      name: 'Test Client',
    });

    await lookupClientId({ action: 'resolve', name: 'Test', environment: 'dev' });

    expect(mockLookupByName).toHaveBeenCalledWith('Test');
  });

  it('handles API errors gracefully', async () => {
    mockLookupByName.mockRejectedValue(new Error('Authentication failed'));

    const result = await lookupClientId({ action: 'resolve', name: 'Test', environment: 'dev' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error');
    expect(result.content[0].text).toContain('Authentication failed');
  });

  describe('list action', () => {
    it('returns all client names for browsing', async () => {
      mockGetAllClientNames.mockResolvedValue(['Comet Electric Non-Prod', 'aroma_non_prod', 'Acumatica']);

      const result = await lookupClientId({ action: 'list', environment: 'dev' });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Comet Electric Non-Prod');
      expect(result.content[0].text).toContain('aroma_non_prod');
      expect(result.content[0].text).toContain('Acumatica');
      expect(result.content[0].text).toContain('**Total:** 3');
      expect(mockLookupByName).not.toHaveBeenCalled();
    });

    it('surfaces errors on list', async () => {
      mockGetAllClientNames.mockRejectedValue(new Error('bucket not found'));

      const result = await lookupClientId({ action: 'list', environment: 'prod' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('list clients');
    });
  });
});
