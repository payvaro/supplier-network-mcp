// API Configuration
export const DEFAULT_BASE_URL = "http://localhost:8080";

// Authentication
export const AUTH_HEADER = "Authorization";
export const CLIENT_ID_HEADER = "x-client-id";

// Admin mode — when set to "true", tools may accept an `asClientId` per-request
// override that replaces the x-client-id header for that call. The backing API
// key is assumed to have permission to act on behalf of any client.
export const NETWORK_ADMIN_MODE_ENV = "NETWORK_ADMIN_MODE";

export function isAdminMode(): boolean {
  return process.env[NETWORK_ADMIN_MODE_ENV] === "true";
}

// OAuth / HTTP mode configuration
export const AUTH_SERVER_URL_ENV = "AUTH_SERVER_URL";
export const JWKS_URI_ENV = "JWKS_URI";
export const JWT_ISSUER_ENV = "JWT_ISSUER";
export const MCP_PUBLIC_URL_ENV = "MCP_PUBLIC_URL";

export function getAuthServerUrl(): string {
  return process.env[AUTH_SERVER_URL_ENV] ?? "http://localhost:8080/auth";
}

export function getJwksUri(): string {
  return process.env[JWKS_URI_ENV] ?? `${getAuthServerUrl()}/.well-known/jwks.json`;
}

export function getJwtIssuer(): string {
  return process.env[JWT_ISSUER_ENV] ?? getAuthServerUrl();
}

export function getMcpPublicUrl(): string {
  return process.env[MCP_PUBLIC_URL_ENV] ?? "http://localhost:3000";
}

// Slack Configuration
export const DEFAULT_SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";

// Response formatting
export const CHARACTER_LIMIT = 10000;

// Pagination defaults
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// Response formats
export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

// Match thresholds for fuzzy matching
export const MATCH_THRESHOLDS = {
  EXACT: 1.0,
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.4
};

// History format options
export enum HistoryFormat {
  TIMELINE = "timeline",
  COMPACT = "compact",
  DEFAULT = "default"
}

// Connection status
export enum ConnectionStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  PENDING = "PENDING"
}

// Client lookup cache TTL — applies to the in-memory cache of network partners
// fetched from `GET /api/network-partners`.
export const CLIENT_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Contact types
export enum ContactType {
  PRIMARY = "PRIMARY",
  SECONDARY = "SECONDARY",
  OTHER = "OTHER"
}
