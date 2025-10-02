# 🚦 Rate Limiting & API Management

## The Challenge

Public blockchain RPCs have strict rate limits to prevent abuse. When tracking 30 wallets across 4 chains, we can easily hit these limits.

## Our Solution

We've implemented several layers of rate limiting to avoid 429 errors:

---

## 1️⃣ Reduced Tracking Frequency

### Before (Too Aggressive)
- ❌ Track wallets every 2 minutes
- ❌ Discover every hour
- ❌ Update metrics every 5 minutes
- ❌ Manage positions every minute

### After (Rate-Limit Friendly)
- ✅ Track wallets every **10 minutes**
- ✅ Discover every **6 hours**
- ✅ Update metrics every **15 minutes**
- ✅ Manage positions every **5 minutes**

This **5x reduction** in API calls prevents overwhelming public RPCs.

---

## 2️⃣ Sequential Processing with Delays

### Wallet-Level Delays
Each tracker now waits **2 seconds** between checking individual wallets:

```javascript
// Instead of checking all 10 wallets at once
for (const wallet of wallets) {
  await trackWallet(wallet);
  await sleep(2000); // 2 second delay
}
```

**Impact**: 10 wallets × 2 seconds = 20 seconds per chain (gentle on RPCs)

### Chain-Level Delays
The universal tracker waits **3 seconds** between chains:

```javascript
// Check Ethereum (20s for 10 wallets)
await sleep(3000);
// Check Solana (20s for 10 wallets)
await sleep(3000);
// Check Base (10s for 5 wallets)
await sleep(3000);
// Check Arbitrum (10s for 5 wallets)
```

**Total tracking time**: ~90 seconds per cycle (vs instant before)

---

## 3️⃣ Mock Mode (Recommended)

### What is Mock Mode?

Instead of making real RPC calls, the system generates realistic fake data:
- ✅ No API calls
- ✅ No rate limits
- ✅ Instant response
- ✅ Perfect for testing

### Enable Mock Mode

**Option 1: Environment Variable**
```bash
MOCK_MODE=true npm start
```

**Option 2: .env File**
```
MOCK_MODE=true
```

**Option 3: Default Behavior**
Mock mode is now **enabled by default** if you don't set the environment variable.

### Disable Mock Mode (Use Real APIs)

Only do this if you have:
- ✅ Your own RPC endpoints
- ✅ API keys for block explorers
- ✅ Higher rate limits

```bash
MOCK_MODE=false npm start
```

---

## 4️⃣ RPC Fallbacks

Each chain has multiple fallback RPCs:

```javascript
ethereum: [
  'https://eth.llamarpc.com',      // Try first
  'https://rpc.ankr.com/eth',      // Fallback 1
  'https://ethereum.publicnode.com', // Fallback 2
  'https://eth.drpc.org'           // Fallback 3
]
```

If one fails or hits rate limits, we automatically try the next.

---

## 📊 Rate Limit Breakdown

### Public RPC Limits (Typical)
- **Requests per second**: 1-3
- **Requests per minute**: 60-120
- **Requests per day**: 10,000-100,000

### Our System (After Optimization)

#### Per Tracking Cycle (10 minutes)
- Ethereum: ~10 calls (1 per wallet)
- Solana: ~10 calls
- Base: ~5 calls
- Arbitrum: ~5 calls
- **Total**: ~30 calls per 10 minutes

#### Per Hour
- Tracking: ~180 calls (6 cycles)
- Discovery: ~50 calls (once per 6 hours)
- Metrics: ~10 calls (4 times)
- **Total**: ~240 calls/hour

#### Per Day
- **Total**: ~5,760 calls/day

**Result**: Well within free tier limits! ✅

---

## 🎯 Best Practices

### For Development/Testing
```bash
# Use mock mode - no rate limits!
MOCK_MODE=true npm start
```

### For Production with Free RPCs
```bash
# System already configured with delays
# Just make sure MOCK_MODE=false
npm start
```

### For Production with Paid RPCs
1. Get API keys from:
   - Alchemy (Ethereum)
   - Helius (Solana)
   - Infura (Multi-chain)

2. Add to `.env`:
```
ALCHEMY_API_KEY=your_key
HELIUS_API_KEY=your_key
```

3. Update `config/config.js` with your custom endpoints

4. You can increase frequency:
```javascript
// In server.js
cron.schedule('*/2 * * * *', ...) // Every 2 minutes OK with paid
```

---

## 🚨 If You Still Hit Rate Limits

### 1. Enable Mock Mode
```bash
MOCK_MODE=true npm start
```

### 2. Reduce Tracking Frequency
Edit `backend/server.js`:
```javascript
// Change from 10 to 30 minutes
cron.schedule('*/30 * * * *', ...)
```

### 3. Track Fewer Wallets
Edit wallet counts in `config/walletSeeds.js` (comment out some)

### 4. Increase Delays
Edit tracker files:
```javascript
await this.sleep(5000); // Increase from 2000 to 5000
```

### 5. Get Your Own RPC Endpoints
- **Alchemy**: 300M compute units/month free
- **Infura**: 100k requests/day free
- **QuickNode**: Custom limits
- **Helius**: 100k credits/month free

---

## 📈 Monitoring Rate Limits

### Watch the Logs
```bash
npm start

# Look for:
✓ Found 0 new transactions  # Normal
❌ 429 Too Many Requests    # Rate limited
⚠️ Falling back to mock mode # Auto-recovery
```

### If You See 429 Errors
1. System will automatically retry with exponential backoff
2. After 3 retries, falls back to mock mode
3. Check logs to see which RPC is failing
4. Consider switching to mock mode or adding API keys

---

## 🎮 Recommended Setup

### Day 1-7: Learning & Testing
```bash
MOCK_MODE=true npm start
```
- ✅ No rate limits
- ✅ Fast testing
- ✅ Learn the system

### Week 2+: Add Real Data
```bash
MOCK_MODE=false npm start
```
- ✅ Start with optimized settings
- ✅ Monitor for 429 errors
- ✅ Adjust if needed

### Production: Get API Keys
```bash
# Add to .env
ALCHEMY_API_KEY=...
HELIUS_API_KEY=...
MOCK_MODE=false
```
- ✅ Higher limits
- ✅ Better reliability
- ✅ Can increase frequency

---

## 🔧 Customization

Want to track even more conservatively?

Edit `backend/trackers/ethWhaleTracker.js`:
```javascript
await this.sleep(5000); // 5 seconds between wallets
```

Edit `backend/trackers/universalTracker.js`:
```javascript
await this.sleep(10000); // 10 seconds between chains
```

Edit `backend/server.js`:
```javascript
cron.schedule('*/30 * * * *', ...) // Every 30 minutes
```

---

## ✅ Summary

**Problem**: Public RPCs have strict rate limits (429 errors)

**Solution**: 
1. ✅ Reduced tracking frequency (2min → 10min)
2. ✅ Added delays between requests (2-3 seconds)
3. ✅ Sequential processing (not parallel)
4. ✅ Mock mode by default (no API calls)
5. ✅ Multiple RPC fallbacks

**Result**: System runs smoothly within free tier limits!

---

**💡 Pro Tip**: Start with mock mode, learn the system, then gradually enable real APIs as you get your own endpoints.


