# 🧪 Test Your API Keys Directly

**Quick test to verify if your API keys are valid**

---

## 1️⃣ Test Etherscan API Key

```bash
curl "https://api.etherscan.io/api?module=account&action=balance&address=0x0000000000000000000000000000000000000000&apikey=VQBEAZ3GNMH6YP5TG6Q21K3693N5SP7TV3"
```

**Expected Response**:
```json
{
  "status":"1",
  "message":"OK",
  "result":"0"
}
```

**If you get `status: "0"`**, the API key is invalid or expired.

---

## 2️⃣ Test Solscan API Key (V2)

```bash
curl -H "token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NTk0MDU2MTU0NTUsImVtYWlsIjoibWF0aGV3aGFydmV5QGdtYWlsLmNvbSIsImFjdGlvbiI6InRva2VuLWFwaSIsImFwaVZlcnNpb24iOiJ2MiIsImlhdCI6MTc1OTQwNTYxNX0.keKKharIWvsgEod1C_YqWsfVB7yipnaKwhOpanaQ0Wo" "https://pro-api.solscan.io/v2.0/account/balance_change?address=So11111111111111111111111111111111111111112&limit=1"
```

**Expected Response**:
```json
{
  "success": true,
  "data": [...]
}
```

---

## 3️⃣ Test CoinGecko API Key

```bash
curl "https://pro-api.coingecko.com/api/v3/ping?x_cg_pro_api_key=CG-2fUVbcjqF2aM3ZXDG6CuX4kx"
```

**Expected Response**:
```json
{
  "gecko_says": "(V3) To the Moon!"
}
```

---

## 🎯 After Testing

**Run each command above and check**:
- ✅ If you get valid JSON = API key works
- ❌ If you get error/HTML = API key invalid or expired

---

## 🔧 Next Steps

### If Etherscan Returns Error
Your API key might be:
1. **Invalid** - Regenerate at https://etherscan.io/myapikey
2. **Expired** - Check if your account is active
3. **Rate limited** - Wait 5 minutes and try again

### If Solscan Returns Error
The endpoint changed. I've updated the code to use V2 API.

### If CoinGecko Returns Error
Pro API might be expired. Check your subscription at https://coingecko.com

---

## 📊 Restart After Fixes

```bash
pm2 restart moneymachine
```

Then check:
```bash
curl http://localhost:3005/api/connections/status | jq '.blockchainExplorers'
```

Should now show all as connected!

