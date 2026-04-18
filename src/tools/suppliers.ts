import { getNetworkAPIClient, NetworkAPIClient } from "../services/api-client.js";
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
  GetSupplierHistoryInput,
  UploadFileInput,
  SuppliersToolInput,
  SearchToolInput,
} from "../schemas/index.js";
import type { SearchResult, SupplierListResult } from "../types.js";
import { ResponseFormat, HistoryFormat } from "../constants.js";
import { createActionableError } from "../errors.js";
import { resolveAdminScope, isAdminScopeRejection } from "../services/admin-scope.js";

/**
 * Search for suppliers with fuzzy matching
 */
export async function searchSuppliers(params: SupplierSearchInput, clientOverride?: NetworkAPIClient) {
  try {
    const client = clientOverride ?? getNetworkAPIClient();

    // Get all suppliers (we'll filter client-side with fuzzy matching)
    const allSuppliers = await client.getAllSuppliers();

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
    console.error('searchSuppliers error:', error);
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
 * List suppliers with pagination
 */
export async function listSuppliers(params: ListSuppliersInput, clientOverride?: NetworkAPIClient) {
  try {
    const client = clientOverride ?? getNetworkAPIClient();
    const paginatedResponse = await client.listSuppliers(params.pageSize, params.cursor);

    const result: SupplierListResult = {
      suppliers: paginatedResponse.items,
      count: paginatedResponse.pagination.count,
      pagination: paginatedResponse.pagination
    };

    const formatted = formatOutput(
      result,
      params.response_format,
      () => {
        const parts = [
          formatSupplierListMarkdown(paginatedResponse.items),
          "",
          "---",
          "",
          `**Page Info:** ${paginatedResponse.pagination.count} supplier(s) returned | Page size: ${paginatedResponse.pagination.pageSize}`
        ];
        if (paginatedResponse.pagination.hasMore && paginatedResponse.pagination.nextCursor) {
          parts.push(`**Next cursor:** \`${paginatedResponse.pagination.nextCursor}\``);
        } else {
          parts.push("**End of results**");
        }
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
    console.error('listSuppliers error:', error);
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
export async function getSupplier(params: GetSupplierInput, clientOverride?: NetworkAPIClient) {
  try {
    const client = clientOverride ?? getNetworkAPIClient();
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
    console.error('getSupplier error:', error);
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
export async function getSuppliersByDate(params: GetSuppliersByDateInput, clientOverride?: NetworkAPIClient) {
  try {
    const client = clientOverride ?? getNetworkAPIClient();
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
    console.error('getSuppliersByDate error:', error);
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
export async function getSupplierHistory(params: GetSupplierHistoryInput, clientOverride?: NetworkAPIClient) {
  try {
    const client = clientOverride ?? getNetworkAPIClient();
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
    console.error('getSupplierHistory error:', error);
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
 * Dispatch wrapper for the consolidated suppliers tool
 */
export async function handleSuppliers(params: SuppliersToolInput) {
  try {
    const scope = await resolveAdminScope(params, 'suppliers');
    if (isAdminScopeRejection(scope)) return scope;
    const scopedClient = scope.clientId
      ? getNetworkAPIClient().withClientIdOverride(scope.clientId)
      : undefined;

    switch (params.action) {
      case "list":
        return await listSuppliers({
          pageSize: params.pageSize ?? 20,
          cursor: params.cursor,
          response_format: ResponseFormat.MARKDOWN,
        }, scopedClient);
      case "get":
        return await getSupplier({
          id: params.id!,
          includeLinks: params.includeLinks ?? false,
          response_format: ResponseFormat.MARKDOWN,
        }, scopedClient);
      case "history":
        return await getSupplierHistory({
          id: params.id!,
          format: params.format ?? HistoryFormat.COMPACT,
          response_format: ResponseFormat.MARKDOWN,
        }, scopedClient);
      case "by_date":
        return await getSuppliersByDate({
          date: params.date!,
          response_format: ResponseFormat.MARKDOWN,
        }, scopedClient);
      default:
        return {
          isError: true,
          content: [{ type: "text" as const, text: `❌ Error: Unknown action '${(params as { action: string }).action}'.` }],
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: createActionableError(error instanceof Error ? error : String(error), 'suppliers', params.action, params as Record<string, unknown>).text,
      }],
    };
  }
}

/**
 * Upload a CSV file to the network API
 */
/**
 * Dispatch wrapper for the consolidated search tool (admin-override aware)
 */
export async function handleSearch(params: SearchToolInput) {
  const scope = await resolveAdminScope(params, 'search');
  if (isAdminScopeRejection(scope)) return scope;
  const scopedClient = scope.clientId
    ? getNetworkAPIClient().withClientIdOverride(scope.clientId)
    : undefined;

  return await searchSuppliers({
    name: params.name,
    address: params.address,
    email: params.email,
    minMatchScore: params.minMatchScore,
    maxResults: params.maxResults,
    response_format: ResponseFormat.MARKDOWN,
  }, scopedClient);
}

export async function uploadFile(params: UploadFileInput, clientOverride?: NetworkAPIClient) {
  try {
    const client = clientOverride ?? getNetworkAPIClient();
    const result = await client.uploadFile(params.filePath, params.fileName);

    const formatted = formatOutput(
      result,
      params.response_format,
      () => {
        const parts = [
          "# File Upload Successful",
          "",
          "✅ Successfully uploaded file to the network API",
          "",
          "## Upload Details",
          ""
        ];

        if (params.fileName) {
          parts.push(`**Filename:** ${params.fileName}`);
        } else {
          const pathParts = params.filePath.split("/");
          parts.push(`**Filename:** ${pathParts[pathParts.length - 1]}`);
        }
        parts.push(`**File Path:** ${params.filePath}`);

        // Add any metadata from the API response
        if (result && typeof result === "object") {
          parts.push("");
          parts.push("## Upload Response");
          parts.push("");
          parts.push("```json");
          parts.push(JSON.stringify(result, null, 2));
          parts.push("```");
        }

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
    console.error('uploadFile error:', error);
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
