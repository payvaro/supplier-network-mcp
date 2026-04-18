import { describe, it, expect } from 'vitest';
import {
  SupplierSearchSchema,
  ListSuppliersSchema,
  GetSupplierSchema,
  GetSuppliersByDateSchema,
  GetSupplierHistorySchema,
  ListBuyersSchema,
  CreateBuyerSchema,
  GetBuyerSchema,
  GetBuyerByClientIdSchema,
  GetSuppliersForBuyerSchema,
  GetBuyersForSupplierSchema,
  CreateBuyerLinkSchema,
  UploadFileSchema,
  NetworkAnalysisSchema,
  SlackNotificationSchema,
  AddressSchema,
  ResponseFormatSchema,
  HistoryFormatSchema,
  RulesToolSchema,
  LookupClientIdSchema,
  SearchToolSchema,
  SuppliersToolSchema,
  BuyersToolSchema,
  RelationshipsToolSchema,
  ImportsToolSchema,
  MatchingToolSchema,
  AnalyzeToolSchema,
  NotifySlackToolSchema,
  LookupClientToolSchema,
} from '../index.js';
import { ResponseFormat, HistoryFormat } from '../../constants.js';

describe('schemas', () => {
  describe('SupplierSearchSchema', () => {
    it('requires at least one search criterion', () => {
      const result = SupplierSearchSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one search criterion');
      }
    });

    it('accepts name as sole criterion', () => {
      const result = SupplierSearchSchema.safeParse({ name: 'Acme' });
      expect(result.success).toBe(true);
    });

    it('accepts email as sole criterion', () => {
      const result = SupplierSearchSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(true);
    });

    it('accepts address as sole criterion', () => {
      const result = SupplierSearchSchema.safeParse({
        address: { city: 'Springfield' },
      });
      expect(result.success).toBe(true);
    });

    it('validates email format', () => {
      const result = SupplierSearchSchema.safeParse({
        email: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    it('validates minMatchScore range (0-1)', () => {
      const tooLow = SupplierSearchSchema.safeParse({
        name: 'Test',
        minMatchScore: -0.1,
      });
      expect(tooLow.success).toBe(false);

      const tooHigh = SupplierSearchSchema.safeParse({
        name: 'Test',
        minMatchScore: 1.5,
      });
      expect(tooHigh.success).toBe(false);

      const valid = SupplierSearchSchema.safeParse({
        name: 'Test',
        minMatchScore: 0.5,
      });
      expect(valid.success).toBe(true);
    });

    it('validates maxResults range (1-100)', () => {
      const tooLow = SupplierSearchSchema.safeParse({
        name: 'Test',
        maxResults: 0,
      });
      expect(tooLow.success).toBe(false);

      const tooHigh = SupplierSearchSchema.safeParse({
        name: 'Test',
        maxResults: 101,
      });
      expect(tooHigh.success).toBe(false);

      const valid = SupplierSearchSchema.safeParse({
        name: 'Test',
        maxResults: 50,
      });
      expect(valid.success).toBe(true);
    });

    it('applies default values', () => {
      const result = SupplierSearchSchema.parse({ name: 'Test' });
      expect(result.minMatchScore).toBe(0.4);
      expect(result.maxResults).toBe(10);
      expect(result.response_format).toBe(ResponseFormat.MARKDOWN);
    });

    it('rejects unknown properties (strict mode)', () => {
      const result = SupplierSearchSchema.safeParse({
        name: 'Test',
        unknownField: 'value',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('GetSuppliersByDateSchema', () => {
    it('validates date format yyyyMMdd', () => {
      const valid = GetSuppliersByDateSchema.safeParse({ date: '20240115' });
      expect(valid.success).toBe(true);

      const invalidFormat = GetSuppliersByDateSchema.safeParse({
        date: '2024-01-15',
      });
      expect(invalidFormat.success).toBe(false);

      const tooShort = GetSuppliersByDateSchema.safeParse({ date: '2024011' });
      expect(tooShort.success).toBe(false);

      const tooLong = GetSuppliersByDateSchema.safeParse({ date: '202401150' });
      expect(tooLong.success).toBe(false);
    });
  });

  describe('CreateBuyerSchema', () => {
    it('requires clientId', () => {
      const result = CreateBuyerSchema.safeParse({ name: 'Test Buyer' });
      expect(result.success).toBe(false);
    });

    it('requires non-empty clientId', () => {
      const result = CreateBuyerSchema.safeParse({
        name: 'Test Buyer',
        clientId: '',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid buyer with all fields', () => {
      const result = CreateBuyerSchema.safeParse({
        name: 'Test Buyer',
        franchiseName: 'Test Franchise',
        storeIdentifier: 'STORE001',
        clientId: 'CLIENT-001',
        status: 'ACTIVE',
        addresses: [
          {
            streetAddress: '123 Main St',
            city: 'Springfield',
            stateProvince: 'IL',
            postalCode: '62701',
          },
        ],
        contacts: [
          {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '555-1234',
            type: 'PRIMARY',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('validates contact email format', () => {
      const result = CreateBuyerSchema.safeParse({
        clientId: 'CLIENT-001',
        contacts: [{ email: 'invalid-email' }],
      });
      expect(result.success).toBe(false);
    });

    it('validates contact type enum', () => {
      const valid = CreateBuyerSchema.safeParse({
        clientId: 'CLIENT-001',
        contacts: [{ type: 'PRIMARY' }],
      });
      expect(valid.success).toBe(true);

      const invalid = CreateBuyerSchema.safeParse({
        clientId: 'CLIENT-001',
        contacts: [{ type: 'INVALID' }],
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('CreateBuyerLinkSchema', () => {
    it('requires buyerId and supplierId', () => {
      const missingBuyer = CreateBuyerLinkSchema.safeParse({
        supplierId: 'supplier-1',
      });
      expect(missingBuyer.success).toBe(false);

      const missingSupplier = CreateBuyerLinkSchema.safeParse({
        buyerId: 'buyer-1',
      });
      expect(missingSupplier.success).toBe(false);
    });

    it('requires non-empty IDs', () => {
      const emptyBuyer = CreateBuyerLinkSchema.safeParse({
        buyerId: '',
        supplierId: 'supplier-1',
      });
      expect(emptyBuyer.success).toBe(false);

      const emptySupplier = CreateBuyerLinkSchema.safeParse({
        buyerId: 'buyer-1',
        supplierId: '',
      });
      expect(emptySupplier.success).toBe(false);
    });

    it('accepts valid link with optional fields', () => {
      const result = CreateBuyerLinkSchema.safeParse({
        buyerId: 'buyer-1',
        supplierId: 'supplier-1',
        buyerSupplierRefId: 'REF-001',
        buyerRefKey: 'KEY-001',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('GetSupplierSchema', () => {
    it('requires supplier ID', () => {
      const result = GetSupplierSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('requires non-empty supplier ID', () => {
      const result = GetSupplierSchema.safeParse({ id: '' });
      expect(result.success).toBe(false);
    });

    it('accepts valid supplier ID with includeLinks', () => {
      const result = GetSupplierSchema.safeParse({
        id: 'supplier-123',
        includeLinks: true,
      });
      expect(result.success).toBe(true);
    });

    it('defaults includeLinks to false', () => {
      const result = GetSupplierSchema.parse({ id: 'supplier-123' });
      expect(result.includeLinks).toBe(false);
    });
  });

  describe('UploadFileSchema', () => {
    it('requires filePath', () => {
      const result = UploadFileSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('requires non-empty filePath', () => {
      const result = UploadFileSchema.safeParse({ filePath: '' });
      expect(result.success).toBe(false);
    });

    it('accepts valid filePath with optional fileName', () => {
      const result = UploadFileSchema.safeParse({
        filePath: '/path/to/file.csv',
        fileName: 'custom_name.csv',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('NetworkAnalysisSchema', () => {
    it('accepts empty object with defaults', () => {
      const result = NetworkAnalysisSchema.parse({});
      expect(result.includeSuggestions).toBe(true);
      expect(result.minConnectionsForHub).toBe(5);
      expect(result.response_format).toBe(ResponseFormat.MARKDOWN);
    });

    it('validates minConnectionsForHub is positive integer', () => {
      const zero = NetworkAnalysisSchema.safeParse({
        minConnectionsForHub: 0,
      });
      expect(zero.success).toBe(false);

      const negative = NetworkAnalysisSchema.safeParse({
        minConnectionsForHub: -1,
      });
      expect(negative.success).toBe(false);

      const decimal = NetworkAnalysisSchema.safeParse({
        minConnectionsForHub: 5.5,
      });
      expect(decimal.success).toBe(false);
    });
  });

  describe('SlackNotificationSchema', () => {
    it('validates webhookUrl format when provided', () => {
      const invalid = SlackNotificationSchema.safeParse({
        webhookUrl: 'not-a-url',
        analysisResult: { totalBuyers: 10 },
      });
      expect(invalid.success).toBe(false);

      const valid = SlackNotificationSchema.safeParse({
        webhookUrl: 'https://hooks.slack.com/services/xxx',
        analysisResult: { totalBuyers: 10 },
      });
      expect(valid.success).toBe(true);
    });

    it('accepts object analysisResult', () => {
      const result = SlackNotificationSchema.safeParse({
        analysisResult: { summary: { totalBuyers: 10 } },
      });
      expect(result.success).toBe(true);
    });

    it('accepts string analysisResult (JSON)', () => {
      const result = SlackNotificationSchema.safeParse({
        analysisResult: '{"totalBuyers": 10}',
      });
      expect(result.success).toBe(true);
    });

    it('accepts structuredContent wrapped result', () => {
      const result = SlackNotificationSchema.safeParse({
        analysisResult: {
          structuredContent: { summary: { totalBuyers: 10 } },
        },
      });
      expect(result.success).toBe(true);
    });

    it('defaults includeDetails to false', () => {
      const result = SlackNotificationSchema.parse({
        analysisResult: { totalBuyers: 10 },
      });
      expect(result.includeDetails).toBe(false);
    });
  });

  describe('ListSuppliersSchema', () => {
    it('accepts empty object with defaults', () => {
      const result = ListSuppliersSchema.parse({});
      expect(result.pageSize).toBe(20);
      expect(result.cursor).toBeUndefined();
      expect(result.response_format).toBe(ResponseFormat.MARKDOWN);
    });
  });

  describe('ListBuyersSchema', () => {
    it('accepts empty object with defaults', () => {
      const result = ListBuyersSchema.parse({});
      expect(result.response_format).toBe(ResponseFormat.MARKDOWN);
    });
  });

  describe('GetBuyerSchema', () => {
    it('requires non-empty buyer ID', () => {
      const empty = GetBuyerSchema.safeParse({ id: '' });
      expect(empty.success).toBe(false);

      const valid = GetBuyerSchema.safeParse({ id: 'buyer-123' });
      expect(valid.success).toBe(true);
    });
  });

  describe('GetBuyerByClientIdSchema', () => {
    it('requires non-empty client ID', () => {
      const empty = GetBuyerByClientIdSchema.safeParse({ clientId: '' });
      expect(empty.success).toBe(false);

      const valid = GetBuyerByClientIdSchema.safeParse({
        clientId: 'CLIENT-001',
      });
      expect(valid.success).toBe(true);
    });
  });

  describe('GetSuppliersForBuyerSchema', () => {
    it('requires non-empty buyer ID', () => {
      const empty = GetSuppliersForBuyerSchema.safeParse({ buyerId: '' });
      expect(empty.success).toBe(false);

      const valid = GetSuppliersForBuyerSchema.safeParse({
        buyerId: 'buyer-123',
      });
      expect(valid.success).toBe(true);
    });
  });

  describe('GetBuyersForSupplierSchema', () => {
    it('requires non-empty supplier ID', () => {
      const empty = GetBuyersForSupplierSchema.safeParse({ supplierId: '' });
      expect(empty.success).toBe(false);

      const valid = GetBuyersForSupplierSchema.safeParse({
        supplierId: 'supplier-123',
      });
      expect(valid.success).toBe(true);
    });
  });

  describe('GetSupplierHistorySchema', () => {
    it('requires non-empty supplier ID', () => {
      const empty = GetSupplierHistorySchema.safeParse({ id: '' });
      expect(empty.success).toBe(false);

      const valid = GetSupplierHistorySchema.safeParse({ id: 'supplier-123' });
      expect(valid.success).toBe(true);
    });

    it('defaults format to compact', () => {
      const result = GetSupplierHistorySchema.parse({ id: 'supplier-123' });
      expect(result.format).toBe(HistoryFormat.COMPACT);
    });

    it('accepts valid format options', () => {
      const timeline = GetSupplierHistorySchema.safeParse({
        id: 'supplier-123',
        format: 'timeline',
      });
      expect(timeline.success).toBe(true);

      const compact = GetSupplierHistorySchema.safeParse({
        id: 'supplier-123',
        format: 'compact',
      });
      expect(compact.success).toBe(true);

      const defaultFmt = GetSupplierHistorySchema.safeParse({
        id: 'supplier-123',
        format: 'default',
      });
      expect(defaultFmt.success).toBe(true);
    });
  });

  describe('AddressSchema', () => {
    it('accepts empty object (all fields optional)', () => {
      const result = AddressSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts full address', () => {
      const result = AddressSchema.safeParse({
        streetAddress: '123 Main St',
        city: 'Springfield',
        stateProvince: 'IL',
        postalCode: '62701',
        suiteUnit: 'Suite 100',
        addressType: 'Business',
      });
      expect(result.success).toBe(true);
    });

    it('accepts partial address', () => {
      const result = AddressSchema.safeParse({
        city: 'Springfield',
        stateProvince: 'IL',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ResponseFormatSchema', () => {
    it('defaults to markdown', () => {
      const result = ResponseFormatSchema.parse(undefined);
      expect(result).toBe(ResponseFormat.MARKDOWN);
    });

    it('accepts markdown', () => {
      const result = ResponseFormatSchema.safeParse('markdown');
      expect(result.success).toBe(true);
    });

    it('accepts json', () => {
      const result = ResponseFormatSchema.safeParse('json');
      expect(result.success).toBe(true);
    });

    it('rejects invalid format', () => {
      const result = ResponseFormatSchema.safeParse('xml');
      expect(result.success).toBe(false);
    });
  });

  describe('HistoryFormatSchema', () => {
    it('defaults to compact', () => {
      const result = HistoryFormatSchema.parse(undefined);
      expect(result).toBe(HistoryFormat.COMPACT);
    });

    it('accepts all valid formats', () => {
      expect(HistoryFormatSchema.safeParse('timeline').success).toBe(true);
      expect(HistoryFormatSchema.safeParse('compact').success).toBe(true);
      expect(HistoryFormatSchema.safeParse('default').success).toBe(true);
    });

    it('rejects invalid format', () => {
      const result = HistoryFormatSchema.safeParse('detailed');
      expect(result.success).toBe(false);
    });
  });

  describe('LookupClientIdSchema', () => {
    it('requires non-empty name', () => {
      const empty = LookupClientIdSchema.safeParse({ name: '' });
      expect(empty.success).toBe(false);
    });

    it('accepts valid name with default environment', () => {
      const result = LookupClientIdSchema.safeParse({ name: 'Comet Electric' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.environment).toBe('dev');
      }
    });

    it('accepts explicit environment', () => {
      const result = LookupClientIdSchema.safeParse({ name: 'Comet Electric', environment: 'prod' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.environment).toBe('prod');
      }
    });

    it('rejects invalid environment', () => {
      const result = LookupClientIdSchema.safeParse({ name: 'Comet Electric', environment: 'staging' });
      expect(result.success).toBe(false);
    });
  });
});

describe('consolidated schemas', () => {
  describe('SearchToolSchema', () => {
    it('rejects empty object (no criteria)', () => {
      const result = SearchToolSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one search criterion');
      }
    });

    it('accepts name as sole criterion', () => {
      const result = SearchToolSchema.safeParse({ name: 'Acme' });
      expect(result.success).toBe(true);
    });

    it('accepts address as sole criterion', () => {
      const result = SearchToolSchema.safeParse({ address: { city: 'Springfield' } });
      expect(result.success).toBe(true);
    });

    it('accepts email as sole criterion', () => {
      const result = SearchToolSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = SearchToolSchema.safeParse({ email: 'not-an-email' });
      expect(result.success).toBe(false);
    });

    it('applies default values', () => {
      const result = SearchToolSchema.parse({ name: 'Test' });
      expect(result.minMatchScore).toBe(0.4);
      expect(result.maxResults).toBe(10);
    });

    it('accepts optional asClientId admin override', () => {
      const result = SearchToolSchema.safeParse({ name: 'Test', asClientId: 'client-123' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.asClientId).toBe('client-123');
      }
    });

    it('rejects empty asClientId', () => {
      const result = SearchToolSchema.safeParse({ name: 'Test', asClientId: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('asClientId admin override on consolidated schemas', () => {
    it('all consolidated tool schemas accept asClientId', () => {
      expect(SuppliersToolSchema.safeParse({ action: 'list', asClientId: 'c1' }).success).toBe(true);
      expect(BuyersToolSchema.safeParse({ action: 'list', asClientId: 'c1' }).success).toBe(true);
      expect(RelationshipsToolSchema.safeParse({ action: 'for_buyer', buyerId: 'b1', asClientId: 'c1' }).success).toBe(true);
      expect(ImportsToolSchema.safeParse({ action: 'batches', asClientId: 'c1' }).success).toBe(true);
      expect(MatchingToolSchema.safeParse({ action: 'jobs', asClientId: 'c1' }).success).toBe(true);
      expect(AnalyzeToolSchema.safeParse({ action: 'connections', asClientId: 'c1' }).success).toBe(true);
    });

    it('all consolidated tool schemas reject empty asClientId', () => {
      expect(SuppliersToolSchema.safeParse({ action: 'list', asClientId: '' }).success).toBe(false);
      expect(BuyersToolSchema.safeParse({ action: 'list', asClientId: '' }).success).toBe(false);
      expect(RelationshipsToolSchema.safeParse({ action: 'for_buyer', buyerId: 'b1', asClientId: '' }).success).toBe(false);
      expect(ImportsToolSchema.safeParse({ action: 'batches', asClientId: '' }).success).toBe(false);
      expect(MatchingToolSchema.safeParse({ action: 'jobs', asClientId: '' }).success).toBe(false);
      expect(AnalyzeToolSchema.safeParse({ action: 'connections', asClientId: '' }).success).toBe(false);
    });
  });

  describe('SuppliersToolSchema', () => {
    it('requires action', () => {
      const result = SuppliersToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts list action with no extra params', () => {
      const result = SuppliersToolSchema.safeParse({ action: 'list' });
      expect(result.success).toBe(true);
    });

    it('get action requires id', () => {
      const missing = SuppliersToolSchema.safeParse({ action: 'get' });
      expect(missing.success).toBe(false);
      if (!missing.success) {
        expect(missing.error.issues[0].message).toContain("'get' action requires 'id'");
      }

      const valid = SuppliersToolSchema.safeParse({ action: 'get', id: 'sup-123' });
      expect(valid.success).toBe(true);
    });

    it('history action requires id', () => {
      const missing = SuppliersToolSchema.safeParse({ action: 'history' });
      expect(missing.success).toBe(false);
      if (!missing.success) {
        expect(missing.error.issues[0].message).toContain("'history' action requires 'id'");
      }

      const valid = SuppliersToolSchema.safeParse({ action: 'history', id: 'sup-123' });
      expect(valid.success).toBe(true);
    });

    it('by_date action requires date in yyyyMMdd format', () => {
      const missing = SuppliersToolSchema.safeParse({ action: 'by_date' });
      expect(missing.success).toBe(false);

      const invalidFormat = SuppliersToolSchema.safeParse({ action: 'by_date', date: '2025-01-15' });
      expect(invalidFormat.success).toBe(false);

      const valid = SuppliersToolSchema.safeParse({ action: 'by_date', date: '20250115' });
      expect(valid.success).toBe(true);
    });
  });

  describe('BuyersToolSchema', () => {
    it('requires action', () => {
      const result = BuyersToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('list action needs no extra params', () => {
      const result = BuyersToolSchema.safeParse({ action: 'list' });
      expect(result.success).toBe(true);
    });

    it('get action requires id or clientId', () => {
      const missing = BuyersToolSchema.safeParse({ action: 'get' });
      expect(missing.success).toBe(false);
      if (!missing.success) {
        expect(missing.error.issues[0].message).toContain("'get' action requires either 'id' or 'clientId'");
      }

      const withId = BuyersToolSchema.safeParse({ action: 'get', id: 'buyer-123' });
      expect(withId.success).toBe(true);

      const withClientId = BuyersToolSchema.safeParse({ action: 'get', clientId: 'CLIENT-001' });
      expect(withClientId.success).toBe(true);
    });

    it('create action requires clientId', () => {
      const missing = BuyersToolSchema.safeParse({ action: 'create' });
      expect(missing.success).toBe(false);
      if (!missing.success) {
        expect(missing.error.issues[0].message).toContain("'create' action requires 'clientId'");
      }

      const valid = BuyersToolSchema.safeParse({ action: 'create', clientId: 'CLIENT-001' });
      expect(valid.success).toBe(true);
    });
  });

  describe('RelationshipsToolSchema', () => {
    it('requires action', () => {
      const result = RelationshipsToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('for_buyer requires buyerId', () => {
      const missing = RelationshipsToolSchema.safeParse({ action: 'for_buyer' });
      expect(missing.success).toBe(false);
      if (!missing.success) {
        expect(missing.error.issues[0].message).toContain("'for_buyer' action requires 'buyerId'");
      }

      const valid = RelationshipsToolSchema.safeParse({ action: 'for_buyer', buyerId: 'buyer-123' });
      expect(valid.success).toBe(true);
    });

    it('for_supplier requires supplierId', () => {
      const missing = RelationshipsToolSchema.safeParse({ action: 'for_supplier' });
      expect(missing.success).toBe(false);
      if (!missing.success) {
        expect(missing.error.issues[0].message).toContain("'for_supplier' action requires 'supplierId'");
      }

      const valid = RelationshipsToolSchema.safeParse({ action: 'for_supplier', supplierId: 'sup-123' });
      expect(valid.success).toBe(true);
    });

    it('link requires both buyerId and supplierId', () => {
      const missingBoth = RelationshipsToolSchema.safeParse({ action: 'link' });
      expect(missingBoth.success).toBe(false);

      const missingSupplier = RelationshipsToolSchema.safeParse({ action: 'link', buyerId: 'buyer-123' });
      expect(missingSupplier.success).toBe(false);

      const missingBuyer = RelationshipsToolSchema.safeParse({ action: 'link', supplierId: 'sup-123' });
      expect(missingBuyer.success).toBe(false);

      const valid = RelationshipsToolSchema.safeParse({ action: 'link', buyerId: 'buyer-123', supplierId: 'sup-123' });
      expect(valid.success).toBe(true);
    });
  });

  describe('ImportsToolSchema', () => {
    it('requires action', () => {
      const result = ImportsToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('upload requires filePath', () => {
      const missing = ImportsToolSchema.safeParse({ action: 'upload' });
      expect(missing.success).toBe(false);
      if (!missing.success) {
        expect(missing.error.issues[0].message).toContain("'upload' action requires 'filePath'");
      }

      const valid = ImportsToolSchema.safeParse({ action: 'upload', filePath: '/path/to/file.csv' });
      expect(valid.success).toBe(true);
    });

    it('batches needs no required extra params', () => {
      const result = ImportsToolSchema.safeParse({ action: 'batches' });
      expect(result.success).toBe(true);
    });

    it('validate needs no required extra params', () => {
      const result = ImportsToolSchema.safeParse({ action: 'validate' });
      expect(result.success).toBe(true);
    });
  });

  describe('MatchingToolSchema', () => {
    it('requires action', () => {
      const result = MatchingToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('jobs action needs nothing extra', () => {
      const result = MatchingToolSchema.safeParse({ action: 'jobs' });
      expect(result.success).toBe(true);
    });

    it('job_detail requires jobId', () => {
      const missing = MatchingToolSchema.safeParse({ action: 'job_detail' });
      expect(missing.success).toBe(false);
      if (!missing.success) {
        expect(missing.error.issues[0].message).toContain("'job_detail' action requires 'jobId'");
      }

      const valid = MatchingToolSchema.safeParse({ action: 'job_detail', jobId: 'job-123' });
      expect(valid.success).toBe(true);
    });

    it('candidates requires jobId', () => {
      const missing = MatchingToolSchema.safeParse({ action: 'candidates' });
      expect(missing.success).toBe(false);

      const valid = MatchingToolSchema.safeParse({ action: 'candidates', jobId: 'job-123' });
      expect(valid.success).toBe(true);
    });

    it('staged requires jobId', () => {
      const missing = MatchingToolSchema.safeParse({ action: 'staged' });
      expect(missing.success).toBe(false);

      const valid = MatchingToolSchema.safeParse({ action: 'staged', jobId: 'job-123' });
      expect(valid.success).toBe(true);
    });
  });

  describe('AnalyzeToolSchema', () => {
    it('requires action', () => {
      const result = AnalyzeToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('connections needs nothing extra', () => {
      const result = AnalyzeToolSchema.safeParse({ action: 'connections' });
      expect(result.success).toBe(true);
    });

    it('relationships requires analysisType', () => {
      const missing = AnalyzeToolSchema.safeParse({ action: 'relationships' });
      expect(missing.success).toBe(false);
      if (!missing.success) {
        expect(missing.error.issues[0].message).toContain("'relationships' action requires 'analysisType'");
      }

      const valid = AnalyzeToolSchema.safeParse({ action: 'relationships', analysisType: 'health' });
      expect(valid.success).toBe(true);
    });

    it('import_quality requires mode', () => {
      const missing = AnalyzeToolSchema.safeParse({ action: 'import_quality' });
      expect(missing.success).toBe(false);
      if (!missing.success) {
        expect(missing.error.issues[0].message).toContain("'import_quality' action requires 'mode'");
      }

      const valid = AnalyzeToolSchema.safeParse({ action: 'import_quality', mode: 'quality' });
      expect(valid.success).toBe(true);
    });
  });

  describe('NotifySlackToolSchema', () => {
    it('requires type', () => {
      const result = NotifySlackToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('analysis type requires analysisResult', () => {
      const missing = NotifySlackToolSchema.safeParse({ type: 'analysis' });
      expect(missing.success).toBe(false);
      if (!missing.success) {
        expect(missing.error.issues[0].message).toContain("'analysis' type requires 'analysisResult'");
      }

      const valid = NotifySlackToolSchema.safeParse({ type: 'analysis', analysisResult: { totalBuyers: 10 } });
      expect(valid.success).toBe(true);
    });

    it('custom type requires message with body', () => {
      const missing = NotifySlackToolSchema.safeParse({ type: 'custom' });
      expect(missing.success).toBe(false);
      if (!missing.success) {
        expect(missing.error.issues[0].message).toContain("'custom' type requires a 'message' object");
      }

      const valid = NotifySlackToolSchema.safeParse({ type: 'custom', message: { body: 'Hello world' } });
      expect(valid.success).toBe(true);
    });
  });

  describe('LookupClientToolSchema', () => {
    it('requires name', () => {
      const result = LookupClientToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('requires non-empty name', () => {
      const result = LookupClientToolSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('defaults environment to dev', () => {
      const result = LookupClientToolSchema.parse({ name: 'Comet Electric' });
      expect(result.environment).toBe('dev');
    });

    it('accepts explicit environment', () => {
      const result = LookupClientToolSchema.safeParse({ name: 'Comet Electric', environment: 'prod' });
      expect(result.success).toBe(true);
    });
  });

  describe('RulesToolSchema', () => {
    it('accepts a valid list request', () => {
      const result = RulesToolSchema.safeParse({
        action: 'list',
        scopeType: 'BUYER',
        scopeId: 'BUY-IT-001',
      });
      expect(result.success).toBe(true);
    });

    it('rejects list without scopeType+scopeId', () => {
      const result = RulesToolSchema.safeParse({ action: 'list' });
      expect(result.success).toBe(false);
    });

    it('accepts a valid effective request', () => {
      const result = RulesToolSchema.safeParse({
        action: 'effective',
        entityType: 'BUYER',
        entityId: 'BUY-IT-001',
      });
      expect(result.success).toBe(true);
    });

    it('rejects effective without entityType+entityId', () => {
      const result = RulesToolSchema.safeParse({ action: 'effective' });
      expect(result.success).toBe(false);
    });

    it('accepts a valid trace request', () => {
      const result = RulesToolSchema.safeParse({
        action: 'trace',
        buyerId: 'BUY-IT-001',
        supplierId: 'SUP-IT-001',
      });
      expect(result.success).toBe(true);
    });

    it('rejects trace missing buyerId', () => {
      const result = RulesToolSchema.safeParse({ action: 'trace', supplierId: 'SUP-IT-001' });
      expect(result.success).toBe(false);
    });

    it('defaults format to "compact"', () => {
      const result = RulesToolSchema.safeParse({
        action: 'effective',
        entityType: 'BUYER',
        entityId: 'BUY-IT-001',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.format).toBe('compact');
    });
  });
});
