# Network MCP Server

A powerful MCP (Model Context Protocol) server for the Payvaro Network API. Provides intelligent supplier search with fuzzy matching, supplier/buyer management, and relationship tracking.

## 🌟 Key Features

### Intelligent Supplier Search
- **Fuzzy Matching** - Find suppliers even with typos, abbreviations, or minor variations
- **Multi-field Search** - Match by name, address, email, or combination
- **Confidence Scoring** - Get match confidence levels (exact, high, medium, low)
- **Smart Ranking** - Results sorted by relevance

### Comprehensive Management
- List and search all suppliers and buyers
- Get detailed information with full history
- Track buyer-supplier relationships
- Query by date ranges for audit trails

### Flexible Output
- **Markdown** - Beautiful, human-readable formatting
- **JSON** - Structured data for programmatic use

## 📦 Installation

```bash
npm install
npm run build
```

## 🔑 Configuration

Set these environment variables:

```bash
# Required: Your API key for authentication
export NETWORK_API_KEY="your-api-key-here"

# Optional: API base URL (defaults to http://localhost:8080)
export NETWORK_API_BASE_URL="http://localhost:8080"
```

### LocalStack Testing Keys

For testing with LocalStack:
- **Full access**: `fd9896cd-5bc2-448e-a6e6-59457dc9db79`
- **Read-only**: `0379fdd7-e55d-41c0-b457-22fd3f5043a4`
- **Write-only**: `1fffd2e5-4c6c-4e69-919d-4f00ef2c786b`

## 🚀 Usage

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

## 🛠️ Available Tools

### 1. network_search_suppliers

**The star feature** - Intelligently search for suppliers with fuzzy matching.

**Perfect for:**
- Finding potential duplicate suppliers
- Matching external data to your network
- Dealing with incomplete or imperfect data

**Parameters:**
```json
{
  "name": "Acme",
  "address": {
    "city": "San Francisco",
    "stateProvince": "CA",
    "postalCode": "94105"
  },
  "email": "contact@acme.com",
  "minMatchScore": 0.6,
  "maxResults": 10,
  "response_format": "markdown"
}
```

**Match Score Thresholds:**
- `1.0` - Exact match
- `0.8-0.99` - High confidence (strong match)
- `0.6-0.79` - Medium confidence (likely match)
- `0.4-0.59` - Low confidence (possible match, may include false positives)

**Example Searches:**
```json
// Find by partial name
{
  "name": "Acme",
  "minMatchScore": 0.6
}

// Match by address only
{
  "address": {
    "city": "Beverly Hills",
    "postalCode": "90210"
  },
  "minMatchScore": 0.5
}

// Strict name + location match
{
  "name": "Acme Corporation",
  "address": {
    "stateProvince": "CA"
  },
  "minMatchScore": 0.9
}
```

### 2. network_list_suppliers

List all suppliers in the network.

**Parameters:**
```json
{
  "includeLinks": false,
  "response_format": "markdown"
}
```

### 3. network_get_supplier

Get detailed information about a specific supplier.

**Parameters:**
```json
{
  "id": "123",
  "includeLinks": true,
  "response_format": "json"
}
```

### 4. network_get_suppliers_by_date

Get suppliers updated on a specific date.

**Parameters:**
```json
{
  "date": "20251119",
  "response_format": "markdown"
}
```

### 5. network_get_supplier_history

Get version history showing all changes to a supplier.

**Parameters:**
```json
{
  "id": "123",
  "format": "compact",
  "response_format": "json"
}
```

### 6. network_list_buyers

List all buyers in the network.

**Parameters:**
```json
{
  "response_format": "markdown"
}
```

### 7. network_get_buyer

Get detailed information about a specific buyer.

**Parameters:**
```json
{
  "id": "456",
  "response_format": "json"
}
```

### 8. network_get_buyer_by_client_id

Look up a buyer by external client ID.

**Parameters:**
```json
{
  "clientId": "CLIENT-123",
  "response_format": "markdown"
}
```

### 9. network_get_suppliers_for_buyer

Get all suppliers linked to a buyer.

**Parameters:**
```json
{
  "buyerId": "456",
  "response_format": "markdown"
}
```

### 10. network_get_buyers_for_supplier

Get all buyers linked to a supplier.

**Parameters:**
```json
{
  "supplierId": "123",
  "response_format": "markdown"
}
```

## 🎯 Common Use Cases

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
{
  "date": "20251210"
}
```

Then get detailed history:
```json
{
  "id": "supplier-id-from-above",
  "format": "timeline"
}
```

## 📊 Response Formats

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

## 🔧 Technical Details

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

## 📝 License

Apache 2.0

## 👥 Support

For issues or questions:
- Review the [Payvaro Network API documentation](your-api-docs-url)
- Check the [MCP documentation](https://modelcontextprotocol.io)
- Contact: Payvaro Network Team

## 🎉 What Makes This Special

This isn't just another API wrapper - it's an **intelligent search system** that:

1. **Understands variations** - "Acme Corp", "ACME Corporation", and "A.C.M.E. Co." all match
2. **Handles typos** - "Acme Corpration" still finds "Acme Corporation"
3. **Weighs importance** - Address matching is more important than email
4. **Explains matches** - Shows exactly why each result matched
5. **Ranks by relevance** - Best matches first
6. **Prevents duplicates** - Find existing suppliers before creating new ones

Perfect for data cleaning, deduplication, and matching imperfect external data!
