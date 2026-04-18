import { describe, it, expect } from 'vitest';
import { compactEffective, compactTrace } from '../rules-formatter.js';

describe('compactEffective', () => {
  // Fixture captured from a running local network service on 2026-04-18
  // (GET /api/config-rules/effective?entityType=BUYER&entityId=BUY-IT-005 with
  // a single NETTING rule created at the BUYER scope).
  const realResponse = {
    targetEntityType: 'BUYER',
    targetEntityId: 'BUY-IT-005',
    hierarchyLevels: [
      {
        scope: 'BUYER',
        entityId: 'BUY-IT-005',
        entityName: 'Campus Starbucks #505',
        rules: [
          {
            configRuleId: 'ac7217d0-0738-4b35-bd78-ebc0ba860424',
            ruleType: 'NETTING',
            ruleKey: 'netting',
            ruleValue: '50.00',
            params: { maxAmount: 100 },
            acceptorId: null,
            paymentRailId: null,
            status: 'ACTIVE',
            createdAt: '2026-04-18T17:21:21.757690Z',
            updatedAt: '2026-04-18T17:21:21.757690Z',
          },
        ],
      },
    ],
    effectiveRules: [
      {
        ruleType: 'NETTING',
        ruleKey: 'netting',
        effectiveValue: '50.00',
        mergeStrategy: 'MOST_SPECIFIC_WINS',
        contributingRuleIds: ['ac7217d0-0738-4b35-bd78-ebc0ba860424'],
        explanation: 'Scope BUYER wins (directiveMultiplier=1.0). Effective netting: 50.00 basis points.',
      },
    ],
  };

  it('maps the real API shape: entity, effective summary, and hierarchy', () => {
    const out = compactEffective(realResponse);

    expect(out.entity).toEqual({ type: 'BUYER', id: 'BUY-IT-005' });

    expect(out.effective).toHaveLength(1);
    expect(out.effective[0]).toEqual({
      ruleType: 'NETTING',
      ruleKey: 'netting',
      effectiveValue: '50.00',
      mergeStrategy: 'MOST_SPECIFIC_WINS',
      explanation: 'Scope BUYER wins (directiveMultiplier=1.0). Effective netting: 50.00 basis points.',
      contributingRuleIds: ['ac7217d0-0738-4b35-bd78-ebc0ba860424'],
    });

    expect(out.hierarchy).toHaveLength(1);
    expect(out.hierarchy[0]).toMatchObject({
      scope: 'BUYER',
      entityId: 'BUY-IT-005',
      entityName: 'Campus Starbucks #505',
    });
    expect(out.hierarchy[0].rules).toHaveLength(1);
    expect(out.hierarchy[0].rules[0]).toMatchObject({
      configRuleId: 'ac7217d0-0738-4b35-bd78-ebc0ba860424',
      ruleType: 'NETTING',
      ruleKey: 'netting',
      ruleValue: '50.00',
      status: 'ACTIVE',
    });
  });

  it('falls through to empty arrays when hierarchyLevels and effectiveRules are missing', () => {
    const raw = { targetEntityType: 'BUYER', targetEntityId: 'BUY-IT-005' };
    const out = compactEffective(raw);
    expect(out.hierarchy).toEqual([]);
    expect(out.effective).toEqual([]);
    expect(out.entity).toEqual({ type: 'BUYER', id: 'BUY-IT-005' });
  });

  it('tolerates empty rule arrays inside a hierarchy level', () => {
    const raw = {
      targetEntityType: 'BUYER',
      targetEntityId: 'BUY-IT-005',
      hierarchyLevels: [{ scope: 'BUYER', entityId: 'BUY-IT-005', entityName: 'X', rules: [] }],
      effectiveRules: [],
    };
    const out = compactEffective(raw);
    expect(out.hierarchy).toHaveLength(1);
    expect(out.hierarchy[0].rules).toEqual([]);
  });

  it('falls back to legacy entityType/entityId if targetEntity* are absent', () => {
    const raw = { entityType: 'BUYER', entityId: 'BUY-IT-005' };
    const out = compactEffective(raw);
    expect(out.entity).toEqual({ type: 'BUYER', id: 'BUY-IT-005' });
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
