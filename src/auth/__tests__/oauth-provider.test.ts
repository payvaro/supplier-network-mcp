import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Response } from 'express';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { createOAuthProvider } from '../oauth-provider.js';

const AUTH_SERVER = 'http://localhost:8081/auth';
const MCP_PUBLIC = 'http://localhost:3000';
const CALLBACK = `${MCP_PUBLIC}/oauth/callback`;

const CLIENT = { client_id: 'mcp-client-uuid' } as OAuthClientInformationFull;

function makeProvider() {
  return createOAuthProvider({
    authServerUrl: AUTH_SERVER,
    mcpPublicUrl: MCP_PUBLIC,
    authServerClientId: 'mcp-server',
    verifyAccessToken: async (token) => ({ token, clientId: 'tenant', scopes: [] }),
  });
}

function fakeRes() {
  return { redirect: vi.fn() } as unknown as Response & { redirect: ReturnType<typeof vi.fn> };
}

function redirectedTo(res: ReturnType<typeof fakeRes>): URL {
  return new URL(res.redirect.mock.calls.at(-1)?.[0] as string);
}

function tokenResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function lastFetchBody(fetchMock: ReturnType<typeof vi.fn>): URLSearchParams {
  return new URLSearchParams(fetchMock.mock.calls.at(-1)?.[1]?.body as string);
}

describe('oauth provider: dynamic client registration', () => {
  it('issues a distinct client_id per registration and can look it back up', () => {
    const provider = makeProvider();
    const store = provider.clientsStore;

    const a = store.registerClient!({ redirect_uris: ['http://a/cb'] } as OAuthClientInformationFull);
    const b = store.registerClient!({ redirect_uris: ['http://b/cb'] } as OAuthClientInformationFull);

    expect(a.client_id).not.toBe(b.client_id);
    expect(store.getClient(a.client_id)).toBe(a);
    expect(store.getClient('never-registered')).toBeUndefined();
    expect(a.client_id_issued_at).toBeTypeOf('number');
  });
});

describe('oauth provider: authorize', () => {
  it('redirects to the auth server with the pre-registered client and PKCE challenge', async () => {
    const provider = makeProvider();
    const res = fakeRes();

    await provider.authorize(CLIENT, {
      redirectUri: 'http://mcp-client/callback',
      codeChallenge: 'challenge-value',
      state: 'client-state',
      scopes: ['read', 'write'],
    } as never, res);

    const url = redirectedTo(res);
    expect(url.origin + url.pathname).toBe(`${AUTH_SERVER}/oauth2/authorize`);
    expect(url.searchParams.get('client_id')).toBe('mcp-server');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBe(CALLBACK);
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('read write');
  });

  it('substitutes its own state and keeps the client state out of the upstream request', async () => {
    const provider = makeProvider();
    const res = fakeRes();

    await provider.authorize(CLIENT, {
      redirectUri: 'http://mcp-client/callback',
      codeChallenge: 'c',
      state: 'client-state',
    } as never, res);

    const proxyState = redirectedTo(res).searchParams.get('state')!;
    expect(proxyState).not.toBe('client-state');

    // The bridge maps it back on the way home.
    expect(provider.consumePendingAuth(proxyState)).toMatchObject({
      mcpClientRedirectUri: 'http://mcp-client/callback',
      mcpClientState: 'client-state',
    });
  });

  it('omits scope entirely when the client asked for none', async () => {
    const provider = makeProvider();
    const res = fakeRes();
    await provider.authorize(CLIENT, { redirectUri: 'http://c/cb', codeChallenge: 'c', scopes: [] } as never, res);
    expect(redirectedTo(res).searchParams.has('scope')).toBe(false);
  });

  it('keeps concurrent authorizations apart', async () => {
    const provider = makeProvider();
    const first = fakeRes();
    const second = fakeRes();

    await provider.authorize(CLIENT, { redirectUri: 'http://one/cb', codeChallenge: 'c', state: 's1' } as never, first);
    await provider.authorize(CLIENT, { redirectUri: 'http://two/cb', codeChallenge: 'c', state: 's2' } as never, second);

    expect(provider.consumePendingAuth(redirectedTo(first).searchParams.get('state')!))
      .toMatchObject({ mcpClientRedirectUri: 'http://one/cb', mcpClientState: 's1' });
    expect(provider.consumePendingAuth(redirectedTo(second).searchParams.get('state')!))
      .toMatchObject({ mcpClientRedirectUri: 'http://two/cb', mcpClientState: 's2' });
  });
});

describe('oauth provider: pending authorization state', () => {
  it('is single-use -- a replayed state resolves to nothing', async () => {
    const provider = makeProvider();
    const res = fakeRes();
    await provider.authorize(CLIENT, { redirectUri: 'http://c/cb', codeChallenge: 'c' } as never, res);
    const state = redirectedTo(res).searchParams.get('state')!;

    expect(provider.consumePendingAuth(state)).toBeDefined();
    expect(provider.consumePendingAuth(state)).toBeUndefined();
  });

  it('rejects a state that was never issued', () => {
    expect(makeProvider().consumePendingAuth('forged-state')).toBeUndefined();
  });

  it('expires after the 10 minute TTL', async () => {
    vi.useFakeTimers();
    try {
      const provider = makeProvider();
      const res = fakeRes();
      await provider.authorize(CLIENT, { redirectUri: 'http://c/cb', codeChallenge: 'c' } as never, res);
      const state = redirectedTo(res).searchParams.get('state')!;

      vi.advanceTimersByTime(10 * 60 * 1000 + 1);

      expect(provider.consumePendingAuth(state)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('is still valid just inside the TTL', async () => {
    vi.useFakeTimers();
    try {
      const provider = makeProvider();
      const res = fakeRes();
      await provider.authorize(CLIENT, { redirectUri: 'http://c/cb', codeChallenge: 'c' } as never, res);
      const state = redirectedTo(res).searchParams.get('state')!;

      vi.advanceTimersByTime(10 * 60 * 1000 - 1000);

      expect(provider.consumePendingAuth(state)).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('oauth provider: token exchange', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts the authorization_code grant the auth server requires', async () => {
    fetchMock.mockResolvedValue(tokenResponse({ access_token: 'at', token_type: 'Bearer', expires_in: 3600 }));

    const tokens = await makeProvider().exchangeAuthorizationCode(CLIENT, 'the-code', 'the-verifier');

    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(`${AUTH_SERVER}/oauth2/token`);
    const body = lastFetchBody(fetchMock);
    // All four are mandatory on this grant server-side; a missing one is a 400 invalid_request.
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_id')).toBe('mcp-server');
    expect(body.get('code')).toBe('the-code');
    expect(body.get('code_verifier')).toBe('the-verifier');
    expect(body.get('redirect_uri')).toBe(CALLBACK);
    expect(tokens.access_token).toBe('at');
  });

  it('surfaces the auth server error body when the exchange fails', async () => {
    fetchMock.mockResolvedValue(
      tokenResponse({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' }, false, 400)
    );

    await expect(makeProvider().exchangeAuthorizationCode(CLIENT, 'stale-code', 'v'))
      .rejects.toThrow(/400.*invalid_grant/s);
  });

  it('posts the refresh_token grant', async () => {
    fetchMock.mockResolvedValue(tokenResponse({ access_token: 'at2', token_type: 'Bearer', expires_in: 3600 }));

    const tokens = await makeProvider().exchangeRefreshToken(CLIENT, 'the-refresh-token');

    const body = lastFetchBody(fetchMock);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('the-refresh-token');
    expect(body.get('client_id')).toBe('mcp-server');
    expect(tokens.access_token).toBe('at2');
  });

  it('surfaces a failed refresh', async () => {
    fetchMock.mockResolvedValue(tokenResponse({ error: 'invalid_grant' }, false, 400));
    await expect(makeProvider().exchangeRefreshToken(CLIENT, 'dead')).rejects.toThrow(/Token refresh failed \(400\)/);
  });

  it('posts revocation and stays quiet when the auth server rejects it', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(makeProvider().revokeToken!(CLIENT, { token: 'tok' })).resolves.toBeUndefined();

    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(`${AUTH_SERVER}/oauth2/revoke`);
    expect(lastFetchBody(fetchMock).get('token')).toBe('tok');
  });

  it('delegates access token verification to the injected verifier', async () => {
    const verifyAccessToken = vi.fn().mockResolvedValue({ token: 't', clientId: 'tenant', scopes: [] });
    const provider = createOAuthProvider({
      authServerUrl: AUTH_SERVER,
      mcpPublicUrl: MCP_PUBLIC,
      authServerClientId: 'mcp-server',
      verifyAccessToken,
    });

    await expect(provider.verifyAccessToken('t')).resolves.toMatchObject({ clientId: 'tenant' });
    expect(verifyAccessToken).toHaveBeenCalledWith('t');
  });
});
