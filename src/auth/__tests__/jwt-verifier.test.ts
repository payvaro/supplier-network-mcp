import { describe, it, expect } from 'vitest';
import type { JWTPayload } from 'jose';
import { authInfoFromClaims, resolveTenantClientId } from '../jwt-verifier.js';

// Shape taken verbatim from a live MiniStack access token (claims only, no signature):
// note what is NOT here -- no `custom:clientId`, no `email`. Cognito puts custom attributes
// on the ID token only, which is the whole reason resolveTenantClientId reads the group.
const ACCESS_TOKEN_CLAIMS: JWTPayload = {
  sub: '9da815cb-b318-4bf0-8dc0-56b3ee150dcf',
  iss: 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_zmGtqXJkW',
  token_use: 'access',
  scope: 'aws.cognito.signin.user.admin',
  exp: 1788745378,
  'cognito:groups': [
    'PLATFORM_ADMIN',
    'ADMIN',
    'WRITE',
    'CLIENT_6587D65E-6C5C-4BFF-93E3-0B517441A819',
  ],
};

describe('resolveTenantClientId', () => {
  it('reads the client id from the CLIENT_ group on a real access token', () => {
    expect(resolveTenantClientId(ACCESS_TOKEN_CLAIMS))
      .toBe('6587d65e-6c5c-4bff-93e3-0b517441a819');
  });

  it('lower-cases the group-derived id to canonical UUID form', () => {
    const id = resolveTenantClientId({ 'cognito:groups': ['CLIENT_ABCDEF12-3456-7890-ABCD-EF1234567890'] });
    expect(id).toBe('abcdef12-3456-7890-abcd-ef1234567890');
  });

  it('prefers the custom:clientId attribute when present (stub/ID-token callers)', () => {
    const id = resolveTenantClientId({
      'custom:clientId': 'AAAA1111-2222-3333-4444-555566667777',
      'cognito:groups': ['CLIENT_BBBB1111-2222-3333-4444-555566667777'],
    });
    expect(id).toBe('aaaa1111-2222-3333-4444-555566667777');
  });

  it('returns undefined when the token names no client', () => {
    expect(resolveTenantClientId({ 'cognito:groups': ['PLATFORM_ADMIN', 'WRITE'] })).toBeUndefined();
    expect(resolveTenantClientId({})).toBeUndefined();
  });

  it('ignores a bare CLIENT_ group with no id after the prefix', () => {
    expect(resolveTenantClientId({ 'cognito:groups': ['CLIENT_'] })).toBeUndefined();
  });

  it('ignores an empty custom:clientId rather than returning ""', () => {
    expect(resolveTenantClientId({ 'custom:clientId': '' })).toBeUndefined();
  });

  it('ignores non-string group entries', () => {
    expect(resolveTenantClientId({ 'cognito:groups': [42, null, 'CLIENT_dead-beef'] as unknown as string[] }))
      .toBe('dead-beef');
  });

  it('returns undefined when cognito:groups is not an array', () => {
    expect(resolveTenantClientId({ 'cognito:groups': 'CLIENT_abc' })).toBeUndefined();
  });
});

describe('authInfoFromClaims', () => {
  it('maps a real access token onto AuthInfo with a resolved tenant', () => {
    const info = authInfoFromClaims(ACCESS_TOKEN_CLAIMS, 'the-token');

    expect(info.token).toBe('the-token');
    expect(info.clientId).toBe('6587d65e-6c5c-4bff-93e3-0b517441a819');
    expect(info.expiresAt).toBe(1788745378);
    expect(info.scopes).toEqual(['aws.cognito.signin.user.admin']);
    expect(info.extra).toMatchObject({
      tenantClientId: '6587d65e-6c5c-4bff-93e3-0b517441a819',
      groups: ['PLATFORM_ADMIN', 'ADMIN', 'WRITE', 'CLIENT_6587D65E-6C5C-4BFF-93E3-0B517441A819'],
      sub: '9da815cb-b318-4bf0-8dc0-56b3ee150dcf',
    });
  });

  it('leaves tenantClientId undefined -- never "" -- when no client is named', () => {
    const info = authInfoFromClaims({ sub: 'abc', 'cognito:groups': ['PLATFORM_ADMIN'] }, 't');

    // clientId is "" because the SDK's AuthInfo requires a string, but `extra` carries the
    // honest undefined: it is what the tool dispatch passes on, and an empty string there
    // would fall back to the server-wide NETWORK_CLIENT_ID.
    expect(info.clientId).toBe('');
    expect(info.extra?.tenantClientId).toBeUndefined();
  });

  it('carries email when the token has one (stub profile) and omits it otherwise', () => {
    expect(authInfoFromClaims({ email: 'admin@example.com' }, 't').extra?.email)
      .toBe('admin@example.com');
    expect(authInfoFromClaims(ACCESS_TOKEN_CLAIMS, 't').extra?.email).toBeUndefined();
  });

  it('returns no scopes when the scope claim is absent or not a string', () => {
    expect(authInfoFromClaims({}, 't').scopes).toEqual([]);
    expect(authInfoFromClaims({ scope: ['a'] as unknown as string }, 't').scopes).toEqual([]);
  });

  it('splits a multi-scope claim on spaces', () => {
    expect(authInfoFromClaims({ scope: 'read  write' }, 't').scopes).toEqual(['read', 'write']);
  });
});
