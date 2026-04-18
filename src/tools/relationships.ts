import { getSuppliersForBuyer, getBuyersForSupplier, createBuyerLink } from "./buyers.js";
import { createActionableError } from "../errors.js";
import { ResponseFormat } from "../constants.js";
import { getNetworkAPIClient } from "../services/api-client.js";
import { resolveAdminScope, isAdminScopeRejection } from "../services/admin-scope.js";
import type { RelationshipsToolInput } from "../schemas/index.js";

/**
 * Dispatch wrapper for the consolidated relationships tool
 */
export async function handleRelationships(params: RelationshipsToolInput) {
  try {
    const scope = await resolveAdminScope(params, 'relationships');
    if (isAdminScopeRejection(scope)) return scope;
    const scopedClient = scope.clientId
      ? getNetworkAPIClient().withClientIdOverride(scope.clientId)
      : undefined;

    switch (params.action) {
      case "for_buyer":
        return await getSuppliersForBuyer({
          buyerId: params.buyerId!,
          response_format: ResponseFormat.MARKDOWN,
        }, scopedClient);
      case "for_supplier":
        return await getBuyersForSupplier({
          supplierId: params.supplierId!,
          response_format: ResponseFormat.MARKDOWN,
        }, scopedClient);
      case "link":
        return await createBuyerLink({
          buyerId: params.buyerId!,
          supplierId: params.supplierId!,
          buyerSupplierRefId: params.buyerSupplierRefId,
          buyerRefKey: params.buyerRefKey,
          response_format: ResponseFormat.MARKDOWN,
        }, scopedClient);
      default:
        return {
          isError: true,
          content: [{ type: "text" as const, text: `❌ Error: Unknown action.` }],
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: createActionableError(error instanceof Error ? error : String(error), 'relationships', params.action, params as Record<string, unknown>).text,
      }],
    };
  }
}
