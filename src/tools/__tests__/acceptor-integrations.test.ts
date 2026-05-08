import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { createAcceptorIntegrationMock, listAcceptorIntegrationsForSupplierMock } = vi.hoisted(
  () => ({
    createAcceptorIntegrationMock: vi.fn(),
    listAcceptorIntegrationsForSupplierMock: vi.fn(),
  }),
);

vi.mock('../../services/api-client.js', () => {
  const fakeClient = {
    withClientIdOverride: vi.fn().mockReturnThis(),
    createAcceptorIntegration: createAcceptorIntegrationMock,
    listAcceptorIntegrationsForSupplier: listAcceptorIntegrationsForSupplierMock,
  };
  return {
    getNetworkAPIClient: () => fakeClient,
    NetworkAPIClient: class {},
  };
});

import { handleAcceptorIntegrations } from '../acceptor-integrations.js';

describe('handleAcceptorIntegrations write-gating', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NETWORK_ADMIN_MODE;
    delete process.env.NETWORK_ENVIRONMENT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults create to dryRun and never calls the API', async () => {
    const result = await handleAcceptorIntegrations({
      action: 'create',
      supplierId: 's1',
      acceptorId: 'ACC#1',
      providerId: 'p',
      rail: 'CARD',
    });

    expect(createAcceptorIntegrationMock).not.toHaveBeenCalled();
    expect((result as { isError?: boolean }).isError).toBeFalsy();
    const text = (result as { content: { text: string }[] }).content[0].text;
    expect(text).toContain('Dry Run');
  });

  it('rejects prod live writes without confirm and never calls the API', async () => {
    process.env.NETWORK_ENVIRONMENT = 'prod';
    process.env.NETWORK_ADMIN_MODE = 'true';

    const result = await handleAcceptorIntegrations({
      action: 'create',
      supplierId: 's1',
      acceptorId: 'ACC#1',
      providerId: 'p',
      rail: 'CARD',
      dryRun: false,
    });

    expect(createAcceptorIntegrationMock).not.toHaveBeenCalled();
    expect((result as { isError: boolean }).isError).toBe(true);
    const text = (result as { content: { text: string }[] }).content[0].text;
    expect(text).toContain('confirm: true');
  });

  it('rejects prod live writes without admin mode and never calls the API', async () => {
    process.env.NETWORK_ENVIRONMENT = 'prod';

    const result = await handleAcceptorIntegrations({
      action: 'create',
      supplierId: 's1',
      acceptorId: 'ACC#1',
      providerId: 'p',
      rail: 'CARD',
      dryRun: false,
      confirm: true,
    });

    expect(createAcceptorIntegrationMock).not.toHaveBeenCalled();
    expect((result as { isError: boolean }).isError).toBe(true);
    expect((result as { content: { text: string }[] }).content[0].text).toContain(
      'NETWORK_ADMIN_MODE',
    );
  });

  it('persists when prod gate is fully satisfied', async () => {
    process.env.NETWORK_ENVIRONMENT = 'prod';
    process.env.NETWORK_ADMIN_MODE = 'true';
    createAcceptorIntegrationMock.mockResolvedValue({ id: 'ai-1' });

    const result = await handleAcceptorIntegrations({
      action: 'create',
      supplierId: 's1',
      acceptorId: 'ACC#1',
      providerId: 'p',
      rail: 'CARD',
      dryRun: false,
      confirm: true,
    });

    expect(createAcceptorIntegrationMock).toHaveBeenCalledOnce();
    expect((result as { isError?: boolean }).isError).toBeFalsy();
  });

  it('list does not invoke the gate (no write)', async () => {
    listAcceptorIntegrationsForSupplierMock.mockResolvedValue([]);
    const result = await handleAcceptorIntegrations({ action: 'list', supplierId: 's1' });

    expect(listAcceptorIntegrationsForSupplierMock).toHaveBeenCalledOnce();
    expect((result as { isError?: boolean }).isError).toBeFalsy();
  });
});
