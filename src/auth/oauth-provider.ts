import { randomUUID } from "crypto";
import type { Response } from "express";
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

export interface OAuthProviderOptions {
  authServerUrl: string;
  mcpPublicUrl: string;
  authServerClientId: string;
  verifyAccessToken: (token: string) => Promise<AuthInfo>;
}

interface PendingAuthorization {
  mcpClientRedirectUri: string;
  mcpClientState?: string;
  createdAt: number;
}

const PENDING_AUTH_TTL_MS = 10 * 60 * 1000;

export function createOAuthProvider(options: OAuthProviderOptions): OAuthServerProvider & {
  consumePendingAuth(proxyState: string): PendingAuthorization | undefined;
} {
  const clients = new Map<string, OAuthClientInformationFull>();
  const pendingAuths = new Map<string, PendingAuthorization>();

  const clientsStore: OAuthRegisteredClientsStore = {
    getClient(clientId: string) {
      return clients.get(clientId);
    },
    registerClient(metadata) {
      const clientId = randomUUID();
      const info: OAuthClientInformationFull = {
        ...metadata,
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
      };
      clients.set(clientId, info);
      console.error(`[OAuth] Registered client: ${clientId} (${metadata.client_name ?? "unnamed"})`);
      return info;
    },
  };

  const mcpCallbackUrl = `${options.mcpPublicUrl}/oauth/callback`;

  return {
    get clientsStore() {
      return clientsStore;
    },

    skipLocalPkceValidation: true,

    consumePendingAuth(proxyState: string): PendingAuthorization | undefined {
      const entry = pendingAuths.get(proxyState);
      pendingAuths.delete(proxyState);
      if (!entry) return undefined;
      if (Date.now() - entry.createdAt > PENDING_AUTH_TTL_MS) return undefined;
      return entry;
    },

    async authorize(
      _client: OAuthClientInformationFull,
      params: AuthorizationParams,
      res: Response
    ): Promise<void> {
      const proxyState = randomUUID();
      pendingAuths.set(proxyState, {
        mcpClientRedirectUri: params.redirectUri,
        mcpClientState: params.state,
        createdAt: Date.now(),
      });

      const targetUrl = new URL(`${options.authServerUrl}/oauth2/authorize`);
      const searchParams = new URLSearchParams({
        client_id: options.authServerClientId,
        response_type: "code",
        redirect_uri: mcpCallbackUrl,
        code_challenge: params.codeChallenge,
        code_challenge_method: "S256",
        state: proxyState,
      });
      if (params.scopes?.length) searchParams.set("scope", params.scopes.join(" "));
      targetUrl.search = searchParams.toString();
      res.redirect(targetUrl.toString());
    },

    async challengeForAuthorizationCode(): Promise<string> {
      return "";
    },

    async exchangeAuthorizationCode(
      _client: OAuthClientInformationFull,
      authorizationCode: string,
      codeVerifier?: string,
      _redirectUri?: string
    ): Promise<OAuthTokens> {
      const params = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: options.authServerClientId,
        code: authorizationCode,
      });
      if (codeVerifier) params.set("code_verifier", codeVerifier);
      params.set("redirect_uri", mcpCallbackUrl);

      const response = await fetch(`${options.authServerUrl}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Token exchange failed (${response.status}): ${body}`);
      }

      return (await response.json()) as OAuthTokens;
    },

    async exchangeRefreshToken(
      _client: OAuthClientInformationFull,
      refreshToken: string
    ): Promise<OAuthTokens> {
      const params = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: options.authServerClientId,
        refresh_token: refreshToken,
      });

      const response = await fetch(`${options.authServerUrl}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Token refresh failed (${response.status}): ${body}`);
      }

      return (await response.json()) as OAuthTokens;
    },

    async verifyAccessToken(token: string): Promise<AuthInfo> {
      return options.verifyAccessToken(token);
    },

    async revokeToken(
      _client: OAuthClientInformationFull,
      request: OAuthTokenRevocationRequest
    ): Promise<void> {
      const params = new URLSearchParams({
        token: request.token,
        client_id: options.authServerClientId,
      });

      await fetch(`${options.authServerUrl}/oauth2/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      }).catch(() => {});
    },
  };
}
