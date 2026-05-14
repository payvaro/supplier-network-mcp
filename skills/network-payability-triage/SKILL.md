---
name: network-payability-triage
description: Diagnose why a specific buyer-supplier pair is or isn't payable on the Payvaro Network. Use when a user reports a failed payment, asks "why can't buyer X pay supplier Y", wants to triage a pair, or asks to walk the payability decision for a given pair. Requires the network-mcp server to be configured.
---

# Network Payability Triage (pair-level)

Diagnose a single buyer-supplier pair using the network-mcp tools. Produces a structured verdict, a short trace, and a concrete next action.

## When to use

Trigger when the user asks any of:
- "Why can't buyer X pay supplier Y?"
- "Diagnose this failed payment"
- "Triage this pair"
- "Walk payability for <buyer> → <supplier>"

For tenant-wide coverage questions ("how much of client X is payable"), use `network-payability-coverage` instead.

## Prerequisite: `rules` tool

This skill depends on the `rules` MCP tool (action: `trace`), which was added to the network-mcp server in the "config rules explorer" release. If your installed MCP does not expose a `rules` tool, **stop and tell the user**: "Payability trace requires the `rules` tool, which isn't available on this network-mcp build. The installed plugin needs to be updated to include it." Do not try to reconstruct the payability logic from other tools — the answer would be wrong.

## Preamble (shared with coverage skill)

1. **Client resolution.** If the user names a client (e.g. "Comet Electric"), pass `asClientName: "Comet Electric"` directly on every downstream MCP call. Do NOT call `lookup_client` first unless the name is ambiguous. If no client is named, omit the override, use the default tenant, and note `"(default tenant)"` in the output's `Client:` line.
2. **Admin-mode check.** `asClientName` / `asClientId` only work when the server runs with `NETWORK_ADMIN_MODE=true` and the installed MCP exposes those fields. If a call rejects with an admin-override error, or the schema doesn't declare the field, tell the user admin mode is off (or unsupported by this MCP build) and re-run against the default tenant.
3. **Tool-first.** Call MCP tools by name — do not re-explain their schemas to the user.
4. **Output.** Terse, structured, copy-pasteable. No prose walls.

## Workflow

### 1. Resolve the buyer

- If the user gave a UUID, use it.
- If the user gave a name, call `buyers` with `action: list` (paginate if needed) and match; if still ambiguous, ask the user to disambiguate from the candidates.
- If the user gave an external client reference, call `buyers` with `action: get` and `clientId: <ref>`.

### 2. Resolve the supplier

- If the user gave a UUID, use it.
- Otherwise call `search` with the supplier name (and any known address/email fields) and pick the top match. Show confidence score; if below `0.8`, confirm with the user before proceeding.

### 2b. Short-circuit: is the supplier payable to anyone?

Before tracing, call `acceptor_integrations` with `action: list`, `supplierId: <id>`. If it returns zero rows, the supplier has no acceptor integration at all and is unpayable to *every* buyer — the buyer in this pair is incidental. Output:

```
Pair: <buyer name> → <supplier name>
Verdict: BLOCKED — supplier not payable (no acceptor integrations)
Next: network-fix-acceptor-integration  (create an integration for this supplier first)
```

Then stop. Don't run the trace — it will just return both-empty and obscure the real cause.

If at least one ACTIVE integration exists, proceed to step 3.

### 3. Run the payability trace

Call `rules` with:

- `action: "trace"`
- `buyerId: <resolved buyer UUID>`
- `supplierId: <resolved supplier UUID>`
- `format: "compact"`

If the user mentioned a specific payment type, pass `paymentType`. If they want guard-clearance enforced, pass `requireClear: true`.

### 4. Interpret the `DecisionTrace`

Three shapes to distinguish:

- **Chosen path present** → pair is payable. Name the acceptor and payment type. If the guard is not clear, flag it as a warning but keep the verdict as `PAYABLE`.
- **No chosen path, `eliminated` non-empty** → pair is blocked *at rule evaluation*. Identify the first layer that eliminated every candidate and cite the elimination reason from the trace.
- **No chosen path AND `eliminated` empty (both zero-length)** → two distinct root causes can produce this shape; you must disambiguate, not assume:
  - **(a) No acceptor rules in the hierarchy.** `NETWORK_PARTNER`, `AGGREGATOR`, and entity-level scopes have no rules that match. Verdict: `BLOCKED at rule configuration (no candidates)`. Almost always means the tenant was never configured end-to-end.
  - **(b) Rules exist but the supplier's `AcceptorSupplierRef` (`NSR#`) edge is missing.** The integration row exists in `acceptor_integrations list` but the rules engine can't see it as a candidate because the supplier→acceptor reference is absent — this is the [MVP-960](https://payvaro.atlassian.net/browse/MVP-960) bug. Confirmed when `acceptors for_supplier supplierId:<id>` returns 404 *and* `acceptor_integrations list` returns ≥1 row. Verdict: `BLOCKED — AcceptorSupplierRef (NSR#) missing for an existing integration (MVP-960)`.

  Always cross-check with `acceptor_integrations list` and `acceptors for_supplier` before declaring "no rules configured" — they have very different fixes.

### 5. Map blocker → next action

| Blocking layer | Next action |
|----------------|-------------|
| No buyer-supplier link | Call `relationships` with `action: link` (requires `buyerId`, `supplierId`) |
| No acceptor rule at any scope (both-empty AND `acceptor_integrations list` returns rows AND `acceptors for_supplier` succeeds) | Call `rules` with `action: list`, `scopeType: "NETWORK_PARTNER"`, `scopeId: <partner id>` at the parent scope. Partner id isn't always visible on the buyer/link record — try `suppliers get includeLinks:true`, or ask the user which partner scope to check. (Avoid `analyze connections` for partner id — see MVP-962.) |
| NSR# AcceptorSupplierRef missing (both-empty AND `acceptor_integrations list` returns rows AND `acceptors for_supplier` 404s) | This is MVP-960. No skill-driven fix today — a repair migration must reconstruct `NSR#` rows from `AcceptorIntegration` data. Flag to the user and link MVP-960. |
| Supplier has zero integrations (caught in step 2b, never reaches trace) | Use `network-fix-acceptor-integration` to create one. |
| Guard not clear | Surface the guard field from the trace; point the user at the config owner |
| Supplier or buyer inactive | Call `suppliers get` / `buyers get` and report the status field |
| Other / unknown | Print the raw elimination reason and ask the user for context |

### 6. Output

Use this template exactly:

```
Pair: <buyer name> → <supplier name>
Client: <client name or "(default tenant)">
Verdict: PAYABLE via <acceptor> (<payment type>)   |   BLOCKED at <layer>
Trace:
  - <step 1 of chosen path or elimination>
  - <step 2>
  - <step 3>
Next: <concrete tool call or config change>
```

Keep the whole block under ~15 lines. If the user wants the raw trace, re-run step 3 with `format: "full"`.

## Common pitfalls

- Do not re-implement payability logic locally. The `rules trace` response is the source of truth.
- Do not call `analyze` for pair-level questions — it is for network-wide assessments.
- If `rules trace` returns an error rather than a `DecisionTrace`, surface the error verbatim; don't guess at the cause.
