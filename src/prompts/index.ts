import type { Prompt, GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import {
  generateImportInvestigationPrompt,
  type ImportInvestigationArgs,
} from "./templates/import-investigation.js";
import {
  generateRelationshipAuditPrompt,
  type RelationshipAuditArgs,
} from "./templates/relationship-audit.js";
import {
  generateDataQualityReviewPrompt,
  type DataQualityReviewArgs,
} from "./templates/data-quality-review.js";

/**
 * Available network prompts
 */
export const NETWORK_PROMPTS: Prompt[] = [
  {
    name: "network_import_investigation",
    description:
      "Step-by-step workflow to investigate import issues, identify duplicates, and assess data quality of recently imported suppliers.",
    arguments: [
      {
        name: "date",
        description: "Import date to investigate (yyyyMMdd format, e.g., '20251119'). Defaults to today if not specified.",
        required: false,
      },
      {
        name: "buyerId",
        description: "Scope investigation to a specific buyer ID",
        required: false,
      },
    ],
  },
  {
    name: "network_relationship_audit",
    description:
      "Comprehensive audit workflow for buyer-supplier relationships. Analyzes health, coverage, and network structure with configurable depth.",
    arguments: [
      {
        name: "buyerId",
        description: "Buyer ID to audit. If not specified, audits the entire network.",
        required: false,
      },
      {
        name: "depth",
        description: "Audit depth: 'quick' (critical metrics only), 'standard' (balanced coverage), or 'deep' (comprehensive analysis). Defaults to 'standard'.",
        required: false,
      },
    ],
  },
  {
    name: "network_data_quality_review",
    description:
      "Systematic data quality review with scoring and actionable recommendations. Evaluates completeness, accuracy, consistency, and timeliness.",
    arguments: [
      {
        name: "focus",
        description: "Focus area: 'suppliers', 'buyers', 'links', or 'all'. Defaults to 'all'.",
        required: false,
      },
    ],
  },
];

/**
 * Handle GetPrompt request
 */
export async function handleGetPrompt(
  name: string,
  args: Record<string, string>
): Promise<GetPromptResult> {
  switch (name) {
    case "network_import_investigation": {
      const promptArgs: ImportInvestigationArgs = {
        date: args.date,
        buyerId: args.buyerId,
      };
      return generateImportInvestigationPrompt(promptArgs);
    }

    case "network_relationship_audit": {
      const promptArgs: RelationshipAuditArgs = {
        buyerId: args.buyerId,
        depth: args.depth,
      };
      return generateRelationshipAuditPrompt(promptArgs);
    }

    case "network_data_quality_review": {
      const promptArgs: DataQualityReviewArgs = {
        focus: args.focus,
      };
      return generateDataQualityReviewPrompt(promptArgs);
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}
