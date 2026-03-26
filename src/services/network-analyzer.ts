import type { NetworkAPIClient } from './api-client.js';
import type { NetworkAnalysisResult, ConnectionSuggestion, BuyerLink } from '../types.js';

/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

export interface AnalyzeNetworkOptions {
  includeSuggestions?: boolean;
  minConnectionsForHub?: number;
}

/**
 * Analyze the network connections between buyers and suppliers.
 */
export async function analyzeNetwork(
  client: NetworkAPIClient,
  options: AnalyzeNetworkOptions = {}
): Promise<NetworkAnalysisResult> {
  // Fetch all data - use includeLinks=true to get links embedded in buyers
  const [buyers, suppliers] = await Promise.all([
    client.getAllBuyers(true),
    client.getAllSuppliers(),
  ]);

  // Extract links from buyers (each buyer has buyerLinks when includeLinks=true)
  const links: BuyerLink[] = buyers.flatMap(buyer => buyer.buyerLinks ?? []);

  // Build connection maps
  const buyerToSuppliers = new Map<string, Set<string>>();
  const supplierToBuyers = new Map<string, Set<string>>();

  for (const link of links) {
    if (!link.buyerId || !link.supplierId) continue;

    if (!buyerToSuppliers.has(link.buyerId)) {
      buyerToSuppliers.set(link.buyerId, new Set());
    }
    buyerToSuppliers.get(link.buyerId)!.add(link.supplierId);

    if (!supplierToBuyers.has(link.supplierId)) {
      supplierToBuyers.set(link.supplierId, new Set());
    }
    supplierToBuyers.get(link.supplierId)!.add(link.buyerId);
  }

  // Calculate statistics
  const totalBuyers = buyers.length;
  const totalSuppliers = suppliers.length;
  const totalLinks = links.length;
  const buyersWithLinks = buyerToSuppliers.size;
  const suppliersWithLinks = supplierToBuyers.size;

  // Calculate averages
  const averageSuppliersPerBuyer = totalBuyers > 0
    ? Array.from(buyerToSuppliers.values()).reduce((sum, set) => sum + set.size, 0) / totalBuyers
    : 0;

  const averageBuyersPerSupplier = totalSuppliers > 0
    ? Array.from(supplierToBuyers.values()).reduce((sum, set) => sum + set.size, 0) / totalSuppliers
    : 0;

  // Build connection distribution
  const buyerDistribution: Record<number, number> = {};
  const supplierDistribution: Record<number, number> = {};

  for (const buyer of buyers) {
    const count = buyer.id ? (buyerToSuppliers.get(buyer.id)?.size ?? 0) : 0;
    buyerDistribution[count] = (buyerDistribution[count] ?? 0) + 1;
  }

  for (const supplier of suppliers) {
    const count = supplier.id ? (supplierToBuyers.get(supplier.id)?.size ?? 0) : 0;
    supplierDistribution[count] = (supplierDistribution[count] ?? 0) + 1;
  }

  // Calculate metrics
  const totalNodes = totalBuyers + totalSuppliers;
  const nodesWithLinks = buyersWithLinks + suppliersWithLinks;
  const possibleLinks = totalBuyers * totalSuppliers;

  const density = possibleLinks > 0 ? totalLinks / possibleLinks : 0;
  const coverage = totalNodes > 0 ? nodesWithLinks / totalNodes : 0;
  const buyerCoverage = totalBuyers > 0 ? buyersWithLinks / totalBuyers : 0;
  const supplierCoverage = totalSuppliers > 0 ? suppliersWithLinks / totalSuppliers : 0;

  // Identify isolated nodes
  const isolatedBuyers = buyers
    .filter(buyer => buyer.id && !buyerToSuppliers.has(buyer.id))
    .map(buyer => ({
      id: buyer.id!,
      name: buyer.name,
      type: 'buyer' as const,
      clientId: buyer.clientId,
    }));

  const isolatedSuppliers = suppliers
    .filter(supplier => supplier.id && !supplierToBuyers.has(supplier.id))
    .map(supplier => ({
      id: supplier.id!,
      name: supplier.name,
      type: 'supplier' as const,
    }));

  // Identify network hubs
  const minConnections = options.minConnectionsForHub ?? 5;

  const topBuyerHubs = buyers
    .map(buyer => ({
      id: buyer.id!,
      name: buyer.name,
      type: 'buyer' as const,
      connectionCount: buyer.id ? (buyerToSuppliers.get(buyer.id)?.size ?? 0) : 0,
      clientId: buyer.clientId,
    }))
    .filter(hub => hub.id && hub.connectionCount >= minConnections)
    .sort((a, b) => b.connectionCount - a.connectionCount);

  const topSupplierHubs = suppliers
    .map(supplier => ({
      id: supplier.id!,
      name: supplier.name,
      type: 'supplier' as const,
      connectionCount: supplier.id ? (supplierToBuyers.get(supplier.id)?.size ?? 0) : 0,
    }))
    .filter(hub => hub.id && hub.connectionCount >= minConnections)
    .sort((a, b) => b.connectionCount - a.connectionCount);

  // Generate connection suggestions
  const includeSuggestions = options.includeSuggestions ?? true;
  let suggestions: ConnectionSuggestion[] | undefined;

  if (includeSuggestions) {
    suggestions = [];
    const supplierMap = new Map(suppliers.map(s => [s.id!, s]));

    // For each buyer, find similar buyers and suggest their suppliers
    for (const buyer of buyers) {
      if (!buyer.id) continue;
      const buyerSuppliers = buyerToSuppliers.get(buyer.id) ?? new Set();
      if (buyerSuppliers.size === 0) continue;

      for (const otherBuyer of buyers) {
        if (!otherBuyer.id || otherBuyer.id === buyer.id) continue;
        const otherSuppliers = buyerToSuppliers.get(otherBuyer.id) ?? new Set();
        if (otherSuppliers.size === 0) continue;

        // Calculate similarity
        const similarity = jaccardSimilarity(buyerSuppliers, otherSuppliers);
        if (similarity < 0.3) continue; // Skip if not similar enough

        // Find suppliers that otherBuyer has but buyer doesn't
        for (const supplierId of otherSuppliers) {
          if (buyerSuppliers.has(supplierId)) continue;

          const supplier = supplierMap.get(supplierId);
          const confidence: 'high' | 'medium' | 'low' =
            similarity >= 0.7 ? 'high' : similarity >= 0.5 ? 'medium' : 'low';

          suggestions.push({
            buyerId: buyer.id,
            supplierId,
            buyerName: buyer.name,
            supplierName: supplier?.name,
            reason: `Similar buyer "${otherBuyer.name}" uses this supplier (${Math.round(similarity * 100)}% supplier overlap)`,
            confidence,
          });
        }
      }
    }

    // Deduplicate suggestions (keep highest confidence for each buyer-supplier pair)
    const suggestionMap = new Map<string, ConnectionSuggestion>();
    for (const suggestion of suggestions) {
      const key = `${suggestion.buyerId}-${suggestion.supplierId}`;
      const existing = suggestionMap.get(key);
      if (!existing ||
          (suggestion.confidence === 'high' && existing.confidence !== 'high') ||
          (suggestion.confidence === 'medium' && existing.confidence === 'low')) {
        suggestionMap.set(key, suggestion);
      }
    }
    suggestions = Array.from(suggestionMap.values());
  }

  return {
    summary: {
      totalBuyers,
      totalSuppliers,
      totalLinks,
      averageSuppliersPerBuyer,
      averageBuyersPerSupplier,
      buyersWithLinks,
      suppliersWithLinks,
      connectionDistribution: {
        buyers: buyerDistribution,
        suppliers: supplierDistribution,
      },
    },
    isolatedNodes: {
      buyers: isolatedBuyers,
      suppliers: isolatedSuppliers,
    },
    hubs: {
      topBuyers: topBuyerHubs,
      topSuppliers: topSupplierHubs,
    },
    suggestions,
    metrics: {
      density,
      coverage,
      buyerCoverage,
      supplierCoverage,
    },
    generatedAt: new Date().toISOString(),
  };
}
