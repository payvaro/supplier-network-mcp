import { getNetworkAPIClient, NetworkAPIClient } from "../services/api-client.js";
import { createErrorResponse } from "../services/formatter.js";
import { createActionableError } from "../errors.js";
import { resolveAdminScope, isAdminScopeRejection } from "../services/admin-scope.js";
import { resolveWriteGating, isWriteGatingRejection } from "../services/write-gating.js";
import type { AcceptorIntegrationsToolInput } from "../schemas/index.js";
import type { AcceptorIntegration } from "../types.js";

function formatIntegration(i: AcceptorIntegration): string {
  const parts: string[] = [];
  if (i.id) parts.push(`**ID:** ${i.id}`);
  if (i.acceptorId) parts.push(`**Acceptor:** ${i.acceptorId}`);
  if (i.providerId || i.providerName) parts.push(`**Provider:** ${i.providerName ?? i.providerId}`);
  if (i.rail) parts.push(`**Rail:** ${i.rail}`);
  if (i.paymentType) parts.push(`**Payment Type:** ${i.paymentType}`);
  if (i.status) parts.push(`**Status:** ${i.status}`);
  if (i.externalRef) parts.push(`**External Ref:** ${i.externalRef}`);
  return parts.join("\n");
}

export async function listAcceptorIntegrations(
  supplierId: string,
  clientOverride?: NetworkAPIClient,
) {
  const client = clientOverride ?? getNetworkAPIClient();
  const integrations = await client.listAcceptorIntegrationsForSupplier(supplierId);
  const text = [
    `# Acceptor Integrations for Supplier ${supplierId}`,
    "",
    `**Total:** ${integrations.length}`,
    "",
    "---",
    "",
    ...integrations.map((i, idx) => `### Integration ${idx + 1}\n${formatIntegration(i)}`),
  ].join("\n");
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: { supplierId, integrations, count: integrations.length },
  };
}

export async function getAcceptorIntegration(
  supplierId: string,
  integrationId: string,
  clientOverride?: NetworkAPIClient,
) {
  const client = clientOverride ?? getNetworkAPIClient();
  const integration = await client.getAcceptorIntegration(supplierId, integrationId);
  return {
    content: [
      {
        type: "text" as const,
        text: `# Acceptor Integration ${integrationId}\n\n${formatIntegration(integration)}`,
      },
    ],
    structuredContent: integration,
  };
}

export interface CreateAcceptorIntegrationArgs {
  supplierId: string;
  acceptorId: string;
  providerId: string;
  rail?: string;
  paymentType?: string;
  externalRef?: string;
  status?: string;
  config?: Record<string, unknown>;
}

export async function createAcceptorIntegration(
  args: CreateAcceptorIntegrationArgs,
  dryRun: boolean,
  clientOverride?: NetworkAPIClient,
) {
  const client = clientOverride ?? getNetworkAPIClient();
  const payload: Partial<AcceptorIntegration> = {
    acceptorId: args.acceptorId,
    providerId: args.providerId,
    rail: args.rail,
    paymentType: args.paymentType,
    externalRef: args.externalRef,
    status: args.status,
    config: args.config,
  };

  if (dryRun) {
    const text = [
      "# Acceptor Integration — Dry Run",
      "",
      `Would POST to /api/suppliers/${args.supplierId}/acceptor-integrations with:`,
      "",
      "```json",
      JSON.stringify(payload, null, 2),
      "```",
      "",
      "Re-invoke with `dryRun: false` (and `confirm: true` if running against prod) to persist.",
    ].join("\n");
    return {
      content: [{ type: "text" as const, text }],
      structuredContent: { dryRun: true, supplierId: args.supplierId, payload },
    };
  }

  const created = await client.createAcceptorIntegration(args.supplierId, payload);
  return {
    content: [
      {
        type: "text" as const,
        text: `# Acceptor Integration Created\n\n✅ Persisted.\n\n${formatIntegration(created)}`,
      },
    ],
    structuredContent: { dryRun: false, supplierId: args.supplierId, created },
  };
}

export async function handleAcceptorIntegrations(params: AcceptorIntegrationsToolInput, clientOverride?: NetworkAPIClient) {
  try {
    const scope = await resolveAdminScope(params, "acceptor_integrations");
    if (isAdminScopeRejection(scope)) return scope;
    const scopedClient = scope.clientId
      ? (clientOverride ?? getNetworkAPIClient()).withClientIdOverride(scope.clientId)
      : clientOverride;

    switch (params.action) {
      case "list":
        return await listAcceptorIntegrations(params.supplierId!, scopedClient);
      case "get":
        return await getAcceptorIntegration(params.supplierId!, params.integrationId!, scopedClient);
      case "create": {
        const gate = resolveWriteGating(params, "acceptor_integrations", "create");
        if (isWriteGatingRejection(gate)) return gate;
        return await createAcceptorIntegration(
          {
            supplierId: params.supplierId!,
            acceptorId: params.acceptorId!,
            providerId: params.providerId!,
            rail: params.rail,
            paymentType: params.paymentType,
            externalRef: params.externalRef,
            status: params.status,
            config: params.config,
          },
          gate.dryRun,
          scopedClient,
        );
      }
      default:
        return {
          isError: true,
          content: [{ type: "text" as const, text: "❌ Error: Unknown action." }],
        };
    }
  } catch (error) {
    console.error("acceptor_integrations error:", error);
    const enriched = createActionableError(
      error instanceof Error ? error : String(error),
      "acceptor_integrations",
      params.action,
      params as Record<string, unknown>,
    );
    const fallback = createErrorResponse(error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      content: [{ type: "text" as const, text: enriched.text || fallback.text }],
    };
  }
}
