# Config Rules Explorer — MCP Tool Design

**Date:** 2026-04-18
**Status:** Draft — pending user review
**Goal:** Expose the Network API's existing config-rules surface through the MCP so users can (C) discover rules across the hierarchy, (A) understand why a specific decision was made, and (B) — deferred — preview the impact of proposed changes.

---

## Motivation

The network service has a fully developed config-rules system: hierarchical rules keyed by scope (PAYMENT_RAIL > ACCEPTOR > BUYER > SUPPLIER > NETWORK_PARTNER, plus BUYER_LINK), pluggable rule evaluators (netting, payment-method constraints, transaction splits), and decision-trace tooling. The REST API already exposes list, effective-resolution, and decision-trace endpoints.

Today, exploring rules requires raw curl or a database query. This spec adds a single `rules` MCP tool so rules can be browsed and explained through the same conversational flow already used for suppliers, buyers, and relationships.

Scope priorities, in order: **C (discovery) → A (debug) → B (impact preview)**. This spec ships C + A. B (simulation) is deferred — noted in "Deferred" below.

---

## Scope

**In scope (v1):**
- List config rules filtered by scope (any of the six scope types).
- Resolve the effective rule stack for a target entity, with a hierarchy trace.
- Produce a decision trace for a buyer-supplier pair (why this integration/acceptor won, what was eliminated).
- Compact and full output formats, with compact as default.
- Admin-mode `asClientId` / `asClientName` override threaded through the same way the existing tools do it.

**Out of scope (v1):**
- Simulation / impact preview (`/api/analysis/simulate`, `/api/analysis/simulate/batch`). Deferred.
- Rule mutation (create/patch/delete). The API supports it, but MCP-driven write operations on rules are not a v1 need.
- Single-rule GET by `ruleId` — the API does not expose it, and `list` with a scope filter covers the same need.

---

## Architecture

A new tool `rules` lives in `src/tools/rules.ts`. Zod schema in `src/schemas/index.ts`. Registered in `src/index.ts` alongside the existing consolidated tools.

Follows existing project patterns exactly:
- Consolidated tool with `action` dispatch.
- `superRefine` on the Zod schema enforces per-action required fields.
- Admin-mode override: `asClientId` / `asClientName` checked via `isAdminMode()`; rejected via `createAdminOverrideRejectedError` when disabled; scoped client obtained via `getNetworkAPIClient().withClientIdOverride(id)` and threaded as a `clientOverride?: NetworkAPIClient` final argument to each inner handler.
- Default client from singleton: `const client = clientOverride ?? getNetworkAPIClient();`.

### Action → endpoint map

| Action | HTTP | Endpoint | Required input |
|---|---|---|---|
| `list` | GET | `/api/admin/config-rules?scopeType=&scopeId=&pageSize=&cursor=` | `scopeType`, `scopeId` |
| `effective` | GET | `/api/config-rules/effective?entityType=&entityId=` | `entityType`, `entityId` |
| `trace` | GET | `/api/analysis/payability/resolve?buyerId=&supplierId=&includeTrace=true&…` | `buyerId`, `supplierId` |

Three actions, one HTTP call each, no new network-side logic.

**Why `/api/admin/config-rules` for `list`:** It covers every scope type (including PAYMENT_RAIL and ACCEPTOR, which have no per-entity endpoints), supports pagination, and accepts `scopeType` + `scopeId` directly. Routing per-entity through the `/api/{suppliers|buyers|buyer-links|network-partners}/{id}/config-rules` endpoints would be functionally equivalent for four of the six scope types and force a branching code path for no gain.

---

## Tool schema

Zod schema shape (condensed):

```ts
const RulesSchema = z.object({
  action: z.enum(["list", "effective", "trace"]),

  // list
  scopeType: z.enum([
    "BUYER", "SUPPLIER", "BUYER_LINK",
    "NETWORK_PARTNER", "ACCEPTOR", "PAYMENT_RAIL",
  ]).optional(),
  scopeId: z.string().optional(),
  pageSize: z.number().int().min(1).max(100).default(20).optional(),
  cursor: z.string().optional(),

  // effective
  entityType: z.enum([
    "SUPPLIER", "BUYER", "BUYER_LINK", "NETWORK_PARTNER", "AGGREGATOR",
  ]).optional(),
  entityId: z.string().optional(),

  // trace
  buyerId: z.string().optional(),
  supplierId: z.string().optional(),
  paymentType: z.string().optional(),
  acceptorId: z.string().optional(),
  requireClear: z.boolean().optional(),

  // universal
  format: z.enum(["compact", "full"]).default("compact"),
  asClientId: z.string().optional(),
  asClientName: z.string().optional(),
}).superRefine((v, ctx) => {
  if (v.action === "list"      && (!v.scopeType  || !v.scopeId))  ctx.addIssue(/* scopeType+scopeId required for list */);
  if (v.action === "effective" && (!v.entityType || !v.entityId)) ctx.addIssue(/* entityType+entityId required for effective */);
  if (v.action === "trace"     && (!v.buyerId    || !v.supplierId)) ctx.addIssue(/* buyerId+supplierId required for trace */);
});
```

`includeTrace=true` is hard-coded when calling the `payability/resolve` endpoint for `trace`. No reason to expose a trace action without the trace.

---

## Output formats

Pattern borrowed from the existing `suppliers` tool's `history` action, which already exposes a `format` option.

### `list`

Already flat. `compact` and `full` are identical — pass through the API response:

```json
{ "rules": [ /* ConfigRuleDto items */ ], "pagination": { … } }
```

### `effective` — compact

Collapses the per-directive hierarchy trace to one row per directive, winner first, contributing sources tagged with `applied: true|false`:

```json
{
  "entity": { "type": "BUYER", "id": "BUY-IT-005" },
  "directives": [
    {
      "directiveType": "NETTING",
      "winner": {
        "ruleId": "r-123",
        "scopeType": "BUYER",
        "scopeId": "BUY-IT-005",
        "value": "ENABLED"
      },
      "contributingSources": [
        { "level": "BUYER",           "ruleId": "r-123", "value": "ENABLED",  "applied": true },
        { "level": "NETWORK_PARTNER", "ruleId": "r-044", "value": "DISABLED", "applied": false, "reason": "overridden by BUYER" }
      ]
    }
  ]
}
```

One glance answers: which directive, what won, what it beat, why.

### `trace` — compact

Flattens the decision trace to the chosen path plus eliminated alternatives:

```json
{
  "pair": { "buyerId": "…", "supplierId": "…" },
  "resolved": { "acceptorId": "…", "integrationId": "…", "paymentType": "CARD" },
  "chosenPath": [
    { "step": "payment-type-filter", "outcome": "CARD allowed", "ruleId": "r-501" },
    { "step": "acceptor-selection",  "outcome": "WEX wins",      "ruleId": "r-612" }
  ],
  "eliminated": [
    { "acceptorId": "…", "reason": "require-clear failed", "ruleId": "r-555" }
  ]
}
```

### `full`

Both `effective` and `trace` return the raw API response verbatim when `format: "full"`.

### Compact-mapper caveat

Shapes above are inferred from DTO names (`EffectiveRuleResponseDto`, `EffectiveRuleTraceDto`, `ContributingSourceDto`, `DecisionTraceDto`, `EliminatedPathDto`). The compact mappers will be verified against real API responses during implementation and adjusted if the actual field names/shapes differ. If a field the mapper expects is missing at runtime, that section of the output falls through to the raw shape rather than throwing — protects the tool against DTO drift.

---

## Error handling

All paths reuse existing infrastructure:

- **Axios errors** → the existing `NetworkAPIClient` error formatter (sanitized API key, HTTP status, server message).
- **Admin-override rejection** (`asClientId` / `asClientName` with `NETWORK_ADMIN_MODE` disabled) → `createAdminOverrideRejectedError`.
- **Zod validation failures** → the standard MCP error response path used by every other tool.
- **404 on `effective` / `trace`** (unknown entity or pair) → surface the API message verbatim; no special casing.
- **Compact-mapper defensive fallback** → per-section, as noted above.

No new error types.

---

## Testing

Vitest, matching the existing `src/tools/*` test style. Three layers:

**1. Schema tests** — one test per `superRefine` branch (each action's required-field enforcement), plus the admin-override rejection path.

**2. Handler tests** — axios mocked. For each action: one compact-format happy path, one full-format happy path, one 4xx/5xx error path. Expected test count: 9 handler tests.

**3. Compact-mapper tests** — pure functions driven by fixture JSON. Fixtures are hand-built against the DTO schemas initially; replaced with captures from the real API as they become available. Covers the winner / contributing-sources partition in `effective` and the chosen-path / eliminated partition in `trace`.

No live-API integration tests — consistent with the rest of this repo.

---

## Deferred

- **Simulation / impact preview.** `POST /api/analysis/simulate` and `/api/analysis/simulate/batch` already exist. Once v1 is in users' hands, add a `simulate` action to the same `rules` tool with inputs for proposed changes and target pair(s) or scope. This is the natural third action and slots into the existing schema without disruption.
- **Rule mutation.** `PATCH` / `DELETE` / `POST` endpoints exist. Not yet a need through MCP; revisit once read-path usage produces a clear "I want to fix this from here" signal.

---

## Open questions

None at sign-off. Items to confirm during implementation:

1. Actual field names/shapes of `EffectiveRuleResponseDto` and the decision-trace response — verify against a running instance and adjust the compact mappers as needed.
2. Whether the `payability/resolve` endpoint requires any additional parameters in practice (e.g., the `ClientIdHeader`) beyond what admin-mode already threads.
