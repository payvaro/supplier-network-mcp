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
  includeLinks: z.boolean()
    .default(false)
    .describe("Include buyer and aggregator relationship links in results"),
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
