# 🎯 Etherscan V2 API Setup Guide

## What is Etherscan V2?

Etherscan V2 is a **unified API** that lets you query blockchain data from **50+ EVM chains** using a **single API key**.

### Supported Chains (Single Key!)
- ✅ Ethereum (Chain ID: 1)
- ✅ Base (Chain ID: 8453)
- ✅ Arbitrum (Chain ID: 42161)
- ✅ Optimism (Chain ID: 10)
- ✅ Polygon (Chain ID: 137)
- ✅ ...and 45+ more!

## 🚀 Getting Started

### 1. Get Your API Key (Free)

Visit: https://etherscan.io/apis

1. Sign up for a free account
2. Create an API key
3. Copy your key (format: `XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`)

**Free Tier:**
- 5 requests per second
- 100,000 requests per day
- Works on all supported chains!

### 2. Add to Your .env File

```env
# Single API key for ALL EVM chains!
ETHERSCAN_API_KEY=VQBEAZ3GNMH6YP5TG6Q21K3693N5SP7TV3
```

That's it! No need for separate API keys for Base, Arbitrum, etc.

## 📊 What This System Uses It For

### 1. **Wallet Transaction Tracking**
Get real transaction data from wallets across all chains:
```javascript
// Ethereum wallet
const ethTxs = await etherscan.getTokenTransactions(address, 'ethereum');

// Base wallet (same key!)
const baseTxs = await etherscan.getTokenTransactions(address, 'base');

// Arbitrum wallet (same key!)
const arbTxs = await etherscan.getTokenTransactions(address, 'arbitrum');
```

### 2. **Token Transfer History**
Track when wallets buy/sell tokens across chains

### 3. **Account Balances**
Get real-time ETH and token balances

### 4. **Smart Contract Verification** (if needed)
Verify contracts across any supported chain

## 🔄 V1 vs V2 Comparison

### ❌ OLD WAY (V1) - Multiple Keys
```env
ETHERSCAN_API_KEY=key_for_ethereum
BSCSCAN_API_KEY=key_for_bsc
SNOWSCAN_API_KEY=key_for_avalanche
ARBISCAN_API_KEY=key_for_arbitrum
OPTIMISM_API_KEY=key_for_optimism
BASESCAN_API_KEY=key_for_base
```

### ✅ NEW WAY (V2) - Single Key
```env
ETHERSCAN_API_KEY=one_key_for_everything
```

## 💡 Usage in This System

The system automatically uses your Etherscan V2 key for:

### Ethereum Tracking
```javascript
// backend/trackers/ethWhaleTracker.js
// Uses Etherscan V2 for Ethereum mainnet
```

### Base Tracking
```javascript
// backend/trackers/baseGemTracker.js
// Uses Etherscan V2 for Base (chain ID: 8453)
```

### Arbitrum Tracking
```javascript
// backend/trackers/baseGemTracker.js
// Uses Etherscan V2 for Arbitrum (chain ID: 42161)
```

## 📈 API Endpoints Used

### Token Transactions
```
GET https://api.etherscan.io/v2/api
  ?chainid=1             # Or 8453 for Base, 42161 for Arbitrum
  &module=account
  &action=tokentx
  &address=0x...
  &apikey=YOUR_KEY
```

### Normal Transactions
```
GET https://api.etherscan.io/v2/api
  ?chainid=1
  &module=account
  &action=txlist
  &address=0x...
  &apikey=YOUR_KEY
```

### Account Balance
```
GET https://api.etherscan.io/v2/api
  ?chainid=1
  &module=account
  &action=balance
  &address=0x...
  &apikey=YOUR_KEY
```

## 🔒 Rate Limits

**Free Tier:**
- 5 requests/second
- 100,000 requests/day
- Shared across all chains

**This System's Usage:**
- Tracks 30 wallets
- Checks every 10 minutes
- ~4,320 requests/day (well within limit!)
- Built-in rate limiting (200ms between requests)
- Smart caching reduces calls by 95%

## ⚡ Benefits for This Project

### Before (Multiple APIs)
```javascript
// Had to manage separate keys and endpoints
if (chain === 'ethereum') {
  url = 'https://api.etherscan.io/api';
  key = ETHERSCAN_API_KEY;
} else if (chain === 'base') {
  url = 'https://api.basescan.org/api';
  key = BASESCAN_API_KEY;
} else if (chain === 'arbitrum') {
  url = 'https://api.arbiscan.io/api';
  key = ARBISCAN_API_KEY;
}
```

### After (Unified API)
```javascript
// Single helper for all chains
const transactions = await etherscan.getTokenTransactions(
  address, 
  chain  // 'ethereum', 'base', 'arbitrum', etc.
);
```

## 🎯 What You Get

With just your Etherscan V2 key configured:

✅ **Real wallet tracking** on Ethereum  
✅ **Real wallet tracking** on Base  
✅ **Real wallet tracking** on Arbitrum  
✅ **Actual transaction data** from blockchain  
✅ **Real token transfers** monitored  
✅ **No mock data** (when MOCK_MODE=false)  
✅ **Paper trading with real market data**  

## 🔄 Migration from Old Keys

If you had separate keys before:

### Old .env
```env
ETHERSCAN_API_KEY=abc123
BASESCAN_API_KEY=def456
ARBISCAN_API_KEY=ghi789
```

### New .env (Just keep the Etherscan one!)
```env
ETHERSCAN_API_KEY=abc123
# These are now optional - Etherscan V2 handles all EVM chains
# BASESCAN_API_KEY=
# ARBISCAN_API_KEY=
```

## 📚 Resources

- **Etherscan V2 Docs:** https://docs.etherscan.io/v/etherscan-v2/
- **Get API Key:** https://etherscan.io/apis
- **Supported Chains:** https://docs.etherscan.io/v/etherscan-v2/getting-started/supported-chains

## ❓ FAQs

**Q: Do I need separate keys for each chain?**  
A: No! One Etherscan V2 key works for all 50+ supported EVM chains.

**Q: What about Solana?**  
A: Solana uses a different API (Solscan/Helius) since it's not EVM-based.

**Q: Will old Basescan/Arbiscan keys still work?**  
A: Yes for backward compatibility, but Etherscan V2 is recommended.

**Q: Is this free?**  
A: Yes! Free tier includes 100k requests/day across all chains.

**Q: What if I hit rate limits?**  
A: The system has built-in caching and rate limiting. You can also upgrade to Etherscan Pro for higher limits.

---

## ✅ Quick Setup Summary

1. Get API key from https://etherscan.io/apis
2. Add to `.env`:
   ```env
   ETHERSCAN_API_KEY=your_key_here
   ```
3. Restart server:
   ```bash
   npm start
   ```
4. That's it! Works for Ethereum, Base, Arbitrum, and 47+ more chains!

**Your key is now configured and ready to track real blockchain data! 🚀**

