# Payability Triage Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two reference skills (`network-payability-triage`, `network-payability-coverage`) in this repo so users of the network-mcp server have ready-made workflows for pair-level and tenant-level payability triage.

**Architecture:** Each skill is a single `SKILL.md` file under `network-mcp-test/skills/<skill-name>/`. Skills contain instruction prose only (no code, no tests — they guide Claude through existing MCP tool calls). The README gets a "Packaged Skills" section explaining install + verification. Source-of-truth for payability remains the server-side `/api/analysis/payability/resolve` endpoint reached via the `rules` tool (`action: trace`).

**Tech Stack:** Markdown + YAML frontmatter. No build step. Skills are auto-discovered by Claude Code / Codex from the symlinked skills directory.

**Spec:** `docs/superpowers/specs/2026-04-20-payability-skills-design.md`

---

## File Structure

- Create: `skills/network-payability-triage/SKILL.md`
- Create: `skills/network-payability-coverage/SKILL.md`
- Modify: `README.md` — insert "Packaged Skills" section before `## License` (around line 544)

No automated tests. Validation is manual (see Task 4).

---

## Task 1: Create `network-payability-triage` skill

**Files:**
- Create: `skills/network-payability-triage/SKILL.md`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p /Users/ryan/codebase/network-mcp-test/skills/network-payability-triage
```

- [ ] **Step 2: Write `SKILL.md`**

Write the following to `/Users/ryan/codebase/network-mcp-test/skills/network-payability-triage/SKILL.md`:

````markdown
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

## Preamble (shared with coverage skill)

1. **Client resolution.** If the user names a client (e.g. "Comet Electric"), pass `asClientName: "Comet Electric"` directly on every downstream MCP call. Do NOT call `lookup_client` first unless the name is ambiguous or admin mode is off. If no client is named, omit the override and use the default tenant.
2. **Admin-mode check.** `asClientName` / `asClientId` only work when the server runs with `NETWORK_ADMIN_MODE=true`. If a call rejects with an admin-override error, tell the user admin mode is off and re-run against the default tenant.
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

### 3. Run the payability trace

Call `rules` with:

- `action: "trace"`
- `buyerId: <resolved buyer UUID>`
- `supplierId: <resolved supplier UUID>`
- `format: "compact"`

If the user mentioned a specific payment type, pass `paymentType`. If they want guard-clearance enforced, pass `requireClear: true`.

### 4. Interpret the `DecisionTrace`

- **Chosen path present** → pair is payable. Name the acceptor and payment type. If the guard is not clear, flag it as a warning but keep the verdict as `PAYABLE`.
- **No chosen path** → pair is blocked. Identify the first layer that eliminated every candidate and cite the elimination reason.

### 5. Map blocker → next action

| Blocking layer | Next action |
|----------------|-------------|
| No buyer-supplier link | Call `relationships` with `action: link` (requires `buyerId`, `supplierId`) |
| No acceptor rule at any scope | Call `rules` with `action: list`, `scopeType: "NETWORK_PARTNER"`, `scopeId: <partner id>` to see what exists at the parent scope |
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
````

- [ ] **Step 3: Verify file exists and frontmatter parses**

Run:
```bash
head -5 /Users/ryan/codebase/network-mcp-test/skills/network-payability-triage/SKILL.md
```
Expected: prints the YAML frontmatter (`---`, `name:`, `description:`, `---`).

- [ ] **Step 4: Commit**

```bash
cd /Users/ryan/codebase/network-mcp-test
git add skills/network-payability-triage/SKILL.md
git commit -m "skills: add network-payability-triage pair-level skill"
```

---

## Task 2: Create `network-payability-coverage` skill

**Files:**
- Create: `skills/network-payability-coverage/SKILL.md`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p /Users/ryan/codebase/network-mcp-test/skills/network-payability-coverage
```

- [ ] **Step 2: Write `SKILL.md`**

Write the following to `/Users/ryan/codebase/network-mcp-test/skills/network-payability-coverage/SKILL.md`:

````markdown
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

## Preamble (shared with triage skill)

1. **Client resolution.** If the user names a client, pass `asClientName: "<name>"` on every downstream call. Skip `lookup_client` unless the name is ambiguous or admin mode is off.
2. **Admin-mode check.** Overrides require `NETWORK_ADMIN_MODE=true` server-side. On rejection, say so and fall back to the default tenant.
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
````

- [ ] **Step 3: Verify file exists and frontmatter parses**

Run:
```bash
head -5 /Users/ryan/codebase/network-mcp-test/skills/network-payability-coverage/SKILL.md
```
Expected: prints the YAML frontmatter.

- [ ] **Step 4: Commit**

```bash
cd /Users/ryan/codebase/network-mcp-test
git add skills/network-payability-coverage/SKILL.md
git commit -m "skills: add network-payability-coverage tenant-level skill"
```

---

## Task 3: Add "Packaged Skills" section to README

**Files:**
- Modify: `README.md` — insert a new section before `## License` (currently line 544)

- [ ] **Step 1: Insert the new section**

Use Edit to replace the existing `## License` heading with the new section followed by the original heading. The `old_string` is the "## License\n\nApache 2.0" block; the `new_string` prepends the "Packaged Skills" section.

Old string (lines 544-546 of README.md):

```
## License

Apache 2.0
```

New string:

````
## Packaged Skills

This repo ships reference skills under `skills/` that encode common network-mcp workflows. They live here (not in a shared skills directory) so they version alongside the tool surface.

| Skill | Purpose |
|-------|---------|
| `network-payability-triage` | Diagnose a single buyer-supplier pair: is it payable, and if not, why? |
| `network-payability-coverage` | Report coverage across a client's network with bucketed blockers. |

### Install

Claude Code and Codex auto-discover skills from their respective skills directories. To make these skills available, symlink (or copy) each skill directory into your local skills store:

```bash
# macOS / Linux — Claude Code
ln -s "$(pwd)/skills/network-payability-triage" ~/.claude/skills/network-payability-triage
ln -s "$(pwd)/skills/network-payability-coverage" ~/.claude/skills/network-payability-coverage

# Codex
ln -s "$(pwd)/skills/network-payability-triage" ~/.codex/skills/network-payability-triage
ln -s "$(pwd)/skills/network-payability-coverage" ~/.codex/skills/network-payability-coverage
```

If your editor uses a different skills layout, copy the `skills/<skill-name>/SKILL.md` file into the location that tool expects.

### Verifying packaged skills

Skills are instruction text, not code, so there are no automated tests. To validate a change:

1. Start the MCP locally against a seeded tenant: `npm start` (see the [Usage](#usage) section).
2. Open an MCP-aware client (Claude Desktop, etc.) with the skill installed.
3. Invoke each skill's trigger phrases against a known-good pair and a known-broken pair.
4. Confirm the output matches the template in the skill's `SKILL.md`.
5. Check `~/Library/Logs/Claude/mcp*.log` to verify the skill called the documented tool sequence.

## License

Apache 2.0
````

Call:
```
Edit file_path="/Users/ryan/codebase/network-mcp-test/README.md" old_string="## License

Apache 2.0" new_string="<new string above>"
```

- [ ] **Step 2: Verify the section was inserted**

Run:
```bash
grep -n "^## " /Users/ryan/codebase/network-mcp-test/README.md | tail -5
```
Expected output includes both `## Packaged Skills` and `## License`, with Packaged Skills appearing before License.

- [ ] **Step 3: Commit**

```bash
cd /Users/ryan/codebase/network-mcp-test
git add README.md
git commit -m "docs: document packaged skills in README"
```

---

## Task 4: Manual validation checklist

No code to run. This task documents the validation steps so the author can confirm the skills actually work before considering the feature done.

- [ ] **Step 1: Build and start the MCP**

```bash
cd /Users/ryan/codebase/network-mcp-test
npm install
npm run build
npm start
```
Expected: `Network MCP Server running on stdio` on stderr; no crash.

- [ ] **Step 2: Install the skills locally**

Run the symlink commands from the README's "Install" subsection for whichever client you use (Claude Code or Codex).

- [ ] **Step 3: Trigger `network-payability-triage`**

In your MCP-aware client, ask:
> "Walk payability for buyer <known-good-buyer-name> → supplier <known-good-supplier-name> on client <known-client-name>."

Expected: the skill follows the workflow (resolve buyer → resolve supplier → call `rules trace` → output the template). Verdict should be `PAYABLE`.

Then ask the same with a known-broken pair. Expected: `BLOCKED at <layer>` with a concrete next action.

- [ ] **Step 4: Trigger `network-payability-coverage`**

Ask:
> "Coverage report for client <known-client-name>, buyer <known-buyer-name>."

Expected: header with client + scope, bucket summary (`P payable / G guard-blocked / R no-rule / O other`), blocker list, and the footer hint about `allBuyers: true`.

- [ ] **Step 5: No commit**

This task produces no repo changes. If any step fails, open a fix commit against the relevant skill file; otherwise the feature is done.

---

## Self-review notes

- **Spec coverage check:** every numbered section in the spec is implemented by a task above (Shared Conventions → preambles in Tasks 1 & 2; Skill 1 → Task 1; Skill 2 → Task 2; Out of Scope → enforced by omission, reinforced in skill "common pitfalls"; Validation → Task 4; File Layout → Tasks 1–3; Risks → not code-actionable, documented in spec).
- **Placeholders:** none. Every step has exact paths, exact content, or exact commands.
- **Type consistency:** skill names, bucket names (`payable`, `routable_guard_blocked`, `no_rule`, `other`), action names (`trace`, `link`, `list`, `for_buyer`), and frontmatter fields (`name`, `description`) match between the two skills and the spec.
