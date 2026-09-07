import { getNetworkAPIClient, NetworkAPIClient } from "../services/api-client.js";
import { createErrorResponse } from "../services/formatter.js";
import { createActionableError } from "../errors.js";
import { resolveAdminScope, isAdminScopeRejection } from "../services/admin-scope.js";
import type { AcceptorsToolInput } from "../schemas/index.js";
import type { Acceptor } from "../types.js";

function formatAcceptor(a: Acceptor): string {
  const parts: string[] = [];
  parts.push(`### ${a.name ?? "(unnamed)"}`);
  if (a.id) parts.push(`**ID:** ${a.id}`);
  if (a.providerName) parts.push(`**Provider:** ${a.providerName}`);
  if (a.status) parts.push(`**Status:** ${a.status}`);
  if (a.externalRef) parts.push(`**External Ref:** ${a.externalRef}`);
  return parts.join("\n");
}

export async function listAcceptors(clientOverride?: NetworkAPIClient) {
  const client = clientOverride ?? getNetworkAPIClient();
  const acceptors = await client.listAcceptors();
  const text = [
    "# Acceptors",
    "",
    `**Total:** ${acceptors.length}`,
    "",
    "---",
    "",
    ...acceptors.map(formatAcceptor),
  ].join("\n");
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: { acceptors, count: acceptors.length },
  };
}

export async function getAcceptor(id: string, clientOverride?: NetworkAPIClient) {
  const client = clientOverride ?? getNetworkAPIClient();
  const acceptor = await client.getAcceptor(id);
  return {
    content: [{ type: "text" as const, text: `# Acceptor ${id}\n\n${formatAcceptor(acceptor)}` }],
    structuredContent: acceptor,
  };
}

export async function getAcceptorsForSupplier(
  supplierId: string,
  clientOverride?: NetworkAPIClient,
) {
  const client = clientOverride ?? getNetworkAPIClient();
  const acceptors = await client.getAcceptorsForSupplier(supplierId);
  const text = [
    `# Acceptors for Supplier ${supplierId}`,
    "",
    `**Total:** ${acceptors.length}`,
    "",
    "---",
    "",
    ...acceptors.map(formatAcceptor),
  ].join("\n");
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: { acceptors, count: acceptors.length, supplierId },
  };
}

export async function handleAcceptors(params: AcceptorsToolInput, clientOverride?: NetworkAPIClient) {
  try {
    const scope = await resolveAdminScope(params, "acceptors");
    if (isAdminScopeRejection(scope)) return scope;
    const scopedClient = scope.clientId
      ? (clientOverride ?? getNetworkAPIClient()).withClientIdOverride(scope.clientId)
      : clientOverride;

    switch (params.action) {
      case "list":
        return await listAcceptors(scopedClient);
      case "get":
        return await getAcceptor(params.id!, scopedClient);
      case "for_supplier":
        return await getAcceptorsForSupplier(params.supplierId!, scopedClient);
      default:
        return {
          isError: true,
          content: [{ type: "text" as const, text: `❌ Error: Unknown action.` }],
        };
    }
  } catch (error) {
    console.error("acceptors error:", error);
    const enriched = createActionableError(
      error instanceof Error ? error : String(error),
      "acceptors",
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
