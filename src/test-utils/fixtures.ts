import type {
  Supplier,
  Buyer,
  Address,
  Contact,
  Alias,
  BuyerLink,
  MatchScore,
  SupplierMatch,
  NetworkAnalysisResult,
  ConnectionStatistics,
  NetworkMetrics,
  IsolatedNode,
  NetworkHub,
  ImportAnalysisResult,
  ImportAnalysisSummary,
  ImportDuplicate,
  QualityMetrics,
  QualityIssue,
  RelationshipAnalysisResult,
  RelationshipHealth,
  RelationshipCoverage,
  RelationshipMapping,
  HealthIssue,
  NetworkNode,
  NetworkEdge,
} from '../types.js';

// Address fixtures
export function createAddress(overrides: Partial<Address> = {}): Address {
  return {
    streetAddress: '123 Main St',
    city: 'Springfield',
    stateProvince: 'IL',
    postalCode: '62701',
    ...overrides,
  };
}

// Contact fixtures
export function createContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'contact-1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '555-123-4567',
    position: 'Manager',
    type: 'PRIMARY',
    ...overrides,
  };
}

// Alias fixtures
export function createAlias(overrides: Partial<Alias> = {}): Alias {
  return {
    id: 'alias-1',
    name: 'ACME Corp',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// BuyerLink fixtures
export function createBuyerLink(overrides: Partial<BuyerLink> = {}): BuyerLink {
  return {
    buyerId: 'buyer-1',
    supplierId: 'supplier-1',
    buyerSupplierRefId: 'ref-1',
    buyerRefKey: 'key-1',
    connectionStatus: 'ACTIVE',
    ...overrides,
  };
}

// Supplier fixtures
export function createSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: 'supplier-1',
    name: 'Acme Corporation',
    email: 'contact@acme.com',
    address: createAddress(),
    contacts: [createContact()],
    aliases: [],
    metadata: [],
    buyerLinks: [],
    aggregatorLinks: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Buyer fixtures
export function createBuyer(overrides: Partial<Buyer> = {}): Buyer {
  return {
    id: 'buyer-1',
    name: 'Test Buyer Inc',
    franchiseName: 'Test Franchise',
    storeIdentifier: 'STORE001',
    clientId: 'client-1',
    status: 'ACTIVE',
    addresses: [createAddress()],
    contacts: [createContact()],
    buyerLinks: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// MatchScore fixtures
export function createMatchScore(overrides: Partial<MatchScore> = {}): MatchScore {
  return {
    score: 0.95,
    level: 'high',
    reasons: ['Name similarity: 95%'],
    ...overrides,
  };
}

// SupplierMatch fixtures
export function createSupplierMatch(overrides: Partial<SupplierMatch> = {}): SupplierMatch {
  return {
    supplier: createSupplier(),
    matchScore: createMatchScore(),
    matchedFields: {
      name: 0.95,
      address: 0.8,
      email: 1.0,
    },
    ...overrides,
  };
}

// Network analysis fixtures
export function createConnectionStatistics(
  overrides: Partial<ConnectionStatistics> = {}
): ConnectionStatistics {
  return {
    totalBuyers: 100,
    totalSuppliers: 50,
    totalLinks: 200,
    averageSuppliersPerBuyer: 2,
    averageBuyersPerSupplier: 4,
    buyersWithLinks: 80,
    suppliersWithLinks: 45,
    connectionDistribution: {
      buyers: { 1: 30, 2: 30, 3: 20 },
      suppliers: { 1: 10, 2: 15, 3: 10, 4: 10 },
    },
    ...overrides,
  };
}

export function createNetworkMetrics(overrides: Partial<NetworkMetrics> = {}): NetworkMetrics {
  return {
    density: 0.04,
    coverage: 0.85,
    buyerCoverage: 0.8,
    supplierCoverage: 0.9,
    ...overrides,
  };
}

export function createIsolatedNode(overrides: Partial<IsolatedNode> = {}): IsolatedNode {
  return {
    id: 'isolated-1',
    name: 'Isolated Entity',
    type: 'supplier',
    ...overrides,
  };
}

export function createNetworkHub(overrides: Partial<NetworkHub> = {}): NetworkHub {
  return {
    id: 'hub-1',
    name: 'Major Buyer',
    type: 'buyer',
    connectionCount: 25,
    clientId: 'client-hub-1',
    ...overrides,
  };
}

export function createNetworkAnalysisResult(
  overrides: Partial<NetworkAnalysisResult> = {}
): NetworkAnalysisResult {
  return {
    summary: createConnectionStatistics(),
    isolatedNodes: {
      buyers: [createIsolatedNode({ type: 'buyer', id: 'iso-buyer-1' })],
      suppliers: [createIsolatedNode({ type: 'supplier', id: 'iso-supplier-1' })],
    },
    hubs: {
      topBuyers: [createNetworkHub({ type: 'buyer' })],
      topSuppliers: [createNetworkHub({ type: 'supplier', id: 'hub-supplier-1' })],
    },
    suggestions: [],
    metrics: createNetworkMetrics(),
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// API response fixtures
export function createSupplierListResponse(count = 3): { suppliers: Supplier[]; count: number } {
  return {
    suppliers: Array.from({ length: count }, (_, i) =>
      createSupplier({
        id: `supplier-${i + 1}`,
        name: `Supplier ${i + 1}`,
        email: `supplier${i + 1}@example.com`,
      })
    ),
    count,
  };
}

export function createBuyerListResponse(count = 3): { buyers: Buyer[]; count: number } {
  return {
    buyers: Array.from({ length: count }, (_, i) =>
      createBuyer({
        id: `buyer-${i + 1}`,
        name: `Buyer ${i + 1}`,
        clientId: `client-${i + 1}`,
      })
    ),
    count,
  };
}

// Import analysis fixtures
export function createImportAnalysisSummary(
  overrides: Partial<ImportAnalysisSummary> = {}
): ImportAnalysisSummary {
  return {
    totalRecords: 100,
    newSuppliers: 80,
    potentialDuplicates: 15,
    exactMatches: 5,
    ...overrides,
  };
}

export function createQualityIssue(overrides: Partial<QualityIssue> = {}): QualityIssue {
  return {
    field: 'email',
    issue: 'Missing email address',
    severity: 'medium',
    affectedCount: 10,
    ...overrides,
  };
}

export function createQualityMetrics(overrides: Partial<QualityMetrics> = {}): QualityMetrics {
  return {
    completeness: 0.85,
    matchConfidence: 0.9,
    issues: [createQualityIssue()],
    ...overrides,
  };
}

export function createImportDuplicate(overrides: Partial<ImportDuplicate> = {}): ImportDuplicate {
  return {
    incoming: createSupplier({ id: 'incoming-1', name: 'Incoming Supplier' }),
    existingMatches: [createSupplierMatch()],
    ...overrides,
  };
}

export function createImportAnalysisResult(
  overrides: Partial<ImportAnalysisResult> = {}
): ImportAnalysisResult {
  return {
    mode: 'post-upload',
    summary: createImportAnalysisSummary(),
    duplicates: [createImportDuplicate()],
    qualityMetrics: createQualityMetrics(),
    recommendations: ['Review 5 exact matches', 'Investigate 15 potential duplicates'],
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Relationship analysis fixtures
export function createHealthIssue(overrides: Partial<HealthIssue> = {}): HealthIssue {
  return {
    type: 'stale_link',
    description: '3 inactive link(s) found',
    affectedIds: ['supplier-1', 'supplier-2', 'supplier-3'],
    ...overrides,
  };
}

export function createRelationshipHealth(
  overrides: Partial<RelationshipHealth> = {}
): RelationshipHealth {
  return {
    activeLinks: 45,
    staleLinks: 5,
    healthScore: 85,
    issues: [createHealthIssue()],
    ...overrides,
  };
}

export function createRelationshipCoverage(
  overrides: Partial<RelationshipCoverage> = {}
): RelationshipCoverage {
  return {
    totalSuppliers: 100,
    linkedSuppliers: 75,
    coveragePercent: 75,
    missingHighPriority: [
      createSupplier({ id: 'missing-1', name: 'Missing Supplier 1' }),
    ],
    ...overrides,
  };
}

export function createNetworkNode(overrides: Partial<NetworkNode> = {}): NetworkNode {
  return {
    id: 'node-1',
    type: 'supplier',
    name: 'Test Node',
    linkCount: 5,
    ...overrides,
  };
}

export function createNetworkEdge(overrides: Partial<NetworkEdge> = {}): NetworkEdge {
  return {
    from: 'buyer-1',
    to: 'supplier-1',
    status: 'ACTIVE',
    ...overrides,
  };
}

export function createRelationshipMapping(
  overrides: Partial<RelationshipMapping> = {}
): RelationshipMapping {
  return {
    nodes: [
      createNetworkNode({ id: 'buyer-1', type: 'buyer', name: 'Test Buyer' }),
      createNetworkNode({ id: 'supplier-1', type: 'supplier', name: 'Test Supplier' }),
    ],
    edges: [createNetworkEdge()],
    ...overrides,
  };
}

export function createRelationshipAnalysisResult(
  overrides: Partial<RelationshipAnalysisResult> = {}
): RelationshipAnalysisResult {
  return {
    analysisType: 'health',
    health: createRelationshipHealth(),
    recommendations: ['Health score is good (85%)', 'Review 3 stale links'],
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}
