import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeNetworkConnections,
  notifySlack,
  handleAnalyze,
  handleNotifySlack,
} from '../analysis.js';
import { createMockNetworkAPIClient, type MockNetworkAPIClient } from '../../__mocks__/api-client.mock.js';
import {
  createNetworkAnalysisResult,
  createImportAnalysisResult,
  createRelationshipAnalysisResult,
  createRelationshipHealth,
} from '../../test-utils/fixtures.js';
import { ResponseFormat } from '../../constants.js';

// Mock the api-client module
vi.mock('../../services/api-client.js', () => ({
  getNetworkAPIClient: vi.fn(),
}));

// Mock the network-analyzer module
vi.mock('../../services/network-analyzer.js', () => ({
  analyzeNetwork: vi.fn(),
}));

// Mock the slack-notifier module
vi.mock('../../services/slack-notifier.js', () => ({
  postToSlack: vi.fn(),
  postGeneralMessage: vi.fn(),
  normalizeAnalysisResult: vi.fn((result) => result),
}));

// Mock service modules used by workflows (imported transitively via handleAnalyze)
vi.mock('../../services/import-analyzer.js', () => ({
  analyzePostUpload: vi.fn(),
  analyzeQuality: vi.fn(),
}));

vi.mock('../../services/relationship-analyzer.js', () => ({
  analyzeHealth: vi.fn(),
  analyzeCoverage: vi.fn(),
  buildRelationshipMap: vi.fn(),
}));

vi.mock('../../services/data-validator.js', () => ({
  validateImportData: vi.fn(),
}));

import { getNetworkAPIClient } from '../../services/api-client.js';
import { analyzeNetwork } from '../../services/network-analyzer.js';
import { postToSlack, postGeneralMessage, normalizeAnalysisResult } from '../../services/slack-notifier.js';
import { analyzeHealth } from '../../services/relationship-analyzer.js';
import { analyzePostUpload } from '../../services/import-analyzer.js';

describe('analysis tools', () => {
  let mockClient: MockNetworkAPIClient;

  beforeEach(() => {
    mockClient = createMockNetworkAPIClient();
    vi.mocked(getNetworkAPIClient).mockReturnValue(mockClient as never);
    vi.mocked(postToSlack).mockResolvedValue(undefined);
    vi.mocked(normalizeAnalysisResult).mockImplementation((result) => result);
  });

  describe('analyzeNetworkConnections', () => {
    it('returns network analysis results', async () => {
      const analysisResult = createNetworkAnalysisResult();
      vi.mocked(analyzeNetwork).mockResolvedValue(analysisResult);

      const result = await analyzeNetworkConnections({
        includeSuggestions: true,
        minConnectionsForHub: 5,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Network Analysis');
      expect(result.structuredContent).toEqual(analysisResult);
    });

    it('passes options to analyzeNetwork', async () => {
      const analysisResult = createNetworkAnalysisResult();
      vi.mocked(analyzeNetwork).mockResolvedValue(analysisResult);

      await analyzeNetworkConnections({
        includeSuggestions: false,
        minConnectionsForHub: 10,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(analyzeNetwork).toHaveBeenCalledWith(
        expect.anything(),
        {
          includeSuggestions: false,
          minConnectionsForHub: 10,
        }
      );
    });

    it('includes summary statistics in markdown', async () => {
      const analysisResult = createNetworkAnalysisResult({
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
      });
      vi.mocked(analyzeNetwork).mockResolvedValue(analysisResult);

      const result = await analyzeNetworkConnections({
        includeSuggestions: true,
        minConnectionsForHub: 5,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Total Buyers');
      expect(result.content[0].text).toContain('Total Suppliers');
      expect(result.content[0].text).toContain('Total Links');
    });

    it('includes network metrics in markdown', async () => {
      const analysisResult = createNetworkAnalysisResult({
        metrics: {
          density: 0.04,
          coverage: 0.85,
          buyerCoverage: 0.8,
          supplierCoverage: 0.9,
        },
      });
      vi.mocked(analyzeNetwork).mockResolvedValue(analysisResult);

      const result = await analyzeNetworkConnections({
        includeSuggestions: true,
        minConnectionsForHub: 5,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Network Density');
      expect(result.content[0].text).toContain('Coverage');
    });

    it('handles analysis errors', async () => {
      vi.mocked(analyzeNetwork).mockRejectedValue(new Error('Network analysis not yet implemented'));

      const result = await analyzeNetworkConnections({
        includeSuggestions: true,
        minConnectionsForHub: 5,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not yet implemented');
    });

    it('handles zero totals without NaN in markdown output', async () => {
      const analysisResult = createNetworkAnalysisResult({
        summary: {
          totalBuyers: 0,
          totalSuppliers: 0,
          totalLinks: 0,
          averageSuppliersPerBuyer: 0,
          averageBuyersPerSupplier: 0,
          buyersWithLinks: 0,
          suppliersWithLinks: 0,
          connectionDistribution: { buyers: {}, suppliers: {} },
        },
      });
      vi.mocked(analyzeNetwork).mockResolvedValue(analysisResult);

      const result = await analyzeNetworkConnections({
        includeSuggestions: true,
        minConnectionsForHub: 5,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).not.toContain('NaN');
      expect(result.content[0].text).toContain('0.0%');
    });

    it('returns JSON format when specified', async () => {
      const analysisResult = createNetworkAnalysisResult();
      vi.mocked(analyzeNetwork).mockResolvedValue(analysisResult);

      const result = await analyzeNetworkConnections({
        includeSuggestions: true,
        minConnectionsForHub: 5,
        response_format: ResponseFormat.JSON,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.summary).toBeDefined();
      expect(parsed.metrics).toBeDefined();
    });
  });

  describe('notifySlack', () => {
    it('posts to Slack successfully', async () => {
      const analysisResult = createNetworkAnalysisResult();

      const result = await notifySlack({
        webhookUrl: 'https://hooks.slack.com/services/xxx',
        analysisResult,
        includeDetails: false,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.content[0].text).toContain('Successfully posted');
      expect(postToSlack).toHaveBeenCalled();
    });

    it('uses provided webhook URL', async () => {
      const analysisResult = createNetworkAnalysisResult();

      await notifySlack({
        webhookUrl: 'https://hooks.slack.com/services/custom',
        analysisResult,
        includeDetails: false,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(postToSlack).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/custom',
        expect.anything(),
        false
      );
    });

    it('passes includeDetails to postToSlack', async () => {
      const analysisResult = createNetworkAnalysisResult();

      await notifySlack({
        webhookUrl: 'https://hooks.slack.com/services/xxx',
        analysisResult,
        includeDetails: true,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(postToSlack).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        true
      );
    });

    it('requires webhook URL', async () => {
      // Clear environment variable
      const originalEnv = process.env.SLACK_WEBHOOK_URL;
      delete process.env.SLACK_WEBHOOK_URL;

      const analysisResult = createNetworkAnalysisResult();

      const result = await notifySlack({
        analysisResult,
        includeDetails: false,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('webhook URL is required');

      // Restore environment
      if (originalEnv) {
        process.env.SLACK_WEBHOOK_URL = originalEnv;
      }
    });

    it('handles Slack API errors', async () => {
      vi.mocked(postToSlack).mockRejectedValue(new Error('Slack API error: 429 Too Many Requests'));

      const analysisResult = createNetworkAnalysisResult();

      const result = await notifySlack({
        webhookUrl: 'https://hooks.slack.com/services/xxx',
        analysisResult,
        includeDetails: false,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Slack API error');
    });

    it('normalizes analysis result before posting', async () => {
      const analysisResult = { summary: { totalBuyers: 10 } };

      await notifySlack({
        webhookUrl: 'https://hooks.slack.com/services/xxx',
        analysisResult,
        includeDetails: false,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(normalizeAnalysisResult).toHaveBeenCalledWith(analysisResult);
    });

    it('returns JSON format when specified', async () => {
      const analysisResult = createNetworkAnalysisResult();

      const result = await notifySlack({
        webhookUrl: 'https://hooks.slack.com/services/xxx',
        analysisResult,
        includeDetails: false,
        response_format: ResponseFormat.JSON,
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toContain('Successfully');
    });

    it('handles string analysisResult', async () => {
      const analysisString = JSON.stringify(createNetworkAnalysisResult());

      await notifySlack({
        webhookUrl: 'https://hooks.slack.com/services/xxx',
        analysisResult: analysisString,
        includeDetails: false,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(normalizeAnalysisResult).toHaveBeenCalledWith(analysisString);
    });

    it('handles wrapped structuredContent result', async () => {
      const analysisResult = {
        structuredContent: createNetworkAnalysisResult(),
      };

      await notifySlack({
        webhookUrl: 'https://hooks.slack.com/services/xxx',
        analysisResult,
        includeDetails: false,
        response_format: ResponseFormat.MARKDOWN,
      });

      expect(normalizeAnalysisResult).toHaveBeenCalledWith(analysisResult);
    });
  });

  describe('handleAnalyze', () => {
    it('dispatches connections action', async () => {
      const analysisResult = createNetworkAnalysisResult();
      vi.mocked(analyzeNetwork).mockResolvedValue(analysisResult);

      const result = await handleAnalyze({
        action: 'connections',
        includeSuggestions: true,
        minConnectionsForHub: 5,
        includeInactive: false,
      });

      expect(analyzeNetwork).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Network Analysis');
    });

    it('dispatches relationships action', async () => {
      const relResult = createRelationshipAnalysisResult({
        analysisType: 'health',
        health: createRelationshipHealth(),
      });
      vi.mocked(analyzeHealth).mockResolvedValue(relResult as any);

      const result = await handleAnalyze({
        action: 'relationships',
        analysisType: 'health',
        includeSuggestions: true,
        minConnectionsForHub: 5,
        includeInactive: false,
      });

      expect(analyzeHealth).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Health');
    });

    it('dispatches import_quality action', async () => {
      const importResult = createImportAnalysisResult({ mode: 'post-upload' });
      vi.mocked(analyzePostUpload).mockResolvedValue(importResult);

      const result = await handleAnalyze({
        action: 'import_quality',
        mode: 'post-upload',
        includeSuggestions: true,
        minConnectionsForHub: 5,
        includeInactive: false,
      });

      expect(analyzePostUpload).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Analysis');
    });

    it('wraps errors with createActionableError', async () => {
      vi.mocked(analyzeNetwork).mockRejectedValue(new Error('Request failed with status code 500'));

      const result = await handleAnalyze({
        action: 'connections',
        includeSuggestions: true,
        minConnectionsForHub: 5,
        includeInactive: false,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error:');
    });
  });

  describe('handleNotifySlack', () => {
    it('dispatches analysis type', async () => {
      const analysisResult = createNetworkAnalysisResult();

      const result = await handleNotifySlack({
        type: 'analysis',
        webhookUrl: 'https://hooks.slack.com/services/xxx',
        analysisResult,
        includeDetails: false,
      });

      expect(postToSlack).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Successfully posted');
    });

    it('dispatches custom type', async () => {
      vi.mocked(postGeneralMessage).mockResolvedValue(undefined);

      const result = await handleNotifySlack({
        type: 'custom',
        webhookUrl: 'https://hooks.slack.com/services/xxx',
        message: { body: 'Hello from the test', title: 'Test' },
        includeDetails: false,
      });

      expect(postGeneralMessage).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Slack Message Sent');
    });

    it('wraps errors with createActionableError', async () => {
      vi.mocked(postToSlack).mockRejectedValue(new Error('Request failed with status code 400'));

      const result = await handleNotifySlack({
        type: 'analysis',
        webhookUrl: 'https://hooks.slack.com/services/xxx',
        analysisResult: {},
        includeDetails: false,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('❌ Error:');
    });
  });
});
