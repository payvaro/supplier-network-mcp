import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

interface JwtVerifierOptions {
  jwksUri: string;
  issuer: string;
}

export function createJwtVerifier(options: JwtVerifierOptions) {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(options.jwksUri));
  }

  return async function verifyAccessToken(token: string): Promise<AuthInfo> {
    const { payload } = await jwtVerify(token, jwks!, {
      issuer: options.issuer,
    });

    return {
      token,
      clientId: getStringClaim(payload, "custom:clientId") ?? "",
      scopes: getScopeClaim(payload),
      expiresAt: payload.exp,
      extra: {
        tenantClientId: getStringClaim(payload, "custom:clientId"),
        groups: getArrayClaim(payload, "cognito:groups"),
        email: getStringClaim(payload, "email"),
        sub: payload.sub,
      },
    };
  };
}

function getStringClaim(payload: JWTPayload, key: string): string | undefined {
  const val = payload[key];
  return typeof val === "string" ? val : undefined;
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
