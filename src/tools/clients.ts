import { getClientLookupService } from "../services/client-lookup.js";
import type { LookupClientIdInput } from "../schemas/index.js";

export async function lookupClientId(params: LookupClientIdInput) {
  try {
    const service = getClientLookupService();
    const result = await service.lookupByName(params.name, params.environment);

    if (!result) {
      const availableNames = await service.getAllClientNames(params.environment);
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `# Client Lookup: "${params.name}"`,
              "",
              `**No match found** in **${params.environment}** environment.`,
              "",
              "## Available Clients",
              ...availableNames.map(n => `- ${n}`),
            ].join("\n"),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `# Client Lookup: "${params.name}"`,
            "",
            `**Matched:** ${result.name}`,
            `**Client ID:** \`${result.clientId}\``,
            `**Environment:** ${params.environment}`,
          ].join("\n"),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text" as const,
          text: `# Error Looking Up Client\n\nFailed to look up client "${params.name}": ${message}`,
        },
      ],
      isError: true,
    };
  }
}
