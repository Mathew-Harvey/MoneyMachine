# 🔌 API Connections Guide

**Complete guide to all external services your MoneyMachine uses**

---

## 📊 Current Status Check

```bash
# Get comprehensive API status
curl http://localhost:3000/api/connections/status | jq

# Get quick summary
curl http://localhost:3000/api/connections/summary | jq
```

---

## 🎯 Services Overview

### ✅ Currently Connected (Working Out of the Box)

#### 1. **DexScreener** 🟢 CRITICAL - NO API KEY NEEDED
- **Purpose**: Primary price source for ALL chains
- **Chains**: Ethereum, Solana, Base, Arbitrum, + 50 more
- **Rate Limit**: 300 calls/minute (free)
- **Status**: ✅ Connected automatically
- **Cost**: FREE

#### 2. **Jupiter** 🟢 OPTIONAL - NO API KEY NEEDED
- **Purpose**: Solana DEX price aggregator
- **Chain**: Solana
- **Rate Limit**: Unlimited
- **Status**: ✅ Connected automatically
- **Cost**: FREE

#### 3. **CoinGecko** 🟡 OPTIONAL - FREE TIER
- **Purpose**: Major token price data
- **Rate Limit**: 10-30 calls/minute (free tier)
- **Status**: ⚠️ Using free tier (slow)
- **Cost**: FREE (Pro: $129/month for 500 calls/min)

---

### ⚠️ Missing But CRITICAL

#### 1. **Etherscan API** 🔴 CRITICAL
- **Purpose**: Transaction data for Ethereum, Base, Arbitrum
- **Why Critical**: Without this, EVM tracking fails or is very slow
- **Rate Limit**: 5 calls/second with key (vs 1 call/5sec without)
- **Cost**: FREE
- **Setup**: 
  ```bash
  # 1. Sign up at https://etherscan.io/apis
  # 2. Get API key
  # 3. Add to .env:
  ETHERSCAN_API_KEY=your_key_here
  ```

---

### 🚀 Highly Recommended

#### 2. **Helius** 🟠 HIGH PRIORITY
- **Purpose**: Premium Solana RPC (much faster than public)
- **Why Important**: 10-100x faster Solana transaction tracking
- **Rate Limit**: 100,000 requests/month (free tier)
- **Cost**: FREE tier available, paid from $99/month
- **Setup**:
  ```bash
  # 1. Sign up at https://helius.xyz
  # 2. Create API key
  # 3. Add to .env:
  HELIUS_API_KEY=your_key_here
  ```
- **Impact**: Dramatically improves Solana wallet tracking speed

---

### 📈 Nice to Have

#### 3. **Solscan API** 🟡 MEDIUM PRIORITY
- **Purpose**: Better Solana transaction history
- **Why Useful**: More detailed Solana wallet analysis
- **Rate Limit**: 10 calls/second (free tier)
- **Cost**: FREE tier available
- **Setup**:
  ```bash
  # 1. Sign up at https://solscan.io
  # 2. Get API token
  # 3. Add to .env:
  SOLSCAN_API_KEY=your_key_here
  ```

#### 4. **CoinGecko Pro** 🟡 MEDIUM PRIORITY
- **Purpose**: Higher rate limits for price data
- **Why Useful**: 500 calls/min vs 10-30 on free tier
- **Cost**: $129/month
- **Setup**:
  ```bash
  COINGECKO_API_KEY=your_pro_key_here
  ```

#### 5. **Alchemy** 🟢 LOW PRIORITY
- **Purpose**: Premium EVM RPC provider
- **Chains**: Ethereum, Base, Arbitrum, Polygon, Optimism
- **Rate Limit**: 300M compute units/month (free)
- **Cost**: FREE tier available
- **Why Useful**: More reliable than public RPCs
- **Setup**:
  ```bash
  # 1. Sign up at https://alchemy.com
  # 2. Create app and get API key
  # 3. Add to .env:
  ALCHEMY_API_KEY=your_key_here
  ```

#### 6. **QuickNode** 🟢 LOW PRIORITY
- **Purpose**: Multi-chain premium RPC
- **Chains**: All major chains
- **Why Useful**: Single provider for everything, trace API
- **Cost**: FREE tier available
- **Setup**:
  ```bash
  # 1. Sign up at https://quicknode.com
  # 2. Create endpoint
  # 3. Add to .env:
  QUICKNODE_API_KEY=your_key_here
  ```

#### 7. **CoinMarketCap** 🟢 LOW PRIORITY
- **Purpose**: Fallback price source
- **Rate Limit**: 333 calls/day (free), 30 calls/min
- **Cost**: FREE tier available
- **Setup**:
  ```bash
  # 1. Sign up at https://coinmarketcap.com/api
  # 2. Get API key
  # 3. Add to .env:
  COINMARKETCAP_API_KEY=your_key_here
  ```

---

## 🎯 Priority Setup Guide

### Minimum Setup (Free, 15 minutes)

```bash
# 1. Etherscan (CRITICAL - enables EVM tracking)
#    Sign up: https://etherscan.io/apis
ETHERSCAN_API_KEY=YourEtherscanKey

# Add to .env file, then restart
```

**Result**: Ethereum, Base, and Arbitrum tracking will work properly.

---

### Recommended Setup (Free, 30 minutes)

```bash
# 1. Etherscan (CRITICAL)
ETHERSCAN_API_KEY=YourEtherscanKey

# 2. Helius (Dramatically improves Solana)
#    Sign up: https://helius.xyz
HELIUS_API_KEY=YourHeliusKey

# Add to .env file, then restart
```

**Result**: All chains tracking at full speed, much better Solana performance.

---

### Optimal Setup (Paid, 1 hour)

```bash
# 1. Etherscan (FREE)
ETHERSCAN_API_KEY=YourEtherscanKey

# 2. Helius (FREE tier or $99/month)
HELIUS_API_KEY=YourHeliusKey

# 3. CoinGecko Pro ($129/month - optional)
COINGECKO_API_KEY=YourCoinGeckoProKey

# 4. Alchemy (FREE tier)
#    Sign up: https://alchemy.com
ALCHEMY_API_KEY=YourAlchemyKey

# 5. Solscan (FREE tier)
#    Sign up: https://solscan.io
SOLSCAN_API_KEY=YourSolscanKey

# Add to .env file, then restart
```

**Result**: Maximum performance, best rate limits, highest reliability.

---

## 📊 Cost Breakdown

| Service | Free Tier | Paid Tier | Priority | Monthly Cost |
|---------|-----------|-----------|----------|--------------|
| **Etherscan** | 5 req/sec | N/A | CRITICAL | $0 |
| **DexScreener** | 300 req/min | N/A | CRITICAL | $0 |
| **Helius** | 100k req/month | 1M+ req/month | HIGH | $0-99 |
| **Solscan** | 10 req/sec | Custom | MEDIUM | $0 |
| **CoinGecko Pro** | 10-30 req/min | 500 req/min | MEDIUM | $0-129 |
| **Alchemy** | 300M CU/month | Unlimited | LOW | $0+ |
| **QuickNode** | Free tier | Custom | LOW | $0+ |
| **CoinMarketCap** | 333 req/day | 10k+ req/day | LOW | $0+ |

**Recommended budget**: $0-99/month (Etherscan + Helius)

---

## 🔍 How to Check Your Current Status

### Via API
```bash
# Full status
curl http://localhost:3000/api/connections/status | jq

# Summary only
curl http://localhost:3000/api/connections/summary | jq
```

### Via Dashboard
Navigate to: **System Status → API Connections**

You'll see:
- ✅ Green: Connected and working
- ⚠️ Yellow: Not configured but optional
- ❌ Red: Missing and critical

---

## 🛠️ Setup Instructions

### 1. Create `.env` File

If you don't have one:
```bash
cp env.example .env
```

### 2. Add API Keys

Edit `.env`:
```bash
# Critical
ETHERSCAN_API_KEY=your_key_here

# Recommended
HELIUS_API_KEY=your_key_here

# Optional
SOLSCAN_API_KEY=your_key_here
COINGECKO_API_KEY=your_key_here
ALCHEMY_API_KEY=your_key_here
QUICKNODE_API_KEY=your_key_here
COINMARKETCAP_API_KEY=your_key_here
```

### 3. Restart System

```bash
pm2 restart moneymachine
# or
npm start
```

### 4. Verify

```bash
curl http://localhost:3000/api/connections/summary
```

---

## 📈 Performance Impact

### Without Etherscan:
- ⚠️ EVM tracking slow or broken
- ⚠️ May hit rate limits constantly
- ⚠️ Incomplete transaction data

### With Etherscan:
- ✅ 5x faster EVM tracking
- ✅ Reliable transaction data
- ✅ No rate limit issues

### Without Helius (Solana):
- ⚠️ Using public RPCs (slow, unreliable)
- ⚠️ May miss transactions
- ⚠️ Rate limits

### With Helius (Solana):
- ✅ 10-100x faster Solana tracking
- ✅ Real-time transaction data
- ✅ Webhook support (future)
- ✅ 99.9% uptime

---

## 🎯 What Each Service Does

### Blockchain Explorers
**Get transaction history for wallets**
- Etherscan: Ethereum, Base, Arbitrum, Polygon
- Solscan: Solana

### RPC Providers
**Direct blockchain node access**
- Public RPCs: Free but slow (what you use now)
- Helius: Premium Solana RPC
- Alchemy: Premium EVM RPC
- QuickNode: Multi-chain premium

### Price Oracles
**Get token prices**
- DexScreener: DEX prices (all chains) ⭐ PRIMARY
- Jupiter: Solana DEX prices
- CoinGecko: Major token prices
- CoinMarketCap: Fallback prices

---

## ❓ FAQ

### Q: What's the minimum I need?
**A**: Just **Etherscan API** (free). Without it, Ethereum/Base/Arbitrum tracking is broken.

### Q: What should I add first?
**A**: 
1. **Etherscan** (critical, free)
2. **Helius** (big impact, free tier)

### Q: Do I need all of them?
**A**: No! The system works with just Etherscan + DexScreener + Jupiter (all free).

### Q: What if I don't add any keys?
**A**: 
- ✅ Solana works (slow but functional)
- ❌ EVM chains broken without Etherscan
- ✅ Prices work (DexScreener + Jupiter)

### Q: Is it worth paying for premium?
**A**: 
- **Helius ($99/month)**: YES if trading Solana actively
- **CoinGecko Pro ($129/month)**: NO unless hitting rate limits
- **Others**: Only if scaling beyond 100 wallets

### Q: Can I use my own RPC endpoints?
**A**: Yes! Edit `config/config.js` → `rpc` section with your custom endpoints.

---

## 🚀 Quick Start Commands

```bash
# 1. Check what you're missing
curl http://localhost:3000/api/connections/summary | jq '.recommendations'

# 2. Get Etherscan key (CRITICAL)
# Visit: https://etherscan.io/apis

# 3. Add to .env
echo "ETHERSCAN_API_KEY=your_key_here" >> .env

# 4. (Optional) Get Helius key
# Visit: https://helius.xyz

# 5. (Optional) Add to .env
echo "HELIUS_API_KEY=your_key_here" >> .env

# 6. Restart
pm2 restart moneymachine

# 7. Verify
curl http://localhost:3000/api/connections/summary
```

---

## 📞 Support Links

- **Etherscan**: https://etherscan.io/apis
- **Helius**: https://helius.xyz
- **Solscan**: https://solscan.io
- **CoinGecko**: https://coingecko.com/api
- **Alchemy**: https://alchemy.com
- **QuickNode**: https://quicknode.com
- **CoinMarketCap**: https://coinmarketcap.com/api

---

**TL;DR**: 
1. **Add Etherscan API key** (critical, free) ← DO THIS
2. **Add Helius API key** (big impact, free tier) ← RECOMMENDED
3. Everything else is optional

Your system will work much better with just these two free services!

