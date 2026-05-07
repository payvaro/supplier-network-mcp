import { getClientLookupService } from "../services/client-lookup.js";
import type { LookupClientToolInput } from "../schemas/index.js";

export async function lookupClientId(params: LookupClientToolInput) {
  const service = getClientLookupService();

  try {
    if (params.action === "list") {
      const names = await service.getAllClientNames();
      return {
        content: [
          {
            type: "text" as const,
            text: [
              "# Clients",
              "",
              `**Total:** ${names.length}`,
              "",
              ...names.map(n => `- ${n}`),
              "",
              "Use `lookup_client` with `action: resolve` to get a UUID, or pass `asClientName=\"<name>\"` to any admin-mode tool.",
            ].join("\n"),
          },
        ],
      };
    }

    const result = await service.lookupByName(params.name!);

    if (!result) {
      const availableNames = await service.getAllClientNames();
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `# Client Lookup: "${params.name}"`,
              "",
              "**No match found.**",
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
          ].join("\n"),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const label = params.action === "list" ? "list clients" : `look up client "${params.name}"`;
    return {
      content: [
        {
          type: "text" as const,
          text: `# Error\n\nFailed to ${label}: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
