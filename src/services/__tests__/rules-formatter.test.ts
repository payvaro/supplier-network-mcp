import { describe, it, expect } from 'vitest';
import { compactEffective } from '../rules-formatter.js';

describe('compactEffective', () => {
  it('maps a single-directive response with one winner and one loser', () => {
    const raw = {
      entityType: 'BUYER',
      entityId: 'BUY-IT-001',
      directives: [
        {
          directiveType: 'NETTING',
          effectiveRule: {
            ruleId: 'r-123',
            scopeType: 'BUYER',
            scopeId: 'BUY-IT-001',
            value: 'ENABLED',
          },
          contributingSources: [
            {
              level: 'BUYER',
              ruleId: 'r-123',
              value: 'ENABLED',
              applied: true,
            },
            {
              level: 'NETWORK_PARTNER',
              ruleId: 'r-044',
              value: 'DISABLED',
              applied: false,
              reason: 'overridden by BUYER',
            },
          ],
        },
      ],
    };

    const out = compactEffective(raw);

    expect(out.entity).toEqual({ type: 'BUYER', id: 'BUY-IT-001' });
    expect(out.directives).toHaveLength(1);
    expect(out.directives[0].directiveType).toBe('NETTING');
    expect(out.directives[0].winner).toEqual({
      ruleId: 'r-123',
      scopeType: 'BUYER',
      scopeId: 'BUY-IT-001',
      value: 'ENABLED',
    });
    expect(out.directives[0].contributingSources).toHaveLength(2);
    expect(out.directives[0].contributingSources[1].applied).toBe(false);
  });

  it('falls through to raw shape when directives are missing', () => {
    const raw = { entityType: 'BUYER', entityId: 'BUY-IT-001' };
    const out = compactEffective(raw);
    expect(out.directives).toEqual([]);
  });

  it('preserves unknown fields on contributing sources', () => {
    const raw = {
      entityType: 'BUYER',
      entityId: 'BUY-IT-001',
      directives: [
        {
          directiveType: 'FEE',
          effectiveRule: { ruleId: 'r-1' },
          contributingSources: [
            { level: 'BUYER', ruleId: 'r-1', applied: true, customField: 'keep-me' },
          ],
        },
      ],
    };

    const out = compactEffective(raw);
    expect(out.directives[0].contributingSources[0]).toMatchObject({
      customField: 'keep-me',
    });
  });
});
