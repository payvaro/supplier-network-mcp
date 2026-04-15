import { describe, it, expect, afterEach } from 'vitest';
import { createActionableError, createValidationError, createAdminOverrideRejectedError } from '../errors.js';
import { isAdminMode } from '../constants.js';

describe('createActionableError', () => {
  it('enriches 404 errors with tool hints', () => {
    const result = createActionableError(
      new Error('Request failed with status code 404'),
      'suppliers',
      'get',
      { id: 'abc123' }
    );
    expect(result.text).toContain('abc123');
    expect(result.text).toContain('search');
    expect(result.isError).toBe(true);
  });

  it('enriches 401 errors with auth guidance', () => {
    const result = createActionableError(
      new Error('Request failed with status code 401'),
      'suppliers',
      'list'
    );
    expect(result.text).toContain('NETWORK_API_KEY');
    expect(result.isError).toBe(true);
  });

  it('enriches 400 errors with param guidance', () => {
    const result = createActionableError(
      new Error('Request failed with status code 400'),
      'suppliers',
      'by_date'
    );
    expect(result.text).toContain('parameter');
    expect(result.isError).toBe(true);
  });

  it('passes through unknown errors with generic message', () => {
    const result = createActionableError(
      new Error('Something unexpected happened'),
      'suppliers',
      'list'
    );
    expect(result.text).toContain('Something unexpected happened');
    expect(result.isError).toBe(true);
  });

  it('provides cross-tool hints for buyer 404', () => {
    const result = createActionableError(
      new Error('Request failed with status code 404'),
      'buyers',
      'get',
      { id: 'buyer-xyz' }
    );
    expect(result.text).toContain('lookup_client');
  });

  it('provides cross-tool hints for matching job 404', () => {
    const result = createActionableError(
      new Error('Request failed with status code 404'),
      'matching',
      'job_detail',
      { jobId: 'job-123' }
    );
    expect(result.text).toContain('jobs');
  });
});

describe('createValidationError', () => {
  it('provides helpful message for missing required param', () => {
    const result = createValidationError('suppliers', 'get', 'id');
    expect(result.text).toContain("'get' action requires");
    expect(result.text).toContain('id');
    expect(result.isError).toBe(true);
  });

  it('suggests search for suppliers missing id', () => {
    const result = createValidationError('suppliers', 'get', 'id');
    expect(result.text).toContain('search');
  });
});

describe('createAdminOverrideRejectedError', () => {
  it('includes tool name in message', () => {
    const result = createAdminOverrideRejectedError('buyers');
    expect(result.text).toContain("'buyers'");
    expect(result.isError).toBe(true);
  });

  it('mentions NETWORK_ADMIN_MODE env var as the fix', () => {
    const result = createAdminOverrideRejectedError('analyze');
    expect(result.text).toContain('NETWORK_ADMIN_MODE=true');
  });

  it('mentions the asClientId field by name', () => {
    const result = createAdminOverrideRejectedError('suppliers');
    expect(result.text).toContain('asClientId');
  });
});

describe('isAdminMode', () => {
  const ORIG = process.env.NETWORK_ADMIN_MODE;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.NETWORK_ADMIN_MODE;
    else process.env.NETWORK_ADMIN_MODE = ORIG;
  });

  it('returns false when env var is unset', () => {
    delete process.env.NETWORK_ADMIN_MODE;
    expect(isAdminMode()).toBe(false);
  });

  it('returns true only when env var is literally "true"', () => {
    process.env.NETWORK_ADMIN_MODE = 'true';
    expect(isAdminMode()).toBe(true);
  });

  it('returns false for any other value including "TRUE", "1", "yes"', () => {
    for (const val of ['TRUE', '1', 'yes', 'false', '']) {
      process.env.NETWORK_ADMIN_MODE = val;
      expect(isAdminMode()).toBe(false);
    }
  });
});
