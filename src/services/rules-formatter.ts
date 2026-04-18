import type { EffectiveRuleResponse, DecisionTraceResponse } from '../types.js';

function asRecord(x: unknown): Record<string, unknown> | undefined {
  return x && typeof x === 'object' ? (x as Record<string, unknown>) : undefined;
}

function asArray(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}

function asStringArray(x: unknown): string[] {
  return asArray(x).filter((s): s is string => typeof s === 'string');
}

// ---- effective ----
//
// Real API shape (EffectiveRuleResponseDto):
//   targetEntityType, targetEntityId,
//   hierarchyLevels[]: { scope, entityId, entityName, rules: ConfigRuleDto[] }
//   effectiveRules[]:  { ruleType, ruleKey, effectiveValue, mergeStrategy,
//                        contributingRuleIds[], explanation }

export interface CompactEffectiveRule {
  configRuleId?: string;
  ruleType?: string;
  ruleKey?: string;
  ruleValue?: string;
  status?: string;
  params?: unknown;
}

export interface CompactHierarchyLevel {
  scope?: string;
  entityId?: string;
  entityName?: string;
  rules: CompactEffectiveRule[];
}

export interface CompactEffectiveSummary {
  ruleType?: string;
  ruleKey?: string;
  effectiveValue?: string;
  mergeStrategy?: string;
  explanation?: string;
  contributingRuleIds: string[];
}

export interface CompactEffectiveResult {
  entity: { type?: string; id?: string };
  effective: CompactEffectiveSummary[];
  hierarchy: CompactHierarchyLevel[];
}

function compactRule(r: unknown): CompactEffectiveRule {
  const rec = asRecord(r) ?? {};
  return {
    configRuleId: rec.configRuleId as string | undefined,
    ruleType: rec.ruleType as string | undefined,
    ruleKey: rec.ruleKey as string | undefined,
    ruleValue: rec.ruleValue as string | undefined,
    status: rec.status as string | undefined,
    params: rec.params,
  };
}

export function compactEffective(raw: EffectiveRuleResponse): CompactEffectiveResult {
  const entityType =
    (raw.targetEntityType as string | undefined) ?? (raw.entityType as string | undefined);
  const entityId =
    (raw.targetEntityId as string | undefined) ?? (raw.entityId as string | undefined);

  const hierarchy = asArray(raw.hierarchyLevels).map((level): CompactHierarchyLevel => {
    const rec = asRecord(level) ?? {};
    return {
      scope: rec.scope as string | undefined,
      entityId: rec.entityId as string | undefined,
      entityName: rec.entityName as string | undefined,
      rules: asArray(rec.rules).map(compactRule),
    };
  });

  const effective = asArray(raw.effectiveRules).map((r): CompactEffectiveSummary => {
    const rec = asRecord(r) ?? {};
    return {
      ruleType: rec.ruleType as string | undefined,
      ruleKey: rec.ruleKey as string | undefined,
      effectiveValue: rec.effectiveValue as string | undefined,
      mergeStrategy: rec.mergeStrategy as string | undefined,
      explanation: rec.explanation as string | undefined,
      contributingRuleIds: asStringArray(rec.contributingRuleIds),
    };
  });

  return {
    entity: { type: entityType, id: entityId },
    effective,
    hierarchy,
  };
}

// ---- trace ----
//
// Shape not yet verified against the real API — the payability/resolve endpoint
// returned a 500 during smoke testing and the DTO was inferred from class names.
// Keeps the same defensive passthrough style: unknown fields fall through to
// empty arrays rather than throwing.

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
