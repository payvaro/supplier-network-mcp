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
