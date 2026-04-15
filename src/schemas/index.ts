import { z } from "zod";
import { ResponseFormat, HistoryFormat } from "../constants.js";

// Common schemas
export const ResponseFormatSchema = z.nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable");

export const HistoryFormatSchema = z.nativeEnum(HistoryFormat)
  .default(HistoryFormat.COMPACT)
  .describe("History format: 'timeline' (categorized), 'compact' (summary), or 'default' (legacy)");

// Address schema
export const AddressSchema = z.object({
  streetAddress: z.string().optional().describe("Street address"),
  city: z.string().optional().describe("City name"),
  stateProvince: z.string().optional().describe("State or province (e.g., 'CA', 'NY')"),
  postalCode: z.string().optional().describe("Postal/ZIP code (e.g., '90210', '90210-1234')"),
  suiteUnit: z.string().optional().describe("Suite or unit number"),
  addressType: z.string().optional().describe("Address type (e.g., 'Business', 'Warehouse')")
}).describe("Address components for searching");

// Supplier search schema
export const SupplierSearchSchema = z.object({
  name: z.string()
    .optional()
    .describe("Supplier name or partial name to search for"),
  address: AddressSchema.optional(),
  email: z.string()
    .email()
    .optional()
    .describe("Supplier email address"),
  minMatchScore: z.number()
    .min(0)
    .max(1)
    .default(0.4)
    .describe("Minimum match score threshold (0.0-1.0). Default 0.4. Higher = stricter matching"),
  maxResults: z.number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Maximum number of results to return (1-100)"),
  response_format: ResponseFormatSchema
}).strict().refine(
  (data) => data.name || data.address || data.email,
  {
    message: "At least one search criterion must be provided (name, address, or email)"
  }
);

// List suppliers schema
export const ListSuppliersSchema = z.object({
  pageSize: z.number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Number of suppliers to return per page (1-100)"),
  cursor: z.string()
    .optional()
    .describe("Pagination cursor for fetching the next page of results"),
  response_format: ResponseFormatSchema
}).strict();

// Get supplier schema
export const GetSupplierSchema = z.object({
  id: z.string()
    .min(1, "Supplier ID cannot be empty")
    .describe("Unique supplier identifier"),
  includeLinks: z.boolean()
    .default(false)
    .describe("Include buyer and aggregator relationship links"),
  response_format: ResponseFormatSchema
}).strict();

// Get suppliers by date schema
export const GetSuppliersByDateSchema = z.object({
  date: z.string()
    .regex(/^\d{8}$/, "Date must be in yyyyMMdd format (e.g., 20251119)")
    .describe("Date in yyyyMMdd format to filter suppliers updated on that date"),
  response_format: ResponseFormatSchema
}).strict();

// Get supplier history schema
export const GetSupplierHistorySchema = z.object({
  id: z.string()
    .min(1, "Supplier ID cannot be empty")
    .describe("Supplier ID to get version history for"),
  format: HistoryFormatSchema,
  response_format: ResponseFormatSchema
}).strict();

// List buyers schema
export const ListBuyersSchema = z.object({
  response_format: ResponseFormatSchema
}).strict();

// Create buyer schema
export const CreateBuyerSchema = z.object({
  name: z.string()
    .optional()
    .describe("Buyer name"),
  franchiseName: z.string()
    .optional()
    .describe("Franchise name"),
  storeIdentifier: z.string()
    .optional()
    .describe("Store identifier"),
  clientId: z.string()
    .min(1, "Client ID cannot be empty")
    .describe("External client reference identifier"),
  status: z.enum(["ACTIVE", "PENDING", "INACTIVE"])
    .optional()
    .describe("Buyer lifecycle status (EntityStatus): ACTIVE | PENDING | INACTIVE"),
  addresses: z.array(AddressSchema)
    .optional()
    .describe("Buyer addresses"),
  contacts: z.array(z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    position: z.string().optional(),
    title: z.string().optional(),
    type: z.enum(["PRIMARY", "SECONDARY", "OTHER"]).optional()
  }))
    .optional()
    .describe("Buyer contacts"),
  response_format: ResponseFormatSchema
}).strict();

// Get buyer schema
export const GetBuyerSchema = z.object({
  id: z.string()
    .min(1, "Buyer ID cannot be empty")
    .describe("Unique buyer identifier"),
  response_format: ResponseFormatSchema
}).strict();

// Get buyer by client ID schema
export const GetBuyerByClientIdSchema = z.object({
  clientId: z.string()
    .min(1, "Client ID cannot be empty")
    .describe("External client reference identifier (without CLR# prefix)"),
  response_format: ResponseFormatSchema
}).strict();

// Get suppliers for buyer schema
export const GetSuppliersForBuyerSchema = z.object({
  buyerId: z.string()
    .min(1, "Buyer ID cannot be empty")
    .describe("Buyer ID to get linked suppliers for"),
  response_format: ResponseFormatSchema
}).strict();

// Get buyers for supplier schema
export const GetBuyersForSupplierSchema = z.object({
  supplierId: z.string()
    .min(1, "Supplier ID cannot be empty")
    .describe("Supplier ID to get linked buyers for"),
  response_format: ResponseFormatSchema
}).strict();

// Create buyer link schema
export const CreateBuyerLinkSchema = z.object({
  buyerId: z.string()
    .min(1, "Buyer ID cannot be empty")
    .describe("Unique buyer identifier"),
  supplierId: z.string()
    .min(1, "Supplier ID cannot be empty")
    .describe("Unique supplier identifier"),
  buyerSupplierRefId: z.string()
    .optional()
    .describe("External reference ID for the buyer-supplier relationship"),
  buyerRefKey: z.string()
    .optional()
    .describe("Reference key for the buyer-supplier relationship"),
  response_format: ResponseFormatSchema
}).strict();

// Upload file schema
export const UploadFileSchema = z.object({
  filePath: z.string()
    .min(1, "File path cannot be empty")
    .describe("Path to the CSV file to upload"),
  fileName: z.string()
    .optional()
    .describe("Optional filename override (defaults to basename of filePath)"),
  response_format: ResponseFormatSchema
}).strict();

// Network analysis schema
export const NetworkAnalysisSchema = z.object({
  includeSuggestions: z.boolean()
    .default(true)
    .describe("Whether to include connection suggestions in the analysis"),
  minConnectionsForHub: z.number()
    .int()
    .min(1)
    .default(5)
    .describe("Minimum number of connections required to be considered a network hub"),
  response_format: ResponseFormatSchema
}).strict();

// Slack notification schema (for analysis results - backward compatible)
export const SlackNotificationSchema = z.object({
  webhookUrl: z.string()
    .url("Must be a valid URL")
    .optional()
    .describe("Slack Incoming Webhook URL (optional if SLACK_WEBHOOK_URL environment variable is set)"),
  analysisResult: z.union([
    z.record(z.unknown()),
    z.string().describe("JSON string representation of the analysis result"),
    z.object({
      structuredContent: z.record(z.unknown()).describe("Wrapped result from tool response")
    })
  ])
    .describe("Network analysis result in any format: object, JSON string, or wrapped in structuredContent. Can be from network_analyze_connections tool or any compatible format."),
  includeDetails: z.boolean()
    .default(false)
    .describe("Whether to include detailed breakdowns in the Slack message"),
  response_format: ResponseFormatSchema
}).strict();

// Slack general message schemas
export const SlackActionButtonSchema = z.object({
  text: z.string().min(1).max(75),  // Slack limit
  url: z.string().url(),
  style: z.enum(['primary', 'danger']).optional()
});

export const SlackGeneralMessageSchema = z.object({
  title: z.string().max(150).optional(),
  body: z.string().min(1).max(3000),  // Slack section text limit
  fields: z.array(z.object({
    label: z.string().max(50),
    value: z.string().max(500)
  })).max(10).optional(),  // Slack fields limit
  actions: z.array(SlackActionButtonSchema).max(5).optional(),
  footer: z.string().max(200).optional(),
  color: z.enum(['good', 'warning', 'danger']).optional()
});

// Schema for the new general message tool
export const SlackGeneralNotificationSchema = z.object({
  webhookUrl: z.string()
    .url("Must be a valid URL")
    .optional()
    .describe("Slack Incoming Webhook URL (optional if SLACK_WEBHOOK_URL environment variable is set)"),
  message: SlackGeneralMessageSchema
    .describe("The message content to send to Slack"),
  response_format: ResponseFormatSchema
}).strict();

// Import analysis schema
export const ImportAnalysisSchema = z.object({
  mode: z.enum(["post-upload", "preview", "quality"])
    .describe("Analysis mode: 'post-upload' (what was imported), 'preview' (what would happen), 'quality' (data quality scoring)"),
  dateRange: z.object({
    from: z.string().regex(/^\d{8}$/, "Date must be in yyyyMMdd format"),
    to: z.string().regex(/^\d{8}$/, "Date must be in yyyyMMdd format")
  }).optional().describe("Date range in yyyyMMdd format (e.g., { from: '20251115', to: '20251119' })"),
  buyerId: z.string()
    .optional()
    .describe("Scope analysis to a specific buyer"),
  response_format: ResponseFormatSchema
}).strict();

// Relationship analysis schema
export const RelationshipAnalysisSchema = z.object({
  buyerId: z.string()
    .optional()
    .describe("Buyer ID to analyze (optional - analyzes all if not provided)"),
  analysisType: z.enum(["health", "coverage", "mapping"])
    .describe("Type of analysis: 'health' (link status), 'coverage' (supplier gaps), 'mapping' (network structure)"),
  includeInactive: z.boolean()
    .default(false)
    .describe("Whether to include inactive links in the analysis"),
  response_format: ResponseFormatSchema
}).strict();

// Data validation schema
export const DataValidationSchema = z.object({
  dateRange: z.object({
    from: z.string().regex(/^\d{8}$/, "Date must be in yyyyMMdd format"),
    to: z.string().regex(/^\d{8}$/, "Date must be in yyyyMMdd format")
  }).optional().describe("Date range of import batch to validate (yyyyMMdd format)"),
  buyerId: z.string()
    .optional()
    .describe("Scope validation to suppliers linked to this buyer"),
  response_format: ResponseFormatSchema
}).strict();

// List import batches schema
export const ListImportBatchesSchema = z.object({
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of import jobs to return (1-100, default 20)"),
  response_format: ResponseFormatSchema,
}).strict();

// Matching job schemas
export const ListMatchingJobsSchema = z.object({
  status: z.enum(["PENDING", "RUNNING", "REVIEW", "FINALIZING", "COMPLETED", "FAILED", "ABORTED"])
    .optional()
    .describe("Filter by job status"),
  response_format: ResponseFormatSchema,
}).strict();

export const GetMatchingJobSchema = z.object({
  jobId: z.string()
    .min(1, "Job ID cannot be empty")
    .describe("Matching job ID"),
  response_format: ResponseFormatSchema,
}).strict();

export const ListMatchCandidatesSchema = z.object({
  jobId: z.string()
    .min(1, "Job ID cannot be empty")
    .describe("Matching job ID"),
  category: z.enum(["EXACT_MATCH", "POSSIBLE_MATCH", "CONFLICT", "NET_NEW"])
    .optional()
    .describe("Filter by match category"),
  pageSize: z.number().int().min(1).max(100).default(20)
    .describe("Results per page (1-100, default 20)"),
  cursor: z.string().optional()
    .describe("Pagination cursor"),
  response_format: ResponseFormatSchema,
}).strict();

export const ListStagedMatchesSchema = z.object({
  jobId: z.string()
    .min(1, "Job ID cannot be empty")
    .describe("Matching job ID"),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "SKIPPED"])
    .optional()
    .describe("Filter by review status"),
  category: z.enum(["EXACT_MATCH", "POSSIBLE_MATCH", "CONFLICT", "NET_NEW"])
    .optional()
    .describe("Filter by match category"),
  pageSize: z.number().int().min(1).max(100).default(20)
    .describe("Results per page (1-100, default 20)"),
  cursor: z.string().optional()
    .describe("Pagination cursor"),
  response_format: ResponseFormatSchema,
}).strict();

// ========================================
// Consolidated Tool Schemas (public API)
// ========================================

// Admin-only per-request override: replaces the x-client-id header for this call.
// Each consolidated tool schema includes this field. Requires NETWORK_ADMIN_MODE=true
// on the server; otherwise the handler rejects the request with an actionable error.
const AsClientIdField = z.string().min(1).optional()
  .describe("Admin-only: override the x-client-id header for this request. Requires the server to run with NETWORK_ADMIN_MODE=true. Pair with lookup_client to resolve a client name to its UUID.");

export const SearchToolSchema = z.object({
  name: z.string().optional().describe("Supplier name or partial name to search for"),
  address: AddressSchema.optional(),
  email: z.string().email().optional().describe("Supplier email address"),
  minMatchScore: z.number().min(0).max(1).default(0.4)
    .describe("Minimum match score threshold (0.0-1.0). Default 0.4. Higher = stricter matching"),
  maxResults: z.number().int().min(1).max(100).default(10)
    .describe("Maximum number of results to return (1-100)"),
  asClientId: AsClientIdField,
}).refine(
  (data) => data.name || data.address || data.email,
  { message: "At least one search criterion must be provided (name, address, or email)" }
);

export const SuppliersToolSchema = z.object({
  action: z.enum(["list", "get", "history", "by_date"]),
  id: z.string().min(1).optional(),
  includeLinks: z.boolean().default(false),
  date: z.string().regex(/^\d{8}$/, "Date must be in yyyyMMdd format").optional(),
  format: HistoryFormatSchema.optional(),
  pageSize: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  asClientId: AsClientIdField,
}).refine(
  (data) => {
    if ((data.action === 'get' || data.action === 'history') && !data.id) return false;
    if (data.action === 'by_date' && !data.date) return false;
    return true;
  },
  (data) => {
    if ((data.action === 'get' || data.action === 'history') && !data.id)
      return { message: `The '${data.action}' action requires 'id'.` };
    if (data.action === 'by_date' && !data.date)
      return { message: "The 'by_date' action requires 'date' in yyyyMMdd format." };
    return { message: "Validation failed" };
  }
);

export const BuyersToolSchema = z.object({
  action: z.enum(["list", "get", "create"]),
  id: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  name: z.string().optional(),
  franchiseName: z.string().optional(),
  storeIdentifier: z.string().optional(),
  status: z.enum(["ACTIVE", "PENDING", "INACTIVE"]).optional(),
  addresses: z.array(AddressSchema).optional(),
  contacts: z.array(z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    position: z.string().optional(),
    title: z.string().optional(),
    type: z.enum(["PRIMARY", "SECONDARY", "OTHER"]).optional(),
  })).optional(),
  asClientId: AsClientIdField,
}).refine(
  (data) => {
    if (data.action === 'get' && !data.id && !data.clientId) return false;
    if (data.action === 'create' && !data.clientId) return false;
    return true;
  },
  (data) => {
    if (data.action === 'get') return { message: "The 'get' action requires either 'id' or 'clientId'." };
    if (data.action === 'create') return { message: "The 'create' action requires 'clientId'." };
    return { message: "Validation failed" };
  }
);

export const RelationshipsToolSchema = z.object({
  action: z.enum(["for_buyer", "for_supplier", "link"]),
  buyerId: z.string().min(1).optional(),
  supplierId: z.string().min(1).optional(),
  buyerSupplierRefId: z.string().optional(),
  buyerRefKey: z.string().optional(),
  asClientId: AsClientIdField,
}).refine(
  (data) => {
    if (data.action === 'for_buyer' && !data.buyerId) return false;
    if (data.action === 'for_supplier' && !data.supplierId) return false;
    if (data.action === 'link' && (!data.buyerId || !data.supplierId)) return false;
    return true;
  },
  (data) => {
    if (data.action === 'for_buyer') return { message: "The 'for_buyer' action requires 'buyerId'." };
    if (data.action === 'for_supplier') return { message: "The 'for_supplier' action requires 'supplierId'." };
    if (data.action === 'link') return { message: "The 'link' action requires both 'buyerId' and 'supplierId'." };
    return { message: "Validation failed" };
  }
);

export const ImportsToolSchema = z.object({
  action: z.enum(["upload", "batches", "validate"]),
  filePath: z.string().min(1).optional(),
  fileName: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  dateRange: z.object({
    from: z.string().regex(/^\d{8}$/, "Date must be in yyyyMMdd format"),
    to: z.string().regex(/^\d{8}$/, "Date must be in yyyyMMdd format"),
  }).optional(),
  buyerId: z.string().optional(),
  asClientId: AsClientIdField,
}).refine(
  (data) => {
    if (data.action === 'upload' && !data.filePath) return false;
    return true;
  },
  { message: "The 'upload' action requires 'filePath'." }
);

export const MatchingToolSchema = z.object({
  action: z.enum(["jobs", "job_detail", "candidates", "staged"]),
  jobId: z.string().min(1).optional(),
  status: z.string().optional(),
  category: z.enum(["EXACT_MATCH", "POSSIBLE_MATCH", "CONFLICT", "NET_NEW"]).optional(),
  pageSize: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  asClientId: AsClientIdField,
}).refine(
  (data) => {
    if (['job_detail', 'candidates', 'staged'].includes(data.action) && !data.jobId) return false;
    return true;
  },
  (data) => ({
    message: `The '${data.action}' action requires 'jobId'. Use matching with action 'jobs' to list available jobs.`,
  })
);

export const AnalyzeToolSchema = z.object({
  action: z.enum(["connections", "relationships", "import_quality"]),
  includeSuggestions: z.boolean().default(true),
  minConnectionsForHub: z.number().int().min(1).default(5),
  analysisType: z.enum(["health", "coverage", "mapping"]).optional(),
  includeInactive: z.boolean().default(false),
  mode: z.enum(["post-upload", "preview", "quality"]).optional(),
  buyerId: z.string().optional(),
  dateRange: z.object({
    from: z.string().regex(/^\d{8}$/, "Date must be in yyyyMMdd format"),
    to: z.string().regex(/^\d{8}$/, "Date must be in yyyyMMdd format"),
  }).optional(),
  asClientId: AsClientIdField,
}).refine(
  (data) => {
    if (data.action === 'relationships' && !data.analysisType) return false;
    if (data.action === 'import_quality' && !data.mode) return false;
    return true;
  },
  (data) => {
    if (data.action === 'relationships') return { message: "The 'relationships' action requires 'analysisType'." };
    if (data.action === 'import_quality') return { message: "The 'import_quality' action requires 'mode'." };
    return { message: "Validation failed" };
  }
);

export const NotifySlackToolSchema = z.object({
  type: z.enum(["analysis", "custom"]),
  webhookUrl: z.string().url().optional(),
  analysisResult: z.union([
    z.record(z.unknown()),
    z.string(),
    z.object({ structuredContent: z.record(z.unknown()) }),
  ]).optional(),
  includeDetails: z.boolean().default(false),
  message: SlackGeneralMessageSchema.optional(),
}).refine(
  (data) => {
    if (data.type === 'analysis' && !data.analysisResult) return false;
    if (data.type === 'custom' && !data.message) return false;
    return true;
  },
  (data) => {
    if (data.type === 'analysis') return { message: "The 'analysis' type requires 'analysisResult'." };
    if (data.type === 'custom') return { message: "The 'custom' type requires a 'message' object." };
    return { message: "Validation failed" };
  }
);

// Consolidated type exports
export type SearchToolInput = z.infer<typeof SearchToolSchema>;
export type SuppliersToolInput = z.infer<typeof SuppliersToolSchema>;
export type BuyersToolInput = z.infer<typeof BuyersToolSchema>;
export type RelationshipsToolInput = z.infer<typeof RelationshipsToolSchema>;
export type ImportsToolInput = z.infer<typeof ImportsToolSchema>;
export type MatchingToolInput = z.infer<typeof MatchingToolSchema>;
export type AnalyzeToolInput = z.infer<typeof AnalyzeToolSchema>;
export type NotifySlackToolInput = z.infer<typeof NotifySlackToolSchema>;

// Type exports for inference
export type SupplierSearchInput = z.infer<typeof SupplierSearchSchema>;
export type ListSuppliersInput = z.infer<typeof ListSuppliersSchema>;
export type GetSupplierInput = z.infer<typeof GetSupplierSchema>;
export type GetSuppliersByDateInput = z.infer<typeof GetSuppliersByDateSchema>;
export type GetSupplierHistoryInput = z.infer<typeof GetSupplierHistorySchema>;
export type ListBuyersInput = z.infer<typeof ListBuyersSchema>;
export type GetBuyerInput = z.infer<typeof GetBuyerSchema>;
export type GetBuyerByClientIdInput = z.infer<typeof GetBuyerByClientIdSchema>;
export type GetSuppliersForBuyerInput = z.infer<typeof GetSuppliersForBuyerSchema>;
export type GetBuyersForSupplierInput = z.infer<typeof GetBuyersForSupplierSchema>;
export type CreateBuyerLinkInput = z.infer<typeof CreateBuyerLinkSchema>;
export type CreateBuyerInput = z.infer<typeof CreateBuyerSchema>;
export type UploadFileInput = z.infer<typeof UploadFileSchema>;
export type NetworkAnalysisInput = z.infer<typeof NetworkAnalysisSchema>;
export type SlackNotificationInput = z.infer<typeof SlackNotificationSchema>;
export type SlackGeneralNotificationInput = z.infer<typeof SlackGeneralNotificationSchema>;
export type ImportAnalysisInput = z.infer<typeof ImportAnalysisSchema>;
export type RelationshipAnalysisInput = z.infer<typeof RelationshipAnalysisSchema>;
export type DataValidationInput = z.infer<typeof DataValidationSchema>;
export type ListImportBatchesInput = z.infer<typeof ListImportBatchesSchema>;
export type ListMatchingJobsInput = z.infer<typeof ListMatchingJobsSchema>;
export type GetMatchingJobInput = z.infer<typeof GetMatchingJobSchema>;
export type ListMatchCandidatesInput = z.infer<typeof ListMatchCandidatesSchema>;
export type ListStagedMatchesInput = z.infer<typeof ListStagedMatchesSchema>;

// Client lookup schema
export const LookupClientIdSchema = z.object({
  name: z.string()
    .min(1, "Client name cannot be empty")
    .describe("Human-friendly client name to look up (e.g. 'Comet Electric', 'Acumatica')"),
  environment: z.enum(["dev", "prod"])
    .default("dev")
    .describe("Target environment to look up the client ID for"),
}).strict();

export type LookupClientIdInput = z.infer<typeof LookupClientIdSchema>;

export const LookupClientToolSchema = LookupClientIdSchema;
export type LookupClientToolInput = z.infer<typeof LookupClientToolSchema>;
