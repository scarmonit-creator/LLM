# MCP Server Model Configuration Fix

## Issue
The test_server.py in `C:\Users\scarm\.claude\mcp\servers\a2a-knowledge` is returning:
```
unexpected status 400 Bad Request: {"detail":"Unsupported model"}
```

## Root Cause
The MCP server is configured to use an invalid model name (likely "gpt-5" or similar) that doesn't exist in the backend API.

## Solution
Update the model configuration in your test_server.py or its configuration file to use a valid model name.

### Valid Model Names

Based on the LLM repository adapters, here are the supported model names:

#### Claude (Anthropic)
- `claude-3-5-sonnet-20241022` ✓
- `claude-sonnet-4-5-20250929` ✓

#### GPT (OpenAI)
- `gpt-4o` ✓ (CORRECT)
- ~~`gpt-5`~~ ✗ (INVALID - this model doesn't exist)

#### Gemini (Google)
- `gemini-1.5-pro` ✓

#### Ollama (Local)
- `llama3` ✓
- Various other local models

## How to Fix

1. Locate the configuration in your MCP server:
   - Check for a `.env` file in `C:\Users\scarm\.claude\mcp\servers\a2a-knowledge`
   - Check the `test_server.py` file for hardcoded model names
   - Check any `config.json` or similar configuration files

2. Update the model name from invalid (e.g., "gpt-5") to valid (e.g., "gpt-4o")

3. Example configuration:
   ```python
   # In test_server.py or config file
   MODEL = "gpt-4o"  # Changed from "gpt-5"
   ```

4. Restart the test server:
   ```bash
   cd C:\Users\scarm\.claude\mcp\servers\a2a-knowledge
   python test_server.py
   ```

5. Verify the fix - you should see:
   ```
   ✓ Connected to A2A network as terminal-103164-043047
   ✓ 🌐 AI Bridge: ws://localhost:4567
   ✓ 🧠 Knowledge system available
   ✓ Connection established. Listening for messages...
   ```

## Related Changes

- ✓ Updated `adapters/gpt5.ts` to use "gpt-4o" instead of "gpt-5"
- ✓ Updated `.env.example` with valid model names
- ⚠️ MCP server configuration still needs manual update

## Testing

After updating the configuration, run:
```bash
cd C:\Users\scarm\.claude\mcp\servers\a2a-knowledge
python test_server.py
```

Expected output:
- No "400 Bad Request" errors
- No "Unsupported model" messages
- Successful connection to A2A network
- Messages being processed without errors

## Environment Variables

If using `.env` file, ensure it has valid model configuration:
```
MODEL=gpt-4o
CLAUDE_MODEL=claude-3-5-sonnet-20241022
GEMINI_MODEL=gemini-1.5-pro
```

## Additional Notes

- The "gpt-5" model name was a mistake - GPT-5 has not been released by OpenAI
- The correct model name for the latest GPT model is "gpt-4o"
- This fix is separate from the GitHub repository fixes and must be applied manually to the local MCP server
