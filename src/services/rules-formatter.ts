import type { EffectiveRuleResponse, DecisionTraceResponse } from '../types.js';

// ---- effective ----

export interface CompactEffectiveSource extends Record<string, unknown> {
  level?: string;
  ruleId?: string;
  value?: unknown;
  applied?: boolean;
  reason?: string;
}

export interface CompactEffectiveDirective {
  directiveType?: string;
  winner?: {
    ruleId?: string;
    scopeType?: string;
    scopeId?: string;
    value?: unknown;
  };
  contributingSources: CompactEffectiveSource[];
}

export interface CompactEffectiveResult {
  entity: { type?: string; id?: string };
  directives: CompactEffectiveDirective[];
}

function asRecord(x: unknown): Record<string, unknown> | undefined {
  return x && typeof x === 'object' ? (x as Record<string, unknown>) : undefined;
}

function asArray(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}

export function compactEffective(raw: EffectiveRuleResponse): CompactEffectiveResult {
  const directives = asArray(raw.directives).map((d): CompactEffectiveDirective => {
    const dr = asRecord(d) ?? {};
    const winnerRaw = asRecord(dr.effectiveRule) ?? asRecord(dr.winner);
    const winner = winnerRaw
      ? {
          ruleId: winnerRaw.ruleId as string | undefined,
          scopeType: winnerRaw.scopeType as string | undefined,
          scopeId: winnerRaw.scopeId as string | undefined,
          value: winnerRaw.value,
        }
      : undefined;
    const sources = asArray(dr.contributingSources).map((s) => {
      const sr = asRecord(s) ?? {};
      return { ...sr } as CompactEffectiveSource;
    });
    return {
      directiveType: dr.directiveType as string | undefined,
      winner,
      contributingSources: sources,
    };
  });

  return {
    entity: {
      type: raw.entityType,
      id: raw.entityId,
    },
    directives,
  };
}

// ---- trace ----

export interface CompactTraceStep extends Record<string, unknown> {
  step?: string;
  outcome?: string;
  ruleId?: string;
}

export interface CompactTraceEliminated extends Record<string, unknown> {
  acceptorId?: string;
  reason?: string;
  ruleId?: string;
}

export interface CompactTraceResult {
  pair: { buyerId?: string; supplierId?: string };
  resolved: Record<string, unknown> | undefined;
  chosenPath: CompactTraceStep[];
  eliminated: CompactTraceEliminated[];
}

export function compactTrace(raw: DecisionTraceResponse): CompactTraceResult {
  const trace = asRecord(raw.trace) ?? {};
  const chosenPath = asArray(trace.chosenPath).map((s) => ({ ...(asRecord(s) ?? {}) }));
  const eliminated = asArray(trace.eliminated ?? trace.eliminatedPaths).map(
    (s) => ({ ...(asRecord(s) ?? {}) }),
  );

  return {
    pair: { buyerId: raw.buyerId, supplierId: raw.supplierId },
    resolved: asRecord(raw.resolved),
    chosenPath,
    eliminated,
  };
}
