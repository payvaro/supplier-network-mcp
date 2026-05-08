import fuzzysort from "fuzzysort";
import { CLIENT_CONFIG_CACHE_TTL_MS } from "../constants.js";
import { getNetworkAPIClient } from "./api-client.js";
import type { NetworkAPIClient } from "./api-client.js";
import type { NetworkPartnerSummary, ClientLookupResult } from "../types.js";

interface CacheEntry {
  partners: NetworkPartnerSummary[];
  fetchedAt: number;
}

/**
 * Resolves human-readable client/tenant names to Network UUIDs.
 *
 * Backed by `GET /api/network-partners` on the Network API — the same source of
 * truth the rest of the API uses internally. Replaces an earlier implementation
 * that read `clients.json` from S3, which required AWS credentials in the MCP
 * process and risked drifting from the canonical Network data.
 */
export class ClientLookupService {
  private cache: CacheEntry | null = null;
  private apiClient?: NetworkAPIClient;

  constructor(apiClient?: NetworkAPIClient) {
    this.apiClient = apiClient;
  }

  async lookupByName(name: string): Promise<ClientLookupResult | null> {
    const partners = await this.getPartners();
    const targets = partners.map(p => p.name);

    const results = fuzzysort.go(name, targets, { limit: 1, threshold: -1000 });
    if (results.length === 0) {
      return null;
    }

    const match = partners.find(p => p.name === results[0].target);
    if (!match) {
      return null;
    }

    return { clientId: match.id, name: match.name };
  }

  async getAllClientNames(): Promise<string[]> {
    const partners = await this.getPartners();
    return partners.map(p => p.name);
  }

  private async getPartners(): Promise<NetworkPartnerSummary[]> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CLIENT_CONFIG_CACHE_TTL_MS) {
      return this.cache.partners;
    }

    const client = this.apiClient ?? getNetworkAPIClient();
    const partners = await client.listAllNetworkPartners();
    this.cache = { partners, fetchedAt: Date.now() };
    return partners;
  }
}

let instance: ClientLookupService | null = null;

export function getClientLookupService(): ClientLookupService {
  if (!instance) {
    instance = new ClientLookupService();
  }
  return instance;
}
