import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

export interface FixBuyerExternalIdsArgs {
  buyerId?: string;
  asClientId?: string;
  asClientName?: string;
}

export function generateFixBuyerExternalIdsPrompt(
  args: FixBuyerExternalIdsArgs,
): GetPromptResult {
  const scope = args.asClientId
    ? `- asClientId: "${args.asClientId}"`
    : args.asClientName
      ? `- asClientName: "${args.asClientName}"`
      : "";
  const buyerLine = args.buyerId
    ? `- id: "${args.buyerId}"`
    : "(ask the user for the buyer UUID)";

  const text = `# Fix Buyer External IDs Workflow

Repair missing or malformed external identifiers on a buyer (e.g. clientId,
alternateRefs) so import-driven link creation can match this buyer.

## Phase 1 — Inspect current state

Call the \`buyers\` tool:

\`\`\`
action: "get"
${buyerLine}
${scope}
\`\`\`

Show the user the current \`clientId\` and \`alternateRefs\`. Identify the
specific malformation (missing, sentinel value, prefix-only, etc.).

## Phase 2 — Confirm new values

Ask the user for the corrected values. Confirm before proceeding.

## Phase 3 — Dry-run preview

Call \`buyers\` with:

\`\`\`
action: "update_external_refs"
${buyerLine}
externalRefs:
  clientId: <new value, if changing>
  alternateRefs: [<list>, if changing]
dryRun: true
${scope}
\`\`\`

Show the user the diff (before / proposed / updateMask). On approval, continue.

## Phase 4 — Persist

Re-invoke with \`dryRun: false\`. If running against prod, also set
\`confirm: true\` (server requires \`NETWORK_ADMIN_MODE=true\`).

## Phase 5 — Verify

Re-run \`buyers.get\`. Confirm the corrected fields are persisted. Report.`;

  return {
    description: "Repair missing/malformed buyer external IDs.",
    messages: [{ role: "user", content: { type: "text", text } }],
  };
}
