---
name: network-traversal
description: Walk the Payvaro Network graph from a known starting entity — list the suppliers a buyer transacts with, the buyers that use a supplier, shared suppliers across buyers, or history for an entity. Use when a user asks "who does X transact with", "what suppliers does buyer Y use", "which buyers buy from supplier Z", "shared suppliers between A and B", or wants to walk/explore/traverse the network from a starting point. Resolves starting entities via the entity-lookup skill patterns when only names are given. Requires the network-mcp server to be configured.
---

# Network Traversal

Explore the buyer ↔ supplier graph from a starting entity. Produces compact lists and simple intersections. For diagnosing whether a specific pair can transact, use `network-payability-triage`.

## When to use

Trigger when the user says any of:
- "What suppliers does buyer X use?"
- "Which buyers buy from supplier Y?"
- "Who does X transact with?"
- "Shared suppliers between buyer A and buyer B"
- "Walk the network from <entity>"
- "What changed for <supplier>?" (history)
- "Who was updated on <date>?" (by date)

## Preamble (shared)

1. **Client resolution.** Pass `asClientName: "<name>"` on every downstream call when a client is named. If no client is named, use the default tenant (no override) and note `"(default tenant)"` in the output header.
2. **Admin-mode check.** Overrides need `NETWORK_ADMIN_MODE=true`. Fall back cleanly on rejection.
3. **Tool-first.** Call tools by name.
4. **Output.** Terse lists with counts; don't dump full records unless asked.

**Summary `counts` fields are unreliable** — confirmed by MVP-962. The same supplier/buyer can return different counter values across `search`, `buyers list`, `suppliers list`, `suppliers get`, and the underlying authoritative tables. Treat every `counts.*` field as a hint, never a fact:

- `buyerLinkCount` / `activeBuyerLinkCount` on a buyer summary may read 0 when active links exist. Confirm with `relationships for_buyer`.
- `acceptorIntegrationCount` / `activeAcceptorIntegrationCount` on a supplier summary may read 0 when an integration exists. Confirm with `acceptor_integrations list supplierId:<id>`.
- Don't conclude "X has no Y" from a counter alone. Always resolve to the authoritative collection first.

## Starting-entity resolution

If the user gave ids, use them. Otherwise resolve names using the same tactics as `network-entity-lookup` (inline — don't actually chain skills):

- Supplier name → `search` with fuzzy match, confirm if top score < 0.8.
- Buyer name → `buyers list` + client-side filter (no fuzzy buyer search available).

If a starting entity is ambiguous, stop and disambiguate before traversing. Don't traverse from a guess.

## Direction 1: Buyer → Suppliers

**Question:** "what suppliers does buyer X use?"

### Steps

1. Resolve the buyer id.
2. Call `relationships` with `action: for_buyer`, `buyerId: <id>`.
3. The relationship records return only ids, `connectionStatus`, and external references (`externalBuyerId`, `buyerLinkId`) — **not** supplier name/address/status. If the user asked for names, do ONE batch of `suppliers get` calls (one per supplier id) to enrich. Do not chain calls unnecessarily when the user just wanted a count or list of ids.

### Output

If enriched (names available):

```
Buyer: <name> (<id>)
Suppliers: N
  - <supplier name> (<supplier id>) — <city/state or "-"> — <status> [externalBuyerId: <val or "-">]
  - ...
  (cap at 20; append "+X more" if truncated)
```

If NOT enriched (ids only — the default when the user didn't ask for names):

```
Buyer: <name> (<id>)
Suppliers: N  (ids only; drill in with suppliers get for names/addresses)
  - <supplier id> — connectionStatus: <status> [externalBuyerId: <val or "-">]
  - ...
  (cap at 20; append "+X more" if truncated)
```

```
Next:
  - Triage a pair     → network-payability-triage
  - Coverage report   → network-payability-coverage
  - Drill into one    → suppliers get id:<id> includeLinks:true
```

## Direction 2: Supplier → Buyers

**Question:** "which buyers buy from supplier Y?"

### Steps

1. Resolve the supplier id.
2. Call `relationships` with `action: for_supplier`, `supplierId: <id>`.
3. Alternative for a quick view: `suppliers` with `action: get`, `id: <uuid>`, `includeLinks: true` includes the buyer-link list on the record. Use whichever is already loaded; don't call both.

### Output

`relationships for_supplier` returns buyer ids + external references, not buyer names. If the user asked for names, follow up with `buyers get` (one per id) OR use `suppliers get ... includeLinks:true` instead, which returns buyer summaries attached to the supplier in a single call. Prefer the latter.

```
Supplier: <name> (<id>)
Buyers: N
  - <buyer name or id> (<franchise/store or "-">) — [externalBuyerId: <val or "-">]
  - ...
  (cap at 20; append "+X more" if truncated)
Next:
  - Triage a pair     → network-payability-triage
  - Who else uses it  → analyze connections (if user wants network-wide view)
```

## Direction 3: Shared suppliers across buyers

**Question:** "which suppliers do buyers A and B both use?" or "overlap between <list of buyers>"

### Steps

1. Resolve each buyer id.
2. For each, call `relationships` with `action: for_buyer`.
3. Intersect supplier ids client-side.
4. Output the intersection; don't re-fetch per-supplier detail unless asked.

### Output

```
Buyers: <A>, <B>, <C>
Shared suppliers: M  (A:<countA> / B:<countB> / C:<countC> individually)
  - <supplier name> — used by all <N>
  - <supplier name> — used by <A, B>
  - ...
Unique to <A>: k    (show list only if user asks)
Unique to <B>: k
```

Keep the "unique to" blocks collapsed until asked — the shared set is usually what the user wants.

## Direction 4: History / change audit

**Question:** "what changed for supplier X?" or "show me supplier X's history"

### Steps

1. Resolve the supplier id.
2. Call `suppliers` with `action: history`, `id: <uuid>`, `format: "compact"` (default) or `"timeline"` if the user wants a chronological narrative.
3. Do not fall back to `suppliers get` unless the user explicitly asks for the current record too.

### Output

Passthrough of the formatter's output — it's already structured. Optionally prepend:

```
Supplier: <name> (<uuid>)
History (compact/timeline):
```

## Direction 5: Who changed on a date

**Question:** "which suppliers were updated on 2026-04-15?"

### Steps

1. Convert date to `yyyyMMdd` format (the tool rejects anything else).
2. Call `suppliers` with `action: by_date`, `date: "20260415"`.
3. List the names; cap at 30; offer drill-in hints.

### Output

```
Date: 2026-04-15
Suppliers updated: N
  - <name> (<uuid>)
  - ...
Next: history id:<uuid>  for any individual supplier.
```

## Common pitfalls

- Do not use `analyze` for these questions. `analyze` is for network-wide health and coverage metrics, not named-entity traversal.
- Do not call `relationships for_buyer` and `suppliers get includeLinks:true` both for the same question — pick one.
- Do not parallelize the intersection calls with a flood of `suppliers get` lookups. The relationship payload is enough for the list; drill in only when asked.
- When a starting entity doesn't resolve, stop and say so. Don't traverse from "probably this one."
- `buyers` has no fuzzy search. Remind the user if their buyer-name query misses — a typo will not forgive.
