# 🚀 Scaling to Track More Successful Wallets

## Current Status
- **Active wallets**: 31 wallets
- **Discovery system**: ✅ Enabled and running every 6 hours
- **Daily discovery limit**: 5 new wallets per day
- **Rate limits**: ✅ FIXED - You can now handle more wallets

---

## 🎯 How Wallet Discovery Works

Your system automatically finds profitable wallets by:

1. **Finding pumping tokens** (>5x gains in 7 days)
2. **Identifying early buyers** (bought in bottom 20% of price range)
3. **Analyzing trading history** (20+ trades, 60%+ win rate, $5k+ profit)
4. **Scoring wallets** (0-100 based on profitability, consistency, risk management)
5. **Adding top performers** to your discovered wallets pool

### Current Qualification Requirements:
```javascript
✅ Minimum 20 trades (historical activity)
✅ 60%+ win rate (profitable trader)
✅ $5,000+ total profit (proven success)
✅ Early entry on pumping tokens (smart timing)
```

---

## 🔧 Scale Up Gradually (Recommended)

### Phase 1: Increase Daily Discovery (Week 1-2)
**Goal**: Discover 10-15 wallets per day instead of 5

**Edit `.env` or `config/config.js`:**
```bash
# In your .env file:
DISCOVERY_DAILY_LIMIT=15
```

Or edit `config/config.js` line 102:
```javascript
dailyLimit: parseInt(process.env.DISCOVERY_DAILY_LIMIT) || 15, // Up from 5
```

**Expected result**: 
- 15 wallets/day × 30 days = **450 new wallets/month**
- Most will be in "discovered" pool, you promote the best ones

---

### Phase 2: Lower Quality Thresholds (Week 3-4)
**Goal**: Cast a wider net to find more candidates

**Edit `config/config.js`:**
```javascript
discovery: {
  enabled: true,
  dailyLimit: 15,
  minTradeCount: 15,        // Lower from 20 → more candidates
  minWinRate: 0.55,          // Lower from 0.60 → 55% win rate still good
  minProfitability: 3000,    // Lower from $5k → $3k still profitable
  pumpThreshold: 3,          // Lower from 5x → catch 3x pumps too
  pumpTimeframe: 7,
  earlyBuyThreshold: 0.25    // Raise from 0.20 → top 25% entry points
}
```

**Expected result**:
- More wallets qualify
- Need to manually review discovered wallets more carefully
- Still only promote the best ones

---

### Phase 3: Aggressive Growth (Month 2+)
**Goal**: Build a database of 100+ tracked wallets

**Edit `config/config.js`:**
```javascript
discovery: {
  enabled: true,
  dailyLimit: 25,            // 25 per day = 750/month
  minTradeCount: 10,         // Even newer wallets with good records
  minWinRate: 0.50,          // 50%+ = breaking even or better
  minProfitability: 2000,    // $2k profit threshold
  pumpThreshold: 2,          // 2x pumps (more tokens qualify)
  pumpTimeframe: 14,         // Look back 2 weeks instead of 1
  earlyBuyThreshold: 0.30    // Top 30% entry points
}
```

---

## 📊 Workflow: From Discovery → Active Tracking

### Step 1: Run Discovery (Automatic)
Discovery runs **every 6 hours** automatically. You can also trigger it manually:

**Via Dashboard:**
1. Go to http://localhost:3000
2. Click the **"Discovery" tab**
3. Click **"Run Discovery"** button

**Via API:**
```bash
curl -X POST http://localhost:3000/api/discover
```

### Step 2: Review Discovered Wallets
In the dashboard, you'll see discovered wallets with:
- ✅ **Profitability Score** (0-100)
- ✅ **Estimated Win Rate**
- ✅ **Discovery Method**
- ✅ **How they were found**

### Step 3: Promote Best Wallets
Click **"Promote"** on wallets with:
- Score **70+** = Excellent
- Score **60-69** = Very Good (worth trying)
- Score **50-59** = Good (test carefully)
- Score **<50** = Skip or observe longer

### Step 4: Monitor Performance
- Promoted wallets enter "active tracking"
- Paper trading engine tests them with real money simulation
- Poor performers are automatically paused/demoted
- Good performers stay active

---

## 🎮 Quick Start Commands

### Check Current Wallets
```bash
# See all active wallets
curl http://localhost:3000/api/wallets

# See discovered wallets (not yet promoted)
curl http://localhost:3000/api/discovered?promoted=false
```

### Manually Add a Wallet (If you find a good one)
```bash
curl -X POST http://localhost:3000/api/wallets \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234...",
    "chain": "ethereum",
    "strategy_type": "whale",
    "notes": "Found via Twitter"
  }'
```

### Promote a Discovered Wallet
```bash
curl -X POST http://localhost:3000/api/discovered/0xADDRESS/promote
```

---

## 📈 Expected Growth Timeline

### Conservative Approach (Current Settings)
- **Week 1**: 31 wallets → 35 wallets (+5 per day × 7 = 35 discovered, promote top 4)
- **Month 1**: 31 → 50 wallets
- **Month 3**: 31 → 100 wallets
- **Month 6**: 31 → 200 wallets

### Aggressive Approach (dailyLimit = 25)
- **Week 1**: 31 wallets → 50+ wallets
- **Month 1**: 31 → 150 wallets
- **Month 3**: 31 → 500+ wallets
- **Month 6**: 31 → 1000+ wallets tracked

---

## 🛡️ Quality Control

### Automatic Filtering
Your system automatically:
- ✅ Scores wallets (0-100)
- ✅ Tracks performance after promotion
- ✅ Pauses wallets if they go -15% over 14 days
- ✅ Demotes after 10 consecutive losses

### Manual Oversight
You should:
1. **Review weekly**: Check discovered wallets, promote the best
2. **Monitor dashboard**: Watch for wallets with declining performance
3. **Adjust thresholds**: If getting too many low-quality wallets, raise minimums

---

## ⚠️ Rate Limit Considerations

### With Current Fix (5s delays)
You can comfortably track:
- **Up to 50 wallets**: ~4 minutes per tracking cycle
- **Up to 100 wallets**: ~8 minutes per tracking cycle
- **Up to 200 wallets**: ~16 minutes per tracking cycle

Since tracking runs **every 10 minutes**, you're safe up to ~200 wallets with current delays.

### If You Hit Limits Again
1. Increase wallet delays (5s → 7s)
2. Increase chain delays (5s → 10s)
3. Reduce tracking frequency (10 min → 15 min)
4. Use paid RPC endpoints (Helius, QuickNode, Alchemy)

---

## 🎯 Recommended Action Plan

### **This Week:**
1. Edit `config/config.js` → increase `dailyLimit` from 5 to 15
2. Let discovery run for 7 days
3. Check dashboard daily, promote wallets with score 65+
4. Target: **Add 20 new wallets this week**

### **Next 30 Days:**
1. Monitor system performance and rate limits
2. If stable, lower thresholds in Phase 2
3. Target: **Add 100 new wallets this month**

### **Month 2-3:**
1. Implement aggressive settings (Phase 3)
2. Consider paid RPC endpoints for better reliability
3. Target: **Build portfolio of 200-300 tracked wallets**

---

## 💡 Pro Tips

1. **Quality > Quantity**: Don't promote every discovered wallet. Only promote score 60+
2. **Diversify chains**: Make sure you're discovering wallets across all chains (ETH, SOL, Base, Arb)
3. **Test in waves**: Promote 10-20 wallets, observe for a week, then promote more
4. **Track metrics**: Watch overall portfolio win rate. If it drops, raise thresholds
5. **Manual finds**: If you find a successful wallet on Twitter/Discord, you can add it manually

---

## 🚀 Ready to Scale?

**Run this now to increase discovery to 15/day:**
```bash
echo "DISCOVERY_DAILY_LIMIT=15" >> .env
```

Then restart your server and check the Discovery tab in the dashboard!

