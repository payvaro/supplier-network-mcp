import type { NetworkAPIClient } from './api-client.js';
import type { NetworkAnalysisResult } from '../types.js';

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
  // Fetch all data
  const [buyers, suppliers, links] = await Promise.all([
    client.listBuyers(),
    client.getAllSuppliers(),
    client.listBuyerLinks(),
  ]);

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
    metrics: {
      density,
      coverage,
      buyerCoverage,
      supplierCoverage,
    },
    generatedAt: new Date().toISOString(),
  };
}
