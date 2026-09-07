# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that provides intelligent supplier and buyer management for the Payvaro Network API. It enables AI-powered queries about supplier-buyer relationships with fuzzy matching capabilities for imperfect/duplicate data.

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run watch        # Watch mode for development
npm start            # Start in stdio mode (Claude Desktop integration)
npm run start:http   # Start in HTTP mode on port 3000 (testing)
```

## Environment Variables

- `NETWORK_API_KEY` - Required. API authentication key
- `NETWORK_API_BASE_URL` - API endpoint (defaults to http://localhost:8080)
- `NETWORK_CLIENT_ID` - Optional. Default client ID sent as `x-client-id` header
- `NETWORK_ADMIN_MODE` - Optional. When set to `"true"`, consolidated tools accept an `asClientId` field to override `x-client-id` per request. Requires the configured API key to be an admin token on the Network API side.
- `SLACK_WEBHOOK_URL` - Optional. For Slack notifications

### HTTP mode (OAuth) only

- `AUTH_SERVER_URL` - Auth server base URL. Defaults to `http://localhost:8081/auth` (under the
  local `pv` stack 8080 is the Network API; auth-server is published on 8081).
- `JWKS_URI` - Defaults to `${AUTH_SERVER_URL}/.well-known/jwks.json`, which proxies the Cognito
  user pool's keys.
- `JWT_ISSUER` - Expected `iss`. **No default.** Access tokens are minted by Cognito, so the issuer
  is the user pool URL (`https://cognito-idp.<region>.amazonaws.com/<poolId>`), never the auth
  server's own URL. When unset it is read from `${AUTH_SERVER_URL}/.well-known/openid-configuration`
  at startup; startup fails loudly if that cannot be reached.
- `MCP_PUBLIC_URL` - This server's public URL, used for OAuth metadata and the `/oauth/callback`
  bridge. Defaults to `http://localhost:3000`; the auth server's `mcp-server` client only accepts
  `:3000` and `:3001` callbacks, so a different port needs `OAUTH2_REDIRECT_URIS` widened there.
- `AUTH_SERVER_CLIENT_ID` - Pre-registered client on the auth server. Defaults to `mcp-server`.

Tenant scope for an authenticated user comes from the token, not from `NETWORK_CLIENT_ID`: a real
Cognito access token carries no `custom:clientId` (custom attributes are ID-token-only), so the
client id is read from the `CLIENT_<uuid>` entry in `cognito:groups` - the same claim the Network
API's `getPrimaryClientId` reads. A token naming no client sends no `x-client-id` at all rather
than falling back to the server-wide default.

## Architecture

```
src/
├── index.ts                    # Main entry, server creation, tool registration
├── types.ts                    # TypeScript interfaces (Supplier, Buyer, etc.)
├── constants.ts                # Configuration constants
├── schemas/
│   └── index.ts               # Zod validation schemas for all tools
├── services/
│   ├── api-client.ts          # NetworkAPIClient singleton (Axios wrapper)
│   ├── matching.ts            # Fuzzy matching logic with weighted scoring
│   ├── formatter.ts           # Output formatting (markdown/JSON)
│   ├── network-analyzer.ts    # Network analysis (stub - not yet implemented)
│   └── slack-notifier.ts      # Slack webhook integration
└── tools/
    ├── suppliers.ts           # Supplier tool implementations
    ├── buyers.ts              # Buyer tool implementations
    └── analysis.ts            # Analysis & Slack tools
```

### Key Patterns

- **NetworkAPIClient** - Singleton with sanitized API key handling and comprehensive error messages
- **Fuzzy Matching** - Weighted field matching (Name: 3, Address: 4, Email: 2) with confidence levels (exact: 1.0, high: 0.8, medium: 0.6, low: 0.4)
- **Output Formatting** - Dual format support (markdown for humans, JSON for structured data) with 10,000 char limit
- **Validation** - Zod schemas with custom refinements for all tool inputs

### Adding a New Tool

1. Define Zod schema in `src/schemas/index.ts`
2. Add TypeScript types to `src/types.ts` if needed
3. Implement handler in appropriate `src/tools/*.ts` file
4. Register tool in `src/index.ts` (ListToolsRequestSchema handler and CallToolRequestSchema switch)

### Admin-Mode Per-Request `x-client-id` Override

When a tool hits the Network API, each consolidated tool schema accepts an optional `asClientId` field. The dispatch wrapper (`handleBuyers`, `handleSuppliers`, etc.) checks `isAdminMode()` from `src/constants.ts`; if disabled it rejects with `createAdminOverrideRejectedError`. If enabled, it calls `getNetworkAPIClient().withClientIdOverride(id)` to get a scoped client (new axios instance with the override header baked in) and threads it as the final `clientOverride?: NetworkAPIClient` argument into each inner tool function. Individual tool functions should accept `clientOverride` and fall back to the singleton: `const client = clientOverride ?? getNetworkAPIClient();`.

## Tool Naming Convention

All tools follow the pattern: `network_<action>_<subject>`

Examples: `network_search_suppliers`, `network_create_buyer_link`, `network_analyze_connections`

## Testing

Automated tests are implemented with Vitest. Commands:
- `npm test`              # Run the test suite once
- `npm run test:watch`    # Run tests in watch mode during development
- `npm run test:coverage` # Run tests and generate coverage report

Manual testing:
- Use `npm start` for stdio mode testing with Claude Desktop
- Use `npm run start:http` for HTTP mode testing on port 3000
- Check logs at `~/Library/Logs/Claude/mcp*.log` for debugging

## Key Dependencies

- `@modelcontextprotocol/sdk` - MCP server framework
- `fuzzysort` - Fast fuzzy string matching
- `zod` - Runtime schema validation
- `axios` - HTTP client with error handling
