import type {
  Supplier,
  SupplierMatch,
  SearchResult,
  Address,
  Contact
} from "../types.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../constants.js";

/**
 * Format address for display
 */
export function formatAddress(address: Address | undefined): string {
  if (!address) return "No address provided";

  const parts: string[] = [];

  if (address.streetAddress) parts.push(address.streetAddress);
  if (address.suiteUnit) parts.push(address.suiteUnit);
  if (address.city) parts.push(address.city);
  if (address.stateProvince) parts.push(address.stateProvince);
  if (address.postalCode) parts.push(address.postalCode);

  return parts.join(", ");
}

/**
 * Format contact for display
 */
export function formatContact(contact: Contact): string {
  const parts: string[] = [];

  if (contact.name) parts.push(`**${contact.name}**`);
  if (contact.position) parts.push(contact.position);
  if (contact.email) parts.push(`📧 ${contact.email}`);
  if (contact.phone) parts.push(`📞 ${contact.phone}`);
  if (contact.type) parts.push(`(${contact.type})`);

  return parts.join(" • ");
}

/**
 * Format a single supplier for Markdown
 */
export function formatSupplierMarkdown(supplier: Supplier, detailed: boolean = false): string {
  const parts: string[] = [];

  parts.push(`### ${supplier.name || "Unnamed Supplier"}`);
  parts.push("");

  if (supplier.id) parts.push(`**ID:** ${supplier.id}`);
  if (supplier.email) parts.push(`**Email:** ${supplier.email}`);

  if (supplier.address) {
    parts.push(`**Address:** ${formatAddress(supplier.address)}`);
  }

  if (detailed) {
    if (supplier.contacts && supplier.contacts.length > 0) {
      parts.push("");
      parts.push("**Contacts:**");
      supplier.contacts.forEach(contact => {
        parts.push(`- ${formatContact(contact)}`);
      });
    }

    if (supplier.aliases && supplier.aliases.length > 0) {
      parts.push("");
      parts.push(`**Aliases:** ${supplier.aliases.map(a => a.name).join(", ")}`);
    }

    if (supplier.buyerLinks && supplier.buyerLinks.length > 0) {
      parts.push("");
      parts.push(`**Buyer Links:** ${supplier.buyerLinks.length} connection(s)`);
    }
  }

  if (supplier.createdAt) {
    parts.push(`**Created:** ${new Date(supplier.createdAt).toLocaleDateString()}`);
  }
  if (supplier.updatedAt) {
    parts.push(`**Updated:** ${new Date(supplier.updatedAt).toLocaleDateString()}`);
  }

  return parts.join("\n");
}

/**
 * Format a supplier match for Markdown
 */
export function formatSupplierMatchMarkdown(match: SupplierMatch, index: number): string {
  const parts: string[] = [];

  // Match header with score
  const scorePercent = (match.matchScore.score * 100).toFixed(1);
  const scoreEmoji = match.matchScore.level === "exact" ? "🎯" :
                     match.matchScore.level === "high" ? "✅" :
                     match.matchScore.level === "medium" ? "🟡" : "🔶";

  parts.push(`## ${index + 1}. ${match.supplier.name || "Unnamed Supplier"} ${scoreEmoji}`);
  parts.push("");
  parts.push(`**Match Score:** ${scorePercent}% (${match.matchScore.level.toUpperCase()})`);
  parts.push("");

  // Match reasons
  if (match.matchScore.reasons.length > 0) {
    parts.push("**Why this matches:**");
    match.matchScore.reasons.forEach(reason => {
      parts.push(`- ${reason}`);
    });
    parts.push("");
  }

  // Field match scores
  const fieldScores: string[] = [];
  if (match.matchedFields.name !== undefined) {
    fieldScores.push(`Name: ${(match.matchedFields.name * 100).toFixed(0)}%`);
  }
  if (match.matchedFields.address !== undefined) {
    fieldScores.push(`Address: ${(match.matchedFields.address * 100).toFixed(0)}%`);
  }
  if (match.matchedFields.email !== undefined) {
    fieldScores.push(`Email: ${(match.matchedFields.email * 100).toFixed(0)}%`);
  }
  if (match.matchedFields.aliases !== undefined) {
    fieldScores.push(`Aliases: ${(match.matchedFields.aliases * 100).toFixed(0)}%`);
  }

  if (fieldScores.length > 0) {
    parts.push(`**Field Matches:** ${fieldScores.join(" | ")}`);
    parts.push("");
  }

  // Supplier details
  parts.push("---");
  parts.push("");
  if (match.supplier.id) parts.push(`**ID:** ${match.supplier.id}`);
  if (match.supplier.email) parts.push(`**Email:** ${match.supplier.email}`);
  if (match.supplier.address) {
    parts.push(`**Address:** ${formatAddress(match.supplier.address)}`);
  }

  if (match.supplier.contacts && match.supplier.contacts.length > 0) {
    parts.push("");
    parts.push("**Primary Contact:**");
    const primaryContact = match.supplier.contacts.find(c => c.type === "PRIMARY") || match.supplier.contacts[0];
    if (primaryContact) {
      parts.push(formatContact(primaryContact));
    }
  }

  return parts.join("\n");
}

/**
 * Format search results for Markdown
 */
export function formatSearchResultsMarkdown(result: SearchResult): string {
  const parts: string[] = [];

  parts.push("# 🔍 Supplier Search Results");
  parts.push("");

  // Query summary
  parts.push("## Search Query");
  if (result.query.name) {
    parts.push(`**Name:** ${result.query.name}`);
  }
  if (result.query.address) {
    parts.push(`**Address:** ${formatAddress(result.query.address)}`);
  }
  if (result.query.email) {
    parts.push(`**Email:** ${result.query.email}`);
  }
  parts.push("");
  parts.push(`**Total Matches Found:** ${result.totalMatches}`);
  parts.push("");
  parts.push("---");
  parts.push("");

  // Matches
  if (result.matches.length === 0) {
    parts.push("No matches found. Try:");
    parts.push("- Using partial names or addresses");
    parts.push("- Checking for typos");
    parts.push("- Broadening your search criteria");
  } else {
    result.matches.forEach((match, index) => {
      parts.push(formatSupplierMatchMarkdown(match, index));
      parts.push("");
      if (index < result.matches.length - 1) {
        parts.push("---");
        parts.push("");
      }
    });
  }

  return parts.join("\n");
}

/**
 * Format supplier list for Markdown
 */
export function formatSupplierListMarkdown(suppliers: Supplier[]): string {
  const parts: string[] = [];

  parts.push("# Supplier List");
  parts.push("");
  parts.push(`**Total:** ${suppliers.length} supplier(s)`);
  parts.push("");
  parts.push("---");
  parts.push("");

  suppliers.forEach((supplier, index) => {
    parts.push(formatSupplierMarkdown(supplier, false));
    parts.push("");
    if (index < suppliers.length - 1) {
      parts.push("---");
      parts.push("");
    }
  });

  return parts.join("\n");
}

/**
 * Truncate text if needed
 */
export function truncateIfNeeded(text: string, limit: number = CHARACTER_LIMIT): string {
  if (text.length <= limit) {
    return text;
  }

  const truncated = text.substring(0, limit - 100);
  const lastNewline = truncated.lastIndexOf("\n");
  const cutPoint = lastNewline > 0 ? lastNewline : limit - 100;

  return truncated.substring(0, cutPoint) +
    `\n\n... [Output truncated at ${cutPoint} characters. Use pagination or filters to reduce result size.]`;
}

/**
 * Format output based on response format preference
 */
export function formatOutput<T>(
  data: T,
  format: ResponseFormat,
  markdownFormatter: () => string
): { text: string; structuredData?: T } {
  if (format === ResponseFormat.JSON) {
    return {
      text: JSON.stringify(data, null, 2),
      structuredData: data
    };
  } else {
    return {
      text: truncateIfNeeded(markdownFormatter()),
      structuredData: data
    };
  }
}

/**
 * Create error response
 */
export function createErrorResponse(message: string): { text: string; isError: boolean } {
  return {
    text: `❌ Error: ${message}`,
    isError: true
  };
}
