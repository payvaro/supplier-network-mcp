# Config Rules Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `rules` MCP tool that lets users browse config rules by scope, resolve the effective rule stack for an entity, and explain why a buyer-supplier pair resolved the way it did.

**Architecture:** A single consolidated tool (`rules`) with three actions (`list`, `effective`, `trace`). Each action maps to exactly one existing Network API endpoint. Follows the repo's established patterns: Zod schema with `superRefine` for per-action required fields, admin-mode override via `resolveAdminScope` + `withClientIdOverride`, `NetworkAPIClient` singleton extended with three new methods, pure compact-format mappers in a dedicated service file with defensive fallback to raw shapes.

**Tech Stack:** TypeScript, Zod, Axios, Vitest, MCP SDK — all already in the project.

**Spec reference:** `docs/superpowers/specs/2026-04-18-config-rules-explorer-design.md`

---

## File Structure

**New files:**
- `src/tools/rules.ts` — `handleRules` dispatcher + three inner handler functions (`listRules`, `getEffectiveRules`, `traceDecision`).
- `src/tools/__tests__/rules.test.ts` — handler tests.
- `src/services/rules-formatter.ts` — pure compact-format mappers: `compactEffective`, `compactTrace`. Safe (defensive) against missing fields.
- `src/services/__tests__/rules-formatter.test.ts` — mapper tests with hand-built fixture JSON.

**Modified files:**
- `src/types.ts` — add lightweight TS types: `ConfigRule`, `ConfigRuleListResponse`, `EffectiveRuleResponse`, `DecisionTraceResponse`.
- `src/services/api-client.ts` — add three methods: `listConfigRules`, `getEffectiveRules`, `resolveIntegrationTrace`.
- `src/__mocks__/api-client.mock.ts` — add the three methods to the mock type and factory.
- `src/schemas/index.ts` — add `RulesToolSchema` + `RulesToolInput` type.
- `src/schemas/__tests__/schemas.test.ts` — add `RulesToolSchema` validation tests.
- `src/index.ts` — register `rules` in the `ListTools` descriptor and add a case to the `CallTool` switch.

---

## Task 1: Add TS types for config rules

**Files:**
- Modify: `src/types.ts` (append at end of file)

- [ ] **Step 1: Append config rule types**

Append to `src/types.ts`:

```typescript
// Config Rules (inferred from network OpenAPI — adjust if shapes diverge)
export interface ConfigRule {
  ruleId?: string;
  directiveType?: string;
  scopeType?: string;
  scopeId?: string;
  value?: unknown;
  status?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  // Permissive — the admin/list endpoint returns the raw DTO.
  [key: string]: unknown;
}

export interface ConfigRuleListResponse {
  rules?: ConfigRule[];
  items?: ConfigRule[];
  pagination?: PaginationInfo;
  [key: string]: unknown;
}

export interface EffectiveRuleResponse {
  entityType?: string;
  entityId?: string;
  directives?: unknown[];
  [key: string]: unknown;
}

export interface DecisionTraceResponse {
  buyerId?: string;
  supplierId?: string;
  resolved?: unknown;
  trace?: unknown;
  [key: string]: unknown;
}
```

Rationale: the exact DTO shapes will be verified at implementation time by hitting a local instance. Permissive index signatures keep the `full` passthrough working even if the real response has extra fields.

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(rules): add config rule TS types"
```

---

## Task 2: Add `listConfigRules` to NetworkAPIClient (TDD)

**Files:**
- Modify: `src/services/api-client.ts`
- Test: no dedicated api-client test file exists in this repo; coverage happens via tool-level tests. Skip direct client unit tests — matches the existing pattern (none of `listSuppliers`, `listBuyers` etc. have direct tests).

- [ ] **Step 1: Add method to NetworkAPIClient**

In `src/services/api-client.ts`, find the block of supplier list/get methods (around line 222) and insert this new method near the other list helpers (exact placement: after `getSupplierHistory`, before `listBuyers`):

```typescript
  /**
   * List config rules for a given scope (admin endpoint).
   * scopeType ∈ BUYER | SUPPLIER | BUYER_LINK | NETWORK_PARTNER | ACCEPTOR | PAYMENT_RAIL.
   */
  async listConfigRules(
    scopeType: string,
    scopeId: string,
    pageSize: number = 20,
    cursor?: string,
  ): Promise<import('../types.js').ConfigRuleListResponse> {
    try {
      const params: Record<string, unknown> = { scopeType, scopeId, pageSize };
      if (cursor) params.cursor = cursor;
      const response = await this.client.get<import('../types.js').ConfigRuleListResponse>(
        '/api/admin/config-rules',
        { params },
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/api-client.ts
git commit -m "feat(rules): add listConfigRules to NetworkAPIClient"
```

---

## Task 3: Add `getEffectiveRules` to NetworkAPIClient

**Files:**
- Modify: `src/services/api-client.ts`

- [ ] **Step 1: Add method**

Immediately after `listConfigRules` (from Task 2), add:

```typescript
  /**
   * Resolve the effective rule stack for a target entity by walking the
   * configuration hierarchy (entity → buyer-link → buyer → network-partner → global).
   */
  async getEffectiveRules(
    entityType: string,
    entityId: string,
  ): Promise<import('../types.js').EffectiveRuleResponse> {
    try {
      const response = await this.client.get<import('../types.js').EffectiveRuleResponse>(
        '/api/config-rules/effective',
        { params: { entityType, entityId } },
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/api-client.ts
git commit -m "feat(rules): add getEffectiveRules to NetworkAPIClient"
```

---

## Task 4: Add `resolveIntegrationTrace` to NetworkAPIClient

**Files:**
- Modify: `src/services/api-client.ts`

- [ ] **Step 1: Add method**

Immediately after `getEffectiveRules`, add:

```typescript
  /**
   * Resolve the best integration for a buyer-supplier pair, with includeTrace=true
   * so the caller gets the full decision trace (chosen path + eliminated alternatives).
   */
  async resolveIntegrationTrace(opts: {
    buyerId: string;
    supplierId: string;
    paymentType?: string;
    acceptorId?: string;
    requireClear?: boolean;
  }): Promise<import('../types.js').DecisionTraceResponse> {
    try {
      const params: Record<string, unknown> = {
        buyerId: opts.buyerId,
        supplierId: opts.supplierId,
        includeTrace: true,
      };
      if (opts.paymentType !== undefined) params.paymentType = opts.paymentType;
      if (opts.acceptorId !== undefined) params.acceptorId = opts.acceptorId;
      if (opts.requireClear !== undefined) params.requireClear = opts.requireClear;
      const response = await this.client.get<import('../types.js').DecisionTraceResponse>(
        '/api/analysis/payability/resolve',
        { params },
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/api-client.ts
git commit -m "feat(rules): add resolveIntegrationTrace to NetworkAPIClient"
```

---

## Task 5: Extend the mock API client

**Files:**
- Modify: `src/__mocks__/api-client.mock.ts`

- [ ] **Step 1: Add the three methods to the mock type**

In `src/__mocks__/api-client.mock.ts`, import the new response types near the top alongside the existing imports:

```typescript
import type {
  Supplier, Buyer, BuyerLink, AggregatorLink, FileImportJob,
  MatchingJob, MatchCandidate, StagedMatch, PaginatedResponse,
  ConfigRuleListResponse, EffectiveRuleResponse, DecisionTraceResponse,
} from '../types.js';
```

Then in the `MockNetworkAPIClient` interface (right after the `listAggregatorLinks` line), add:

```typescript
  listConfigRules: Mock<(
    scopeType: string,
    scopeId: string,
    pageSize?: number,
    cursor?: string,
  ) => Promise<ConfigRuleListResponse>>;
  getEffectiveRules: Mock<(
    entityType: string,
    entityId: string,
  ) => Promise<EffectiveRuleResponse>>;
  resolveIntegrationTrace: Mock<(opts: {
    buyerId: string;
    supplierId: string;
    paymentType?: string;
    acceptorId?: string;
    requireClear?: boolean;
  }) => Promise<DecisionTraceResponse>>;
```

And in `createMockNetworkAPIClient`'s object literal, after `listAggregatorLinks: vi.fn(),`, add:

```typescript
    // Config rules
    listConfigRules: vi.fn(),
    getEffectiveRules: vi.fn(),
    resolveIntegrationTrace: vi.fn(),
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/__mocks__/api-client.mock.ts
git commit -m "test(rules): extend mock client with config-rule methods"
```

---

## Task 6: Add `RulesToolSchema` and input type (TDD)

**Files:**
- Modify: `src/schemas/index.ts`
- Test: `src/schemas/__tests__/schemas.test.ts`

- [ ] **Step 1: Write failing schema tests**

In `src/schemas/__tests__/schemas.test.ts`, append a new describe block at the end of the file:

```typescript
describe('RulesToolSchema', () => {
  // Import will succeed once Step 2 adds the export.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { RulesToolSchema } = require('../index.js') as typeof import('../index.js');

  it('accepts a valid list request', () => {
    const result = RulesToolSchema.safeParse({
      action: 'list',
      scopeType: 'BUYER',
      scopeId: 'BUY-IT-001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects list without scopeType+scopeId', () => {
    const result = RulesToolSchema.safeParse({ action: 'list' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid effective request', () => {
    const result = RulesToolSchema.safeParse({
      action: 'effective',
      entityType: 'BUYER',
      entityId: 'BUY-IT-001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects effective without entityType+entityId', () => {
    const result = RulesToolSchema.safeParse({ action: 'effective' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid trace request', () => {
    const result = RulesToolSchema.safeParse({
      action: 'trace',
      buyerId: 'BUY-IT-001',
      supplierId: 'SUP-IT-001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects trace missing buyerId', () => {
    const result = RulesToolSchema.safeParse({ action: 'trace', supplierId: 'SUP-IT-001' });
    expect(result.success).toBe(false);
  });

  it('defaults format to "compact"', () => {
    const result = RulesToolSchema.safeParse({
      action: 'effective',
      entityType: 'BUYER',
      entityId: 'BUY-IT-001',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.format).toBe('compact');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- schemas`
Expected: 7 failing tests (RulesToolSchema not exported).

- [ ] **Step 3: Add the schema**

In `src/schemas/index.ts`, find `MatchingToolSchema` (around line 482) and add `RulesToolSchema` immediately after it (before any analysis/notify schemas):

```typescript
export const RulesToolSchema = z.object({
  action: z.enum(["list", "effective", "trace"]),

  // list
  scopeType: z.enum([
    "BUYER", "SUPPLIER", "BUYER_LINK",
    "NETWORK_PARTNER", "ACCEPTOR", "PAYMENT_RAIL",
  ]).optional(),
  scopeId: z.string().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),

  // effective
  entityType: z.enum([
    "SUPPLIER", "BUYER", "BUYER_LINK", "NETWORK_PARTNER", "AGGREGATOR",
  ]).optional(),
  entityId: z.string().min(1).optional(),

  // trace
  buyerId: z.string().min(1).optional(),
  supplierId: z.string().min(1).optional(),
  paymentType: z.string().optional(),
  acceptorId: z.string().optional(),
  requireClear: z.boolean().optional(),

  // universal
  format: z.enum(["compact", "full"]).default("compact"),
  asClientId: AsClientIdField,
  asClientName: AsClientNameField,
}).refine(
  (data) => {
    if (data.action === 'list'      && (!data.scopeType  || !data.scopeId))  return false;
    if (data.action === 'effective' && (!data.entityType || !data.entityId)) return false;
    if (data.action === 'trace'     && (!data.buyerId    || !data.supplierId)) return false;
    return true;
  },
  (data) => {
    if (data.action === 'list')
      return { message: "The 'list' action requires 'scopeType' and 'scopeId'." };
    if (data.action === 'effective')
      return { message: "The 'effective' action requires 'entityType' and 'entityId'." };
    if (data.action === 'trace')
      return { message: "The 'trace' action requires 'buyerId' and 'supplierId'." };
    return { message: 'Validation failed' };
  },
);
```

Also add the inferred type alongside the other consolidated type exports (find the `// Consolidated type exports` block near line 551):

```typescript
export type RulesToolInput = z.infer<typeof RulesToolSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- schemas`
Expected: all 7 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/index.ts src/schemas/__tests__/schemas.test.ts
git commit -m "feat(rules): add RulesToolSchema with per-action validation"
```

---

## Task 7: Compact `effective` mapper (TDD)

**Files:**
- Create: `src/services/rules-formatter.ts`
- Test: `src/services/__tests__/rules-formatter.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/services/__tests__/rules-formatter.test.ts`:

```typescript
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
    // No directives → empty array, not a crash.
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- rules-formatter`
Expected: FAIL with "cannot find module" or "compactEffective is not a function".

- [ ] **Step 3: Implement `compactEffective`**

Create `src/services/rules-formatter.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- rules-formatter`
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/rules-formatter.ts src/services/__tests__/rules-formatter.test.ts
git commit -m "feat(rules): add compactEffective mapper"
```

---

## Task 8: Compact `trace` mapper (TDD)

**Files:**
- Modify: `src/services/rules-formatter.ts`
- Modify: `src/services/__tests__/rules-formatter.test.ts`

- [ ] **Step 1: Write failing test**

Append to `src/services/__tests__/rules-formatter.test.ts`:

```typescript
import { compactTrace } from '../rules-formatter.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- rules-formatter`
Expected: FAIL with "compactTrace is not a function".

- [ ] **Step 3: Implement `compactTrace`**

Append to `src/services/rules-formatter.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify all rules-formatter tests pass**

Run: `npm test -- rules-formatter`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/rules-formatter.ts src/services/__tests__/rules-formatter.test.ts
git commit -m "feat(rules): add compactTrace mapper"
```

---

## Task 9: Implement `rules.ts` tool (TDD — list)

**Files:**
- Create: `src/tools/rules.ts`
- Test: `src/tools/__tests__/rules.test.ts`

- [ ] **Step 1: Write failing test for list (compact)**

Create `src/tools/__tests__/rules.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleRules } from '../rules.js';
import { createMockNetworkAPIClient, type MockNetworkAPIClient } from '../../__mocks__/api-client.mock.js';

vi.mock('../../services/api-client.js', () => ({
  getNetworkAPIClient: vi.fn(),
}));

import { getNetworkAPIClient } from '../../services/api-client.js';

describe('rules tool', () => {
  let mockClient: MockNetworkAPIClient;

  beforeEach(() => {
    mockClient = createMockNetworkAPIClient();
    vi.mocked(getNetworkAPIClient).mockReturnValue(mockClient as never);
  });

  describe('action: list', () => {
    it('calls listConfigRules with scopeType+scopeId and returns rules', async () => {
      mockClient.listConfigRules.mockResolvedValue({
        items: [{ ruleId: 'r-1', directiveType: 'NETTING', scopeType: 'BUYER', scopeId: 'BUY-1' }],
        pagination: { count: 1, pageSize: 20, hasMore: false, nextCursor: null },
      });

      const result = await handleRules({
        action: 'list',
        scopeType: 'BUYER',
        scopeId: 'BUY-1',
        pageSize: 20,
        format: 'compact',
      });

      expect(mockClient.listConfigRules).toHaveBeenCalledWith('BUYER', 'BUY-1', 20, undefined);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('r-1');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tools/__tests__/rules`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Create `rules.ts` with the `list` path**

Create `src/tools/rules.ts`:

```typescript
import { getNetworkAPIClient, NetworkAPIClient } from '../services/api-client.js';
import { resolveAdminScope, isAdminScopeRejection } from '../services/admin-scope.js';
import { createActionableError } from '../errors.js';
import { compactEffective, compactTrace } from '../services/rules-formatter.js';
import type { RulesToolInput } from '../schemas/index.js';

async function listRules(
  params: RulesToolInput,
  clientOverride?: NetworkAPIClient,
) {
  const client = clientOverride ?? getNetworkAPIClient();
  const response = await client.listConfigRules(
    params.scopeType!,
    params.scopeId!,
    params.pageSize,
    params.cursor,
  );
  // list: compact === full (already flat)
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }],
    structuredContent: response as Record<string, unknown>,
  };
}

async function effectiveRules(
  params: RulesToolInput,
  clientOverride?: NetworkAPIClient,
) {
  const client = clientOverride ?? getNetworkAPIClient();
  const raw = await client.getEffectiveRules(params.entityType!, params.entityId!);
  const payload = params.format === 'full' ? raw : compactEffective(raw);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

async function traceDecision(
  params: RulesToolInput,
  clientOverride?: NetworkAPIClient,
) {
  const client = clientOverride ?? getNetworkAPIClient();
  const raw = await client.resolveIntegrationTrace({
    buyerId: params.buyerId!,
    supplierId: params.supplierId!,
    paymentType: params.paymentType,
    acceptorId: params.acceptorId,
    requireClear: params.requireClear,
  });
  const payload = params.format === 'full' ? raw : compactTrace(raw);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

export async function handleRules(params: RulesToolInput) {
  try {
    const scope = await resolveAdminScope(params, 'rules');
    if (isAdminScopeRejection(scope)) return scope;
    const scopedClient = scope.clientId
      ? getNetworkAPIClient().withClientIdOverride(scope.clientId)
      : undefined;

    switch (params.action) {
      case 'list':      return await listRules(params, scopedClient);
      case 'effective': return await effectiveRules(params, scopedClient);
      case 'trace':     return await traceDecision(params, scopedClient);
      default:
        return {
          isError: true,
          content: [{
            type: 'text' as const,
            text: `❌ Error: Unknown action '${(params as { action: string }).action}'.`,
          }],
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: 'text' as const,
        text: createActionableError(
          error instanceof Error ? error : String(error),
          'rules',
          params.action,
          params as Record<string, unknown>,
        ).text,
      }],
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tools/__tests__/rules`
Expected: the one `list` test passes.

- [ ] **Step 5: Commit**

```bash
git add src/tools/rules.ts src/tools/__tests__/rules.test.ts
git commit -m "feat(rules): implement rules tool with list action"
```

---

## Task 10: Tests for `effective` action

**Files:**
- Modify: `src/tools/__tests__/rules.test.ts`

- [ ] **Step 1: Append effective tests**

Append inside the outer `describe('rules tool', …)` block, right after the `action: list` block:

```typescript
  describe('action: effective', () => {
    const rawEffective = {
      entityType: 'BUYER',
      entityId: 'BUY-IT-001',
      directives: [
        {
          directiveType: 'NETTING',
          effectiveRule: { ruleId: 'r-123', scopeType: 'BUYER', scopeId: 'BUY-IT-001', value: 'ENABLED' },
          contributingSources: [
            { level: 'BUYER', ruleId: 'r-123', value: 'ENABLED', applied: true },
          ],
        },
      ],
    };

    it('returns compact shape by default', async () => {
      mockClient.getEffectiveRules.mockResolvedValue(rawEffective);

      const result = await handleRules({
        action: 'effective',
        entityType: 'BUYER',
        entityId: 'BUY-IT-001',
        pageSize: 20,
        format: 'compact',
      });

      expect(mockClient.getEffectiveRules).toHaveBeenCalledWith('BUYER', 'BUY-IT-001');
      expect(result.structuredContent).toMatchObject({
        entity: { type: 'BUYER', id: 'BUY-IT-001' },
      });
      expect(result.structuredContent?.directives).toBeInstanceOf(Array);
    });

    it('returns raw shape when format=full', async () => {
      mockClient.getEffectiveRules.mockResolvedValue(rawEffective);

      const result = await handleRules({
        action: 'effective',
        entityType: 'BUYER',
        entityId: 'BUY-IT-001',
        pageSize: 20,
        format: 'full',
      });

      expect(result.structuredContent).toEqual(rawEffective);
    });

    it('surfaces 404 from API with actionable error text', async () => {
      mockClient.getEffectiveRules.mockRejectedValue(
        new Error('Request failed with status code 404'),
      );

      const result = await handleRules({
        action: 'effective',
        entityType: 'BUYER',
        entityId: 'missing',
        pageSize: 20,
        format: 'compact',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('404');
    });
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- tools/__tests__/rules`
Expected: 4 tests pass (1 list + 3 effective).

- [ ] **Step 3: Commit**

```bash
git add src/tools/__tests__/rules.test.ts
git commit -m "test(rules): cover effective action compact/full/error paths"
```

---

## Task 11: Tests for `trace` action

**Files:**
- Modify: `src/tools/__tests__/rules.test.ts`

- [ ] **Step 1: Append trace tests**

Append inside `describe('rules tool', …)`, right after the `action: effective` block:

```typescript
  describe('action: trace', () => {
    const rawTrace = {
      buyerId: 'BUY-1',
      supplierId: 'SUP-1',
      resolved: { acceptorId: 'ACC-1', paymentType: 'CARD' },
      trace: {
        chosenPath: [{ step: 'acceptor-selection', outcome: 'WEX wins', ruleId: 'r-612' }],
        eliminated: [{ acceptorId: 'ACC-2', reason: 'require-clear failed', ruleId: 'r-555' }],
      },
    };

    it('passes optional filters through to the client and returns compact shape', async () => {
      mockClient.resolveIntegrationTrace.mockResolvedValue(rawTrace);

      const result = await handleRules({
        action: 'trace',
        buyerId: 'BUY-1',
        supplierId: 'SUP-1',
        paymentType: 'CARD',
        acceptorId: 'ACC-1',
        requireClear: true,
        pageSize: 20,
        format: 'compact',
      });

      expect(mockClient.resolveIntegrationTrace).toHaveBeenCalledWith({
        buyerId: 'BUY-1',
        supplierId: 'SUP-1',
        paymentType: 'CARD',
        acceptorId: 'ACC-1',
        requireClear: true,
      });
      expect(result.structuredContent).toMatchObject({
        pair: { buyerId: 'BUY-1', supplierId: 'SUP-1' },
      });
      expect(result.structuredContent?.chosenPath).toHaveLength(1);
      expect(result.structuredContent?.eliminated).toHaveLength(1);
    });

    it('returns raw shape when format=full', async () => {
      mockClient.resolveIntegrationTrace.mockResolvedValue(rawTrace);

      const result = await handleRules({
        action: 'trace',
        buyerId: 'BUY-1',
        supplierId: 'SUP-1',
        pageSize: 20,
        format: 'full',
      });

      expect(result.structuredContent).toEqual(rawTrace);
    });

    it('surfaces API errors', async () => {
      mockClient.resolveIntegrationTrace.mockRejectedValue(
        new Error('Request failed with status code 500'),
      );

      const result = await handleRules({
        action: 'trace',
        buyerId: 'BUY-1',
        supplierId: 'SUP-1',
        pageSize: 20,
        format: 'compact',
      });

      expect(result.isError).toBe(true);
    });
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- tools/__tests__/rules`
Expected: 7 tests pass (1 list + 3 effective + 3 trace).

- [ ] **Step 3: Commit**

```bash
git add src/tools/__tests__/rules.test.ts
git commit -m "test(rules): cover trace action compact/full/error paths"
```

---

## Task 12: Admin-override tests for `handleRules`

**Files:**
- Modify: `src/tools/__tests__/rules.test.ts`

- [ ] **Step 1: Append admin-override tests**

Append inside `describe('rules tool', …)`, as the last nested block:

```typescript
  describe('handleRules admin override (asClientId)', () => {
    const ORIG = process.env.NETWORK_ADMIN_MODE;
    afterEach(() => {
      if (ORIG === undefined) delete process.env.NETWORK_ADMIN_MODE;
      else process.env.NETWORK_ADMIN_MODE = ORIG;
    });

    it('rejects asClientId when admin mode is disabled', async () => {
      delete process.env.NETWORK_ADMIN_MODE;

      const result = await handleRules({
        action: 'list',
        scopeType: 'BUYER',
        scopeId: 'BUY-1',
        pageSize: 20,
        format: 'compact',
        asClientId: 'client-abc',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('NETWORK_ADMIN_MODE=true');
      expect(mockClient.withClientIdOverride).not.toHaveBeenCalled();
      expect(mockClient.listConfigRules).not.toHaveBeenCalled();
    });

    it('invokes withClientIdOverride and dispatches when admin mode is enabled', async () => {
      process.env.NETWORK_ADMIN_MODE = 'true';
      mockClient.listConfigRules.mockResolvedValue({ items: [], pagination: { count: 0, pageSize: 20, hasMore: false, nextCursor: null } });

      const result = await handleRules({
        action: 'list',
        scopeType: 'BUYER',
        scopeId: 'BUY-1',
        pageSize: 20,
        format: 'compact',
        asClientId: 'client-abc',
      });

      expect(mockClient.withClientIdOverride).toHaveBeenCalledWith('client-abc');
      expect(mockClient.listConfigRules).toHaveBeenCalled();
      expect(result.isError).toBeUndefined();
    });

    it('does not invoke withClientIdOverride when asClientId is omitted', async () => {
      process.env.NETWORK_ADMIN_MODE = 'true';
      mockClient.listConfigRules.mockResolvedValue({ items: [], pagination: { count: 0, pageSize: 20, hasMore: false, nextCursor: null } });

      await handleRules({
        action: 'list',
        scopeType: 'BUYER',
        scopeId: 'BUY-1',
        pageSize: 20,
        format: 'compact',
      });

      expect(mockClient.withClientIdOverride).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run full suite**

Run: `npm test`
Expected: all tests pass, including the 3 new admin-override tests (10 rules tests total).

- [ ] **Step 3: Commit**

```bash
git add src/tools/__tests__/rules.test.ts
git commit -m "test(rules): cover admin-mode override dispatch"
```

---

## Task 13: Register the `rules` tool in the server

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Import schema and handler**

In `src/index.ts`, extend the schemas import block (around line 13–23) to include `RulesToolSchema`:

```typescript
import {
  SearchToolSchema,
  SuppliersToolSchema,
  BuyersToolSchema,
  RelationshipsToolSchema,
  ImportsToolSchema,
  MatchingToolSchema,
  AnalyzeToolSchema,
  NotifySlackToolSchema,
  LookupClientToolSchema,
  RulesToolSchema,
} from "./schemas/index.js";
```

Add a new import line for the handler, after the existing tool-handler imports (around line 32):

```typescript
import { handleRules } from "./tools/rules.js";
```

- [ ] **Step 2: Add the tool descriptor to ListTools**

Find the array returned by `server.setRequestHandler(ListToolsRequestSchema, …)` (the tool list). Insert a new entry immediately after the `matching` tool block (around line 400, before `analyze`):

```typescript
        {
          name: "rules",
          description:
            "Explore config rules across the hierarchy. Use when the user asks what rules exist for a buyer/supplier/scope, which rule wins for an entity, or why a buyer-supplier pair resolves to a specific integration.\n\nActions:\n- `list` — Browse config rules for a scope (requires `scopeType` + `scopeId`; scopes: BUYER, SUPPLIER, BUYER_LINK, NETWORK_PARTNER, ACCEPTOR, PAYMENT_RAIL). Paginated.\n- `effective` — Resolve the effective rule stack for an entity, with the hierarchy trace (requires `entityType` + `entityId`; entity types: SUPPLIER, BUYER, BUYER_LINK, NETWORK_PARTNER, AGGREGATOR).\n- `trace` — Explain why a buyer-supplier pair resolves to a particular acceptor/integration (requires `buyerId` + `supplierId`; optional: `paymentType`, `acceptorId`, `requireClear`).\n\n`format: \"compact\"` (default) returns a collapsed shape optimized for readability; `format: \"full\"` returns the raw API response.",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["list", "effective", "trace"],
                description: "The action to perform",
              },
              scopeType: {
                type: "string",
                enum: ["BUYER", "SUPPLIER", "BUYER_LINK", "NETWORK_PARTNER", "ACCEPTOR", "PAYMENT_RAIL"],
                description: "Scope entity type (for list)",
              },
              scopeId: {
                type: "string",
                description: "Scope entity id (for list)",
              },
              pageSize: {
                type: "number",
                description: "Page size for list (1-100)",
                default: 20,
                minimum: 1,
                maximum: 100,
              },
              cursor: {
                type: "string",
                description: "Pagination cursor for list",
              },
              entityType: {
                type: "string",
                enum: ["SUPPLIER", "BUYER", "BUYER_LINK", "NETWORK_PARTNER", "AGGREGATOR"],
                description: "Entity type (for effective)",
              },
              entityId: {
                type: "string",
                description: "Entity id (for effective)",
              },
              buyerId: {
                type: "string",
                description: "Buyer id (for trace)",
              },
              supplierId: {
                type: "string",
                description: "Supplier id (for trace)",
              },
              paymentType: {
                type: "string",
                description: "Preferred payment type (for trace)",
              },
              acceptorId: {
                type: "string",
                description: "Preferred acceptor id (for trace)",
              },
              requireClear: {
                type: "boolean",
                description: "Require clear guard status (for trace)",
              },
              format: {
                type: "string",
                enum: ["compact", "full"],
                description: "Output format (default compact)",
                default: "compact",
              },
              asClientId: asClientIdProperty,
              asClientName: asClientNameProperty,
            },
            required: ["action"],
          },
        },
```

- [ ] **Step 3: Add case to CallTool switch**

In the `server.setRequestHandler(CallToolRequestSchema, …)` switch (around line 624), add a new case immediately after the `matching` case:

```typescript
        case "rules": {
          const params = RulesToolSchema.parse(args);
          response = await handleRules(params);
          break;
        }
```

- [ ] **Step 4: Build and run full suite**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat(rules): register rules tool on the MCP server"
```

---

## Task 14: Manual smoke test against a local Network API

**Files:** none — verification only.

Automated integration tests are not part of this repo (consistent with the rest of the MCP). Do a manual smoke test against a running Network API before merging.

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 2: Start in HTTP mode against local network**

Run (in a separate terminal, with the `network` service already running via Overmind per the workspace CLAUDE.md):

```bash
NETWORK_API_KEY=<dev-key> \
NETWORK_API_BASE_URL=http://localhost:8080 \
NETWORK_CLIENT_ID=<dev-client-uuid> \
npm run start:http
```

Expected: server logs "listening" on port 3000.

- [ ] **Step 3: Call each action**

In a third terminal, issue three MCP tool calls via curl or the inspector. Example payloads:

```json
{ "action": "list", "scopeType": "BUYER", "scopeId": "BUY-IT-005" }
```

```json
{ "action": "effective", "entityType": "BUYER", "entityId": "BUY-IT-005" }
```

```json
{ "action": "trace", "buyerId": "BUY-IT-005", "supplierId": "SUP-IT-005" }
```

Expected: each returns a non-error response. Confirm `effective` produces a sensible `directives` array and `trace` produces `chosenPath`/`eliminated` entries. If the DTO shapes differ from the spec inference, note the drift — see Task 15.

- [ ] **Step 4: Compare compact vs full**

Re-issue the `effective` and `trace` calls with `"format": "full"` and verify the raw API shape comes through unchanged.

---

## Task 15: Reconcile compact mappers with real API shapes (contingent)

Only do this task if Task 14 Step 3 reveals that the real API fields differ from the names assumed in `compactEffective` / `compactTrace`.

**Files:**
- Modify: `src/services/rules-formatter.ts`
- Modify: `src/services/__tests__/rules-formatter.test.ts`

- [ ] **Step 1: Update fixture tests**

Replace the hand-built fixtures in `src/services/__tests__/rules-formatter.test.ts` with captures from the real API (Task 14 output), then adjust assertions to the new field names.

- [ ] **Step 2: Update mappers**

In `src/services/rules-formatter.ts`, rename/adjust the field accesses in `compactEffective` and/or `compactTrace` so the updated tests pass. Keep the defensive `asRecord`/`asArray` pattern — each section falls through to empty when the expected field is missing.

- [ ] **Step 3: Re-run full suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/services/rules-formatter.ts src/services/__tests__/rules-formatter.test.ts
git commit -m "fix(rules): align compact mappers with real API response shapes"
```

---

## Self-review

**Spec coverage:**
- C / Discovery — `list` action (Task 2, 6, 9), `effective` action (Task 3, 6, 10). ✓
- A / Debug — `trace` action (Task 4, 6, 11) + hierarchy trace in `effective`. ✓
- Admin-mode override — wired via `resolveAdminScope` in `handleRules` (Task 9) and tested (Task 12). ✓
- Compact / full dual format — default compact, escape hatch to full (Task 9, 10, 11). ✓
- Output-format fallback on DTO drift — defensive `asRecord`/`asArray` in mappers (Tasks 7, 8), plus Task 15 as a contingent reconciliation step. ✓
- No live-API integration tests — Task 14 covers manual smoke verification. ✓
- B / Simulation — explicitly deferred in spec; not in plan. ✓

**Placeholder scan:** no TBD/TODO/"implement later" strings. All steps carry exact code, commands, and expected outcomes.

**Type consistency:** `RulesToolInput` is consumed identically in `handleRules` and in the inner functions. `compactEffective` / `compactTrace` names match between definition (Tasks 7–8) and import (Task 9). Mock client methods (`listConfigRules`, `getEffectiveRules`, `resolveIntegrationTrace`) match the real client methods added in Tasks 2–4 and the usages in Tasks 9–12. `RulesToolSchema` import in `src/index.ts` (Task 13) matches the export name added in Task 6.
