interface ActionableErrorResult {
  text: string;
  isError: true;
}

const HTTP_STATUS_PATTERNS: Record<
  string,
  (tool: string, action?: string, params?: Record<string, unknown>) => string
> = {
  '404': (tool, action, params) => {
    const hints = get404Hints(tool, action, params);
    return `Not found. ${hints}`;
  },
  '401': () => 'Authentication failed. Check that NETWORK_API_KEY is set and valid.',
  '400': (_tool, action) =>
    `Invalid request. Check parameter format for the '${action}' action and try again.`,
  '403': () => 'Access denied. The API key may not have permission for this operation.',
  '409': (_tool, action) => {
    if (_tool === 'relationships' && action === 'link') {
      return 'Link already exists between this buyer and supplier.';
    }
    return 'Conflict — this resource already exists or conflicts with existing data.';
  },
};

function get404Hints(
  tool: string,
  _action?: string,
  params?: Record<string, unknown>
): string {
  const id = params?.id || params?.jobId || params?.buyerId || params?.supplierId;
  const idStr = id ? ` with ID '${id}'` : '';

  switch (tool) {
    case 'suppliers':
      return `Supplier not found${idStr}. Try using the search tool to find the supplier by name.`;
    case 'buyers':
      return `Buyer not found${idStr}. Try lookup_client to find the client ID by name, or use buyers with action 'list' to browse all buyers.`;
    case 'matching':
      return `Matching job not found${idStr}. Use matching with action 'jobs' to list available jobs.`;
    case 'relationships':
      return `Relationship not found${idStr}. Check that the buyer and supplier IDs are correct.`;
    case 'imports':
      return `Import batch not found${idStr}. Use imports with action 'batches' to list recent imports.`;
    default:
      return `Resource not found${idStr}.`;
  }
}

function extractStatusCode(message: string): string | null {
  const match = message.match(/status code (\d{3})/);
  return match ? match[1] : null;
}

export function createActionableError(
  error: Error | string,
  tool: string,
  action?: string,
  params?: Record<string, unknown>
): ActionableErrorResult {
  const message = error instanceof Error ? error.message : error;
  const statusCode = extractStatusCode(message);

  let enrichedMessage: string;

  if (statusCode && HTTP_STATUS_PATTERNS[statusCode]) {
    enrichedMessage = HTTP_STATUS_PATTERNS[statusCode](tool, action, params);
  } else {
    enrichedMessage = message;
  }

  return {
    text: `❌ Error: ${enrichedMessage}`,
    isError: true as const,
  };
}

const PARAM_HINTS: Record<string, Record<string, string>> = {
  suppliers: {
    id: "If you don't have the ID, use the search tool to find the supplier by name.",
    date: "Date must be in yyyyMMdd format (e.g., '20260328').",
  },
  buyers: {
    id: 'Try lookup_client to resolve a client name to its UUID.',
    clientId: 'Try lookup_client to resolve a client name to its UUID.',
  },
  matching: {
    jobId: "Use matching with action 'jobs' to list available matching jobs.",
  },
  relationships: {
    buyerId: "Use buyers with action 'list' to find buyer IDs.",
    supplierId: 'Use the search tool to find supplier IDs.',
  },
};

export function createValidationError(
  tool: string,
  action: string,
  missingParam: string
): ActionableErrorResult {
  const hint = PARAM_HINTS[tool]?.[missingParam] || '';
  const hintSuffix = hint ? ` ${hint}` : '';

  return {
    text: `❌ Error: The '${action}' action requires '${missingParam}'.${hintSuffix}`,
    isError: true as const,
  };
}
