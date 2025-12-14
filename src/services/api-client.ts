import axios, { AxiosInstance, AxiosError } from "axios";
import { DEFAULT_BASE_URL, AUTH_HEADER } from "../constants.js";
import type { Supplier, Buyer, BuyerLink, AggregatorLink } from "../types.js";

export class NetworkAPIClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey?: string, baseURL?: string) {
    this.apiKey = apiKey || process.env.NETWORK_API_KEY || "";
    this.baseURL = baseURL || process.env.NETWORK_API_BASE_URL || DEFAULT_BASE_URL;

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey && { [AUTH_HEADER]: this.apiKey })
      },
      timeout: 30000
    });
  }

  /**
   * List all suppliers
   */
  async listSuppliers(includeLinks: boolean = false): Promise<Supplier[]> {
    try {
      const response = await this.client.get<Supplier[]>("/api/suppliers", {
        params: { includeLinks }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get supplier by ID
   */
  async getSupplier(id: string, includeLinks: boolean = false): Promise<Supplier> {
    try {
      const response = await this.client.get<Supplier>(`/api/suppliers/${id}`, {
        params: { includeLinks }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a new supplier
   */
  async createSupplier(supplier: Partial<Supplier>): Promise<Supplier> {
    try {
      const response = await this.client.post<Supplier>("/api/suppliers", supplier);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update supplier
   */
  async updateSupplier(id: string, supplier: Partial<Supplier>): Promise<Supplier> {
    try {
      const response = await this.client.put<Supplier>(`/api/suppliers/${id}`, supplier);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Patch supplier (partial update)
   */
  async patchSupplier(
    id: string,
    supplier: Partial<Supplier>,
    updateMask?: string
  ): Promise<Supplier> {
    try {
      const response = await this.client.patch<Supplier>(
        `/api/suppliers/${id}`,
        { supplier, updateMask }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Delete supplier (marks as INACTIVE)
   */
  async deleteSupplier(id: string): Promise<Supplier> {
    try {
      const response = await this.client.delete<Supplier>(`/api/suppliers/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get suppliers updated on a specific date
   */
  async getSuppliersByDate(date: string): Promise<Supplier[]> {
    try {
      const response = await this.client.get<Supplier[]>(`/api/suppliers/by-date/${date}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get suppliers updated from a specific date onwards
   */
  async getSuppliersByFromDate(fromDate: string): Promise<Supplier[]> {
    try {
      const response = await this.client.get<Supplier[]>(`/api/suppliers/from-date/${fromDate}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get supplier version history
   */
  async getSupplierHistory(
    id: string,
    format: "timeline" | "compact" | "default" = "compact"
  ): Promise<unknown> {
    try {
      const response = await this.client.get(`/api/suppliers/${id}/history`, {
        params: { format }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * List all buyers
   */
  async listBuyers(): Promise<Buyer[]> {
    try {
      const response = await this.client.get<Buyer[]>("/api/buyers");
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get buyer by ID
   */
  async getBuyer(id: string): Promise<Buyer> {
    try {
      const response = await this.client.get<Buyer>(`/api/buyers/${id}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get buyer by client ID
   */
  async getBuyerByClientId(clientId: string): Promise<Buyer> {
    try {
      const response = await this.client.get<Buyer>(`/api/buyers/by-client-id/${clientId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a new buyer
   */
  async createBuyer(buyer: Partial<Buyer>): Promise<Buyer> {
    try {
      const response = await this.client.post<Buyer>("/api/buyers", buyer);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get suppliers linked to a buyer
   */
  async getSuppliersForBuyer(buyerId: string): Promise<Supplier[]> {
    try {
      const response = await this.client.get<Supplier[]>(`/api/buyers/${buyerId}/suppliers`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get buyers linked to a supplier
   */
  async getBuyersForSupplier(supplierId: string): Promise<BuyerLink[]> {
    try {
      const response = await this.client.get<BuyerLink[]>(
        `/api/suppliers/${supplierId}/buyers`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * List all buyer-supplier links
   */
  async listBuyerLinks(): Promise<BuyerLink[]> {
    try {
      const response = await this.client.get<BuyerLink[]>("/api/buyer-links");
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get specific buyer-supplier link
   */
  async getBuyerLink(buyerId: string, supplierId: string): Promise<BuyerLink> {
    try {
      const response = await this.client.get<BuyerLink>(
        `/api/buyer-links/${buyerId}/supplier/${supplierId}`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create buyer-supplier link
   */
  async createBuyerLink(link: Partial<BuyerLink>): Promise<BuyerLink> {
    try {
      const response = await this.client.post<BuyerLink>("/api/buyer-links", link);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get buyer links by reference key
   */
  async getBuyerLinksByRefKey(buyerRefKey: string): Promise<BuyerLink[]> {
    try {
      const response = await this.client.get<BuyerLink[]>(
        `/api/buyer-links/by-ref-key/${buyerRefKey}`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * List all aggregator links
   */
  async listAggregatorLinks(): Promise<AggregatorLink[]> {
    try {
      const response = await this.client.get<AggregatorLink[]>("/api/aggregator-links");
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data as { error?: string; errors?: Array<{ field?: string; message?: string }> };

        if (status === 401) {
          return new Error("Authentication failed. Please check your API key.");
        } else if (status === 403) {
          return new Error("Permission denied. Your API key does not have the required permissions.");
        } else if (status === 404) {
          return new Error("Resource not found.");
        } else if (status === 400) {
          if (data.errors && Array.isArray(data.errors)) {
            const validationErrors = data.errors
              .map(e => `${e.field}: ${e.message}`)
              .join(", ");
            return new Error(`Validation failed: ${validationErrors}`);
          }
          return new Error(`Bad request: ${data.error || axiosError.message}`);
        } else if (status === 500) {
          return new Error(`Server error: ${data.error || "Internal server error"}`);
        } else {
          return new Error(`API error (${status}): ${data.error || axiosError.message}`);
        }
      } else if (axiosError.request) {
        return new Error(`No response from API at ${this.baseURL}. Please check the connection.`);
      }

      return new Error(`Request error: ${axiosError.message}`);
    }

    return new Error(`Unknown error: ${String(error)}`);
  }
}

// Singleton instance
let clientInstance: NetworkAPIClient | null = null;

export function getNetworkAPIClient(apiKey?: string, baseURL?: string): NetworkAPIClient {
  if (!clientInstance) {
    clientInstance = new NetworkAPIClient(apiKey, baseURL);
  }
  return clientInstance;
}
