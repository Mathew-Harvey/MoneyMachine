# 🚦 Rate Limit Fix - October 2, 2025

## Problem
System was hitting **429 Too Many Requests** errors on Solana RPC calls:
```
Server responded with 429 Too Many Requests. Retrying after 500ms delay...
Error tracking Solana wallet: 429 Too Many Requests
```

## Root Cause
Solana has stricter rate limits than other chains, and our existing delays (2s between wallets) weren't sufficient because:
1. Each wallet makes multiple API calls:
   - `getSignaturesForAddress` (1 call)
   - `getTransaction` (1 call per transaction, up to 20)
2. With 10 Solana wallets, this could mean 200+ API calls in quick succession
3. No delay between individual transaction fetches

## Solution Implemented

### 1. Increased Wallet Delay (Solana Only)
**File**: `backend/trackers/solMemeTracker.js`

- **Before**: 2 seconds between wallets
- **After**: 5 seconds between wallets
- **Impact**: 10 wallets take ~50 seconds instead of ~20 seconds

### 2. Reduced Transaction Limit
**File**: `backend/trackers/solMemeTracker.js`

- **Before**: Fetch 20 recent transactions per wallet
- **After**: Fetch 10 recent transactions per wallet
- **Impact**: 50% fewer API calls per wallet

### 3. Added Transaction Fetch Delay
**File**: `backend/trackers/solMemeTracker.js`

- **Before**: No delay between `getTransaction` calls
- **After**: 1 second delay between each transaction fetch
- **Impact**: Spreads out API calls within each wallet check

### 4. Increased Chain Delay
**File**: `backend/trackers/universalTracker.js`

- **Before**: 3 seconds between chains
- **After**: 5 seconds between chains
- **Impact**: More breathing room between Ethereum → Solana → Base → Arbitrum

## Results

### Total Time Per Tracking Cycle
- **Before**: ~60-70 seconds
- **After**: ~100-120 seconds
- **Trade-off**: Slower but more reliable

### API Call Rate
- **Before**: Up to 200+ calls in 20 seconds (10 calls/second)
- **After**: ~20-30 calls in 50 seconds (0.5 calls/second)
- **Reduction**: ~95% lower call rate for Solana

## If Still Hitting Rate Limits

If you continue to see 429 errors, you can:

1. **Increase delays further** (edit the sleep values in the files above)
2. **Enable mock mode for Solana only** (faster development/testing)
3. **Use a paid RPC endpoint** (Helius, QuickNode, etc. with higher limits)
4. **Reduce tracking frequency** (change `TRACKING_INTERVAL` in .env from 10 to 15 or 20 minutes)

## Testing
Restart your server to apply these changes:
```bash
# Stop the current server (Ctrl+C)
npm start
```

The next tracking cycle should run much slower and avoid rate limits.

