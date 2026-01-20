import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

export interface ImportInvestigationArgs {
  date?: string;
  buyerId?: string;
}

/**
 * Generate import investigation workflow prompt
 */
export function generateImportInvestigationPrompt(
  args: ImportInvestigationArgs
): GetPromptResult {
  const dateContext = args.date
    ? `the import that occurred on ${formatDisplayDate(args.date)}`
    : "recent imports";

  const buyerContext = args.buyerId
    ? ` for buyer ${args.buyerId}`
    : "";

  const instructions = buildImportInvestigationInstructions(args);

  return {
    description: `Guided workflow to investigate ${dateContext}${buyerContext}`,
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
 * Build the step-by-step instructions for import investigation
 */
function buildImportInvestigationInstructions(args: ImportInvestigationArgs): string {
  const dateParam = args.date
    ? `Use date: ${args.date} (yyyyMMdd format).`
    : "Use today's date or let me know which date to investigate.";

  const buyerParam = args.buyerId
    ? `Scope to buyer ID: ${args.buyerId}.`
    : "";

  return `# Import Investigation Workflow

You are investigating supplier import issues. Follow these steps systematically to identify and resolve problems.

## Context
${dateParam}
${buyerParam}

## Step 1: Initial Assessment

First, run a post-upload analysis to understand what was imported:

\`\`\`
Call network_analyze_import with:
- mode: "post-upload"
${args.date ? `- dateRange: { from: "${args.date}", to: "${args.date}" }` : "- dateRange: { from: <today>, to: <today> }"}
${args.buyerId ? `- buyerId: "${args.buyerId}"` : ""}
- response_format: "markdown"
\`\`\`

Review the summary and note:
- Total records imported
- Number of potential duplicates
- Any exact matches (likely errors)

## Step 2: Duplicate Investigation

If duplicates were found, investigate each one:

1. For exact matches (100% confidence):
   - These are likely duplicate imports or re-imports
   - Check if the data is identical or if there are meaningful differences
   - Recommend whether to merge, keep both, or remove the duplicate

2. For high-confidence matches (80%+):
   - These may be the same entity with slightly different data
   - Compare fields side-by-side
   - Identify which record has more complete data

3. For medium-confidence matches (60-79%):
   - These need manual verification
   - Look for business signals (same address, similar name variations)
   - Check if they might be different locations of the same company

## Step 3: Data Quality Review

Run a quality analysis if the initial assessment shows issues:

\`\`\`
Call network_analyze_import with:
- mode: "quality"
${args.date ? `- dateRange: { from: "${args.date}", to: "${args.date}" }` : ""}
${args.buyerId ? `- buyerId: "${args.buyerId}"` : ""}
- response_format: "markdown"
\`\`\`

Focus on:
- Completeness score (should be >80% for good imports)
- Missing critical fields (name, email, address)
- High-severity issues that need immediate attention

## Step 4: Root Cause Analysis

Based on your findings, identify the likely cause:

1. **Source Data Issues**
   - Incomplete records from source system
   - Encoding or formatting problems
   - Missing required fields

2. **Import Process Issues**
   - Duplicate file processing
   - Partial imports due to errors
   - Timing issues with concurrent imports

3. **Configuration Issues**
   - Wrong buyer mapping
   - Incorrect field mapping
   - Missing deduplication rules

## Step 5: Remediation Recommendations

Provide actionable recommendations:

1. **Immediate Actions**
   - Which records need to be corrected or removed
   - Critical data that needs to be filled in

2. **Process Improvements**
   - Changes to prevent similar issues
   - Additional validation rules needed

3. **Follow-up Tasks**
   - Records that need manual review
   - Communication needed with data providers

## Output Format

After completing the investigation, provide:

1. **Executive Summary**: 2-3 sentence overview of findings
2. **Key Issues Found**: Bulleted list of problems
3. **Impact Assessment**: How this affects the network data quality
4. **Recommended Actions**: Prioritized list of next steps
5. **Prevention Measures**: How to avoid this in the future

---

Begin the investigation by running Step 1.`;
}

/**
 * Format a date string for display
 */
function formatDisplayDate(dateStr: string): string {
  if (dateStr.length === 8) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}
