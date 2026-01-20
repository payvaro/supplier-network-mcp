import type { NetworkAPIClient } from "./api-client.js";
import type {
  Buyer,
  Supplier,
  BuyerLink,
  RelationshipAnalysisResult,
  RelationshipHealth,
  RelationshipCoverage,
  RelationshipMapping,
  HealthIssue,
  NetworkNode,
  NetworkEdge,
} from "../types.js";

interface AnalyzeOptions {
  includeInactive?: boolean;
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
  console.error('[relationship-analyzer] Unexpected response format:', typeof response);
  return [];
}

/**
 * Analyze health of buyer-supplier relationships
 */
export async function analyzeHealth(
  client: NetworkAPIClient,
  buyerId?: string,
  options: AnalyzeOptions = {}
): Promise<RelationshipAnalysisResult> {
  const { includeInactive = false } = options;

  let buyer: Buyer | undefined;
  let buyerLinks: BuyerLink[];
  let linkedSuppliers: Supplier[];

  if (buyerId) {
    // Analyze specific buyer - include links to get buyerLinks
    buyer = await client.getBuyer(buyerId, true);
    const suppliersResponse = await client.getSuppliersForBuyer(buyerId);
    linkedSuppliers = normalizeToArray<Supplier>(suppliersResponse);
    buyerLinks = buyer.buyerLinks || [];
  } else {
    // Analyze all buyer links - fetch buyers with links to get all buyerLinks
    const buyers = await client.listBuyers(true);
    buyerLinks = buyers.flatMap(b => b.buyerLinks || []);
    const suppliersResponse = await client.getAllSuppliers();
    linkedSuppliers = normalizeToArray<Supplier>(suppliersResponse);
  }

  // Filter links based on includeInactive option
  const relevantLinks = includeInactive
    ? buyerLinks
    : buyerLinks.filter(link => link.connectionStatus === "ACTIVE");

  // Calculate health metrics
  const health = calculateHealth(relevantLinks, linkedSuppliers, includeInactive);

  // Generate recommendations
  const recommendations = generateHealthRecommendations(health, buyer);

  return {
    analysisType: "health",
    buyer,
    health,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Analyze coverage of buyer-supplier relationships
 */
export async function analyzeCoverage(
  client: NetworkAPIClient,
  buyerId?: string,
  options: AnalyzeOptions = {}
): Promise<RelationshipAnalysisResult> {
  const { includeInactive = false } = options;

  let buyer: Buyer | undefined;
  let linkedSuppliers: Supplier[];
  let allSuppliers: Supplier[];

  if (buyerId) {
    // Analyze specific buyer - include links
    buyer = await client.getBuyer(buyerId, true);
    const suppliersResponse = await client.getSuppliersForBuyer(buyerId);
    linkedSuppliers = normalizeToArray<Supplier>(suppliersResponse);
    const allSuppliersResponse = await client.getAllSuppliers();
    allSuppliers = normalizeToArray<Supplier>(allSuppliersResponse);
  } else {
    // Analyze overall coverage - fetch buyers with links
    const buyers = await client.listBuyers(true);
    const buyerLinks = buyers.flatMap(b => b.buyerLinks || []);
    const allSuppliersResponse = await client.getAllSuppliers();
    allSuppliers = normalizeToArray<Supplier>(allSuppliersResponse);

    // Filter based on includeInactive
    const relevantLinks = includeInactive
      ? buyerLinks
      : buyerLinks.filter(link => link.connectionStatus === "ACTIVE");

    const linkedIds = new Set(relevantLinks.map(link => link.supplierId));
    linkedSuppliers = allSuppliers.filter(s => linkedIds.has(s.id));
  }

  // Calculate coverage metrics
  const coverage = calculateCoverage(linkedSuppliers, allSuppliers);

  // Generate recommendations
  const recommendations = generateCoverageRecommendations(coverage, buyer);

  return {
    analysisType: "coverage",
    buyer,
    coverage,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Build a relationship map showing network structure
 */
export async function buildRelationshipMap(
  client: NetworkAPIClient,
  buyerId?: string,
  options: AnalyzeOptions = {}
): Promise<RelationshipAnalysisResult> {
  const { includeInactive = false } = options;

  let buyer: Buyer | undefined;
  let buyers: Buyer[];
  let suppliers: Supplier[];
  let buyerLinks: BuyerLink[];

  if (buyerId) {
    // Map specific buyer's network - include links
    buyer = await client.getBuyer(buyerId, true);
    buyers = [buyer];
    const suppliersResponse = await client.getSuppliersForBuyer(buyerId);
    suppliers = normalizeToArray<Supplier>(suppliersResponse);
    buyerLinks = buyer.buyerLinks || [];
  } else {
    // Map entire network - fetch buyers with links
    buyers = await client.listBuyers(true);
    buyerLinks = buyers.flatMap(b => b.buyerLinks || []);
    const suppliersResponse = await client.getAllSuppliers();
    suppliers = normalizeToArray<Supplier>(suppliersResponse);
  }

  // Filter links based on includeInactive
  const relevantLinks = includeInactive
    ? buyerLinks
    : buyerLinks.filter(link => link.connectionStatus === "ACTIVE");

  // Build mapping
  const mapping = buildMapping(buyers, suppliers, relevantLinks);

  // Generate recommendations
  const recommendations = generateMappingRecommendations(mapping);

  return {
    analysisType: "mapping",
    buyer,
    mapping,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate health metrics for buyer-supplier relationships
 */
function calculateHealth(
  links: BuyerLink[],
  suppliers: Supplier[],
  includeInactive: boolean
): RelationshipHealth {
  const issues: HealthIssue[] = [];

  // Count active and inactive links
  const activeLinks = links.filter(link => link.connectionStatus === "ACTIVE").length;
  const staleLinks = links.filter(link => link.connectionStatus === "INACTIVE").length;
  const pendingLinks = links.filter(link => link.connectionStatus === "PENDING").length;

  // Create supplier lookup
  const supplierMap = new Map(suppliers.map(s => [s.id, s]));

  // Check for stale links
  if (staleLinks > 0 && includeInactive) {
    const staleIds = links
      .filter(link => link.connectionStatus === "INACTIVE")
      .map(link => link.supplierId)
      .filter((id): id is string => id !== undefined);

    issues.push({
      type: "stale_link",
      description: `${staleLinks} inactive link(s) found`,
      affectedIds: staleIds,
    });
  }

  // Check for suppliers missing contact info
  const suppliersWithoutContacts: string[] = [];
  for (const supplier of suppliers) {
    if (!supplier.contacts || supplier.contacts.length === 0) {
      if (supplier.id) {
        suppliersWithoutContacts.push(supplier.id);
      }
    }
  }

  if (suppliersWithoutContacts.length > 0) {
    issues.push({
      type: "missing_contact",
      description: `${suppliersWithoutContacts.length} supplier(s) missing contact information`,
      affectedIds: suppliersWithoutContacts,
    });
  }

  // Check for links to potentially inactive suppliers (suppliers without recent updates)
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const potentiallyInactiveSuppliers: string[] = [];

  for (const link of links) {
    if (link.connectionStatus === "ACTIVE" && link.supplierId) {
      const supplier = supplierMap.get(link.supplierId);
      if (supplier && supplier.updatedAt) {
        const updatedAt = new Date(supplier.updatedAt);
        if (updatedAt < sixMonthsAgo) {
          potentiallyInactiveSuppliers.push(link.supplierId);
        }
      }
    }
  }

  if (potentiallyInactiveSuppliers.length > 0) {
    issues.push({
      type: "inactive_supplier",
      description: `${potentiallyInactiveSuppliers.length} linked supplier(s) have not been updated in 6+ months`,
      affectedIds: potentiallyInactiveSuppliers,
    });
  }

  // Calculate health score (0-100)
  // Start with 100 and deduct for issues
  let healthScore = 100;

  // Deduct for stale links
  const totalLinks = activeLinks + staleLinks + pendingLinks;
  if (totalLinks > 0) {
    healthScore -= (staleLinks / totalLinks) * 30;
  }

  // Deduct for missing contacts
  if (suppliers.length > 0) {
    healthScore -= (suppliersWithoutContacts.length / suppliers.length) * 20;
  }

  // Deduct for inactive suppliers
  if (activeLinks > 0) {
    healthScore -= (potentiallyInactiveSuppliers.length / activeLinks) * 20;
  }

  // Deduct for pending links (uncertainty)
  if (totalLinks > 0) {
    healthScore -= (pendingLinks / totalLinks) * 10;
  }

  healthScore = Math.max(0, Math.min(100, healthScore));

  return {
    activeLinks,
    staleLinks,
    healthScore,
    issues,
  };
}

/**
 * Calculate coverage metrics
 */
function calculateCoverage(
  linkedSuppliers: Supplier[],
  allSuppliers: Supplier[]
): RelationshipCoverage {
  const totalSuppliers = allSuppliers.length;
  const linkedCount = linkedSuppliers.length;
  const coveragePercent = totalSuppliers > 0 ? (linkedCount / totalSuppliers) * 100 : 0;

  // Identify suppliers not linked (potentially high priority)
  const linkedIds = new Set(linkedSuppliers.map(s => s.id));
  const unlinkedSuppliers = allSuppliers.filter(s => !linkedIds.has(s.id));

  // Identify high-priority missing suppliers (those with contacts or recent activity)
  const missingHighPriority = unlinkedSuppliers.filter(supplier => {
    // Has contacts
    if (supplier.contacts && supplier.contacts.length > 0) {
      return true;
    }
    // Recently updated (within last 90 days)
    if (supplier.updatedAt) {
      const updatedAt = new Date(supplier.updatedAt);
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      if (updatedAt > ninetyDaysAgo) {
        return true;
      }
    }
    return false;
  });

  return {
    totalSuppliers,
    linkedSuppliers: linkedCount,
    coveragePercent,
    missingHighPriority: missingHighPriority.slice(0, 10), // Limit to top 10
  };
}

/**
 * Build network mapping structure
 */
function buildMapping(
  buyers: Buyer[],
  suppliers: Supplier[],
  links: BuyerLink[]
): RelationshipMapping {
  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];

  // Create buyer nodes
  const buyerLinkCounts = new Map<string, number>();
  for (const link of links) {
    if (link.buyerId) {
      buyerLinkCounts.set(link.buyerId, (buyerLinkCounts.get(link.buyerId) || 0) + 1);
    }
  }

  for (const buyer of buyers) {
    if (buyer.id) {
      nodes.push({
        id: buyer.id,
        type: "buyer",
        name: buyer.name || buyer.franchiseName,
        linkCount: buyerLinkCounts.get(buyer.id) || 0,
      });
    }
  }

  // Create supplier nodes
  const supplierLinkCounts = new Map<string, number>();
  for (const link of links) {
    if (link.supplierId) {
      supplierLinkCounts.set(link.supplierId, (supplierLinkCounts.get(link.supplierId) || 0) + 1);
    }
  }

  for (const supplier of suppliers) {
    if (supplier.id) {
      nodes.push({
        id: supplier.id,
        type: "supplier",
        name: supplier.name,
        linkCount: supplierLinkCounts.get(supplier.id) || 0,
      });
    }
  }

  // Create edges
  for (const link of links) {
    if (link.buyerId && link.supplierId) {
      edges.push({
        from: link.buyerId,
        to: link.supplierId,
        status: link.connectionStatus || "ACTIVE",
      });
    }
  }

  return { nodes, edges };
}

/**
 * Generate health recommendations
 */
function generateHealthRecommendations(health: RelationshipHealth, buyer?: Buyer): string[] {
  const recommendations: string[] = [];
  const context = buyer ? `for ${buyer.name || buyer.id}` : "";

  if (health.healthScore < 50) {
    recommendations.push(
      `Health score is low (${health.healthScore.toFixed(0)}%)${context}. Immediate attention required.`
    );
  } else if (health.healthScore < 80) {
    recommendations.push(
      `Health score is moderate (${health.healthScore.toFixed(0)}%)${context}. Review recommended.`
    );
  } else {
    recommendations.push(
      `Health score is good (${health.healthScore.toFixed(0)}%)${context}.`
    );
  }

  for (const issue of health.issues) {
    switch (issue.type) {
      case "stale_link":
        recommendations.push(
          `Review ${issue.affectedIds.length} stale link(s). Consider removing or reactivating.`
        );
        break;
      case "missing_contact":
        recommendations.push(
          `${issue.affectedIds.length} supplier(s) are missing contact information. Update supplier records.`
        );
        break;
      case "inactive_supplier":
        recommendations.push(
          `${issue.affectedIds.length} linked supplier(s) have not been updated recently. Verify these relationships are still valid.`
        );
        break;
    }
  }

  if (health.staleLinks > 0) {
    recommendations.push(
      `Found ${health.staleLinks} inactive link(s). Consider cleaning up unused relationships.`
    );
  }

  return recommendations;
}

/**
 * Generate coverage recommendations
 */
function generateCoverageRecommendations(coverage: RelationshipCoverage, buyer?: Buyer): string[] {
  const recommendations: string[] = [];
  const context = buyer ? `for ${buyer.name || buyer.id}` : "";

  if (coverage.coveragePercent < 30) {
    recommendations.push(
      `Coverage is low (${coverage.coveragePercent.toFixed(1)}%)${context}. Many suppliers are not linked.`
    );
  } else if (coverage.coveragePercent < 70) {
    recommendations.push(
      `Coverage is moderate (${coverage.coveragePercent.toFixed(1)}%)${context}. Consider linking additional suppliers.`
    );
  } else {
    recommendations.push(
      `Coverage is good (${coverage.coveragePercent.toFixed(1)}%)${context}.`
    );
  }

  if (coverage.missingHighPriority.length > 0) {
    const topSupplier = coverage.missingHighPriority[0];
    recommendations.push(
      `${coverage.missingHighPriority.length} high-priority supplier(s) are not linked. Top candidate: "${topSupplier.name}".`
    );
  }

  const unlinkedCount = coverage.totalSuppliers - coverage.linkedSuppliers;
  if (unlinkedCount > 0) {
    recommendations.push(
      `${unlinkedCount} supplier(s) have no buyer links. Review for potential connections.`
    );
  }

  return recommendations;
}

/**
 * Generate mapping recommendations
 */
function generateMappingRecommendations(mapping: RelationshipMapping): string[] {
  const recommendations: string[] = [];

  const buyerNodes = mapping.nodes.filter(n => n.type === "buyer");
  const supplierNodes = mapping.nodes.filter(n => n.type === "supplier");

  recommendations.push(
    `Network contains ${buyerNodes.length} buyer(s) and ${supplierNodes.length} supplier(s) with ${mapping.edges.length} connection(s).`
  );

  // Find isolated nodes
  const connectedIds = new Set<string>();
  for (const edge of mapping.edges) {
    connectedIds.add(edge.from);
    connectedIds.add(edge.to);
  }

  const isolatedBuyers = buyerNodes.filter(n => !connectedIds.has(n.id));
  const isolatedSuppliers = supplierNodes.filter(n => !connectedIds.has(n.id));

  if (isolatedBuyers.length > 0) {
    recommendations.push(
      `${isolatedBuyers.length} buyer(s) have no supplier connections.`
    );
  }

  if (isolatedSuppliers.length > 0) {
    recommendations.push(
      `${isolatedSuppliers.length} supplier(s) have no buyer connections.`
    );
  }

  // Find highly connected nodes (potential hubs)
  const hubs = mapping.nodes.filter(n => n.linkCount >= 5);
  if (hubs.length > 0) {
    const topHub = hubs.sort((a, b) => b.linkCount - a.linkCount)[0];
    recommendations.push(
      `Network hub identified: "${topHub.name}" (${topHub.type}) has ${topHub.linkCount} connections.`
    );
  }

  // Check for inactive edges
  const inactiveEdges = mapping.edges.filter(e => e.status === "INACTIVE");
  if (inactiveEdges.length > 0) {
    recommendations.push(
      `${inactiveEdges.length} connection(s) are marked as inactive.`
    );
  }

  return recommendations;
}
