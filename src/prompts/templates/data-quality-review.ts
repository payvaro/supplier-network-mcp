import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

export interface DataQualityReviewArgs {
  focus?: string; // "suppliers" | "buyers" | "links" | "all"
}

/**
 * Generate data quality review workflow prompt
 */
export function generateDataQualityReviewPrompt(
  args: DataQualityReviewArgs
): GetPromptResult {
  const focus = args.focus || "all";
  const focusLabel = focus === "all" ? "complete data quality" : `${focus} data quality`;

  const instructions = buildDataQualityReviewInstructions(args, focus);

  return {
    description: `Review ${focusLabel} with actionable recommendations`,
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
 * Build the step-by-step instructions for data quality review
 */
function buildDataQualityReviewInstructions(
  _args: DataQualityReviewArgs,
  focus: string
): string {
  const focusDescription = getFocusDescription(focus);

  return `# Data Quality Review Workflow

You are conducting a data quality review of the network database.

## Focus Area
${focusDescription}

---

## Step 1: Baseline Assessment
${getBaselineInstructions(focus)}

## Step 2: Quality Metrics
${getQualityMetricsInstructions(focus)}

## Step 3: Issue Identification
${getIssueIdentificationInstructions(focus)}

## Step 4: Remediation Planning
${getRemediationInstructions()}

---

## Quality Report Template

After completing all steps, produce a quality report:

### Data Quality Scorecard

| Category | Score | Target | Gap |
|----------|-------|--------|-----|
| Completeness | X% | 90% | X% |
| Accuracy | X% | 95% | X% |
| Consistency | X% | 95% | X% |
| Timeliness | X% | 85% | X% |

### Issues by Severity

#### Critical Issues (Must Fix)
- Issue 1: [Description] - [X records affected]
- Issue 2: [Description] - [X records affected]

#### Major Issues (Should Fix)
- Issue 1: [Description] - [X records affected]

#### Minor Issues (Nice to Fix)
- Issue 1: [Description] - [X records affected]

### Remediation Roadmap

| Priority | Issue | Action | Owner | Timeline |
|----------|-------|--------|-------|----------|
| 1 | [Issue] | [Action] | [TBD] | Immediate |
| 2 | [Issue] | [Action] | [TBD] | This week |
| 3 | [Issue] | [Action] | [TBD] | This month |

### Prevention Measures

1. **Process Improvements**
   - [Specific recommendation]

2. **Validation Rules**
   - [Specific recommendation]

3. **Monitoring**
   - [Specific recommendation]

---

Begin the review by running Step 1.`;
}

/**
 * Get focus area description
 */
function getFocusDescription(focus: string): string {
  switch (focus) {
    case "suppliers":
      return "**Focus: Supplier Data Quality**\nReviewing supplier records for completeness, accuracy, and consistency.";
    case "buyers":
      return "**Focus: Buyer Data Quality**\nReviewing buyer records for completeness, accuracy, and consistency.";
    case "links":
      return "**Focus: Relationship Link Quality**\nReviewing buyer-supplier links for validity, status accuracy, and orphaned references.";
    default:
      return "**Focus: Complete Network Data Quality**\nReviewing all data types: suppliers, buyers, and their relationships.";
  }
}

/**
 * Get baseline assessment instructions
 */
function getBaselineInstructions(focus: string): string {
  if (focus === "suppliers" || focus === "all") {
    return `
First, understand the current state of supplier data:

\`\`\`
Call network_analyze_import with:
- mode: "quality"
- response_format: "markdown"
\`\`\`

Note the following baseline metrics:
- Total supplier count
- Completeness score
- Number of issues by severity
- Fields with highest missing rates

${focus === "all" ? `
Then, check relationship health:

\`\`\`
Call network_analyze_relationships with:
- analysisType: "health"
- includeInactive: true
- response_format: "markdown"
\`\`\`

And coverage:

\`\`\`
Call network_analyze_relationships with:
- analysisType: "coverage"
- response_format: "markdown"
\`\`\`
` : ""}`;
  }

  if (focus === "buyers") {
    return `
First, get an overview of buyers:

\`\`\`
Call network_list_buyers with:
- response_format: "json"
\`\`\`

For each buyer, note:
- Required fields present (name, clientId)
- Contact information available
- Address data completeness

Then check their relationships:

\`\`\`
Call network_analyze_relationships with:
- analysisType: "coverage"
- response_format: "markdown"
\`\`\``;
  }

  // focus === "links"
  return `
First, understand the relationship network:

\`\`\`
Call network_analyze_relationships with:
- analysisType: "mapping"
- includeInactive: true
- response_format: "markdown"
\`\`\`

Note:
- Total link count
- Active vs inactive ratio
- Pending links count
- Any isolated nodes`;
}

/**
 * Get quality metrics instructions
 */
function getQualityMetricsInstructions(focus: string): string {
  return `
Calculate quality metrics for ${focus === "all" ? "each data type" : focus}:

### Completeness
Percentage of required fields that are populated:
- Name: Must be present
- Email: Should be present (80% target)
- Address: Should have at least city + state (70% target)
- Contacts: At least one contact preferred (60% target)

### Accuracy
Evaluate data correctness:
- Email format validation
- Address format consistency
- Phone number format
- Date field validity

### Consistency
Check for standardization:
- State abbreviations (CA vs California vs calif)
- Name formatting (Company Inc. vs Company, Inc.)
- Address formatting
- Status values

### Timeliness
Review data freshness:
- Records not updated in 6+ months: Flag for review
- Records not updated in 12+ months: Mark as potentially stale
- New records ratio (last 30 days)`;
}

/**
 * Get issue identification instructions
 */
function getIssueIdentificationInstructions(focus: string): string {
  const commonIssues = `
### Common Issues to Look For

1. **Duplicate Records**
   - Same name with different IDs
   - Similar addresses with different names
   - Matching emails across records

2. **Missing Critical Data**
   - Records without names
   - Records without any contact method
   - Buyers without clientId

3. **Invalid Data**
   - Malformed email addresses
   - Invalid phone numbers
   - Impossible dates

4. **Orphaned References**
   - Links pointing to non-existent records
   - Aggregator links without valid aggregator`;

  const linkSpecific = focus === "links" || focus === "all" ? `

5. **Link Issues**
   - Duplicate links (same buyer-supplier pair)
   - Conflicting statuses
   - Links with empty reference IDs
   - Inactive links that should be active (or vice versa)` : "";

  return commonIssues + linkSpecific + `

### Issue Classification

For each issue found, classify by:
- **Severity**: Critical / Major / Minor
- **Impact**: Number of records affected
- **Effort**: Easy / Medium / Hard to fix
- **Priority**: Calculated from severity × impact ÷ effort`;
}

/**
 * Get remediation instructions
 */
function getRemediationInstructions(): string {
  return `
For each issue category, determine:

### Immediate Fixes (Automated)
- What can be fixed programmatically?
- What validation rules would prevent recurrence?

### Manual Review Required
- Which records need human judgment?
- What criteria should reviewers use?

### Data Enrichment Needed
- What external sources could fill gaps?
- What data providers should be contacted?

### Process Changes
- What import validation is missing?
- What ongoing monitoring is needed?

### Prioritization Matrix

Use this matrix to prioritize remediation:

| | Easy Fix | Hard Fix |
|---|---|---|
| **High Impact** | Do First | Plan Carefully |
| **Low Impact** | Do If Time | Skip or Defer |

Document specific actions for each priority level with:
- Exact steps to fix
- Data/tools needed
- Expected outcome
- Success criteria`;
}
