import { getNetworkAPIClient } from "../services/api-client.js";
import {
  formatSupplierListMarkdown,
  formatOutput,
  createErrorResponse
} from "../services/formatter.js";
import type {
  ListBuyersInput,
  GetBuyerInput,
  GetBuyerByClientIdInput,
  GetSuppliersForBuyerInput,
  GetBuyersForSupplierInput,
  CreateBuyerLinkInput,
  CreateBuyerInput
} from "../schemas/index.js";
import type { BuyerListResult, SupplierListResult } from "../types.js";

/**
 * List all buyers
 */
export async function listBuyers(params: ListBuyersInput) {
  try {
    const client = getNetworkAPIClient();
    const buyers = await client.listBuyers();

    const result: BuyerListResult = {
      buyers,
      count: buyers.length
    };

    const formatted = formatOutput(
      result,
      params.response_format,
      () => {
        const parts = [
          "# Buyer List",
          "",
          `**Total:** ${buyers.length} buyer(s)`,
          "",
          "---",
          ""
        ];

        buyers.forEach((buyer, index) => {
          parts.push(`### ${buyer.name || "Unnamed Buyer"}`);
          parts.push("");
          if (buyer.id) parts.push(`**ID:** ${buyer.id}`);
          if (buyer.franchiseName) parts.push(`**Franchise:** ${buyer.franchiseName}`);
          if (buyer.storeIdentifier) parts.push(`**Store:** ${buyer.storeIdentifier}`);
          if (buyer.clientId) parts.push(`**Client ID:** ${buyer.clientId}`);
          if (buyer.status) parts.push(`**Status:** ${buyer.status}`);
          parts.push("");
          if (index < buyers.length - 1) {
            parts.push("---");
            parts.push("");
          }
        });

        return parts.join("\n");
      }
    );

    return {
      content: [{
        type: "text" as const,
        text: formatted.text
      }],
      structuredContent: formatted.structuredData
    };

  } catch (error) {
    const errorResponse = createErrorResponse(error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: errorResponse.text
      }]
    };
  }
}

/**
 * Get a specific buyer by ID
 */
export async function getBuyer(params: GetBuyerInput) {
  try {
    const client = getNetworkAPIClient();
    const buyer = await client.getBuyer(params.id);

    const formatted = formatOutput(
      buyer,
      params.response_format,
      () => {
        const parts = [
          `# Buyer: ${buyer.name || "Unnamed Buyer"}`,
          ""
        ];

        if (buyer.id) parts.push(`**ID:** ${buyer.id}`);
        if (buyer.franchiseName) parts.push(`**Franchise:** ${buyer.franchiseName}`);
        if (buyer.storeIdentifier) parts.push(`**Store Identifier:** ${buyer.storeIdentifier}`);
        if (buyer.clientId) parts.push(`**Client ID:** ${buyer.clientId}`);
        if (buyer.status) parts.push(`**Status:** ${buyer.status}`);

        if (buyer.addresses && buyer.addresses.length > 0) {
          parts.push("");
          parts.push("## Addresses");
          buyer.addresses.forEach((addr, idx) => {
            const addrParts = [];
            if (addr.streetAddress) addrParts.push(addr.streetAddress);
            if (addr.city) addrParts.push(addr.city);
            if (addr.stateProvince) addrParts.push(addr.stateProvince);
            if (addr.postalCode) addrParts.push(addr.postalCode);
            parts.push(`${idx + 1}. ${addrParts.join(", ")}`);
          });
        }

        if (buyer.contacts && buyer.contacts.length > 0) {
          parts.push("");
          parts.push("## Contacts");
          buyer.contacts.forEach((contact, idx) => {
            const contactParts = [];
            if (contact.name) contactParts.push(`**${contact.name}**`);
            if (contact.email) contactParts.push(contact.email);
            if (contact.phone) contactParts.push(contact.phone);
            if (contact.type) contactParts.push(`(${contact.type})`);
            parts.push(`${idx + 1}. ${contactParts.join(" • ")}`);
          });
        }

        return parts.join("\n");
      }
    );

    return {
      content: [{
        type: "text" as const,
        text: formatted.text
      }],
      structuredContent: formatted.structuredData
    };

  } catch (error) {
    const errorResponse = createErrorResponse(error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: errorResponse.text
      }]
    };
  }
}

/**
 * Get buyer by client ID
 */
export async function getBuyerByClientId(params: GetBuyerByClientIdInput) {
  try {
    const client = getNetworkAPIClient();
    const buyer = await client.getBuyerByClientId(params.clientId);

    const formatted = formatOutput(
      buyer,
      params.response_format,
      () => {
        const parts = [
          `# Buyer (Client ID: ${params.clientId})`,
          "",
          `**Name:** ${buyer.name || "Unnamed Buyer"}`
        ];

        if (buyer.id) parts.push(`**ID:** ${buyer.id}`);
        if (buyer.franchiseName) parts.push(`**Franchise:** ${buyer.franchiseName}`);
        if (buyer.status) parts.push(`**Status:** ${buyer.status}`);

        return parts.join("\n");
      }
    );

    return {
      content: [{
        type: "text" as const,
        text: formatted.text
      }],
      structuredContent: formatted.structuredData
    };

  } catch (error) {
    const errorResponse = createErrorResponse(error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: errorResponse.text
      }]
    };
  }
}

/**
 * Get suppliers linked to a buyer
 */
export async function getSuppliersForBuyer(params: GetSuppliersForBuyerInput) {
  try {
    const client = getNetworkAPIClient();
    const suppliers = await client.getSuppliersForBuyer(params.buyerId);

    const result: SupplierListResult = {
      suppliers,
      count: suppliers.length
    };

    const formatted = formatOutput(
      result,
      params.response_format,
      () => {
        const parts = [
          `# Suppliers for Buyer ${params.buyerId}`,
          "",
          `**Total Suppliers:** ${suppliers.length}`,
          "",
          "---",
          "",
          formatSupplierListMarkdown(suppliers)
        ];
        return parts.join("\n");
      }
    );

    return {
      content: [{
        type: "text" as const,
        text: formatted.text
      }],
      structuredContent: formatted.structuredData
    };

  } catch (error) {
    const errorResponse = createErrorResponse(error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: errorResponse.text
      }]
    };
  }
}

/**
 * Get buyers linked to a supplier
 */
export async function getBuyersForSupplier(params: GetBuyersForSupplierInput) {
  try {
    const client = getNetworkAPIClient();
    const buyerLinks = await client.getBuyersForSupplier(params.supplierId);

    const formatted = formatOutput(
      { buyerLinks, count: buyerLinks.length },
      params.response_format,
      () => {
        const parts = [
          `# Buyers for Supplier ${params.supplierId}`,
          "",
          `**Total Buyer Links:** ${buyerLinks.length}`,
          "",
          "---",
          ""
        ];

        buyerLinks.forEach((link, index) => {
          parts.push(`### Link ${index + 1}`);
          parts.push("");
          if (link.buyerId) parts.push(`**Buyer ID:** ${link.buyerId}`);
          if (link.buyerSupplierRefId) parts.push(`**Ref ID:** ${link.buyerSupplierRefId}`);
          if (link.buyerRefKey) parts.push(`**Ref Key:** ${link.buyerRefKey}`);
          if (link.connectionStatus) parts.push(`**Status:** ${link.connectionStatus}`);
          parts.push("");
          if (index < buyerLinks.length - 1) {
            parts.push("---");
            parts.push("");
          }
        });

        return parts.join("\n");
      }
    );

    return {
      content: [{
        type: "text" as const,
        text: formatted.text
      }],
      structuredContent: formatted.structuredData
    };

  } catch (error) {
    const errorResponse = createErrorResponse(error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: errorResponse.text
      }]
    };
  }
}

/**
 * Create a link between a buyer and supplier
 */
export async function createBuyerLink(params: CreateBuyerLinkInput) {
  try {
    const client = getNetworkAPIClient();
    
    // Prepare link data from params
    const linkData = {
      buyerId: params.buyerId,
      supplierId: params.supplierId,
      buyerSupplierRefId: params.buyerSupplierRefId,
      buyerRefKey: params.buyerRefKey
    };

    const buyerLink = await client.createBuyerLink(linkData);

    const formatted = formatOutput(
      buyerLink,
      params.response_format,
      () => {
        const parts = [
          "# Buyer-Supplier Link Created",
          "",
          "✅ Successfully created link between buyer and supplier",
          "",
          "## Link Details",
          ""
        ];

        if (buyerLink.buyerId) parts.push(`**Buyer ID:** ${buyerLink.buyerId}`);
        if (buyerLink.supplierId) parts.push(`**Supplier ID:** ${buyerLink.supplierId}`);
        if (buyerLink.buyerSupplierRefId) parts.push(`**Reference ID:** ${buyerLink.buyerSupplierRefId}`);
        if (buyerLink.buyerRefKey) parts.push(`**Reference Key:** ${buyerLink.buyerRefKey}`);

        return parts.join("\n");
      }
    );

    return {
      content: [{
        type: "text" as const,
        text: formatted.text
      }],
      structuredContent: formatted.structuredData
    };

  } catch (error) {
    const errorResponse = createErrorResponse(error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: errorResponse.text
      }]
    };
  }
}

/**
 * Create a new buyer
 */
export async function createBuyer(params: CreateBuyerInput) {
  try {
    const client = getNetworkAPIClient();
    
    // Prepare buyer data from params
    const buyerData = {
      name: params.name,
      franchiseName: params.franchiseName,
      storeIdentifier: params.storeIdentifier,
      clientId: params.clientId,
      status: params.status,
      addresses: params.addresses,
      contacts: params.contacts
    };

    const buyer = await client.createBuyer(buyerData);

    const formatted = formatOutput(
      buyer,
      params.response_format,
      () => {
        const parts = [
          "# Buyer Created",
          "",
          "✅ Successfully created buyer",
          "",
          "## Buyer Details",
          ""
        ];

        if (buyer.id) parts.push(`**ID:** ${buyer.id}`);
        if (buyer.name) parts.push(`**Name:** ${buyer.name}`);
        if (buyer.franchiseName) parts.push(`**Franchise:** ${buyer.franchiseName}`);
        if (buyer.storeIdentifier) parts.push(`**Store Identifier:** ${buyer.storeIdentifier}`);
        if (buyer.clientId) parts.push(`**Client ID:** ${buyer.clientId}`);
        if (buyer.status) parts.push(`**Status:** ${buyer.status}`);

        if (buyer.addresses && buyer.addresses.length > 0) {
          parts.push("");
          parts.push("## Addresses");
          buyer.addresses.forEach((addr, idx) => {
            const addrParts = [];
            if (addr.streetAddress) addrParts.push(addr.streetAddress);
            if (addr.city) addrParts.push(addr.city);
            if (addr.stateProvince) addrParts.push(addr.stateProvince);
            if (addr.postalCode) addrParts.push(addr.postalCode);
            parts.push(`${idx + 1}. ${addrParts.join(", ")}`);
          });
        }

        if (buyer.contacts && buyer.contacts.length > 0) {
          parts.push("");
          parts.push("## Contacts");
          buyer.contacts.forEach((contact, idx) => {
            const contactParts = [];
            if (contact.name) contactParts.push(`**${contact.name}**`);
            if (contact.email) contactParts.push(contact.email);
            if (contact.phone) contactParts.push(contact.phone);
            if (contact.type) contactParts.push(`(${contact.type})`);
            parts.push(`${idx + 1}. ${contactParts.join(" • ")}`);
          });
        }

        return parts.join("\n");
      }
    );

    return {
      content: [{
        type: "text" as const,
        text: formatted.text
      }],
      structuredContent: formatted.structuredData
    };

  } catch (error) {
    const errorResponse = createErrorResponse(error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      content: [{
        type: "text" as const,
        text: errorResponse.text
      }]
    };
  }
}
