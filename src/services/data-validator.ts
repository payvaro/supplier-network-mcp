import type { NetworkAPIClient } from "./api-client.js";
import type {
  Supplier,
  Address,
  Contact,
  FieldValidationIssue,
  SupplierValidationResult,
  ValidationSummary,
  ValidationSeverity,
  DataValidationResult,
} from "../types.js";

// --- Constants ---

const PLACEHOLDER_VALUES = new Set([
  "n/a", "na", "none", "test", "unknown", "tbd", "no email", "-", ".",
  "null", "undefined", "xxx", "abc", "asdf", "temp", "no", "yes",
]);

const STREET_INDICATORS = new Set([
  "st", "street", "ave", "avenue", "blvd", "boulevard", "rd", "road",
  "dr", "drive", "ln", "lane", "ct", "court", "way", "pl", "place",
  "cir", "circle", "hwy", "highway", "pkwy", "parkway", "terr", "terrace",
  "suite", "ste", "apt", "unit", "fl", "floor",
]);

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC", "PR", "VI", "GU", "AS", "MP",
]);

const CANADIAN_PROVINCE_CODES = new Set([
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
]);

const BUSINESS_SUFFIXES = new Set([
  "inc", "llc", "ltd", "corp", "corporation", "company", "co",
  "group", "holdings", "enterprises", "services", "solutions",
  "associates", "partners", "international", "industries",
]);

// --- Email Validation ---

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string, fieldPath: string): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];
  const trimmed = value.trim();
  if (!trimmed) return issues;

  const lower = trimmed.toLowerCase();

  // Check placeholders first
  if (PLACEHOLDER_VALUES.has(lower)) {
    issues.push({
      field: fieldPath,
      value: trimmed,
      rule: "email_placeholder",
      message: `Placeholder value "${trimmed}" in email field`,
      severity: "error",
      suggestion: "Remove placeholder and collect actual email address",
    });
    return issues;
  }

  // Name-like value (has spaces, no @)
  if (trimmed.includes(" ") && !trimmed.includes("@")) {
    issues.push({
      field: fieldPath,
      value: trimmed,
      rule: "email_name_like",
      message: `Name-like value "${trimmed}" in email field`,
      severity: "error",
      suggestion: "Move to contact name field or collect actual email address",
    });
    return issues;
  }

  // Invalid format
  if (!EMAIL_REGEX.test(trimmed)) {
    issues.push({
      field: fieldPath,
      value: trimmed,
      rule: "email_invalid_format",
      message: `Invalid email format: "${trimmed}"`,
      severity: "error",
      suggestion: "Correct the email format or remove if not a real email",
    });
  }

  return issues;
}

// --- Name Validation ---

const ADDRESS_PATTERN = /\d+\s+\w+\s+(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|way|pl|place|hwy|highway)\b/i;

export function validateName(value: string, fieldPath: string): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];
  const trimmed = value.trim();
  if (!trimmed) return issues;

  const lower = trimmed.toLowerCase();

  // Check placeholders
  if (PLACEHOLDER_VALUES.has(lower)) {
    issues.push({
      field: fieldPath,
      value: trimmed,
      rule: "name_placeholder",
      message: `Placeholder value "${trimmed}" in name field`,
      severity: "error",
      suggestion: "Replace with actual name",
    });
    return issues;
  }

  // Too short
  if (trimmed.length < 2) {
    issues.push({
      field: fieldPath,
      value: trimmed,
      rule: "name_too_short",
      message: `Name "${trimmed}" is too short (${trimmed.length} char)`,
      severity: "warning",
      suggestion: "Verify this is a complete name",
    });
    return issues;
  }

  // Mostly numeric
  const digitCount = (trimmed.match(/\d/g) || []).length;
  if (digitCount > trimmed.length * 0.5) {
    issues.push({
      field: fieldPath,
      value: trimmed,
      rule: "name_mostly_numeric",
      message: `Name "${trimmed}" is mostly numeric`,
      severity: "warning",
      suggestion: "Verify this is a name and not an ID or reference number",
    });
    return issues;
  }

  // Looks like an address
  if (ADDRESS_PATTERN.test(trimmed)) {
    issues.push({
      field: fieldPath,
      value: trimmed,
      rule: "name_looks_like_address",
      message: `Name "${trimmed}" looks like an address`,
      severity: "warning",
      suggestion: "Move to address field if this is an address",
    });
  }

  return issues;
}

// --- Address Validation ---

export function validateAddress(address: Address): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];

  if (address.streetAddress) {
    issues.push(...validateStreetAddress(address.streetAddress));
  }

  if (address.city) {
    issues.push(...validateCity(address.city));
  }

  if (address.stateProvince) {
    issues.push(...validateState(address.stateProvince));
  }

  if (address.postalCode) {
    issues.push(...validatePostalCode(address.postalCode));
  }

  return issues;
}

function validateStreetAddress(value: string): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];
  const trimmed = value.trim();
  if (!trimmed) return issues;

  const lower = trimmed.toLowerCase();

  // Check placeholder
  if (PLACEHOLDER_VALUES.has(lower)) {
    issues.push({
      field: "address.streetAddress",
      value: trimmed,
      rule: "address_street_placeholder",
      message: `Placeholder value "${trimmed}" in street address`,
      severity: "error",
      suggestion: "Remove placeholder and collect actual street address",
    });
    return issues;
  }

  // Check if it looks like a person name (2-3 alpha-only words, no digits, no street indicators)
  if (looksLikePersonName(trimmed)) {
    issues.push({
      field: "address.streetAddress",
      value: trimmed,
      rule: "address_name_in_street",
      message: `Street address "${trimmed}" looks like a person's name`,
      severity: "warning",
      suggestion: "Move to contact name field or verify this is a valid address",
    });
  }

  return issues;
}

function looksLikePersonName(value: string): boolean {
  const words = value.split(/\s+/);
  // Person names are typically 2-3 words
  if (words.length < 2 || words.length > 3) return false;
  // Must not contain any digits
  if (/\d/.test(value)) return false;
  // All words must be alphabetic (allow hyphens, apostrophes for O'Brien, etc.)
  if (!words.every(w => /^[a-zA-Z'-]+$/.test(w))) return false;
  // Must not contain street indicators
  if (words.some(w => STREET_INDICATORS.has(w.toLowerCase()))) return false;
  // Must not contain business suffixes
  if (words.some(w => BUSINESS_SUFFIXES.has(w.toLowerCase().replace(/[.,]/, "")))) return false;
  // Each word should start with uppercase (typical for names)
  if (!words.every(w => /^[A-Z]/.test(w))) return false;
  return true;
}

function validateCity(value: string): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];
  const trimmed = value.trim();
  if (!trimmed) return issues;

  if (PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) {
    issues.push({
      field: "address.city",
      value: trimmed,
      rule: "address_city_placeholder",
      message: `Placeholder value "${trimmed}" in city field`,
      severity: "error",
      suggestion: "Remove placeholder and collect actual city name",
    });
    return issues;
  }

  // City with digits (e.g., "12345" or "City123")
  if (/^\d+$/.test(trimmed) || /\d{3,}/.test(trimmed)) {
    issues.push({
      field: "address.city",
      value: trimmed,
      rule: "address_city_numeric",
      message: `City "${trimmed}" contains suspicious numeric content`,
      severity: "warning",
      suggestion: "Verify this is a valid city name — may be a postal code or ID in the wrong field",
    });
  }

  return issues;
}

function validateState(value: string): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];
  const trimmed = value.trim();
  if (!trimmed) return issues;

  const upper = trimmed.toUpperCase();

  // Only flag if it doesn't match known codes AND is longer than 2 chars
  // (short unknown codes could be international)
  if (!US_STATE_CODES.has(upper) && !CANADIAN_PROVINCE_CODES.has(upper) && trimmed.length > 2) {
    issues.push({
      field: "address.stateProvince",
      value: trimmed,
      rule: "address_state_unknown",
      message: `State/province "${trimmed}" is not a recognized US state or Canadian province code`,
      severity: "info",
      suggestion: "Use standard 2-letter code (e.g., CA, NY, ON) or verify if international",
    });
  }

  return issues;
}

const US_POSTAL_REGEX = /^\d{5}(-\d{4})?$/;
const CA_POSTAL_REGEX = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;

function validatePostalCode(value: string): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];
  const trimmed = value.trim();
  if (!trimmed) return issues;

  if (!US_POSTAL_REGEX.test(trimmed) && !CA_POSTAL_REGEX.test(trimmed)) {
    issues.push({
      field: "address.postalCode",
      value: trimmed,
      rule: "address_postal_invalid",
      message: `Postal code "${trimmed}" doesn't match US (12345/12345-6789) or Canadian (A1A 1A1) format`,
      severity: "info",
      suggestion: "Verify postal code format or confirm if international address",
    });
  }

  return issues;
}

// --- Phone Validation ---

export function validatePhone(value: string, fieldPath: string): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];
  const trimmed = value.trim();
  if (!trimmed) return issues;

  const lower = trimmed.toLowerCase();

  // Check placeholder
  if (PLACEHOLDER_VALUES.has(lower)) {
    issues.push({
      field: fieldPath,
      value: trimmed,
      rule: "phone_placeholder",
      message: `Placeholder value "${trimmed}" in phone field`,
      severity: "error",
      suggestion: "Remove placeholder and collect actual phone number",
    });
    return issues;
  }

  // Strip non-digit chars for numeric checks
  const digits = trimmed.replace(/\D/g, "");

  // Too short
  if (digits.length > 0 && digits.length < 7) {
    issues.push({
      field: fieldPath,
      value: trimmed,
      rule: "phone_too_short",
      message: `Phone number "${trimmed}" is too short (${digits.length} digits)`,
      severity: "error",
      suggestion: "Collect complete phone number with area code",
    });
    return issues;
  }

  // All same digit repeated
  if (digits.length >= 7 && new Set(digits.split("")).size === 1) {
    issues.push({
      field: fieldPath,
      value: trimmed,
      rule: "phone_repeated_digits",
      message: `Phone number "${trimmed}" is all repeated digits`,
      severity: "warning",
      suggestion: "Verify this is a real phone number",
    });
  }

  return issues;
}

// --- Contact Validation ---

export function validateContact(contact: Contact, index: number): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];
  const prefix = `contacts[${index}]`;

  if (contact.name) {
    issues.push(...validateName(contact.name, `${prefix}.name`));
  }

  if (contact.email) {
    issues.push(...validateEmail(contact.email, `${prefix}.email`));
  }

  if (contact.phone) {
    issues.push(...validatePhone(contact.phone, `${prefix}.phone`));
  }

  return issues;
}

// --- Cross-Field Contamination ---

export function detectCrossFieldContamination(supplier: Supplier): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];

  // Email looks like a phone number (all digits after stripping)
  if (supplier.email) {
    const stripped = supplier.email.trim().replace(/[\s\-().+]/g, "");
    if (/^\d{7,}$/.test(stripped)) {
      issues.push({
        field: "email",
        value: supplier.email,
        rule: "cross_field_email_is_phone",
        message: `Email field "${supplier.email}" looks like a phone number`,
        severity: "warning",
        suggestion: "Move to phone/contact field",
      });
    }
  }

  // Name contains @ (looks like email)
  if (supplier.name && supplier.name.includes("@")) {
    issues.push({
      field: "name",
      value: supplier.name,
      rule: "cross_field_name_is_email",
      message: `Name "${supplier.name}" looks like an email address`,
      severity: "warning",
      suggestion: "Move to email field",
    });
  }

  // Street address contains @
  if (supplier.address?.streetAddress && supplier.address.streetAddress.includes("@")) {
    issues.push({
      field: "address.streetAddress",
      value: supplier.address.streetAddress,
      rule: "cross_field_address_is_email",
      message: `Street address "${supplier.address.streetAddress}" contains @ — may be an email`,
      severity: "warning",
      suggestion: "Move to email field if this is an email address",
    });
  }

  return issues;
}

// --- Supplier Validation ---

export function validateSupplier(supplier: Supplier): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];

  if (supplier.name) {
    issues.push(...validateName(supplier.name, "name"));
  }

  if (supplier.email) {
    issues.push(...validateEmail(supplier.email, "email"));
  }

  if (supplier.address) {
    issues.push(...validateAddress(supplier.address));
  }

  if (supplier.contacts) {
    for (let i = 0; i < supplier.contacts.length; i++) {
      issues.push(...validateContact(supplier.contacts[i], i));
    }
  }

  issues.push(...detectCrossFieldContamination(supplier));

  return issues;
}

// --- Main Entry Point ---

interface DateRange {
  from: string;
  to: string;
}

/**
 * Normalize API response to array
 */
function normalizeToArray<T>(response: T[] | { items?: T[] } | unknown): T[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === "object" && "items" in response) {
    return (response as { items?: T[] }).items || [];
  }
  return [];
}

function parseDate(dateStr: string): Date {
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1;
  const day = parseInt(dateStr.substring(6, 8), 10);
  return new Date(year, month, day);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

const SEVERITY_ORDER: Record<ValidationSeverity, number> = { error: 0, warning: 1, info: 2 };

function highestSeverity(issues: FieldValidationIssue[]): ValidationSeverity {
  let highest: ValidationSeverity = "info";
  for (const issue of issues) {
    if (SEVERITY_ORDER[issue.severity] < SEVERITY_ORDER[highest]) {
      highest = issue.severity;
    }
  }
  return highest;
}

export async function validateImportData(
  client: NetworkAPIClient,
  dateRange?: DateRange,
  buyerId?: string
): Promise<DataValidationResult> {
  // Fetch suppliers (same pattern as import-analyzer)
  let suppliers: Supplier[];

  if (dateRange) {
    const startDate = parseDate(dateRange.from);
    const endDate = parseDate(dateRange.to);
    suppliers = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = formatDate(currentDate);
      try {
        const suppliersForDate = await client.getSuppliersByDate(dateStr);
        suppliers.push(...suppliersForDate);
      } catch {
        // Date might not have any suppliers
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else {
    const response = await client.getAllSuppliers();
    suppliers = normalizeToArray<Supplier>(response);
  }

  // Filter by buyer if specified
  if (buyerId && suppliers.length > 0) {
    suppliers = suppliers.filter(s =>
      s.buyerLinks?.some(link => link.buyerId === buyerId)
    );
  }

  // Validate each supplier
  const supplierResults: SupplierValidationResult[] = [];
  const issuesByField: Record<string, number> = {};
  const issuesBySeverity: Record<ValidationSeverity, number> = { error: 0, warning: 0, info: 0 };
  const issuesByRule: Record<string, number> = {};
  let totalIssues = 0;

  for (const supplier of suppliers) {
    const issues = validateSupplier(supplier);
    if (issues.length === 0) continue;

    supplierResults.push({
      supplierId: supplier.id || "unknown",
      supplierName: supplier.name,
      issues,
      issueCount: issues.length,
      highestSeverity: highestSeverity(issues),
    });

    totalIssues += issues.length;
    for (const issue of issues) {
      issuesByField[issue.field] = (issuesByField[issue.field] || 0) + 1;
      issuesBySeverity[issue.severity]++;
      issuesByRule[issue.rule] = (issuesByRule[issue.rule] || 0) + 1;
    }
  }

  const summary: ValidationSummary = {
    totalSuppliersScanned: suppliers.length,
    suppliersWithIssues: supplierResults.length,
    totalIssues,
    issuesByField,
    issuesBySeverity,
    issuesByRule,
  };

  const recommendations = generateValidationRecommendations(summary, issuesByRule);

  return {
    summary,
    suppliers: supplierResults,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

// --- Recommendations ---

function generateValidationRecommendations(
  summary: ValidationSummary,
  issuesByRule: Record<string, number>
): string[] {
  const recommendations: string[] = [];

  if (summary.totalIssues === 0) {
    recommendations.push("No data quality issues detected. All validated fields appear clean.");
    return recommendations;
  }

  const pct = ((summary.suppliersWithIssues / Math.max(summary.totalSuppliersScanned, 1)) * 100).toFixed(1);
  recommendations.push(
    `${summary.suppliersWithIssues} of ${summary.totalSuppliersScanned} suppliers (${pct}%) have data quality issues.`
  );

  // Specific rule-based recommendations
  if (issuesByRule["email_placeholder"]) {
    recommendations.push(
      `${issuesByRule["email_placeholder"]} supplier(s) have placeholder emails ("N/A", "none", etc.). Run a data collection campaign for these suppliers.`
    );
  }

  if (issuesByRule["email_name_like"]) {
    recommendations.push(
      `${issuesByRule["email_name_like"]} supplier(s) have names in the email field. Review import field mapping for the source file.`
    );
  }

  if (issuesByRule["address_name_in_street"]) {
    recommendations.push(
      `${issuesByRule["address_name_in_street"]} supplier(s) have person names in the street address field. Check import column mapping.`
    );
  }

  if (issuesByRule["phone_too_short"]) {
    recommendations.push(
      `${issuesByRule["phone_too_short"]} contact(s) have incomplete phone numbers. Collect full numbers with area codes.`
    );
  }

  const crossFieldRules = ["cross_field_email_is_phone", "cross_field_name_is_email", "cross_field_address_is_email"];
  const crossFieldTotal = crossFieldRules.reduce((sum, rule) => sum + (issuesByRule[rule] || 0), 0);
  if (crossFieldTotal > 0) {
    recommendations.push(
      `${crossFieldTotal} instance(s) of cross-field contamination detected. Data appears to be in the wrong fields — review import mapping.`
    );
  }

  if (summary.issuesBySeverity.error > 0) {
    recommendations.push(
      `${summary.issuesBySeverity.error} error-severity issue(s) should be addressed before this data is used in production.`
    );
  }

  return recommendations;
}
