import {
  listMatchingJobsTool,
  getMatchingJobTool,
  listMatchCandidatesTool,
  listStagedMatchesTool,
} from "./workflows.js";
import { createActionableError, createAdminOverrideRejectedError } from "../errors.js";
import { ResponseFormat, isAdminMode } from "../constants.js";
import { getNetworkAPIClient } from "../services/api-client.js";
import type { MatchingToolInput } from "../schemas/index.js";

/**
 * Dispatch wrapper for the consolidated matching tool
 */
export async function handleMatching(params: MatchingToolInput) {
  try {
    if (params.asClientId && !isAdminMode()) {
      const err = createAdminOverrideRejectedError('matching');
      return { isError: true, content: [{ type: "text" as const, text: err.text }] };
    }
    const scopedClient = params.asClientId
      ? getNetworkAPIClient().withClientIdOverride(params.asClientId)
      : undefined;

    switch (params.action) {
      case "jobs":
        return await listMatchingJobsTool({
          status: params.status as any,
          response_format: ResponseFormat.MARKDOWN,
        }, scopedClient);
      case "job_detail":
        return await getMatchingJobTool({
          jobId: params.jobId!,
          response_format: ResponseFormat.MARKDOWN,
        }, scopedClient);
      case "candidates":
        return await listMatchCandidatesTool({
          jobId: params.jobId!,
          category: params.category,
          pageSize: params.pageSize ?? 20,
          cursor: params.cursor,
          response_format: ResponseFormat.MARKDOWN,
        }, scopedClient);
      case "staged":
        return await listStagedMatchesTool({
          jobId: params.jobId!,
          status: params.status as any,
          category: params.category,
          pageSize: params.pageSize ?? 20,
          cursor: params.cursor,
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
        text: createActionableError(error instanceof Error ? error : String(error), 'matching', params.action, params as Record<string, unknown>).text,
      }],
    };
  }
}
