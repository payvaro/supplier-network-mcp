import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeImport, analyzeRelationships } from '../workflows.js';
import { createMockNetworkAPIClient, type MockNetworkAPIClient } from '../../__mocks__/api-client.mock.js';
import {
  createSupplier,
  createBuyer,
  createBuyerLink,
  createImportAnalysisResult,
  createRelationshipAnalysisResult,
  createRelationshipHealth,
  createRelationshipCoverage,
  createRelationshipMapping,
} from '../../test-utils/fixtures.js';
import { ResponseFormat } from '../../constants.js';

// Mock the api-client module
vi.mock('../../services/api-client.js', () => ({
  getNetworkAPIClient: vi.fn(),
}));

// Mock the import-analyzer module
vi.mock('../../services/import-analyzer.js', () => ({
  analyzePostUpload: vi.fn(),
  analyzeQuality: vi.fn(),
}));

// Mock the relationship-analyzer module
vi.mock('../../services/relationship-analyzer.js', () => ({
  analyzeHealth: vi.fn(),
  analyzeCoverage: vi.fn(),
  buildRelationshipMap: vi.fn(),
}));

import { getNetworkAPIClient } from '../../services/api-client.js';
import { analyzePostUpload, analyzeQuality } from '../../services/import-analyzer.js';
import { analyzeHealth, analyzeCoverage, buildRelationshipMap } from '../../services/relationship-analyzer.js';

describe('workflow tools', () => {
  let mockClient: MockNetworkAPIClient;

  beforeEach(() => {
    mockClient = createMockNetworkAPIClient();
    vi.mocked(getNetworkAPIClient).mockReturnValue(mockClient as never);
  });

  describe('analyzeImport', () => {
    it('calls analyzePostUpload for post-upload mode', async () => {
      const analysisResult = createImportAnalysisResult({ mode: 'post-upload' });
      vi.mocked(analyzePostUpload).mockResolvedValue(analysisResult);

      const result = await analyzeImport({
        mode: 'post-upload',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(analyzePostUpload).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Post-Upload Analysis');
    });

    it('calls analyzePostUpload with date range for preview mode', async () => {
      const analysisResult = createImportAnalysisResult({ mode: 'preview' });
      vi.mocked(analyzePostUpload).mockResolvedValue(analysisResult);

      const result = await analyzeImport({
        mode: 'preview',
        dateRange: { from: '20251115', to: '20251119' },
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(analyzePostUpload).toHaveBeenCalledWith(
        expect.anything(),
        { from: '20251115', to: '20251119' },
        undefined
      );
      expect(result.content[0].text).toContain('Import Preview');
    });

    it('calls analyzeQuality for quality mode', async () => {
      const analysisResult = createImportAnalysisResult({ mode: 'quality' });
      vi.mocked(analyzeQuality).mockResolvedValue(analysisResult);

      const result = await analyzeImport({
        mode: 'quality',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(analyzeQuality).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Data Quality Review');
    });

    it('passes buyerId to analyzer', async () => {
      const analysisResult = createImportAnalysisResult();
      vi.mocked(analyzePostUpload).mockResolvedValue(analysisResult);

      await analyzeImport({
        mode: 'post-upload',
        buyerId: 'buyer-123',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(analyzePostUpload).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
        'buyer-123'
      );
    });

    it('includes summary in markdown output', async () => {
      const analysisResult = createImportAnalysisResult({
        summary: {
          totalRecords: 100,
          newSuppliers: 80,
          potentialDuplicates: 15,
          exactMatches: 5,
        },
      });
      vi.mocked(analyzePostUpload).mockResolvedValue(analysisResult);

      const result = await analyzeImport({
        mode: 'post-upload',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Total Records');
      expect(result.content[0].text).toContain('100');
      expect(result.content[0].text).toContain('New Suppliers');
    });

    it('includes quality metrics when present', async () => {
      const analysisResult = createImportAnalysisResult({
        mode: 'quality',
        qualityMetrics: {
          completeness: 0.85,
          matchConfidence: 0.9,
          issues: [
            { field: 'email', issue: 'Missing email', severity: 'medium', affectedCount: 10 },
          ],
        },
      });
      vi.mocked(analyzeQuality).mockResolvedValue(analysisResult);

      const result = await analyzeImport({
        mode: 'quality',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Quality Metrics');
      expect(result.content[0].text).toContain('Completeness');
      expect(result.content[0].text).toContain('85.0%');
    });

    it('returns JSON format when specified', async () => {
      const analysisResult = createImportAnalysisResult();
      vi.mocked(analyzePostUpload).mockResolvedValue(analysisResult);

      const result = await analyzeImport({
        mode: 'post-upload',
        response_format: ResponseFormat.JSON,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.mode).toBe('post-upload');
      expect(parsed.summary).toBeDefined();
    });

    it('handles analyzer errors', async () => {
      vi.mocked(analyzePostUpload).mockRejectedValue(new Error('Analysis failed'));

      const result = await analyzeImport({
        mode: 'post-upload',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Analysis failed');
    });
  });

  describe('analyzeRelationships', () => {
    it('calls analyzeHealth for health analysis type', async () => {
      const analysisResult = createRelationshipAnalysisResult({
        analysisType: 'health',
        health: createRelationshipHealth(),
      });
      vi.mocked(analyzeHealth).mockResolvedValue(analysisResult);

      const result = await analyzeRelationships({
        analysisType: 'health',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(analyzeHealth).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Relationship Health Analysis');
    });

    it('calls analyzeCoverage for coverage analysis type', async () => {
      const analysisResult = createRelationshipAnalysisResult({
        analysisType: 'coverage',
        health: undefined,
        coverage: createRelationshipCoverage(),
      });
      vi.mocked(analyzeCoverage).mockResolvedValue(analysisResult);

      const result = await analyzeRelationships({
        analysisType: 'coverage',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(analyzeCoverage).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Coverage Analysis');
    });

    it('calls buildRelationshipMap for mapping analysis type', async () => {
      const analysisResult = createRelationshipAnalysisResult({
        analysisType: 'mapping',
        health: undefined,
        mapping: createRelationshipMapping(),
      });
      vi.mocked(buildRelationshipMap).mockResolvedValue(analysisResult);

      const result = await analyzeRelationships({
        analysisType: 'mapping',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(buildRelationshipMap).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Relationship Mapping');
    });

    it('passes buyerId to analyzer', async () => {
      const analysisResult = createRelationshipAnalysisResult();
      vi.mocked(analyzeHealth).mockResolvedValue(analysisResult);

      await analyzeRelationships({
        analysisType: 'health',
        buyerId: 'buyer-123',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(analyzeHealth).toHaveBeenCalledWith(
        expect.anything(),
        'buyer-123',
        expect.objectContaining({})
      );
    });

    it('passes includeInactive option', async () => {
      const analysisResult = createRelationshipAnalysisResult();
      vi.mocked(analyzeHealth).mockResolvedValue(analysisResult);

      await analyzeRelationships({
        analysisType: 'health',
        includeInactive: true,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(analyzeHealth).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
        expect.objectContaining({ includeInactive: true })
      );
    });

    it('includes health metrics in markdown output', async () => {
      const analysisResult = createRelationshipAnalysisResult({
        analysisType: 'health',
        health: {
          activeLinks: 45,
          staleLinks: 5,
          healthScore: 85,
          issues: [],
        },
      });
      vi.mocked(analyzeHealth).mockResolvedValue(analysisResult);

      const result = await analyzeRelationships({
        analysisType: 'health',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Health Score');
      expect(result.content[0].text).toContain('85%');
      expect(result.content[0].text).toContain('Active Links');
    });

    it('includes coverage metrics in markdown output', async () => {
      const analysisResult = createRelationshipAnalysisResult({
        analysisType: 'coverage',
        health: undefined,
        coverage: {
          totalSuppliers: 100,
          linkedSuppliers: 75,
          coveragePercent: 75,
          missingHighPriority: [],
        },
      });
      vi.mocked(analyzeCoverage).mockResolvedValue(analysisResult);

      const result = await analyzeRelationships({
        analysisType: 'coverage',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Coverage Metrics');
      expect(result.content[0].text).toContain('75.0%');
    });

    it('includes mapping structure in markdown output', async () => {
      const analysisResult = createRelationshipAnalysisResult({
        analysisType: 'mapping',
        health: undefined,
        mapping: {
          nodes: [
            { id: 'buyer-1', type: 'buyer', name: 'Test Buyer', linkCount: 10 },
            { id: 'supplier-1', type: 'supplier', name: 'Test Supplier', linkCount: 5 },
          ],
          edges: [{ from: 'buyer-1', to: 'supplier-1', status: 'ACTIVE' }],
        },
      });
      vi.mocked(buildRelationshipMap).mockResolvedValue(analysisResult);

      const result = await analyzeRelationships({
        analysisType: 'mapping',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Network Structure');
      expect(result.content[0].text).toContain('Buyers');
      expect(result.content[0].text).toContain('Suppliers');
      expect(result.content[0].text).toContain('Connections');
    });

    it('returns JSON format when specified', async () => {
      const analysisResult = createRelationshipAnalysisResult();
      vi.mocked(analyzeHealth).mockResolvedValue(analysisResult);

      const result = await analyzeRelationships({
        analysisType: 'health',
        response_format: ResponseFormat.JSON,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.analysisType).toBe('health');
      expect(parsed.health).toBeDefined();
    });

    it('handles analyzer errors', async () => {
      vi.mocked(analyzeHealth).mockRejectedValue(new Error('Health analysis failed'));

      const result = await analyzeRelationships({
        analysisType: 'health',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Health analysis failed');
    });

    it('includes buyer context when specified', async () => {
      const analysisResult = createRelationshipAnalysisResult({
        buyer: createBuyer({ id: 'buyer-123', name: 'Test Corp' }),
      });
      vi.mocked(analyzeHealth).mockResolvedValue(analysisResult);

      const result = await analyzeRelationships({
        analysisType: 'health',
        buyerId: 'buyer-123',
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Test Corp');
    });
  });
});
