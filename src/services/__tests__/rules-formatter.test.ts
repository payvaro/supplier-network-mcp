import { describe, it, expect } from 'vitest';
import { compactEffective, compactTrace } from '../rules-formatter.js';

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

describe('compactTrace', () => {
  it('maps resolved pair, chosen path, and eliminated alternatives', () => {
    const raw = {
      buyerId: 'BUY-IT-001',
      supplierId: 'SUP-IT-001',
      resolved: {
        acceptorId: 'ACC-1',
        integrationId: 'INT-1',
        paymentType: 'CARD',
      },
      trace: {
        chosenPath: [
          { step: 'payment-type-filter', outcome: 'CARD allowed', ruleId: 'r-501' },
          { step: 'acceptor-selection',  outcome: 'WEX wins',     ruleId: 'r-612' },
        ],
        eliminated: [
          { acceptorId: 'ACC-2', reason: 'require-clear failed', ruleId: 'r-555' },
        ],
      },
    };

    const out = compactTrace(raw);

    expect(out.pair).toEqual({ buyerId: 'BUY-IT-001', supplierId: 'SUP-IT-001' });
    expect(out.resolved).toMatchObject({ acceptorId: 'ACC-1', paymentType: 'CARD' });
    expect(out.chosenPath).toHaveLength(2);
    expect(out.chosenPath[0].step).toBe('payment-type-filter');
    expect(out.eliminated).toHaveLength(1);
    expect(out.eliminated[0].reason).toBe('require-clear failed');
  });

  it('falls through to empty arrays when trace is missing', () => {
    const raw = { buyerId: 'b', supplierId: 's', resolved: { acceptorId: 'A' } };
    const out = compactTrace(raw);
    expect(out.chosenPath).toEqual([]);
    expect(out.eliminated).toEqual([]);
    expect(out.resolved).toEqual({ acceptorId: 'A' });
  });

  it('tolerates alternate trace field name (eliminatedPaths)', () => {
    const raw = {
      buyerId: 'b',
      supplierId: 's',
      trace: {
        eliminatedPaths: [{ acceptorId: 'ACC-X', reason: 'filtered' }],
      },
    };
    const out = compactTrace(raw);
    expect(out.eliminated).toHaveLength(1);
    expect(out.eliminated[0].acceptorId).toBe('ACC-X');
  });
});
