import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

export interface RelationshipAuditArgs {
  buyerId?: string;
  depth?: string; // "quick" | "standard" | "deep"
}

/**
 * Generate relationship audit workflow prompt
 */
export function generateRelationshipAuditPrompt(
  args: RelationshipAuditArgs
): GetPromptResult {
  const depth = args.depth || "standard";
  const buyerContext = args.buyerId
    ? `buyer ${args.buyerId}`
    : "the entire network";

  const instructions = buildRelationshipAuditInstructions(args, depth);

  return {
    description: `Comprehensive relationship audit for ${buyerContext} (${depth} depth)`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: instructions,
        },
      },
    ],
  };
}

/**
 * Build the step-by-step instructions for relationship audit
 */
function buildRelationshipAuditInstructions(
  args: RelationshipAuditArgs,
  depth: string
): string {
  const buyerParam = args.buyerId
    ? `Scope to buyer ID: ${args.buyerId}.`
    : "Audit the entire network.";

  const depthDescription = depth === "quick"
    ? "Quick audit - focus on critical metrics only"
    : depth === "deep"
      ? "Deep audit - comprehensive analysis of all relationships"
      : "Standard audit - balanced coverage of key areas";

  return `# Relationship Audit Workflow

You are conducting a ${depth} audit of buyer-supplier relationships.

## Context
${buyerParam}
**Audit Depth:** ${depthDescription}

---

## Phase 1: Health Assessment
${getHealthPhaseInstructions(args, depth)}

## Phase 2: Coverage Analysis
${getCoveragePhaseInstructions(args, depth)}

## Phase 3: Network Structure
${getNetworkPhaseInstructions(args, depth)}

---

## Final Report Structure

After completing all phases, compile a comprehensive audit report:

### Executive Summary
- Overall health score and trend
- Key risks identified
- Priority recommendations

### Detailed Findings

1. **Health Status**
   - Active vs inactive links ratio
   - Data quality issues
   - Stale relationship concerns

2. **Coverage Gaps**
   - Unlinked high-priority suppliers
   - Buyers with limited supplier networks
   - Growth opportunities

3. **Network Insights**
   - Hub identification
   - Isolated nodes
   - Connection patterns

### Action Items

Prioritize actions by:
1. **Critical** (immediate action required)
2. **High** (address within 1 week)
3. **Medium** (address within 1 month)
4. **Low** (consider for future improvement)

### Metrics Summary Table

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Health Score | X% | >80% | ✅/⚠️/❌ |
| Coverage | X% | >70% | ✅/⚠️/❌ |
| Active Links | N | - | - |
| Issues Found | N | <5 | ✅/⚠️/❌ |

---

Begin the audit by running Phase 1.`;
}

/**
 * Get health phase instructions based on depth
 */
function getHealthPhaseInstructions(args: RelationshipAuditArgs, depth: string): string {
  const buyerIdParam = args.buyerId ? `- buyerId: "${args.buyerId}"` : "";

  const base = `
Run health analysis:

\`\`\`
Call network_analyze_relationships with:
- analysisType: "health"
${buyerIdParam}
- includeInactive: true
- response_format: "markdown"
\`\`\`

**Quick Check:**
- Health score (target: >80%)
- Number of stale links
- Critical issues count`;

  if (depth === "quick") {
    return base + `

*Quick audit: Note the health score and any critical issues, then proceed to Phase 2.*`;
  }

  const standard = `

**Standard Analysis:**
- Review each issue category
- Identify patterns in stale links
- Check for suppliers missing contacts
- Note any suppliers not updated in 6+ months`;

  if (depth === "standard") {
    return base + standard;
  }

  // Deep audit
  return base + standard + `

**Deep Dive:**
- For each stale link, determine if it should be:
  - Reactivated (relationship still valid)
  - Removed (relationship ended)
  - Investigated (unclear status)
- Cross-reference missing contact issues with business criticality
- Create detailed remediation plan for each issue category
- Identify root causes for health score deductions`;
}

/**
 * Get coverage phase instructions based on depth
 */
function getCoveragePhaseInstructions(args: RelationshipAuditArgs, depth: string): string {
  const buyerIdParam = args.buyerId ? `- buyerId: "${args.buyerId}"` : "";

  const base = `
Run coverage analysis:

\`\`\`
Call network_analyze_relationships with:
- analysisType: "coverage"
${buyerIdParam}
- includeInactive: false
- response_format: "markdown"
\`\`\`

**Quick Check:**
- Coverage percentage (target: >70%)
- Number of unlinked suppliers
- High-priority gaps identified`;

  if (depth === "quick") {
    return base + `

*Quick audit: Note coverage percentage and top unlinked supplier, then proceed to Phase 3.*`;
  }

  const standard = `

**Standard Analysis:**
- Review all high-priority unlinked suppliers
- Determine why they aren't linked (missing data? wrong buyer? new supplier?)
- Prioritize suppliers for linking based on:
  - Recent activity
  - Completeness of data
  - Business importance`;

  if (depth === "standard") {
    return base + standard;
  }

  // Deep audit
  return base + standard + `

**Deep Dive:**
- For each unlinked supplier:
  - Search for potential buyer matches
  - Identify if they should be linked to multiple buyers
  - Document blockers for establishing links
- Analyze coverage trends over time (if historical data available)
- Calculate potential network value of closing coverage gaps
- Create prioritized linking roadmap with estimated effort`;
}

/**
 * Get network phase instructions based on depth
 */
function getNetworkPhaseInstructions(args: RelationshipAuditArgs, depth: string): string {
  const buyerIdParam = args.buyerId ? `- buyerId: "${args.buyerId}"` : "";

  const base = `
Run network mapping:

\`\`\`
Call network_analyze_relationships with:
- analysisType: "mapping"
${buyerIdParam}
- includeInactive: false
- response_format: "markdown"
\`\`\`

**Quick Check:**
- Total nodes and edges
- Any isolated entities
- Top hub identified`;

  if (depth === "quick") {
    return base + `

*Quick audit: Note network size and any isolated nodes, then compile final report.*`;
  }

  const standard = `

**Standard Analysis:**
- Identify network hubs (highly connected nodes)
- List all isolated buyers and suppliers
- Analyze connection status distribution (active/inactive/pending)
- Look for patterns in network structure`;

  if (depth === "standard") {
    return base + standard;
  }

  // Deep audit
  return base + standard + `

**Deep Dive:**
- Calculate network density and connectivity metrics
- Identify potential hub vulnerabilities (over-reliance on single nodes)
- Map supplier sharing between buyers
- Analyze relationship clusters
- Identify opportunities for network optimization
- Create visual network diagram recommendations
- Document network evolution recommendations`;
}
