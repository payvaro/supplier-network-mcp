import { isAdminMode } from "../constants.js";

/**
 * Shared gating helper for tools that perform writes against the Network API.
 *
 * Contract:
 * - `dryRun` defaults to `true`. Callers must explicitly pass `dryRun: false`
 *   to persist changes — this matches the support-tooling expectation that
 *   every WRITE tool can be previewed first.
 * - In non-prod environments, `dryRun: false` executes immediately. No further
 *   confirmation is required.
 * - In prod (`NETWORK_ENVIRONMENT=prod` or `production`), live writes additionally
 *   require BOTH `confirm: true` AND admin mode (`NETWORK_ADMIN_MODE=true`).
 *   This mirrors the existing per-request `asClientId` admin gating pattern.
 *
 * The rejection shape matches `AdminScopeRejection` from `admin-scope.ts` so
 * dispatchers can return it directly without re-wrapping.
 */

export interface WriteGatingInput {
  dryRun?: boolean;
  confirm?: boolean;
}

export interface WriteGatingRejection {
  isError: true;
  content: [{ type: "text"; text: string }];
}

export interface WriteGatingResolved {
  /** Whether the caller is asking for a preview only. */
  dryRun: boolean;
  /** Resolved environment string ("dev", "stage", "prod", ...). Lower-cased. */
  environment: string;
  /** True when `environment` is "prod" or "production". */
  isProd: boolean;
}

const PROD_ENVIRONMENTS = new Set(["prod", "production"]);

function reject(text: string): WriteGatingRejection {
  return { isError: true, content: [{ type: "text", text }] };
}

export function resolveWriteGating(
  params: WriteGatingInput,
  toolName: string,
  action: string,
): WriteGatingResolved | WriteGatingRejection {
  const environment = (process.env.NETWORK_ENVIRONMENT ?? "dev").toLowerCase();
  const isProd = PROD_ENVIRONMENTS.has(environment);
  const dryRun = params.dryRun !== false;

  if (dryRun) {
    return { dryRun: true, environment, isProd };
  }

  if (isProd) {
    if (params.confirm !== true) {
      return reject(
        `❌ Error: Refusing to run '${toolName}.${action}' against the '${environment}' environment without explicit confirmation. ` +
          `Re-invoke with 'dryRun: false' AND 'confirm: true' once you have reviewed the dry-run diff.`,
      );
    }
    if (!isAdminMode()) {
      return reject(
        `❌ Error: Live writes against the '${environment}' environment require admin mode. ` +
          `Set 'NETWORK_ADMIN_MODE=true' on the MCP server, or run this tool against a non-prod environment.`,
      );
    }
  }

  return { dryRun: false, environment, isProd };
}

export function isWriteGatingRejection(
  result: WriteGatingResolved | WriteGatingRejection,
): result is WriteGatingRejection {
  return "isError" in result;
}
