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
} from "./schemas/index.js";

// Import tool implementations
import {
  searchSuppliers,
  listSuppliers,
  getSupplier,
  getSuppliersByDate,
  getSupplierHistory,
} from "./tools/suppliers.js";

import {
  listBuyers,
  getBuyer,
  getBuyerByClientId,
  getSuppliersForBuyer,
  getBuyersForSupplier,
} from "./tools/buyers.js";

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
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
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
      ],
    };
  });

  /**
   * Handle tool execution
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "network_search_suppliers": {
          const params = SupplierSearchSchema.parse(args);
          return await searchSuppliers(params);
        }

        case "network_list_suppliers": {
          const params = ListSuppliersSchema.parse(args);
          return await listSuppliers(params);
        }

        case "network_get_supplier": {
          const params = GetSupplierSchema.parse(args);
          return await getSupplier(params);
        }

        case "network_get_suppliers_by_date": {
          const params = GetSuppliersByDateSchema.parse(args);
          return await getSuppliersByDate(params);
        }

        case "network_get_supplier_history": {
          const params = GetSupplierHistorySchema.parse(args);
          return await getSupplierHistory(params);
        }

        case "network_list_buyers": {
          const params = ListBuyersSchema.parse(args);
          return await listBuyers(params);
        }

        case "network_get_buyer": {
          const params = GetBuyerSchema.parse(args);
          return await getBuyer(params);
        }

        case "network_get_buyer_by_client_id": {
          const params = GetBuyerByClientIdSchema.parse(args);
          return await getBuyerByClientId(params);
        }

        case "network_get_suppliers_for_buyer": {
          const params = GetSuppliersForBuyerSchema.parse(args);
          return await getSuppliersForBuyer(params);
        }

        case "network_get_buyers_for_supplier": {
          const params = GetBuyersForSupplierSchema.parse(args);
          return await getBuyersForSupplier(params);
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
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
