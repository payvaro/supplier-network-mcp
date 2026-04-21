# Payability Triage Skills — Design

**Date:** 2026-04-20
**Scope:** Two example skills packaged with the network-mcp-test MCP server to guide Claude through payability triage workflows.

## Problem

The MCP exposes 10 tools (`search`, `suppliers`, `buyers`, `relationships`, `imports`, `matching`, `rules`, `analyze`, `notify_slack`, `lookup_client`). Tool descriptions teach *what each tool does* but not *which sequence to run for a given question*. Every new session re-derives the workflow from scratch, which is slow and error-prone for recurring tasks like "why can't this buyer pay this supplier" or "how much of this tenant is payable."

## Solution

Ship two reference skills in this repo that encode the payability workflows:

1. **`network-payability-triage`** — pair-level diagnosis
2. **`network-payability-coverage`** — tenant-level coverage report

Skills live in `network-mcp-test/skills/` so they version with the MCP tool surface. The README gets a short install section (symlink into `~/.claude/skills/` or copy into the consuming project's `skills/` dir).

Both skills treat `/api/analysis/payability/resolve` (exposed via `rules trace`) as the authoritative payability check — they wrap and interpret its `DecisionTrace` response, they do not redefine "payable."

## Shared Conventions

Both skills follow the same preamble:

1. **Client resolution.** If the user names a client (e.g., "Comet Electric"), pass `asClientName` directly on downstream MCP calls. Only call `lookup_client` when the name is ambiguous or admin mode is off. If no client is given, use the default tenant (no override).
2. **Admin-mode check.** If the user asks about a specific client but `NETWORK_ADMIN_MODE` isn't enabled server-side, surface that and fall back to the default tenant rather than failing silently.
3. **Tool-first instructions.** Skills point at tool names and actions; they do not re-document tool schemas. Rule: "call `rules` with `action: trace`" not "here is what rules trace accepts."
4. **Output style.** Terse structured output — headers and bullets, copy-pasteable into a ticket. No prose walls.

## Skill 1: `network-payability-triage`

**Purpose:** Given a buyer + supplier (or a failed payment), walk the payability decision and produce a structured diagnosis.

**Triggers:** "why can't buyer X pay supplier Y", "diagnose failed payment", "triage this pair", "walk payability for…".

**Steps:**

1. Resolve the **buyer** — accept UUID directly; if a name is given, use `buyers list` or `search`-then-match.
2. Resolve the **supplier** — same, preferring `search` for fuzzy names.
3. Call `rules` with `action: trace`, `buyerId`, `supplierId`.
4. Interpret the `DecisionTrace`:
   - **Chosen path present** → report payable; name the acceptor/integration; note whether guard is clear.
   - **No chosen path** → identify the first blocking layer and cite the eliminated alternatives.
5. Map the blocking layer to a concrete **next action**:
   - Missing buyer-supplier link → `relationships` with `action: link`
   - No acceptor rule at any scope → `rules` with `action: list` at the parent `NETWORK_PARTNER` scope to see what exists
   - Guard not clear → surface the guard field and point to config
   - Supplier or buyer inactive → show status from `suppliers get` / `buyers get`

**Output template:**

```
Pair: <buyer name> → <supplier name>
Verdict: PAYABLE via <acceptor> (<payment type>)  |  BLOCKED at <layer>
Trace: <2–4 line summary of chosen path or elimination>
Next: <concrete tool call or config change>
```

## Skill 2: `network-payability-coverage`

**Purpose:** Given a client (optionally scoped to one buyer), report how many buyer-supplier pairs are payable, how many are blocked, and why.

**Triggers:** "coverage for client X", "how much of this tenant is payable", "payability report for…".

**Default scope:** one buyer. The skill does not enumerate an entire tenant unless the user explicitly opts in via `allBuyers: true`.

**Steps:**

1. Resolve the client via the shared preamble.
2. If no buyer is specified, call `buyers` with `action: list`, show the count, and ask the user to pick one — unless the user explicitly asked for a tenant-wide sweep.
3. For each scoped buyer, call `relationships` with `action: for_buyer` to get the supplier list.
4. For each buyer-supplier pair, call `rules` with `action: trace`.
5. Bucket results:
   - `payable` — chosen path present, guard clear
   - `routable_guard_blocked` — chosen path but guard not clear
   - `no_rule` — no acceptor rule at any scope
   - `other` — unexpected (log the raw trace reason for follow-up)
6. Print a summary (counts per bucket) followed by the list of non-payable pairs with one-line reasons and suggested next actions.
7. If scoped to a single buyer, footer: "Scoped to buyer X. Tenant has N buyers total. Run again with `allBuyers: true` to enumerate."

**Output template:**

```
Client: <name> (<uuid>)
Scope: <buyer name> — M suppliers
Summary: P payable / G guard-blocked / R no-rule / O other
Blocked:
  - <supplier>: <reason> (next: <action>)
  - …
Expand: run again with allBuyers: true for tenant sweep.
```

## Out of Scope (v1)

- **Slack posting.** Both skills stay read-only. Posting results via `notify_slack` is deferred; users can pipe output into Slack manually if needed.
- **Automated remediation.** Skills suggest next actions but never call `relationships link`, edit rules, or otherwise mutate state.
- **Automated tests for skill docs.** Skills are instruction text; validation is manual (see below).

## Validation

No automated tests for the skill docs themselves. Validation procedure:

1. Run the MCP locally (`npm start` against a seeded tenant, or point at a dev environment).
2. In Claude Desktop (or another MCP client with skill support), invoke each skill's trigger phrases against known-good and known-broken pairs.
3. Confirm output matches the templates and that the skill follows the documented tool sequence (visible in `~/Library/Logs/Claude/mcp*.log`).

Add a "Verifying packaged skills" subsection to the README pointing at this procedure.

## File Layout

```
network-mcp-test/
├── skills/
│   ├── network-payability-triage/
│   │   └── SKILL.md
│   └── network-payability-coverage/
│       └── SKILL.md
└── README.md   (new "Packaged Skills" section)
```

Each `SKILL.md` uses the standard frontmatter (`name`, `description`) followed by the instructions from the sections above.

## Risks

- **Tool surface drift.** If `rules trace` renames or its response shape changes, both skills rot silently. Mitigation: skills live in this repo and should be updated in the same PR as any tool-surface change. A future improvement is a lightweight CI check that greps skill docs for tool/action names and fails if they're absent from `src/index.ts`.
- **Large-tenant cost.** Coverage skill defaults to one buyer specifically to avoid accidental 10k-trace runs. Users opting into `allBuyers: true` accept the cost.
- **Admin-mode friction.** Users without admin mode can't scope to arbitrary clients. Skills detect this and fall back cleanly rather than failing.
