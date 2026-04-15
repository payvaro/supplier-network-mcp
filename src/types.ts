// Network API TypeScript types
//
// These types mirror the `bundledOpenapi.yaml` contract in the Network API repo.
// Fields are optional by default on response shapes; see the OpenAPI spec for
// authoritative nullability and required-field semantics.

/**
 * Lifecycle state of a top-level entity (Supplier, Buyer).
 * ACTIVE = operational, PENDING = awaiting activation, INACTIVE = soft-deleted.
 */
export type EntityStatus = "ACTIVE" | "PENDING" | "INACTIVE";

/** Status value for sub-items (tags, verifications, remittance details, etc.). */
export type SubItemStatus = "ACTIVE" | "PENDING" | "INACTIVE" | "DELETED";

/** Connection status on relationship links (buyer-supplier, aggregator, acceptor integration). */
export type ConnectionStatus = "ACTIVE" | "PENDING" | "INACTIVE" | "DELETED";

/** Payment type used by remittance details and acceptor integrations. */
export type PaymentType = "ACH" | "WIRE" | "CARD" | "CHECK" | "OTHER";

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
  connectionStatus?: ConnectionStatus;
}

export interface AggregatorLink {
  aggregatorId?: string;
  supplierId?: string;
  buyerId?: string;
  aggregatorSupplierRefId?: string;
  aggregatorBuyerRefId?: string;
  connectionStatus?: ConnectionStatus;
  buyerRefKey?: string;
}

// --- Shared sub-item DTOs mirroring bundledOpenapi.yaml ---

export interface Tag {
  id?: string;
  name?: string;
  category?: string;
  status?: SubItemStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierExternalReference {
  id?: string;
  type?: "SUPPLIER_EXTERNAL_ID";
  code?: string;
  name?: string;
  description?: string;
  status?: SubItemStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface BuyerExternalReference {
  id?: string;
  type?: "BUYER_EXTERNAL_ID";
  code?: string;
  name?: string;
  description?: string;
  status?: SubItemStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type VerificationType = "KYC" | "KYB";
export type VerificationStatus = "PENDING" | "APPROVED" | "FAILED" | "EXCEPTION";

export interface Verification {
  id?: string;
  type?: VerificationType;
  verificationStatus?: VerificationStatus;
  required?: boolean;
  performedBy?: string;
  completionDate?: string;
  sourceOfVerification?: string;
  status?: SubItemStatus;
  lastModifiedBy?: string;
  lastModifiedByEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type UnderwritingStatus = "PENDING" | "APPROVED" | "DECLINED" | "EXCEPTION" | "EXPIRED";

export interface Underwriting {
  id?: string;
  underwritingStatus?: UnderwritingStatus;
  required?: boolean;
  performedBy?: string;
  completionDate?: string;
  sourceOfUnderwriting?: string;
  status?: SubItemStatus;
  lastModifiedBy?: string;
  lastModifiedByEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type LodgeCardStatus = "ACTIVE" | "INACTIVE" | "EXPIRED" | "REVOKED";
export type CardBrand = "VISA" | "MASTERCARD" | "AMEX" | "DISCOVER" | "OTHER";

export interface LodgeCard {
  id?: string;
  parentEntityType?: string;
  parentEntityId?: string;
  vaultToken?: string;
  status?: LodgeCardStatus;
  cardBrand?: CardBrand;
  lastFourDigits?: string;
  expiryDate?: string;
  cardholderName?: string;
  capturedAt?: string;
  capturedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CardAcceptorStatus = "ACCEPTED" | "REJECTED" | "UNKNOWN";
export type CardAcceptorSource = "MANUAL" | "PAYMENT_OUTCOME" | "EXTERNAL_SYNC";

export interface CardAcceptor {
  id?: string;
  cardAcceptorStatus?: CardAcceptorStatus;
  source?: CardAcceptorSource;
  status?: SubItemStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type RemittanceType = "EMAIL" | "FAX" | "PORTAL";

export interface RemittanceDetail {
  id?: string;
  value?: string;
  type?: RemittanceType;
  paymentType?: PaymentType;
  status?: SubItemStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface AcceptorIntegration {
  acceptorIntegrationId?: string;
  supplierId?: string;
  supplierName?: string;
  networkId?: string;
  acceptorName?: string;
  paymentRailId?: string;
  paymentType?: PaymentType;
  connectionStatus?: ConnectionStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierMergeState {
  mergedIntoSupplierId?: string;
  mergeJobId?: string;
  mergedAt?: string;
}

export interface BuyerCounts {
  buyerLinkCount?: number;
}

export interface EntityTypeResult {
  successCount: number;
  failureCount: number;
}

export interface FileImportJob {
  id: string;
  clientId: string;
  sourceFilename: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED" | "DISCARDED";
  fileProcessingRecordIds: string[];
  createdEntityCount: number;
  entityTypeSummaries: Record<string, EntityTypeResult>;
  createdAt: string;
}

export interface Supplier {
  id?: string;
  name?: string;
  shortId?: string;
  /** @deprecated Use contacts with type=PRIMARY instead. Spec marks this read-only; writes are silently ignored. */
  email?: string;
  status?: EntityStatus;
  tin?: string;
  dunsNumber?: string;
  address?: Address;
  contacts?: Contact[];
  aliases?: Alias[];
  metadata?: Metadata[];
  tags?: Tag[];
  externalReferences?: SupplierExternalReference[];
  verifications?: Verification[];
  underwritings?: Underwriting[];
  lodgeCards?: LodgeCard[];
  cardAcceptor?: CardAcceptor;
  remittanceDetails?: RemittanceDetail[];
  buyerLinks?: BuyerLink[];
  aggregatorLinks?: AggregatorLink[];
  acceptorIntegrations?: AcceptorIntegration[];
  mergeState?: SupplierMergeState | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface Buyer {
  id?: string;
  name?: string;
  franchiseName?: string;
  storeIdentifier?: string;
  shortId?: string;
  clientId?: string;
  status?: EntityStatus;
  addresses?: Address[];
  contacts?: Contact[];
  metadata?: Metadata[];
  externalReferences?: BuyerExternalReference[];
  verifications?: Verification[];
  underwritings?: Underwriting[];
  buyerLinks?: BuyerLink[];
  aggregatorLinks?: AggregatorLink[];
  counts?: BuyerCounts;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ErrorResponse {
  error?: string;
}

// Pagination types
export interface PaginationInfo {
  count: number;
  pageSize: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationInfo;
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
  pagination?: PaginationInfo;
  [key: string]: unknown;
}

export interface BuyerListResult {
  buyers: Buyer[];
  count: number;
  [key: string]: unknown;
}

// Network analysis types
export interface ConnectionStatistics {
  totalBuyers: number;
  totalSuppliers: number;
  totalLinks: number;
  averageSuppliersPerBuyer: number;
  averageBuyersPerSupplier: number;
  buyersWithLinks: number;
  suppliersWithLinks: number;
  connectionDistribution: {
    buyers: Record<number, number>; // connection count -> number of buyers
    suppliers: Record<number, number>; // connection count -> number of suppliers
  };
}

export interface IsolatedNode {
  id: string;
  name?: string;
  type: "buyer" | "supplier";
  clientId?: string;
  [key: string]: unknown;
}

export interface ConnectionSuggestion {
  buyerId: string;
  supplierId: string;
  buyerName?: string;
  supplierName?: string;
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface NetworkMetrics {
  density: number; // actual links / possible links
  coverage: number; // % of nodes with at least one connection
  buyerCoverage: number; // % of buyers with at least one link
  supplierCoverage: number; // % of suppliers with at least one link
}

export interface NetworkHub {
  id: string;
  name?: string;
  type: "buyer" | "supplier";
  connectionCount: number;
  clientId?: string;
  [key: string]: unknown;
}

export interface NetworkAnalysisResult {
  summary: ConnectionStatistics;
  isolatedNodes: {
    buyers: IsolatedNode[];
    suppliers: IsolatedNode[];
  };
  hubs: {
    topBuyers: NetworkHub[];
    topSuppliers: NetworkHub[];
  };
  suggestions?: ConnectionSuggestion[];
  metrics: NetworkMetrics;
  generatedAt: string;
}

// Import analysis types
export interface QualityIssue {
  field: string;
  issue: string;
  severity: "high" | "medium" | "low";
  affectedCount: number;
}

export interface ImportAnalysisSummary {
  totalRecords: number;
  newSuppliers: number;
  potentialDuplicates: number;
  exactMatches: number;
}

export interface ImportDuplicate {
  incoming: Supplier;
  existingMatches: SupplierMatch[];
}

export interface QualityMetrics {
  completeness: number;
  matchConfidence: number;
  issues: QualityIssue[];
}

export interface ImportAnalysisResult {
  mode: "post-upload" | "preview" | "quality";
  summary: ImportAnalysisSummary;
  duplicates: ImportDuplicate[];
  qualityMetrics?: QualityMetrics;
  recommendations: string[];
  generatedAt: string;
}

// Data validation types
export type ValidationSeverity = "error" | "warning" | "info";

export interface FieldValidationIssue {
  field: string;
  value: string;
  rule: string;
  message: string;
  severity: ValidationSeverity;
  suggestion: string;
}

export interface SupplierValidationResult {
  supplierId: string;
  supplierName?: string;
  issues: FieldValidationIssue[];
  issueCount: number;
  highestSeverity: ValidationSeverity;
}

export interface ValidationSummary {
  totalSuppliersScanned: number;
  suppliersWithIssues: number;
  totalIssues: number;
  issuesByField: Record<string, number>;
  issuesBySeverity: Record<ValidationSeverity, number>;
  issuesByRule: Record<string, number>;
}

export interface DataValidationResult {
  summary: ValidationSummary;
  suppliers: SupplierValidationResult[];
  recommendations: string[];
  generatedAt: string;
}

// Relationship analysis types
export interface HealthIssue {
  type: "stale_link" | "missing_contact" | "inactive_supplier";
  description: string;
  affectedIds: string[];
}

export interface RelationshipHealth {
  activeLinks: number;
  staleLinks: number;
  healthScore: number;
  issues: HealthIssue[];
}

export interface RelationshipCoverage {
  totalSuppliers: number;
  linkedSuppliers: number;
  coveragePercent: number;
  missingHighPriority: Supplier[];
}

export interface NetworkNode {
  id: string;
  type: "buyer" | "supplier";
  name?: string;
  linkCount: number;
}

export interface NetworkEdge {
  from: string;
  to: string;
  status: ConnectionStatus;
}

export interface RelationshipMapping {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface RelationshipAnalysisResult {
  analysisType: "health" | "coverage" | "mapping";
  buyer?: Buyer;
  health?: RelationshipHealth;
  coverage?: RelationshipCoverage;
  mapping?: RelationshipMapping;
  recommendations: string[];
  generatedAt: string;
}

// Client configuration (from S3 clients.json)
export interface ClientRecord {
  id: string;
  name: string;
  tokens: string[];
  networkAccessList: string[];
  paymentsAccessList: string[];
}

export interface ClientsConfig {
  clients: ClientRecord[];
}

export interface ClientLookupResult {
  clientId: string;
  name: string;
}

// Matching job types
export type MatchingJobStatus = "PENDING" | "RUNNING" | "REVIEW" | "FINALIZING" | "COMPLETED" | "FAILED" | "ABORTED";
export type MatchCategory = "EXACT_MATCH" | "POSSIBLE_MATCH" | "CONFLICT" | "NET_NEW";
export type StagedMatchStatus = "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";

export interface MatchSignal {
  type: string;
  score: number;
  weight: number;
  incomingValue?: string;
  matchedValue?: string;
}

export interface MatchAlternative {
  supplierId: string;
  supplierName?: string;
  confidenceScore: number;
  signals?: MatchSignal[];
}

export interface MatchingJob {
  jobId: string;
  tenantId?: string;
  fileName: string;
  status: MatchingJobStatus;
  totalRows: number;
  exactMatches: number;
  possibleMatches: number;
  conflicts: number;
  netNew: number;
  failed: number;
  merged: number;
  created: number;
  skipped: number;
  createdAt: string;
  completedAt?: string;
  statusMessage?: string;
}

export interface MatchCandidate {
  candidateId: string;
  jobId: string;
  rowNumber: number;
  incomingData?: Record<string, unknown>;
  rawRow?: string;
  category: MatchCategory;
  confidenceScore: number;
  matchedSupplierId?: string;
  resolution?: string;
  processedAt?: string;
}

export interface StagedMatch {
  stagedMatchId: string;
  jobId: string;
  candidate: MatchCandidate;
  alternatives: MatchAlternative[];
  status: StagedMatchStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  selectedSupplierId?: string;
  reviewNote?: string;
  aiRecommendation?: "MERGE" | "CREATE_NEW" | "REVIEW_MORE";
  aiConfidence?: number;
  aiRationale?: string;
}

// Slack notification types
export type SlackMessageType = 'general' | 'analysis';

export interface SlackActionButton {
  text: string;
  url: string;
  style?: 'primary' | 'danger';  // primary=green, danger=red
}

export interface SlackGeneralMessage {
  title?: string;                  // Header text (optional)
  body: string;                    // Main markdown content (required)
  fields?: Array<{                 // Key-value pairs displayed in grid
    label: string;
    value: string;
  }>;
  actions?: SlackActionButton[];   // Clickable buttons with URLs
  footer?: string;                 // Custom footer text
  color?: 'good' | 'warning' | 'danger';  // Attachment sidebar color
}
