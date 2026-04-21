---
name: network-payability-coverage
description: Report how much of a Payvaro Network client's buyer-supplier network is payable and bucket the blockers. Use when a user asks for a coverage report, wants to know "how much of client X is payable", is doing post-onboarding review, or wants to audit payability across a tenant. Scoped to one buyer by default; opt into `allBuyers: true` for a tenant sweep. Requires the network-mcp server to be configured.
---

# Network Payability Coverage (tenant-level)

Aggregate payability across a client's buyer-supplier relationships. Produces bucket counts and a short list of blocked pairs with reasons.

## When to use

Trigger when the user asks any of:
- "Coverage for client X"
- "How much of this tenant is payable?"
- "Payability report for <client>"
- "Audit <client>'s network"

For a single-pair diagnosis, use `network-payability-triage` instead.

## Prerequisite: `rules` tool

This skill depends on the `rules` MCP tool (action: `trace`), which was added in the "config rules explorer" release. If your installed MCP does not expose a `rules` tool, **stop and tell the user**: "Coverage report requires the `rules` tool, which isn't available on this network-mcp build. The installed plugin needs to be updated to include it." Don't try to approximate coverage from link presence alone — a link existing doesn't mean the pair is payable.

## Preamble (shared with triage skill)

1. **Client resolution.** If the user names a client, pass `asClientName: "<name>"` on every downstream call. Skip `lookup_client` unless the name is ambiguous. If no client is named, use the default tenant and note `"(default tenant)"` in the output header.
2. **Admin-mode check.** Overrides require `NETWORK_ADMIN_MODE=true` server-side AND the installed MCP must declare `asClientName`/`asClientId` on the tool schema. On rejection (or when the field isn't in the schema), say so and fall back to the default tenant.
3. **Tool-first.** Reference MCP tools by name; do not re-explain schemas.
4. **Output.** Terse, structured, copy-pasteable.

## Scope rules

- **Default:** one buyer. If the user did not pick one, call `buyers` with `action: list`, show the count, and ask them to choose. Exception: if the user explicitly asks for a tenant-wide sweep (says "all buyers", "whole tenant", "everything"), skip the prompt.
- **Opt-in tenant sweep:** only enumerate every buyer when the user says so explicitly, or when they re-run with `allBuyers: true` per the footer hint.

## Workflow

### 1. Resolve the client

Per preamble. If the user gave no client name, proceed against the default tenant and say so in the output header.

### 2. Pick the buyer scope

- Single-buyer mode (default): `buyers` with `action: list`. If the user already named a buyer, resolve it (by UUID, `clientId`, or by matching `name` from the list).
- Tenant-sweep mode: iterate every buyer returned by `buyers list` (page through with `cursor`).

### 3. Enumerate pairs per buyer

For each buyer in scope, call `relationships` with `action: for_buyer`, `buyerId: <id>`. This returns the supplier list for that buyer.

### 4. Trace each pair

For each buyer-supplier pair, call `rules` with:
- `action: "trace"`
- `buyerId`, `supplierId`
- `format: "compact"`

Run these sequentially; do not parallelize (the MCP client is a singleton and we want deterministic ordering in output).

### 5. Bucket results

Bucket by the `DecisionTrace` outcome:

| Bucket | Definition |
|--------|------------|
| `payable` | Chosen path present, guard clear |
| `routable_guard_blocked` | Chosen path present, guard not clear |
| `no_rule` | No chosen path; elimination reason is "no acceptor rule at any scope" |
| `other` | No chosen path for some other reason — record the raw reason |

Note: there is no `no_link` bucket because we enumerate via `relationships for_buyer`, which only returns existing links.

### 6. Output

Use this template exactly:

```
Client: <name or "(default tenant)"> (<uuid or "-">)
Scope: <buyer name> — M suppliers         (or "All buyers (N) — K pairs" for sweep)
Summary: P payable / G guard-blocked / R no-rule / O other
Blocked:
  - <supplier>: <reason> (next: <action>)
  - <supplier>: <reason> (next: <action>)
  - ... (cap at 15 rows; include "+X more" if truncated)
Expand: run again with allBuyers: true for tenant sweep.   (omit on sweep runs)
```

For the `next:` column, map blocker → action using the same table as `network-payability-triage` step 5.

## Cost guidance

A tenant sweep with 50 buyers × 200 suppliers = 10,000 `rules trace` calls. Warn the user up-front if the buyer list returned by step 2 has more than 20 buyers and they opted into a sweep:

> "Tenant has N buyers; sweep will run ~<estimate> trace calls. Continue? (y/n)"

Only proceed after explicit confirmation.

## Common pitfalls

- Do not use `analyze` with `action: relationships` as a substitute — it does not evaluate payability.
- Do not summarize buckets without listing the blockers; the list is the useful part.
- Do not post to Slack from this skill. If the user wants to share, they can pipe the output into `notify_slack` themselves.
