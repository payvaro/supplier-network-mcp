import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

export interface FixAcceptorIntegrationArgs {
  supplierId?: string;
  acceptorId?: string;
  asClientId?: string;
  asClientName?: string;
}

export function generateFixAcceptorIntegrationPrompt(
  args: FixAcceptorIntegrationArgs,
): GetPromptResult {
  const scope = args.asClientId
    ? `- asClientId: "${args.asClientId}"`
    : args.asClientName
      ? `- asClientName: "${args.asClientName}"`
      : "";
  const supplierLine = args.supplierId
    ? `- supplierId: "${args.supplierId}"`
    : "(ask the user for the supplier id)";
  const acceptorHint = args.acceptorId ? `- acceptorId: "${args.acceptorId}"` : "";

  const text = `# Fix Acceptor Integration Workflow

Create a missing AcceptorIntegration so a supplier becomes payable.

## Phase 1 — Diagnose

Call \`playbooks.diagnose_acceptor_integration\`:

\`\`\`
action: "diagnose_acceptor_integration"
${supplierLine}
${acceptorHint}
${scope}
\`\`\`

The response shows:
- \`acceptors\` — the acceptor(s) currently associated with the supplier (via NSR#).
- \`integrations\` — existing integrations.
- \`missingIntegration\` — true if no integration exists.

If \`acceptors.length === 0\`, STOP — there is no acceptor to attach an
integration to. Investigate the missing AcceptorSupplierRef first.

If integrations already exist, ask the user whether to add a new one or
abort.

## Phase 2 — Gather provider config

Confirm with the user:
- \`acceptorId\` (default: the acceptor returned in Phase 1)
- \`providerId\` (which provider routes payments)
- \`rail\` (e.g. CARD, ACH)
- Any provider-specific \`config\` keys

## Phase 3 — Dry-run preview

Call \`acceptor_integrations\`:

\`\`\`
action: "create"
${supplierLine}
acceptorId: <acceptor>
providerId: <provider>
rail: <rail>
config: { ... }
dryRun: true
${scope}
\`\`\`

Show the proposed payload. On approval, continue.

## Phase 4 — Persist

Re-invoke with \`dryRun: false\`. For prod also set \`confirm: true\`.

## Phase 5 — Verify

Re-run \`playbooks.diagnose_acceptor_integration\`. Confirm
\`missingIntegration: false\` and the new integration appears. Run a
\`rules.trace\` for any buyer↔supplier pair to confirm the supplier is now
payable end-to-end.`;

  return {
    description: "Create a missing AcceptorIntegration for a supplier.",
    messages: [{ role: "user", content: { type: "text", text } }],
  };
}
