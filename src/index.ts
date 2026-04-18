#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";

// Import consolidated schemas
import {
  SearchToolSchema,
  SuppliersToolSchema,
  BuyersToolSchema,
  RelationshipsToolSchema,
  ImportsToolSchema,
  MatchingToolSchema,
  AnalyzeToolSchema,
  NotifySlackToolSchema,
  LookupClientToolSchema,
} from "./schemas/index.js";

// Import tool handlers
import { handleSearch, handleSuppliers } from "./tools/suppliers.js";
import { handleBuyers } from "./tools/buyers.js";
import { handleRelationships } from "./tools/relationships.js";
import { handleImports } from "./tools/imports.js";
import { handleMatching } from "./tools/matching.js";
import { handleAnalyze, handleNotifySlack } from "./tools/analysis.js";
import { lookupClientId } from "./tools/clients.js";

// Import prompts
import { NETWORK_PROMPTS, handleGetPrompt } from "./prompts/index.js";

// Admin-only per-request override: replaces the x-client-id header for this call.
// Requires NETWORK_ADMIN_MODE=true on the server; otherwise the dispatcher rejects
// the request with createAdminOverrideRejectedError.
const asClientIdProperty = {
  type: "string",
  description:
    "Admin-only: override the x-client-id header for this request. Requires the server to run with NETWORK_ADMIN_MODE=true. Pair with lookup_client to resolve a client name to its UUID.",
} as const;

// Admin-only convenience: the dispatcher resolves this to a UUID via the S3
// client config (same source as lookup_client) before issuing the request.
// Mutually exclusive with asClientId.
const asClientNameProperty = {
  type: "string",
  description:
    "Admin-only: resolve a client by name (e.g. 'Comet Electric') and use its UUID as the x-client-id header. Requires NETWORK_ADMIN_MODE=true. Mutually exclusive with asClientId. Use lookup_client with action 'list' to see available names.",
} as const;

/**
 * Create and configure the MCP server
 */
function createServer() {
  const server = new Server(
    {
      name: "network-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  );

  /**
   * List available tools
   */
  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    // Log raw request
    console.error("=== MCP Request (ListTools) ===");
    console.error(JSON.stringify(request, null, 2));

    const response = {
      tools: [
        {
          name: "search",
          description:
            "Find suppliers by name, address, or email using fuzzy matching. Returns ranked results with confidence scores. Use when the user asks to find, look up, or search for a supplier — especially with partial or imperfect information. Do NOT use for browsing all suppliers — use `suppliers` with action `list` instead.\n\nExample: search for \"Acme\" to find all suppliers with similar names.",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Supplier name or partial name to search for",
              },
              address: {
                type: "object",
                description: "Address components for searching",
                properties: {
                  streetAddress: { type: "string", description: "Street address" },
                  city: { type: "string", description: "City name" },
                  stateProvince: {
                    type: "string",
                    description: "State or province (e.g., 'CA', 'NY')",
                  },
                  postalCode: {
                    type: "string",
                    description: "Postal/ZIP code (e.g., '90210')",
                  },
                  suiteUnit: { type: "string", description: "Suite or unit number" },
                  addressType: {
                    type: "string",
                    description: "Address type (e.g., 'Business')",
                  },
                },
              },
              email: {
                type: "string",
                description: "Supplier email address",
              },
              minMatchScore: {
                type: "number",
                description:
                  "Minimum match score threshold (0.0-1.0). Default 0.4. Higher = stricter matching",
                default: 0.4,
                minimum: 0,
                maximum: 1,
              },
              maxResults: {
                type: "number",
                description: "Maximum number of results to return (1-100)",
                default: 10,
                minimum: 1,
                maximum: 100,
              },
              asClientId: asClientIdProperty,
              asClientName: asClientNameProperty,
            },
          },
        },
        {
          name: "suppliers",
          description:
            "View supplier information. Use when the user asks about a specific supplier, wants to browse suppliers, check what changed on a date, or see a supplier's edit history.\n\nActions:\n- `list` — Browse all suppliers with pagination\n- `get` — Get a supplier by ID (set `includeLinks: true` to see buyer relationships)\n- `history` — See all changes to a supplier over time\n- `by_date` — Find suppliers updated on a specific date",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["list", "get", "history", "by_date"],
                description: "The action to perform",
              },
              id: {
                type: "string",
                description: "Supplier ID (required for get, history)",
              },
              includeLinks: {
                type: "boolean",
                description: "Include buyer and aggregator relationship links",
                default: false,
              },
              date: {
                type: "string",
                description: "Date in yyyyMMdd format (required for by_date)",
                pattern: "^\\d{8}$",
              },
              format: {
                type: "string",
                enum: ["timeline", "compact", "default"],
                description: "History format",
                default: "compact",
              },
              pageSize: {
                type: "number",
                description: "Number of suppliers to return per page (1-100)",
                default: 20,
                minimum: 1,
                maximum: 100,
              },
              cursor: {
                type: "string",
                description: "Pagination cursor for fetching the next page of results",
              },
              asClientId: asClientIdProperty,
              asClientName: asClientNameProperty,
            },
            required: ["action"],
          },
        },
        {
          name: "buyers",
          description:
            "View or create buyers. Use when the user asks about a specific buyer, wants to see all buyers, or needs to create a new one. Supports lookup by internal ID or external client ID.\n\nActions:\n- `list` — Browse all buyers\n- `get` — Get a buyer by ID or client ID (provide `id` for internal UUID, or `clientId` for external reference)\n- `create` — Create a new buyer (requires `clientId`)",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["list", "get", "create"],
                description: "The action to perform",
              },
              id: {
                type: "string",
                description: "Internal buyer UUID (for get)",
              },
              clientId: {
                type: "string",
                description: "External client reference identifier (for get or create)",
              },
              name: {
                type: "string",
                description: "Buyer name (for create)",
              },
              franchiseName: {
                type: "string",
                description: "Franchise name (for create)",
              },
              storeIdentifier: {
                type: "string",
                description: "Store identifier (for create)",
              },
              status: {
                type: "string",
                description: "Buyer status (for create)",
              },
              addresses: {
                type: "array",
                description: "Buyer addresses (for create)",
                items: {
                  type: "object",
                  properties: {
                    streetAddress: { type: "string" },
                    city: { type: "string" },
                    stateProvince: { type: "string" },
                    postalCode: { type: "string" },
                    suiteUnit: { type: "string" },
                    addressType: { type: "string" },
                  },
                },
              },
              contacts: {
                type: "array",
                description: "Buyer contacts (for create)",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    email: { type: "string" },
                    phone: { type: "string" },
                    position: { type: "string" },
                    title: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["PRIMARY", "SECONDARY", "OTHER"],
                    },
                  },
                },
              },
              asClientId: asClientIdProperty,
              asClientName: asClientNameProperty,
            },
            required: ["action"],
          },
        },
        {
          name: "relationships",
          description:
            "View or create buyer-supplier relationships. Use when the user asks who a buyer's suppliers are, which buyers a supplier serves, or wants to link a buyer and supplier together.\n\nActions:\n- `for_buyer` — Get all suppliers linked to a buyer\n- `for_supplier` — Get all buyers linked to a supplier\n- `link` — Create a new buyer-supplier link (returns error if link already exists)",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["for_buyer", "for_supplier", "link"],
                description: "The action to perform",
              },
              buyerId: {
                type: "string",
                description: "Buyer ID (required for for_buyer and link)",
              },
              supplierId: {
                type: "string",
                description: "Supplier ID (required for for_supplier and link)",
              },
              buyerSupplierRefId: {
                type: "string",
                description: "External reference ID for the buyer-supplier relationship (for link)",
              },
              buyerRefKey: {
                type: "string",
                description: "Reference key for the buyer-supplier relationship (for link)",
              },
              asClientId: asClientIdProperty,
              asClientName: asClientNameProperty,
            },
            required: ["action"],
          },
        },
        {
          name: "imports",
          description:
            "Manage file imports. Use when the user wants to upload a supplier CSV, check recent import batches, or validate imported data for quality issues like placeholder emails, invalid phone numbers, or cross-field contamination.\n\nActions:\n- `upload` — Upload a CSV file for processing\n- `batches` — List recent import jobs with status and entity counts\n- `validate` — Check imported data for garbage/invalid content with remediation suggestions",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["upload", "batches", "validate"],
                description: "The action to perform",
              },
              filePath: {
                type: "string",
                description: "Path to the CSV file to upload (required for upload)",
              },
              fileName: {
                type: "string",
                description: "Optional filename override (for upload)",
              },
              limit: {
                type: "number",
                description: "Maximum number of import jobs to return (1-100, default 20, for batches)",
                default: 20,
                minimum: 1,
                maximum: 100,
              },
              dateRange: {
                type: "object",
                description: "Date range of import batch to validate (yyyyMMdd format, for validate)",
                properties: {
                  from: {
                    type: "string",
                    description: "Start date (yyyyMMdd)",
                    pattern: "^\\d{8}$",
                  },
                  to: {
                    type: "string",
                    description: "End date (yyyyMMdd)",
                    pattern: "^\\d{8}$",
                  },
                },
                required: ["from", "to"],
              },
              buyerId: {
                type: "string",
                description: "Scope to suppliers linked to this buyer (for validate)",
              },
              asClientId: asClientIdProperty,
              asClientName: asClientNameProperty,
            },
            required: ["action"],
          },
        },
        {
          name: "matching",
          description:
            "Monitor and review supplier matching jobs. Use when the user asks about matching progress, wants to see match candidates, or needs to review staged matches awaiting approval.\n\nActions:\n- `jobs` — List matching jobs (filter by status to find jobs needing review)\n- `job_detail` — Get detailed status and category breakdown for a specific job\n- `candidates` — List candidates from an import file with match categories and confidence scores\n- `staged` — List staged matches awaiting review with AI recommendations",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["jobs", "job_detail", "candidates", "staged"],
                description: "The action to perform",
              },
              jobId: {
                type: "string",
                description:
                  "Matching job ID (required for job_detail, candidates, staged)",
              },
              status: {
                type: "string",
                enum: [
                  "PENDING",
                  "RUNNING",
                  "REVIEW",
                  "FINALIZING",
                  "COMPLETED",
                  "FAILED",
                  "ABORTED",
                ],
                description:
                  "Filter by job status (for jobs) or review status (for staged)",
              },
              category: {
                type: "string",
                enum: ["EXACT_MATCH", "POSSIBLE_MATCH", "CONFLICT", "NET_NEW"],
                description: "Filter by match category (for candidates, staged)",
              },
              pageSize: {
                type: "number",
                description: "Results per page (1-100, default 20)",
                default: 20,
                minimum: 1,
                maximum: 100,
              },
              cursor: {
                type: "string",
                description: "Pagination cursor for next page",
              },
              asClientId: asClientIdProperty,
              asClientName: asClientNameProperty,
            },
            required: ["action"],
          },
        },
        {
          name: "analyze",
          description:
            "Analyze the supplier network for health, coverage, and quality. Use when the user asks about network health, wants to find gaps or isolated suppliers, or needs an assessment of import data quality. For viewing specific supplier or buyer data, use `suppliers` or `buyers` instead.\n\nActions:\n- `connections` — Identify isolated nodes, network hubs, and suggest new connections\n- `relationships` — Assess relationship health, coverage gaps, or map network structure (requires `analysisType`)\n- `import_quality` — Post-upload validation, pre-import preview, or data quality scoring (requires `mode`)",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["connections", "relationships", "import_quality"],
                description: "The action to perform",
              },
              includeSuggestions: {
                type: "boolean",
                description:
                  "Include connection suggestions in the analysis (for connections)",
                default: true,
              },
              minConnectionsForHub: {
                type: "number",
                description:
                  "Minimum connections to be considered a network hub (for connections)",
                default: 5,
                minimum: 1,
              },
              analysisType: {
                type: "string",
                enum: ["health", "coverage", "mapping"],
                description:
                  "Type of analysis: 'health' (link status), 'coverage' (supplier gaps), 'mapping' (network structure). Required for relationships action.",
              },
              includeInactive: {
                type: "boolean",
                description:
                  "Whether to include inactive links in the analysis (for relationships)",
                default: false,
              },
              mode: {
                type: "string",
                enum: ["post-upload", "preview", "quality"],
                description:
                  "Analysis mode: 'post-upload' (what was imported), 'preview' (what would happen), 'quality' (data quality scoring). Required for import_quality action.",
              },
              buyerId: {
                type: "string",
                description: "Scope analysis to a specific buyer",
              },
              dateRange: {
                type: "object",
                description: "Date range in yyyyMMdd format",
                properties: {
                  from: {
                    type: "string",
                    description: "Start date (yyyyMMdd)",
                    pattern: "^\\d{8}$",
                  },
                  to: {
                    type: "string",
                    description: "End date (yyyyMMdd)",
                    pattern: "^\\d{8}$",
                  },
                },
                required: ["from", "to"],
              },
              asClientId: asClientIdProperty,
              asClientName: asClientNameProperty,
            },
            required: ["action"],
          },
        },
        {
          name: "notify_slack",
          description:
            "Send messages to Slack via webhook. Use when the user wants to share results or alerts with the team.\n\nTypes:\n- `analysis` — Post formatted network analysis results (pass the result from the `analyze` tool)\n- `custom` — Send a freeform message with title, body, fields, buttons, and color",
          inputSchema: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["analysis", "custom"],
                description: "The type of message to send",
              },
              webhookUrl: {
                type: "string",
                description:
                  "Slack Incoming Webhook URL (optional if SLACK_WEBHOOK_URL environment variable is set)",
              },
              analysisResult: {
                oneOf: [
                  { type: "object", description: "Network analysis result object" },
                  {
                    type: "string",
                    description: "JSON string representation of the analysis result",
                  },
                ],
                description:
                  "Network analysis result (required for analysis type)",
              },
              includeDetails: {
                type: "boolean",
                description:
                  "Whether to include detailed breakdowns in the Slack message",
                default: false,
              },
              message: {
                type: "object",
                description: "The message content to send (required for custom type)",
                properties: {
                  title: {
                    type: "string",
                    description: "Optional header text (max 150 chars)",
                    maxLength: 150,
                  },
                  body: {
                    type: "string",
                    description:
                      "Main message content with Slack markdown support (required, max 3000 chars)",
                    maxLength: 3000,
                  },
                  fields: {
                    type: "array",
                    description: "Key-value pairs displayed in a 2-column grid (max 10)",
                    maxItems: 10,
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string", maxLength: 50 },
                        value: { type: "string", maxLength: 500 },
                      },
                      required: ["label", "value"],
                    },
                  },
                  actions: {
                    type: "array",
                    description: "Clickable buttons with URLs (max 5)",
                    maxItems: 5,
                    items: {
                      type: "object",
                      properties: {
                        text: {
                          type: "string",
                          description: "Button text (max 75 chars)",
                          maxLength: 75,
                        },
                        url: { type: "string", description: "URL to open when clicked" },
                        style: {
                          type: "string",
                          enum: ["primary", "danger"],
                          description: "Button style: primary (green) or danger (red)",
                        },
                      },
                      required: ["text", "url"],
                    },
                  },
                  footer: {
                    type: "string",
                    description: "Custom footer text (max 200 chars)",
                    maxLength: 200,
                  },
                  color: {
                    type: "string",
                    enum: ["good", "warning", "danger"],
                    description:
                      "Sidebar color indicator: good (green), warning (yellow), danger (red)",
                  },
                },
                required: ["body"],
              },
            },
            required: ["type"],
          },
        },
        {
          name: "lookup_client",
          description:
            "Browse or resolve clients from the S3 configuration store. Use action 'list' to see every client in an environment, or 'resolve' (default) to fuzzy-match a name to its UUID.\n\nActions:\n- `resolve` — Match a single `name` to its UUID (e.g. \"Comet Electric\" → `b5f3…`). Use before passing `asClientId` to another tool, or pass `asClientName` directly to skip this step.\n- `list` — Return all known client names. Useful when admins want to pick a tenant without guessing.",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["resolve", "list"],
                description: "'resolve' matches a name to its UUID (default). 'list' returns all clients for browsing.",
                default: "resolve",
              },
              name: {
                type: "string",
                description:
                  "Client name to resolve (required when action is 'resolve').",
              },
              environment: {
                type: "string",
                enum: ["dev", "prod"],
                description: "Target environment (default: dev)",
                default: "dev",
              },
            },
          },
        },
      ],
    };

    // Log raw response
    console.error("=== MCP Response (ListTools) ===");
    console.error(JSON.stringify(response, null, 2));

    return response;
  });

  /**
   * Handle tool execution
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Log raw request
    console.error("=== MCP Request (CallTool) ===");
    console.error(JSON.stringify(request, null, 2));

    try {
      const { name, arguments: args } = request.params;

      let response;
      switch (name) {
        case "search": {
          const params = SearchToolSchema.parse(args);
          response = await handleSearch(params);
          break;
        }
        case "suppliers": {
          const params = SuppliersToolSchema.parse(args);
          response = await handleSuppliers(params);
          break;
        }
        case "buyers": {
          const params = BuyersToolSchema.parse(args);
          response = await handleBuyers(params);
          break;
        }
        case "relationships": {
          const params = RelationshipsToolSchema.parse(args);
          response = await handleRelationships(params);
          break;
        }
        case "imports": {
          const params = ImportsToolSchema.parse(args);
          response = await handleImports(params);
          break;
        }
        case "matching": {
          const params = MatchingToolSchema.parse(args);
          response = await handleMatching(params);
          break;
        }
        case "analyze": {
          const params = AnalyzeToolSchema.parse(args);
          response = await handleAnalyze(params);
          break;
        }
        case "notify_slack": {
          const params = NotifySlackToolSchema.parse(args);
          response = await handleNotifySlack(params);
          break;
        }
        case "lookup_client": {
          const params = LookupClientToolSchema.parse(args);
          response = await lookupClientId(params);
          break;
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      // Log raw response
      console.error("=== MCP Response (CallTool) ===");
      console.error(JSON.stringify(response, null, 2));

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorResponse = {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };

      // Log error response
      console.error("=== MCP Error Response (CallTool) ===");
      console.error(JSON.stringify(errorResponse, null, 2));

      return errorResponse;
    }
  });

  /**
   * List available prompts
   */
  server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
    console.error("=== MCP Request (ListPrompts) ===");
    console.error(JSON.stringify(request, null, 2));

    const response = {
      prompts: NETWORK_PROMPTS,
    };

    console.error("=== MCP Response (ListPrompts) ===");
    console.error(JSON.stringify(response, null, 2));

    return response;
  });

  /**
   * Get a specific prompt
   */
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    console.error("=== MCP Request (GetPrompt) ===");
    console.error(JSON.stringify(request, null, 2));

    try {
      const { name, arguments: args } = request.params;
      const response = await handleGetPrompt(name, args || {});

      console.error("=== MCP Response (GetPrompt) ===");
      console.error(JSON.stringify(response, null, 2));

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("=== MCP Error Response (GetPrompt) ===");
      console.error(errorMessage);
      throw error;
    }
  });

  return server;
}

/**
 * Start the server in stdio mode
 */
async function startStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Network MCP Server running on stdio");
}

/**
 * Start the server in HTTP mode (simplified endpoint wrapper)
 */
async function startHttp(port: number = 3000) {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "network-mcp-server" });
  });

  app.post("/mcp", async (_req, res) => {
    res.status(501).json({
      error:
        "HTTP mode not fully implemented. Please use stdio mode with: npm start",
    });
  });

  app.listen(port, () => {
    console.error(
      `Network MCP Server HTTP endpoint available on http://localhost:${port}/mcp`
    );
    console.error(`Note: For full functionality, use stdio mode: npm start`);
  });
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const httpMode = args.includes("--http");
  const portArg = args.find((arg) => arg.startsWith("--port="));
  const port = portArg ? parseInt(portArg.split("=")[1], 10) : 3000;

  if (httpMode) {
    await startHttp(port);
  } else {
    await startStdio();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
