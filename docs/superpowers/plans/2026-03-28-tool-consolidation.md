# Tool Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 25 MCP tools into 9 intent-based tools with improved descriptions, schemas, and error handling.

**Architecture:** Each consolidated tool gets: (1) a new Zod schema with `action` discriminator + flat params, (2) a dispatch function that validates the action and delegates to existing implementation functions, (3) updated tool registration in `index.ts`. Existing service-layer functions (`searchSuppliers`, `listSuppliers`, etc.) are kept as-is internally — the dispatch wrapper handles the new schema shape and passes `ResponseFormat.MARKDOWN` since `response_format` is removed from tool schemas.

**Tech Stack:** TypeScript, Zod, MCP SDK, Vitest

**Spec:** `docs/superpowers/specs/2026-03-28-tool-consolidation-design.md`

---

## File Structure

### New files
- `src/tools/relationships.ts` — dispatch wrapper for the `relationships` consolidated tool
- `src/tools/imports.ts` — dispatch wrapper for the `imports` consolidated tool
- `src/tools/matching.ts` — dispatch wrapper for the `matching` consolidated tool
- `src/tools/__tests__/relationships.test.ts` — tests for relationships dispatcher
- `src/tools/__tests__/imports.test.ts` — tests for imports dispatcher
- `src/tools/__tests__/matching.test.ts` — tests for matching dispatcher
- `src/errors.ts` — actionable error helper with cross-tool hints

### Modified files
- `src/schemas/index.ts` — replace 23 schemas with 9 consolidated schemas (keep old schemas as internal exports for existing functions)
- `src/tools/suppliers.ts` — add `handleSuppliers()` dispatch wrapper, keep existing functions
- `src/tools/buyers.ts` — add `handleBuyers()` dispatch wrapper, merge `getBuyerByClientId` into `get` action
- `src/tools/analysis.ts` — add `handleAnalyze()` and `handleNotifySlack()` dispatch wrappers
- `src/tools/clients.ts` — no code changes needed (schema rename only)
- `src/index.ts` — rewrite tool registration (ListTools + CallTools handlers)
- `src/tools/__tests__/suppliers.test.ts` — add tests for dispatch wrapper
- `src/tools/__tests__/buyers.test.ts` — add tests for dispatch wrapper
- `src/tools/__tests__/analysis.test.ts` — add tests for dispatch wrappers
- `src/schemas/__tests__/schemas.test.ts` — update tests for new consolidated schemas
- `README.md` — update tool reference

### Unchanged files
- `src/services/*` — all service-layer files stay untouched
- `src/types.ts` — no changes
- `src/constants.ts` — no changes
- `src/prompts/*` — no changes

---

## Task 1: Create actionable error helper

**Files:**
- Create: `src/errors.ts`
- Create: `src/errors.test.ts`

This is a foundational utility used by all subsequent tasks.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createActionableError, createValidationError } from '../errors.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/errors.test.ts`
Expected: FAIL — `Cannot find module '../errors.js'`

- [ ] **Step 3: Write implementation**

Create `src/errors.ts`:

```typescript
interface ActionableErrorResult {
  text: string;
  isError: true;
}

const HTTP_STATUS_PATTERNS: Record<string, (tool: string, action?: string, params?: Record<string, unknown>) => string> = {
  '404': (tool, action, params) => {
    const hints = get404Hints(tool, action, params);
    return `Not found. ${hints}`;
  },
  '401': () => 'Authentication failed. Check that NETWORK_API_KEY is set and valid.',
  '400': (tool, action) => `Invalid request. Check parameter format for the '${action}' action and try again.`,
  '403': () => 'Access denied. The API key may not have permission for this operation.',
  '409': (tool, action, params) => {
    if (tool === 'relationships' && action === 'link') {
      return 'Link already exists between this buyer and supplier.';
    }
    return 'Conflict — this resource already exists or conflicts with existing data.';
  },
};

function get404Hints(tool: string, action?: string, params?: Record<string, unknown>): string {
  const id = params?.id || params?.jobId || params?.buyerId || params?.supplierId;
  const idStr = id ? ` with ID '${id}'` : '';

  switch (tool) {
    case 'suppliers':
      return `Supplier not found${idStr}. Try using the search tool to find the supplier by name.`;
    case 'buyers':
      return `Buyer not found${idStr}. Try lookup_client to find the client ID by name, or use buyers with action 'list' to browse all buyers.`;
    case 'matching':
      return `Matching job not found${idStr}. Use matching with action 'jobs' to list available jobs.`;
    case 'relationships':
      return `Relationship not found${idStr}. Check that the buyer and supplier IDs are correct.`;
    case 'imports':
      return `Import batch not found${idStr}. Use imports with action 'batches' to list recent imports.`;
    default:
      return `Resource not found${idStr}.`;
  }
}

function extractStatusCode(message: string): string | null {
  const match = message.match(/status code (\d{3})/);
  return match ? match[1] : null;
}

export function createActionableError(
  error: Error | string,
  tool: string,
  action?: string,
  params?: Record<string, unknown>
): ActionableErrorResult {
  const message = error instanceof Error ? error.message : error;
  const statusCode = extractStatusCode(message);

  let enrichedMessage: string;

  if (statusCode && HTTP_STATUS_PATTERNS[statusCode]) {
    enrichedMessage = HTTP_STATUS_PATTERNS[statusCode](tool, action, params);
  } else {
    enrichedMessage = message;
  }

  return {
    text: `❌ Error: ${enrichedMessage}`,
    isError: true as const,
  };
}

const PARAM_HINTS: Record<string, Record<string, string>> = {
  suppliers: {
    id: "If you don't have the ID, use the search tool to find the supplier by name.",
    date: "Date must be in yyyyMMdd format (e.g., '20260328').",
  },
  buyers: {
    id: "Try lookup_client to resolve a client name to its UUID.",
    clientId: "Try lookup_client to resolve a client name to its UUID.",
  },
  matching: {
    jobId: "Use matching with action 'jobs' to list available matching jobs.",
  },
  relationships: {
    buyerId: "Use buyers with action 'list' to find buyer IDs.",
    supplierId: "Use the search tool to find supplier IDs.",
  },
};

export function createValidationError(
  tool: string,
  action: string,
  missingParam: string
): ActionableErrorResult {
  const hint = PARAM_HINTS[tool]?.[missingParam] || '';
  const hintSuffix = hint ? ` ${hint}` : '';

  return {
    text: `❌ Error: The '${action}' action requires '${missingParam}'.${hintSuffix}`,
    isError: true as const,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/errors.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/errors.ts src/__tests__/errors.test.ts
git commit -m "feat: add actionable error helper with cross-tool hints"
```

---

## Task 2: Create consolidated Zod schemas

**Files:**
- Modify: `src/schemas/index.ts`
- Modify: `src/schemas/__tests__/schemas.test.ts`

Add 9 new consolidated schemas alongside the existing ones (existing schemas stay as internal exports used by the tool implementations).

- [ ] **Step 1: Write failing tests for consolidated schemas**

Add to `src/schemas/__tests__/schemas.test.ts` (append after existing tests):

```typescript
import {
  // ... existing imports stay ...
  SearchToolSchema,
  SuppliersToolSchema,
  BuyersToolSchema,
  RelationshipsToolSchema,
  ImportsToolSchema,
  MatchingToolSchema,
  AnalyzeToolSchema,
  NotifySlackToolSchema,
  LookupClientToolSchema,
} from '../index.js';

describe('consolidated schemas', () => {
  describe('SearchToolSchema', () => {
    it('requires at least one search criterion', () => {
      const result = SearchToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts name search', () => {
      const result = SearchToolSchema.safeParse({ name: 'Acme' });
      expect(result.success).toBe(true);
    });
  });

  describe('SuppliersToolSchema', () => {
    it('requires action', () => {
      const result = SuppliersToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts list action with no other params', () => {
      const result = SuppliersToolSchema.safeParse({ action: 'list' });
      expect(result.success).toBe(true);
    });

    it('accepts get action with id', () => {
      const result = SuppliersToolSchema.safeParse({ action: 'get', id: 's1' });
      expect(result.success).toBe(true);
    });

    it('rejects get action without id', () => {
      const result = SuppliersToolSchema.safeParse({ action: 'get' });
      expect(result.success).toBe(false);
    });

    it('accepts history action with id', () => {
      const result = SuppliersToolSchema.safeParse({ action: 'history', id: 's1' });
      expect(result.success).toBe(true);
    });

    it('rejects history action without id', () => {
      const result = SuppliersToolSchema.safeParse({ action: 'history' });
      expect(result.success).toBe(false);
    });

    it('accepts by_date action with date', () => {
      const result = SuppliersToolSchema.safeParse({ action: 'by_date', date: '20260328' });
      expect(result.success).toBe(true);
    });

    it('rejects by_date action without date', () => {
      const result = SuppliersToolSchema.safeParse({ action: 'by_date' });
      expect(result.success).toBe(false);
    });

    it('rejects by_date action with bad date format', () => {
      const result = SuppliersToolSchema.safeParse({ action: 'by_date', date: '2026-03-28' });
      expect(result.success).toBe(false);
    });
  });

  describe('BuyersToolSchema', () => {
    it('requires action', () => {
      const result = BuyersToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts list action', () => {
      const result = BuyersToolSchema.safeParse({ action: 'list' });
      expect(result.success).toBe(true);
    });

    it('accepts get action with id', () => {
      const result = BuyersToolSchema.safeParse({ action: 'get', id: 'b1' });
      expect(result.success).toBe(true);
    });

    it('accepts get action with clientId', () => {
      const result = BuyersToolSchema.safeParse({ action: 'get', clientId: 'client-1' });
      expect(result.success).toBe(true);
    });

    it('rejects get action without id or clientId', () => {
      const result = BuyersToolSchema.safeParse({ action: 'get' });
      expect(result.success).toBe(false);
    });

    it('accepts create action with clientId', () => {
      const result = BuyersToolSchema.safeParse({ action: 'create', clientId: 'client-1' });
      expect(result.success).toBe(true);
    });

    it('rejects create action without clientId', () => {
      const result = BuyersToolSchema.safeParse({ action: 'create' });
      expect(result.success).toBe(false);
    });
  });

  describe('RelationshipsToolSchema', () => {
    it('requires action', () => {
      const result = RelationshipsToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts for_buyer action with buyerId', () => {
      const result = RelationshipsToolSchema.safeParse({ action: 'for_buyer', buyerId: 'b1' });
      expect(result.success).toBe(true);
    });

    it('rejects for_buyer action without buyerId', () => {
      const result = RelationshipsToolSchema.safeParse({ action: 'for_buyer' });
      expect(result.success).toBe(false);
    });

    it('accepts for_supplier action with supplierId', () => {
      const result = RelationshipsToolSchema.safeParse({ action: 'for_supplier', supplierId: 's1' });
      expect(result.success).toBe(true);
    });

    it('accepts link action with buyerId and supplierId', () => {
      const result = RelationshipsToolSchema.safeParse({ action: 'link', buyerId: 'b1', supplierId: 's1' });
      expect(result.success).toBe(true);
    });

    it('rejects link action without supplierId', () => {
      const result = RelationshipsToolSchema.safeParse({ action: 'link', buyerId: 'b1' });
      expect(result.success).toBe(false);
    });
  });

  describe('ImportsToolSchema', () => {
    it('requires action', () => {
      const result = ImportsToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts upload action with filePath', () => {
      const result = ImportsToolSchema.safeParse({ action: 'upload', filePath: '/tmp/test.csv' });
      expect(result.success).toBe(true);
    });

    it('rejects upload action without filePath', () => {
      const result = ImportsToolSchema.safeParse({ action: 'upload' });
      expect(result.success).toBe(false);
    });

    it('accepts batches action with no params', () => {
      const result = ImportsToolSchema.safeParse({ action: 'batches' });
      expect(result.success).toBe(true);
    });

    it('accepts validate action', () => {
      const result = ImportsToolSchema.safeParse({ action: 'validate' });
      expect(result.success).toBe(true);
    });
  });

  describe('MatchingToolSchema', () => {
    it('requires action', () => {
      const result = MatchingToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts jobs action', () => {
      const result = MatchingToolSchema.safeParse({ action: 'jobs' });
      expect(result.success).toBe(true);
    });

    it('accepts job_detail with jobId', () => {
      const result = MatchingToolSchema.safeParse({ action: 'job_detail', jobId: 'j1' });
      expect(result.success).toBe(true);
    });

    it('rejects job_detail without jobId', () => {
      const result = MatchingToolSchema.safeParse({ action: 'job_detail' });
      expect(result.success).toBe(false);
    });

    it('accepts candidates with jobId', () => {
      const result = MatchingToolSchema.safeParse({ action: 'candidates', jobId: 'j1' });
      expect(result.success).toBe(true);
    });

    it('accepts staged with jobId and filters', () => {
      const result = MatchingToolSchema.safeParse({
        action: 'staged',
        jobId: 'j1',
        status: 'PENDING',
        category: 'POSSIBLE_MATCH',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('AnalyzeToolSchema', () => {
    it('requires action', () => {
      const result = AnalyzeToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts connections action', () => {
      const result = AnalyzeToolSchema.safeParse({ action: 'connections' });
      expect(result.success).toBe(true);
    });

    it('accepts relationships action with analysisType', () => {
      const result = AnalyzeToolSchema.safeParse({ action: 'relationships', analysisType: 'health' });
      expect(result.success).toBe(true);
    });

    it('rejects relationships action without analysisType', () => {
      const result = AnalyzeToolSchema.safeParse({ action: 'relationships' });
      expect(result.success).toBe(false);
    });

    it('accepts import_quality action with mode', () => {
      const result = AnalyzeToolSchema.safeParse({ action: 'import_quality', mode: 'quality' });
      expect(result.success).toBe(true);
    });

    it('rejects import_quality action without mode', () => {
      const result = AnalyzeToolSchema.safeParse({ action: 'import_quality' });
      expect(result.success).toBe(false);
    });
  });

  describe('NotifySlackToolSchema', () => {
    it('requires type', () => {
      const result = NotifySlackToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts analysis type with analysisResult', () => {
      const result = NotifySlackToolSchema.safeParse({
        type: 'analysis',
        analysisResult: { summary: {} },
      });
      expect(result.success).toBe(true);
    });

    it('rejects analysis type without analysisResult', () => {
      const result = NotifySlackToolSchema.safeParse({ type: 'analysis' });
      expect(result.success).toBe(false);
    });

    it('accepts custom type with message', () => {
      const result = NotifySlackToolSchema.safeParse({
        type: 'custom',
        message: { body: 'Hello team!' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects custom type without message', () => {
      const result = NotifySlackToolSchema.safeParse({ type: 'custom' });
      expect(result.success).toBe(false);
    });
  });

  describe('LookupClientToolSchema', () => {
    it('requires name', () => {
      const result = LookupClientToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts name', () => {
      const result = LookupClientToolSchema.safeParse({ name: 'Comet Electric' });
      expect(result.success).toBe(true);
    });

    it('defaults environment to dev', () => {
      const result = LookupClientToolSchema.safeParse({ name: 'Comet Electric' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.environment).toBe('dev');
      }
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/schemas/__tests__/schemas.test.ts`
Expected: FAIL — `SearchToolSchema` is not exported from `../index.js`

- [ ] **Step 3: Write consolidated schemas**

Add the following to the end of `src/schemas/index.ts` (before the existing type exports section, keeping all existing schemas):

```typescript
// ========================================
// Consolidated Tool Schemas (public API)
// ========================================

// --- search ---
export const SearchToolSchema = z.object({
  name: z.string().optional().describe("Supplier name or partial name to search for"),
  address: AddressSchema.optional(),
  email: z.string().email().optional().describe("Supplier email address"),
  minMatchScore: z.number().min(0).max(1).default(0.4)
    .describe("Minimum match score threshold (0.0-1.0). Default 0.4. Higher = stricter matching"),
  maxResults: z.number().int().min(1).max(100).default(10)
    .describe("Maximum number of results to return (1-100)"),
}).refine(
  (data) => data.name || data.address || data.email,
  { message: "At least one search criterion must be provided (name, address, or email)" }
);

// --- suppliers ---
export const SuppliersToolSchema = z.object({
  action: z.enum(["list", "get", "history", "by_date"])
    .describe("What to do: list all suppliers, get one by ID, view edit history, or find suppliers updated on a date"),
  id: z.string().min(1).optional()
    .describe("Supplier ID (required for 'get' and 'history' actions)"),
  includeLinks: z.boolean().default(false)
    .describe("Include buyer relationship links in response (for 'get' action)"),
  date: z.string().regex(/^\d{8}$/, "Date must be in yyyyMMdd format").optional()
    .describe("Date in yyyyMMdd format, e.g. '20260328' (required for 'by_date' action)"),
  format: HistoryFormatSchema.optional()
    .describe("History display format (for 'history' action)"),
  pageSize: z.number().int().min(1).max(100).default(20)
    .describe("Results per page, 1-100 (for 'list' action)"),
  cursor: z.string().optional()
    .describe("Pagination cursor for next page (for 'list' action)"),
}).refine(
  (data) => {
    if ((data.action === 'get' || data.action === 'history') && !data.id) return false;
    if (data.action === 'by_date' && !data.date) return false;
    return true;
  },
  (data) => {
    if ((data.action === 'get' || data.action === 'history') && !data.id) {
      return { message: `The '${data.action}' action requires 'id'. Use the search tool to find a supplier by name.` };
    }
    if (data.action === 'by_date' && !data.date) {
      return { message: "The 'by_date' action requires 'date' in yyyyMMdd format." };
    }
    return { message: "Validation failed" };
  }
);

// --- buyers ---
export const BuyersToolSchema = z.object({
  action: z.enum(["list", "get", "create"])
    .describe("What to do: list all buyers, get one by ID or client ID, or create a new buyer"),
  id: z.string().min(1).optional()
    .describe("Buyer UUID (for 'get' action — provide either id or clientId, not both)"),
  clientId: z.string().min(1).optional()
    .describe("External client reference ID (for 'get' action as alternative to id, or required for 'create')"),
  name: z.string().optional().describe("Buyer name (for 'create' action)"),
  franchiseName: z.string().optional().describe("Franchise name (for 'create' action)"),
  storeIdentifier: z.string().optional().describe("Store identifier (for 'create' action)"),
  status: z.string().optional().describe("Buyer status (for 'create' action)"),
  addresses: z.array(AddressSchema).optional().describe("Buyer addresses (for 'create' action)"),
  contacts: z.array(z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    position: z.string().optional(),
    title: z.string().optional(),
    type: z.enum(["PRIMARY", "SECONDARY", "OTHER"]).optional(),
  })).optional().describe("Buyer contacts (for 'create' action)"),
}).refine(
  (data) => {
    if (data.action === 'get' && !data.id && !data.clientId) return false;
    if (data.action === 'create' && !data.clientId) return false;
    return true;
  },
  (data) => {
    if (data.action === 'get') {
      return { message: "The 'get' action requires either 'id' or 'clientId'. Try lookup_client to resolve a name to its UUID." };
    }
    if (data.action === 'create') {
      return { message: "The 'create' action requires 'clientId'." };
    }
    return { message: "Validation failed" };
  }
);

// --- relationships ---
export const RelationshipsToolSchema = z.object({
  action: z.enum(["for_buyer", "for_supplier", "link"])
    .describe("What to do: get suppliers for a buyer, get buyers for a supplier, or create a buyer-supplier link"),
  buyerId: z.string().min(1).optional()
    .describe("Buyer ID (required for 'for_buyer' and 'link' actions)"),
  supplierId: z.string().min(1).optional()
    .describe("Supplier ID (required for 'for_supplier' and 'link' actions)"),
  buyerSupplierRefId: z.string().optional()
    .describe("External reference ID for the relationship (for 'link' action)"),
  buyerRefKey: z.string().optional()
    .describe("Reference key for the relationship (for 'link' action)"),
}).refine(
  (data) => {
    if (data.action === 'for_buyer' && !data.buyerId) return false;
    if (data.action === 'for_supplier' && !data.supplierId) return false;
    if (data.action === 'link' && (!data.buyerId || !data.supplierId)) return false;
    return true;
  },
  (data) => {
    if (data.action === 'for_buyer') return { message: "The 'for_buyer' action requires 'buyerId'." };
    if (data.action === 'for_supplier') return { message: "The 'for_supplier' action requires 'supplierId'." };
    if (data.action === 'link') return { message: "The 'link' action requires both 'buyerId' and 'supplierId'." };
    return { message: "Validation failed" };
  }
);

// --- imports ---
export const ImportsToolSchema = z.object({
  action: z.enum(["upload", "batches", "validate"])
    .describe("What to do: upload a CSV file, list recent import batches, or validate imported data quality"),
  filePath: z.string().min(1).optional()
    .describe("Path to CSV file (required for 'upload' action)"),
  fileName: z.string().optional()
    .describe("Filename override (for 'upload' action, defaults to basename of filePath)"),
  limit: z.number().int().min(1).max(100).default(20)
    .describe("Max batches to return, 1-100 (for 'batches' action)"),
  dateRange: z.object({
    from: z.string().regex(/^\d{8}$/, "Date must be in yyyyMMdd format"),
    to: z.string().regex(/^\d{8}$/, "Date must be in yyyyMMdd format"),
  }).optional().describe("Date range in yyyyMMdd format (for 'validate' action)"),
  buyerId: z.string().optional()
    .describe("Scope validation to this buyer's suppliers (for 'validate' action)"),
}).refine(
  (data) => {
    if (data.action === 'upload' && !data.filePath) return false;
    return true;
  },
  { message: "The 'upload' action requires 'filePath'." }
);

// --- matching ---
export const MatchingToolSchema = z.object({
  action: z.enum(["jobs", "job_detail", "candidates", "staged"])
    .describe("What to do: list matching jobs, get job details, list match candidates, or list staged matches awaiting review"),
  jobId: z.string().min(1).optional()
    .describe("Matching job ID (required for 'job_detail', 'candidates', and 'staged' actions)"),
  status: z.string().optional()
    .describe("Filter by status (for 'jobs': PENDING|RUNNING|REVIEW|FINALIZING|COMPLETED|FAILED|ABORTED; for 'staged': PENDING|APPROVED|REJECTED|SKIPPED)"),
  category: z.enum(["EXACT_MATCH", "POSSIBLE_MATCH", "CONFLICT", "NET_NEW"]).optional()
    .describe("Filter by match category (for 'candidates' and 'staged' actions)"),
  pageSize: z.number().int().min(1).max(100).default(20)
    .describe("Results per page, 1-100 (for 'candidates' and 'staged' actions)"),
  cursor: z.string().optional()
    .describe("Pagination cursor (for 'candidates' and 'staged' actions)"),
}).refine(
  (data) => {
    if (['job_detail', 'candidates', 'staged'].includes(data.action) && !data.jobId) return false;
    return true;
  },
  (data) => ({
    message: `The '${data.action}' action requires 'jobId'. Use matching with action 'jobs' to list available jobs.`,
  })
);

// --- analyze ---
export const AnalyzeToolSchema = z.object({
  action: z.enum(["connections", "relationships", "import_quality"])
    .describe("What to analyze: network connections, relationship health/coverage/mapping, or import data quality"),
  includeSuggestions: z.boolean().default(true)
    .describe("Include connection suggestions (for 'connections' action)"),
  minConnectionsForHub: z.number().int().min(1).default(5)
    .describe("Min connections to be a hub (for 'connections' action)"),
  analysisType: z.enum(["health", "coverage", "mapping"]).optional()
    .describe("Sub-type of relationship analysis (required for 'relationships' action)"),
  includeInactive: z.boolean().default(false)
    .describe("Include inactive links (for 'relationships' action)"),
  mode: z.enum(["post-upload", "preview", "quality"]).optional()
    .describe("Analysis mode (required for 'import_quality' action)"),
  buyerId: z.string().optional()
    .describe("Scope analysis to a specific buyer (for 'relationships' and 'import_quality' actions)"),
  dateRange: z.object({
    from: z.string().regex(/^\d{8}$/, "Date must be in yyyyMMdd format"),
    to: z.string().regex(/^\d{8}$/, "Date must be in yyyyMMdd format"),
  }).optional().describe("Date range in yyyyMMdd format (for 'import_quality' action)"),
}).refine(
  (data) => {
    if (data.action === 'relationships' && !data.analysisType) return false;
    if (data.action === 'import_quality' && !data.mode) return false;
    return true;
  },
  (data) => {
    if (data.action === 'relationships') return { message: "The 'relationships' action requires 'analysisType' (health, coverage, or mapping)." };
    if (data.action === 'import_quality') return { message: "The 'import_quality' action requires 'mode' (post-upload, preview, or quality)." };
    return { message: "Validation failed" };
  }
);

// --- notify_slack ---
export const NotifySlackToolSchema = z.object({
  type: z.enum(["analysis", "custom"])
    .describe("Message type: 'analysis' to post network analysis results, 'custom' to send a freeform message"),
  webhookUrl: z.string().url().optional()
    .describe("Slack webhook URL (optional if SLACK_WEBHOOK_URL env var is set)"),
  analysisResult: z.union([
    z.record(z.unknown()),
    z.string(),
    z.object({ structuredContent: z.record(z.unknown()) }),
  ]).optional()
    .describe("Network analysis result from the analyze tool (required for 'analysis' type)"),
  includeDetails: z.boolean().default(false)
    .describe("Include detailed breakdowns (for 'analysis' type)"),
  message: SlackGeneralMessageSchema.optional()
    .describe("Message content (required for 'custom' type)"),
}).refine(
  (data) => {
    if (data.type === 'analysis' && !data.analysisResult) return false;
    if (data.type === 'custom' && !data.message) return false;
    return true;
  },
  (data) => {
    if (data.type === 'analysis') return { message: "The 'analysis' type requires 'analysisResult' from the analyze tool." };
    if (data.type === 'custom') return { message: "The 'custom' type requires a 'message' object with at least a 'body' field." };
    return { message: "Validation failed" };
  }
);

// --- lookup_client (reuses existing schema) ---
export const LookupClientToolSchema = LookupClientIdSchema;

// Consolidated type exports
export type SearchToolInput = z.infer<typeof SearchToolSchema>;
export type SuppliersToolInput = z.infer<typeof SuppliersToolSchema>;
export type BuyersToolInput = z.infer<typeof BuyersToolSchema>;
export type RelationshipsToolInput = z.infer<typeof RelationshipsToolSchema>;
export type ImportsToolInput = z.infer<typeof ImportsToolSchema>;
export type MatchingToolInput = z.infer<typeof MatchingToolSchema>;
export type AnalyzeToolInput = z.infer<typeof AnalyzeToolSchema>;
export type NotifySlackToolInput = z.infer<typeof NotifySlackToolSchema>;
export type LookupClientToolInput = z.infer<typeof LookupClientToolSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/schemas/__tests__/schemas.test.ts`
Expected: All existing tests PASS + all new consolidated schema tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/schemas/index.ts src/schemas/__tests__/schemas.test.ts
git commit -m "feat: add consolidated Zod schemas with action discriminators"
```

---

## Task 3: Add dispatch wrappers to suppliers.ts

**Files:**
- Modify: `src/tools/suppliers.ts`
- Modify: `src/tools/__tests__/suppliers.test.ts`

- [ ] **Step 1: Write failing test for dispatch wrapper**

Add to the end of `src/tools/__tests__/suppliers.test.ts`:

```typescript
import { handleSuppliers } from '../suppliers.js';

describe('handleSuppliers dispatch', () => {
  it('dispatches list action', async () => {
    mockClient.listSuppliers.mockResolvedValue({
      items: [createSupplier({ id: 's1', name: 'Test' })],
      pagination: { count: 1, pageSize: 20, hasMore: false },
    });

    const result = await handleSuppliers({ action: 'list' });
    expect(result.content[0].text).toContain('Test');
    expect(mockClient.listSuppliers).toHaveBeenCalled();
  });

  it('dispatches get action', async () => {
    const supplier = createSupplier({ id: 's1', name: 'Acme' });
    mockClient.getSupplier.mockResolvedValue(supplier);

    const result = await handleSuppliers({ action: 'get', id: 's1' });
    expect(result.content[0].text).toContain('Acme');
    expect(mockClient.getSupplier).toHaveBeenCalledWith('s1', false);
  });

  it('dispatches history action', async () => {
    mockClient.getSupplierHistory.mockResolvedValue([]);

    const result = await handleSuppliers({ action: 'history', id: 's1' });
    expect(mockClient.getSupplierHistory).toHaveBeenCalledWith('s1', 'compact');
  });

  it('dispatches by_date action', async () => {
    mockClient.getSuppliersByDate.mockResolvedValue([]);

    const result = await handleSuppliers({ action: 'by_date', date: '20260328' });
    expect(mockClient.getSuppliersByDate).toHaveBeenCalledWith('20260328');
  });

  it('returns actionable error for unknown action', async () => {
    const result = await handleSuppliers({ action: 'invalid' as any });
    expect(result.isError).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/__tests__/suppliers.test.ts`
Expected: FAIL — `handleSuppliers` is not exported

- [ ] **Step 3: Add dispatch wrapper to suppliers.ts**

Add to the end of `src/tools/suppliers.ts`:

```typescript
import { createActionableError } from "../errors.js";
import { ResponseFormat } from "../constants.js";
import type { SuppliersToolInput } from "../schemas/index.js";

export async function handleSuppliers(params: SuppliersToolInput) {
  try {
    switch (params.action) {
      case "list":
        return await listSuppliers({
          pageSize: params.pageSize ?? 20,
          cursor: params.cursor,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "get":
        return await getSupplier({
          id: params.id!,
          includeLinks: params.includeLinks ?? false,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "history":
        return await getSupplierHistory({
          id: params.id!,
          format: params.format ?? HistoryFormat.COMPACT,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "by_date":
        return await getSuppliersByDate({
          date: params.date!,
          response_format: ResponseFormat.MARKDOWN,
        });
      default:
        return {
          isError: true,
          content: [{ type: "text" as const, text: `❌ Error: Unknown action '${params.action}'. Valid actions: list, get, history, by_date` }],
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: createActionableError(error instanceof Error ? error : String(error), 'suppliers', params.action, params as Record<string, unknown>).text,
      }],
    };
  }
}
```

Also add `HistoryFormat` to the existing imports from `../constants.js`:

```typescript
import { ResponseFormat, HistoryFormat } from "../constants.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tools/__tests__/suppliers.test.ts`
Expected: All existing tests PASS + all new dispatch tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/suppliers.ts src/tools/__tests__/suppliers.test.ts
git commit -m "feat: add handleSuppliers dispatch wrapper"
```

---

## Task 4: Add dispatch wrappers to buyers.ts

**Files:**
- Modify: `src/tools/buyers.ts`
- Modify: `src/tools/__tests__/buyers.test.ts`

- [ ] **Step 1: Write failing test for dispatch wrapper**

Add to the end of `src/tools/__tests__/buyers.test.ts` (after existing tests, using the existing mock setup pattern — check the file for `mockClient` and fixtures):

```typescript
import { handleBuyers } from '../buyers.js';

describe('handleBuyers dispatch', () => {
  it('dispatches list action', async () => {
    mockClient.listBuyers.mockResolvedValue([]);
    const result = await handleBuyers({ action: 'list' });
    expect(mockClient.listBuyers).toHaveBeenCalled();
  });

  it('dispatches get action with id', async () => {
    mockClient.getBuyer.mockResolvedValue({ id: 'b1', name: 'Buyer 1' });
    const result = await handleBuyers({ action: 'get', id: 'b1' });
    expect(mockClient.getBuyer).toHaveBeenCalledWith('b1');
  });

  it('dispatches get action with clientId (routes to getBuyerByClientId)', async () => {
    mockClient.getBuyerByClientId.mockResolvedValue({ id: 'b1', name: 'Buyer 1', clientId: 'c1' });
    const result = await handleBuyers({ action: 'get', clientId: 'c1' });
    expect(mockClient.getBuyerByClientId).toHaveBeenCalledWith('c1');
  });

  it('dispatches create action', async () => {
    mockClient.createBuyer.mockResolvedValue({ id: 'b-new', clientId: 'c1' });
    const result = await handleBuyers({ action: 'create', clientId: 'c1', name: 'New Buyer' });
    expect(mockClient.createBuyer).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/__tests__/buyers.test.ts`
Expected: FAIL — `handleBuyers` is not exported

- [ ] **Step 3: Add dispatch wrapper to buyers.ts**

Add to the end of `src/tools/buyers.ts`:

```typescript
import { createActionableError } from "../errors.js";
import { ResponseFormat } from "../constants.js";
import type { BuyersToolInput } from "../schemas/index.js";

export async function handleBuyers(params: BuyersToolInput) {
  try {
    switch (params.action) {
      case "list":
        return await listBuyers({ response_format: ResponseFormat.MARKDOWN });
      case "get":
        if (params.clientId) {
          return await getBuyerByClientId({
            clientId: params.clientId,
            response_format: ResponseFormat.MARKDOWN,
          });
        }
        return await getBuyer({
          id: params.id!,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "create":
        return await createBuyer({
          clientId: params.clientId!,
          name: params.name,
          franchiseName: params.franchiseName,
          storeIdentifier: params.storeIdentifier,
          status: params.status,
          addresses: params.addresses,
          contacts: params.contacts,
          response_format: ResponseFormat.MARKDOWN,
        });
      default:
        return {
          isError: true,
          content: [{ type: "text" as const, text: `❌ Error: Unknown action '${params.action}'. Valid actions: list, get, create` }],
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: createActionableError(error instanceof Error ? error : String(error), 'buyers', params.action, params as Record<string, unknown>).text,
      }],
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tools/__tests__/buyers.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/buyers.ts src/tools/__tests__/buyers.test.ts
git commit -m "feat: add handleBuyers dispatch wrapper with clientId routing"
```

---

## Task 5: Create relationships dispatch wrapper

**Files:**
- Create: `src/tools/relationships.ts`
- Create: `src/tools/__tests__/relationships.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/tools/__tests__/relationships.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRelationships } from '../relationships.js';
import { createMockNetworkAPIClient, type MockNetworkAPIClient } from '../../__mocks__/api-client.mock.js';

vi.mock('../../services/api-client.js', () => ({
  getNetworkAPIClient: vi.fn(),
}));

import { getNetworkAPIClient } from '../../services/api-client.js';

describe('handleRelationships dispatch', () => {
  let mockClient: MockNetworkAPIClient;

  beforeEach(() => {
    mockClient = createMockNetworkAPIClient();
    vi.mocked(getNetworkAPIClient).mockReturnValue(mockClient as never);
  });

  it('dispatches for_buyer action', async () => {
    mockClient.getSuppliersForBuyer.mockResolvedValue([]);
    const result = await handleRelationships({ action: 'for_buyer', buyerId: 'b1' });
    expect(mockClient.getSuppliersForBuyer).toHaveBeenCalledWith('b1');
  });

  it('dispatches for_supplier action', async () => {
    mockClient.getBuyersForSupplier.mockResolvedValue([]);
    const result = await handleRelationships({ action: 'for_supplier', supplierId: 's1' });
    expect(mockClient.getBuyersForSupplier).toHaveBeenCalledWith('s1');
  });

  it('dispatches link action', async () => {
    mockClient.createBuyerLink.mockResolvedValue({ buyerId: 'b1', supplierId: 's1' });
    const result = await handleRelationships({ action: 'link', buyerId: 'b1', supplierId: 's1' });
    expect(mockClient.createBuyerLink).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/__tests__/relationships.test.ts`
Expected: FAIL — `Cannot find module '../relationships.js'`

- [ ] **Step 3: Write implementation**

Create `src/tools/relationships.ts`:

```typescript
import {
  getSuppliersForBuyer,
  getBuyersForSupplier,
  createBuyerLink,
} from "./buyers.js";
import { createActionableError } from "../errors.js";
import { ResponseFormat } from "../constants.js";
import type { RelationshipsToolInput } from "../schemas/index.js";

export async function handleRelationships(params: RelationshipsToolInput) {
  try {
    switch (params.action) {
      case "for_buyer":
        return await getSuppliersForBuyer({
          buyerId: params.buyerId!,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "for_supplier":
        return await getBuyersForSupplier({
          supplierId: params.supplierId!,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "link":
        return await createBuyerLink({
          buyerId: params.buyerId!,
          supplierId: params.supplierId!,
          buyerSupplierRefId: params.buyerSupplierRefId,
          buyerRefKey: params.buyerRefKey,
          response_format: ResponseFormat.MARKDOWN,
        });
      default:
        return {
          isError: true,
          content: [{ type: "text" as const, text: `❌ Error: Unknown action '${params.action}'. Valid actions: for_buyer, for_supplier, link` }],
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: createActionableError(error instanceof Error ? error : String(error), 'relationships', params.action, params as Record<string, unknown>).text,
      }],
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tools/__tests__/relationships.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/relationships.ts src/tools/__tests__/relationships.test.ts
git commit -m "feat: add handleRelationships dispatch wrapper"
```

---

## Task 6: Create imports dispatch wrapper

**Files:**
- Create: `src/tools/imports.ts`
- Create: `src/tools/__tests__/imports.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/tools/__tests__/imports.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleImports } from '../imports.js';
import { createMockNetworkAPIClient, type MockNetworkAPIClient } from '../../__mocks__/api-client.mock.js';

vi.mock('../../services/api-client.js', () => ({
  getNetworkAPIClient: vi.fn(),
}));

import { getNetworkAPIClient } from '../../services/api-client.js';

describe('handleImports dispatch', () => {
  let mockClient: MockNetworkAPIClient;

  beforeEach(() => {
    mockClient = createMockNetworkAPIClient();
    vi.mocked(getNetworkAPIClient).mockReturnValue(mockClient as never);
  });

  it('dispatches upload action', async () => {
    mockClient.uploadFile.mockResolvedValue({ success: true });
    const result = await handleImports({ action: 'upload', filePath: '/tmp/test.csv' });
    expect(mockClient.uploadFile).toHaveBeenCalledWith('/tmp/test.csv', undefined);
  });

  it('dispatches batches action', async () => {
    mockClient.listFileImportJobs.mockResolvedValue([]);
    const result = await handleImports({ action: 'batches' });
    expect(mockClient.listFileImportJobs).toHaveBeenCalled();
  });

  it('dispatches validate action', async () => {
    // validateImportData is in the data-validator service, called through validateImportDataTool
    // We mock at the API client level which the service uses
    mockClient.getAllSuppliers.mockResolvedValue([]);
    mockClient.getSuppliersByDate.mockResolvedValue([]);
    const result = await handleImports({ action: 'validate' });
    // Validate action should not error
    expect(result.content).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/__tests__/imports.test.ts`
Expected: FAIL — `Cannot find module '../imports.js'`

- [ ] **Step 3: Write implementation**

Create `src/tools/imports.ts`:

```typescript
import { uploadFile } from "./suppliers.js";
import { listImportBatchesTool, validateImportDataTool } from "./workflows.js";
import { createActionableError } from "../errors.js";
import { ResponseFormat } from "../constants.js";
import type { ImportsToolInput } from "../schemas/index.js";

export async function handleImports(params: ImportsToolInput) {
  try {
    switch (params.action) {
      case "upload":
        return await uploadFile({
          filePath: params.filePath!,
          fileName: params.fileName,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "batches":
        return await listImportBatchesTool({
          limit: params.limit ?? 20,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "validate":
        return await validateImportDataTool({
          dateRange: params.dateRange,
          buyerId: params.buyerId,
          response_format: ResponseFormat.MARKDOWN,
        });
      default:
        return {
          isError: true,
          content: [{ type: "text" as const, text: `❌ Error: Unknown action '${params.action}'. Valid actions: upload, batches, validate` }],
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: createActionableError(error instanceof Error ? error : String(error), 'imports', params.action, params as Record<string, unknown>).text,
      }],
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tools/__tests__/imports.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/imports.ts src/tools/__tests__/imports.test.ts
git commit -m "feat: add handleImports dispatch wrapper"
```

---

## Task 7: Create matching dispatch wrapper

**Files:**
- Create: `src/tools/matching.ts`
- Create: `src/tools/__tests__/matching.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/tools/__tests__/matching.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMatching } from '../matching.js';
import { createMockNetworkAPIClient, type MockNetworkAPIClient } from '../../__mocks__/api-client.mock.js';

vi.mock('../../services/api-client.js', () => ({
  getNetworkAPIClient: vi.fn(),
}));

import { getNetworkAPIClient } from '../../services/api-client.js';

describe('handleMatching dispatch', () => {
  let mockClient: MockNetworkAPIClient;

  beforeEach(() => {
    mockClient = createMockNetworkAPIClient();
    vi.mocked(getNetworkAPIClient).mockReturnValue(mockClient as never);
  });

  it('dispatches jobs action', async () => {
    mockClient.listMatchingJobs.mockResolvedValue([]);
    const result = await handleMatching({ action: 'jobs' });
    expect(mockClient.listMatchingJobs).toHaveBeenCalled();
  });

  it('dispatches jobs action with status filter', async () => {
    mockClient.listMatchingJobs.mockResolvedValue([]);
    const result = await handleMatching({ action: 'jobs', status: 'REVIEW' });
    expect(mockClient.listMatchingJobs).toHaveBeenCalledWith('REVIEW');
  });

  it('dispatches job_detail action', async () => {
    mockClient.getMatchingJob.mockResolvedValue({ jobId: 'j1', status: 'COMPLETED' });
    const result = await handleMatching({ action: 'job_detail', jobId: 'j1' });
    expect(mockClient.getMatchingJob).toHaveBeenCalledWith('j1');
  });

  it('dispatches candidates action', async () => {
    mockClient.listMatchCandidates.mockResolvedValue([]);
    const result = await handleMatching({ action: 'candidates', jobId: 'j1' });
    expect(mockClient.listMatchCandidates).toHaveBeenCalled();
  });

  it('dispatches staged action', async () => {
    mockClient.listStagedMatches.mockResolvedValue([]);
    const result = await handleMatching({ action: 'staged', jobId: 'j1' });
    expect(mockClient.listStagedMatches).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/__tests__/matching.test.ts`
Expected: FAIL — `Cannot find module '../matching.js'`

- [ ] **Step 3: Write implementation**

Create `src/tools/matching.ts`:

```typescript
import {
  listMatchingJobsTool,
  getMatchingJobTool,
  listMatchCandidatesTool,
  listStagedMatchesTool,
} from "./workflows.js";
import { createActionableError } from "../errors.js";
import { ResponseFormat } from "../constants.js";
import type { MatchingToolInput } from "../schemas/index.js";

export async function handleMatching(params: MatchingToolInput) {
  try {
    switch (params.action) {
      case "jobs":
        return await listMatchingJobsTool({
          status: params.status as any,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "job_detail":
        return await getMatchingJobTool({
          jobId: params.jobId!,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "candidates":
        return await listMatchCandidatesTool({
          jobId: params.jobId!,
          category: params.category,
          pageSize: params.pageSize ?? 20,
          cursor: params.cursor,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "staged":
        return await listStagedMatchesTool({
          jobId: params.jobId!,
          status: params.status as any,
          category: params.category,
          pageSize: params.pageSize ?? 20,
          cursor: params.cursor,
          response_format: ResponseFormat.MARKDOWN,
        });
      default:
        return {
          isError: true,
          content: [{ type: "text" as const, text: `❌ Error: Unknown action '${params.action}'. Valid actions: jobs, job_detail, candidates, staged` }],
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: createActionableError(error instanceof Error ? error : String(error), 'matching', params.action, params as Record<string, unknown>).text,
      }],
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tools/__tests__/matching.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/matching.ts src/tools/__tests__/matching.test.ts
git commit -m "feat: add handleMatching dispatch wrapper"
```

---

## Task 8: Add dispatch wrappers to analysis.ts

**Files:**
- Modify: `src/tools/analysis.ts`
- Modify: `src/tools/__tests__/analysis.test.ts`

- [ ] **Step 1: Write failing test for analysis dispatch wrappers**

Add to the end of `src/tools/__tests__/analysis.test.ts`:

```typescript
import { handleAnalyze, handleNotifySlack } from '../analysis.js';

describe('handleAnalyze dispatch', () => {
  it('dispatches connections action', async () => {
    // Mock the analyzeNetwork service
    mockClient.getAllSuppliers.mockResolvedValue([]);
    mockClient.listBuyers.mockResolvedValue([]);

    const result = await handleAnalyze({ action: 'connections' });
    expect(result.content).toBeDefined();
  });

  it('dispatches relationships action with analysisType', async () => {
    mockClient.listBuyers.mockResolvedValue([]);
    mockClient.getAllSuppliers.mockResolvedValue([]);

    const result = await handleAnalyze({ action: 'relationships', analysisType: 'health' });
    expect(result.content).toBeDefined();
  });

  it('dispatches import_quality action with mode', async () => {
    mockClient.getAllSuppliers.mockResolvedValue([]);
    mockClient.getSuppliersByDate.mockResolvedValue([]);

    const result = await handleAnalyze({ action: 'import_quality', mode: 'quality' });
    expect(result.content).toBeDefined();
  });
});

describe('handleNotifySlack dispatch', () => {
  it('dispatches custom type', async () => {
    const result = await handleNotifySlack({
      type: 'custom',
      message: { body: 'Hello!' },
      webhookUrl: 'https://hooks.slack.com/test',
    });
    // Will likely fail at the HTTP call, but the dispatch should work
    expect(result.content).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/__tests__/analysis.test.ts`
Expected: FAIL — `handleAnalyze` is not exported

- [ ] **Step 3: Add dispatch wrappers to analysis.ts**

Add to the end of `src/tools/analysis.ts`:

```typescript
import { analyzeImport, analyzeRelationships } from "./workflows.js";
import { createActionableError } from "../errors.js";
import { ResponseFormat } from "../constants.js";
import type { AnalyzeToolInput, NotifySlackToolInput } from "../schemas/index.js";

export async function handleAnalyze(params: AnalyzeToolInput) {
  try {
    switch (params.action) {
      case "connections":
        return await analyzeNetworkConnections({
          includeSuggestions: params.includeSuggestions ?? true,
          minConnectionsForHub: params.minConnectionsForHub ?? 5,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "relationships":
        return await analyzeRelationships({
          buyerId: params.buyerId,
          analysisType: params.analysisType!,
          includeInactive: params.includeInactive ?? false,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "import_quality":
        return await analyzeImport({
          mode: params.mode!,
          dateRange: params.dateRange,
          buyerId: params.buyerId,
          response_format: ResponseFormat.MARKDOWN,
        });
      default:
        return {
          isError: true,
          content: [{ type: "text" as const, text: `❌ Error: Unknown action '${params.action}'. Valid actions: connections, relationships, import_quality` }],
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: createActionableError(error instanceof Error ? error : String(error), 'analyze', params.action, params as Record<string, unknown>).text,
      }],
    };
  }
}

export async function handleNotifySlack(params: NotifySlackToolInput) {
  try {
    switch (params.type) {
      case "analysis":
        return await notifySlack({
          webhookUrl: params.webhookUrl,
          analysisResult: params.analysisResult!,
          includeDetails: params.includeDetails ?? false,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "custom":
        return await sendSlackMessage({
          webhookUrl: params.webhookUrl,
          message: params.message!,
          response_format: ResponseFormat.MARKDOWN,
        });
      default:
        return {
          isError: true,
          content: [{ type: "text" as const, text: `❌ Error: Unknown type '${params.type}'. Valid types: analysis, custom` }],
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: createActionableError(error instanceof Error ? error : String(error), 'notify_slack', params.type, params as Record<string, unknown>).text,
      }],
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tools/__tests__/analysis.test.ts`
Expected: All existing tests PASS + new dispatch tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/analysis.ts src/tools/__tests__/analysis.test.ts
git commit -m "feat: add handleAnalyze and handleNotifySlack dispatch wrappers"
```

---

## Task 9: Rewrite index.ts tool registration

**Files:**
- Modify: `src/index.ts`

This is the core task — rewrite both the ListTools handler (tool definitions + descriptions) and the CallTools handler (dispatch logic).

- [ ] **Step 1: Rewrite the import section at the top of index.ts**

Replace the existing schema and tool imports (lines 3-81) with:

```typescript
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";

// Import consolidated schemas
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
} from "./schemas/index.js";

// Import dispatch handlers
import { searchSuppliers } from "./tools/suppliers.js";
import { handleSuppliers } from "./tools/suppliers.js";
import { handleBuyers } from "./tools/buyers.js";
import { handleRelationships } from "./tools/relationships.js";
import { handleImports } from "./tools/imports.js";
import { handleMatching } from "./tools/matching.js";
import { handleAnalyze, handleNotifySlack } from "./tools/analysis.js";
import { lookupClientId } from "./tools/clients.js";

// Import prompts
import { NETWORK_PROMPTS, handleGetPrompt } from "./prompts/index.js";

import { ResponseFormat } from "./constants.js";
```

- [ ] **Step 2: Replace the ListTools handler (lines 103-944) with consolidated tool definitions**

Replace the entire `server.setRequestHandler(ListToolsRequestSchema, ...)` block with the 9 consolidated tools. Each tool gets the new description from the spec and the flat schema from the consolidated Zod schemas. The full replacement is large, so here is the structure:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async (request) => {
  console.error("=== MCP Request (ListTools) ===");
  console.error(JSON.stringify(request, null, 2));

  const response = {
    tools: [
      {
        name: "search",
        description: "Find suppliers by name, address, or email using fuzzy matching. Returns ranked results with confidence scores. Use when the user asks to find, look up, or search for a supplier — especially with partial or imperfect information. Do NOT use for browsing all suppliers — use `suppliers` with action `list` instead.\n\nExample: search for \"Acme\" to find all suppliers with similar names.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Supplier name or partial name to search for" },
            address: {
              type: "object",
              description: "Address components for searching",
              properties: {
                streetAddress: { type: "string" },
                city: { type: "string" },
                stateProvince: { type: "string" },
                postalCode: { type: "string" },
                suiteUnit: { type: "string" },
                addressType: { type: "string" },
              },
            },
            email: { type: "string", description: "Supplier email address" },
            minMatchScore: { type: "number", description: "Minimum match score threshold (0.0-1.0). Default 0.4", default: 0.4, minimum: 0, maximum: 1 },
            maxResults: { type: "number", description: "Maximum number of results (1-100)", default: 10, minimum: 1, maximum: 100 },
          },
        },
      },
      {
        name: "suppliers",
        description: "View supplier information. Use when the user asks about a specific supplier, wants to browse suppliers, check what changed on a date, or see a supplier's edit history.\n\nActions:\n- `list` — Browse all suppliers with pagination\n- `get` — Get a supplier by ID (set `includeLinks: true` to see buyer relationships)\n- `history` — See all changes to a supplier over time\n- `by_date` — Find suppliers updated on a specific date",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["list", "get", "history", "by_date"], description: "What to do" },
            id: { type: "string", description: "Supplier ID (required for 'get' and 'history')" },
            includeLinks: { type: "boolean", description: "Include buyer links (for 'get')", default: false },
            date: { type: "string", description: "Date in yyyyMMdd format (required for 'by_date')", pattern: "^\\d{8}$" },
            format: { type: "string", enum: ["timeline", "compact", "default"], description: "History format (for 'history')", default: "compact" },
            pageSize: { type: "number", description: "Results per page 1-100 (for 'list')", default: 20 },
            cursor: { type: "string", description: "Pagination cursor (for 'list')" },
          },
          required: ["action"],
        },
      },
      {
        name: "buyers",
        description: "View or create buyers. Use when the user asks about a specific buyer, wants to see all buyers, or needs to create a new one. Supports lookup by internal ID or external client ID.\n\nActions:\n- `list` — Browse all buyers\n- `get` — Get a buyer by ID or client ID (provide `id` for internal UUID, or `clientId` for external reference)\n- `create` — Create a new buyer (requires `clientId`)",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["list", "get", "create"], description: "What to do" },
            id: { type: "string", description: "Buyer UUID (for 'get' — provide either id or clientId)" },
            clientId: { type: "string", description: "External client ref ID (for 'get' as alternative to id, or required for 'create')" },
            name: { type: "string", description: "Buyer name (for 'create')" },
            franchiseName: { type: "string", description: "Franchise name (for 'create')" },
            storeIdentifier: { type: "string", description: "Store identifier (for 'create')" },
            status: { type: "string", description: "Buyer status (for 'create')" },
            addresses: { type: "array", description: "Buyer addresses (for 'create')" },
            contacts: { type: "array", description: "Buyer contacts (for 'create')" },
          },
          required: ["action"],
        },
      },
      {
        name: "relationships",
        description: "View or create buyer-supplier relationships. Use when the user asks who a buyer's suppliers are, which buyers a supplier serves, or wants to link a buyer and supplier together.\n\nActions:\n- `for_buyer` — Get all suppliers linked to a buyer\n- `for_supplier` — Get all buyers linked to a supplier\n- `link` — Create a new buyer-supplier link (returns error if link already exists)",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["for_buyer", "for_supplier", "link"], description: "What to do" },
            buyerId: { type: "string", description: "Buyer ID (required for 'for_buyer' and 'link')" },
            supplierId: { type: "string", description: "Supplier ID (required for 'for_supplier' and 'link')" },
            buyerSupplierRefId: { type: "string", description: "External ref ID (for 'link')" },
            buyerRefKey: { type: "string", description: "Reference key (for 'link')" },
          },
          required: ["action"],
        },
      },
      {
        name: "imports",
        description: "Manage file imports. Use when the user wants to upload a supplier CSV, check recent import batches, or validate imported data for quality issues like placeholder emails, invalid phone numbers, or cross-field contamination.\n\nActions:\n- `upload` — Upload a CSV file for processing\n- `batches` — List recent import jobs with status and entity counts\n- `validate` — Check imported data for garbage/invalid content with remediation suggestions",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["upload", "batches", "validate"], description: "What to do" },
            filePath: { type: "string", description: "Path to CSV file (required for 'upload')" },
            fileName: { type: "string", description: "Filename override (for 'upload')" },
            limit: { type: "number", description: "Max batches to return 1-100 (for 'batches')", default: 20 },
            dateRange: { type: "object", description: "Date range yyyyMMdd (for 'validate')", properties: { from: { type: "string" }, to: { type: "string" } } },
            buyerId: { type: "string", description: "Scope to buyer (for 'validate')" },
          },
          required: ["action"],
        },
      },
      {
        name: "matching",
        description: "Monitor and review supplier matching jobs. Use when the user asks about matching progress, wants to see match candidates, or needs to review staged matches awaiting approval.\n\nActions:\n- `jobs` — List matching jobs (filter by status to find jobs needing review)\n- `job_detail` — Get detailed status and category breakdown for a specific job\n- `candidates` — List candidates from an import file with match categories and confidence scores\n- `staged` — List staged matches awaiting review with AI recommendations",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["jobs", "job_detail", "candidates", "staged"], description: "What to do" },
            jobId: { type: "string", description: "Matching job ID (required for 'job_detail', 'candidates', 'staged')" },
            status: { type: "string", description: "Filter by status" },
            category: { type: "string", enum: ["EXACT_MATCH", "POSSIBLE_MATCH", "CONFLICT", "NET_NEW"], description: "Filter by match category" },
            pageSize: { type: "number", description: "Results per page 1-100", default: 20 },
            cursor: { type: "string", description: "Pagination cursor" },
          },
          required: ["action"],
        },
      },
      {
        name: "analyze",
        description: "Analyze the supplier network for health, coverage, and quality. Use when the user asks about network health, wants to find gaps or isolated suppliers, or needs an assessment of import data quality. For viewing specific supplier or buyer data, use `suppliers` or `buyers` instead.\n\nActions:\n- `connections` — Identify isolated nodes, network hubs, and suggest new connections\n- `relationships` — Assess relationship health, coverage gaps, or map network structure (requires `analysisType`)\n- `import_quality` — Post-upload validation, pre-import preview, or data quality scoring (requires `mode`)",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["connections", "relationships", "import_quality"], description: "What to analyze" },
            includeSuggestions: { type: "boolean", description: "Include connection suggestions (for 'connections')", default: true },
            minConnectionsForHub: { type: "number", description: "Min connections for hub (for 'connections')", default: 5 },
            analysisType: { type: "string", enum: ["health", "coverage", "mapping"], description: "Analysis sub-type (required for 'relationships')" },
            includeInactive: { type: "boolean", description: "Include inactive links (for 'relationships')", default: false },
            mode: { type: "string", enum: ["post-upload", "preview", "quality"], description: "Analysis mode (required for 'import_quality')" },
            buyerId: { type: "string", description: "Scope to buyer (for 'relationships' and 'import_quality')" },
            dateRange: { type: "object", description: "Date range yyyyMMdd (for 'import_quality')", properties: { from: { type: "string" }, to: { type: "string" } } },
          },
          required: ["action"],
        },
      },
      {
        name: "notify_slack",
        description: "Send messages to Slack via webhook. Use when the user wants to share results or alerts with the team.\n\nTypes:\n- `analysis` — Post formatted network analysis results (pass the result from the `analyze` tool)\n- `custom` — Send a freeform message with title, body, fields, buttons, and color",
        inputSchema: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["analysis", "custom"], description: "Message type" },
            webhookUrl: { type: "string", description: "Slack webhook URL (optional if SLACK_WEBHOOK_URL env var is set)" },
            analysisResult: { description: "Network analysis result (required for 'analysis' type)" },
            includeDetails: { type: "boolean", description: "Include details (for 'analysis')", default: false },
            message: { type: "object", description: "Message content (required for 'custom')", properties: { title: { type: "string" }, body: { type: "string" }, fields: { type: "array" }, actions: { type: "array" }, footer: { type: "string" }, color: { type: "string", enum: ["good", "warning", "danger"] } }, required: ["body"] },
          },
          required: ["type"],
        },
      },
      {
        name: "lookup_client",
        description: "Resolve a human-friendly client name to its UUID. Use when the user refers to a client by name (e.g., \"Comet Electric\") and you need the client ID for other tools. Fuzzy matches against the configuration store.\n\nExample: look up \"Comet Electric\" to get their client UUID for use with `buyers` or `relationships`.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Client name to look up (e.g. 'Comet Electric')" },
            environment: { type: "string", enum: ["dev", "prod"], description: "Target environment", default: "dev" },
          },
          required: ["name"],
        },
      },
    ],
  };

  console.error("=== MCP Response (ListTools) ===");
  console.error(JSON.stringify(response, null, 2));

  return response;
});
```

- [ ] **Step 3: Replace the CallTools handler (lines 949-1137) with consolidated dispatch**

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.error("=== MCP Request (CallTool) ===");
  console.error(JSON.stringify(request, null, 2));

  try {
    const { name, arguments: args } = request.params;

    let response;
    switch (name) {
      case "search": {
        const params = SearchToolSchema.parse(args);
        response = await searchSuppliers({
          ...params,
          response_format: ResponseFormat.MARKDOWN,
        });
        break;
      }

      case "suppliers": {
        const params = SuppliersToolSchema.parse(args);
        response = await handleSuppliers(params);
        break;
      }

      case "buyers": {
        const params = BuyersToolSchema.parse(args);
        response = await handleBuyers(params);
        break;
      }

      case "relationships": {
        const params = RelationshipsToolSchema.parse(args);
        response = await handleRelationships(params);
        break;
      }

      case "imports": {
        const params = ImportsToolSchema.parse(args);
        response = await handleImports(params);
        break;
      }

      case "matching": {
        const params = MatchingToolSchema.parse(args);
        response = await handleMatching(params);
        break;
      }

      case "analyze": {
        const params = AnalyzeToolSchema.parse(args);
        response = await handleAnalyze(params);
        break;
      }

      case "notify_slack": {
        const params = NotifySlackToolSchema.parse(args);
        response = await handleNotifySlack(params);
        break;
      }

      case "lookup_client": {
        const params = LookupClientToolSchema.parse(args);
        response = await lookupClientId(params);
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    console.error("=== MCP Response (CallTool) ===");
    console.error(JSON.stringify(response, null, 2));

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorResponse = {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };

    console.error("=== MCP Error Response (CallTool) ===");
    console.error(JSON.stringify(errorResponse, null, 2));

    return errorResponse;
  }
});
```

- [ ] **Step 4: Add server-level instructions**

Update the `createServer()` function to include the server description. Modify the Server constructor options:

```typescript
const server = new Server(
  {
    name: "network-mcp-server",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
);
```

Note: MCP SDK's `Server` constructor doesn't directly support a `description` field in the server info. The description from the spec should be included as a comment near the top of `index.ts` and can be referenced in documentation. If the SDK adds instructions support, add it then.

- [ ] **Step 5: Build and verify compilation**

Run: `npm run build`
Expected: Compilation succeeds with no errors

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass. Service-layer tests are unchanged. Tool tests pass with both old internal tests and new dispatch tests.

- [ ] **Step 7: Commit**

```bash
git add src/index.ts
git commit -m "feat: rewrite tool registration with 9 consolidated tools

Replaces 25 tools with 9 intent-based tools:
- search, suppliers, buyers, relationships, imports,
  matching, analyze, notify_slack, lookup_client

Drops network_ prefix, adds intent-driven descriptions,
uses action-based dispatch to existing implementations."
```

---

## Task 10: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the tool reference section in README.md**

Replace the existing API Reference / Tool Reference section with the new 9-tool structure. Keep the installation, configuration, and usage sections unchanged. Update the tool list to match:

```markdown
## Tools

### `search`
Find suppliers by name, address, or email using fuzzy matching.

### `suppliers`
View supplier information. Actions: `list`, `get`, `history`, `by_date`

### `buyers`
View or create buyers. Actions: `list`, `get`, `create`

### `relationships`
View or create buyer-supplier links. Actions: `for_buyer`, `for_supplier`, `link`

### `imports`
Manage file imports. Actions: `upload`, `batches`, `validate`

### `matching`
Monitor matching jobs. Actions: `jobs`, `job_detail`, `candidates`, `staged`

### `analyze`
Network health and insights. Actions: `connections`, `relationships`, `import_quality`

### `notify_slack`
Send Slack messages. Types: `analysis`, `custom`

### `lookup_client`
Resolve client name to UUID.
```

Expand each with parameter tables matching the spec schemas. Remove references to the old `network_*` tool names throughout the file.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for consolidated tool structure"
```

---

## Task 11: Full integration verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 3: Verify tool count**

Run: `node -e "const {createServer} = require('./dist/index.js')" 2>&1 | head -5`

Or start the server and check the ListTools response manually to confirm exactly 9 tools are registered.

- [ ] **Step 4: Commit any fixes**

If any tests failed or build errors occurred, fix them and commit:

```bash
git add -A
git commit -m "fix: resolve integration issues from tool consolidation"
```
