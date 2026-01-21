# Network Analyzer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the `analyzeNetwork` function to analyze buyer-supplier connections and return network statistics, metrics, isolated nodes, hubs, and connection suggestions.

**Architecture:** The analyzer fetches all buyers, suppliers, and links via the API client, then computes statistics in memory. It builds connection maps to identify isolated nodes and hubs, calculates network density/coverage metrics, and optionally generates connection suggestions based on shared supplier patterns.

**Tech Stack:** TypeScript, Vitest for testing, existing NetworkAPIClient and types

---

### Task 1: Update Tests - Basic Statistics Calculation

**Files:**
- Modify: [network-analyzer.test.ts](src/services/__tests__/network-analyzer.test.ts)

**Step 1: Write the failing tests for basic statistics**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { analyzeNetwork } from '../network-analyzer.js';
import { createMockNetworkAPIClient, type MockNetworkAPIClient } from '../../__mocks__/api-client.mock.js';
import type { Supplier, Buyer, BuyerLink } from '../../types.js';

describe('network-analyzer', () => {
  let mockClient: MockNetworkAPIClient;

  beforeEach(() => {
    mockClient = createMockNetworkAPIClient();
  });

  describe('analyzeNetwork', () => {
    describe('with empty network', () => {
      beforeEach(() => {
        mockClient.listBuyers.mockResolvedValue([]);
        mockClient.getAllSuppliers.mockResolvedValue([]);
        mockClient.listBuyerLinks.mockResolvedValue([]);
      });

      it('returns zero counts for empty network', async () => {
        const result = await analyzeNetwork(mockClient as never);

        expect(result.summary.totalBuyers).toBe(0);
        expect(result.summary.totalSuppliers).toBe(0);
        expect(result.summary.totalLinks).toBe(0);
      });

      it('returns zero averages for empty network', async () => {
        const result = await analyzeNetwork(mockClient as never);

        expect(result.summary.averageSuppliersPerBuyer).toBe(0);
        expect(result.summary.averageBuyersPerSupplier).toBe(0);
      });

      it('returns zero coverage for empty network', async () => {
        const result = await analyzeNetwork(mockClient as never);

        expect(result.summary.buyersWithLinks).toBe(0);
        expect(result.summary.suppliersWithLinks).toBe(0);
      });

      it('returns generatedAt timestamp', async () => {
        const result = await analyzeNetwork(mockClient as never);

        expect(result.generatedAt).toBeDefined();
        expect(new Date(result.generatedAt).getTime()).toBeLessThanOrEqual(Date.now());
      });
    });

    describe('with populated network', () => {
      const mockBuyers: Buyer[] = [
        { id: 'b1', name: 'Buyer 1', clientId: 'c1' },
        { id: 'b2', name: 'Buyer 2', clientId: 'c2' },
        { id: 'b3', name: 'Buyer 3', clientId: 'c3' },
      ];

      const mockSuppliers: Supplier[] = [
        { id: 's1', name: 'Supplier 1' },
        { id: 's2', name: 'Supplier 2' },
      ];

      const mockLinks: BuyerLink[] = [
        { buyerId: 'b1', supplierId: 's1', connectionStatus: 'ACTIVE' },
        { buyerId: 'b1', supplierId: 's2', connectionStatus: 'ACTIVE' },
        { buyerId: 'b2', supplierId: 's1', connectionStatus: 'ACTIVE' },
      ];

      beforeEach(() => {
        mockClient.listBuyers.mockResolvedValue(mockBuyers);
        mockClient.getAllSuppliers.mockResolvedValue(mockSuppliers);
        mockClient.listBuyerLinks.mockResolvedValue(mockLinks);
      });

      it('returns correct total counts', async () => {
        const result = await analyzeNetwork(mockClient as never);

        expect(result.summary.totalBuyers).toBe(3);
        expect(result.summary.totalSuppliers).toBe(2);
        expect(result.summary.totalLinks).toBe(3);
      });

      it('calculates average suppliers per buyer', async () => {
        const result = await analyzeNetwork(mockClient as never);

        // b1 has 2 suppliers, b2 has 1, b3 has 0 -> (2+1+0)/3 = 1
        expect(result.summary.averageSuppliersPerBuyer).toBe(1);
      });

      it('calculates average buyers per supplier', async () => {
        const result = await analyzeNetwork(mockClient as never);

        // s1 has 2 buyers, s2 has 1 -> (2+1)/2 = 1.5
        expect(result.summary.averageBuyersPerSupplier).toBe(1.5);
      });

      it('counts buyers and suppliers with links', async () => {
        const result = await analyzeNetwork(mockClient as never);

        expect(result.summary.buyersWithLinks).toBe(2); // b1, b2
        expect(result.summary.suppliersWithLinks).toBe(2); // s1, s2
      });
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/__tests__/network-analyzer.test.ts`
Expected: FAIL - tests will fail because analyzeNetwork throws "not yet implemented"

**Step 3: Commit test file**

```bash
git add src/services/__tests__/network-analyzer.test.ts
git commit -m "test: add failing tests for network analyzer basic statistics"
```

---

### Task 2: Implement Basic Statistics Calculation

**Files:**
- Modify: [network-analyzer.ts](src/services/network-analyzer.ts)

**Step 1: Implement the basic statistics calculation**

```typescript
import type { NetworkAPIClient } from './api-client.js';
import type { NetworkAnalysisResult, Buyer, Supplier, BuyerLink } from '../types.js';

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
      buyers: [],
      suppliers: [],
    },
    hubs: {
      topBuyers: [],
      topSuppliers: [],
    },
    metrics: {
      density: 0,
      coverage: 0,
      buyerCoverage: 0,
      supplierCoverage: 0,
    },
    generatedAt: new Date().toISOString(),
  };
}
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- src/services/__tests__/network-analyzer.test.ts`
Expected: PASS - all basic statistics tests should pass

**Step 3: Commit implementation**

```bash
git add src/services/network-analyzer.ts
git commit -m "feat: implement basic statistics calculation in network analyzer"
```

---

### Task 3: Add Tests for Network Metrics

**Files:**
- Modify: [network-analyzer.test.ts](src/services/__tests__/network-analyzer.test.ts)

**Step 1: Add tests for network metrics (density and coverage)**

Add the following test block inside the `describe('with populated network', ...)` block:

```typescript
      describe('network metrics', () => {
        it('calculates network density', async () => {
          const result = await analyzeNetwork(mockClient as never);

          // Density = actual links / possible links
          // Possible links = buyers * suppliers = 3 * 2 = 6
          // Actual links = 3
          // Density = 3/6 = 0.5
          expect(result.metrics.density).toBeCloseTo(0.5);
        });

        it('calculates overall coverage', async () => {
          const result = await analyzeNetwork(mockClient as never);

          // Coverage = nodes with links / total nodes
          // Buyers with links: 2, Suppliers with links: 2
          // Total nodes: 5
          // Coverage = 4/5 = 0.8
          expect(result.metrics.coverage).toBeCloseTo(0.8);
        });

        it('calculates buyer coverage', async () => {
          const result = await analyzeNetwork(mockClient as never);

          // Buyer coverage = buyers with links / total buyers = 2/3
          expect(result.metrics.buyerCoverage).toBeCloseTo(2 / 3);
        });

        it('calculates supplier coverage', async () => {
          const result = await analyzeNetwork(mockClient as never);

          // Supplier coverage = suppliers with links / total suppliers = 2/2 = 1
          expect(result.metrics.supplierCoverage).toBe(1);
        });
      });
```

Also add a test for empty network metrics in the `describe('with empty network', ...)` block:

```typescript
      it('returns zero metrics for empty network', async () => {
        const result = await analyzeNetwork(mockClient as never);

        expect(result.metrics.density).toBe(0);
        expect(result.metrics.coverage).toBe(0);
        expect(result.metrics.buyerCoverage).toBe(0);
        expect(result.metrics.supplierCoverage).toBe(0);
      });
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/__tests__/network-analyzer.test.ts`
Expected: FAIL - metrics tests will fail because we return 0 for all metrics

**Step 3: Commit test file**

```bash
git add src/services/__tests__/network-analyzer.test.ts
git commit -m "test: add failing tests for network metrics calculation"
```

---

### Task 4: Implement Network Metrics

**Files:**
- Modify: [network-analyzer.ts](src/services/network-analyzer.ts)

**Step 1: Add metrics calculation**

Replace the metrics block in the return statement with actual calculations. Add this before the return statement:

```typescript
  // Calculate metrics
  const totalNodes = totalBuyers + totalSuppliers;
  const nodesWithLinks = buyersWithLinks + suppliersWithLinks;
  const possibleLinks = totalBuyers * totalSuppliers;

  const density = possibleLinks > 0 ? totalLinks / possibleLinks : 0;
  const coverage = totalNodes > 0 ? nodesWithLinks / totalNodes : 0;
  const buyerCoverage = totalBuyers > 0 ? buyersWithLinks / totalBuyers : 0;
  const supplierCoverage = totalSuppliers > 0 ? suppliersWithLinks / totalSuppliers : 0;
```

Then update the return statement's metrics section:

```typescript
    metrics: {
      density,
      coverage,
      buyerCoverage,
      supplierCoverage,
    },
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- src/services/__tests__/network-analyzer.test.ts`
Expected: PASS - all metrics tests should pass

**Step 3: Commit implementation**

```bash
git add src/services/network-analyzer.ts
git commit -m "feat: implement network metrics calculation (density, coverage)"
```

---

### Task 5: Add Tests for Isolated Nodes

**Files:**
- Modify: [network-analyzer.test.ts](src/services/__tests__/network-analyzer.test.ts)

**Step 1: Add tests for isolated nodes identification**

Add the following test block inside the `describe('with populated network', ...)` block:

```typescript
      describe('isolated nodes', () => {
        it('identifies isolated buyers (no links)', async () => {
          const result = await analyzeNetwork(mockClient as never);

          // b3 has no links
          expect(result.isolatedNodes.buyers).toHaveLength(1);
          expect(result.isolatedNodes.buyers[0].id).toBe('b3');
          expect(result.isolatedNodes.buyers[0].name).toBe('Buyer 3');
          expect(result.isolatedNodes.buyers[0].type).toBe('buyer');
        });

        it('returns empty isolated suppliers when all have links', async () => {
          const result = await analyzeNetwork(mockClient as never);

          // Both s1 and s2 have links
          expect(result.isolatedNodes.suppliers).toHaveLength(0);
        });

        it('includes clientId for isolated buyers', async () => {
          const result = await analyzeNetwork(mockClient as never);

          expect(result.isolatedNodes.buyers[0].clientId).toBe('c3');
        });
      });
```

Add test for isolated suppliers with a new mock setup:

```typescript
    describe('with isolated suppliers', () => {
      const mockBuyers: Buyer[] = [
        { id: 'b1', name: 'Buyer 1' },
      ];

      const mockSuppliers: Supplier[] = [
        { id: 's1', name: 'Supplier 1' },
        { id: 's2', name: 'Supplier 2' },
        { id: 's3', name: 'Supplier 3' },
      ];

      const mockLinks: BuyerLink[] = [
        { buyerId: 'b1', supplierId: 's1', connectionStatus: 'ACTIVE' },
      ];

      beforeEach(() => {
        mockClient.listBuyers.mockResolvedValue(mockBuyers);
        mockClient.getAllSuppliers.mockResolvedValue(mockSuppliers);
        mockClient.listBuyerLinks.mockResolvedValue(mockLinks);
      });

      it('identifies isolated suppliers', async () => {
        const result = await analyzeNetwork(mockClient as never);

        expect(result.isolatedNodes.suppliers).toHaveLength(2);
        const isolatedIds = result.isolatedNodes.suppliers.map(s => s.id);
        expect(isolatedIds).toContain('s2');
        expect(isolatedIds).toContain('s3');
      });
    });
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/__tests__/network-analyzer.test.ts`
Expected: FAIL - isolated nodes tests will fail because we return empty arrays

**Step 3: Commit test file**

```bash
git add src/services/__tests__/network-analyzer.test.ts
git commit -m "test: add failing tests for isolated nodes identification"
```

---

### Task 6: Implement Isolated Nodes Identification

**Files:**
- Modify: [network-analyzer.ts](src/services/network-analyzer.ts)

**Step 1: Add isolated nodes identification**

Add this code after the metrics calculation and before the return statement:

```typescript
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
```

Update the return statement:

```typescript
    isolatedNodes: {
      buyers: isolatedBuyers,
      suppliers: isolatedSuppliers,
    },
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- src/services/__tests__/network-analyzer.test.ts`
Expected: PASS - isolated nodes tests should pass

**Step 3: Commit implementation**

```bash
git add src/services/network-analyzer.ts
git commit -m "feat: implement isolated nodes identification"
```

---

### Task 7: Add Tests for Network Hubs

**Files:**
- Modify: [network-analyzer.test.ts](src/services/__tests__/network-analyzer.test.ts)

**Step 1: Add tests for network hubs identification**

Add a new describe block:

```typescript
    describe('network hubs', () => {
      const mockBuyers: Buyer[] = [
        { id: 'b1', name: 'Big Buyer', clientId: 'c1' },
        { id: 'b2', name: 'Medium Buyer', clientId: 'c2' },
        { id: 'b3', name: 'Small Buyer', clientId: 'c3' },
      ];

      const mockSuppliers: Supplier[] = [
        { id: 's1', name: 'Popular Supplier' },
        { id: 's2', name: 'Average Supplier' },
        { id: 's3', name: 'Niche Supplier' },
      ];

      // b1 -> s1, s2, s3 (3 connections)
      // b2 -> s1, s2 (2 connections)
      // b3 -> s1 (1 connection)
      // s1 <- b1, b2, b3 (3 connections)
      // s2 <- b1, b2 (2 connections)
      // s3 <- b1 (1 connection)
      const mockLinks: BuyerLink[] = [
        { buyerId: 'b1', supplierId: 's1', connectionStatus: 'ACTIVE' },
        { buyerId: 'b1', supplierId: 's2', connectionStatus: 'ACTIVE' },
        { buyerId: 'b1', supplierId: 's3', connectionStatus: 'ACTIVE' },
        { buyerId: 'b2', supplierId: 's1', connectionStatus: 'ACTIVE' },
        { buyerId: 'b2', supplierId: 's2', connectionStatus: 'ACTIVE' },
        { buyerId: 'b3', supplierId: 's1', connectionStatus: 'ACTIVE' },
      ];

      beforeEach(() => {
        mockClient.listBuyers.mockResolvedValue(mockBuyers);
        mockClient.getAllSuppliers.mockResolvedValue(mockSuppliers);
        mockClient.listBuyerLinks.mockResolvedValue(mockLinks);
      });

      it('identifies top buyer hubs sorted by connection count', async () => {
        const result = await analyzeNetwork(mockClient as never, { minConnectionsForHub: 2 });

        expect(result.hubs.topBuyers).toHaveLength(2);
        expect(result.hubs.topBuyers[0].id).toBe('b1');
        expect(result.hubs.topBuyers[0].connectionCount).toBe(3);
        expect(result.hubs.topBuyers[1].id).toBe('b2');
        expect(result.hubs.topBuyers[1].connectionCount).toBe(2);
      });

      it('identifies top supplier hubs sorted by connection count', async () => {
        const result = await analyzeNetwork(mockClient as never, { minConnectionsForHub: 2 });

        expect(result.hubs.topSuppliers).toHaveLength(2);
        expect(result.hubs.topSuppliers[0].id).toBe('s1');
        expect(result.hubs.topSuppliers[0].connectionCount).toBe(3);
        expect(result.hubs.topSuppliers[1].id).toBe('s2');
        expect(result.hubs.topSuppliers[1].connectionCount).toBe(2);
      });

      it('includes name and clientId in hub info', async () => {
        const result = await analyzeNetwork(mockClient as never, { minConnectionsForHub: 2 });

        expect(result.hubs.topBuyers[0].name).toBe('Big Buyer');
        expect(result.hubs.topBuyers[0].clientId).toBe('c1');
        expect(result.hubs.topSuppliers[0].name).toBe('Popular Supplier');
      });

      it('respects minConnectionsForHub threshold', async () => {
        const result = await analyzeNetwork(mockClient as never, { minConnectionsForHub: 3 });

        expect(result.hubs.topBuyers).toHaveLength(1);
        expect(result.hubs.topSuppliers).toHaveLength(1);
      });

      it('uses default minConnectionsForHub of 5', async () => {
        const result = await analyzeNetwork(mockClient as never);

        // No nodes have 5+ connections
        expect(result.hubs.topBuyers).toHaveLength(0);
        expect(result.hubs.topSuppliers).toHaveLength(0);
      });
    });
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/__tests__/network-analyzer.test.ts`
Expected: FAIL - hub tests will fail because we return empty arrays

**Step 3: Commit test file**

```bash
git add src/services/__tests__/network-analyzer.test.ts
git commit -m "test: add failing tests for network hubs identification"
```

---

### Task 8: Implement Network Hubs Identification

**Files:**
- Modify: [network-analyzer.ts](src/services/network-analyzer.ts)

**Step 1: Add network hubs identification**

Add this code after isolated nodes identification:

```typescript
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
```

Update the return statement:

```typescript
    hubs: {
      topBuyers: topBuyerHubs,
      topSuppliers: topSupplierHubs,
    },
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- src/services/__tests__/network-analyzer.test.ts`
Expected: PASS - hub tests should pass

**Step 3: Commit implementation**

```bash
git add src/services/network-analyzer.ts
git commit -m "feat: implement network hubs identification"
```

---

### Task 9: Add Tests for Connection Suggestions

**Files:**
- Modify: [network-analyzer.test.ts](src/services/__tests__/network-analyzer.test.ts)

**Step 1: Add tests for connection suggestions**

Add a new describe block:

```typescript
    describe('connection suggestions', () => {
      // Scenario: b1 and b2 share suppliers s1 and s2
      // b1 also uses s3, but b2 does not
      // Suggestion: b2 should consider s3 (used by similar buyer b1)
      const mockBuyers: Buyer[] = [
        { id: 'b1', name: 'Buyer One' },
        { id: 'b2', name: 'Buyer Two' },
      ];

      const mockSuppliers: Supplier[] = [
        { id: 's1', name: 'Shared Supplier 1' },
        { id: 's2', name: 'Shared Supplier 2' },
        { id: 's3', name: 'Unique Supplier' },
      ];

      const mockLinks: BuyerLink[] = [
        { buyerId: 'b1', supplierId: 's1', connectionStatus: 'ACTIVE' },
        { buyerId: 'b1', supplierId: 's2', connectionStatus: 'ACTIVE' },
        { buyerId: 'b1', supplierId: 's3', connectionStatus: 'ACTIVE' },
        { buyerId: 'b2', supplierId: 's1', connectionStatus: 'ACTIVE' },
        { buyerId: 'b2', supplierId: 's2', connectionStatus: 'ACTIVE' },
      ];

      beforeEach(() => {
        mockClient.listBuyers.mockResolvedValue(mockBuyers);
        mockClient.getAllSuppliers.mockResolvedValue(mockSuppliers);
        mockClient.listBuyerLinks.mockResolvedValue(mockLinks);
      });

      it('returns suggestions when includeSuggestions is true', async () => {
        const result = await analyzeNetwork(mockClient as never, { includeSuggestions: true });

        expect(result.suggestions).toBeDefined();
        expect(result.suggestions!.length).toBeGreaterThan(0);
      });

      it('returns no suggestions when includeSuggestions is false', async () => {
        const result = await analyzeNetwork(mockClient as never, { includeSuggestions: false });

        expect(result.suggestions).toBeUndefined();
      });

      it('suggests connections based on shared supplier patterns', async () => {
        const result = await analyzeNetwork(mockClient as never, { includeSuggestions: true });

        // b2 should be suggested s3 because b1 (who shares s1, s2) uses s3
        const suggestion = result.suggestions!.find(
          s => s.buyerId === 'b2' && s.supplierId === 's3'
        );
        expect(suggestion).toBeDefined();
        expect(suggestion!.buyerName).toBe('Buyer Two');
        expect(suggestion!.supplierName).toBe('Unique Supplier');
      });

      it('includes confidence level in suggestions', async () => {
        const result = await analyzeNetwork(mockClient as never, { includeSuggestions: true });

        expect(result.suggestions!.every(s =>
          s.confidence === 'high' || s.confidence === 'medium' || s.confidence === 'low'
        )).toBe(true);
      });

      it('includes reason in suggestions', async () => {
        const result = await analyzeNetwork(mockClient as never, { includeSuggestions: true });

        expect(result.suggestions!.every(s => s.reason.length > 0)).toBe(true);
      });

      it('defaults includeSuggestions to true', async () => {
        const result = await analyzeNetwork(mockClient as never);

        expect(result.suggestions).toBeDefined();
      });
    });
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/services/__tests__/network-analyzer.test.ts`
Expected: FAIL - suggestion tests will fail

**Step 3: Commit test file**

```bash
git add src/services/__tests__/network-analyzer.test.ts
git commit -m "test: add failing tests for connection suggestions"
```

---

### Task 10: Implement Connection Suggestions

**Files:**
- Modify: [network-analyzer.ts](src/services/network-analyzer.ts)

**Step 1: Add connection suggestions implementation**

Add helper function at the top of the file (after imports):

```typescript
/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}
```

Add suggestion generation after hub identification:

```typescript
  // Generate connection suggestions
  const includeSuggestions = options.includeSuggestions ?? true;
  let suggestions: ConnectionSuggestion[] | undefined;

  if (includeSuggestions) {
    suggestions = [];
    const buyerMap = new Map(buyers.map(b => [b.id!, b]));
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
```

Add the import for ConnectionSuggestion type at the top:

```typescript
import type { NetworkAPIClient } from './api-client.js';
import type { NetworkAnalysisResult, ConnectionSuggestion } from '../types.js';
```

Update the return statement to include suggestions:

```typescript
    suggestions,
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- src/services/__tests__/network-analyzer.test.ts`
Expected: PASS - all suggestion tests should pass

**Step 3: Commit implementation**

```bash
git add src/services/network-analyzer.ts
git commit -m "feat: implement connection suggestions based on similar buyer patterns"
```

---

### Task 11: Add Integration Test for Full Analysis

**Files:**
- Modify: [network-analyzer.test.ts](src/services/__tests__/network-analyzer.test.ts)

**Step 1: Add comprehensive integration test**

Add at the end of the test file:

```typescript
    describe('full analysis integration', () => {
      const mockBuyers: Buyer[] = [
        { id: 'b1', name: 'Alpha Corp', clientId: 'c1' },
        { id: 'b2', name: 'Beta Inc', clientId: 'c2' },
        { id: 'b3', name: 'Gamma LLC', clientId: 'c3' },
        { id: 'b4', name: 'Delta Co', clientId: 'c4' },
      ];

      const mockSuppliers: Supplier[] = [
        { id: 's1', name: 'Parts Plus' },
        { id: 's2', name: 'Supply Co' },
        { id: 's3', name: 'Materials Inc' },
        { id: 's4', name: 'Equipment Ltd' },
      ];

      const mockLinks: BuyerLink[] = [
        { buyerId: 'b1', supplierId: 's1', connectionStatus: 'ACTIVE' },
        { buyerId: 'b1', supplierId: 's2', connectionStatus: 'ACTIVE' },
        { buyerId: 'b1', supplierId: 's3', connectionStatus: 'ACTIVE' },
        { buyerId: 'b2', supplierId: 's1', connectionStatus: 'ACTIVE' },
        { buyerId: 'b2', supplierId: 's2', connectionStatus: 'ACTIVE' },
        { buyerId: 'b3', supplierId: 's1', connectionStatus: 'ACTIVE' },
      ];

      beforeEach(() => {
        mockClient.listBuyers.mockResolvedValue(mockBuyers);
        mockClient.getAllSuppliers.mockResolvedValue(mockSuppliers);
        mockClient.listBuyerLinks.mockResolvedValue(mockLinks);
      });

      it('returns complete NetworkAnalysisResult structure', async () => {
        const result = await analyzeNetwork(mockClient as never, {
          includeSuggestions: true,
          minConnectionsForHub: 2,
        });

        // Verify structure
        expect(result).toHaveProperty('summary');
        expect(result).toHaveProperty('isolatedNodes');
        expect(result).toHaveProperty('hubs');
        expect(result).toHaveProperty('metrics');
        expect(result).toHaveProperty('generatedAt');
        expect(result).toHaveProperty('suggestions');

        // Verify summary
        expect(result.summary.totalBuyers).toBe(4);
        expect(result.summary.totalSuppliers).toBe(4);
        expect(result.summary.totalLinks).toBe(6);
        expect(result.summary.buyersWithLinks).toBe(3);
        expect(result.summary.suppliersWithLinks).toBe(3);

        // Verify isolated nodes
        expect(result.isolatedNodes.buyers).toHaveLength(1);
        expect(result.isolatedNodes.buyers[0].id).toBe('b4');
        expect(result.isolatedNodes.suppliers).toHaveLength(1);
        expect(result.isolatedNodes.suppliers[0].id).toBe('s4');

        // Verify hubs (minConnectionsForHub: 2)
        expect(result.hubs.topBuyers.length).toBeGreaterThan(0);
        expect(result.hubs.topSuppliers.length).toBeGreaterThan(0);

        // Verify metrics are calculated
        expect(result.metrics.density).toBeGreaterThan(0);
        expect(result.metrics.coverage).toBeGreaterThan(0);

        // Verify suggestions exist
        expect(result.suggestions).toBeDefined();
      });

      it('handles API errors gracefully', async () => {
        mockClient.listBuyers.mockRejectedValue(new Error('API error'));

        await expect(analyzeNetwork(mockClient as never)).rejects.toThrow('API error');
      });
    });
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- src/services/__tests__/network-analyzer.test.ts`
Expected: PASS - integration test should pass

**Step 3: Commit test file**

```bash
git add src/services/__tests__/network-analyzer.test.ts
git commit -m "test: add integration test for full network analysis"
```

---

### Task 12: Run Full Test Suite and Verify Build

**Files:**
- No file changes

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 3: Final commit for complete implementation**

```bash
git add -A
git commit -m "feat: complete network analyzer implementation

- Calculate basic statistics (totals, averages, distributions)
- Calculate network metrics (density, coverage)
- Identify isolated nodes (buyers/suppliers with no connections)
- Identify network hubs (highly connected nodes)
- Generate connection suggestions based on similar buyer patterns
- Full test coverage with unit and integration tests"
```

---

## Summary

This plan implements the `analyzeNetwork` function in 12 incremental tasks:

1. **Tasks 1-2**: Basic statistics (totals, averages, distributions)
2. **Tasks 3-4**: Network metrics (density, coverage)
3. **Tasks 5-6**: Isolated nodes identification
4. **Tasks 7-8**: Network hubs identification
5. **Tasks 9-10**: Connection suggestions
6. **Tasks 11-12**: Integration testing and final verification

Each task follows TDD: write failing test, implement minimal code, verify tests pass, commit.
