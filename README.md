# Network MCP Server

A powerful MCP (Model Context Protocol) server for the Payvaro Network API. Provides intelligent supplier search with fuzzy matching, supplier/buyer management, relationship tracking, network analysis, and Slack notifications.

## Key Features

### Intelligent Supplier Search
- **Fuzzy Matching** - Find suppliers even with typos, abbreviations, or minor variations
- **Multi-field Search** - Match by name, address, email, or combination
- **Confidence Scoring** - Get match confidence levels (exact, high, medium, low)
- **Smart Ranking** - Results sorted by relevance

### Comprehensive Management
- List and search all suppliers and buyers
- Get detailed information with full history
- Create buyers and buyer-supplier links
- Track buyer-supplier relationships
- Query by date ranges for audit trails

### Network Analysis
- **Connection Analysis** - Identify isolated nodes, network hubs, and connection patterns
- **Import Analysis** - Post-upload validation, pre-import preview, data quality scoring
- **Relationship Analysis** - Health assessment, coverage gaps, network structure mapping

### Integrations
- **Slack** - Post analysis results or custom messages via webhook
- **File Upload** - Upload CSV files for bulk processing

### Flexible Output
- **Markdown** - Beautiful, human-readable formatting
- **JSON** - Structured data for programmatic use

## Installation

```bash
npm install
npm run build
```

## Configuration

Set these environment variables:

```bash
# Required: Your API key for authentication
export NETWORK_API_KEY="your-api-key-here"

# Optional: API base URL (defaults to http://localhost:8080)
export NETWORK_API_BASE_URL="http://localhost:8080"

# Optional: Default client ID — sent as x-client-id on every request when no per-request override is supplied
export NETWORK_CLIENT_ID="client-uuid"

# Optional: Enable admin mode — allows tools to accept a per-request `asClientId` field.
# Only enable this when the configured NETWORK_API_KEY is an admin token; the backend
# must accept header overrides from that token for this to take effect.
export NETWORK_ADMIN_MODE="true"

# Optional: Slack webhook URL for notification tools
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

### Admin-mode per-request client override

When the server starts with `NETWORK_ADMIN_MODE=true`, every consolidated tool (`search`,
`suppliers`, `buyers`, `relationships`, `imports`, `matching`, `analyze`) accepts an optional
`asClientId` field. If supplied, the MCP server replaces the default `x-client-id` header
for that single request, letting an admin caller act on any client's data without reconfiguring
the server.

- Without `NETWORK_ADMIN_MODE=true`, passing `asClientId` is rejected with an actionable error
  before any request is sent upstream.
- Pair with the `lookup_client` tool to resolve a human-readable client name to its UUID, then
  pass that UUID as `asClientId` on subsequent tool calls.
- The `lookup_client` tool itself is unaffected (it reads S3, not the Network API).

### LocalStack Testing Keys

For testing with LocalStack:
- **Full access**: `fd9896cd-5bc2-448e-a6e6-59457dc9db79`
- **Read-only**: `0379fdd7-e55d-41c0-b457-22fd3f5043a4`
- **Write-only**: `1fffd2e5-4c6c-4e69-919d-4f00ef2c786b`

## Usage

### Running the Server

**stdio mode (default)**:
```bash
npm start
```

**HTTP mode**:
```bash
npm run start:http
# Server runs on http://localhost:3000/mcp
```

## Available Tools

9 consolidated tools provide all supplier, buyer, relationship, analysis, import, and notification capabilities. Every tool accepts an optional `response_format` parameter (`"markdown"` or `"json"`, defaults to `"markdown"`).

---

### `search` — Supplier Search with Fuzzy Matching

Intelligently search for suppliers with fuzzy matching. The primary tool for finding duplicates, matching external data, and dealing with imperfect data.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | no | Supplier name to search for |
| `address` | object | no | Address fields: `streetAddress`, `city`, `stateProvince`, `postalCode` |
| `email` | string | no | Email address to match |
| `minMatchScore` | number | no | Minimum confidence threshold (0.0-1.0, default 0.6) |
| `maxResults` | number | no | Maximum results to return (default 10) |

**Match Score Thresholds:**
- `1.0` - Exact match
- `0.8-0.99` - High confidence
- `0.6-0.79` - Medium confidence
- `0.4-0.59` - Low confidence (may include false positives)

```json
{
  "name": "Acme",
  "address": { "city": "San Francisco", "stateProvince": "CA" },
  "minMatchScore": 0.7,
  "maxResults": 5
}
```

---

### `suppliers` — Supplier Management

View supplier information with multiple actions.

**Actions:**
- `list` - List all suppliers
- `get` - Get detailed supplier info
- `history` - Get version history with changes
- `by_date` - Get suppliers updated on a specific date

**Parameters by action:**

**list** (no required parameters):
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeLinks` | boolean | no | Include buyer link data (default false) |

**get**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | **yes** | Supplier ID |
| `includeLinks` | boolean | no | Include buyer link data |

**history**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | **yes** | Supplier ID |
| `format` | string | no | `"compact"` or `"timeline"` |

**by_date**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | **yes** | Date in `yyyyMMdd` format |

---

### `buyers` — Buyer Management

View and create buyers.

**Actions:**
- `list` - List all buyers
- `get` - Get detailed buyer info
- `create` - Create a new buyer

**Parameters by action:**

**list** (no required parameters):
_(No parameters.)_

**get**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | **yes** | Buyer ID |

**create**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clientId` | string | **yes** | External client reference identifier |
| `name` | string | no | Buyer name |
| `franchiseName` | string | no | Franchise name |
| `storeIdentifier` | string | no | Store identifier |
| `status` | string | no | Buyer status |
| `addresses` | array | no | Address objects (`streetAddress`, `city`, `stateProvince`, `postalCode`, `suiteUnit`, `addressType`) |
| `contacts` | array | no | Contact objects (`name`, `email`, `phone`, `position`, `title`, `type`: PRIMARY/SECONDARY/OTHER) |

---

### `relationships` — Buyer-Supplier Links

Manage and query buyer-supplier relationships.

**Actions:**
- `for_buyer` - Get suppliers linked to a buyer
- `for_supplier` - Get buyers linked to a supplier
- `link` - Create a link between buyer and supplier

**Parameters by action:**

**for_buyer**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `buyerId` | string | **yes** | Buyer ID |

**for_supplier**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `supplierId` | string | **yes** | Supplier ID |

**link**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `buyerId` | string | **yes** | Buyer ID |
| `supplierId` | string | **yes** | Supplier ID |
| `buyerSupplierRefId` | string | no | External reference ID for the relationship |
| `buyerRefKey` | string | no | Reference key for the relationship |

---

### `imports` — File Upload and Import Management

Upload and manage CSV imports.

**Actions:**
- `upload` - Upload a CSV file for processing
- `batches` - List import batches
- `validate` - Validate import data

**Parameters by action:**

**upload**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | **yes** | Path to the CSV file |
| `fileName` | string | no | Filename override (defaults to basename of filePath) |

**batches**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | no | Maximum batches to return (default 10) |

**validate**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mode` | string | **yes** | `"post-upload"`, `"preview"`, or `"quality"` |
| `dateRange` | object | no | `{ "from": "yyyyMMdd", "to": "yyyyMMdd" }` |
| `buyerId` | string | no | Scope analysis to a specific buyer |

---

### `matching` — Matching Job Management

Track and manage data matching jobs.

**Actions:**
- `jobs` - List all matching jobs
- `job_detail` - Get details of a specific job
- `candidates` - Get candidates from a matching job
- `staged` - View staged matches ready for import

**Parameters by action:**

**jobs**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | no | Filter by status (e.g., "completed", "pending") |
| `limit` | number | no | Maximum results (default 10) |

**job_detail**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `jobId` | string | **yes** | Matching job ID |

**candidates**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `jobId` | string | **yes** | Matching job ID |
| `limit` | number | no | Maximum candidates (default 20) |

**staged**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `buyerId` | string | no | Filter by buyer (optional) |

---

### `analyze` — Network Analysis

Comprehensive network and relationship analysis.

**Actions:**
- `connections` - Analyze buyer-supplier network topology
- `relationships` - Analyze relationship health, coverage, or structure
- `import_quality` - Post-upload validation and data quality assessment

**Parameters by action:**

**connections**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeSuggestions` | boolean | no | Include connection suggestions (default true) |
| `minConnectionsForHub` | number | no | Minimum connections to be considered a hub (default 5, min 1) |

**relationships**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `analysisType` | string | **yes** | `"health"` (link status/issues), `"coverage"` (gaps/unlinked suppliers), or `"mapping"` (network structure) |
| `buyerId` | string | no | Buyer ID to analyze (analyzes all if omitted) |
| `includeInactive` | boolean | no | Include inactive links (default false) |

**import_quality**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dateRange` | object | no | `{ "from": "yyyyMMdd", "to": "yyyyMMdd" }` |
| `buyerId` | string | no | Scope analysis to a specific buyer |

---

### `notify_slack` — Slack Notifications

Post messages to Slack via webhook.

**Types:**
- `analysis` - Post network analysis results
- `custom` - Send custom formatted message

**Parameters by type:**

**analysis**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `analysisResult` | object/string | **yes** | Analysis result from `analyze` tool (object or JSON string) |
| `webhookUrl` | string | no | Slack webhook URL (falls back to `SLACK_WEBHOOK_URL` env var) |
| `includeDetails` | boolean | no | Include detailed breakdowns (default false) |

**custom**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | object | **yes** | Message content (see below) |
| `webhookUrl` | string | no | Slack webhook URL (falls back to `SLACK_WEBHOOK_URL` env var) |

**Message object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `body` | string | **yes** | Main content with Slack markdown (max 3000 chars) |
| `title` | string | no | Header text (max 150 chars) |
| `fields` | array | no | Key-value pairs as `{ label, value }` (max 10) |
| `actions` | array | no | Buttons as `{ text, url, style? }` where style is `"primary"` or `"danger"` (max 5) |
| `footer` | string | no | Footer text (max 200 chars) |
| `color` | string | no | Sidebar color: `"good"`, `"warning"`, or `"danger"` |

---

### `lookup_client` — Client ID Resolution

Resolve client name to UUID for buyer identification.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | **yes** | Human-friendly client name (e.g. "Comet Electric") |
| `environment` | string | no | `"dev"` or `"prod"` (default: `"dev"`) |

Returns the matched client name and UUID from the configuration store.

---

## Common Use Cases

### Finding Duplicate Suppliers

Use the `search` tool:
```json
{
  "name": "Acme Corp",
  "minMatchScore": 0.7,
  "maxResults": 5
}
```

This will find "Acme Corporation", "ACME Corp", "Acme Co.", etc.

### Matching External Data

When importing data from another system:
```json
{
  "name": "XYZ Company",
  "address": {
    "streetAddress": "123 Main St",
    "city": "Los Angeles",
    "postalCode": "90001"
  },
  "minMatchScore": 0.6
}
```

### Audit Trail

See what changed on a specific date using the `suppliers` tool with `by_date` action:
```json
{ "date": "20251210" }
```

Then get detailed history using `suppliers` tool with `history` action:
```json
{ "id": "supplier-id-from-above", "format": "timeline" }
```

### Network Health Check

Run a full connection analysis and post results to Slack:
1. Call `analyze` tool with `connections` action: `{ "includeSuggestions": true }`
2. Pass the result to `notify_slack` tool with `analysis` type and `{ "includeDetails": true }`

### Post-Import Validation

After uploading a CSV file, verify what was imported using `imports` tool with `validate` action:
```json
{
  "mode": "post-upload",
  "dateRange": { "from": "20260301", "to": "20260301" },
  "buyerId": "buyer-123"
}
```

### Client ID Lookup

When you know a client name but need their UUID, use the `lookup_client` tool:
```json
{ "name": "Comet Electric", "environment": "dev" }
```

## Response Formats

### Markdown (Human-Readable)

```markdown
# 🔍 Supplier Search Results

## Search Query
**Name:** Acme
**Address:** San Francisco, CA

**Total Matches Found:** 3

---

## 1. Acme Corporation ✅

**Match Score:** 87.3% (HIGH)

**Why this matches:**
- Name matches "Acme Corporation" (92%)
- Address: City: San Francisco
- Address: State: CA

**Field Matches:** Name: 92% | Address: 85%

---

**ID:** SUP#123
**Email:** contact@acme.com
**Address:** 123 Main St, San Francisco, CA 94105
```

### JSON (Structured Data)

```json
{
  "query": {
    "name": "Acme",
    "address": {
      "city": "San Francisco",
      "stateProvince": "CA"
    }
  },
  "totalMatches": 3,
  "matches": [
    {
      "supplier": {
        "id": "SUP#123",
        "name": "Acme Corporation",
        "email": "contact@acme.com",
        "address": { ... }
      },
      "matchScore": {
        "score": 0.873,
        "level": "high",
        "reasons": [
          "Name matches \"Acme Corporation\" (92%)",
          "Address: City: San Francisco"
        ]
      },
      "matchedFields": {
        "name": 0.92,
        "address": 0.85
      }
    }
  ]
}
```

## Technical Details

### Fuzzy Matching Algorithm

The search uses the **Fuzzysort** library with weighted field matching:

- **Name**: Weight 3 (most important)
  - Also checks aliases
  - Handles abbreviations and typos
- **Address**: Weight 4 (critical for deduplication)
  - Street address: Weight 3
  - City: Weight 2
  - State: Weight 1 (exact match required)
  - Postal code: Weight 2 (supports partial ZIP match)
- **Email**: Weight 2
  - Exact match preferred
  - Domain matching as fallback

### Dependencies

- `@modelcontextprotocol/sdk` - MCP server framework
- `axios` - HTTP client for API calls
- `express` - HTTP server (for HTTP mode)
- `zod` - Input validation
- `fuzzysort` - Fast fuzzy string matching
- `typescript` - Type safety

## Packaged Skills

This repo ships reference skills under `skills/` that encode common network-mcp workflows. They live here (not in a shared skills directory) so they version alongside the tool surface.

| Skill | Purpose |
|-------|---------|
| `network-payability-triage` | Diagnose a single buyer-supplier pair: is it payable, and if not, why? |
| `network-payability-coverage` | Report coverage across a client's network with bucketed blockers. |

### Install

Claude Code and Codex auto-discover skills from their respective skills directories. To make these skills available, symlink (or copy) each skill directory into your local skills store:

```bash
# macOS / Linux — Claude Code
ln -s "$(pwd)/skills/network-payability-triage" ~/.claude/skills/network-payability-triage
ln -s "$(pwd)/skills/network-payability-coverage" ~/.claude/skills/network-payability-coverage

# Codex
ln -s "$(pwd)/skills/network-payability-triage" ~/.codex/skills/network-payability-triage
ln -s "$(pwd)/skills/network-payability-coverage" ~/.codex/skills/network-payability-coverage
```

If your editor uses a different skills layout, copy the `skills/<skill-name>/SKILL.md` file into the location that tool expects.

### Verifying packaged skills

Skills are instruction text, not code, so there are no automated tests. To validate a change:

1. Start the MCP locally against a seeded tenant: `npm start` (see the [Usage](#usage) section).
2. Open an MCP-aware client (Claude Desktop, etc.) with the skill installed.
3. Invoke each skill's trigger phrases against a known-good pair and a known-broken pair.
4. Confirm the output matches the template in the skill's `SKILL.md`.
5. Check `~/Library/Logs/Claude/mcp*.log` to verify the skill called the documented tool sequence.

## License

Apache 2.0

## Support

For issues or questions:
- Check the [MCP documentation](https://modelcontextprotocol.io)
- Contact: Payvaro Network Team
