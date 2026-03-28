# MCP Server Usability: Tool Consolidation & Description Improvements

**Date:** 2026-03-28
**Status:** Approved
**Goal:** Reduce tool count from 25 to 9 and improve descriptions so both Claude and non-technical team members can discover and use the right tool reliably.

---

## Motivation

This is the team's first MCP server. Before sharing it broadly, the biggest friction point is **too many tools** — 25 tools with a redundant `network_` prefix and confusing overlaps (three `analyze_*` tools, three matching job tools, etc.). Non-technical users (ops, account managers) will use this through Claude for lookups, import reviews, and relationship queries alongside developers.

## Approach

Consolidate tools by **user intent** — group operations that share a mental model into a single tool with an `action` parameter. Drop the `network_` prefix. Rewrite descriptions to be intent-driven with negative guidance and examples. Improve error messages to suggest next steps.

---

## Tool Consolidation Map

### Before → After

| New Tool | Action Param | Replaces |
|---|---|---|
| `search` | *(single purpose)* | `network_search_suppliers` |
| `suppliers` | `list`, `get`, `history`, `by_date` | `network_list_suppliers`, `network_get_supplier`, `network_get_supplier_history`, `network_get_suppliers_by_date` |
| `buyers` | `list`, `get`, `create` | `network_list_buyers`, `network_get_buyer`, `network_get_buyer_by_client_id`, `network_create_buyer` |
| `relationships` | `for_buyer`, `for_supplier`, `link` | `network_get_suppliers_for_buyer`, `network_get_buyers_for_supplier`, `network_create_buyer_link` |
| `imports` | `upload`, `batches`, `validate` | `network_upload_file`, `network_list_import_batches`, `network_validate_import_data` |
| `matching` | `jobs`, `job_detail`, `candidates`, `staged` | `network_list_matching_jobs`, `network_get_matching_job`, `network_list_match_candidates`, `network_list_staged_matches` |
| `analyze` | `connections`, `relationships`, `import_quality` | `network_analyze_connections`, `network_analyze_relationships`, `network_analyze_import` |
| `notify_slack` | *(type: `analysis` or `custom`)* | `network_notify_slack`, `network_send_slack_message` |
| `lookup_client` | *(single purpose)* | `network_lookup_client_id` |

### Consolidation Rationale

- **`search` stays standalone:** Fuzzy matching is a fundamentally different interaction from CRUD reads. Users think "find a supplier" differently from "show me supplier X."
- **`lookup_client` stays standalone:** Hits a different backend (config store via S3, not the network API). Single-purpose, no actions needed.
- **`network_get_buyer_by_client_id` folds into `buyers`:** The `get` action accepts either `id` (buyer UUID) or `clientId` (external reference). If `clientId` is provided, it looks up by client ID instead of internal ID.
- **`response_format` removed from all tools:** Currently on every tool, adds schema noise. Server defaults to markdown. Can be reintroduced as a server-level config if JSON output is needed later.

---

## Schema Design

Each consolidated tool uses a **flat parameter schema** with a required `action` enum. Parameters document which action they apply to.

### Example: `suppliers` tool schema

```typescript
{
  action: {
    type: "string",
    enum: ["list", "get", "history", "by_date"],
    description: "What to do: list all suppliers, get one by ID, view edit history, or find suppliers updated on a date"
  },
  id: {
    type: "string",
    description: "Supplier ID (required for 'get' and 'history' actions)"
  },
  includeLinks: {
    type: "boolean",
    description: "Include buyer relationship links in response (for 'get' action)",
    default: false
  },
  date: {
    type: "string",
    description: "Date in yyyyMMdd format, e.g. '20260328' (required for 'by_date' action)",
    pattern: "^\\d{8}$"
  },
  format: {
    type: "string",
    enum: ["timeline", "compact", "default"],
    description: "History display format (for 'history' action)",
    default: "compact"
  },
  pageSize: {
    type: "number",
    description: "Results per page, 1-100 (for 'list' action)",
    default: 20
  },
  cursor: {
    type: "string",
    description: "Pagination cursor for next page (for 'list' action)"
  }
}
// required: ["action"]
```

### Example: `buyers` tool schema

```typescript
{
  action: {
    type: "string",
    enum: ["list", "get", "create"],
    description: "What to do: list all buyers, get one by ID or client ID, or create a new buyer"
  },
  id: {
    type: "string",
    description: "Buyer UUID (for 'get' action — provide either id or clientId, not both)"
  },
  clientId: {
    type: "string",
    description: "External client reference ID (for 'get' action as alternative to id, or required for 'create')"
  },
  name: {
    type: "string",
    description: "Buyer name (for 'create' action)"
  },
  franchiseName: {
    type: "string",
    description: "Franchise name (for 'create' action)"
  },
  storeIdentifier: {
    type: "string",
    description: "Store identifier (for 'create' action)"
  },
  status: {
    type: "string",
    description: "Buyer status (for 'create' action)"
  },
  addresses: {
    type: "array",
    description: "Buyer addresses (for 'create' action)"
  },
  contacts: {
    type: "array",
    description: "Buyer contacts (for 'create' action)"
  }
}
// required: ["action"]
```

### Example: `relationships` tool schema

```typescript
{
  action: {
    type: "string",
    enum: ["for_buyer", "for_supplier", "link"],
    description: "What to do: get suppliers for a buyer, get buyers for a supplier, or create a buyer-supplier link"
  },
  buyerId: {
    type: "string",
    description: "Buyer ID (required for 'for_buyer' and 'link' actions)"
  },
  supplierId: {
    type: "string",
    description: "Supplier ID (required for 'for_supplier' and 'link' actions)"
  },
  buyerSupplierRefId: {
    type: "string",
    description: "External reference ID for the relationship (for 'link' action)"
  },
  buyerRefKey: {
    type: "string",
    description: "Reference key for the relationship (for 'link' action)"
  }
}
// required: ["action"]
```

### Example: `imports` tool schema

```typescript
{
  action: {
    type: "string",
    enum: ["upload", "batches", "validate"],
    description: "What to do: upload a CSV file, list recent import batches, or validate imported data quality"
  },
  filePath: {
    type: "string",
    description: "Path to CSV file (required for 'upload' action)"
  },
  fileName: {
    type: "string",
    description: "Filename override (for 'upload' action, defaults to basename of filePath)"
  },
  limit: {
    type: "number",
    description: "Max batches to return, 1-100 (for 'batches' action)",
    default: 20
  },
  dateRange: {
    type: "object",
    description: "Date range in yyyyMMdd format (for 'validate' action)",
    properties: {
      from: { type: "string", pattern: "^\\d{8}$" },
      to: { type: "string", pattern: "^\\d{8}$" }
    }
  },
  buyerId: {
    type: "string",
    description: "Scope validation to this buyer's suppliers (for 'validate' action)"
  }
}
// required: ["action"]
```

### Example: `matching` tool schema

```typescript
{
  action: {
    type: "string",
    enum: ["jobs", "job_detail", "candidates", "staged"],
    description: "What to do: list matching jobs, get job details, list match candidates, or list staged matches awaiting review"
  },
  jobId: {
    type: "string",
    description: "Matching job ID (required for 'job_detail', 'candidates', and 'staged' actions)"
  },
  status: {
    type: "string",
    description: "Filter by status (for 'jobs': PENDING|RUNNING|REVIEW|FINALIZING|COMPLETED|FAILED|ABORTED; for 'staged': PENDING|APPROVED|REJECTED|SKIPPED)"
  },
  category: {
    type: "string",
    enum: ["EXACT_MATCH", "POSSIBLE_MATCH", "CONFLICT", "NET_NEW"],
    description: "Filter by match category (for 'candidates' and 'staged' actions)"
  },
  pageSize: {
    type: "number",
    description: "Results per page, 1-100 (for 'candidates' and 'staged' actions)",
    default: 20
  },
  cursor: {
    type: "string",
    description: "Pagination cursor (for 'candidates' and 'staged' actions)"
  }
}
// required: ["action"]
```

### Example: `analyze` tool schema

```typescript
{
  action: {
    type: "string",
    enum: ["connections", "relationships", "import_quality"],
    description: "What to analyze: network connections (hubs, isolated nodes, suggestions), relationship health/coverage/mapping, or import data quality"
  },
  // connections params
  includeSuggestions: {
    type: "boolean",
    description: "Include connection suggestions (for 'connections' action)",
    default: true
  },
  minConnectionsForHub: {
    type: "number",
    description: "Min connections to be a hub (for 'connections' action)",
    default: 5
  },
  // relationships params
  analysisType: {
    type: "string",
    enum: ["health", "coverage", "mapping"],
    description: "Sub-type of relationship analysis (required for 'relationships' action)"
  },
  includeInactive: {
    type: "boolean",
    description: "Include inactive links (for 'relationships' action)",
    default: false
  },
  // import_quality params
  mode: {
    type: "string",
    enum: ["post-upload", "preview", "quality"],
    description: "Analysis mode (required for 'import_quality' action)"
  },
  // shared params
  buyerId: {
    type: "string",
    description: "Scope analysis to a specific buyer (for 'relationships' and 'import_quality' actions)"
  },
  dateRange: {
    type: "object",
    description: "Date range in yyyyMMdd format (for 'import_quality' action)"
  }
}
// required: ["action"]
```

### Example: `notify_slack` tool schema

```typescript
{
  type: {
    type: "string",
    enum: ["analysis", "custom"],
    description: "Message type: 'analysis' to post network analysis results, 'custom' to send a freeform message"
  },
  webhookUrl: {
    type: "string",
    description: "Slack webhook URL (optional if SLACK_WEBHOOK_URL env var is set)"
  },
  // analysis type params
  analysisResult: {
    description: "Network analysis result from the analyze tool (required for 'analysis' type)"
  },
  includeDetails: {
    type: "boolean",
    description: "Include detailed breakdowns (for 'analysis' type)",
    default: false
  },
  // custom type params
  message: {
    type: "object",
    description: "Message content (required for 'custom' type)",
    properties: {
      title: { type: "string", maxLength: 150 },
      body: { type: "string", maxLength: 3000 },
      fields: { type: "array", maxItems: 10 },
      actions: { type: "array", maxItems: 5 },
      footer: { type: "string", maxLength: 200 },
      color: { type: "string", enum: ["good", "warning", "danger"] }
    }
  }
}
// required: ["type"]
```

The `search` and `lookup_client` tools keep their current schemas unchanged (minus the `response_format` field and `network_` prefix).

### Design notes

**`notify_slack` uses `type` instead of `action`:** This is intentional — "analysis" vs "custom" describes the message type, not an action being performed. All other tools use `action`.

**`matching` has an overloaded `status` param:** For the `jobs` action it filters by job status (PENDING/RUNNING/REVIEW/etc.), for `staged` it filters by review status (PENDING/APPROVED/REJECTED/SKIPPED). The param description covers both, but the Zod validation should accept the union of both enum sets and validate contextually based on the action.

### Design principle

Flat params with "(for X action)" annotations. This is the pattern that works best with LLMs — they read the description string, not JSON Schema conditionals like `if/then/else` or `oneOf`. Validation of required-per-action params happens in code (Zod refinements), not in the JSON Schema.

---

## Tool Descriptions

Each description has three parts: purpose, when to use, and action summary.

### `search`

> Find suppliers by name, address, or email using fuzzy matching. Returns ranked results with confidence scores. Use when the user asks to find, look up, or search for a supplier — especially with partial or imperfect information. Do NOT use for browsing all suppliers — use `suppliers` with action `list` instead.
>
> Example: search for "Acme" to find all suppliers with similar names.

### `suppliers`

> View supplier information. Use when the user asks about a specific supplier, wants to browse suppliers, check what changed on a date, or see a supplier's edit history.
>
> Actions:
> - `list` — Browse all suppliers with pagination
> - `get` — Get a supplier by ID (set `includeLinks: true` to see buyer relationships)
> - `history` — See all changes to a supplier over time
> - `by_date` — Find suppliers updated on a specific date

### `buyers`

> View or create buyers. Use when the user asks about a specific buyer, wants to see all buyers, or needs to create a new one. Supports lookup by internal ID or external client ID.
>
> Actions:
> - `list` — Browse all buyers
> - `get` — Get a buyer by ID or client ID (provide `id` for internal UUID, or `clientId` for external reference)
> - `create` — Create a new buyer (requires `clientId`)

### `relationships`

> View or create buyer-supplier relationships. Use when the user asks who a buyer's suppliers are, which buyers a supplier serves, or wants to link a buyer and supplier together.
>
> Actions:
> - `for_buyer` — Get all suppliers linked to a buyer
> - `for_supplier` — Get all buyers linked to a supplier
> - `link` — Create a new buyer-supplier link (returns error if link already exists)

### `imports`

> Manage file imports. Use when the user wants to upload a supplier CSV, check recent import batches, or validate imported data for quality issues like placeholder emails, invalid phone numbers, or cross-field contamination.
>
> Actions:
> - `upload` — Upload a CSV file for processing
> - `batches` — List recent import jobs with status and entity counts
> - `validate` — Check imported data for garbage/invalid content with remediation suggestions

### `matching`

> Monitor and review supplier matching jobs. Use when the user asks about matching progress, wants to see match candidates, or needs to review staged matches awaiting approval.
>
> Actions:
> - `jobs` — List matching jobs (filter by status to find jobs needing review)
> - `job_detail` — Get detailed status and category breakdown for a specific job
> - `candidates` — List candidates from an import file with match categories and confidence scores
> - `staged` — List staged matches awaiting review with AI recommendations

### `analyze`

> Analyze the supplier network for health, coverage, and quality. Use when the user asks about network health, wants to find gaps or isolated suppliers, or needs an assessment of import data quality. For viewing specific supplier or buyer data, use `suppliers` or `buyers` instead.
>
> Actions:
> - `connections` — Identify isolated nodes, network hubs, and suggest new connections
> - `relationships` — Assess relationship health, coverage gaps, or map network structure (requires `analysisType`)
> - `import_quality` — Post-upload validation, pre-import preview, or data quality scoring (requires `mode`)

### `notify_slack`

> Send messages to Slack via webhook. Use when the user wants to share results or alerts with the team.
>
> Types:
> - `analysis` — Post formatted network analysis results (pass the result from the `analyze` tool)
> - `custom` — Send a freeform message with title, body, fields, buttons, and color

### `lookup_client`

> Resolve a human-friendly client name to its UUID. Use when the user refers to a client by name (e.g., "Comet Electric") and you need the client ID for other tools. Fuzzy matches against the configuration store.
>
> Example: look up "Comet Electric" to get their client UUID for use with `buyers` or `relationships`.

---

## Server-Level Instructions

Add a top-level description to the MCP server that orients the LLM before it reads individual tool descriptions:

> "Supplier network management tools for Payvaro. Use `search` to find suppliers by name/address/email. Use `suppliers`, `buyers`, and `relationships` to view and manage entities. Use `imports` and `matching` for file upload and matching workflows. Use `analyze` for network health insights. Use `lookup_client` to resolve a client name to its UUID. Use `notify_slack` to send results to Slack."

---

## Error Handling Improvements

### Actionable error messages

Replace raw HTTP status codes with guidance:

| Scenario | Current | Proposed |
|---|---|---|
| 404 on supplier | `"Request failed with status code 404"` | `"Supplier not found with ID 'abc123'. Try using the search tool to find the supplier by name."` |
| 401 auth failure | `"Request failed with status code 401"` | `"Authentication failed. Check that NETWORK_API_KEY is set and valid."` |
| 400 bad request | `"Request failed with status code 400"` | `"Invalid request: [API error detail]. Check parameter format and try again."` |
| Missing required param | Zod error: `"Required at 'id'"` | `"The 'get' action requires a supplier ID. If you don't have the ID, use the search tool to find the supplier by name."` |

### Cross-tool hints

When a tool fails in a way that suggests a different tool would help:

- `buyers` get with unknown ID → `"Buyer not found. Try lookup_client to find the client ID by name, or use buyers with action 'list' to browse all buyers."`
- `matching` with nonexistent jobId → `"Matching job not found. Use matching with action 'jobs' to list available jobs."`
- `relationships` link that already exists → return the existing link info with a note: `"Link already exists between this buyer and supplier. Here are the current link details: ..."`

### Implementation approach

Wrap the existing `createErrorResponse()` helper to inspect error codes and add contextual guidance. The service layer stays untouched — error enrichment happens at the tool dispatch level in `index.ts`.

---

## Scope Boundaries

**In scope:**
- Consolidate 25 tools → 9 tools in `index.ts` tool registration
- Rewrite all tool descriptions with intent-driven language
- Redesign schemas with flat params + action enum pattern
- Update Zod schemas in `schemas/index.ts` to match new tool shapes
- Add action-based dispatch logic in each tool file
- Improve error messages with next-step guidance
- Add server-level instructions/description
- Remove `response_format` from all tool schemas
- Update `README.md` to reflect new tool names and structure

**Out of scope:**
- No new tools or features
- No workflow chaining or multi-tool orchestration
- No changes to service layer (matching.ts, formatter.ts, network-analyzer.ts, etc.)
- No changes to the underlying Network API calls
- No auth/permissions model
- No UI
- No changes to MCP prompts (can be updated separately)

---

## Files Changed

| File | Change |
|---|---|
| `src/index.ts` | Rewrite tool registration (ListTools handler) with 9 consolidated tools, new descriptions, new dispatch logic in CallTools handler |
| `src/schemas/index.ts` | Replace 23 Zod schemas with 9 consolidated schemas using action discriminators |
| `src/tools/suppliers.ts` | Add action-dispatch wrapper, keep existing functions as internal implementations |
| `src/tools/buyers.ts` | Add action-dispatch wrapper, absorb `getBuyerByClientId` into `get` action |
| `src/tools/analysis.ts` | Add action-dispatch wrapper for consolidated `analyze` and `notify_slack` tools |
| `src/tools/workflows.ts` | Split into `imports` and `matching` dispatch wrappers |
| `src/tools/clients.ts` | Minimal rename (drop `network_` prefix), keep implementation |
| `src/types.ts` | No changes expected |
| `src/constants.ts` | No changes expected |
| `src/services/*` | No changes |
| `README.md` | Update tool reference to reflect 9 consolidated tools |
| Tests | Update test expectations for new tool names and schemas |
