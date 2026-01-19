// API Configuration
export const DEFAULT_BASE_URL = "http://localhost:8080";

// Authentication
export const AUTH_HEADER = "Authorization";
export const CLIENT_ID_HEADER = "x-client-id";

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

// Contact types
export enum ContactType {
  PRIMARY = "PRIMARY",
  SECONDARY = "SECONDARY",
  OTHER = "OTHER"
}
