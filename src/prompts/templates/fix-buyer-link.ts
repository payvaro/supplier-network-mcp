import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

export interface FixBuyerLinkArgs {
  buyerId?: string;
  supplierId?: string;
  asClientId?: string;
  asClientName?: string;
}

export function generateFixBuyerLinkPrompt(args: FixBuyerLinkArgs): GetPromptResult {
  const scope = args.asClientId
    ? `- asClientId: "${args.asClientId}"`
    : args.asClientName
      ? `- asClientName: "${args.asClientName}"`
      : "";
  const buyerLine = args.buyerId ? `- buyerId: "${args.buyerId}"` : "(ask the user for buyerId)";
  const supplierLine = args.supplierId
    ? `- supplierId: "${args.supplierId}"`
    : "(ask the user for supplierId)";

  const text = `# Fix Buyer Link Workflow

Repair a missing buyer↔supplier link.

## Phase 1 — Diagnose

Call \`playbooks.diagnose_buyer_link\`:

\`\`\`
action: "diagnose_buyer_link"
${buyerLine}
${supplierLine}
${scope}
\`\`\`

If \`exists: true\`, stop and report the existing link to the user — there is
nothing to repair. If \`exists: false\`, continue.

## Phase 2 — Confirm with the user

Show the buyer + supplier identities and ask the user to confirm the link
should be created. Confirm any reference fields (\`buyerSupplierRefId\`,
\`buyerRefKey\`) the user wants set.

## Phase 3 — Create the link

Call the existing \`relationships\` tool:

\`\`\`
action: "link"
buyerId: <buyerId>
supplierId: <supplierId>
buyerSupplierRefId: <if provided>
buyerRefKey: <if provided>
${scope}
\`\`\`

## Phase 4 — Verify

Re-run \`playbooks.diagnose_buyer_link\`. Confirm \`exists: true\`. Report
the new link details to the user.`;

  return {
    description: "Repair a missing buyer↔supplier link.",
    messages: [{ role: "user", content: { type: "text", text } }],
  };
}
