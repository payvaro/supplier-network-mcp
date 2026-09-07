import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

interface JwtVerifierOptions {
  jwksUri: string;
  issuer: string;
}

/**
 * Cognito puts a user's client membership in a `CLIENT_<uuid>` group. The group name is
 * upper-cased; every consumer downstream of `x-client-id` treats the value as an opaque
 * string, so it has to be lower-cased back to the canonical UUID form (RFC 9562 s3) that
 * the `custom:clientId` attribute and the Network API's own normalization both use.
 */
const CLIENT_GROUP_PREFIX = "CLIENT_";

/**
 * Resolves the caller's tenant client id from an access token's claims.
 *
 * <p>`custom:clientId` is checked first, but a real Cognito **access** token never carries
 * it: custom attributes are ID-token-only. Client identity for an access-token caller lives
 * in `cognito:groups` as a `CLIENT_<uuid>` entry, which is what this reads. Verified against
 * a live MiniStack token — the access token carried the group and no custom attribute, so
 * reading only `custom:clientId` left every caller with a blank tenant.
 *
 * <p>The Network API resolves the same claim the same way (`getPrimaryClientId`), so a token
 * this returns nothing for is one the API will also treat as having no client context —
 * which is the correct outcome for a platform admin whose token names no single client.
 */
export function resolveTenantClientId(payload: JWTPayload): string | undefined {
  const attribute = getStringClaim(payload, "custom:clientId");
  if (attribute) return attribute.toLowerCase();

  const group = getArrayClaim(payload, "cognito:groups")
    .find((g) => g.startsWith(CLIENT_GROUP_PREFIX) && g.length > CLIENT_GROUP_PREFIX.length);

  return group?.slice(CLIENT_GROUP_PREFIX.length).toLowerCase();
}

/**
 * Maps verified claims onto the SDK's `AuthInfo`. Separate from the verification itself so
 * the claim handling — the part that differs between an ID token and an access token — is
 * testable without a signing key.
 */
export function authInfoFromClaims(payload: JWTPayload, token: string): AuthInfo {
  const tenantClientId = resolveTenantClientId(payload);

  return {
    token,
    clientId: tenantClientId ?? "",
    scopes: getScopeClaim(payload),
    expiresAt: payload.exp,
    extra: {
      tenantClientId,
      groups: getArrayClaim(payload, "cognito:groups"),
      email: getStringClaim(payload, "email"),
      sub: payload.sub,
    },
  };
}

export function createJwtVerifier(options: JwtVerifierOptions) {
  // Per-verifier, not module-level: a cached set keyed to nothing would keep serving the
  // first JWKS URI ever used, so a second verifier (or a test) would silently verify
  // against the wrong keys.
  const jwks = createRemoteJWKSet(new URL(options.jwksUri));

  return async function verifyAccessToken(token: string): Promise<AuthInfo> {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: options.issuer,
    });

    return authInfoFromClaims(payload, token);
  };
}

function getStringClaim(payload: JWTPayload, key: string): string | undefined {
  const val = payload[key];
  return typeof val === "string" && val !== "" ? val : undefined;
}

function getArrayClaim(payload: JWTPayload, key: string): string[] {
  const val = payload[key];
  return Array.isArray(val) ? val.filter((v): v is string => typeof v === "string") : [];
}

function getScopeClaim(payload: JWTPayload): string[] {
  const scope = payload["scope"];
  if (typeof scope === "string") {
    return scope.split(" ").filter(Boolean);
  }
  return [];
}
