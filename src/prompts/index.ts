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
import {
  generateAuditClientPrompt,
  type AuditClientArgs,
} from "./templates/audit-client.js";
import {
  generateFixBuyerLinkPrompt,
  type FixBuyerLinkArgs,
} from "./templates/fix-buyer-link.js";
import {
  generateFixBuyerExternalIdsPrompt,
  type FixBuyerExternalIdsArgs,
} from "./templates/fix-buyer-external-ids.js";
import {
  generateFixAcceptorIntegrationPrompt,
  type FixAcceptorIntegrationArgs,
} from "./templates/fix-acceptor-integration.js";

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
  {
    name: "audit-client",
    description:
      "Run the Supplier Network /audit-client support playbook for a tenant. Aggregates missing links, missing acceptor integrations, and malformed buyer external IDs into a prioritized findings list, then dispatches into per-finding repair playbooks.",
    arguments: [
      {
        name: "asClientId",
        description: "Client UUID to audit (admin override).",
        required: false,
      },
      {
        name: "asClientName",
        description: "Client name to audit (resolved via lookup_client; admin override).",
        required: false,
      },
    ],
  },
  {
    name: "fix-buyer-link",
    description:
      "Repair a missing buyer↔supplier link. Diagnoses, previews, and creates the link via the relationships tool.",
    arguments: [
      { name: "buyerId", description: "Buyer id to link.", required: false },
      { name: "supplierId", description: "Supplier id to link.", required: false },
      { name: "asClientId", description: "Admin override.", required: false },
      { name: "asClientName", description: "Admin override.", required: false },
    ],
  },
  {
    name: "fix-buyer-external-ids",
    description:
      "Repair missing or malformed buyer external IDs (clientId, alternateRefs) so import-driven link creation can match.",
    arguments: [
      { name: "buyerId", description: "Buyer UUID to repair.", required: false },
      { name: "asClientId", description: "Admin override.", required: false },
      { name: "asClientName", description: "Admin override.", required: false },
    ],
  },
  {
    name: "fix-acceptor-integration",
    description:
      "Create a missing AcceptorIntegration for a supplier so it becomes payable. Diagnoses, previews, and creates via the acceptor_integrations tool.",
    arguments: [
      { name: "supplierId", description: "Supplier id.", required: false },
      { name: "acceptorId", description: "Acceptor id.", required: false },
      { name: "asClientId", description: "Admin override.", required: false },
      { name: "asClientName", description: "Admin override.", required: false },
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

    case "audit-client": {
      const promptArgs: AuditClientArgs = {
        asClientId: args.asClientId,
        asClientName: args.asClientName,
      };
      return generateAuditClientPrompt(promptArgs);
    }

    case "fix-buyer-link": {
      const promptArgs: FixBuyerLinkArgs = {
        buyerId: args.buyerId,
        supplierId: args.supplierId,
        asClientId: args.asClientId,
        asClientName: args.asClientName,
      };
      return generateFixBuyerLinkPrompt(promptArgs);
    }

    case "fix-buyer-external-ids": {
      const promptArgs: FixBuyerExternalIdsArgs = {
        buyerId: args.buyerId,
        asClientId: args.asClientId,
        asClientName: args.asClientName,
      };
      return generateFixBuyerExternalIdsPrompt(promptArgs);
    }

    case "fix-acceptor-integration": {
      const promptArgs: FixAcceptorIntegrationArgs = {
        supplierId: args.supplierId,
        acceptorId: args.acceptorId,
        asClientId: args.asClientId,
        asClientName: args.asClientName,
      };
      return generateFixAcceptorIntegrationPrompt(promptArgs);
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}
