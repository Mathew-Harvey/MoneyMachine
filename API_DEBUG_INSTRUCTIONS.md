# 🔍 API Connection Debugging - Step by Step

**Issue**: API keys in `.env` file but showing as "Not Configured" in dashboard  
**Added**: Detailed logging and debug endpoint

---

## 🚀 Step 1: Restart Server

```bash
pm2 restart moneymachine
```

Or if running manually:
- Stop (Ctrl+C)
- Start: `npm start`

---

## 🔍 Step 2: Check Debug Endpoint

```bash
curl http://localhost:3005/api/debug/env
```

**This will show**:
- Which API keys are loaded
- Where they came from (env vs default)
- First 10-15 characters of each key

**Expected output**:
```json
{
  "keys": {
    "etherscan": {
      "exists": true,
      "prefix": "VQBEAZ3GNM...",
      "source": "env"
    },
    "solscan": {
      "exists": true,
      "prefix": "eyJhbGciOiJIU...",
      "source": "env"
    },
    "coingecko": {
      "exists": true,
      "prefix": "CG-2fUVbcj...",
      "source": "env"
    }
  }
}
```

---

## 🔍 Step 3: Check Detailed Logs

After restart, check the logs:

```bash
pm2 logs moneymachine --lines 50
```

**Look for these messages**:
```
[info]: Checking Etherscan API {"hasKey":true,"keyPrefix":"VQBEAZ3GNM..."}
[info]: Etherscan API key validated successfully
```

**Or errors like**:
```
[error]: Etherscan API check failed {"error":"...","status":401}
[error]: Etherscan API returned invalid response {"status":"0","message":"Invalid API Key"}
```

---

## 🔍 Step 4: Test Individual API

```bash
# Test Etherscan directly
curl "https://api.etherscan.io/api?module=account&action=balance&address=0x0000000000000000000000000000000000000000&apikey=VQBEAZ3GNMH6YP5TG6Q21K3693N5SP7TV3"

# Should return:
# {"status":"1","message":"OK","result":"..."}
```

---

## 🧪 What We Added

### 1. Detailed Logging
Each API check now logs:
- ✅ Whether key exists
- ✅ First 10-15 characters of key
- ✅ Success or failure
- ✅ Exact error messages from API
- ✅ HTTP status codes

### 2. Debug Endpoint
**GET `/api/debug/env`**
- Shows which keys are loaded
- Shows key prefixes (safe to log)
- Shows source (env vs default)

### 3. Error Details in Response
API status now includes:
- `debug` field with detailed error info
- HTTP status codes
- API response messages

---

## 🎯 Common Issues & Solutions

### Issue 1: Keys Not Loaded
**Symptom**: Debug shows `"exists": false` or `"source": "default"`

**Cause**: .env file not in correct location or not loaded

**Fix**:
```bash
# Verify .env file exists
ls -la .env

# Check it has correct content
head -20 .env

# Make sure dotenv is loading it
# Check backend/server.js line 1: require('dotenv').config();
```

---

### Issue 2: Invalid API Keys
**Symptom**: Logs show "401 Unauthorized" or "Invalid API Key"

**Cause**: API key expired or wrong

**Fix**:
- Regenerate API key from provider website
- Copy exact key (no extra spaces)
- Update .env file

---

### Issue 3: API Rate Limited
**Symptom**: Logs show "429 Too Many Requests"

**Cause**: Free tier limits exceeded

**Fix**:
- Wait a few minutes
- Upgrade to paid tier
- System will retry automatically

---

### Issue 4: API Endpoint Changed
**Symptom**: Logs show "404 Not Found"

**Cause**: API provider changed their endpoint

**Fix**:
- Check provider documentation
- Update endpoint URL in apiStatusChecker.js

---

## 📊 Diagnostic Flow

```
1. Restart server
   ↓
2. Check /api/debug/env
   ↓ Keys loaded?
   
   NO → Check .env file location/format
   YES → Continue
   ↓
3. Check pm2 logs
   ↓ See "API key validated successfully"?
   
   NO → Check error message
   YES → Should show as connected
   ↓
4. Refresh dashboard
   Should show green connected status
```

---

## 🔧 Quick Diagnostic Commands

```bash
# 1. Check if .env is being loaded
curl http://localhost:3005/api/debug/env | jq '.keys'

# 2. Check detailed logs
pm2 logs moneymachine --lines 50 | grep -i "checking.*api"

# 3. Test Etherscan directly
curl "https://api.etherscan.io/api?module=account&action=balance&address=0x0&apikey=YOUR_KEY"

# 4. Check API connections status
curl http://localhost:3005/api/connections/status | jq '.blockchainExplorers'
```

---

## 📝 Next Steps

1. **Restart server**: `pm2 restart moneymachine`
2. **Check debug endpoint**: `curl http://localhost:3005/api/debug/env`
3. **Share the output** so I can see what's happening

The detailed logs will tell us exactly why the APIs aren't connecting!

