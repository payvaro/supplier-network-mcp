import { uploadFile } from "./suppliers.js";
import { listImportBatchesTool, validateImportDataTool } from "./workflows.js";
import { createActionableError } from "../errors.js";
import { ResponseFormat } from "../constants.js";
import { getNetworkAPIClient, NetworkAPIClient } from "../services/api-client.js";
import { resolveAdminScope, isAdminScopeRejection } from "../services/admin-scope.js";
import type { ImportsToolInput } from "../schemas/index.js";

/**
 * Dispatch wrapper for the consolidated imports tool
 */
export async function handleImports(params: ImportsToolInput, clientOverride?: NetworkAPIClient) {
  try {
    const scope = await resolveAdminScope(params, 'imports');
    if (isAdminScopeRejection(scope)) return scope;
    const scopedClient = scope.clientId
      ? (clientOverride ?? getNetworkAPIClient()).withClientIdOverride(scope.clientId)
      : clientOverride;

    switch (params.action) {
      case "upload":
        return await uploadFile({
          filePath: params.filePath!,
          fileName: params.fileName,
          response_format: ResponseFormat.MARKDOWN,
        }, scopedClient);
      case "batches":
        return await listImportBatchesTool({
          limit: params.limit ?? 20,
          response_format: ResponseFormat.MARKDOWN,
        }, scopedClient);
      case "validate":
        return await validateImportDataTool({
          dateRange: params.dateRange,
          buyerId: params.buyerId,
          response_format: ResponseFormat.MARKDOWN,
        }, scopedClient);
      default:
        return {
          isError: true,
          content: [{ type: "text" as const, text: `❌ Error: Unknown action.` }],
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: createActionableError(error instanceof Error ? error : String(error), 'imports', params.action, params as Record<string, unknown>).text,
      }],
    };
  }
}
