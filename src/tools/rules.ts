import { getNetworkAPIClient, NetworkAPIClient } from '../services/api-client.js';
import { resolveAdminScope, isAdminScopeRejection } from '../services/admin-scope.js';
import { createActionableError } from '../errors.js';
import { compactEffective, compactTrace } from '../services/rules-formatter.js';
import type { RulesToolInput } from '../schemas/index.js';

async function listRules(
  params: RulesToolInput,
  clientOverride?: NetworkAPIClient,
) {
  const client = clientOverride ?? getNetworkAPIClient();
  const response = await client.listConfigRules(
    params.scopeType!,
    params.scopeId!,
    params.pageSize,
    params.cursor,
  );
  // list: compact === full (already flat)
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }],
    structuredContent: response as Record<string, unknown>,
  };
}

async function effectiveRules(
  params: RulesToolInput,
  clientOverride?: NetworkAPIClient,
) {
  const client = clientOverride ?? getNetworkAPIClient();
  const raw = await client.getEffectiveRules(params.entityType!, params.entityId!);
  const payload = params.format === 'full' ? raw : compactEffective(raw);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

async function traceDecision(
  params: RulesToolInput,
  clientOverride?: NetworkAPIClient,
) {
  const client = clientOverride ?? getNetworkAPIClient();
  const raw = await client.resolveIntegrationTrace({
    buyerId: params.buyerId!,
    supplierId: params.supplierId!,
    paymentType: params.paymentType,
    acceptorId: params.acceptorId,
    requireClear: params.requireClear,
  });
  const payload = params.format === 'full' ? raw : compactTrace(raw);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

export async function handleRules(params: RulesToolInput) {
  try {
    const scope = await resolveAdminScope(params, 'rules');
    if (isAdminScopeRejection(scope)) return scope;
    const scopedClient = scope.clientId
      ? getNetworkAPIClient().withClientIdOverride(scope.clientId)
      : undefined;

    switch (params.action) {
      case 'list':      return await listRules(params, scopedClient);
      case 'effective': return await effectiveRules(params, scopedClient);
      case 'trace':     return await traceDecision(params, scopedClient);
      default:
        return {
          isError: true,
          content: [{
            type: 'text' as const,
            text: `❌ Error: Unknown action '${(params as { action: string }).action}'.`,
          }],
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: 'text' as const,
        text: createActionableError(
          error instanceof Error ? error : String(error),
          'rules',
          params.action,
          params as Record<string, unknown>,
        ).text,
      }],
    };
  }
}
