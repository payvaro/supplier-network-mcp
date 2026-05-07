import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

export interface AuditClientArgs {
  asClientId?: string;
  asClientName?: string;
}

export function generateAuditClientPrompt(args: AuditClientArgs): GetPromptResult {
  const scopeBlock = args.asClientId
    ? `- asClientId: "${args.asClientId}"`
    : args.asClientName
      ? `- asClientName: "${args.asClientName}"`
      : "(use the server's default NETWORK_CLIENT_ID)";

  const text = `# Client Audit Workflow

You are running the **/audit-client** support playbook for the Payvaro Network.
This playbook produces a prioritized list of setup gaps for one tenant.

## Phase 1 — Run the audit

Call the \`playbooks\` tool with:

\`\`\`
action: "audit_client"
${scopeBlock}
\`\`\`

The response contains a \`summary\` and a list of \`findings\`. Each finding
has a \`playbook\` field (e.g. \`fix-buyer-link\`) and pre-shaped \`args\`.

## Phase 2 — Present findings

Group findings by severity. For each high-severity finding, show the user:
- The entity (buyer/supplier id + name where available).
- The recommended repair playbook.
- The pre-shaped args.

## Phase 3 — Dispatch repairs

Ask the user which findings to repair. For each chosen finding, invoke the
matching MCP prompt (\`fix-buyer-link\`, \`fix-acceptor-integration\`,
\`fix-buyer-external-ids\`) with the pre-shaped args.

## Phase 4 — Verify

After repairs, re-run \`playbooks.audit_client\` and confirm the affected
findings have cleared. Report the diff (before vs after counts).

Begin with Phase 1.`;

  return {
    description: `Run the client audit playbook${args.asClientName ? ` for ${args.asClientName}` : ""}.`,
    messages: [{ role: "user", content: { type: "text", text } }],
  };
}
