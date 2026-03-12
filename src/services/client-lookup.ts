import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fuzzysort from "fuzzysort";
import {
  CLIENT_CONFIG_BUCKET_PREFIX,
  CLIENT_CONFIG_KEY,
  CLIENT_CONFIG_CACHE_TTL_MS,
} from "../constants.js";
import type { ClientsConfig, ClientRecord, ClientLookupResult } from "../types.js";

interface CacheEntry {
  clients: ClientRecord[];
  fetchedAt: number;
}

export class ClientLookupService {
  private s3: S3Client;
  private cache: Map<string, CacheEntry> = new Map();

  constructor() {
    this.s3 = new S3Client({});
  }

  async lookupByName(name: string, environment = "dev"): Promise<ClientLookupResult | null> {
    const clients = await this.getClients(environment);
    const targets = clients.map(c => c.name);

    const results = fuzzysort.go(name, targets, { limit: 1, threshold: -1000 });

    if (results.length === 0) {
      return null;
    }

    const bestMatch = results[0];
    const matchedClient = clients.find(c => c.name === bestMatch.target);

    if (!matchedClient) {
      return null;
    }

    return {
      clientId: matchedClient.id,
      name: matchedClient.name,
    };
  }

  async getAllClientNames(environment = "dev"): Promise<string[]> {
    const clients = await this.getClients(environment);
    return clients.map(c => c.name);
  }

  private async getClients(environment: string): Promise<ClientRecord[]> {
    const cached = this.cache.get(environment);
    if (cached && Date.now() - cached.fetchedAt < CLIENT_CONFIG_CACHE_TTL_MS) {
      return cached.clients;
    }

    const bucket = `${CLIENT_CONFIG_BUCKET_PREFIX}-${environment}`;
    const command = new GetObjectCommand({ Bucket: bucket, Key: CLIENT_CONFIG_KEY });
    const response = await this.s3.send(command);
    const body = await response.Body!.transformToString();
    const config: ClientsConfig = JSON.parse(body);

    this.cache.set(environment, {
      clients: config.clients,
      fetchedAt: Date.now(),
    });

    return config.clients;
  }
}

// Singleton
let instance: ClientLookupService | null = null;

export function getClientLookupService(): ClientLookupService {
  if (!instance) {
    instance = new ClientLookupService();
  }
  return instance;
}
