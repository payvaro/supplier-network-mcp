import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  normalizeAnalysisResult,
  formatAnalysisForSlack,
  postToSlack,
} from '../slack-notifier.js';
import { createNetworkAnalysisResult, createNetworkHub, createIsolatedNode } from '../../test-utils/fixtures.js';
import type { NetworkAnalysisResult } from '../../types.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('slack-notifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeAnalysisResult', () => {
    describe('full NetworkAnalysisResult object', () => {
      it('accepts a valid full NetworkAnalysisResult', () => {
        const input = createNetworkAnalysisResult();
        const result = normalizeAnalysisResult(input);

        expect(result.summary).toEqual(input.summary);
        expect(result.metrics).toEqual(input.metrics);
        expect(result.isolatedNodes).toEqual(input.isolatedNodes);
        expect(result.hubs).toEqual(input.hubs);
      });

      it('preserves suggestions when present', () => {
        const input = createNetworkAnalysisResult({
          suggestions: [
            {
              buyerId: 'buyer-1',
              supplierId: 'supplier-1',
              buyerName: 'Buyer One',
              supplierName: 'Supplier One',
              reason: 'Similar industry',
              confidence: 'high',
            },
          ],
        });
        const result = normalizeAnalysisResult(input);

        expect(result.suggestions).toHaveLength(1);
        expect(result.suggestions?.[0].confidence).toBe('high');
      });
    });

    describe('JSON string input', () => {
      it('parses valid JSON string', () => {
        const input = createNetworkAnalysisResult();
        const jsonString = JSON.stringify(input);
        const result = normalizeAnalysisResult(jsonString);

        expect(result.summary.totalBuyers).toBe(input.summary.totalBuyers);
        expect(result.metrics.density).toBe(input.metrics.density);
      });

      it('throws error for invalid JSON string', () => {
        expect(() => normalizeAnalysisResult('not valid json')).toThrow(
          'Invalid JSON string'
        );
      });

      it('throws error for empty JSON string', () => {
        expect(() => normalizeAnalysisResult('')).toThrow('Invalid JSON string');
      });
    });

    describe('partial result with defaults', () => {
      it('fills in defaults for missing summary fields', () => {
        const input = {
          totalBuyers: 10,
          totalSuppliers: 5,
          totalLinks: 15,
        };
        const result = normalizeAnalysisResult(input);

        expect(result.summary.totalBuyers).toBe(10);
        expect(result.summary.totalSuppliers).toBe(5);
        expect(result.summary.totalLinks).toBe(15);
        // Should calculate averages
        expect(result.summary.averageSuppliersPerBuyer).toBe(1.5); // 15/10
        expect(result.summary.averageBuyersPerSupplier).toBe(3); // 15/5
      });

      it('fills in defaults for missing metrics', () => {
        const input = {
          totalBuyers: 100,
          totalSuppliers: 50,
          buyersWithLinks: 80,
          suppliersWithLinks: 40,
        };
        const result = normalizeAnalysisResult(input);

        // Should calculate coverage from withLinks/total
        expect(result.metrics.buyerCoverage).toBe(0.8);
        expect(result.metrics.supplierCoverage).toBe(0.8);
      });

      it('handles zero totals without division errors', () => {
        const input = {
          totalBuyers: 0,
          totalSuppliers: 0,
          totalLinks: 0,
        };
        const result = normalizeAnalysisResult(input);

        expect(result.summary.averageSuppliersPerBuyer).toBe(0);
        expect(result.summary.averageBuyersPerSupplier).toBe(0);
        expect(result.metrics.buyerCoverage).toBe(0);
        expect(result.metrics.supplierCoverage).toBe(0);
      });

      it('creates empty isolated nodes arrays when missing', () => {
        const input = { totalBuyers: 10 };
        const result = normalizeAnalysisResult(input);

        expect(result.isolatedNodes.buyers).toEqual([]);
        expect(result.isolatedNodes.suppliers).toEqual([]);
      });

      it('creates empty hubs arrays when missing', () => {
        const input = { totalBuyers: 10 };
        const result = normalizeAnalysisResult(input);

        expect(result.hubs.topBuyers).toEqual([]);
        expect(result.hubs.topSuppliers).toEqual([]);
      });
    });

    describe('structuredContent wrapper', () => {
      it('unwraps objects with structuredContent property', () => {
        const analysisData = createNetworkAnalysisResult();
        const wrapped = { structuredContent: analysisData };
        const result = normalizeAnalysisResult(wrapped);

        expect(result.summary.totalBuyers).toBe(analysisData.summary.totalBuyers);
      });

      it('handles deeply nested structuredContent', () => {
        const analysisData = createNetworkAnalysisResult();
        const wrapped = {
          structuredContent: analysisData,
          otherField: 'ignored',
        };
        const result = normalizeAnalysisResult(wrapped);

        expect(result.summary).toBeDefined();
      });
    });

    describe('flat vs nested structures', () => {
      it('handles nested isolatedNodes structure', () => {
        const input = {
          totalBuyers: 10,
          isolatedNodes: {
            buyers: [{ id: 'b1', name: 'Buyer 1', type: 'buyer' as const }],
            suppliers: [{ id: 's1', name: 'Supplier 1', type: 'supplier' as const }],
          },
        };
        const result = normalizeAnalysisResult(input);

        expect(result.isolatedNodes.buyers).toHaveLength(1);
        expect(result.isolatedNodes.suppliers).toHaveLength(1);
      });

      it('handles flat isolatedBuyers/isolatedSuppliers', () => {
        const input = {
          totalBuyers: 10,
          isolatedBuyers: [{ id: 'b1', name: 'Buyer 1', type: 'buyer' as const }],
          isolatedSuppliers: [{ id: 's1', name: 'Supplier 1', type: 'supplier' as const }],
        };
        const result = normalizeAnalysisResult(input);

        expect(result.isolatedNodes.buyers).toHaveLength(1);
        expect(result.isolatedNodes.suppliers).toHaveLength(1);
      });

      it('handles nested hubs structure', () => {
        const input = {
          totalBuyers: 10,
          hubs: {
            topBuyers: [{ id: 'b1', name: 'Hub Buyer', type: 'buyer' as const, connectionCount: 10 }],
            topSuppliers: [{ id: 's1', name: 'Hub Supplier', type: 'supplier' as const, connectionCount: 20 }],
          },
        };
        const result = normalizeAnalysisResult(input);

        expect(result.hubs.topBuyers).toHaveLength(1);
        expect(result.hubs.topSuppliers).toHaveLength(1);
      });

      it('handles flat topBuyers/topSuppliers', () => {
        const input = {
          totalBuyers: 10,
          topBuyers: [{ id: 'b1', name: 'Hub Buyer', type: 'buyer' as const, connectionCount: 10 }],
          topSuppliers: [{ id: 's1', name: 'Hub Supplier', type: 'supplier' as const, connectionCount: 20 }],
        };
        const result = normalizeAnalysisResult(input);

        expect(result.hubs.topBuyers).toHaveLength(1);
        expect(result.hubs.topSuppliers).toHaveLength(1);
      });
    });

    describe('timestamp handling', () => {
      it('preserves generatedAt when present', () => {
        const timestamp = '2024-01-15T10:30:00Z';
        const input = { totalBuyers: 10, generatedAt: timestamp };
        const result = normalizeAnalysisResult(input);

        expect(result.generatedAt).toBe(timestamp);
      });

      it('falls back to timestamp field', () => {
        const timestamp = '2024-01-15T10:30:00Z';
        const input = { totalBuyers: 10, timestamp };
        const result = normalizeAnalysisResult(input);

        expect(result.generatedAt).toBe(timestamp);
      });

      it('falls back to createdAt field', () => {
        const timestamp = '2024-01-15T10:30:00Z';
        const input = { totalBuyers: 10, createdAt: timestamp };
        const result = normalizeAnalysisResult(input);

        expect(result.generatedAt).toBe(timestamp);
      });

      it('generates timestamp when none provided', () => {
        const input = { totalBuyers: 10 };
        const before = new Date().toISOString();
        const result = normalizeAnalysisResult(input);
        const after = new Date().toISOString();

        expect(result.generatedAt >= before).toBe(true);
        expect(result.generatedAt <= after).toBe(true);
      });
    });

    describe('error handling', () => {
      it('throws for null input', () => {
        expect(() => normalizeAnalysisResult(null)).toThrow(
          'Analysis result must be an object'
        );
      });

      it('throws for undefined input', () => {
        expect(() => normalizeAnalysisResult(undefined)).toThrow(
          'Analysis result must be an object'
        );
      });

      it('throws for number input', () => {
        expect(() => normalizeAnalysisResult(42)).toThrow(
          'Analysis result must be an object'
        );
      });

      it('handles array input by treating it as object (fills defaults)', () => {
        // Arrays are objects in JS, so they don't throw - they get processed with defaults
        const result = normalizeAnalysisResult([1, 2, 3]);
        // Will have default values since array indices aren't the expected properties
        expect(result.summary.totalBuyers).toBe(0);
      });
    });

    describe('metric calculations', () => {
      it('calculates averages from totals', () => {
        const input = {
          totalBuyers: 100,
          totalSuppliers: 50,
          totalLinks: 200,
        };
        const result = normalizeAnalysisResult(input);

        expect(result.summary.averageSuppliersPerBuyer).toBe(2);
        expect(result.summary.averageBuyersPerSupplier).toBe(4);
      });

      it('uses provided averages over calculated ones', () => {
        const input = {
          totalBuyers: 100,
          totalSuppliers: 50,
          totalLinks: 200,
          averageSuppliersPerBuyer: 3.5,
          averageBuyersPerSupplier: 5.5,
        };
        const result = normalizeAnalysisResult(input);

        expect(result.summary.averageSuppliersPerBuyer).toBe(3.5);
        expect(result.summary.averageBuyersPerSupplier).toBe(5.5);
      });

      it('calculates coverage percentages', () => {
        const input = {
          totalBuyers: 100,
          totalSuppliers: 50,
          buyersWithLinks: 75,
          suppliersWithLinks: 40,
        };
        const result = normalizeAnalysisResult(input);

        expect(result.metrics.buyerCoverage).toBe(0.75);
        expect(result.metrics.supplierCoverage).toBe(0.8);
      });
    });
  });

  describe('formatAnalysisForSlack', () => {
    it('returns array of Slack blocks', () => {
      const result = createNetworkAnalysisResult();
      const blocks = formatAnalysisForSlack(result);

      expect(Array.isArray(blocks)).toBe(true);
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('includes header block', () => {
      const result = createNetworkAnalysisResult();
      const blocks = formatAnalysisForSlack(result);

      const header = blocks.find((b) => b.type === 'header');
      expect(header).toBeDefined();
      expect(header?.text).toEqual({
        type: 'plain_text',
        text: 'Network Analysis Summary',
        emoji: true,
      });
    });

    it('includes statistics section with key metrics', () => {
      const result = createNetworkAnalysisResult({
        summary: {
          totalBuyers: 100,
          totalSuppliers: 50,
          totalLinks: 200,
          averageSuppliersPerBuyer: 2,
          averageBuyersPerSupplier: 4,
          buyersWithLinks: 80,
          suppliersWithLinks: 45,
          connectionDistribution: { buyers: {}, suppliers: {} },
        },
        metrics: {
          density: 0.04,
          coverage: 0.85,
          buyerCoverage: 0.8,
          supplierCoverage: 0.9,
        },
      });
      const blocks = formatAnalysisForSlack(result);

      const sections = blocks.filter((b) => b.type === 'section');
      expect(sections.length).toBeGreaterThan(0);

      // Check that stats are included
      const allFieldText = JSON.stringify(sections);
      expect(allFieldText).toContain('Total Buyers');
      expect(allFieldText).toContain('Total Suppliers');
      expect(allFieldText).toContain('Total Links');
      expect(allFieldText).toContain('Network Density');
    });

    it('includes highlights section when isolated nodes exist', () => {
      const result = createNetworkAnalysisResult({
        isolatedNodes: {
          buyers: [createIsolatedNode({ type: 'buyer', id: 'b1' })],
          suppliers: [createIsolatedNode({ type: 'supplier', id: 's1' })],
        },
      });
      const blocks = formatAnalysisForSlack(result);

      const highlightsSection = blocks.find(
        (b) =>
          b.type === 'section' &&
          typeof b.text === 'object' &&
          (b.text as { text?: string }).text?.includes('Highlights')
      );
      expect(highlightsSection).toBeDefined();
    });

    it('includes top hub information in highlights', () => {
      const result = createNetworkAnalysisResult({
        hubs: {
          topBuyers: [createNetworkHub({ name: 'Top Buyer Corp', connectionCount: 50, type: 'buyer' })],
          topSuppliers: [createNetworkHub({ name: 'Top Supplier Inc', connectionCount: 30, type: 'supplier' })],
        },
      });
      const blocks = formatAnalysisForSlack(result);

      const blocksJson = JSON.stringify(blocks);
      expect(blocksJson).toContain('Top Buyer Corp');
      expect(blocksJson).toContain('Top Supplier Inc');
    });

    it('includes action items section when suggestions exist', () => {
      const result = createNetworkAnalysisResult({
        suggestions: [
          {
            buyerId: 'b1',
            supplierId: 's1',
            reason: 'test',
            confidence: 'high',
          },
        ],
      });
      const blocks = formatAnalysisForSlack(result);

      const blocksJson = JSON.stringify(blocks);
      expect(blocksJson).toContain('Action Items');
      expect(blocksJson).toContain('connection suggestion');
    });

    it('pluralizes correctly for single items', () => {
      const result = createNetworkAnalysisResult({
        suggestions: [
          {
            buyerId: 'b1',
            supplierId: 's1',
            reason: 'test',
            confidence: 'high',
          },
        ],
        isolatedNodes: {
          buyers: [createIsolatedNode({ type: 'buyer' })],
          suppliers: [],
        },
      });
      const blocks = formatAnalysisForSlack(result);

      const blocksJson = JSON.stringify(blocks);
      expect(blocksJson).toContain('1 isolated buyer'); // singular
      expect(blocksJson).toContain('1 connection suggestion'); // singular
    });

    it('pluralizes correctly for multiple items', () => {
      const result = createNetworkAnalysisResult({
        isolatedNodes: {
          buyers: [
            createIsolatedNode({ type: 'buyer', id: 'b1' }),
            createIsolatedNode({ type: 'buyer', id: 'b2' }),
          ],
          suppliers: [],
        },
      });
      const blocks = formatAnalysisForSlack(result);

      const blocksJson = JSON.stringify(blocks);
      expect(blocksJson).toContain('2 isolated buyers'); // plural
    });

    it('includes context block with timestamp', () => {
      const result = createNetworkAnalysisResult({
        generatedAt: '2024-01-15T10:30:00Z',
      });
      const blocks = formatAnalysisForSlack(result);

      const context = blocks.find((b) => b.type === 'context');
      expect(context).toBeDefined();
    });

    describe('includeDetails option', () => {
      it('includes isolated node details when true', () => {
        const result = createNetworkAnalysisResult({
          isolatedNodes: {
            buyers: [
              createIsolatedNode({ type: 'buyer', name: 'Isolated Buyer 1', clientId: 'CL001' }),
            ],
            suppliers: [
              createIsolatedNode({ type: 'supplier', name: 'Isolated Supplier 1' }),
            ],
          },
        });
        const blocks = formatAnalysisForSlack(result, true);

        const blocksJson = JSON.stringify(blocks);
        expect(blocksJson).toContain('Isolated Buyers');
        expect(blocksJson).toContain('Isolated Buyer 1');
        expect(blocksJson).toContain('CL001');
        expect(blocksJson).toContain('Isolated Suppliers');
        expect(blocksJson).toContain('Isolated Supplier 1');
      });

      it('truncates long lists with "and X more"', () => {
        const manyBuyers = Array.from({ length: 10 }, (_, i) =>
          createIsolatedNode({ type: 'buyer', id: `b${i}`, name: `Buyer ${i}` })
        );
        const result = createNetworkAnalysisResult({
          isolatedNodes: {
            buyers: manyBuyers,
            suppliers: [],
          },
        });
        const blocks = formatAnalysisForSlack(result, true);

        const blocksJson = JSON.stringify(blocks);
        expect(blocksJson).toContain('and 5 more');
      });

      it('does not include details when false', () => {
        const result = createNetworkAnalysisResult({
          isolatedNodes: {
            buyers: [createIsolatedNode({ type: 'buyer', name: 'Secret Buyer' })],
            suppliers: [],
          },
        });
        const blocks = formatAnalysisForSlack(result, false);

        const blocksJson = JSON.stringify(blocks);
        expect(blocksJson).not.toContain('Secret Buyer');
      });
    });
  });

  describe('postToSlack', () => {
    const webhookUrl = 'https://hooks.slack.com/services/test/webhook';

    it('posts formatted blocks to webhook URL', async () => {
      mockedAxios.post.mockResolvedValueOnce({ status: 200, data: 'ok' });

      const result = createNetworkAnalysisResult();
      await postToSlack(webhookUrl, result);

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          blocks: expect.any(Array),
          text: 'Network Analysis Summary',
        }),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        })
      );
    });

    it('passes includeDetails to formatter', async () => {
      mockedAxios.post.mockResolvedValueOnce({ status: 200, data: 'ok' });

      const result = createNetworkAnalysisResult({
        isolatedNodes: {
          buyers: [createIsolatedNode({ type: 'buyer', name: 'Detail Buyer' })],
          suppliers: [],
        },
      });
      await postToSlack(webhookUrl, result, true);

      const callArgs = mockedAxios.post.mock.calls[0];
      const payload = callArgs[1] as { blocks: unknown[] };
      const blocksJson = JSON.stringify(payload.blocks);
      expect(blocksJson).toContain('Detail Buyer');
    });

    it('throws error for non-200 response', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 400,
        statusText: 'Bad Request',
        data: 'invalid_payload',
      });

      const result = createNetworkAnalysisResult();

      await expect(postToSlack(webhookUrl, result)).rejects.toThrow(
        'Slack webhook returned status 400'
      );
    });

    it('throws error with response data for API errors', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 403,
          data: { error: 'token_revoked' },
        },
        request: {},
      };
      mockedAxios.post.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      const result = createNetworkAnalysisResult();

      await expect(postToSlack(webhookUrl, result)).rejects.toThrow(
        'Slack API error: 403'
      );
    });

    it('throws error for network failures (no response)', async () => {
      const axiosError = {
        isAxiosError: true,
        request: {},
        response: undefined,
      };
      mockedAxios.post.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      const result = createNetworkAnalysisResult();

      await expect(postToSlack(webhookUrl, result)).rejects.toThrow(
        'No response from Slack webhook'
      );
    });

    it('rethrows non-axios errors', async () => {
      const genericError = new Error('Something went wrong');
      mockedAxios.post.mockRejectedValueOnce(genericError);
      mockedAxios.isAxiosError.mockReturnValueOnce(false);

      const result = createNetworkAnalysisResult();

      await expect(postToSlack(webhookUrl, result)).rejects.toThrow(
        'Something went wrong'
      );
    });

    it('respects 10 second timeout', async () => {
      mockedAxios.post.mockResolvedValueOnce({ status: 200, data: 'ok' });

      const result = createNetworkAnalysisResult();
      await postToSlack(webhookUrl, result);

      const callArgs = mockedAxios.post.mock.calls[0];
      const config = callArgs[2] as { timeout: number };
      expect(config.timeout).toBe(10000);
    });
  });
});
