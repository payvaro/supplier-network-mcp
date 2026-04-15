import { getSuppliersForBuyer, getBuyersForSupplier, createBuyerLink } from "./buyers.js";
import { createActionableError, createAdminOverrideRejectedError } from "../errors.js";
import { ResponseFormat, isAdminMode } from "../constants.js";
import { getNetworkAPIClient } from "../services/api-client.js";
import type { RelationshipsToolInput } from "../schemas/index.js";

/**
 * Dispatch wrapper for the consolidated relationships tool
 */
export async function handleRelationships(params: RelationshipsToolInput) {
  try {
    if (params.asClientId && !isAdminMode()) {
      const err = createAdminOverrideRejectedError('relationships');
      return { isError: true, content: [{ type: "text" as const, text: err.text }] };
    }
    const scopedClient = params.asClientId
      ? getNetworkAPIClient().withClientIdOverride(params.asClientId)
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
