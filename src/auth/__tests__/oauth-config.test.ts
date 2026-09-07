import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAuthServerUrl, getJwksUri, getJwtIssuer, getMcpPublicUrl } from '../../constants.js';

describe('HTTP-mode OAuth configuration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of ['AUTH_SERVER_URL', 'JWKS_URI', 'JWT_ISSUER', 'MCP_PUBLIC_URL']) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults the auth server to port 8081, where the local stack publishes it', () => {
    // 8080 is the Network API under `pv`; the old default pointed the OAuth flow at the
    // very API it was trying to get a token for.
    expect(getAuthServerUrl()).toBe('http://localhost:8081/auth');
  });

  it('lets AUTH_SERVER_URL override the default', () => {
    process.env.AUTH_SERVER_URL = 'https://auth.example.com/auth';
    expect(getAuthServerUrl()).toBe('https://auth.example.com/auth');
  });

  it('derives the JWKS URI from the auth server, which proxies the pool keys', () => {
    expect(getJwksUri()).toBe('http://localhost:8081/auth/.well-known/jwks.json');

    process.env.AUTH_SERVER_URL = 'https://auth.example.com/auth';
    expect(getJwksUri()).toBe('https://auth.example.com/auth/.well-known/jwks.json');
  });

  it('lets JWKS_URI override the derived value', () => {
    process.env.JWKS_URI = 'https://keys.example.com/jwks.json';
    expect(getJwksUri()).toBe('https://keys.example.com/jwks.json');
  });

  it('has no issuer default -- tokens are Cognito-issued, so it must be discovered or set', () => {
    expect(getJwtIssuer()).toBeUndefined();
    expect(getJwtIssuer()).not.toBe(getAuthServerUrl());
  });

  it('returns JWT_ISSUER when it is set', () => {
    process.env.JWT_ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_zmGtqXJkW';
    expect(getJwtIssuer()).toBe('https://cognito-idp.us-west-2.amazonaws.com/us-west-2_zmGtqXJkW');
  });

  it('defaults the MCP public URL to the port the callback is registered on', () => {
    // The auth server's `mcp-server` client only accepts :3000 and :3001 callbacks.
    expect(getMcpPublicUrl()).toBe('http://localhost:3000');
  });
});
