import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { createAuthenticatedClient, NetworkAPIClient } from '../../services/api-client.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

const TOKEN = 'header.payload.signature';
const TENANT = '6587d65e-6c5c-4bff-93e3-0b517441a819';

function headersOfLastClient(): Record<string, string> {
  const call = mockedAxios.create.mock.calls.at(-1)?.[0];
  return (call?.headers ?? {}) as Record<string, string>;
}

describe('createAuthenticatedClient (HTTP/OAuth mode)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.create.mockReturnValue({} as unknown as ReturnType<typeof axios.create>);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.NETWORK_CLIENT_ID;
    delete process.env.NETWORK_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('sends the user token as a bearer credential, not as an API key', () => {
    createAuthenticatedClient(TOKEN, TENANT);
    expect(headersOfLastClient()['Authorization']).toBe(`Bearer ${TOKEN}`);
  });

  it('scopes the request to the tenant the token proves', () => {
    createAuthenticatedClient(TOKEN, TENANT);
    expect(headersOfLastClient()['x-client-id']).toBe(TENANT);
  });

  it('omits x-client-id when the token names no client', () => {
    createAuthenticatedClient(TOKEN);
    expect(headersOfLastClient()).not.toHaveProperty('x-client-id');
  });

  it('never falls back to NETWORK_CLIENT_ID for an authenticated user', () => {
    // The tenant-isolation bug this guards: an admin whose token names no client would
    // otherwise inherit whichever tenant the server happens to be configured with.
    process.env.NETWORK_CLIENT_ID = 'server-wide-default-tenant';

    createAuthenticatedClient(TOKEN);

    expect(headersOfLastClient()).not.toHaveProperty('x-client-id');
    expect(JSON.stringify(headersOfLastClient())).not.toContain('server-wide-default-tenant');
  });

  it('never falls back to NETWORK_API_KEY for an authenticated user', () => {
    process.env.NETWORK_API_KEY = 'static-operator-key';

    createAuthenticatedClient('');

    expect(headersOfLastClient()).not.toHaveProperty('Authorization');
  });

  it('treats an empty tenant string the same as an absent one', () => {
    process.env.NETWORK_CLIENT_ID = 'server-wide-default-tenant';
    createAuthenticatedClient(TOKEN, '');
    expect(headersOfLastClient()).not.toHaveProperty('x-client-id');
  });

  it('honours NETWORK_API_BASE_URL for the per-user client', () => {
    process.env.NETWORK_API_BASE_URL = 'https://network.example.com';
    createAuthenticatedClient(TOKEN, TENANT);
    expect(mockedAxios.create.mock.calls.at(-1)?.[0]?.baseURL).toBe('https://network.example.com');
  });

  it('still supports the admin per-request override on a per-user client', () => {
    const client = createAuthenticatedClient(TOKEN, TENANT);
    const scoped = client.withClientIdOverride('other-tenant');

    expect(scoped).toBeInstanceOf(NetworkAPIClient);
    expect(headersOfLastClient()['x-client-id']).toBe('other-tenant');
    expect(headersOfLastClient()['Authorization']).toBe(`Bearer ${TOKEN}`);
  });

  it('by contrast, the stdio constructor keeps its environment fallbacks', () => {
    process.env.NETWORK_CLIENT_ID = 'server-wide-default-tenant';
    process.env.NETWORK_API_KEY = 'static-operator-key';

    new NetworkAPIClient();

    expect(headersOfLastClient()['x-client-id']).toBe('server-wide-default-tenant');
    expect(headersOfLastClient()['Authorization']).toBe('Bearer static-operator-key');
  });
});
