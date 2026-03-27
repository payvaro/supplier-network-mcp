import { vi, type Mock } from 'vitest';
import type { Supplier, Buyer, BuyerLink, AggregatorLink, FileImportJob, MatchingJob, MatchCandidate, StagedMatch, PaginatedResponse } from '../types.js';

export interface MockNetworkAPIClient {
  listSuppliers: Mock<(pageSize?: number, cursor?: string) => Promise<PaginatedResponse<Supplier>>>;
  getAllSuppliers: Mock<() => Promise<Supplier[]>>;
  getSupplier: Mock<(id: string, includeLinks?: boolean) => Promise<Supplier>>;
  createSupplier: Mock<(supplier: Partial<Supplier>) => Promise<Supplier>>;
  updateSupplier: Mock<(id: string, supplier: Partial<Supplier>) => Promise<Supplier>>;
  patchSupplier: Mock<(id: string, supplier: Partial<Supplier>, updateMask?: string) => Promise<Supplier>>;
  deleteSupplier: Mock<(id: string) => Promise<Supplier>>;
  getSuppliersByDate: Mock<(date: string) => Promise<Supplier[]>>;
  getSuppliersByFromDate: Mock<(fromDate: string) => Promise<Supplier[]>>;
  getSupplierHistory: Mock<(id: string, format?: string) => Promise<unknown>>;
  listBuyers: Mock<(includeLinks?: boolean) => Promise<Buyer[]>>;
  getAllBuyers: Mock<(includeLinks?: boolean) => Promise<Buyer[]>>;
  getBuyer: Mock<(id: string) => Promise<Buyer>>;
  getBuyerByClientId: Mock<(clientId: string) => Promise<Buyer>>;
  createBuyer: Mock<(buyer: Partial<Buyer>) => Promise<Buyer>>;
  getSuppliersForBuyer: Mock<(buyerId: string) => Promise<Supplier[]>>;
  getBuyersForSupplier: Mock<(supplierId: string) => Promise<BuyerLink[]>>;
  listBuyerLinks: Mock<() => Promise<BuyerLink[]>>;
  getAllBuyerLinks: Mock<() => Promise<BuyerLink[]>>;
  getBuyerLink: Mock<(buyerId: string, supplierId: string) => Promise<BuyerLink>>;
  createBuyerLink: Mock<(link: Partial<BuyerLink>) => Promise<BuyerLink>>;
  getBuyerLinksByRefKey: Mock<(buyerRefKey: string) => Promise<BuyerLink[]>>;
  uploadFile: Mock<(filePath: string, fileName?: string) => Promise<unknown>>;
  listFileImportJobs: Mock<(limit?: number) => Promise<FileImportJob[]>>;
  getFileImportJob: Mock<(jobId: string) => Promise<FileImportJob>>;
  listMatchingJobs: Mock<(status?: string) => Promise<MatchingJob[]>>;
  getMatchingJob: Mock<(jobId: string) => Promise<MatchingJob>>;
  listMatchCandidates: Mock<(jobId: string, category?: string, pageSize?: number, cursor?: string) => Promise<PaginatedResponse<MatchCandidate> | MatchCandidate[]>>;
  listStagedMatches: Mock<(jobId: string, status?: string, category?: string, pageSize?: number, cursor?: string) => Promise<PaginatedResponse<StagedMatch> | StagedMatch[]>>;
  listAggregatorLinks: Mock<() => Promise<AggregatorLink[]>>;
}

export function createMockNetworkAPIClient(): MockNetworkAPIClient {
  return {
    // Supplier methods
    listSuppliers: vi.fn(),
    getAllSuppliers: vi.fn(),
    getSupplier: vi.fn(),
    createSupplier: vi.fn(),
    updateSupplier: vi.fn(),
    patchSupplier: vi.fn(),
    deleteSupplier: vi.fn(),
    getSuppliersByDate: vi.fn(),
    getSuppliersByFromDate: vi.fn(),
    getSupplierHistory: vi.fn(),

    // Buyer methods
    listBuyers: vi.fn(),
    getAllBuyers: vi.fn(),
    getBuyer: vi.fn(),
    getBuyerByClientId: vi.fn(),
    createBuyer: vi.fn(),
    getSuppliersForBuyer: vi.fn(),
    getBuyersForSupplier: vi.fn(),

    // Link methods
    listBuyerLinks: vi.fn(),
    getAllBuyerLinks: vi.fn(),
    getBuyerLink: vi.fn(),
    createBuyerLink: vi.fn(),
    getBuyerLinksByRefKey: vi.fn(),

    // File operations
    uploadFile: vi.fn(),
    listFileImportJobs: vi.fn(),
    getFileImportJob: vi.fn(),

    // Matching jobs
    listMatchingJobs: vi.fn(),
    getMatchingJob: vi.fn(),
    listMatchCandidates: vi.fn(),
    listStagedMatches: vi.fn(),

    // Aggregator links
    listAggregatorLinks: vi.fn(),
  };
}

export function resetMockClient(mock: MockNetworkAPIClient): void {
  Object.values(mock).forEach((fn) => {
    if (typeof fn.mockReset === 'function') {
      fn.mockReset();
    }
  });
}
