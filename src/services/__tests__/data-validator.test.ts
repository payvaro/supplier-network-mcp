import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validateEmail,
  validateName,
  validatePhone,
  validateAddress,
  validateContact,
  detectCrossFieldContamination,
  validateSupplier,
  validateImportData,
} from "../data-validator.js";
import { createMockNetworkAPIClient, type MockNetworkAPIClient } from "../../__mocks__/api-client.mock.js";
import { getNetworkAPIClient } from "../api-client.js";
import type { Supplier, Contact, Address } from "../../types.js";

vi.mock("../api-client.js", () => ({
  getNetworkAPIClient: vi.fn(),
  NetworkAPIClient: vi.fn(),
}));

describe("data-validator", () => {
  // --- Email Validation ---
  describe("validateEmail", () => {
    it("returns no issues for a valid email", () => {
      expect(validateEmail("john@example.com", "email")).toEqual([]);
    });

    it("returns no issues for empty string", () => {
      expect(validateEmail("", "email")).toEqual([]);
      expect(validateEmail("  ", "email")).toEqual([]);
    });

    it.each(["N/A", "na", "none", "test", "unknown", "tbd", "-", ".", "null", "xxx"])
    ("detects placeholder value '%s'", (placeholder) => {
      const issues = validateEmail(placeholder, "email");
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "email_placeholder",
        severity: "error",
      });
    });

    it("detects name-like value in email field", () => {
      const issues = validateEmail("John Smith", "email");
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "email_name_like",
        severity: "error",
        suggestion: expect.stringContaining("contact name"),
      });
    });

    it("detects invalid format (no @ or domain)", () => {
      const issues = validateEmail("notanemail", "email");
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "email_invalid_format",
        severity: "error",
      });
    });

    it("detects invalid format (no domain after @)", () => {
      const issues = validateEmail("user@", "email");
      expect(issues).toHaveLength(1);
      expect(issues[0].rule).toBe("email_invalid_format");
    });

    it("uses the provided field path", () => {
      const issues = validateEmail("N/A", "contacts[0].email");
      expect(issues[0].field).toBe("contacts[0].email");
    });
  });

  // --- Name Validation ---
  describe("validateName", () => {
    it("returns no issues for a normal name", () => {
      expect(validateName("Acme Corporation", "name")).toEqual([]);
    });

    it("returns no issues for empty string", () => {
      expect(validateName("", "name")).toEqual([]);
    });

    it.each(["N/A", "test", "unknown", "tbd", "none"])
    ("detects placeholder value '%s'", (placeholder) => {
      const issues = validateName(placeholder, "name");
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "name_placeholder",
        severity: "error",
      });
    });

    it("detects too-short names", () => {
      const issues = validateName("A", "name");
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "name_too_short",
        severity: "warning",
      });
    });

    it("detects mostly numeric names", () => {
      const issues = validateName("12345", "name");
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "name_mostly_numeric",
        severity: "warning",
      });
    });

    it("detects address-like names", () => {
      const issues = validateName("123 Main Street", "name");
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "name_looks_like_address",
        severity: "warning",
      });
    });

    it("does not flag business names as address-like", () => {
      expect(validateName("Acme Solutions Inc", "name")).toEqual([]);
    });
  });

  // --- Address Validation ---
  describe("validateAddress", () => {
    it("returns no issues for a valid address", () => {
      const address: Address = {
        streetAddress: "123 Main St",
        city: "Springfield",
        stateProvince: "IL",
        postalCode: "62701",
      };
      expect(validateAddress(address)).toEqual([]);
    });

    it("detects person name in street address", () => {
      const address: Address = { streetAddress: "John Smith" };
      const issues = validateAddress(address);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "address_name_in_street",
        severity: "warning",
        field: "address.streetAddress",
      });
    });

    it("does not flag business names in street address", () => {
      const address: Address = { streetAddress: "McDonald's Corp" };
      expect(validateAddress(address)).toEqual([]);
    });

    it("does not flag addresses with numbers as person names", () => {
      const address: Address = { streetAddress: "Suite 100" };
      expect(validateAddress(address).filter(i => i.rule === "address_name_in_street")).toEqual([]);
    });

    it("detects numeric city", () => {
      const address: Address = { city: "12345" };
      const issues = validateAddress(address);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "address_city_numeric",
        severity: "warning",
      });
    });

    it("detects unknown long state code", () => {
      const address: Address = { stateProvince: "XYZ" };
      const issues = validateAddress(address);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "address_state_unknown",
        severity: "info",
      });
    });

    it("accepts valid US state codes", () => {
      expect(validateAddress({ stateProvince: "CA" })).toEqual([]);
      expect(validateAddress({ stateProvince: "ny" })).toEqual([]); // case-insensitive check via toUpperCase
    });

    it("accepts valid Canadian province codes", () => {
      expect(validateAddress({ stateProvince: "ON" })).toEqual([]);
      expect(validateAddress({ stateProvince: "BC" })).toEqual([]);
    });

    it("does not flag short unknown state codes (could be international)", () => {
      // 2-char codes that aren't US/CA are not flagged
      expect(validateAddress({ stateProvince: "ZZ" })).toEqual([]);
    });

    it("detects invalid US postal code", () => {
      const issues = validateAddress({ postalCode: "ABCDE" });
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "address_postal_invalid",
        severity: "info",
      });
    });

    it("accepts valid US postal codes", () => {
      expect(validateAddress({ postalCode: "90210" })).toEqual([]);
      expect(validateAddress({ postalCode: "90210-1234" })).toEqual([]);
    });

    it("accepts valid Canadian postal codes", () => {
      expect(validateAddress({ postalCode: "K1A 0B1" })).toEqual([]);
      expect(validateAddress({ postalCode: "M5V2T6" })).toEqual([]);
    });

    it("detects placeholder in street address", () => {
      const issues = validateAddress({ streetAddress: "N/A" });
      expect(issues).toHaveLength(1);
      expect(issues[0].rule).toBe("address_street_placeholder");
    });

    it("detects placeholder in city", () => {
      const issues = validateAddress({ city: "none" });
      expect(issues).toHaveLength(1);
      expect(issues[0].rule).toBe("address_city_placeholder");
    });
  });

  // --- Phone Validation ---
  describe("validatePhone", () => {
    it("returns no issues for a valid phone", () => {
      expect(validatePhone("555-123-4567", "phone")).toEqual([]);
      expect(validatePhone("(555) 123-4567", "phone")).toEqual([]);
      expect(validatePhone("+1 555 123 4567", "phone")).toEqual([]);
    });

    it("returns no issues for empty string", () => {
      expect(validatePhone("", "phone")).toEqual([]);
    });

    it.each(["N/A", "none", "test", "-"])
    ("detects placeholder '%s'", (placeholder) => {
      const issues = validatePhone(placeholder, "phone");
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "phone_placeholder",
        severity: "error",
      });
    });

    it("detects too-short phone numbers", () => {
      const issues = validatePhone("123", "phone");
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "phone_too_short",
        severity: "error",
      });
    });

    it("detects all-repeated-digit phone numbers", () => {
      const issues = validatePhone("1111111111", "phone");
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "phone_repeated_digits",
        severity: "warning",
      });
    });

    it("uses the provided field path", () => {
      const issues = validatePhone("123", "contacts[2].phone");
      expect(issues[0].field).toBe("contacts[2].phone");
    });
  });

  // --- Contact Validation ---
  describe("validateContact", () => {
    it("returns no issues for a valid contact", () => {
      const contact: Contact = {
        name: "John Doe",
        email: "john@example.com",
        phone: "555-123-4567",
      };
      expect(validateContact(contact, 0)).toEqual([]);
    });

    it("validates contact email", () => {
      const contact: Contact = { email: "N/A" };
      const issues = validateContact(contact, 0);
      expect(issues).toHaveLength(1);
      expect(issues[0].field).toBe("contacts[0].email");
    });

    it("validates contact phone", () => {
      const contact: Contact = { phone: "123" };
      const issues = validateContact(contact, 1);
      expect(issues).toHaveLength(1);
      expect(issues[0].field).toBe("contacts[1].phone");
    });

    it("validates contact name", () => {
      const contact: Contact = { name: "test" };
      const issues = validateContact(contact, 0);
      expect(issues).toHaveLength(1);
      expect(issues[0].field).toBe("contacts[0].name");
    });

    it("validates all fields on a contact with multiple issues", () => {
      const contact: Contact = {
        name: "test",
        email: "Bob Jones",
        phone: "123",
      };
      const issues = validateContact(contact, 0);
      expect(issues).toHaveLength(3);
    });
  });

  // --- Cross-Field Contamination ---
  describe("detectCrossFieldContamination", () => {
    it("returns no issues for clean supplier", () => {
      const supplier: Supplier = {
        name: "Acme Corp",
        email: "info@acme.com",
        address: { streetAddress: "123 Main St" },
      };
      expect(detectCrossFieldContamination(supplier)).toEqual([]);
    });

    it("detects phone number in email field", () => {
      const supplier: Supplier = { email: "555-123-4567" };
      const issues = detectCrossFieldContamination(supplier);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "cross_field_email_is_phone",
        severity: "warning",
      });
    });

    it("detects email in name field", () => {
      const supplier: Supplier = { name: "john@example.com" };
      const issues = detectCrossFieldContamination(supplier);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "cross_field_name_is_email",
        severity: "warning",
      });
    });

    it("detects email in street address field", () => {
      const supplier: Supplier = {
        address: { streetAddress: "info@company.com" },
      };
      const issues = detectCrossFieldContamination(supplier);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        rule: "cross_field_address_is_email",
        severity: "warning",
      });
    });
  });

  // --- Full Supplier Validation ---
  describe("validateSupplier", () => {
    it("returns no issues for a clean supplier", () => {
      const supplier: Supplier = {
        id: "s1",
        name: "Acme Corporation",
        email: "info@acme.com",
        address: {
          streetAddress: "123 Main St",
          city: "Springfield",
          stateProvince: "IL",
          postalCode: "62701",
        },
        contacts: [{
          name: "John Doe",
          email: "john@acme.com",
          phone: "555-123-4567",
        }],
      };
      expect(validateSupplier(supplier)).toEqual([]);
    });

    it("catches multiple issues on one supplier", () => {
      const supplier: Supplier = {
        id: "s1",
        name: "test",
        email: "Bob Johnson",
        address: { streetAddress: "Jane Doe", city: "12345" },
        contacts: [{ phone: "123" }],
      };
      const issues = validateSupplier(supplier);
      // name_placeholder, email_name_like, address_name_in_street, address_city_numeric, phone_too_short
      expect(issues.length).toBeGreaterThanOrEqual(5);
    });

    it("does not crash on supplier with no fields", () => {
      expect(validateSupplier({})).toEqual([]);
    });
  });

  // --- Integration: validateImportData ---
  describe("validateImportData", () => {
    let mockClient: MockNetworkAPIClient;

    beforeEach(() => {
      mockClient = createMockNetworkAPIClient();
      vi.mocked(getNetworkAPIClient).mockReturnValue(mockClient as never);
    });

    it("returns clean result for suppliers with no issues", async () => {
      mockClient.getAllSuppliers.mockResolvedValue([
        { id: "s1", name: "Acme Corp", email: "info@acme.com" },
      ]);

      const result = await validateImportData(mockClient as never);

      expect(result.summary.totalSuppliersScanned).toBe(1);
      expect(result.summary.suppliersWithIssues).toBe(0);
      expect(result.summary.totalIssues).toBe(0);
      expect(result.suppliers).toHaveLength(0);
      expect(result.recommendations[0]).toContain("No data quality issues");
    });

    it("identifies suppliers with issues", async () => {
      mockClient.getAllSuppliers.mockResolvedValue([
        { id: "s1", name: "Acme Corp", email: "info@acme.com" },
        { id: "s2", name: "test", email: "N/A" },
        { id: "s3", name: "Good Inc", email: "good@example.com" },
      ]);

      const result = await validateImportData(mockClient as never);

      expect(result.summary.totalSuppliersScanned).toBe(3);
      expect(result.summary.suppliersWithIssues).toBe(1);
      expect(result.suppliers).toHaveLength(1);
      expect(result.suppliers[0].supplierId).toBe("s2");
      expect(result.suppliers[0].issues.length).toBeGreaterThanOrEqual(2);
    });

    it("fetches by date range when provided", async () => {
      mockClient.getSuppliersByDate.mockResolvedValue([
        { id: "s1", name: "test", email: "N/A" },
      ]);

      const result = await validateImportData(
        mockClient as never,
        { from: "20260301", to: "20260301" }
      );

      expect(mockClient.getSuppliersByDate).toHaveBeenCalledWith("20260301");
      expect(result.summary.totalSuppliersScanned).toBe(1);
      expect(result.summary.suppliersWithIssues).toBe(1);
    });

    it("fetches multiple dates in range", async () => {
      mockClient.getSuppliersByDate
        .mockResolvedValueOnce([{ id: "s1", name: "Good Corp" }])
        .mockResolvedValueOnce([{ id: "s2", name: "test" }]);

      const result = await validateImportData(
        mockClient as never,
        { from: "20260301", to: "20260302" }
      );

      expect(mockClient.getSuppliersByDate).toHaveBeenCalledTimes(2);
      expect(result.summary.totalSuppliersScanned).toBe(2);
    });

    it("filters by buyerId when provided", async () => {
      mockClient.getAllSuppliers.mockResolvedValue([
        { id: "s1", name: "test", email: "N/A", buyerLinks: [{ buyerId: "b1" }] },
        { id: "s2", name: "test", email: "N/A", buyerLinks: [{ buyerId: "b2" }] },
      ]);

      const result = await validateImportData(
        mockClient as never,
        undefined,
        "b1"
      );

      expect(result.summary.totalSuppliersScanned).toBe(1);
      expect(result.suppliers[0].supplierId).toBe("s1");
    });

    it("populates summary aggregations correctly", async () => {
      mockClient.getAllSuppliers.mockResolvedValue([
        { id: "s1", email: "N/A" },
        { id: "s2", email: "John Smith" },
        { id: "s3", name: "Acme Corp", email: "good@example.com" },
      ]);

      const result = await validateImportData(mockClient as never);

      expect(result.summary.issuesBySeverity.error).toBeGreaterThanOrEqual(2);
      expect(result.summary.issuesByRule["email_placeholder"]).toBe(1);
      expect(result.summary.issuesByRule["email_name_like"]).toBe(1);
      expect(Object.keys(result.summary.issuesByField)).toContain("email");
    });

    it("generates targeted recommendations", async () => {
      mockClient.getAllSuppliers.mockResolvedValue([
        { id: "s1", email: "N/A" },
        { id: "s2", email: "none" },
        { id: "s3", name: "john@example.com" },
      ]);

      const result = await validateImportData(mockClient as never);

      const recText = result.recommendations.join(" ");
      expect(recText).toContain("placeholder emails");
      expect(recText).toContain("cross-field contamination");
    });

    it("handles empty supplier list", async () => {
      mockClient.getAllSuppliers.mockResolvedValue([]);

      const result = await validateImportData(mockClient as never);

      expect(result.summary.totalSuppliersScanned).toBe(0);
      expect(result.summary.suppliersWithIssues).toBe(0);
      expect(result.suppliers).toHaveLength(0);
    });

    it("handles API error on date fetch gracefully", async () => {
      mockClient.getSuppliersByDate.mockRejectedValue(new Error("Not found"));

      const result = await validateImportData(
        mockClient as never,
        { from: "20260301", to: "20260301" }
      );

      expect(result.summary.totalSuppliersScanned).toBe(0);
    });

    it("includes generatedAt timestamp", async () => {
      mockClient.getAllSuppliers.mockResolvedValue([]);
      const result = await validateImportData(mockClient as never);
      expect(result.generatedAt).toBeDefined();
      expect(new Date(result.generatedAt).getTime()).not.toBeNaN();
    });

    it("sets highestSeverity correctly on supplier results", async () => {
      mockClient.getAllSuppliers.mockResolvedValue([
        { id: "s1", email: "N/A", address: { stateProvince: "XYZ" } },
      ]);

      const result = await validateImportData(mockClient as never);

      // email_placeholder is "error", address_state_unknown is "info"
      // highest should be "error"
      expect(result.suppliers[0].highestSeverity).toBe("error");
    });
  });
});
