import axios from "axios";
import type { NetworkAnalysisResult, SlackGeneralMessage } from "../types.js";

export interface SlackBlock {
  type: string;
  [key: string]: unknown;
}

export interface SlackPayload {
  blocks: SlackBlock[];
  text?: string;  // Fallback text for notifications
  attachments?: Array<{
    color: string;
    blocks: SlackBlock[];
  }>;
}

/**
 * Normalize various input formats to NetworkAnalysisResult
 * Accepts:
 * - Full NetworkAnalysisResult object
 * - JSON string that can be parsed to NetworkAnalysisResult
 * - Partial result object (will fill in defaults for missing fields)
 * - Objects wrapped in structuredContent property
 */
export function normalizeAnalysisResult(
  input: unknown
): NetworkAnalysisResult {
  let parsed: unknown = input;

  // Handle string input (JSON)
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch (error) {
      throw new Error(
        `Invalid JSON string: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Handle objects wrapped in structuredContent (from tool responses)
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "structuredContent" in parsed &&
    typeof (parsed as { structuredContent: unknown }).structuredContent ===
      "object" &&
    (parsed as { structuredContent: unknown }).structuredContent !== null
  ) {
    parsed = (parsed as { structuredContent: unknown }).structuredContent;
  }

  // Validate it's an object
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(
      "Analysis result must be an object, JSON string, or wrapped in structuredContent"
    );
  }

  const obj = parsed as Record<string, unknown>;

  // Extract or create summary
  let summary = obj.summary as NetworkAnalysisResult["summary"] | undefined;
  if (!summary || typeof summary !== "object") {
    // Try to construct from available data at root level or from summary object
    const existingSummary = typeof obj.summary === "object" && obj.summary !== null
      ? obj.summary as Record<string, unknown>
      : null;

    let totalBuyers: number;
    if (typeof obj.totalBuyers === "number") {
      totalBuyers = obj.totalBuyers;
    } else if (typeof existingSummary?.totalBuyers === "number") {
      totalBuyers = existingSummary.totalBuyers;
    } else {
      console.warn('normalizeAnalysisResult: totalBuyers missing, defaulting to 0');
      totalBuyers = 0;
    }

    let totalSuppliers: number;
    if (typeof obj.totalSuppliers === "number") {
      totalSuppliers = obj.totalSuppliers;
    } else if (typeof existingSummary?.totalSuppliers === "number") {
      totalSuppliers = existingSummary.totalSuppliers;
    } else {
      console.warn('normalizeAnalysisResult: totalSuppliers missing, defaulting to 0');
      totalSuppliers = 0;
    }

    let totalLinks: number;
    if (typeof obj.totalLinks === "number") {
      totalLinks = obj.totalLinks;
    } else if (typeof existingSummary?.totalLinks === "number") {
      totalLinks = existingSummary.totalLinks;
    } else {
      console.warn('normalizeAnalysisResult: totalLinks missing, defaulting to 0');
      totalLinks = 0;
    }

    summary = {
      totalBuyers,
      totalSuppliers,
      totalLinks,
      averageSuppliersPerBuyer:
        typeof obj.averageSuppliersPerBuyer === "number"
          ? obj.averageSuppliersPerBuyer
          : typeof existingSummary?.averageSuppliersPerBuyer === "number"
            ? existingSummary.averageSuppliersPerBuyer
            : totalBuyers > 0
              ? totalLinks / totalBuyers
              : 0,
      averageBuyersPerSupplier:
        typeof obj.averageBuyersPerSupplier === "number"
          ? obj.averageBuyersPerSupplier
          : typeof existingSummary?.averageBuyersPerSupplier === "number"
            ? existingSummary.averageBuyersPerSupplier
            : totalSuppliers > 0
              ? totalLinks / totalSuppliers
              : 0,
      buyersWithLinks:
        typeof obj.buyersWithLinks === "number"
          ? obj.buyersWithLinks
          : typeof existingSummary?.buyersWithLinks === "number"
            ? existingSummary.buyersWithLinks
            : 0,
      suppliersWithLinks:
        typeof obj.suppliersWithLinks === "number"
          ? obj.suppliersWithLinks
          : typeof existingSummary?.suppliersWithLinks === "number"
            ? existingSummary.suppliersWithLinks
            : 0,
      connectionDistribution: {
        buyers: {},
        suppliers: {},
      },
    };
  }

  // Extract or create metrics
  let metrics = obj.metrics as NetworkAnalysisResult["metrics"] | undefined;
  if (!metrics || typeof metrics !== "object") {
    const density =
      typeof obj.density === "number"
        ? obj.density
        : typeof obj.networkDensity === "number"
          ? obj.networkDensity
          : 0;
    const coverage =
      typeof obj.coverage === "number"
        ? obj.coverage
        : typeof obj.overallCoverage === "number"
          ? obj.overallCoverage
          : 0;

    metrics = {
      density,
      coverage,
      buyerCoverage:
        typeof obj.buyerCoverage === "number"
          ? obj.buyerCoverage
          : summary.totalBuyers > 0
            ? summary.buyersWithLinks / summary.totalBuyers
            : 0,
      supplierCoverage:
        typeof obj.supplierCoverage === "number"
          ? obj.supplierCoverage
          : summary.totalSuppliers > 0
            ? summary.suppliersWithLinks / summary.totalSuppliers
            : 0,
    };
  }

  // Extract isolated nodes - support both nested and flat structures
  const isolatedNodesObj = obj.isolatedNodes as
    | { buyers?: unknown; suppliers?: unknown }
    | undefined;
  
  let isolatedBuyers: NetworkAnalysisResult["isolatedNodes"]["buyers"] = [];
  if (
    isolatedNodesObj &&
    typeof isolatedNodesObj === "object" &&
    Array.isArray(isolatedNodesObj.buyers)
  ) {
    isolatedBuyers = isolatedNodesObj.buyers as NetworkAnalysisResult["isolatedNodes"]["buyers"];
  } else if (Array.isArray(obj.isolatedBuyers)) {
    isolatedBuyers = obj.isolatedBuyers as NetworkAnalysisResult["isolatedNodes"]["buyers"];
  }

  let isolatedSuppliers: NetworkAnalysisResult["isolatedNodes"]["suppliers"] = [];
  if (
    isolatedNodesObj &&
    typeof isolatedNodesObj === "object" &&
    Array.isArray(isolatedNodesObj.suppliers)
  ) {
    isolatedSuppliers = isolatedNodesObj.suppliers as NetworkAnalysisResult["isolatedNodes"]["suppliers"];
  } else if (Array.isArray(obj.isolatedSuppliers)) {
    isolatedSuppliers = obj.isolatedSuppliers as NetworkAnalysisResult["isolatedNodes"]["suppliers"];
  }

  const isolatedNodes = {
    buyers: isolatedBuyers,
    suppliers: isolatedSuppliers,
  };

  // Extract hubs - support both nested and flat structures
  const hubsObj = obj.hubs as
    | { topBuyers?: unknown; topSuppliers?: unknown }
    | undefined;
  
  let topBuyers: NetworkAnalysisResult["hubs"]["topBuyers"] = [];
  if (
    hubsObj &&
    typeof hubsObj === "object" &&
    Array.isArray(hubsObj.topBuyers)
  ) {
    topBuyers = hubsObj.topBuyers as NetworkAnalysisResult["hubs"]["topBuyers"];
  } else if (Array.isArray(obj.topBuyers)) {
    topBuyers = obj.topBuyers as NetworkAnalysisResult["hubs"]["topBuyers"];
  }

  let topSuppliers: NetworkAnalysisResult["hubs"]["topSuppliers"] = [];
  if (
    hubsObj &&
    typeof hubsObj === "object" &&
    Array.isArray(hubsObj.topSuppliers)
  ) {
    topSuppliers = hubsObj.topSuppliers as NetworkAnalysisResult["hubs"]["topSuppliers"];
  } else if (Array.isArray(obj.topSuppliers)) {
    topSuppliers = obj.topSuppliers as NetworkAnalysisResult["hubs"]["topSuppliers"];
  }

  const hubs = {
    topBuyers,
    topSuppliers,
  };

  // Extract suggestions (optional)
  const suggestions = Array.isArray(obj.suggestions)
    ? (obj.suggestions as NetworkAnalysisResult["suggestions"])
    : undefined;

  // Extract or generate timestamp
  let generatedAt: string;
  if (typeof obj.generatedAt === "string") {
    generatedAt = obj.generatedAt;
  } else if (typeof obj.timestamp === "string") {
    generatedAt = obj.timestamp;
  } else if (typeof obj.createdAt === "string") {
    generatedAt = obj.createdAt;
  } else {
    generatedAt = new Date().toISOString();
  }

  // Validate timestamp is a valid date
  const parsedDate = new Date(generatedAt);
  if (isNaN(parsedDate.getTime())) {
    console.warn(`normalizeAnalysisResult: Invalid timestamp "${generatedAt}", using current time`);
    generatedAt = new Date().toISOString();
  }

  // Validate minimum required fields
  if (!summary || !metrics) {
    throw new Error(
      "Analysis result must contain summary and metrics, or sufficient data to construct them"
    );
  }

  return {
    summary,
    metrics,
    isolatedNodes,
    hubs,
    suggestions,
    generatedAt,
  };
}

/**
 * Format a general message into Slack Block Kit format
 */
export function formatGeneralMessage(message: SlackGeneralMessage): SlackPayload {
  const blocks: SlackBlock[] = [];

  // Optional header
  if (message.title) {
    blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: message.title, emoji: true }
    });
    blocks.push({ type: 'divider' });
  }

  // Body as markdown section
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: message.body }
  });

  // Optional fields (displayed as 2-column grid, max 10 per section)
  if (message.fields?.length) {
    blocks.push({
      type: 'section',
      fields: message.fields.map(f => ({
        type: 'mrkdwn',
        text: `*${f.label}:*\n${f.value}`
      }))
    });
  }

  // Optional action buttons
  if (message.actions?.length) {
    blocks.push({
      type: 'actions',
      elements: message.actions.map(action => ({
        type: 'button',
        text: { type: 'plain_text', text: action.text, emoji: true },
        url: action.url,
        ...(action.style && { style: action.style })
      }))
    });
  }

  // Footer with timestamp
  const timestamp = new Date().toISOString();
  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: message.footer ? `${message.footer} • ${timestamp}` : timestamp
    }]
  });

  // Build payload - use attachments for color sidebar
  const payload: SlackPayload = { blocks };
  if (message.color) {
    payload.attachments = [{
      color: message.color === 'good' ? '#36a64f'
           : message.color === 'warning' ? '#daa038'
           : '#a30200',  // danger
      blocks: []  // Empty - color shows as sidebar
    }];
  }

  return payload;
}

/**
 * Format analysis results into Slack Block Kit format
 */
export function formatAnalysisForSlack(
  result: NetworkAnalysisResult,
  includeDetails: boolean = false
): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "Network Analysis Summary",
      emoji: true,
    },
  });

  // Divider
  blocks.push({ type: "divider" });

  // Key Statistics Section
  const statsFields = [
    {
      type: "mrkdwn",
      text: `*Total Buyers:*\n${result.summary.totalBuyers}`,
    },
    {
      type: "mrkdwn",
      text: `*Total Suppliers:*\n${result.summary.totalSuppliers}`,
    },
    {
      type: "mrkdwn",
      text: `*Total Links:*\n${result.summary.totalLinks}`,
    },
    {
      type: "mrkdwn",
      text: `*Network Density:*\n${(result.metrics.density * 100).toFixed(2)}%`,
    },
  ];

  blocks.push({
    type: "section",
    fields: statsFields,
  });

  // Highlights Section
  const highlights: string[] = [];
  if (result.isolatedNodes.buyers.length > 0) {
    highlights.push(
      `• ${result.isolatedNodes.buyers.length} isolated buyer${result.isolatedNodes.buyers.length !== 1 ? "s" : ""}`
    );
  }
  if (result.isolatedNodes.suppliers.length > 0) {
    highlights.push(
      `• ${result.isolatedNodes.suppliers.length} isolated supplier${result.isolatedNodes.suppliers.length !== 1 ? "s" : ""}`
    );
  }
  if (result.hubs.topBuyers.length > 0) {
    const topBuyer = result.hubs.topBuyers[0];
    highlights.push(
      `• Top buyer hub: ${topBuyer.name || "Unnamed"} (${topBuyer.connectionCount} connections)`
    );
  }
  if (result.hubs.topSuppliers.length > 0) {
    const topSupplier = result.hubs.topSuppliers[0];
    highlights.push(
      `• Top supplier hub: ${topSupplier.name || "Unnamed"} (${topSupplier.connectionCount} connections)`
    );
  }

  if (highlights.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Highlights:*\n${highlights.join("\n")}`,
      },
    });
  }

  // Coverage Metrics
  blocks.push({
    type: "section",
    fields: [
      {
        type: "mrkdwn",
        text: `*Buyer Coverage:*\n${(result.metrics.buyerCoverage * 100).toFixed(1)}%`,
      },
      {
        type: "mrkdwn",
        text: `*Supplier Coverage:*\n${(result.metrics.supplierCoverage * 100).toFixed(1)}%`,
      },
      {
        type: "mrkdwn",
        text: `*Avg Suppliers/Buyer:*\n${result.summary.averageSuppliersPerBuyer.toFixed(2)}`,
      },
      {
        type: "mrkdwn",
        text: `*Avg Buyers/Supplier:*\n${result.summary.averageBuyersPerSupplier.toFixed(2)}`,
      },
    ],
  });

  // Action Items (if suggestions exist)
  if (result.suggestions && result.suggestions.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Action Items:*\n${result.suggestions.length} connection suggestion${result.suggestions.length !== 1 ? "s" : ""} available. Review the full analysis for details.`,
      },
    });
  }

  // Detailed breakdown (if requested)
  if (includeDetails) {
    blocks.push({ type: "divider" });

    // Isolated nodes details
    if (result.isolatedNodes.buyers.length > 0) {
      let isolatedBuyerList = result.isolatedNodes.buyers
        .slice(0, 5)
        .map(
          (b) =>
            `• ${b.name || "Unnamed"}${b.clientId ? ` (${b.clientId})` : ""}`
        )
        .join("\n");
      if (result.isolatedNodes.buyers.length > 5) {
        isolatedBuyerList += `\n... and ${result.isolatedNodes.buyers.length - 5} more`;
      }

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Isolated Buyers:*\n${isolatedBuyerList}`,
        },
      });
    }

    if (result.isolatedNodes.suppliers.length > 0) {
      let isolatedSupplierList = result.isolatedNodes.suppliers
        .slice(0, 5)
        .map((s) => `• ${s.name || "Unnamed"}`)
        .join("\n");
      if (result.isolatedNodes.suppliers.length > 5) {
        isolatedSupplierList += `\n... and ${result.isolatedNodes.suppliers.length - 5} more`;
      }

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Isolated Suppliers:*\n${isolatedSupplierList}`,
        },
      });
    }
  }

  // Footer with timestamp
  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Analysis generated at ${new Date(result.generatedAt).toLocaleString()}`,
      },
    ],
  });

  return blocks;
}

/**
 * Post analysis results to Slack via webhook
 */
export async function postToSlack(
  webhookUrl: string,
  analysisResult: NetworkAnalysisResult,
  includeDetails: boolean = false
): Promise<void> {
  const blocks = formatAnalysisForSlack(analysisResult, includeDetails);

  const payload = {
    blocks,
    text: "Network Analysis Summary", // Fallback text for notifications
  };

  try {
    const response = await axios.post(webhookUrl, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10 second timeout
    });

    if (response.status !== 200) {
      throw new Error(
        `Slack webhook returned status ${response.status}: ${response.statusText}`
      );
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        throw new Error(
          `Slack API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
        );
      } else if (error.request) {
        throw new Error(
          `No response from Slack webhook. Please check the URL and network connection.`
        );
      }
    }
    throw new Error(`Slack notification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Post a general message to Slack via webhook
 */
export async function postGeneralMessage(
  webhookUrl: string,
  message: SlackGeneralMessage
): Promise<void> {
  if (!webhookUrl) {
    throw new Error('Slack webhook URL is required');
  }

  const payload = formatGeneralMessage(message);

  try {
    const response = await axios.post(webhookUrl, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10 second timeout
    });

    if (response.status !== 200) {
      throw new Error(
        `Slack webhook returned status ${response.status}: ${response.statusText}`
      );
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        throw new Error(
          `Slack API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
        );
      } else if (error.request) {
        throw new Error(
          `No response from Slack webhook. Please check the URL and network connection.`
        );
      }
    }
    throw new Error(`Slack notification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

