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
- `SLACK_WEBHOOK_URL` - Optional. For Slack notifications

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
