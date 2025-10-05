# 🚀 Quick Test Guide - Try Your Improvements NOW

**Time to test**: 5 minutes  
**Goal**: Verify all improvements are working

---

## ⚡ Quick Commands to Test

### 1. Check Which Wallets Are Most Active (NEW)
```bash
curl http://localhost:3000/api/wallets/activity
```

**What you'll see:**
```json
{
  "summary": {
    "totalWallets": 30,
    "activeToday": 12,
    "totalTransactions24h": 45
  },
  "wallets": [...]
}
```

**Interpretation:**
- `activeToday: 12` - 12 wallets traded today ✅
- `activeToday: 0` - No activity (wallets may be inactive) ⚠️

---

### 2. Trigger Manual Discovery (NEW)
```bash
curl -X POST http://localhost:3000/api/discover
```

**What you'll see:**
```json
{
  "success": true,
  "walletsDiscovered": 3,
  "message": "Discovery complete: Found 3 new wallets"
}
```

**Note**: May return 0 if:
- Daily limit (25) already reached
- No new qualifying wallets found
- This is normal - discovery is selective

---

### 3. Check Current Dashboard
```bash
curl http://localhost:3000/api/dashboard
```

**Look for:**
```json
{
  "performance": {
    "totalTrades": 0,  // Should increase over next 24h
    "winRate": 0
  },
  "recentTrades": [],  // Should populate with trades
  "openTrades": []
}
```

**Before**: `totalTrades: 0`  
**After 24h**: `totalTrades: 10-30` (expected)

---

### 4. Check Strategy Breakdown
```bash
curl http://localhost:3000/api/dashboard | jq '.strategyBreakdown'
```

**What you'll see now:**
```json
{
  "copyTrade": { "trades": 0, "openTrades": 0 },
  "volumeBreakout": { "trades": 0, "openTrades": 0 }
}
```

**What you'll see in 24h:**
```json
{
  "copyTrade": { "trades": 15, "openTrades": 5 },
  "volumeBreakout": { "trades": 3, "openTrades": 2 }
}
```

---

## 📊 Monitor Real-Time Logs

Restart your server to see the improvements:

```bash
npm start
```

**Watch for these NEW messages:**

### Every 1 minute (Tracking):
```
🔄 Processing 15 transactions...
  ✅ TRADE EXECUTED: PEPE via copyTrade - Trade meets criteria
  ✅ TRADE EXECUTED: BONK via volumeBreakout - 2x volume spike
📊 Processing Summary:
  ✅ Trades Executed: 2
  ❌ Trades Rejected: 13

  Top Rejection Reasons:
    copyTrade: Trade too small ($8 < $10) - 5 times
    volumeBreakout: Not enough buyers - 3 times
```

**Key Info:**
- `Trades Executed: 2` - SUCCESS! ✅
- `Trade too small ($8 < $10)` - Threshold is working (only $2 away!)
- If all trades rejected, you'll see WHY

---

## 🔍 Diagnostic Checks

### Check 1: Are wallets being tracked?
```bash
curl http://localhost:3000/api/wallets
```

Should return ~30 wallets with status "active"

---

### Check 2: Are transactions coming in?
```bash
curl http://localhost:3000/api/dashboard | jq '.recentTrades | length'
```

Should return a number > 0

---

### Check 3: What's the rejection breakdown?
Look at your server logs after 1 hour:
```
Top Rejection Reasons:
  copyTrade: Trade too small ($8 < $10) - 5 times
  Risk Manager: Max concurrent trades reached - 3 times
```

**This tells you exactly what to tune next!**

---

## 🎯 Expected Timeline

### Right Now (0 minutes)
```bash
curl http://localhost:3000/api/wallets/activity
```
Shows which wallets are active ✅

---

### After 1 Hour
```bash
# Check console logs
# Should see: "TRADE EXECUTED" messages
```
At least 1-3 trades should execute ✅

---

### After 24 Hours
```bash
curl http://localhost:3000/api/dashboard | jq '.performance.totalTrades'
```
Should return: `10-30` trades ✅

---

## ⚠️ If No Trades After 1 Hour

### Quick Diagnostic:
```bash
# 1. Check if transactions are being tracked
curl http://localhost:3000/api/dashboard | jq '.recentTrades | length'
# Should be > 0

# 2. Check wallet activity
curl http://localhost:3000/api/wallets/activity | jq '.summary.activeToday'
# Should be > 0

# 3. Check server logs for rejection reasons
# Look for: "Top Rejection Reasons:"
```

---

### Common Issues:

**Issue 1: No transactions tracked**
```
Solution: Check MOCK_MODE setting
```

**Issue 2: All trades rejected for "Trade too small"**
```
Solution: Lower minTradeSize even more (to $1)
Edit config/config.js:
  minTradeSize: 1
```

**Issue 3: "Max concurrent trades reached"**
```
Solution: Increase maxConcurrentTrades
Edit config/config.js:
  maxConcurrentTrades: 50
```

**Issue 4: "Wallet win rate too low"**
```
Solution: Remove win rate requirement for new wallets
(Already handled in code - check if wallet is new)
```

---

## 🎮 Browser-Based Testing

You can also test from browser console:

```javascript
// Check wallet activity
fetch('http://localhost:3000/api/wallets/activity')
  .then(r => r.json())
  .then(data => console.table(data.wallets));

// Trigger discovery
fetch('http://localhost:3000/api/discover', { method: 'POST' })
  .then(r => r.json())
  .then(data => console.log(data.message));

// Check dashboard
fetch('http://localhost:3000/api/dashboard')
  .then(r => r.json())
  .then(data => console.log('Trades:', data.performance.totalTrades));
```

---

## 📈 Success Metrics

### Immediate (Right Now)
- ✅ `/api/wallets/activity` returns data
- ✅ `/api/discover` accepts POST requests
- ✅ No linter errors

### Short-term (1 Hour)
- ✅ See "TRADE EXECUTED" in logs
- ✅ `totalTrades > 0` in dashboard
- ✅ Rejection reasons make sense

### Medium-term (24 Hours)
- ✅ 10-30 trades executed
- ✅ 5-15 open positions
- ✅ Can analyze which strategies work best

### Long-term (1 Week)
- ✅ 50-100+ trades for statistical analysis
- ✅ Identify winning vs losing strategies
- ✅ Start optimizing based on real data

---

## 🎉 Next Steps After Confirming Trades

Once you see trades executing:

1. **Let it run for 3-7 days** to collect meaningful data
2. **Analyze strategy performance**:
   ```bash
   curl http://localhost:3000/api/dashboard | jq '.strategyBreakdown'
   ```
3. **Identify top-performing wallets**:
   ```bash
   curl http://localhost:3000/api/wallets/activity | jq '.wallets[:5]'
   ```
4. **Gradually tighten thresholds** for profitable strategies
5. **Pause or disable** unprofitable strategies

---

## 💡 Pro Tips

### Tip 1: Watch First Hour Closely
The first hour will tell you if everything is working. If no trades after 1 hour, check diagnostics immediately.

### Tip 2: Use jq for Better Output
Install jq if you haven't:
```bash
# Windows (using chocolatey)
choco install jq

# Or download from: https://stedolan.github.io/jq/
```

### Tip 3: Create Shortcuts
Add to your shell profile:
```bash
alias wallet-activity="curl -s http://localhost:3000/api/wallets/activity | jq '.summary'"
alias trigger-discovery="curl -s -X POST http://localhost:3000/api/discover | jq '.message'"
alias check-trades="curl -s http://localhost:3000/api/dashboard | jq '.performance'"
```

### Tip 4: Set Up Notifications
When a high-conviction trade executes, you'll see:
```
🚨 HIGH CONVICTION TRADE:
   Token: PEPE
   Chain: ethereum
   Strategy: volumeBreakout
   Size: $250.00
   Reason: 3x volume spike + 5 coordinated buyers
```

---

## 🔧 Emergency Adjustments

If trades are executing but ALL losing:

### Option 1: Tighten stop losses
```javascript
// config/config.js
copyTrade: {
  stopLoss: 0.08,  // Tighter: 8% instead of 15%
}
```

### Option 2: Faster exits
```javascript
takeProfit: 0.25,  // Take profit earlier: 25% instead of 50%
```

### Option 3: More selective
```javascript
minWalletWinRate: 0.50,  // Raise from 0.40 to 0.50
```

**But don't adjust until you have 50+ trades for statistical significance!**

---

## 📞 Support Checklist

Before asking for help, run these:

```bash
# 1. Wallet activity
curl http://localhost:3000/api/wallets/activity | jq '.summary'

# 2. Recent trades
curl http://localhost:3000/api/dashboard | jq '.recentTrades | length'

# 3. Strategy breakdown
curl http://localhost:3000/api/dashboard | jq '.strategyBreakdown'

# 4. System status
curl http://localhost:3000/api/health
```

Share the outputs for fastest help!

---

**Happy testing! Your system should now execute trades within 1 hour.** 🚀

