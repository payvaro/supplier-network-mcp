import { getNetworkAPIClient } from "../services/api-client.js";
import { analyzePostUpload, analyzeQuality } from "../services/import-analyzer.js";
import {
  analyzeHealth,
  analyzeCoverage,
  buildRelationshipMap,
} from "../services/relationship-analyzer.js";
import { formatOutput, createErrorResponse, formatAddress } from "../services/formatter.js";
import type { ImportAnalysisInput, RelationshipAnalysisInput } from "../schemas/index.js";
import type {
  ImportAnalysisResult,
  RelationshipAnalysisResult,
  ImportDuplicate,
} from "../types.js";

/**
 * Analyze imports - orchestrates import analysis based on mode
 */
export async function analyzeImport(params: ImportAnalysisInput) {
  try {
    const client = getNetworkAPIClient();
    let result: ImportAnalysisResult;

    switch (params.mode) {
      case "post-upload":
        result = await analyzePostUpload(client, params.dateRange, params.buyerId);
        break;
      case "preview":
        // Preview mode would typically receive suppliers from a previous upload preview
        // For now, we'll use the same as post-upload but flag it as preview
        result = await analyzePostUpload(client, params.dateRange, params.buyerId);
        result.mode = "preview";
        break;
      case "quality":
        result = await analyzeQuality(client, params.dateRange, params.buyerId);
        break;
      default:
        throw new Error(`Unknown analysis mode: ${params.mode}`);
    }

    const formatted = formatOutput(
      result,
      params.response_format,
      () => formatImportAnalysisMarkdown(result)
    );

    return {
      content: [
        {
          type: "text" as const,
          text: formatted.text,
        },
      ],
      structuredContent: formatted.structuredData,
    };
  } catch (error) {
    console.error("analyzeImport error:", error);
    const errorResponse = createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: errorResponse.text,
        },
      ],
    };
  }
}

/**
 * Analyze relationships - orchestrates relationship analysis based on type
 */
export async function analyzeRelationships(params: RelationshipAnalysisInput) {
  try {
    const client = getNetworkAPIClient();
    let result: RelationshipAnalysisResult;

    const options = { includeInactive: params.includeInactive };

    switch (params.analysisType) {
      case "health":
        result = await analyzeHealth(client, params.buyerId, options);
        break;
      case "coverage":
        result = await analyzeCoverage(client, params.buyerId, options);
        break;
      case "mapping":
        result = await buildRelationshipMap(client, params.buyerId, options);
        break;
      default:
        throw new Error(`Unknown analysis type: ${params.analysisType}`);
    }

    const formatted = formatOutput(
      result,
      params.response_format,
      () => formatRelationshipAnalysisMarkdown(result)
    );

    return {
      content: [
        {
          type: "text" as const,
          text: formatted.text,
        },
      ],
      structuredContent: formatted.structuredData,
    };
  } catch (error) {
    console.error("analyzeRelationships error:", error);
    const errorResponse = createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: errorResponse.text,
        },
      ],
    };
  }
}

/**
 * Format import analysis result as markdown
 */
function formatImportAnalysisMarkdown(result: ImportAnalysisResult): string {
  const parts: string[] = [];

  // Header
  const modeLabel = result.mode === "post-upload"
    ? "Post-Upload Analysis"
    : result.mode === "preview"
      ? "Import Preview"
      : "Data Quality Review";

  parts.push(`# 📊 ${modeLabel}`);
  parts.push("");
  parts.push(`**Generated:** ${new Date(result.generatedAt).toLocaleString()}`);
  parts.push("");

  // Summary
  parts.push("## Summary");
  parts.push("");
  parts.push(`| Metric | Count |`);
  parts.push(`|--------|-------|`);
  parts.push(`| Total Records | ${result.summary.totalRecords} |`);
  parts.push(`| New Suppliers | ${result.summary.newSuppliers} |`);
  parts.push(`| Potential Duplicates | ${result.summary.potentialDuplicates} |`);
  parts.push(`| Exact Matches | ${result.summary.exactMatches} |`);
  parts.push("");

  // Quality Metrics (if present)
  if (result.qualityMetrics) {
    parts.push("## Quality Metrics");
    parts.push("");
    parts.push(`**Data Completeness:** ${(result.qualityMetrics.completeness * 100).toFixed(1)}%`);
    parts.push(`**Match Confidence:** ${(result.qualityMetrics.matchConfidence * 100).toFixed(1)}%`);
    parts.push("");

    if (result.qualityMetrics.issues.length > 0) {
      parts.push("### Issues Found");
      parts.push("");
      for (const issue of result.qualityMetrics.issues) {
        const severityEmoji = issue.severity === "high" ? "🔴" : issue.severity === "medium" ? "🟡" : "🟢";
        parts.push(`- ${severityEmoji} **${issue.field}**: ${issue.issue} (${issue.affectedCount} affected)`);
      }
      parts.push("");
    }
  }

  // Duplicates
  if (result.duplicates.length > 0) {
    parts.push("## Potential Duplicates");
    parts.push("");
    parts.push(`Found ${result.duplicates.length} record(s) with potential matches.`);
    parts.push("");

    // Show top 5 duplicates
    const topDuplicates = result.duplicates.slice(0, 5);
    for (const dup of topDuplicates) {
      parts.push(formatDuplicateMarkdown(dup));
      parts.push("");
    }

    if (result.duplicates.length > 5) {
      parts.push(`... and ${result.duplicates.length - 5} more duplicate(s).`);
      parts.push("");
    }
  }

  // Recommendations
  parts.push("## Recommendations");
  parts.push("");
  for (const rec of result.recommendations) {
    parts.push(`- ${rec}`);
  }
  parts.push("");

  return parts.join("\n");
}

/**
 * Format a single duplicate record
 */
function formatDuplicateMarkdown(dup: ImportDuplicate): string {
  const parts: string[] = [];

  parts.push(`### ${dup.incoming.name || "Unnamed Supplier"}`);
  parts.push("");
  if (dup.incoming.email) {
    parts.push(`**Email:** ${dup.incoming.email}`);
  }
  if (dup.incoming.address) {
    parts.push(`**Address:** ${formatAddress(dup.incoming.address)}`);
  }
  parts.push("");
  parts.push("**Matches:**");
  parts.push("");

  for (const match of dup.existingMatches.slice(0, 3)) {
    const scorePercent = (match.matchScore.score * 100).toFixed(0);
    const levelEmoji = match.matchScore.level === "exact" ? "🎯" :
      match.matchScore.level === "high" ? "✅" :
        match.matchScore.level === "medium" ? "🟡" : "🔶";
    parts.push(`- ${levelEmoji} ${match.supplier.name || "Unnamed"} (${scorePercent}% match)`);
    if (match.matchScore.reasons.length > 0) {
      parts.push(`  - ${match.matchScore.reasons[0]}`);
    }
  }

  return parts.join("\n");
}

/**
 * Format relationship analysis result as markdown
 */
function formatRelationshipAnalysisMarkdown(result: RelationshipAnalysisResult): string {
  const parts: string[] = [];

  // Header
  const typeLabel = result.analysisType === "health"
    ? "Relationship Health Analysis"
    : result.analysisType === "coverage"
      ? "Coverage Analysis"
      : "Relationship Mapping";

  parts.push(`# 🔗 ${typeLabel}`);
  parts.push("");
  parts.push(`**Generated:** ${new Date(result.generatedAt).toLocaleString()}`);

  if (result.buyer) {
    parts.push(`**Buyer:** ${result.buyer.name || result.buyer.franchiseName || result.buyer.id}`);
  }
  parts.push("");

  // Health section
  if (result.health) {
    parts.push("## Health Metrics");
    parts.push("");
    parts.push(`| Metric | Value |`);
    parts.push(`|--------|-------|`);
    parts.push(`| Health Score | ${result.health.healthScore.toFixed(0)}% |`);
    parts.push(`| Active Links | ${result.health.activeLinks} |`);
    parts.push(`| Stale Links | ${result.health.staleLinks} |`);
    parts.push("");

    if (result.health.issues.length > 0) {
      parts.push("### Issues");
      parts.push("");
      for (const issue of result.health.issues) {
        const typeLabel = issue.type === "stale_link" ? "Stale Links" :
          issue.type === "missing_contact" ? "Missing Contacts" : "Inactive Suppliers";
        parts.push(`- **${typeLabel}:** ${issue.description}`);
      }
      parts.push("");
    }
  }

  // Coverage section
  if (result.coverage) {
    parts.push("## Coverage Metrics");
    parts.push("");
    parts.push(`| Metric | Value |`);
    parts.push(`|--------|-------|`);
    parts.push(`| Total Suppliers | ${result.coverage.totalSuppliers} |`);
    parts.push(`| Linked Suppliers | ${result.coverage.linkedSuppliers} |`);
    parts.push(`| Coverage | ${result.coverage.coveragePercent.toFixed(1)}% |`);
    parts.push("");

    if (result.coverage.missingHighPriority.length > 0) {
      parts.push("### High-Priority Unlinked Suppliers");
      parts.push("");
      for (const supplier of result.coverage.missingHighPriority.slice(0, 5)) {
        parts.push(`- ${supplier.name || "Unnamed"} (ID: ${supplier.id})`);
      }
      if (result.coverage.missingHighPriority.length > 5) {
        parts.push(`- ... and ${result.coverage.missingHighPriority.length - 5} more`);
      }
      parts.push("");
    }
  }

  // Mapping section
  if (result.mapping) {
    const buyerNodes = result.mapping.nodes.filter(n => n.type === "buyer");
    const supplierNodes = result.mapping.nodes.filter(n => n.type === "supplier");

    parts.push("## Network Structure");
    parts.push("");
    parts.push(`| Element | Count |`);
    parts.push(`|---------|-------|`);
    parts.push(`| Buyers | ${buyerNodes.length} |`);
    parts.push(`| Suppliers | ${supplierNodes.length} |`);
    parts.push(`| Connections | ${result.mapping.edges.length} |`);
    parts.push("");

    // Show top hubs
    const hubs = result.mapping.nodes
      .filter(n => n.linkCount > 0)
      .sort((a, b) => b.linkCount - a.linkCount)
      .slice(0, 5);

    if (hubs.length > 0) {
      parts.push("### Top Connected Nodes");
      parts.push("");
      for (const hub of hubs) {
        parts.push(`- **${hub.name || hub.id}** (${hub.type}): ${hub.linkCount} connection(s)`);
      }
      parts.push("");
    }

    // Show connection status breakdown
    const activeEdges = result.mapping.edges.filter(e => e.status === "ACTIVE").length;
    const inactiveEdges = result.mapping.edges.filter(e => e.status === "INACTIVE").length;
    const pendingEdges = result.mapping.edges.filter(e => e.status === "PENDING").length;

    if (result.mapping.edges.length > 0) {
      parts.push("### Connection Status");
      parts.push("");
      parts.push(`- 🟢 Active: ${activeEdges}`);
      parts.push(`- 🔴 Inactive: ${inactiveEdges}`);
      parts.push(`- 🟡 Pending: ${pendingEdges}`);
      parts.push("");
    }
  }

  // Recommendations
  parts.push("## Recommendations");
  parts.push("");
  for (const rec of result.recommendations) {
    parts.push(`- ${rec}`);
  }
  parts.push("");

  return parts.join("\n");
}
