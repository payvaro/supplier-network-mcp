import axios, { AxiosInstance, AxiosError } from "axios";
import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_BASE_URL, AUTH_HEADER, CLIENT_ID_HEADER } from "../constants.js";
import type { Supplier, Buyer, BuyerLink, AggregatorLink, PaginatedResponse } from "../types.js";

/**
 * Sanitizes an API key for use in HTTP headers by removing invalid characters.
 * Per RFC 7230, header field values must not contain control characters, newlines, or certain other characters.
 * 
 * @param apiKey - The raw API key to sanitize
 * @returns The sanitized API key
 */
function sanitizeApiKey(apiKey: string): string {
  if (!apiKey) {
    return apiKey;
  }

  // Trim whitespace including newlines and carriage returns
  let sanitized = apiKey.trim();

  // Remove control characters (0x00-0x1F and 0x7F)
  // Keep printable ASCII characters (0x20-0x7E) except for certain problematic ones
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");

  // Remove any remaining newlines and carriage returns that might have been missed
  sanitized = sanitized.replace(/[\r\n]/g, "");

  return sanitized;
}

/**
 * Masks an API key for safe logging, showing only first 4 and last 4 characters.
 * 
 * @param apiKey - The API key to mask
 * @returns Masked API key string (e.g., "abcd...wxyz")
 */
function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length <= 8) {
    return apiKey ? "*".repeat(apiKey.length) : "(empty)";
  }
  const first = apiKey.substring(0, 4);
  const last = apiKey.substring(apiKey.length - 4);
  return `${first}...${last}`;
}

/**
 * Detects invalid characters in an API key that would cause header errors.
 * 
 * @param apiKey - The API key to check
 * @returns Array of detected issues (empty if none)
 */
function detectInvalidCharacters(apiKey: string): string[] {
  const issues: string[] = [];

  if (!apiKey) {
    return issues;
  }

  // Check for control characters
  if (/[\x00-\x1F\x7F]/.test(apiKey)) {
    const controlChars = apiKey.match(/[\x00-\x1F\x7F]/g);
    if (controlChars) {
      const uniqueChars = [...new Set(controlChars)];
      issues.push(`Control characters found: ${uniqueChars.map(c => `0x${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(", ")}`);
    }
  }

  // Check for newlines
  if (/[\r\n]/.test(apiKey)) {
    const newlineTypes: string[] = [];
    if (/\r/.test(apiKey)) newlineTypes.push("CR (\\r)");
    if (/\n/.test(apiKey)) newlineTypes.push("LF (\\n)");
    issues.push(`Newlines found: ${newlineTypes.join(", ")}`);
  }

  // Check for leading/trailing whitespace
  if (apiKey !== apiKey.trim()) {
    issues.push("Leading or trailing whitespace detected");
  }

  // Check for non-ASCII characters
  const nonAsciiChars: string[] = [];
  for (let i = 0; i < apiKey.length; i++) {
    const char = apiKey[i];
    const code = char.charCodeAt(0);
    if (code > 127) {
      nonAsciiChars.push(`${char} (U+${code.toString(16).toUpperCase().padStart(4, '0')})`);
    }
  }
  if (nonAsciiChars.length > 0) {
    const uniqueNonAscii = [...new Set(nonAsciiChars)];
    issues.push(`Non-ASCII characters found: ${uniqueNonAscii.join(", ")}`);
  }

  // Check if API key looks like a UUID but contains invalid characters
  // UUIDs should be: 8-4-4-4-12 hex digits with hyphens
  const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (apiKey.length === 36 && !uuidPattern.test(apiKey)) {
    // Find which characters are invalid
    const invalidChars: string[] = [];
    for (let i = 0; i < apiKey.length; i++) {
      const char = apiKey[i];
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        if (char !== '-') {
          invalidChars.push(`Position ${i}: expected '-', found '${char}' (U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})`);
        }
      } else {
        if (!/[0-9a-fA-F]/.test(char)) {
          invalidChars.push(`Position ${i}: expected hex digit, found '${char}' (U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})`);
        }
      }
    }
    if (invalidChars.length > 0) {
      issues.push(`Invalid UUID format - non-hex characters: ${invalidChars.slice(0, 5).join(", ")}${invalidChars.length > 5 ? ` (and ${invalidChars.length - 5} more)` : ''}`);
    }
  }

  return issues;
}

export class NetworkAPIClient {
  private client: AxiosInstance;
  private apiKey: string;
  private clientId: string;
  private baseURL: string;

  constructor(apiKey?: string, baseURL?: string, clientId?: string) {
    const rawApiKey = apiKey || process.env.NETWORK_API_KEY || "";
    this.baseURL = baseURL || process.env.NETWORK_API_BASE_URL || DEFAULT_BASE_URL;
    this.clientId = clientId || process.env.NETWORK_CLIENT_ID || "";

    // Debug logging for API key
    console.error("[NetworkAPIClient] Initializing API client...");
    console.error(`[NetworkAPIClient] Base URL: ${this.baseURL}`);
    console.error(`[NetworkAPIClient] API key present: ${!!rawApiKey}`);
    console.error(`[NetworkAPIClient] Client ID present: ${!!this.clientId}`);
    if (this.clientId) {
      console.error(`[NetworkAPIClient] Client ID: ${this.clientId}`);
    }

    if (rawApiKey) {
      console.error(`[NetworkAPIClient] Raw API key length: ${rawApiKey.length}`);
      console.error(`[NetworkAPIClient] Raw API key (masked): ${maskApiKey(rawApiKey)}`);

      // Log character codes for first and last 4 characters to help debug encoding issues
      const first4 = rawApiKey.substring(0, 4);
      const last4 = rawApiKey.substring(rawApiKey.length - 4);
      console.error(`[NetworkAPIClient] First 4 chars: ${first4.split('').map(c => `${c} (U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})`).join(', ')}`);
      console.error(`[NetworkAPIClient] Last 4 chars: ${last4.split('').map(c => `${c} (U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})`).join(', ')}`);

      // Detect invalid characters
      const invalidChars = detectInvalidCharacters(rawApiKey);
      if (invalidChars.length > 0) {
        console.error(`[NetworkAPIClient] ⚠️  Invalid characters detected in API key:`);
        invalidChars.forEach(issue => console.error(`[NetworkAPIClient]   - ${issue}`));
      } else {
        console.error(`[NetworkAPIClient] ✓ No invalid characters detected in raw API key`);
      }

      // Sanitize the API key
      const sanitizedKey = sanitizeApiKey(rawApiKey);
      const wasChanged = sanitizedKey !== rawApiKey;

      if (wasChanged) {
        console.error(`[NetworkAPIClient] ⚠️  API key was sanitized (removed invalid characters)`);
        console.error(`[NetworkAPIClient] Sanitized API key length: ${sanitizedKey.length}`);
        console.error(`[NetworkAPIClient] Sanitized API key (masked): ${maskApiKey(sanitizedKey)}`);
      } else {
        console.error(`[NetworkAPIClient] ✓ API key passed validation (no sanitization needed)`);
        console.error(`[NetworkAPIClient] Sanitized API key (masked): ${maskApiKey(sanitizedKey)}`);
      }

      this.apiKey = sanitizedKey;
    } else {
      console.error(`[NetworkAPIClient] ⚠️  No API key provided - requests may fail with authentication errors`);
      this.apiKey = "";
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey && { [AUTH_HEADER]: `Bearer ${this.apiKey}` }),
        ...(this.clientId && { [CLIENT_ID_HEADER]: this.clientId })
      },
      timeout: 30000
    });
  }

  /**
   * List suppliers for the authenticated client with pagination
   */
  async listSuppliers(pageSize: number = 20, cursor?: string): Promise<PaginatedResponse<Supplier>> {
    try {
      const params: Record<string, unknown> = { pageSize };
      if (cursor) {
        params.cursor = cursor;
      }
      const response = await this.client.get<PaginatedResponse<Supplier>>("/api/my/suppliers", {
        params
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get all suppliers (for search/analysis - uses different endpoint)
   */
  async getAllSuppliers(): Promise<Supplier[]> {
    try {
      const response = await this.client.get<Supplier[]>("/api/suppliers");
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
   * Upload a file to the network API
   */
  async uploadFile(filePath: string, fileName?: string): Promise<unknown> {
    try {
      // Read the file from the filesystem
      const fileBuffer = await fs.readFile(filePath);
      
      // Determine the filename (use provided or extract from path)
      const finalFileName = fileName || path.basename(filePath);
      
      // Create FormData (Node.js 18+ has built-in FormData)
      const formData = new FormData();
      // Create a Blob from the buffer (Blob is available in Node.js 15.7.0+)
      const blob = new Blob([fileBuffer], { type: "text/csv" });
      // Append blob with filename (Node.js FormData supports this)
      formData.append("file", blob, finalFileName);
      
      // Make POST request with multipart/form-data
      // Note: axios will automatically detect FormData and set Content-Type with boundary
      // We create a custom config to override the default Content-Type header
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers[AUTH_HEADER] = `Bearer ${this.apiKey}`;
      }
      if (this.clientId) {
        headers[CLIENT_ID_HEADER] = this.clientId;
      }
      
      const response = await this.client.post<unknown>("/api/files/upload", formData, {
        headers,
        // Transform request to ensure FormData is handled correctly
        transformRequest: [(data) => data],
      });
      
      return response.data;
    } catch (error) {
      // Handle file system errors
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`File not found: ${filePath}`);
      }
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === "EACCES") {
        throw new Error(`Permission denied: Cannot read file ${filePath}`);
      }
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
    // Check for header-related errors (ERR_INVALID_CHAR)
    if (error instanceof Error) {
      const errorMessage = error.message;
      const errorName = error.name;
      
      // Check for Node.js header validation errors
      if (errorName === "TypeError" && errorMessage.includes("ERR_INVALID_CHAR")) {
        const headerMatch = errorMessage.match(/\["([^"]+)"\]/);
        const headerName = headerMatch ? headerMatch[1] : "header";
        
        console.error(`[NetworkAPIClient] ❌ Header validation error detected:`);
        console.error(`[NetworkAPIClient]   Header: ${headerName}`);
        console.error(`[NetworkAPIClient]   Error: ${errorMessage}`);
        
        // Get the actual header value
        let headerValue: string | undefined;
        if (headerName === AUTH_HEADER) {
          headerValue = this.apiKey;
        } else {
          // Try to get header from axios client defaults
          const headers = this.client.defaults.headers;
          if (headers.common && headerName in headers.common) {
            headerValue = (headers.common as Record<string, string>)[headerName];
          } else if (headerName in headers) {
            headerValue = (headers as Record<string, string>)[headerName];
          }
        }
        
        if (headerValue !== undefined) {
          console.error(`[NetworkAPIClient]   Header value length: ${headerValue.length}`);
          console.error(`[NetworkAPIClient]   Header value (masked): ${maskApiKey(headerValue)}`);
          
          // Dump full header contents with character analysis
          console.error(`[NetworkAPIClient]   === Full Header Content Dump ===`);
          console.error(`[NetworkAPIClient]   Raw value: "${headerValue}"`);
          
          // Character-by-character analysis
          console.error(`[NetworkAPIClient]   Character breakdown:`);
          for (let i = 0; i < Math.min(headerValue.length, 100); i++) {
            const char = headerValue[i];
            const code = char.charCodeAt(0);
            const hex = code.toString(16).toUpperCase().padStart(4, '0');
            const isInvalid = code < 32 || code === 127 || (code > 127 && code < 160) || code > 255;
            const status = isInvalid ? '❌' : code > 127 ? '⚠️' : '✓';
            const charRepr = code < 32 || code === 127 ? `\\x${code.toString(16).padStart(2, '0')}` : char;
            console.error(`[NetworkAPIClient]     [${i.toString().padStart(3, '0')}] ${status} '${charRepr}' (U+${hex}, dec: ${code})`);
          }
          if (headerValue.length > 100) {
            console.error(`[NetworkAPIClient]     ... (${headerValue.length - 100} more characters)`);
          }
          
          // Show bytes representation
          console.error(`[NetworkAPIClient]   Byte representation (first 100 bytes):`);
          const bytes = Buffer.from(headerValue, 'utf8');
          const byteLines: string[] = [];
          for (let i = 0; i < Math.min(bytes.length, 100); i += 16) {
            const chunk = bytes.slice(i, Math.min(i + 16, bytes.length));
            const hex = Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ');
            const ascii = Array.from(chunk).map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join('');
            byteLines.push(`[NetworkAPIClient]     ${i.toString(16).padStart(4, '0')}: ${hex.padEnd(48)} | ${ascii}`);
          }
          byteLines.forEach(line => console.error(line));
          if (bytes.length > 100) {
            console.error(`[NetworkAPIClient]     ... (${bytes.length - 100} more bytes)`);
          }
        } else {
          console.error(`[NetworkAPIClient]   ⚠️  Could not retrieve header value for debugging`);
        }
        
        if (headerName === AUTH_HEADER && headerValue) {
          console.error(`[NetworkAPIClient]   This indicates the API key contains invalid characters.`);
          console.error(`[NetworkAPIClient]   Current API key (masked): ${maskApiKey(this.apiKey)}`);
          console.error(`[NetworkAPIClient]   API key length: ${this.apiKey.length}`);
          
          const invalidChars = detectInvalidCharacters(this.apiKey);
          if (invalidChars.length > 0) {
            console.error(`[NetworkAPIClient]   Detected issues:`);
            invalidChars.forEach(issue => console.error(`[NetworkAPIClient]     - ${issue}`));
          }
          
          return new Error(
            `Invalid API key format: The API key contains characters that are not allowed in HTTP headers. ` +
            `Please check your API key for newlines, control characters, or other invalid characters. ` +
            `Error details: ${errorMessage}`
          );
        }
        
        return new Error(
          `Invalid header content for "${headerName}": ${errorMessage}. ` +
          `This usually indicates the header value contains invalid characters (newlines, control characters, etc.).`
        );
      }
    }

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

export function getNetworkAPIClient(apiKey?: string, baseURL?: string, clientId?: string): NetworkAPIClient {
  if (!clientInstance) {
    clientInstance = new NetworkAPIClient(apiKey, baseURL, clientId);
  }
  return clientInstance;
}
