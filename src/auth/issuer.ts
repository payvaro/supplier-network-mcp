/**
 * Resolving the issuer that access tokens actually carry.
 *
 * The auth server proxies Cognito rather than minting its own tokens, so the `iss` claim on
 * an access token is the Cognito user pool's URL
 * (`https://cognito-idp.<region>.amazonaws.com/<poolId>`) — not the auth server's. Defaulting
 * `JWT_ISSUER` to the auth server URL, as this used to, made verification fail everywhere
 * except the `local` stub profile, where the two happen to coincide.
 *
 * The auth server publishes the real answer at `/.well-known/openid-configuration`, and its
 * `issuer` there is by construction the issuer its tokens carry (it comes from the same
 * properties bean the server validates against). So ask it, and refuse to start rather than
 * guess: a wrong issuer rejects every valid token, and a silent fallback would reintroduce
 * exactly the bug this replaces.
 */
const DISCOVERY_PATH = "/.well-known/openid-configuration";

export async function resolveJwtIssuer(
  authServerUrl: string,
  explicitIssuer?: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  if (explicitIssuer) return explicitIssuer;

  const discoveryUrl = `${authServerUrl.replace(/\/$/, "")}${DISCOVERY_PATH}`;

  let response: Response;
  try {
    response = await fetchImpl(discoveryUrl);
  } catch (error) {
    throw new Error(
      `Could not reach the auth server discovery document at ${discoveryUrl} ` +
        `(${error instanceof Error ? error.message : String(error)}). ` +
        `Check AUTH_SERVER_URL, or set JWT_ISSUER explicitly to the issuer your access tokens carry.`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Auth server discovery document at ${discoveryUrl} returned ${response.status}. ` +
        `Check AUTH_SERVER_URL, or set JWT_ISSUER explicitly.`
    );
  }

  let issuer: unknown;
  try {
    issuer = ((await response.json()) as Record<string, unknown>)?.issuer;
  } catch {
    throw new Error(`Auth server discovery document at ${discoveryUrl} is not valid JSON.`);
  }

  if (typeof issuer !== "string" || issuer === "") {
    throw new Error(
      `Auth server discovery document at ${discoveryUrl} carries no 'issuer'. ` +
        `Set JWT_ISSUER explicitly.`
    );
  }

  return issuer;
}
