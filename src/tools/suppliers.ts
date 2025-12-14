import { getNetworkAPIClient } from "../services/api-client.js";
import { searchAndRankSuppliers, normalizeAddress } from "../services/matching.js";
import {
  formatSearchResultsMarkdown,
  formatSupplierListMarkdown,
  formatSupplierMarkdown,
  formatOutput,
  createErrorResponse
} from "../services/formatter.js";
import type {
  SupplierSearchInput,
  ListSuppliersInput,
  GetSupplierInput,
  GetSuppliersByDateInput,
  GetSupplierHistoryInput
} from "../schemas/index.js";
import type { SearchResult, SupplierListResult } from "../types.js";

/**
 * Search for suppliers with fuzzy matching
 */
export async function searchSuppliers(params: SupplierSearchInput) {
  try {
    const client = getNetworkAPIClient();

    // Get all suppliers (we'll filter client-side with fuzzy matching)
    const allSuppliers = await client.listSuppliers(false);

    // Normalize address if provided
    const searchAddress = params.address ? normalizeAddress(params.address) : undefined;

    // Perform fuzzy matching
    const matches = searchAndRankSuppliers(
      allSuppliers,
      {
        name: params.name,
        address: searchAddress,
        email: params.email
      },
      params.minMatchScore
    );

    // Limit results
    const limitedMatches = matches.slice(0, params.maxResults);

    const result: SearchResult = {
      query: {
        name: params.name,
        address: searchAddress,
        email: params.email
      },
      totalMatches: limitedMatches.length,
      matches: limitedMatches
    };

    if (limitedMatches.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: `No supplier matches found. Try lowering the minMatchScore threshold or using broader search terms.`
        }]
      };
    }

    const formatted = formatOutput(
      result,
      params.response_format,
      () => formatSearchResultsMarkdown(result)
    );

    return {
      content: [{
        type: "text" as const,
        text: formatted.text
      }],
      structuredContent: formatted.structuredData
    };

  } catch (error) {
    const errorResponse = createErrorResponse(error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: errorResponse.text
      }]
    };
  }
}

/**
 * List all suppliers
 */
export async function listSuppliers(params: ListSuppliersInput) {
  try {
    const client = getNetworkAPIClient();
    const suppliers = await client.listSuppliers(params.includeLinks);

    const result: SupplierListResult = {
      suppliers,
      count: suppliers.length
    };

    const formatted = formatOutput(
      result,
      params.response_format,
      () => formatSupplierListMarkdown(suppliers)
    );

    return {
      content: [{
        type: "text" as const,
        text: formatted.text
      }],
      structuredContent: formatted.structuredData
    };

  } catch (error) {
    const errorResponse = createErrorResponse(error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: errorResponse.text
      }]
    };
  }
}

/**
 * Get a specific supplier by ID
 */
export async function getSupplier(params: GetSupplierInput) {
  try {
    const client = getNetworkAPIClient();
    const supplier = await client.getSupplier(params.id, params.includeLinks);

    const formatted = formatOutput(
      supplier,
      params.response_format,
      () => formatSupplierMarkdown(supplier, true)
    );

    return {
      content: [{
        type: "text" as const,
        text: formatted.text
      }],
      structuredContent: formatted.structuredData
    };

  } catch (error) {
    const errorResponse = createErrorResponse(error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: errorResponse.text
      }]
    };
  }
}

/**
 * Get suppliers updated on a specific date
 */
export async function getSuppliersByDate(params: GetSuppliersByDateInput) {
  try {
    const client = getNetworkAPIClient();
    const suppliers = await client.getSuppliersByDate(params.date);

    const result: SupplierListResult = {
      suppliers,
      count: suppliers.length
    };

    const formatted = formatOutput(
      result,
      params.response_format,
      () => {
        const parts = [
          `# Suppliers Updated on ${params.date}`,
          "",
          `**Total:** ${suppliers.length} supplier(s)`,
          "",
          "---",
          "",
          formatSupplierListMarkdown(suppliers)
        ];
        return parts.join("\n");
      }
    );

    return {
      content: [{
        type: "text" as const,
        text: formatted.text
      }],
      structuredContent: formatted.structuredData
    };

  } catch (error) {
    const errorResponse = createErrorResponse(error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: errorResponse.text
      }]
    };
  }
}

/**
 * Get supplier version history
 */
export async function getSupplierHistory(params: GetSupplierHistoryInput) {
  try {
    const client = getNetworkAPIClient();
    const history = await client.getSupplierHistory(params.id, params.format);

    const formatted = formatOutput(
      { history, id: params.id, format: params.format },
      params.response_format,
      () => {
        return `# Supplier History: ${params.id}\n\nFormat: ${params.format}\n\n${JSON.stringify(history, null, 2)}`;
      }
    );

    return {
      content: [{
        type: "text" as const,
        text: formatted.text
      }],
      structuredContent: formatted.structuredData
    };

  } catch (error) {
    const errorResponse = createErrorResponse(error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: errorResponse.text
      }]
    };
  }
}
