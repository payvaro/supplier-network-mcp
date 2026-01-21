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

      it('returns zero metrics for empty network', async () => {
        const result = await analyzeNetwork(mockClient as never);

        expect(result.metrics.density).toBe(0);
        expect(result.metrics.coverage).toBe(0);
        expect(result.metrics.buyerCoverage).toBe(0);
        expect(result.metrics.supplierCoverage).toBe(0);
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
    });

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
  });
});
