# Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- Your Network API server running
- Claude Desktop app installed

## Step 1: Start Your API Server

First, start your Network API server on localhost:8080:

```bash
# Start your API server (adjust command as needed for your setup)
# It should be accessible at http://localhost:8080
```

Verify it's running by checking the health endpoint or making a test request.

## Step 2: Configure the MCP Server

Set your API credentials and endpoint as environment variables:

```bash
# Set your API key
export NETWORK_API_KEY="fd9896cd-5bc2-448e-a6e6-59457dc9db79"  # Use your actual key

# Set the API base URL (your localhost server)
export NETWORK_API_BASE_URL="http://localhost:8080"
```

### Available API Keys (LocalStack Testing)

- **Full access**: `fd9896cd-5bc2-448e-a6e6-59457dc9db79`
- **Read-only**: `0379fdd7-e55d-41c0-b457-22fd3f5043a4`
- **Write-only**: `1fffd2e5-4c6c-4e69-919d-4f00ef2c786b`

## Step 3: Test the MCP Server Locally

You can test the server works before connecting it to Claude:

```bash
# Install dependencies (if not already done)
npm install

# Build the project
npm run build

# Start the server (stdio mode)
npm start
```

The server will start and wait for input. Press `Ctrl+C` to stop it.

## Step 4: Configure Claude Desktop

### Option A: Using Claude Desktop's Settings UI (Recommended)

1. Open **Claude Desktop**
2. Click **Claude** → **Settings** (or press `Cmd+,` on Mac)
3. Go to the **Developer** tab
4. Click **Edit Config** to open your `claude_desktop_config.json`

### Option B: Manual Configuration

Edit your Claude Desktop configuration file directly:

**Mac:**
```bash
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
notepad %APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
code ~/.config/Claude/claude_desktop_config.json
```

### Add Your MCP Server Configuration

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "network": {
      "command": "node",
      "args": ["/Users/ryan/codebase/network-mcp-test/dist/index.js"],
      "env": {
        "NETWORK_API_KEY": "fd9896cd-5bc2-448e-a6e6-59457dc9db79",
        "NETWORK_API_BASE_URL": "http://localhost:8080"
      }
    }
  }
}
```

**Important:** Replace `/Users/ryan/codebase/network-mcp-test` with your actual absolute path to the project directory.

To get the absolute path:
```bash
cd /Users/ryan/codebase/network-mcp-test
pwd
```

### Multiple Servers Example

If you already have other MCP servers configured:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/ryan/Documents"]
    },
    "network": {
      "command": "node",
      "args": ["/Users/ryan/codebase/network-mcp-test/dist/index.js"],
      "env": {
        "NETWORK_API_KEY": "fd9896cd-5bc2-448e-a6e6-59457dc9db79",
        "NETWORK_API_BASE_URL": "http://localhost:8080"
      }
    }
  }
}
```

## Step 5: Restart Claude Desktop

**Completely quit and restart Claude Desktop** for the changes to take effect:

**Mac:**
```bash
# Quit Claude Desktop completely (Cmd+Q)
# Or use:
killall Claude

# Then reopen Claude Desktop from Applications
```

**Windows/Linux:**
- Close Claude Desktop completely
- Restart it from your applications menu

## Step 6: Verify Connection

1. Open a new conversation in Claude Desktop
2. Look for the 🔌 tool icon in the input area (indicates MCP tools are available)
3. Type a message like:

```
Can you list all the suppliers in the network?
```

Claude should automatically use the `network_list_suppliers` tool to fetch data from your API!

## Troubleshooting

### MCP Server Not Appearing

1. **Check the config file syntax** - Must be valid JSON (no trailing commas!)
2. **Verify the path** is absolute (not relative)
3. **Check permissions** - Make sure the `dist/index.js` file is readable
4. **View logs** in Claude Desktop:
   - Mac: `~/Library/Logs/Claude/mcp*.log`
   - Windows: `%APPDATA%\Claude\logs\mcp*.log`

### API Connection Issues

1. **Verify your API server is running**:
   ```bash
   curl http://localhost:8080/api/suppliers
   ```

2. **Check the API key** is correct in the config

3. **Test the MCP server manually**:
   ```bash
   NETWORK_API_KEY="your-key" NETWORK_API_BASE_URL="http://localhost:8080" npm start
   ```

### View MCP Server Logs

Check Claude Desktop's developer logs:

**Mac:**
```bash
tail -f ~/Library/Logs/Claude/mcp-server-network.log
```

**Windows:**
```powershell
Get-Content $env:APPDATA\Claude\logs\mcp-server-network.log -Wait -Tail 50
```

## Step 7: Try It Out!

Here are some example prompts to try with Claude:

### Search for Suppliers (Fuzzy Matching)
```
Search for suppliers with name "Acme" in California
```

### Get Supplier Details
```
Get details for supplier ID "SUP#123"
```

### List All Buyers
```
Show me all buyers in the network
```

### Find Relationships
```
What suppliers are linked to buyer ID "BUY#456"?
```

### Audit Trail
```
Show me all suppliers that were updated on 20251213
```

### Smart Search with Address
```
Find suppliers located in San Francisco with postal code 94105
```

## Common Configuration Patterns

### Development vs Production

Create different configs for dev and prod:

**Development (localhost:8080):**
```json
{
  "mcpServers": {
    "network-dev": {
      "command": "node",
      "args": ["/Users/ryan/codebase/network-mcp-test/dist/index.js"],
      "env": {
        "NETWORK_API_KEY": "fd9896cd-5bc2-448e-a6e6-59457dc9db79",
        "NETWORK_API_BASE_URL": "http://localhost:8080"
      }
    }
  }
}
```

**Production:**
```json
{
  "mcpServers": {
    "network-prod": {
      "command": "node",
      "args": ["/Users/ryan/codebase/network-mcp-test/dist/index.js"],
      "env": {
        "NETWORK_API_KEY": "your-production-api-key",
        "NETWORK_API_BASE_URL": "https://api.payvaro.com"
      }
    }
  }
}
```

## Next Steps

- Read the full [README.md](./README.md) for detailed tool documentation
- Explore the fuzzy matching capabilities with the search tool
- Check out the [MCP Documentation](https://modelcontextprotocol.io) for advanced features
- Consider adding more tools or customizing the matching algorithm

## Need Help?

- Check the server logs: `~/Library/Logs/Claude/mcp-server-network.log`
- Verify the API is accessible: `curl http://localhost:8080/api/suppliers`
- Test the MCP server standalone: `npm start`
- Review Claude Desktop MCP settings: Settings → Developer → Edit Config

---

Happy querying! 🚀
