import { describe, it, expect, vi } from 'vitest';
import { resolveJwtIssuer } from '../issuer.js';

const COGNITO_ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_zmGtqXJkW';
const AUTH_SERVER = 'http://localhost:8081/auth';

function discoveryReturning(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as unknown as Response);
}

describe('resolveJwtIssuer', () => {
  it('uses an explicit JWT_ISSUER without contacting the auth server', async () => {
    const fetchImpl = discoveryReturning({ issuer: 'ignored' });
    await expect(resolveJwtIssuer(AUTH_SERVER, COGNITO_ISSUER, fetchImpl)).resolves.toBe(COGNITO_ISSUER);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('discovers the Cognito issuer -- not the auth server URL -- when unset', async () => {
    const fetchImpl = discoveryReturning({ issuer: COGNITO_ISSUER });
    await expect(resolveJwtIssuer(AUTH_SERVER, undefined, fetchImpl)).resolves.toBe(COGNITO_ISSUER);
    expect(fetchImpl).toHaveBeenCalledWith(`${AUTH_SERVER}/.well-known/openid-configuration`);
  });

  it('does not double up the slash when the auth server URL has a trailing one', async () => {
    const fetchImpl = discoveryReturning({ issuer: COGNITO_ISSUER });
    await resolveJwtIssuer(`${AUTH_SERVER}/`, undefined, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(`${AUTH_SERVER}/.well-known/openid-configuration`);
  });

  it('treats an empty JWT_ISSUER as unset rather than as an issuer', async () => {
    const fetchImpl = discoveryReturning({ issuer: COGNITO_ISSUER });
    await expect(resolveJwtIssuer(AUTH_SERVER, '', fetchImpl)).resolves.toBe(COGNITO_ISSUER);
  });

  it('fails loudly when the auth server is unreachable, naming both escape hatches', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(resolveJwtIssuer(AUTH_SERVER, undefined, fetchImpl))
      .rejects.toThrow(/ECONNREFUSED[\s\S]*AUTH_SERVER_URL[\s\S]*JWT_ISSUER/);
  });

  it('fails on a non-2xx discovery response', async () => {
    const fetchImpl = discoveryReturning({}, false, 503);
    await expect(resolveJwtIssuer(AUTH_SERVER, undefined, fetchImpl)).rejects.toThrow(/returned 503/);
  });

  it('fails on a discovery body that is not JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('not json'); },
    } as unknown as Response);
    await expect(resolveJwtIssuer(AUTH_SERVER, undefined, fetchImpl)).rejects.toThrow(/not valid JSON/);
  });

  it.each([
    ['a missing issuer', {}],
    ['an empty issuer', { issuer: '' }],
    ['a non-string issuer', { issuer: 42 }],
  ])('fails rather than guessing on %s', async (_label, body) => {
    const fetchImpl = discoveryReturning(body);
    await expect(resolveJwtIssuer(AUTH_SERVER, undefined, fetchImpl))
      .rejects.toThrow(/no 'issuer'|Set JWT_ISSUER/);
  });

  it('never falls back to the auth server URL, which is the bug it replaces', async () => {
    const fetchImpl = discoveryReturning({}, false, 404);
    await expect(resolveJwtIssuer(AUTH_SERVER, undefined, fetchImpl)).rejects.toThrow();
    // i.e. no code path resolves to AUTH_SERVER; a wrong issuer rejects every valid token.
  });
});
