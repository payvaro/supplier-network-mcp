import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMatching } from '../matching.js';
import { createMockNetworkAPIClient, type MockNetworkAPIClient } from '../../__mocks__/api-client.mock.js';
import type { MatchingJob, MatchCandidate, StagedMatch } from '../../types.js';

// Mock the api-client module
vi.mock('../../services/api-client.js', () => ({
  getNetworkAPIClient: vi.fn(),
}));

import { getNetworkAPIClient } from '../../services/api-client.js';

const createMatchingJob = (overrides: Partial<MatchingJob> = {}): MatchingJob => ({
  jobId: 'job-1',
  fileName: 'suppliers.csv',
  status: 'COMPLETED',
  totalRows: 100,
  exactMatches: 60,
  possibleMatches: 20,
  conflicts: 5,
  netNew: 10,
  failed: 5,
  merged: 0,
  created: 0,
  skipped: 0,
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const createMatchCandidate = (overrides: Partial<MatchCandidate> = {}): MatchCandidate => ({
  id: 'cand-1',
  jobId: 'job-1',
  rowNumber: 1,
  category: 'EXACT_MATCH',
  confidenceScore: 0.98,
  matchedSupplierId: 'sup-1',
  resolution: null,
  ...overrides,
});

const createStagedMatch = (overrides: Partial<StagedMatch> = {}): StagedMatch => ({
  stagedMatchId: 'staged-1',
  jobId: 'job-1',
  status: 'PENDING',
  candidate: createMatchCandidate(),
  alternatives: [],
  ...overrides,
});

describe('handleMatching', () => {
  let mockClient: MockNetworkAPIClient;

  beforeEach(() => {
    mockClient = createMockNetworkAPIClient();
    vi.mocked(getNetworkAPIClient).mockReturnValue(mockClient as never);
  });

  it('dispatches jobs action', async () => {
    const jobs = [createMatchingJob()];
    mockClient.listMatchingJobs.mockResolvedValue(jobs);

    const result = await handleMatching({ action: 'jobs', pageSize: 20 });

    expect(mockClient.listMatchingJobs).toHaveBeenCalled();
    expect(result.content[0].text).toContain('Matching Jobs');
  });

  it('dispatches job_detail action', async () => {
    const job = createMatchingJob({ jobId: 'job-42', fileName: 'test.csv' });
    mockClient.getMatchingJob.mockResolvedValue(job);

    const result = await handleMatching({ action: 'job_detail', jobId: 'job-42', pageSize: 20 });

    expect(mockClient.getMatchingJob).toHaveBeenCalledWith('job-42');
    expect(result.content[0].text).toContain('test.csv');
  });

  it('dispatches candidates action', async () => {
    const candidates = [createMatchCandidate()];
    mockClient.listMatchCandidates.mockResolvedValue(candidates);

    const result = await handleMatching({ action: 'candidates', jobId: 'job-1', pageSize: 20 });

    expect(mockClient.listMatchCandidates).toHaveBeenCalledWith('job-1', undefined, 20, undefined);
    expect(result.content[0].text).toContain('Match Candidates');
  });

  it('dispatches staged action', async () => {
    const matches = [createStagedMatch()];
    mockClient.listStagedMatches.mockResolvedValue(matches);

    const result = await handleMatching({ action: 'staged', jobId: 'job-1', pageSize: 20 });

    expect(mockClient.listStagedMatches).toHaveBeenCalledWith('job-1', undefined, undefined, 20, undefined);
    expect(result.content[0].text).toContain('Staged Matches');
  });

  it('wraps errors with createActionableError', async () => {
    mockClient.listMatchingJobs.mockRejectedValue(new Error('Request failed with status code 404'));

    const result = await handleMatching({ action: 'jobs', pageSize: 20 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('❌ Error:');
  });
});
