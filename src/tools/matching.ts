import {
  listMatchingJobsTool,
  getMatchingJobTool,
  listMatchCandidatesTool,
  listStagedMatchesTool,
} from "./workflows.js";
import { createActionableError } from "../errors.js";
import { ResponseFormat } from "../constants.js";
import type { MatchingToolInput } from "../schemas/index.js";

/**
 * Dispatch wrapper for the consolidated matching tool
 */
export async function handleMatching(params: MatchingToolInput) {
  try {
    switch (params.action) {
      case "jobs":
        return await listMatchingJobsTool({
          status: params.status as any,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "job_detail":
        return await getMatchingJobTool({
          jobId: params.jobId!,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "candidates":
        return await listMatchCandidatesTool({
          jobId: params.jobId!,
          category: params.category,
          pageSize: params.pageSize ?? 20,
          cursor: params.cursor,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "staged":
        return await listStagedMatchesTool({
          jobId: params.jobId!,
          status: params.status as any,
          category: params.category,
          pageSize: params.pageSize ?? 20,
          cursor: params.cursor,
          response_format: ResponseFormat.MARKDOWN,
        });
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
