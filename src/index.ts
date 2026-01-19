#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";

// Import schemas
import {
  SupplierSearchSchema,
  ListSuppliersSchema,
  GetSupplierSchema,
  GetSuppliersByDateSchema,
  GetSupplierHistorySchema,
  ListBuyersSchema,
  GetBuyerSchema,
  GetBuyerByClientIdSchema,
  GetSuppliersForBuyerSchema,
  GetBuyersForSupplierSchema,
  CreateBuyerLinkSchema,
  CreateBuyerSchema,
  UploadFileSchema,
  NetworkAnalysisSchema,
  SlackNotificationSchema,
} from "./schemas/index.js";

// Import tool implementations
import {
  searchSuppliers,
  listSuppliers,
  getSupplier,
  getSuppliersByDate,
  getSupplierHistory,
  uploadFile,
} from "./tools/suppliers.js";

import {
  listBuyers,
  getBuyer,
  getBuyerByClientId,
  getSuppliersForBuyer,
  getBuyersForSupplier,
  createBuyerLink,
  createBuyer,
} from "./tools/buyers.js";

import {
  analyzeNetworkConnections,
  notifySlack,
} from "./tools/analysis.js";

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
          name: "network_search_suppliers",
          description:
            "Intelligently search for suppliers using fuzzy matching. Match by name, address, email, or combination. Returns ranked results with confidence scores (exact, high, medium, low). Perfect for finding duplicates or matching imperfect data.",
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
                  streetAddress: {
                    type: "string",
                    description: "Street address",
                  },
                  city: {
                    type: "string",
                    description: "City name",
                  },
                  stateProvince: {
                    type: "string",
                    description: "State or province (e.g., 'CA', 'NY')",
                  },
                  postalCode: {
                    type: "string",
                    description: "Postal/ZIP code (e.g., '90210')",
                  },
                  suiteUnit: {
                    type: "string",
                    description: "Suite or unit number",
                  },
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
              response_format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format: 'markdown' or 'json'",
                default: "markdown",
              },
            },
          },
        },
        {
          name: "network_list_suppliers",
          description: "List all suppliers in the network.",
          inputSchema: {
            type: "object",
            properties: {
              includeLinks: {
                type: "boolean",
                description: "Include buyer and aggregator relationship links",
                default: false,
              },
              response_format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format",
                default: "markdown",
              },
            },
          },
        },
        {
          name: "network_get_supplier",
          description: "Get detailed information about a specific supplier by ID.",
          inputSchema: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Unique supplier identifier",
              },
              includeLinks: {
                type: "boolean",
                description: "Include buyer and aggregator relationship links",
                default: false,
              },
              response_format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format",
                default: "markdown",
              },
            },
            required: ["id"],
          },
        },
        {
          name: "network_get_suppliers_by_date",
          description: "Get suppliers updated on a specific date.",
          inputSchema: {
            type: "object",
            properties: {
              date: {
                type: "string",
                description: "Date in yyyyMMdd format (e.g., 20251119)",
                pattern: "^\\d{8}$",
              },
              response_format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format",
                default: "markdown",
              },
            },
            required: ["date"],
          },
        },
        {
          name: "network_get_supplier_history",
          description:
            "Get version history showing all changes to a supplier over time.",
          inputSchema: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Supplier ID to get version history for",
              },
              format: {
                type: "string",
                enum: ["timeline", "compact", "default"],
                description: "History format",
                default: "compact",
              },
              response_format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format",
                default: "markdown",
              },
            },
            required: ["id"],
          },
        },
        {
          name: "network_list_buyers",
          description: "List all buyers in the network.",
          inputSchema: {
            type: "object",
            properties: {
              response_format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format",
                default: "markdown",
              },
            },
          },
        },
        {
          name: "network_get_buyer",
          description: "Get detailed information about a specific buyer by ID.",
          inputSchema: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Unique buyer identifier",
              },
              response_format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format",
                default: "markdown",
              },
            },
            required: ["id"],
          },
        },
        {
          name: "network_get_buyer_by_client_id",
          description: "Look up a buyer by external client ID.",
          inputSchema: {
            type: "object",
            properties: {
              clientId: {
                type: "string",
                description: "External client reference identifier",
              },
              response_format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format",
                default: "markdown",
              },
            },
            required: ["clientId"],
          },
        },
        {
          name: "network_get_suppliers_for_buyer",
          description: "Get all suppliers linked to a specific buyer.",
          inputSchema: {
            type: "object",
            properties: {
              buyerId: {
                type: "string",
                description: "Buyer ID to get linked suppliers for",
              },
              response_format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format",
                default: "markdown",
              },
            },
            required: ["buyerId"],
          },
        },
        {
          name: "network_get_buyers_for_supplier",
          description: "Get all buyers linked to a specific supplier.",
          inputSchema: {
            type: "object",
            properties: {
              supplierId: {
                type: "string",
                description: "Supplier ID to get linked buyers for",
              },
              response_format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format",
                default: "markdown",
              },
            },
            required: ["supplierId"],
          },
        },
        {
          name: "network_create_buyer_link",
          description: "Create a link between a buyer and supplier. Returns an error if the link already exists.",
          inputSchema: {
            type: "object",
            properties: {
              buyerId: {
                type: "string",
                description: "Unique buyer identifier",
              },
              supplierId: {
                type: "string",
                description: "Unique supplier identifier",
              },
              buyerSupplierRefId: {
                type: "string",
                description: "External reference ID for the buyer-supplier relationship",
              },
              buyerRefKey: {
                type: "string",
                description: "Reference key for the buyer-supplier relationship",
              },
              response_format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format",
                default: "markdown",
              },
            },
            required: ["buyerId", "supplierId"],
          },
        },
        {
          name: "network_create_buyer",
          description: "Create a new buyer in the network.",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Buyer name",
              },
              franchiseName: {
                type: "string",
                description: "Franchise name",
              },
              storeIdentifier: {
                type: "string",
                description: "Store identifier",
              },
              clientId: {
                type: "string",
                description: "External client reference identifier",
              },
              status: {
                type: "string",
                description: "Buyer status",
              },
              addresses: {
                type: "array",
                description: "Buyer addresses",
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
                description: "Buyer contacts",
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
              response_format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format",
                default: "markdown",
              },
            },
            required: ["clientId"],
          },
        },
        {
          name: "network_upload_file",
          description: "Upload a CSV file to the network API for processing.",
          inputSchema: {
            type: "object",
            properties: {
              filePath: {
                type: "string",
                description: "Path to the CSV file to upload",
              },
              fileName: {
                type: "string",
                description: "Optional filename override (defaults to basename of filePath)",
              },
              response_format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format",
                default: "markdown",
              },
            },
            required: ["filePath"],
          },
        },
        {
          name: "network_analyze_connections",
          description:
            "Comprehensive network analysis tool that analyzes buyer-supplier relationships. Combines multiple data sources to provide statistics, identify isolated nodes, find network hubs, and suggest potential connections.",
          inputSchema: {
            type: "object",
            properties: {
              includeSuggestions: {
                type: "boolean",
                description:
                  "Whether to include connection suggestions in the analysis",
                default: true,
              },
              minConnectionsForHub: {
                type: "number",
                description:
                  "Minimum number of connections required to be considered a network hub",
                default: 5,
                minimum: 1,
              },
              response_format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format",
                default: "markdown",
              },
            },
          },
        },
        {
          name: "network_notify_slack",
          description:
            "Post network analysis results to Slack via webhook for team decision-making. Takes the structured result from network_analyze_connections and formats it as a Slack message.",
          inputSchema: {
            type: "object",
            properties: {
              webhookUrl: {
                type: "string",
                description:
                  "Slack Incoming Webhook URL (optional if SLACK_WEBHOOK_URL environment variable is set)",
              },
              analysisResult: {
                oneOf: [
                  {
                    type: "object",
                    description: "Network analysis result object",
                  },
                  {
                    type: "string",
                    description: "JSON string representation of the analysis result",
                  },
                ],
                description:
                  "Network analysis result in any format: object, JSON string, or wrapped in structuredContent. Can be from network_analyze_connections tool or any compatible format with summary/metrics data.",
              },
              includeDetails: {
                type: "boolean",
                description:
                  "Whether to include detailed breakdowns in the Slack message",
                default: false,
              },
              response_format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format",
                default: "markdown",
              },
            },
            required: ["analysisResult"],
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
        case "network_search_suppliers": {
          const params = SupplierSearchSchema.parse(args);
          response = await searchSuppliers(params);
          break;
        }

        case "network_list_suppliers": {
          const params = ListSuppliersSchema.parse(args);
          response = await listSuppliers(params);
          break;
        }

        case "network_get_supplier": {
          const params = GetSupplierSchema.parse(args);
          response = await getSupplier(params);
          break;
        }

        case "network_get_suppliers_by_date": {
          const params = GetSuppliersByDateSchema.parse(args);
          response = await getSuppliersByDate(params);
          break;
        }

        case "network_get_supplier_history": {
          const params = GetSupplierHistorySchema.parse(args);
          response = await getSupplierHistory(params);
          break;
        }

        case "network_list_buyers": {
          const params = ListBuyersSchema.parse(args);
          response = await listBuyers(params);
          break;
        }

        case "network_get_buyer": {
          const params = GetBuyerSchema.parse(args);
          response = await getBuyer(params);
          break;
        }

        case "network_get_buyer_by_client_id": {
          const params = GetBuyerByClientIdSchema.parse(args);
          response = await getBuyerByClientId(params);
          break;
        }

        case "network_get_suppliers_for_buyer": {
          const params = GetSuppliersForBuyerSchema.parse(args);
          response = await getSuppliersForBuyer(params);
          break;
        }

        case "network_get_buyers_for_supplier": {
          const params = GetBuyersForSupplierSchema.parse(args);
          response = await getBuyersForSupplier(params);
          break;
        }

        case "network_create_buyer_link": {
          const params = CreateBuyerLinkSchema.parse(args);
          response = await createBuyerLink(params);
          break;
        }

        case "network_create_buyer": {
          const params = CreateBuyerSchema.parse(args);
          response = await createBuyer(params);
          break;
        }

        case "network_upload_file": {
          const params = UploadFileSchema.parse(args);
          response = await uploadFile(params);
          break;
        }

        case "network_analyze_connections": {
          const params = NetworkAnalysisSchema.parse(args);
          response = await analyzeNetworkConnections(params);
          break;
        }

        case "network_notify_slack": {
          const params = SlackNotificationSchema.parse(args);
          response = await notifySlack(params);
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
      error: "HTTP mode not fully implemented. Please use stdio mode with: npm start"
    });
  });

  app.listen(port, () => {
    console.error(`Network MCP Server HTTP endpoint available on http://localhost:${port}/mcp`);
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
