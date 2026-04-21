---
name: network-entity-lookup
description: Find a specific supplier or buyer on the Payvaro Network from a partial/fuzzy name, id, or external reference, and return a compact canonical record. Use when a user asks to find, look up, identify, or "who is" a supplier/buyer, when they're starting an investigation and need to resolve a name to an id, or any time a downstream task needs a buyer/supplier id but only the name is on hand. Favors disambiguating confidently over guessing. Requires the network-mcp server to be configured.
---

# Network Entity Lookup

Resolve a supplier or buyer to its canonical record. The output is designed to feed other skills (triage, coverage, traversal) that need a concrete `buyerId` or `supplierId`.

## When to use

Trigger when the user says any of:
- "Find supplier <name>"
- "Look up buyer <name>"
- "Who is <name>?"
- "Do we have a supplier called <name>?"
- "Get me the record for <name>"

If the user has already specified both a buyer and a supplier and wants to know if they can transact, that's `network-payability-triage`, not this skill.

## Preamble (shared)

1. **Client resolution.** If the user names a client, pass `asClientName: "<name>"` on every downstream call. Skip `lookup_client` unless the name is ambiguous. If the user does NOT name a client, use the default tenant (no override) and note `"(default tenant)"` in the output header so the reader knows nothing was scoped.
2. **Admin-mode check.** Overrides need `NETWORK_ADMIN_MODE=true`. On rejection (error mentions "admin override"), say so and fall back to the default tenant.
3. **Tool-first.** Call tools by name.
4. **Output.** Terse, structured, copy-pasteable.

## Disambiguation: supplier vs buyer

Usually obvious from context:
- "vendor", "service provider", anything the user *pays* → supplier
- "client's customer", "franchisee", "store", "location", anything that *pays out* through the network → buyer

If truly ambiguous, ask the user once. Don't search both silently — that wastes calls and confuses the output.

## Workflow — supplier lookup

### 1. Gather search inputs

Pull every field the user mentioned: name, address (street/city/state/postal), email. Partial data is fine; the fuzzy matcher weights what's present.

### 2. Call `search`

```
search(
  name: "<partial>",
  address: { ... },  // if provided
  email: "<if provided>",
  minMatchScore: 0.4,
  maxResults: 10
)
```

### 3. Pick a match — or disambiguate

- **Single result with score ≥ 0.8** → accept it.
- **Multiple results, top score ≥ 0.9 and gap to second ≥ 0.15** → accept the top one but mention what was runner-up.
- **Otherwise** → show the top 3–5 candidates with their match scores and ask the user to pick. Do not guess.

### 4. Fetch the canonical record (only if needed)

`search` already returns the full supplier record — addresses, contacts, and (when available) buyer links — so a separate `suppliers get` call is usually wasted work.

Only call `suppliers` with `action: get` when:
- The `search` result is missing `buyerLinks` and the user cares about relationships, OR
- The user explicitly asked for history (call `action: history` instead), OR
- You need a fresher read because the search result looks stale.

Pass `includeLinks: true` when the call is a prelude to traversal or triage.

### 5. Output (supplier)

Pull fields off the record with these fallbacks:
- `address`: first entry of `addresses[]` whose `addressType` is "Primary" (or just `addresses[0]` if none are marked). One line: `<street>, <city>, <state> <postal>`.
- `email`: first `contacts[]` entry where `type` is `PRIMARY` (fall back to `contacts[0].email`). If `contacts` is empty, print `"-"`.
- `links`: `buyerLinks.length` if present; omit the line if the record didn't include links.

```
Supplier: <name>
  id:       <id>
  status:   <status>
  address:  <one-line primary address or "-">
  email:    <primary contact email or "-">
  links:    <N buyers>                             | omit if buyerLinks not loaded
Match: <top score> (runner-up: <score> — <name>)   | omit if unambiguous
Next:
  - Traverse → network-traversal (buyers for this supplier)
  - Triage   → network-payability-triage (with a buyer)
  - History  → suppliers history id:<id>
```

## Workflow — buyer lookup

### 1. Decide the lookup key

- Internal id given → `buyers get` with `id: <id>`.
- External client reference given → `buyers get` with `clientId: <ref>`.
- Name given → `buyers list` (page through with `cursor` until found or exhausted) and filter client-side on `name`/`franchiseName`/`storeIdentifier`. There is no server-side buyer search today.

**Do not trust `buyerLinkCount` from the `list` response.** It can read `0` even when the buyer has active links. Use `relationships for_buyer` to count links if that's what the user asked for.

### 2. Disambiguate

If `buyers list` yields multiple plausible matches, show them and ask the user to pick. Be explicit that buyer matching is exact-ish (no fuzzy search) so typos will miss.

### 3. Output (buyer)

```
Buyer: <name> (<franchiseName or "-">)
  id:       <id>
  clientId: <external ref or "-">
  store:    <storeIdentifier or "-">
  status:   <status>
  address:  <one-line primary address or "-">
Next:
  - Traverse → network-traversal (suppliers for this buyer)
  - Coverage → network-payability-coverage (scoped to this buyer)
  - Triage   → network-payability-triage (with a supplier)
```

## Common pitfalls

- Do not call `search` for buyers — it is supplier-only.
- Do not accept a sub-0.6 match silently; the fuzzy matcher will happily return junk when the query and index barely overlap.
- Do not over-fetch. If the user only asked "do we have a supplier called Acme?", the answer is `suppliers get` on the resolved id — no need to pull history or analyze anything.
- Do not repeat `buyers list` pagination if the caller obviously wanted a single buyer — once the name is found, stop paging.
