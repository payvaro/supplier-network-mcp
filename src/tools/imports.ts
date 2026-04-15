import { uploadFile } from "./suppliers.js";
import { listImportBatchesTool, validateImportDataTool } from "./workflows.js";
import { createActionableError, createAdminOverrideRejectedError } from "../errors.js";
import { ResponseFormat, isAdminMode } from "../constants.js";
import { getNetworkAPIClient } from "../services/api-client.js";
import type { ImportsToolInput } from "../schemas/index.js";

/**
 * Dispatch wrapper for the consolidated imports tool
 */
export async function handleImports(params: ImportsToolInput) {
  try {
    if (params.asClientId && !isAdminMode()) {
      const err = createAdminOverrideRejectedError('imports');
      return { isError: true, content: [{ type: "text" as const, text: err.text }] };
    }
    const scopedClient = params.asClientId
      ? getNetworkAPIClient().withClientIdOverride(params.asClientId)
      : undefined;

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
