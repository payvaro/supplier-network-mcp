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

# Optional: Slack webhook URL for notification tools
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

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

All tools follow the naming convention `network_<action>_<subject>`. Every tool accepts an optional `response_format` parameter (`"markdown"` or `"json"`, defaults to `"markdown"`).

---

### Supplier Tools

#### network_search_suppliers

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

#### network_list_suppliers

List all suppliers in the network.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeLinks` | boolean | no | Include buyer link data (default false) |

#### network_get_supplier

Get detailed information about a specific supplier.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | **yes** | Supplier ID |
| `includeLinks` | boolean | no | Include buyer link data |

#### network_get_suppliers_by_date

Get suppliers updated on a specific date.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | **yes** | Date in `yyyyMMdd` format |

#### network_get_supplier_history

Get version history showing all changes to a supplier.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | **yes** | Supplier ID |
| `format` | string | no | `"compact"` or `"timeline"` |

---

### Buyer Tools

#### network_list_buyers

List all buyers in the network.

_(No required parameters.)_

#### network_get_buyer

Get detailed information about a specific buyer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | **yes** | Buyer ID |

#### network_get_buyer_by_client_id

Look up a buyer by external client ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clientId` | string | **yes** | External client reference identifier |

#### network_create_buyer

Create a new buyer in the network.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clientId` | string | **yes** | External client reference identifier |
| `name` | string | no | Buyer name |
| `franchiseName` | string | no | Franchise name |
| `storeIdentifier` | string | no | Store identifier |
| `status` | string | no | Buyer status |
| `addresses` | array | no | Address objects (`streetAddress`, `city`, `stateProvince`, `postalCode`, `suiteUnit`, `addressType`) |
| `contacts` | array | no | Contact objects (`name`, `email`, `phone`, `position`, `title`, `type`: PRIMARY/SECONDARY/OTHER) |

#### network_lookup_client_id

Look up a client ID by human-friendly name. Fuzzy matches against client names from the configuration store and returns the matched name and UUID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | **yes** | Human-friendly client name (e.g. "Comet Electric") |
| `environment` | string | no | `"dev"` or `"prod"` (default: `"dev"`) |

---

### Relationship Tools

#### network_get_suppliers_for_buyer

Get all suppliers linked to a buyer.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `buyerId` | string | **yes** | Buyer ID |

#### network_get_buyers_for_supplier

Get all buyers linked to a supplier.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `supplierId` | string | **yes** | Supplier ID |

#### network_create_buyer_link

Create a link between a buyer and supplier. Returns an error if the link already exists.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `buyerId` | string | **yes** | Buyer ID |
| `supplierId` | string | **yes** | Supplier ID |
| `buyerSupplierRefId` | string | no | External reference ID for the relationship |
| `buyerRefKey` | string | no | Reference key for the relationship |

---

### Analysis Tools

#### network_analyze_connections

Analyze the buyer-supplier network to identify isolated nodes, network hubs, connection patterns, and suggest new links.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `includeSuggestions` | boolean | no | Include connection suggestions (default true) |
| `minConnectionsForHub` | number | no | Minimum connections to be considered a hub (default 5, min 1) |

#### network_analyze_import

Comprehensive import analysis: post-upload validation, pre-import preview, or data quality assessment. Identifies duplicates, calculates quality metrics, and provides recommendations.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mode` | string | **yes** | `"post-upload"`, `"preview"`, or `"quality"` |
| `dateRange` | object | no | `{ "from": "yyyyMMdd", "to": "yyyyMMdd" }` |
| `buyerId` | string | no | Scope analysis to a specific buyer |

#### network_analyze_relationships

Analyze buyer-supplier relationships: health assessment, coverage analysis, or relationship mapping.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `analysisType` | string | **yes** | `"health"` (link status/issues), `"coverage"` (gaps/unlinked suppliers), or `"mapping"` (network structure) |
| `buyerId` | string | no | Buyer ID to analyze (analyzes all if omitted) |
| `includeInactive` | boolean | no | Include inactive links (default false) |

---

### File Tools

#### network_upload_file

Upload a CSV file to the network API for processing.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | string | **yes** | Path to the CSV file |
| `fileName` | string | no | Filename override (defaults to basename of filePath) |

---

### Slack Tools

#### network_notify_slack

Post network analysis results to Slack via webhook. Takes the structured result from `network_analyze_connections` and formats it as a Slack message.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `analysisResult` | object/string | **yes** | Analysis result from `network_analyze_connections` (object or JSON string) |
| `webhookUrl` | string | no | Slack webhook URL (falls back to `SLACK_WEBHOOK_URL` env var) |
| `includeDetails` | boolean | no | Include detailed breakdowns (default false) |

#### network_send_slack_message

Send a custom message to Slack with title, body, key-value fields, action buttons, and color indicator.

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

## Common Use Cases

### Finding Duplicate Suppliers

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

See what changed on a specific date:
```json
{ "date": "20251210" }
```

Then get detailed history:
```json
{ "id": "supplier-id-from-above", "format": "timeline" }
```

### Network Health Check

Run a full connection analysis and post results to Slack:
1. Call `network_analyze_connections` with `{ "includeSuggestions": true }`
2. Pass the result to `network_notify_slack` with `{ "includeDetails": true }`

### Post-Import Validation

After uploading a CSV file, verify what was imported:
```json
{
  "mode": "post-upload",
  "dateRange": { "from": "20260301", "to": "20260301" },
  "buyerId": "buyer-123"
}
```

### Client ID Lookup

When you know a client name but need their UUID:
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

## License

Apache 2.0

## Support

For issues or questions:
- Check the [MCP documentation](https://modelcontextprotocol.io)
- Contact: Payvaro Network Team
