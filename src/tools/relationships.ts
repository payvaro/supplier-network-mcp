import { getSuppliersForBuyer, getBuyersForSupplier, createBuyerLink } from "./buyers.js";
import { createActionableError } from "../errors.js";
import { ResponseFormat } from "../constants.js";
import type { RelationshipsToolInput } from "../schemas/index.js";

/**
 * Dispatch wrapper for the consolidated relationships tool
 */
export async function handleRelationships(params: RelationshipsToolInput) {
  try {
    switch (params.action) {
      case "for_buyer":
        return await getSuppliersForBuyer({
          buyerId: params.buyerId!,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "for_supplier":
        return await getBuyersForSupplier({
          supplierId: params.supplierId!,
          response_format: ResponseFormat.MARKDOWN,
        });
      case "link":
        return await createBuyerLink({
          buyerId: params.buyerId!,
          supplierId: params.supplierId!,
          buyerSupplierRefId: params.buyerSupplierRefId,
          buyerRefKey: params.buyerRefKey,
          response_format: ResponseFormat.MARKDOWN,
        });
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
