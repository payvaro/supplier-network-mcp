import type { NetworkAPIClient } from "./api-client.js";
import { searchAndRankSuppliers } from "./matching.js";
import { MATCH_THRESHOLDS } from "../constants.js";
import type {
  Supplier,
  ImportAnalysisResult,
  ImportDuplicate,
  QualityIssue,
  QualityMetrics,
} from "../types.js";

interface DateRange {
  from: string;
  to: string;
}

/**
 * Normalize API response to array - handles both array and paginated responses
 */
function normalizeToArray<T>(response: T[] | { items?: T[] } | unknown): T[] {
  if (Array.isArray(response)) {
    return response;
  }
  if (response && typeof response === 'object' && 'items' in response) {
    const paginatedResponse = response as { items?: T[] };
    return paginatedResponse.items || [];
  }
  console.error('[import-analyzer] Unexpected response format:', typeof response);
  return [];
}

/**
 * Analyze suppliers imported within a date range (post-upload analysis)
 */
export async function analyzePostUpload(
  client: NetworkAPIClient,
  dateRange?: DateRange,
  buyerId?: string
): Promise<ImportAnalysisResult> {
  // Get suppliers by date range
  let importedSuppliers: Supplier[];

  if (dateRange) {
    // Fetch suppliers for each date in the range
    const startDate = parseDate(dateRange.from);
    const endDate = parseDate(dateRange.to);
    importedSuppliers = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = formatDate(currentDate);
      try {
        const suppliersForDate = await client.getSuppliersByDate(dateStr);
        importedSuppliers.push(...suppliersForDate);
      } catch {
        // Date might not have any suppliers - that's ok
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else {
    // Default to today
    const today = formatDate(new Date());
    importedSuppliers = await client.getSuppliersByDate(today);
  }

  // Filter by buyer if specified
  if (buyerId && importedSuppliers.length > 0) {
    importedSuppliers = importedSuppliers.filter(s =>
      s.buyerLinks?.some(link => link.buyerId === buyerId)
    );
  }

  // Get all existing suppliers for duplicate detection
  const allSuppliersResponse = await client.getAllSuppliers();
  const allSuppliers = normalizeToArray<Supplier>(allSuppliersResponse);

  // Exclude recently imported from the existing pool for comparison
  const importedIds = new Set(importedSuppliers.map(s => s.id));
  const existingSuppliers = allSuppliers.filter(s => !importedIds.has(s.id));

  // Find duplicates
  const duplicates = findDuplicates(importedSuppliers, existingSuppliers);

  // Calculate summary
  const summary = {
    totalRecords: importedSuppliers.length,
    newSuppliers: importedSuppliers.length - duplicates.filter(d =>
      d.existingMatches.some(m => m.matchScore.level === "exact")
    ).length,
    potentialDuplicates: duplicates.filter(d =>
      d.existingMatches.some(m => m.matchScore.level === "high" || m.matchScore.level === "medium")
    ).length,
    exactMatches: duplicates.filter(d =>
      d.existingMatches.some(m => m.matchScore.level === "exact")
    ).length,
  };

  // Generate recommendations
  const recommendations = generateImportRecommendations(summary, duplicates);

  return {
    mode: "post-upload",
    summary,
    duplicates,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Preview what would happen if suppliers were imported (preview analysis)
 */
export async function analyzePreview(
  client: NetworkAPIClient,
  suppliers: Supplier[]
): Promise<ImportAnalysisResult> {
  // Get all existing suppliers for duplicate detection
  const existingSuppliersResponse = await client.getAllSuppliers();
  const existingSuppliers = normalizeToArray<Supplier>(existingSuppliersResponse);

  // Find duplicates
  const duplicates = findDuplicates(suppliers, existingSuppliers);

  // Calculate summary
  const summary = {
    totalRecords: suppliers.length,
    newSuppliers: suppliers.length - duplicates.filter(d =>
      d.existingMatches.some(m => m.matchScore.level === "exact")
    ).length,
    potentialDuplicates: duplicates.filter(d =>
      d.existingMatches.some(m => m.matchScore.level === "high" || m.matchScore.level === "medium")
    ).length,
    exactMatches: duplicates.filter(d =>
      d.existingMatches.some(m => m.matchScore.level === "exact")
    ).length,
  };

  // Generate recommendations
  const recommendations = generateImportRecommendations(summary, duplicates);

  return {
    mode: "preview",
    summary,
    duplicates,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Analyze data quality of suppliers
 */
export async function analyzeQuality(
  client: NetworkAPIClient,
  dateRange?: DateRange,
  buyerId?: string
): Promise<ImportAnalysisResult> {
  // Get suppliers to analyze
  let suppliers: Supplier[];

  if (dateRange) {
    const startDate = parseDate(dateRange.from);
    const endDate = parseDate(dateRange.to);
    suppliers = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = formatDate(currentDate);
      try {
        const suppliersForDate = await client.getSuppliersByDate(dateStr);
        suppliers.push(...suppliersForDate);
      } catch {
        // Date might not have any suppliers - that's ok
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else {
    const suppliersResponse = await client.getAllSuppliers();
    suppliers = normalizeToArray<Supplier>(suppliersResponse);
  }

  // Filter by buyer if specified
  if (buyerId && suppliers.length > 0) {
    suppliers = suppliers.filter(s =>
      s.buyerLinks?.some(link => link.buyerId === buyerId)
    );
  }

  // Get existing suppliers for duplicate detection
  const allSuppliersResponse = await client.getAllSuppliers();
  const allSuppliers = normalizeToArray<Supplier>(allSuppliersResponse);
  const duplicates = findDuplicates(suppliers, allSuppliers.filter(s => !suppliers.some(sup => sup.id === s.id)));

  // Calculate quality metrics
  const qualityMetrics = calculateQualityMetrics(suppliers);

  // Calculate summary
  const summary = {
    totalRecords: suppliers.length,
    newSuppliers: suppliers.length,
    potentialDuplicates: duplicates.filter(d =>
      d.existingMatches.some(m => m.matchScore.level === "high" || m.matchScore.level === "medium")
    ).length,
    exactMatches: duplicates.filter(d =>
      d.existingMatches.some(m => m.matchScore.level === "exact")
    ).length,
  };

  // Generate recommendations
  const recommendations = generateQualityRecommendations(qualityMetrics, summary);

  return {
    mode: "quality",
    summary,
    duplicates,
    qualityMetrics,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Find duplicates by matching incoming suppliers against existing ones
 */
function findDuplicates(
  incomingSuppliers: Supplier[],
  existingSuppliers: Supplier[]
): ImportDuplicate[] {
  const duplicates: ImportDuplicate[] = [];

  for (const incoming of incomingSuppliers) {
    const searchCriteria: { name?: string; address?: typeof incoming.address; email?: string } = {};

    if (incoming.name) {
      searchCriteria.name = incoming.name;
    }
    if (incoming.address) {
      searchCriteria.address = incoming.address;
    }
    if (incoming.email) {
      searchCriteria.email = incoming.email;
    }

    // Skip if no search criteria available
    if (Object.keys(searchCriteria).length === 0) {
      continue;
    }

    const matches = searchAndRankSuppliers(
      existingSuppliers,
      searchCriteria,
      MATCH_THRESHOLDS.LOW
    );

    if (matches.length > 0) {
      duplicates.push({
        incoming,
        existingMatches: matches.slice(0, 5), // Top 5 matches
      });
    }
  }

  return duplicates;
}

/**
 * Calculate quality metrics for a set of suppliers
 */
function calculateQualityMetrics(suppliers: Supplier[]): QualityMetrics {
  const issues: QualityIssue[] = [];
  let totalFields = 0;
  let filledFields = 0;

  // Track issues by field
  let missingName = 0;
  let missingEmail = 0;
  let missingAddress = 0;
  let missingContacts = 0;

  for (const supplier of suppliers) {
    // Check name
    totalFields++;
    if (supplier.name && supplier.name.trim()) {
      filledFields++;
    } else {
      missingName++;
    }

    // Check email
    totalFields++;
    if (supplier.email && supplier.email.trim()) {
      filledFields++;
    } else {
      missingEmail++;
    }

    // Check address
    totalFields++;
    if (supplier.address && (supplier.address.streetAddress || supplier.address.city)) {
      filledFields++;
    } else {
      missingAddress++;
    }

    // Check contacts
    totalFields++;
    if (supplier.contacts && supplier.contacts.length > 0) {
      filledFields++;
    } else {
      missingContacts++;
    }
  }

  // Generate issues
  if (missingName > 0) {
    issues.push({
      field: "name",
      issue: "Missing supplier name",
      severity: "high",
      affectedCount: missingName,
    });
  }

  if (missingEmail > 0) {
    issues.push({
      field: "email",
      issue: "Missing email address",
      severity: "medium",
      affectedCount: missingEmail,
    });
  }

  if (missingAddress > 0) {
    issues.push({
      field: "address",
      issue: "Missing or incomplete address",
      severity: "medium",
      affectedCount: missingAddress,
    });
  }

  if (missingContacts > 0) {
    issues.push({
      field: "contacts",
      issue: "No contact information",
      severity: "low",
      affectedCount: missingContacts,
    });
  }

  const completeness = totalFields > 0 ? filledFields / totalFields : 0;
  const matchConfidence = 1 - (issues.filter(i => i.severity === "high").length / Math.max(suppliers.length, 1));

  return {
    completeness,
    matchConfidence,
    issues,
  };
}

/**
 * Generate recommendations based on import analysis
 */
function generateImportRecommendations(
  summary: { totalRecords: number; newSuppliers: number; potentialDuplicates: number; exactMatches: number },
  duplicates: ImportDuplicate[]
): string[] {
  const recommendations: string[] = [];

  if (summary.exactMatches > 0) {
    recommendations.push(
      `Review ${summary.exactMatches} exact matches - these may be duplicate entries that should be merged.`
    );
  }

  if (summary.potentialDuplicates > 0) {
    recommendations.push(
      `Investigate ${summary.potentialDuplicates} potential duplicates - manual review recommended to confirm.`
    );
  }

  // Find high-confidence duplicates that need attention
  const highConfidenceDuplicates = duplicates.filter(d =>
    d.existingMatches.some(m => m.matchScore.level === "high")
  );

  if (highConfidenceDuplicates.length > 0) {
    const topDuplicate = highConfidenceDuplicates[0];
    const bestMatch = topDuplicate.existingMatches[0];
    recommendations.push(
      `High-confidence duplicate found: "${topDuplicate.incoming.name}" matches "${bestMatch.supplier.name}" (${(bestMatch.matchScore.score * 100).toFixed(0)}% match).`
    );
  }

  if (summary.newSuppliers === summary.totalRecords && summary.totalRecords > 0) {
    recommendations.push(
      "All records appear to be new suppliers. Proceed with import if data quality is acceptable."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Import analysis complete. No critical issues detected.");
  }

  return recommendations;
}

/**
 * Generate recommendations based on quality analysis
 */
function generateQualityRecommendations(
  metrics: QualityMetrics,
  summary: { totalRecords: number; newSuppliers: number; potentialDuplicates: number; exactMatches: number }
): string[] {
  const recommendations: string[] = [];

  // Completeness recommendations
  if (metrics.completeness < 0.5) {
    recommendations.push(
      `Data completeness is low (${(metrics.completeness * 100).toFixed(0)}%). Consider enriching supplier data before import.`
    );
  } else if (metrics.completeness < 0.8) {
    recommendations.push(
      `Data completeness is moderate (${(metrics.completeness * 100).toFixed(0)}%). Some fields may benefit from additional data.`
    );
  }

  // Issue-specific recommendations
  const highSeverityIssues = metrics.issues.filter(i => i.severity === "high");
  for (const issue of highSeverityIssues) {
    recommendations.push(
      `Critical: ${issue.issue} affects ${issue.affectedCount} record(s). This should be addressed before import.`
    );
  }

  const mediumSeverityIssues = metrics.issues.filter(i => i.severity === "medium");
  if (mediumSeverityIssues.length > 0) {
    const totalAffected = mediumSeverityIssues.reduce((sum, i) => sum + i.affectedCount, 0);
    recommendations.push(
      `${mediumSeverityIssues.length} medium-severity issues affect ${totalAffected} total fields. Review recommended.`
    );
  }

  // Duplicate recommendations
  if (summary.potentialDuplicates > 0) {
    recommendations.push(
      `${summary.potentialDuplicates} potential duplicate(s) detected. Consider deduplication before import.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Data quality is acceptable. Ready for import.");
  }

  return recommendations;
}

/**
 * Parse date string in yyyyMMdd format to Date object
 */
function parseDate(dateStr: string): Date {
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1; // JS months are 0-indexed
  const day = parseInt(dateStr.substring(6, 8), 10);
  return new Date(year, month, day);
}

/**
 * Format Date object to yyyyMMdd string
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}
