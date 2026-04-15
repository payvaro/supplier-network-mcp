import { getNetworkAPIClient, NetworkAPIClient } from "../services/api-client.js";
import { analyzePostUpload, analyzeQuality } from "../services/import-analyzer.js";
import {
  analyzeHealth,
  analyzeCoverage,
  buildRelationshipMap,
} from "../services/relationship-analyzer.js";
import { validateImportData as runDataValidation } from "../services/data-validator.js";
import { formatOutput, createErrorResponse, formatAddress } from "../services/formatter.js";
import type {
  ImportAnalysisInput, RelationshipAnalysisInput, DataValidationInput,
  ListImportBatchesInput, ListMatchingJobsInput, GetMatchingJobInput,
  ListMatchCandidatesInput, ListStagedMatchesInput,
} from "../schemas/index.js";
import type {
  ImportAnalysisResult,
  RelationshipAnalysisResult,
  ImportDuplicate,
  DataValidationResult,
  SupplierValidationResult,
  FileImportJob,
  MatchingJob,
  MatchCandidate,
  StagedMatch,
  PaginatedResponse,
} from "../types.js";

/**
 * Analyze imports - orchestrates import analysis based on mode
 */
export async function analyzeImport(params: ImportAnalysisInput, clientOverride?: NetworkAPIClient) {
  try {
    const client = clientOverride ?? getNetworkAPIClient();
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
export async function analyzeRelationships(params: RelationshipAnalysisInput, clientOverride?: NetworkAPIClient) {
  try {
    const client = clientOverride ?? getNetworkAPIClient();
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

/**
 * Validate import data - checks for garbage/invalid content
 */
export async function validateImportDataTool(params: DataValidationInput, clientOverride?: NetworkAPIClient) {
  try {
    const client = clientOverride ?? getNetworkAPIClient();
    const result = await runDataValidation(client, params.dateRange, params.buyerId);

    const formatted = formatOutput(
      result,
      params.response_format,
      () => formatDataValidationMarkdown(result)
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
    console.error("validateImportData error:", error);
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
 * Format data validation result as markdown
 */
function formatDataValidationMarkdown(result: DataValidationResult): string {
  const parts: string[] = [];
  const { summary } = result;

  parts.push("# Data Validation Report");
  parts.push("");
  parts.push(`**Generated:** ${new Date(result.generatedAt).toLocaleString()}`);
  parts.push("");

  // Summary line
  const pct = summary.totalSuppliersScanned > 0
    ? ((summary.suppliersWithIssues / summary.totalSuppliersScanned) * 100).toFixed(1)
    : "0.0";
  parts.push(`**Scanned:** ${summary.totalSuppliersScanned} suppliers | **With Issues:** ${summary.suppliersWithIssues} (${pct}%) | **Total Issues:** ${summary.totalIssues}`);
  parts.push("");

  if (summary.totalIssues === 0) {
    parts.push("All validated fields appear clean. No garbage data detected.");
    parts.push("");
    return parts.join("\n");
  }

  // Issue breakdown by severity
  parts.push("## Issues by Severity");
  parts.push("");
  if (summary.issuesBySeverity.error > 0) parts.push(`- 🔴 **Error:** ${summary.issuesBySeverity.error}`);
  if (summary.issuesBySeverity.warning > 0) parts.push(`- 🟡 **Warning:** ${summary.issuesBySeverity.warning}`);
  if (summary.issuesBySeverity.info > 0) parts.push(`- 🔵 **Info:** ${summary.issuesBySeverity.info}`);
  parts.push("");

  // Issue breakdown by field
  const fieldEntries = Object.entries(summary.issuesByField).sort((a, b) => b[1] - a[1]);
  if (fieldEntries.length > 0) {
    parts.push("## Issues by Field");
    parts.push("");
    parts.push("| Field | Count |");
    parts.push("|-------|-------|");
    for (const [field, count] of fieldEntries) {
      parts.push(`| ${field} | ${count} |`);
    }
    parts.push("");
  }

  // Issue breakdown by rule
  const ruleEntries = Object.entries(summary.issuesByRule).sort((a, b) => b[1] - a[1]);
  if (ruleEntries.length > 0) {
    parts.push("## Most Common Issues");
    parts.push("");
    for (const [rule, count] of ruleEntries.slice(0, 10)) {
      parts.push(`- **${formatRuleName(rule)}:** ${count}`);
    }
    parts.push("");
  }

  // Per-supplier details (limit to top 20)
  const suppliersToShow = result.suppliers.slice(0, 20);
  parts.push(`## Suppliers with Issues${result.suppliers.length > 20 ? ` (showing 20 of ${result.suppliers.length})` : ""}`);
  parts.push("");

  for (let i = 0; i < suppliersToShow.length; i++) {
    parts.push(formatSupplierValidationMarkdown(suppliersToShow[i], i + 1));
    parts.push("");
  }

  if (result.suppliers.length > 20) {
    parts.push(`... and ${result.suppliers.length - 20} more supplier(s) with issues.`);
    parts.push("");
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
 * Format a single supplier's validation issues
 */
function formatSupplierValidationMarkdown(supplier: SupplierValidationResult, index: number): string {
  const parts: string[] = [];
  const severityEmoji = supplier.highestSeverity === "error" ? "🔴" :
    supplier.highestSeverity === "warning" ? "🟡" : "🔵";

  parts.push(`### ${index}. ${supplier.supplierName || "Unnamed Supplier"} ${severityEmoji}`);
  parts.push(`**ID:** ${supplier.supplierId} | **Issues:** ${supplier.issueCount}`);
  parts.push("");

  for (const issue of supplier.issues) {
    const issueSeverity = issue.severity === "error" ? "🔴" :
      issue.severity === "warning" ? "🟡" : "🔵";
    parts.push(`- ${issueSeverity} **${issue.field}** = \`${truncateValue(issue.value)}\` — ${issue.message}. *${issue.suggestion}*`);
  }

  return parts.join("\n");
}

/**
 * Format rule ID as human-readable name
 */
function formatRuleName(rule: string): string {
  return rule.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Truncate long values for display
 */
function truncateValue(value: string, maxLen = 50): string {
  if (value.length <= maxLen) return value;
  return value.substring(0, maxLen - 3) + "...";
}

/**
 * List file import batches/jobs
 */
export async function listImportBatchesTool(params: ListImportBatchesInput, clientOverride?: NetworkAPIClient) {
  try {
    const client = clientOverride ?? getNetworkAPIClient();
    const jobs = await client.listFileImportJobs(params.limit);

    const result = { jobs, count: jobs.length };

    const formatted = formatOutput(
      result,
      params.response_format,
      () => formatImportBatchesMarkdown(jobs)
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
    console.error("listImportBatches error:", error);
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
 * Format import batches list as markdown
 */
function formatImportBatchesMarkdown(jobs: FileImportJob[]): string {
  const parts: string[] = [];

  parts.push("# File Import Batches");
  parts.push("");
  parts.push(`**Total:** ${jobs.length} import job(s)`);
  parts.push("");

  if (jobs.length === 0) {
    parts.push("No import jobs found.");
    parts.push("");
    return parts.join("\n");
  }

  // Summary table
  parts.push("| # | Filename | Status | Entities | Date |");
  parts.push("|---|----------|--------|----------|------|");

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const statusEmoji = job.status === "COMPLETED" ? "✅" :
      job.status === "FAILED" ? "❌" :
      job.status === "PROCESSING" ? "⏳" :
      job.status === "DISCARDED" ? "🗑️" :
      job.status === "CANCELLED" ? "🚫" : "⏸️";
    const date = new Date(job.createdAt).toLocaleDateString();
    parts.push(`| ${i + 1} | ${job.sourceFilename} | ${statusEmoji} ${job.status} | ${job.createdEntityCount} | ${date} |`);
  }
  parts.push("");

  // Detailed view for each job
  parts.push("## Details");
  parts.push("");

  for (const job of jobs) {
    parts.push(`### ${job.sourceFilename}`);
    parts.push(`**ID:** \`${job.id}\``);
    parts.push(`**Status:** ${job.status} | **Client:** ${job.clientId} | **Created:** ${new Date(job.createdAt).toLocaleString()}`);

    if (job.createdEntityCount > 0) {
      parts.push(`**Entities Created:** ${job.createdEntityCount}`);
    }

    // Entity type breakdown
    const summaryEntries = Object.entries(job.entityTypeSummaries);
    if (summaryEntries.length > 0) {
      parts.push("");
      parts.push("| Entity Type | Success | Failed |");
      parts.push("|-------------|---------|--------|");
      for (const [type, result] of summaryEntries) {
        parts.push(`| ${type} | ${result.successCount} | ${result.failureCount} |`);
      }
    }

    if (job.fileProcessingRecordIds.length > 0) {
      parts.push(`**Processing Records:** ${job.fileProcessingRecordIds.length}`);
    }

    parts.push("");
    parts.push("---");
    parts.push("");
  }

  return parts.join("\n");
}

// --- Matching Job Tools ---

function normalizeToArray<T>(response: T[] | PaginatedResponse<T> | unknown): T[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === "object" && "items" in response) {
    return (response as PaginatedResponse<T>).items;
  }
  return [];
}

/**
 * List matching jobs
 */
export async function listMatchingJobsTool(params: ListMatchingJobsInput, clientOverride?: NetworkAPIClient) {
  try {
    const client = clientOverride ?? getNetworkAPIClient();
    const jobs = await client.listMatchingJobs(params.status);
    const result = { jobs, count: jobs.length };

    const formatted = formatOutput(result, params.response_format, () => formatMatchingJobsMarkdown(jobs));
    return { content: [{ type: "text" as const, text: formatted.text }], structuredContent: formatted.structuredData };
  } catch (error) {
    console.error("listMatchingJobs error:", error);
    return { isError: true, content: [{ type: "text" as const, text: createErrorResponse(error instanceof Error ? error.message : String(error)).text }] };
  }
}

function formatMatchingJobsMarkdown(jobs: MatchingJob[]): string {
  const parts: string[] = [];
  parts.push("# Matching Jobs");
  parts.push("");
  parts.push(`**Total:** ${jobs.length} job(s)`);
  parts.push("");

  if (jobs.length === 0) {
    parts.push("No matching jobs found.");
    return parts.join("\n");
  }

  parts.push("| # | File | Status | Rows | Exact | Possible | Conflict | New | Failed | Date |");
  parts.push("|---|------|--------|------|-------|----------|----------|-----|--------|------|");

  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i];
    const statusEmoji = j.status === "COMPLETED" ? "✅" : j.status === "REVIEW" ? "👀" :
      j.status === "RUNNING" ? "⏳" : j.status === "FAILED" ? "❌" : j.status === "ABORTED" ? "🚫" : "⏸️";
    const date = new Date(j.createdAt).toLocaleDateString();
    parts.push(`| ${i + 1} | ${j.fileName} | ${statusEmoji} ${j.status} | ${j.totalRows} | ${j.exactMatches} | ${j.possibleMatches} | ${j.conflicts} | ${j.netNew} | ${j.failed} | ${date} |`);
  }
  parts.push("");

  // Show details for jobs in REVIEW status
  const reviewJobs = jobs.filter(j => j.status === "REVIEW");
  if (reviewJobs.length > 0) {
    parts.push("## Jobs Awaiting Review");
    parts.push("");
    for (const j of reviewJobs) {
      const reviewable = j.possibleMatches + j.conflicts;
      parts.push(`- **${j.fileName}** (ID: \`${j.jobId}\`) — ${reviewable} match(es) to review`);
    }
    parts.push("");
  }

  return parts.join("\n");
}

/**
 * Get matching job details
 */
export async function getMatchingJobTool(params: GetMatchingJobInput, clientOverride?: NetworkAPIClient) {
  try {
    const client = clientOverride ?? getNetworkAPIClient();
    const job = await client.getMatchingJob(params.jobId);

    const formatted = formatOutput(job, params.response_format, () => formatMatchingJobDetailMarkdown(job));
    return { content: [{ type: "text" as const, text: formatted.text }], structuredContent: formatted.structuredData };
  } catch (error) {
    console.error("getMatchingJob error:", error);
    return { isError: true, content: [{ type: "text" as const, text: createErrorResponse(error instanceof Error ? error.message : String(error)).text }] };
  }
}

function formatMatchingJobDetailMarkdown(job: MatchingJob): string {
  const parts: string[] = [];
  const statusEmoji = job.status === "COMPLETED" ? "✅" : job.status === "REVIEW" ? "👀" :
    job.status === "RUNNING" ? "⏳" : job.status === "FAILED" ? "❌" : "⏸️";

  parts.push(`# Matching Job: ${job.fileName}`);
  parts.push("");
  parts.push(`**ID:** \`${job.jobId}\``);
  parts.push(`**Status:** ${statusEmoji} ${job.status}${job.statusMessage ? ` — ${job.statusMessage}` : ""}`);
  parts.push(`**Created:** ${new Date(job.createdAt).toLocaleString()}`);
  if (job.completedAt) parts.push(`**Completed:** ${new Date(job.completedAt).toLocaleString()}`);
  parts.push("");

  // Progress
  const processed = job.exactMatches + job.possibleMatches + job.conflicts + job.netNew + job.failed;
  const pct = job.totalRows > 0 ? ((processed / job.totalRows) * 100).toFixed(0) : "0";
  parts.push("## Matching Results");
  parts.push("");
  parts.push(`**Progress:** ${processed} / ${job.totalRows} rows (${pct}%)`);
  parts.push("");
  parts.push("| Category | Count | Description |");
  parts.push("|----------|-------|-------------|");
  parts.push(`| Exact Match | ${job.exactMatches} | High confidence (≥95%), auto-merge recommended |`);
  parts.push(`| Possible Match | ${job.possibleMatches} | Medium confidence (70-95%), review needed |`);
  parts.push(`| Conflict | ${job.conflicts} | Multiple high-confidence matches |`);
  parts.push(`| Net New | ${job.netNew} | No match found (<70%) |`);
  parts.push(`| Failed | ${job.failed} | Processing errors |`);
  parts.push("");

  // Finalization stats (if any)
  if (job.merged > 0 || job.created > 0 || job.skipped > 0) {
    parts.push("## Finalization Results");
    parts.push("");
    parts.push(`| Action | Count |`);
    parts.push(`|--------|-------|`);
    parts.push(`| Merged | ${job.merged} |`);
    parts.push(`| Created | ${job.created} |`);
    parts.push(`| Skipped | ${job.skipped} |`);
    parts.push("");
  }

  return parts.join("\n");
}

/**
 * List match candidates for a job
 */
export async function listMatchCandidatesTool(params: ListMatchCandidatesInput, clientOverride?: NetworkAPIClient) {
  try {
    const client = clientOverride ?? getNetworkAPIClient();
    const response = await client.listMatchCandidates(params.jobId, params.category, params.pageSize, params.cursor);
    const candidates = normalizeToArray<MatchCandidate>(response);
    const result = { candidates, count: candidates.length, jobId: params.jobId };

    const formatted = formatOutput(result, params.response_format, () => formatCandidatesMarkdown(candidates, params.jobId, params.category));
    return { content: [{ type: "text" as const, text: formatted.text }], structuredContent: formatted.structuredData };
  } catch (error) {
    console.error("listMatchCandidates error:", error);
    return { isError: true, content: [{ type: "text" as const, text: createErrorResponse(error instanceof Error ? error.message : String(error)).text }] };
  }
}

function formatCandidatesMarkdown(candidates: MatchCandidate[], jobId: string, category?: string): string {
  const parts: string[] = [];
  parts.push(`# Match Candidates`);
  parts.push("");
  parts.push(`**Job:** \`${jobId}\`${category ? ` | **Filter:** ${category}` : ""}`);
  parts.push(`**Showing:** ${candidates.length} candidate(s)`);
  parts.push("");

  if (candidates.length === 0) {
    parts.push("No candidates found.");
    return parts.join("\n");
  }

  parts.push("| Row | Category | Confidence | Matched Supplier | Resolution |");
  parts.push("|-----|----------|------------|------------------|------------|");

  for (const c of candidates) {
    const catEmoji = c.category === "EXACT_MATCH" ? "🎯" : c.category === "POSSIBLE_MATCH" ? "🟡" :
      c.category === "CONFLICT" ? "⚠️" : "🆕";
    const conf = (c.confidenceScore * 100).toFixed(0) + "%";
    parts.push(`| ${c.rowNumber} | ${catEmoji} ${c.category} | ${conf} | ${c.matchedSupplierId || "—"} | ${c.resolution || "—"} |`);
  }
  parts.push("");

  return parts.join("\n");
}

/**
 * List staged matches for a job
 */
export async function listStagedMatchesTool(params: ListStagedMatchesInput, clientOverride?: NetworkAPIClient) {
  try {
    const client = clientOverride ?? getNetworkAPIClient();
    const response = await client.listStagedMatches(params.jobId, params.status, params.category, params.pageSize, params.cursor);
    const matches = normalizeToArray<StagedMatch>(response);
    const result = { matches, count: matches.length, jobId: params.jobId };

    const formatted = formatOutput(result, params.response_format, () => formatStagedMatchesMarkdown(matches, params.jobId));
    return { content: [{ type: "text" as const, text: formatted.text }], structuredContent: formatted.structuredData };
  } catch (error) {
    console.error("listStagedMatches error:", error);
    return { isError: true, content: [{ type: "text" as const, text: createErrorResponse(error instanceof Error ? error.message : String(error)).text }] };
  }
}

function formatStagedMatchesMarkdown(matches: StagedMatch[], jobId: string): string {
  const parts: string[] = [];
  parts.push(`# Staged Matches`);
  parts.push("");
  parts.push(`**Job:** \`${jobId}\` | **Showing:** ${matches.length} match(es)`);
  parts.push("");

  if (matches.length === 0) {
    parts.push("No staged matches found.");
    return parts.join("\n");
  }

  // Summary by status
  const pending = matches.filter(m => m.status === "PENDING").length;
  const approved = matches.filter(m => m.status === "APPROVED").length;
  const rejected = matches.filter(m => m.status === "REJECTED").length;
  if (pending > 0 || approved > 0 || rejected > 0) {
    parts.push(`**Pending:** ${pending} | **Approved:** ${approved} | **Rejected:** ${rejected}`);
    parts.push("");
  }

  for (const m of matches) {
    const statusEmoji = m.status === "PENDING" ? "⏳" : m.status === "APPROVED" ? "✅" :
      m.status === "REJECTED" ? "❌" : "⏭️";

    parts.push(`### ${statusEmoji} Row ${m.candidate.rowNumber} — ${m.candidate.category}`);
    parts.push(`**ID:** \`${m.stagedMatchId}\` | **Confidence:** ${(m.candidate.confidenceScore * 100).toFixed(0)}% | **Status:** ${m.status}`);

    // Show alternatives
    if (m.alternatives.length > 0) {
      parts.push("");
      parts.push("**Alternatives:**");
      for (const alt of m.alternatives.slice(0, 5)) {
        parts.push(`- ${alt.supplierName || alt.supplierId} — ${(alt.confidenceScore * 100).toFixed(0)}%`);
      }
    }

    // Show AI recommendation if present
    if (m.aiRecommendation) {
      const aiEmoji = m.aiRecommendation === "MERGE" ? "🔀" : m.aiRecommendation === "CREATE_NEW" ? "🆕" : "🔍";
      parts.push(`**AI:** ${aiEmoji} ${m.aiRecommendation}${m.aiConfidence ? ` (${(m.aiConfidence * 100).toFixed(0)}%)` : ""}`);
      if (m.aiRationale) parts.push(`> ${m.aiRationale}`);
    }

    parts.push("");
    parts.push("---");
    parts.push("");
  }

  return parts.join("\n");
}
