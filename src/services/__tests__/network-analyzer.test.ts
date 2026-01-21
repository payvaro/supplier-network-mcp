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
    });
  });
});
