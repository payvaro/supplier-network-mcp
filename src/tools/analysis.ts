import { getNetworkAPIClient } from "../services/api-client.js";
import { analyzeNetwork } from "../services/network-analyzer.js";
import { postToSlack, postGeneralMessage, normalizeAnalysisResult } from "../services/slack-notifier.js";
import { formatOutput, createErrorResponse } from "../services/formatter.js";
import { DEFAULT_SLACK_WEBHOOK_URL } from "../constants.js";
import type {
  NetworkAnalysisInput,
  SlackNotificationInput,
  SlackGeneralNotificationInput,
} from "../schemas/index.js";
import type { NetworkAnalysisResult } from "../types.js";

/**
 * Analyze network connections
 */
export async function analyzeNetworkConnections(
  params: NetworkAnalysisInput
) {
  try {
    const client = getNetworkAPIClient();
    const result = await analyzeNetwork(client, {
      includeSuggestions: params.includeSuggestions,
      minConnectionsForHub: params.minConnectionsForHub,
    });

    const formatted = formatOutput(
      result,
      params.response_format,
      () => formatAnalysisMarkdown(result)
    );

    return {
      content: [
        {
          type: "text" as const,
          text: formatted.text,
        },
      ],
      structuredContent: formatted.structuredData,
    };
  } catch (error) {
    console.error('analyzeNetworkConnections error:', error);
    const errorResponse = createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: errorResponse.text,
        },
      ],
    };
  }
}

/**
 * Format analysis results as Markdown
 */
function formatAnalysisMarkdown(result: NetworkAnalysisResult): string {
  const parts: string[] = [];

  parts.push("# Network Analysis");
  parts.push("");
  parts.push(`**Generated:** ${new Date(result.generatedAt).toLocaleString()}`);
  parts.push("");

  // Summary Statistics
  parts.push("## Summary Statistics");
  parts.push("");
  parts.push(`**Total Buyers:** ${result.summary.totalBuyers}`);
  parts.push(`**Total Suppliers:** ${result.summary.totalSuppliers}`);
  parts.push(`**Total Links:** ${result.summary.totalLinks}`);
  parts.push(
    `**Average Suppliers per Buyer:** ${result.summary.averageSuppliersPerBuyer.toFixed(2)}`
  );
  parts.push(
    `**Average Buyers per Supplier:** ${result.summary.averageBuyersPerSupplier.toFixed(2)}`
  );
  const buyerPercent = result.summary.totalBuyers > 0
    ? ((result.summary.buyersWithLinks / result.summary.totalBuyers) * 100).toFixed(1)
    : '0.0';
  const supplierPercent = result.summary.totalSuppliers > 0
    ? ((result.summary.suppliersWithLinks / result.summary.totalSuppliers) * 100).toFixed(1)
    : '0.0';
  parts.push(
    `**Buyers with Links:** ${result.summary.buyersWithLinks} (${buyerPercent}%)`
  );
  parts.push(
    `**Suppliers with Links:** ${result.summary.suppliersWithLinks} (${supplierPercent}%)`
  );
  parts.push("");

  // Network Metrics
  parts.push("## Network Metrics");
  parts.push("");
  parts.push(
    `**Network Density:** ${(result.metrics.density * 100).toFixed(2)}%`
  );
  parts.push(
    `**Overall Coverage:** ${(result.metrics.coverage * 100).toFixed(1)}%`
  );
  parts.push(
    `**Buyer Coverage:** ${(result.metrics.buyerCoverage * 100).toFixed(1)}%`
  );
  parts.push(
    `**Supplier Coverage:** ${(result.metrics.supplierCoverage * 100).toFixed(1)}%`
  );
  parts.push("");

  // Isolated Nodes
  parts.push("## Isolated Nodes");
  parts.push("");
  parts.push(
    `**Isolated Buyers:** ${result.isolatedNodes.buyers.length}`
  );
  if (result.isolatedNodes.buyers.length > 0) {
    parts.push("");
    result.isolatedNodes.buyers.slice(0, 10).forEach((buyer) => {
      parts.push(
        `- ${buyer.name || "Unnamed"} (ID: ${buyer.id}${buyer.clientId ? `, Client ID: ${buyer.clientId}` : ""})`
      );
    });
    if (result.isolatedNodes.buyers.length > 10) {
      parts.push(
        `- ... and ${result.isolatedNodes.buyers.length - 10} more`
      );
    }
  }
  parts.push("");
  parts.push(
    `**Isolated Suppliers:** ${result.isolatedNodes.suppliers.length}`
  );
  if (result.isolatedNodes.suppliers.length > 0) {
    parts.push("");
    result.isolatedNodes.suppliers.slice(0, 10).forEach((supplier) => {
      parts.push(`- ${supplier.name || "Unnamed"} (ID: ${supplier.id})`);
    });
    if (result.isolatedNodes.suppliers.length > 10) {
      parts.push(
        `- ... and ${result.isolatedNodes.suppliers.length - 10} more`
      );
    }
  }
  parts.push("");

  // Network Hubs
  parts.push("## Network Hubs");
  parts.push("");
  if (result.hubs.topBuyers.length > 0) {
    parts.push("### Top Buyer Hubs");
    parts.push("");
    result.hubs.topBuyers.forEach((hub, index) => {
      parts.push(
        `${index + 1}. **${hub.name || "Unnamed"}** - ${hub.connectionCount} connections (ID: ${hub.id}${hub.clientId ? `, Client ID: ${hub.clientId}` : ""})`
      );
    });
    parts.push("");
  }
  if (result.hubs.topSuppliers.length > 0) {
    parts.push("### Top Supplier Hubs");
    parts.push("");
    result.hubs.topSuppliers.forEach((hub, index) => {
      parts.push(
        `${index + 1}. **${hub.name || "Unnamed"}** - ${hub.connectionCount} connections (ID: ${hub.id})`
      );
    });
    parts.push("");
  }

  // Connection Suggestions
  if (result.suggestions && result.suggestions.length > 0) {
    parts.push("## Connection Suggestions");
    parts.push("");
    parts.push(
      `**Total Suggestions:** ${result.suggestions.length}`
    );
    parts.push("");
    result.suggestions.slice(0, 20).forEach((suggestion, index) => {
      parts.push(
        `### Suggestion ${index + 1}: ${suggestion.buyerName || suggestion.buyerId} ↔ ${suggestion.supplierName || suggestion.supplierId}`
      );
      parts.push(`**Reason:** ${suggestion.reason}`);
      parts.push(
        `**Confidence:** ${suggestion.confidence} (Buyer ID: ${suggestion.buyerId}, Supplier ID: ${suggestion.supplierId})`
      );
      parts.push("");
    });
    if (result.suggestions.length > 20) {
      parts.push(
        `... and ${result.suggestions.length - 20} more suggestions`
      );
      parts.push("");
    }
  }

  return parts.join("\n");
}

/**
 * Notify Slack with analysis results
 */
export async function notifySlack(params: SlackNotificationInput) {
  try {
    // Get webhook URL from parameter or environment variable
    const webhookUrl = params.webhookUrl || DEFAULT_SLACK_WEBHOOK_URL;
    
    if (!webhookUrl) {
      throw new Error(
        "Slack webhook URL is required. Either provide webhookUrl parameter or set SLACK_WEBHOOK_URL environment variable."
      );
    }

    // Normalize the analysis result from various input formats
    const analysisResult = normalizeAnalysisResult(params.analysisResult);

    // Post to Slack
    await postToSlack(
      webhookUrl,
      analysisResult,
      params.includeDetails
    );

    const formatted = formatOutput(
      { success: true, message: "Successfully posted to Slack" },
      params.response_format,
      () => {
        return `# Slack Notification Sent\n\n✅ Successfully posted network analysis summary to Slack.\n\n**Include Details:** ${params.includeDetails ? "Yes" : "No"}`;
      }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: formatted.text,
        },
      ],
      structuredContent: formatted.structuredData,
    };
  } catch (error) {
    console.error('notifySlack error:', error);
    const errorResponse = createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: errorResponse.text,
        },
      ],
    };
  }
}

/**
 * Send a general message to Slack
 */
export async function sendSlackMessage(params: SlackGeneralNotificationInput) {
  try {
    // Get webhook URL from parameter or environment variable
    const webhookUrl = params.webhookUrl || DEFAULT_SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      throw new Error(
        "Slack webhook URL is required. Either provide webhookUrl parameter or set SLACK_WEBHOOK_URL environment variable."
      );
    }

    // Post to Slack
    await postGeneralMessage(webhookUrl, params.message);

    const formatted = formatOutput(
      { success: true, message: "Successfully posted message to Slack" },
      params.response_format,
      () => {
        const parts = ["# Slack Message Sent\n", "✅ Successfully posted message to Slack.\n"];
        if (params.message.title) {
          parts.push(`**Title:** ${params.message.title}`);
        }
        return parts.join("\n");
      }
    );

    return {
      content: [
        {
          type: "text" as const,
          text: formatted.text,
        },
      ],
      structuredContent: formatted.structuredData,
    };
  } catch (error) {
    console.error('sendSlackMessage error:', error);
    const errorResponse = createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: errorResponse.text,
        },
      ],
    };
  }
}

