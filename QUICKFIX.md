# QUICK FIX: Unsupported Model Error

## 🔴 Current Error
```
⚠️ stream error: unexpected status 400 Bad Request: {"detail":"Unsupported model"}
```

## ✅ IMMEDIATE FIX (2 Steps)

### Step 1: Run the Automated Fix Script

Open your terminal and run:

```bash
# Option A: Full path
python fix_mcp_model.py C:\Users\scarm\.claude\mcp\servers\a2a-knowledge

# Option B: From LLM repo directory
cd path/to/LLM
python fix_mcp_model.py C:\Users\scarm\.claude\mcp\servers\a2a-knowledge
```

This will automatically:
- ✅ Find and fix invalid model names ("gpt-5" → "gpt-4o")
- ✅ Create backups of original files
- ✅ Show what was changed

### Step 2: Restart the Test Server

```bash
cd C:\Users\scarm\.claude\mcp\servers\a2a-knowledge
python test_server.py
```

## 🎯 Expected Result

You should see:
```
✓ Connected to A2A network as terminal-103164-043047
✓ 🌐 AI Bridge: ws://localhost:4567
✓ 🧠 Knowledge system available
✓ Connection established. Listening for messages...
```

**NO MORE ERRORS!** ✅

---

## 📋 Manual Fix (If Automated Script Doesn't Work)

### 1. Locate Configuration File

Find one of these files in `C:\Users\scarm\.claude\mcp\servers\a2a-knowledge`:
- `test_server.py`
- `.env`
- `.env.local`
- `config.json`
- `config.py`

### 2. Find and Replace Model Name

**Look for:**
```python
model = "gpt-5"          # ❌ WRONG - gpt-5 doesn't exist
MODEL="gpt-5"
```

**Replace with:**
```python
model = "gpt-4o"         # ✅ CORRECT - gpt-4o is valid
MODEL="gpt-4o"
```

### 3. Save and Restart

```bash
cd C:\Users\scarm\.claude\mcp\servers\a2a-knowledge
python test_server.py
```

---

## 🔍 Valid Model Names

If you need to use a different model, here are ALL valid options:

### GPT (OpenAI)
- ✅ `gpt-4o` ← **RECOMMENDED**
- ✅ `gpt-4-turbo`
- ✅ `gpt-3.5-turbo`
- ❌ `gpt-5` ← **INVALID - This doesn't exist!**

### Claude (Anthropic)
- ✅ `claude-3-5-sonnet-20241022`
- ✅ `claude-sonnet-4-5-20250929`

### Gemini (Google)
- ✅ `gemini-1.5-pro`
- ✅ `gemini-1.5-flash`

### Ollama (Local Models)
- ✅ `llama3`
- ✅ `llama2`
- ✅ `mistral`

---

## 🛠️ Verification Steps

After applying the fix:

1. ✅ No "400 Bad Request" errors
2. ✅ No "Unsupported model" messages
3. ✅ Connected to A2A network successfully
4. ✅ AI Bridge shows "ws://localhost:4567"
5. ✅ Knowledge system available
6. ✅ "Listening for messages..." displayed

---

## 🚨 Still Having Issues?

### Check 1: Model Name
```bash
# Run this to see what model you're trying to use
cd C:\Users\scarm\.claude\mcp\servers\a2a-knowledge
grep -r "gpt-5" .
grep -r "MODEL" .
```

### Check 2: Environment Variables
```bash
# List environment variables
echo %MODEL%  # Windows CMD
echo $MODEL   # Windows PowerShell/Linux
```

### Check 3: Dry Run the Fix Script
```bash
# Preview what would be changed (doesn't modify files)
python fix_mcp_model.py --dry-run C:\Users\scarm\.claude\mcp\servers\a2a-knowledge
```

### Check 4: List Valid Models
```bash
# Show all valid model names
python fix_mcp_model.py --list-models
```

---

## 📚 Additional Resources

- **Full Documentation**: See [MCP_SERVER_FIX.md](MCP_SERVER_FIX.md)
- **AI Bridge Setup**: See [BRIDGE_SETUP.md](BRIDGE_SETUP.md)
- **Model Configuration**: See [.env.example](.env.example)

---

## ✨ Summary

**The Problem**: Your MCP server is trying to use "gpt-5" which doesn't exist

**The Solution**: Change model name to "gpt-4o" (which does exist)

**How to Fix**: Run `python fix_mcp_model.py C:\Users\scarm\.claude\mcp\servers\a2a-knowledge`

**Time to Fix**: ~30 seconds

---

**Last Updated**: Just now  
**Status**: Ready to fix your issue! 🚀
