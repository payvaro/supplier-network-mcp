import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveWriteGating, isWriteGatingRejection } from '../write-gating.js';

describe('resolveWriteGating', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NETWORK_ADMIN_MODE;
    delete process.env.NETWORK_ENVIRONMENT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults dryRun to true when omitted', () => {
    const result = resolveWriteGating({}, 'buyers', 'update_external_refs');
    expect(isWriteGatingRejection(result)).toBe(false);
    if (!isWriteGatingRejection(result)) {
      expect(result.dryRun).toBe(true);
      expect(result.environment).toBe('dev');
      expect(result.isProd).toBe(false);
    }
  });

  it('honors explicit dryRun: true', () => {
    const result = resolveWriteGating({ dryRun: true }, 'buyers', 'x');
    expect(isWriteGatingRejection(result)).toBe(false);
    if (!isWriteGatingRejection(result)) expect(result.dryRun).toBe(true);
  });

  it('allows live writes in non-prod without confirm or admin mode', () => {
    process.env.NETWORK_ENVIRONMENT = 'dev';
    const result = resolveWriteGating({ dryRun: false }, 'buyers', 'x');
    expect(isWriteGatingRejection(result)).toBe(false);
    if (!isWriteGatingRejection(result)) {
      expect(result.dryRun).toBe(false);
      expect(result.isProd).toBe(false);
    }
  });

  it('rejects prod live writes without confirm', () => {
    process.env.NETWORK_ENVIRONMENT = 'prod';
    process.env.NETWORK_ADMIN_MODE = 'true';
    const result = resolveWriteGating({ dryRun: false }, 'buyers', 'update_external_refs');
    expect(isWriteGatingRejection(result)).toBe(true);
    if (isWriteGatingRejection(result)) {
      expect(result.content[0].text).toContain('confirm: true');
      expect(result.content[0].text).toContain('prod');
    }
  });

  it('rejects prod live writes when admin mode disabled even with confirm', () => {
    process.env.NETWORK_ENVIRONMENT = 'prod';
    const result = resolveWriteGating(
      { dryRun: false, confirm: true },
      'buyers',
      'update_external_refs',
    );
    expect(isWriteGatingRejection(result)).toBe(true);
    if (isWriteGatingRejection(result)) {
      expect(result.content[0].text).toContain('NETWORK_ADMIN_MODE');
    }
  });

  it('allows prod live writes with confirm AND admin mode', () => {
    process.env.NETWORK_ENVIRONMENT = 'production';
    process.env.NETWORK_ADMIN_MODE = 'true';
    const result = resolveWriteGating(
      { dryRun: false, confirm: true },
      'acceptor_integrations',
      'create',
    );
    expect(isWriteGatingRejection(result)).toBe(false);
    if (!isWriteGatingRejection(result)) {
      expect(result.dryRun).toBe(false);
      expect(result.isProd).toBe(true);
      expect(result.environment).toBe('production');
    }
  });

  it('treats confirm in non-prod as a no-op (still allowed)', () => {
    process.env.NETWORK_ENVIRONMENT = 'stage';
    const result = resolveWriteGating({ dryRun: false, confirm: true }, 'buyers', 'x');
    expect(isWriteGatingRejection(result)).toBe(false);
  });

  it('lower-cases NETWORK_ENVIRONMENT and matches PROD case-insensitively', () => {
    process.env.NETWORK_ENVIRONMENT = 'PROD';
    process.env.NETWORK_ADMIN_MODE = 'true';
    const result = resolveWriteGating(
      { dryRun: false, confirm: true },
      'buyers',
      'x',
    );
    expect(isWriteGatingRejection(result)).toBe(false);
    if (!isWriteGatingRejection(result)) {
      expect(result.environment).toBe('prod');
      expect(result.isProd).toBe(true);
    }
  });
});
