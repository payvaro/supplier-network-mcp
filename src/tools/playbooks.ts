import { getNetworkAPIClient, NetworkAPIClient } from "../services/api-client.js";
import { createErrorResponse } from "../services/formatter.js";
import { createActionableError } from "../errors.js";
import { resolveAdminScope, isAdminScopeRejection } from "../services/admin-scope.js";
import type { PlaybooksToolInput } from "../schemas/index.js";
import type {
  AuditClientResult,
  AuditFinding,
  AuditSummary,
  Buyer,
  BuyerLink,
  DiagnoseAcceptorIntegrationResult,
  DiagnoseBuyerLinkResult,
  Supplier,
} from "../types.js";

/**
 * Heuristic for "malformed" external IDs on a buyer.
 *
 * The real backend has stricter rules per tenant, but for v1 we flag the
 * dominant cases that block import-driven link creation:
 *  - clientId missing entirely
 *  - clientId is whitespace-only or contains a known sentinel ("UNKNOWN", "N/A", "TBD")
 *  - clientId looks like a leftover prefix-only value ("CLR#" with nothing after)
 *
 * Tighten this together with the api/CLAUDE.md validation rules as we triage
 * real-world support cases.
 */
const MALFORMED_SENTINELS = new Set(["UNKNOWN", "N/A", "TBD", "NULL", "NONE", ""]);
function isMalformedClientId(value: string | undefined): boolean {
  if (value === undefined || value === null) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (MALFORMED_SENTINELS.has(trimmed.toUpperCase())) return true;
  if (/^CLR#?$/i.test(trimmed)) return true;
  return false;
}

interface AuditDeps {
  listBuyers: () => Promise<Buyer[]>;
  getSuppliersForBuyer: (buyerId: string) => Promise<Supplier[]>;
  listAcceptorIntegrationsForSupplier: (supplierId: string) => Promise<{ id?: string }[]>;
  listBuyerLinks: () => Promise<BuyerLink[]>;
}

/**
 * Run the c1 audit. Pure function over `AuditDeps` so it's trivial to unit
 * test against in-memory fixtures without touching axios.
 *
 * The current strategy is intentionally simple:
 *  1. List buyers; classify their external IDs.
 *  2. For each buyer, fetch suppliers (via existing relationships endpoint).
 *  3. For each unique supplier, ensure at least one AcceptorIntegration exists.
 *  4. Cross-reference against the global buyer-links list to surface links the
 *     spec calls "missing": pairs the audit logic infers should be linked.
 *
 * For v1 we conservatively flag only the cases we can prove from data we
 * already have — no inference of "these buyers SHOULD link to those suppliers".
 * The skill-side prompt walks the user through ambiguous cases.
 */
export async function runAuditClient(
  clientId: string,
  deps: AuditDeps,
): Promise<AuditClientResult> {
  const findings: AuditFinding[] = [];
  const buyers = await deps.listBuyers();

  // a4: malformed external IDs
  let malformedExternalIds = 0;
  for (const buyer of buyers) {
    if (isMalformedClientId(buyer.clientId)) {
      malformedExternalIds += 1;
      findings.push({
        severity: "high",
        type: "malformed_external_ids",
        playbook: "fix-buyer-external-ids",
        message: `Buyer ${buyer.id ?? "(no id)"} (${buyer.name ?? "unnamed"}) has missing or malformed clientId.`,
        args: { buyerId: buyer.id },
        buyerId: buyer.id,
      });
    }
  }

  // Walk supplier graph and check for missing acceptor integrations (b1).
  const supplierIds = new Set<string>();
  for (const buyer of buyers) {
    if (!buyer.id) continue;
    const suppliers = await deps.getSuppliersForBuyer(buyer.id);
    for (const supplier of suppliers) {
      if (supplier.id) supplierIds.add(supplier.id);
    }
  }

  let missingIntegrations = 0;
  for (const supplierId of supplierIds) {
    const integrations = await deps.listAcceptorIntegrationsForSupplier(supplierId);
    if (integrations.length === 0) {
      missingIntegrations += 1;
      findings.push({
        severity: "high",
        type: "missing_acceptor_integration",
        playbook: "fix-acceptor-integration",
        message: `Supplier ${supplierId} has no AcceptorIntegration — payments to this supplier will fail.`,
        args: { supplierId },
        supplierId,
      });
    }
  }

  // a1 missing buyer-link surfaces only when a buyer-link reference is dangling.
  // We keep this conservative: report every link with a missing supplier or
  // buyer side as a candidate for repair.
  let missingLinks = 0;
  const buyerIds = new Set(buyers.map((b) => b.id).filter(Boolean) as string[]);
  const links = await deps.listBuyerLinks();
  for (const link of links) {
    if (!link.buyerId || !link.supplierId) {
      missingLinks += 1;
      findings.push({
        severity: "medium",
        type: "missing_buyer_link",
        playbook: "fix-buyer-link",
        message: `Dangling BuyerLink — buyerId=${link.buyerId ?? "?"} supplierId=${link.supplierId ?? "?"}.`,
        args: { buyerId: link.buyerId, supplierId: link.supplierId },
        buyerId: link.buyerId,
        supplierId: link.supplierId,
      });
      continue;
    }
    if (!buyerIds.has(link.buyerId) || !supplierIds.has(link.supplierId)) {
      missingLinks += 1;
      findings.push({
        severity: "medium",
        type: "missing_buyer_link",
        playbook: "fix-buyer-link",
        message: `BuyerLink references entity not visible to this client (buyer=${link.buyerId}, supplier=${link.supplierId}).`,
        args: { buyerId: link.buyerId, supplierId: link.supplierId },
        buyerId: link.buyerId,
        supplierId: link.supplierId,
      });
    }
  }

  const summary: AuditSummary = {
    buyers: buyers.length,
    suppliers: supplierIds.size,
    missingLinks,
    missingIntegrations,
    malformedExternalIds,
  };

  return {
    clientId,
    summary,
    findings,
    generatedAt: new Date().toISOString(),
  };
}

function formatAuditMarkdown(result: AuditClientResult): string {
  const lines: string[] = [];
  lines.push(`# Client Audit — ${result.clientId}`);
  lines.push("");
  lines.push(`Generated ${result.generatedAt}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Buyers: ${result.summary.buyers}`);
  lines.push(`- Suppliers (across all buyer relationships): ${result.summary.suppliers}`);
  lines.push(`- Missing buyer-supplier links: ${result.summary.missingLinks}`);
  lines.push(`- Missing acceptor integrations: ${result.summary.missingIntegrations}`);
  lines.push(`- Malformed buyer external IDs: ${result.summary.malformedExternalIds}`);
  lines.push("");
  if (result.findings.length === 0) {
    lines.push("✅ No findings — client is clean.");
    return lines.join("\n");
  }
  lines.push(`## Findings (${result.findings.length})`);
  lines.push("");
  for (const f of result.findings) {
    lines.push(`- [${f.severity.toUpperCase()}] ${f.message} → run \`${f.playbook}\``);
  }
  return lines.join("\n");
}

export async function diagnoseBuyerLink(
  buyerId: string,
  supplierId: string,
  clientOverride?: NetworkAPIClient,
): Promise<DiagnoseBuyerLinkResult> {
  const client = clientOverride ?? getNetworkAPIClient();
  const notes: string[] = [];
  let link: BuyerLink | undefined;
  try {
    link = await client.getBuyerLink(buyerId, supplierId);
  } catch (err) {
    notes.push(`getBuyerLink threw: ${err instanceof Error ? err.message : String(err)}`);
  }

  const missingFields: string[] = [];
  if (link) {
    if (!link.buyerSupplierRefId) missingFields.push("buyerSupplierRefId");
    if (!link.buyerRefKey) missingFields.push("buyerRefKey");
    if (!link.connectionStatus) missingFields.push("connectionStatus");
  } else {
    notes.push("No BuyerLink found between this buyer and supplier.");
  }

  return {
    buyerId,
    supplierId,
    exists: !!link,
    link,
    missingFields,
    notes,
  };
}

export async function diagnoseAcceptorIntegration(
  args: { supplierId?: string; acceptorId?: string },
  clientOverride?: NetworkAPIClient,
): Promise<DiagnoseAcceptorIntegrationResult> {
  const client = clientOverride ?? getNetworkAPIClient();
  const notes: string[] = [];

  let acceptors: DiagnoseAcceptorIntegrationResult["acceptors"] = [];
  if (args.supplierId) {
    acceptors = await client.getAcceptorsForSupplier(args.supplierId);
    if (acceptors.length === 0) {
      notes.push(
        "No acceptor is linked to this supplier — fix-acceptor-integration cannot proceed without an Acceptor. " +
          "Investigate why the NSR# AcceptorSupplierRef is missing.",
      );
    }
  } else if (args.acceptorId) {
    try {
      const acceptor = await client.getAcceptor(args.acceptorId);
      acceptors = [acceptor];
    } catch (err) {
      notes.push(`getAcceptor failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let integrations: DiagnoseAcceptorIntegrationResult["integrations"] = [];
  if (args.supplierId) {
    integrations = await client.listAcceptorIntegrationsForSupplier(args.supplierId);
  }

  return {
    supplierId: args.supplierId,
    acceptorId: args.acceptorId,
    acceptors,
    integrations,
    missingIntegration: integrations.length === 0,
    notes,
  };
}

export async function handlePlaybooks(params: PlaybooksToolInput) {
  try {
    const scope = await resolveAdminScope(params, "playbooks");
    if (isAdminScopeRejection(scope)) return scope;
    const scopedClient = scope.clientId
      ? getNetworkAPIClient().withClientIdOverride(scope.clientId)
      : undefined;
    const client = scopedClient ?? getNetworkAPIClient();

    switch (params.action) {
      case "audit_client": {
        const clientId = scope.clientId ?? process.env.NETWORK_CLIENT_ID ?? "(default)";
        const result = await runAuditClient(clientId, {
          listBuyers: () => client.listBuyers(),
          getSuppliersForBuyer: (id) => client.getSuppliersForBuyer(id),
          listAcceptorIntegrationsForSupplier: (id) =>
            client.listAcceptorIntegrationsForSupplier(id),
          listBuyerLinks: () => client.listBuyerLinks(),
        });
        return {
          content: [{ type: "text" as const, text: formatAuditMarkdown(result) }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      }
      case "diagnose_buyer_link": {
        const result = await diagnoseBuyerLink(params.buyerId!, params.supplierId!, scopedClient);
        const text = [
          `# BuyerLink Diagnosis`,
          "",
          `**Buyer:** ${result.buyerId}`,
          `**Supplier:** ${result.supplierId}`,
          `**Exists:** ${result.exists ? "yes" : "no"}`,
          result.missingFields.length
            ? `**Missing fields:** ${result.missingFields.join(", ")}`
            : "",
          result.notes.length ? `\nNotes:\n${result.notes.map((n) => `- ${n}`).join("\n")}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      }
      case "diagnose_acceptor_integration": {
        const result = await diagnoseAcceptorIntegration(
          { supplierId: params.supplierId, acceptorId: params.acceptorId },
          scopedClient,
        );
        const text = [
          `# Acceptor Integration Diagnosis`,
          "",
          result.supplierId ? `**Supplier:** ${result.supplierId}` : "",
          result.acceptorId ? `**Acceptor:** ${result.acceptorId}` : "",
          `**Acceptors found:** ${result.acceptors.length}`,
          `**Integrations found:** ${result.integrations.length}`,
          `**Missing integration:** ${result.missingIntegration ? "yes" : "no"}`,
          result.notes.length ? `\nNotes:\n${result.notes.map((n) => `- ${n}`).join("\n")}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      }
      default:
        return {
          isError: true,
          content: [{ type: "text" as const, text: "❌ Error: Unknown action." }],
        };
    }
  } catch (error) {
    console.error("playbooks error:", error);
    const enriched = createActionableError(
      error instanceof Error ? error : String(error),
      "playbooks",
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
