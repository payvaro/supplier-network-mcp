import { getClientLookupService } from "./client-lookup.js";
import { isAdminMode } from "../constants.js";
import { createAdminOverrideRejectedError } from "../errors.js";

interface AdminScopeInput {
  asClientId?: string;
  asClientName?: string;
}

export interface AdminScopeRejection {
  isError: true;
  content: [{ type: "text"; text: string }];
}

export interface AdminScopeResolved {
  clientId: string | undefined;
}

/**
 * Resolves an admin-mode tenant override from tool params. Accepts either
 * `asClientId` (UUID) or `asClientName` (fuzzy-matched via the S3 client
 * config). Returns the resolved client ID, or an error payload shaped like
 * a tool response that the caller can return directly.
 *
 * Callers should return the rejection as-is without re-wrapping, so the
 * dispatcher emits a single actionable error message per tool call.
 */
export async function resolveAdminScope(
  params: AdminScopeInput,
  toolName: string,
): Promise<AdminScopeResolved | AdminScopeRejection> {
  const { asClientId, asClientName } = params;

  if (!asClientId && !asClientName) {
    return { clientId: undefined };
  }

  if (!isAdminMode()) {
    const err = createAdminOverrideRejectedError(toolName);
    return { isError: true, content: [{ type: "text", text: err.text }] };
  }

  if (asClientId && asClientName) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text:
            `❌ Error: The '${toolName}' tool received both 'asClientId' and 'asClientName'. ` +
            `Provide only one — use 'asClientName' to look up a client by name, or ` +
            `'asClientId' if you already know the UUID.`,
        },
      ],
    };
  }

  if (asClientId) {
    return { clientId: asClientId };
  }

  const environment = (process.env.NETWORK_ENVIRONMENT ?? "dev").toLowerCase();
  const service = getClientLookupService();

  try {
    const result = await service.lookupByName(asClientName!, environment);
    if (!result) {
      const available = await service.getAllClientNames(environment).catch(() => [] as string[]);
      const hint = available.length > 0
        ? ` Available clients: ${available.slice(0, 10).join(", ")}${available.length > 10 ? ", ..." : ""}.`
        : "";
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              `❌ Error: No client matched 'asClientName=${asClientName}' in environment '${environment}'.` +
              hint +
              ` Use the 'lookup_client' tool with action 'list' to see all options.`,
          },
        ],
      };
    }
    return { clientId: result.clientId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text:
            `❌ Error: Failed to resolve 'asClientName=${asClientName}' from the client config ` +
            `(S3 bucket for '${process.env.NETWORK_ENVIRONMENT ?? "dev"}'). ` +
            `Check AWS credentials and network access, or pass 'asClientId' directly. Details: ${message}`,
        },
      ],
    };
  }
}

export function isAdminScopeRejection(
  result: AdminScopeResolved | AdminScopeRejection,
): result is AdminScopeRejection {
  return "isError" in result;
}
