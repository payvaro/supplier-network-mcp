import Fuzzysort from "fuzzysort";
import { MATCH_THRESHOLDS } from "../constants.js";
import type { Supplier, Address, MatchScore, SupplierMatch } from "../types.js";

/**
 * Calculate similarity between two addresses
 */
function calculateAddressSimilarity(addr1: Address | undefined, addr2: Address | undefined): {
  score: number;
  matches: string[];
} {
  if (!addr1 || !addr2) {
    return { score: 0, matches: [] };
  }

  const matches: string[] = [];
  let totalScore = 0;
  let maxScore = 0;

  // Street address match (weight: 3)
  maxScore += 3;
  if (addr1.streetAddress && addr2.streetAddress) {
    const streetMatch = Fuzzysort.single(
      addr1.streetAddress.toLowerCase(),
      addr2.streetAddress.toLowerCase()
    );
    if (streetMatch) {
      const streetScore = (streetMatch.score + 1000) / 1000; // Normalize to 0-1
      totalScore += streetScore * 3;
      if (streetScore > 0.6) {
        matches.push(`Street: ${addr2.streetAddress}`);
      }
    }
  }

  // City match (weight: 2)
  maxScore += 2;
  if (addr1.city && addr2.city) {
    const cityMatch = Fuzzysort.single(
      addr1.city.toLowerCase(),
      addr2.city.toLowerCase()
    );
    if (cityMatch) {
      const cityScore = (cityMatch.score + 1000) / 1000;
      totalScore += cityScore * 2;
      if (cityScore > 0.7) {
        matches.push(`City: ${addr2.city}`);
      }
    }
  }

  // State match (weight: 1)
  maxScore += 1;
  if (addr1.stateProvince && addr2.stateProvince) {
    if (addr1.stateProvince.toLowerCase() === addr2.stateProvince.toLowerCase()) {
      totalScore += 1;
      matches.push(`State: ${addr2.stateProvince}`);
    }
  }

  // Postal code match (weight: 2)
  maxScore += 2;
  if (addr1.postalCode && addr2.postalCode) {
    const postal1 = addr1.postalCode.replace(/[^0-9]/g, "");
    const postal2 = addr2.postalCode.replace(/[^0-9]/g, "");

    if (postal1 === postal2) {
      totalScore += 2;
      matches.push(`Postal Code: ${addr2.postalCode}`);
    } else if (postal1.substring(0, 5) === postal2.substring(0, 5)) {
      totalScore += 1.5; // Partial ZIP match
      matches.push(`Postal Code (partial): ${addr2.postalCode}`);
    }
  }

  const normalizedScore = maxScore > 0 ? totalScore / maxScore : 0;
  return { score: normalizedScore, matches };
}

/**
 * Calculate similarity between two names
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const match = Fuzzysort.single(name1.toLowerCase(), name2.toLowerCase());
  if (!match) return 0;

  // Normalize Fuzzysort score (ranges from -1000 to 0, with 0 being perfect)
  // Convert to 0-1 range where 1 is perfect
  return (match.score + 1000) / 1000;
}

/**
 * Calculate similarity between email addresses
 */
function calculateEmailSimilarity(email1: string, email2: string): number {
  if (email1.toLowerCase() === email2.toLowerCase()) {
    return 1.0;
  }

  // Check if domains match
  const domain1 = email1.split("@")[1]?.toLowerCase();
  const domain2 = email2.split("@")[1]?.toLowerCase();

  if (domain1 && domain2 && domain1 === domain2) {
    return 0.6; // Same domain is a moderate match
  }

  return 0;
}

/**
 * Check if supplier matches search criteria and calculate match score
 */
export function matchSupplier(
  supplier: Supplier,
  searchCriteria: {
    name?: string;
    address?: Address;
    email?: string;
  }
): SupplierMatch | null {
  const matchedFields: { name?: number; address?: number; email?: number; aliases?: number } = {};
  const reasons: string[] = [];
  let totalWeight = 0;
  let totalScore = 0;

  // Name matching (weight: 3)
  if (searchCriteria.name && supplier.name) {
    const nameWeight = 3;
    totalWeight += nameWeight;

    const nameScore = calculateNameSimilarity(searchCriteria.name, supplier.name);
    matchedFields.name = nameScore;
    totalScore += nameScore * nameWeight;

    if (nameScore >= MATCH_THRESHOLDS.HIGH) {
      reasons.push(`Name matches "${supplier.name}" (${(nameScore * 100).toFixed(0)}%)`);
    }

    // Also check aliases
    if (supplier.aliases && supplier.aliases.length > 0) {
      let bestAliasScore = 0;
      let bestAlias = "";

      for (const alias of supplier.aliases) {
        if (alias.name) {
          const aliasScore = calculateNameSimilarity(searchCriteria.name, alias.name);
          if (aliasScore > bestAliasScore) {
            bestAliasScore = aliasScore;
            bestAlias = alias.name;
          }
        }
      }

      if (bestAliasScore > nameScore) {
        matchedFields.aliases = bestAliasScore;
        totalScore += (bestAliasScore - nameScore) * nameWeight; // Add differential
        if (bestAliasScore >= MATCH_THRESHOLDS.HIGH) {
          reasons.push(`Alias "${bestAlias}" matches (${(bestAliasScore * 100).toFixed(0)}%)`);
        }
      }
    }
  }

  // Address matching (weight: 4)
  if (searchCriteria.address && supplier.address) {
    const addressWeight = 4;
    totalWeight += addressWeight;

    const addressResult = calculateAddressSimilarity(searchCriteria.address, supplier.address);
    matchedFields.address = addressResult.score;
    totalScore += addressResult.score * addressWeight;

    if (addressResult.matches.length > 0) {
      reasons.push(...addressResult.matches.map(m => `Address: ${m}`));
    }
  }

  // Email matching (weight: 2)
  if (searchCriteria.email && supplier.email) {
    const emailWeight = 2;
    totalWeight += emailWeight;

    const emailScore = calculateEmailSimilarity(searchCriteria.email, supplier.email);
    matchedFields.email = emailScore;
    totalScore += emailScore * emailWeight;

    if (emailScore >= MATCH_THRESHOLDS.HIGH) {
      reasons.push(`Email matches: ${supplier.email}`);
    }
  }

  // Calculate final weighted score
  const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;

  // Determine match level
  let level: "exact" | "high" | "medium" | "low" | "none" = "none";
  if (finalScore >= MATCH_THRESHOLDS.EXACT) {
    level = "exact";
  } else if (finalScore >= MATCH_THRESHOLDS.HIGH) {
    level = "high";
  } else if (finalScore >= MATCH_THRESHOLDS.MEDIUM) {
    level = "medium";
  } else if (finalScore >= MATCH_THRESHOLDS.LOW) {
    level = "low";
  }

  // Only return matches above the LOW threshold
  if (level === "none") {
    return null;
  }

  const matchScore: MatchScore = {
    score: finalScore,
    level,
    reasons
  };

  return {
    supplier,
    matchScore,
    matchedFields
  };
}

/**
 * Search and rank suppliers by similarity
 */
export function searchAndRankSuppliers(
  suppliers: Supplier[],
  searchCriteria: {
    name?: string;
    address?: Address;
    email?: string;
  },
  minThreshold: number = MATCH_THRESHOLDS.LOW
): SupplierMatch[] {
  const matches: SupplierMatch[] = [];

  for (const supplier of suppliers) {
    const match = matchSupplier(supplier, searchCriteria);
    if (match && match.matchScore.score >= minThreshold) {
      matches.push(match);
    }
  }

  // Sort by score (descending)
  return matches.sort((a, b) => b.matchScore.score - a.matchScore.score);
}

/**
 * Normalize address input for better matching
 */
export function normalizeAddress(address: Partial<Address>): Address {
  return {
    streetAddress: address.streetAddress?.trim(),
    city: address.city?.trim(),
    stateProvince: address.stateProvince?.trim().toUpperCase(),
    postalCode: address.postalCode?.trim(),
    suiteUnit: address.suiteUnit?.trim(),
    addressType: address.addressType?.trim()
  };
}
