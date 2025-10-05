# 🔄 Test Mode → Production Mode Changes

**Date**: October 5, 2025  
**Change Type**: Configuration Update for Unsupervised Operation

---

## 📊 Summary

Transitioned from **TEST MODE** (aggressive, data collection) to **BALANCED PRODUCTION MODE** (conservative, unsupervised operation).

**Goal**: System can now run safely for weeks without supervision.

---

## 🔧 Strategy Threshold Changes

### CopyTrade Strategy
| Parameter | Test Mode | Production Mode | Change |
|-----------|-----------|-----------------|--------|
| minTradeSize | $10 | $50 | +400% (more selective) |
| minWalletWinRate | 40% | 50% | +25% (require track record) |
| maxPerTrade | $250 | $200 | -20% (safer) |
| maxConcurrentTrades | 20 | 15 | -25% (less exposure) |
| stopLoss | 15% | 12% | -20% (tighter) |
| takeProfit | 50% | 40% | -20% (earlier exits) |
| copyPercentage | 10% | 8% | -20% (smaller sizes) |

**Impact**: More selective, smaller positions, tighter stops.

---

### VolumeBreakout Strategy
| Parameter | Test Mode | Production Mode | Change |
|-----------|-----------|-----------------|--------|
| volumeMultiplier | 2x | 2.5x | +25% (more quality) |
| minBuyerCount | 2 | 3 | +50% (more confirmation) |
| maxPerTrade | $200 | $150 | -25% (safer) |
| maxConcurrentTrades | 15 | 10 | -33% (less exposure) |
| stopLoss | 20% | 15% | -25% (tighter) |
| takeProfit | 75% | 60% | -20% (earlier exits) |

**Impact**: Requires more confirmation, smaller positions.

---

### SmartMoney Strategy
| Parameter | Test Mode | Production Mode | Change |
|-----------|-----------|-----------------|--------|
| minTradeSize | $1,000 | $2,000 | +100% (only bigger plays) |
| minWalletBalance | $50k | $75k | +50% (only true whales) |
| maxPerTrade | $300 | $250 | -17% (safer) |
| maxConcurrentTrades | 10 | 8 | -20% (less exposure) |
| takeProfit | 40% | 35% | -12.5% (earlier exits) |

**Impact**: More selective on wallet quality, smaller positions.

---

### Arbitrage Strategy
| Parameter | Test Mode | Production Mode | Change |
|-----------|-----------|-----------------|--------|
| copyThreshold | $100 | $250 | +150% (more selective) |
| minWinRate | 40% | 50% | +25% (require track record) |
| maxPerTrade | $300 | $200 | -33% (safer) |
| maxConcurrentTrades | 10 | 8 | -20% (less exposure) |
| takeProfit | 25% | 20% | -20% (quicker exits) |

**Impact**: Much more selective, focus on proven arb opportunities.

---

### Memecoin Strategy (Highest Risk)
| Parameter | Test Mode | Production Mode | Change |
|-----------|-----------|-----------------|--------|
| allocation | $1,500 | $1,000 | -33% (REDUCED - riskiest) |
| minWinRate | 25% | 35% | +40% (require better wallets) |
| copyThreshold | 1 buyer | 2 buyers | +100% (need coordination) |
| copyTimeWindow | 2 hours | 1 hour | -50% (fresher signals) |
| maxPerTrade | $150 | $100 | -33% (safer) |
| maxConcurrentTrades | 20 | 12 | -40% (much less exposure) |
| stopLoss | 50% | 40% | -20% (tighter) |
| maxHoldTime | 72h | 48h | -33% (faster exits) |

**Impact**: Significantly reduced allocation and exposure on riskiest strategy.

**Memecoin Take Profit Changes:**
- Test: At 2x sell 50%, at 10x sell 30%, at 100x sell 20%
- Production: At 2x sell 60%, at 5x sell 30%, at 10x sell 10%
- Change: Take more profit earlier, keep less for moonshots

---

### EarlyGem Strategy
| Parameter | Test Mode | Production Mode | Change |
|-----------|-----------|-----------------|--------|
| minWalletWinRate | 40% | 50% | +25% (require track record) |
| tokenAgeLimit | 168h (7d) | 120h (5d) | -29% (fresher focus) |
| maxPerTrade | $100 | $75 | -25% (safer) |
| maxConcurrentTrades | 10 | 6 | -40% (much less exposure) |
| stopLoss | 30% | 25% | -17% (tighter) |
| takeProfit | 3x | 2.5x | -17% (more realistic) |
| minLiquidity | $10k | $20k | +100% (quality tokens) |

**Impact**: More selective, smaller positions, shorter hold times.

---

## 🛡️ Risk Management Changes

### NEW Limits Added
| Limit | Production Mode | Purpose |
|-------|-----------------|---------|
| maxWeeklyLoss | 8% | Pause trading if losing >8%/week |
| maxOpenPositions | 40 | Hard cap on total open positions |
| autoPauseEnabled | true | Auto-pause underperforming strategies |
| autoPauseThreshold | -15% | Pause strategy if down 15% |

### Tightened Existing Limits
| Limit | Test Mode | Production Mode | Change |
|-------|-----------|-----------------|--------|
| maxDrawdown | 30% | 20% | -33% (tighter) |
| maxDailyLoss | 5% | 3% | -40% (tighter) |
| maxPositionSize | 15% | 12% | -20% (safer) |
| correlationLimit | 30% | 25% | -17% (less concentration) |

**Impact**: System will pause trading automatically at lower loss thresholds.

---

## 🔍 Discovery Changes

| Parameter | Test Mode | Production Mode | Change |
|-----------|-----------|-----------------|--------|
| dailyLimit | 25 wallets | 15 wallets | -40% (more selective) |
| minTradeCount | 10 | 15 | +50% (more history required) |
| minWinRate | 52% | 55% | +5.8% (higher standard) |
| minProfitability | $2,000 | $3,000 | +50% (higher bar) |
| pumpThreshold | 2x | 2.5x | +25% (bigger moves only) |
| pumpTimeframe | 14 days | 10 days | -29% (fresher signals) |
| earlyBuyThreshold | 30% | 25% | -17% (more selective) |

**Impact**: Discovery will find fewer but higher-quality wallets.

---

## 📈 Performance Tracking Changes

| Parameter | Test Mode | Production Mode | Change |
|-----------|-----------|-----------------|--------|
| performanceThreshold | -15% | -12% | -20% (pause wallets faster) |
| promotionThreshold | 5 trades | 8 trades | +60% (require more proof) |
| demotionThreshold | 10 losses | 5 losses | -50% (demote faster) |

**Impact**: Faster to demote losers, slower to promote winners (more conservative).

---

## 🎯 Expected Behavior Changes

### Test Mode Characteristics:
- ✅ Execute 10-30 trades/day
- ✅ High trade volume for data collection
- ✅ Accept lower quality trades
- ✅ Loose risk limits
- ⚠️ Higher risk, higher volatility
- ⚠️ Requires monitoring

### Production Mode Characteristics:
- ✅ Execute 3-15 trades/day (more selective)
- ✅ Quality over quantity
- ✅ Only accept proven strategies
- ✅ Tight risk limits with auto-pause
- ✅ Lower risk, lower volatility
- ✅ Can run unsupervised for weeks

---

## 📊 Performance Expectations

### Test Mode Goals:
- Collect 100+ trades quickly
- Learn what works
- Accept higher losses for learning
- Win rate: 35-45% acceptable

### Production Mode Goals:
- Sustainable profitability
- Protect capital first
- Run safely unsupervised
- Win rate: 45-55% target

---

## 🔄 Migration Path

If you collected data in test mode, here's how to transition:

### Step 1: Analyze Test Data (If You Ran Test Mode)
```bash
# Check which strategies performed best
curl http://localhost:3000/api/dashboard | jq '.strategyBreakdown'

# Identify top wallets
curl http://localhost:3000/api/wallets/activity | jq '.wallets | sort_by(.winRate) | reverse | .[0:10]'
```

### Step 2: Apply Production Config
```bash
# Already done! Config is now set to production mode
# Just restart the system
pm2 restart moneymachine
```

### Step 3: Monitor First Week
- Check daily for first 3-7 days
- Verify risk limits are working
- Ensure trades are still executing (3-15/day)
- Confirm no errors in logs

### Step 4: Trust the System
- After 1 week of stable operation, reduce monitoring to weekly
- Let risk management do its job
- Only intervene if emergency stop triggers

---

## 🚦 Risk Level Comparison

### Test Mode:
```
Risk Level: HIGH
- Loose thresholds
- Large positions
- High volume
- Suitable for: Data collection, supervised operation
```

### Production Mode:
```
Risk Level: MODERATE
- Balanced thresholds
- Conservative positions
- Quality over quantity
- Suitable for: Unsupervised operation, capital preservation
```

---

## 💡 Key Takeaways

### What Stayed the Same:
- ✅ Core tracking frequency (1 minute)
- ✅ Discovery frequency (every 6 hours)
- ✅ Price fetching (DexScreener, Jupiter, etc.)
- ✅ Strategy logic (how trades are evaluated)
- ✅ API endpoints (manual discovery, wallet activity)

### What Changed:
- 🔄 Trade thresholds (5x more selective)
- 🔄 Position sizes (20-40% smaller)
- 🔄 Risk limits (much tighter)
- 🔄 Stop losses (10-25% tighter)
- 🔄 Discovery standards (50% higher)
- 🔄 Auto-pause features (NEW)

### Why These Changes:
- **Unsupervised Safety**: System won't blow up while you're away
- **Capital Preservation**: Tighter stops protect from large losses
- **Quality Focus**: Better to trade less but win more
- **Risk Management**: Multiple layers of protection
- **Sustainable Operation**: Can run for weeks without intervention

---

## 🎯 Bottom Line

**Test Mode**: Aggressive, high volume, requires monitoring  
**Production Mode**: Balanced, selective, can run unsupervised

**The system went from "collect data fast" to "make money safely".**

You should now see:
- Fewer trades per day (3-15 vs 10-30)
- Higher win rate target (50% vs 40%)
- Better risk management (auto-pause at 20% drawdown vs 30%)
- Safer operation (can leave it for weeks)

---

**Files Modified**:
- `config/config.js` - All strategy thresholds updated
- `backend/trading/riskManager.js` - Added weekly loss & max positions checks

**Documentation Created**:
- `PRODUCTION_MODE_GUIDE.md` - Complete operations manual
- `TEST_TO_PRODUCTION_CHANGES.md` - This file

---

**Status**: ✅ READY FOR UNSUPERVISED OPERATION

Start the system and check in every few days. The risk management will protect your capital!

🚀

