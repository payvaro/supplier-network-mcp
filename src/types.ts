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
  status: "ACTIVE" | "INACTIVE" | "PENDING";
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

// Config Rules (inferred from network OpenAPI — adjust if shapes diverge)
export interface ConfigRule {
  ruleId?: string;
  directiveType?: string;
  scopeType?: string;
  scopeId?: string;
  value?: unknown;
  status?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ConfigRuleListResponse {
  rules?: ConfigRule[];
  items?: ConfigRule[];
  pagination?: PaginationInfo;
  [key: string]: unknown;
}

export interface EffectiveRuleResponse {
  entityType?: string;
  entityId?: string;
  directives?: unknown[];
  [key: string]: unknown;
}

export interface DecisionTraceResponse {
  buyerId?: string;
  supplierId?: string;
  resolved?: unknown;
  trace?: unknown;
  [key: string]: unknown;
}

// Acceptor / AcceptorIntegration domain (used by support-tooling playbooks)

export interface Acceptor {
  id?: string;
  name?: string;
  status?: string;
  providerId?: string;
  providerName?: string;
  externalRef?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface AcceptorIntegration {
  id?: string;
  acceptorId?: string;
  supplierId?: string;
  providerId?: string;
  rail?: string;
  paymentType?: string;
  status?: string;
  externalRef?: string;
  config?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// Playbook / audit shapes

export type FindingSeverity = "high" | "medium" | "low";

export interface AuditFinding {
  severity: FindingSeverity;
  type:
    | "missing_buyer_link"
    | "missing_acceptor_integration"
    | "malformed_external_ids";
  /** Repair playbook to dispatch into. */
  playbook:
    | "fix-buyer-link"
    | "fix-acceptor-integration"
    | "fix-buyer-external-ids";
  /** Human-readable description of the finding. */
  message: string;
  /** Pre-shaped args for the matching repair playbook. */
  args: Record<string, unknown>;
  buyerId?: string;
  supplierId?: string;
  acceptorId?: string;
}

export interface AuditSummary {
  buyers: number;
  suppliers: number;
  missingLinks: number;
  missingIntegrations: number;
  malformedExternalIds: number;
}

export interface AuditClientResult {
  clientId: string;
  summary: AuditSummary;
  findings: AuditFinding[];
  generatedAt: string;
}

export interface DiagnoseBuyerLinkResult {
  buyerId: string;
  supplierId: string;
  exists: boolean;
  link?: BuyerLink;
  missingFields: string[];
  notes: string[];
}

export interface DiagnoseAcceptorIntegrationResult {
  supplierId?: string;
  acceptorId?: string;
  acceptors: Acceptor[];
  integrations: AcceptorIntegration[];
  missingIntegration: boolean;
  notes: string[];
}
