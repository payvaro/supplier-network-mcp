// Network API TypeScript types

export interface Address {
  streetAddress?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  suiteUnit?: string;
  addressType?: string;
}

export interface Contact {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  position?: string;
  title?: string;
  type?: "PRIMARY" | "SECONDARY" | "OTHER";
  createdAt?: string;
  updatedAt?: string;
}

export interface Alias {
  id?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Metadata {
  id?: string;
  providerId?: string;
  providerName?: string;
  sourceSystem?: string;
  fileName?: string;
  sourcePath?: string;
  rawInput?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BuyerLink {
  buyerId?: string;
  supplierId?: string;
  buyerSupplierRefId?: string;
  buyerRefKey?: string;
  connectionStatus?: "ACTIVE" | "INACTIVE" | "PENDING";
}

export interface AggregatorLink {
  aggregatorId?: string;
  supplierId?: string;
  buyerId?: string;
  aggregatorSupplierRefId?: string;
  aggregatorBuyerRefId?: string;
  connectionStatus?: "ACTIVE" | "INACTIVE" | "PENDING";
  buyerRefKey?: string;
}

export interface Supplier {
  id?: string;
  name?: string;
  email?: string;
  address?: Address;
  contacts?: Contact[];
  aliases?: Alias[];
  metadata?: Metadata[];
  buyerLinks?: BuyerLink[];
  aggregatorLinks?: AggregatorLink[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface Buyer {
  id?: string;
  name?: string;
  franchiseName?: string;
  storeIdentifier?: string;
  clientId?: string;
  status?: string;
  addresses?: Address[];
  contacts?: Contact[];
  buyerLinks?: BuyerLink[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ErrorResponse {
  error?: string;
}

export interface ValidationError {
  field?: string;
  message?: string;
}

export interface ValidationErrorResponse {
  errors?: ValidationError[];
}

// Matching and search types
export interface MatchScore {
  score: number;
  level: "exact" | "high" | "medium" | "low" | "none";
  reasons: string[];
}

export interface SupplierMatch {
  supplier: Supplier;
  matchScore: MatchScore;
  matchedFields: {
    name?: number;
    address?: number;
    email?: number;
    aliases?: number;
  };
}

export interface SearchResult {
  query: {
    name?: string;
    address?: Address;
    email?: string;
  };
  totalMatches: number;
  matches: SupplierMatch[];
  [key: string]: unknown;
}

export interface SupplierListResult {
  suppliers: Supplier[];
  count: number;
  [key: string]: unknown;
}

export interface BuyerListResult {
  buyers: Buyer[];
  count: number;
  [key: string]: unknown;
}
