import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

export interface AuthContext {
  accessToken: string;
  tenantClientId: string;
  groups: string[];
  email?: string;
}

export function extractAuthContext(authInfo: AuthInfo | undefined): AuthContext | undefined {
  if (!authInfo) return undefined;

  const extra = authInfo.extra as Record<string, unknown> | undefined;

  return {
    accessToken: authInfo.token,
    tenantClientId: (extra?.tenantClientId as string) ?? authInfo.clientId,
    groups: (extra?.groups as string[]) ?? [],
    email: extra?.email as string | undefined,
  };
}
