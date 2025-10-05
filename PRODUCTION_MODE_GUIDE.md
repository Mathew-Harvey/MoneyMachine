# 🏭 Production Mode Guide - Unsupervised Operation

**Last Updated**: October 5, 2025  
**Mode**: BALANCED PRODUCTION (Ready for multi-week unsupervised operation)

---

## 🎯 Overview

Your system is now configured for **unsupervised production operation** with:
- ✅ Balanced strategy thresholds (not too aggressive, not too restrictive)
- ✅ Active risk management with automatic pauses
- ✅ Weekly and daily loss limits
- ✅ Maximum position caps
- ✅ Conservative position sizing
- ✅ Tighter stop losses

---

## 📊 Configuration Summary

### Strategy Thresholds (BALANCED)

| Strategy | Min Trade | Win Rate Req | Max Position | Max Concurrent | Stop Loss |
|----------|-----------|--------------|--------------|----------------|-----------|
| **CopyTrade** | $50 | 50% | $200 | 15 | 12% |
| **VolumeBreakout** | — | — | $150 | 10 | 15% |
| **SmartMoney** | $2,000 | — | $250 | 8 | 10% |
| **Arbitrage** | $250 | 50% | $200 | 8 | 8% |
| **Memecoin** | — | 35% | $100 | 12 | 40% |
| **EarlyGem** | — | 50% | $75 | 6 | 25% |

**Key Changes from Test Mode:**
- ✅ Minimum trade sizes increased (was $10-100, now $50-2000)
- ✅ Win rate requirements increased (was 25-40%, now 35-50%)
- ✅ Max concurrent trades reduced (better risk control)
- ✅ Position sizes reduced by 20-33%
- ✅ Stop losses tightened by 20-40%

---

## 🛡️ Risk Management (ACTIVE PROTECTION)

### Automatic Trading Pauses

The system will **automatically pause all trading** if:

1. **Drawdown > 20%** - System pauses until manually reviewed
2. **Daily Loss > 3%** - No new trades for 24 hours
3. **Weekly Loss > 8%** - No new trades for 7 days
4. **Open Positions ≥ 40** - No new trades until some close
5. **Individual Wallet Down 12%** - Wallet paused automatically
6. **Strategy Down 15%** - Strategy paused automatically

**These are HARD LIMITS that protect your capital while you're away.**

---

### Risk Limits Summary

| Limit Type | Threshold | Action | Recovery |
|------------|-----------|--------|----------|
| **Max Drawdown** | 20% | Pause all trading | Manual review required |
| **Daily Loss** | 3% of capital | Pause for 24h | Auto-resumes next day |
| **Weekly Loss** | 8% of capital | Pause for 7 days | Auto-resumes after 7 days |
| **Position Size** | 12% of capital | Reject trade | Automatic |
| **Open Positions** | 40 total | Reject new trades | Automatic when <40 |
| **Correlation** | 25% max | Reject correlated | Automatic |

---

### Position Management

**Conservative Sizing:**
- Each trade limited to 12% of capital (was 15%)
- Copy only 8% of original trade size (was 10%)
- Maximum 40 open positions across all strategies

**Tighter Stops:**
- CopyTrade: 12% stop loss (was 15%)
- SmartMoney: 10% stop loss (unchanged - already tight)
- Arbitrage: 8% stop loss (unchanged - already tight)
- Memecoin: 40% stop loss (was 50%)
- EarlyGem: 25% stop loss (was 30%)

**Earlier Profit Taking:**
- CopyTrade: Take profit at 40% (was 50%)
- VolumeBreakout: Take profit at 60% (was 75%)
- SmartMoney: Take profit at 35% (was 40%)
- Arbitrage: Take profit at 20% (was 25%)

---

## 🔍 Discovery Settings (BALANCED)

**Conservative Discovery:**
- Daily limit: **15 wallets/day** (was 25)
- Min trade history: **15 trades** (was 10)
- Min win rate: **55%** (was 52%)
- Min profitability: **$3,000** (was $2,000)
- Pump threshold: **2.5x** (was 2x)
- Timeframe: **10 days** (was 14)

**Result:** Discovery will be more selective, only adding high-quality wallets.

---

## 🚀 Starting Up for Unsupervised Operation

### Pre-Flight Checklist

```bash
# 1. Verify configuration
cat config/config.js | grep "BALANCED PRODUCTION MODE"
# Should see: "BALANCED PRODUCTION MODE (Unsupervised operation)"

# 2. Check system health
curl http://localhost:3000/api/health
# Should return: { "status": "ok", "initialized": true }

# 3. Verify risk limits are active
curl http://localhost:3000/api/dashboard | jq '.performance'
# Should show current capital and P&L

# 4. Check wallet count
curl http://localhost:3000/api/wallets | jq 'length'
# Should show ~30 active wallets

# 5. Clear old logs (optional)
rm logs/tracker-*.log
rm logs/error-*.log
```

### Starting the System

**Option 1: PM2 (Recommended for Production)**
```bash
# Install PM2 if not already
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Verify running
pm2 status

# Set up auto-restart on system reboot
pm2 startup
pm2 save
```

**Option 2: npm start (Development)**
```bash
npm start
```

**Option 3: Background Process (Linux/Mac)**
```bash
nohup npm start > logs/output.log 2>&1 &
```

---

## 📈 Expected Performance (Unsupervised)

### Daily Activity
- **Transactions Tracked**: 50-150/day
- **Trades Executed**: 3-15/day
- **Trade Rejection Rate**: 70-85% (normal)
- **Open Positions**: 10-30 average

### Weekly Expectations
- **Total Trades**: 20-100/week
- **Win Rate Target**: 45-55%
- **Expected Drawdown**: 5-15% (normal volatility)
- **Capital Deployed**: 30-60% of total

### Monthly Goals
- **Profitability**: Break-even to +10%
- **Data Collection**: 100+ closed trades
- **Strategy Refinement**: Identify winners/losers
- **Wallet Curation**: Remove underperformers

---

## 🔔 Monitoring & Alerts

### What to Check Daily (5 minutes)

```bash
# Quick status check
curl http://localhost:3000/api/dashboard | jq '{
  totalTrades: .performance.totalTrades,
  winRate: .performance.winRate,
  currentPnL: .performance.totalPnl,
  openTrades: .openTrades | length
}'
```

Expected output:
```json
{
  "totalTrades": 45,
  "winRate": 0.48,
  "currentPnL": -125.50,
  "openTrades": 12
}
```

**Red Flags:**
- ⚠️ Win rate <40% for 7+ days
- ⚠️ Open trades >35
- ⚠️ PnL down >15%
- ⚠️ No trades executed in 24h (may indicate issue)

---

### What to Check Weekly (15 minutes)

```bash
# 1. Strategy breakdown
curl http://localhost:3000/api/dashboard | jq '.strategyBreakdown'

# 2. Wallet activity
curl http://localhost:3000/api/wallets/activity | jq '.summary'

# 3. Risk status (if you add endpoint later)
# curl http://localhost:3000/api/risk/status

# 4. Check logs for errors
tail -100 logs/error-$(date +%Y-%m-%d).log
```

**Actions to Take:**
- Disable strategies with win rate <35% after 20+ trades
- Remove wallets with 0 activity for 14+ days
- Promote high-performing discovered wallets
- Tighten thresholds on profitable strategies

---

### Setting Up Email/SMS Alerts (Optional)

Create a monitoring script `monitor.sh`:

```bash
#!/bin/bash

# Check if system is still running
if ! pm2 status | grep -q "online"; then
  # Send alert (configure your email/SMS service)
  echo "MoneyMachine is DOWN!" | mail -s "ALERT" your@email.com
fi

# Check for significant loss
CURRENT_PNL=$(curl -s http://localhost:3000/api/dashboard | jq '.performance.totalPnl')
if [ $(echo "$CURRENT_PNL < -1000" | bc) -eq 1 ]; then
  echo "MoneyMachine PnL is below -$1000: $CURRENT_PNL" | mail -s "ALERT" your@email.com
fi
```

Schedule with cron:
```bash
crontab -e
# Add:
0 */6 * * * /path/to/monitor.sh  # Check every 6 hours
```

---

## 🛠️ Maintenance Tasks

### Daily (Automated)
- ✅ Track wallets (every 1 minute)
- ✅ Manage positions (every 2 minutes)
- ✅ Update performance (every 15 minutes)
- ✅ Run discovery (every 6 hours)

### Weekly (Manual - 30 minutes)
1. Review strategy performance
2. Check wallet activity
3. Promote discovered wallets with score >70
4. Remove inactive wallets
5. Review rejection logs for patterns
6. Backup database: `cp data/trading.db data/backup-$(date +%Y%m%d).db`

### Monthly (Manual - 2 hours)
1. Deep analysis of all closed trades
2. Identify winning patterns
3. Optimize strategy parameters
4. Rebalance strategy allocations
5. Update wallet quality scores
6. Plan next month's adjustments

---

## 🚨 Emergency Procedures

### System is Down
```bash
# Check PM2 status
pm2 status

# View recent logs
pm2 logs --lines 50

# Restart
pm2 restart moneymachine

# If that fails, stop and start fresh
pm2 delete moneymachine
pm2 start ecosystem.config.js
```

### Too Many Losses
```bash
# Option 1: Enable emergency stop (pauses all trading)
curl -X POST http://localhost:3000/api/emergency-stop

# Option 2: Stop the system entirely
pm2 stop moneymachine

# Option 3: Lower position sizes in config.js
# Edit: maxPerTrade values (reduce by 50%)
# Then restart: pm2 restart moneymachine
```

### Running Out of Capital
The system automatically stops when:
- Available capital < $500
- Can't meet minimum position sizes

**Recovery:**
1. Close unprofitable positions manually
2. Reduce maxPerTrade in config.js
3. Pause riskiest strategies (memecoin, earlyGem)

---

## 📊 Performance Baselines

### Acceptable Performance (First Month)
- Win Rate: **40-50%** ✅
- Total Return: **-5% to +10%** ✅
- Max Drawdown: **<15%** ✅
- Trades/Day: **3-15** ✅
- System Uptime: **>95%** ✅

### Good Performance (After 2-3 Months)
- Win Rate: **50-60%** 🎯
- Total Return: **+10% to +25%** 🎯
- Max Drawdown: **<10%** 🎯
- Trades/Day: **5-20** 🎯
- Strategy Refinement: **Identified winners** 🎯

### Exceptional Performance (After 6+ Months)
- Win Rate: **60%+** 🏆
- Total Return: **+25%+** 🏆
- Max Drawdown: **<8%** 🏆
- Sharpe Ratio: **>1.5** 🏆
- Automated Optimization: **Self-tuning** 🏆

---

## 🔧 Tuning After Data Collection

Once you have 100+ closed trades (2-4 weeks), analyze and tune:

### Identify Winners
```bash
# Check strategy performance
curl http://localhost:3000/api/dashboard | jq '.strategyBreakdown | 
  to_entries | 
  sort_by(.value.winRate) | 
  reverse'
```

### Optimization Path

**For Profitable Strategies (>50% win rate):**
1. Increase allocation by 20-30%
2. Gradually tighten entry requirements
3. Optimize take-profit levels
4. Increase max concurrent trades

**For Break-Even Strategies (45-50% win rate):**
1. Keep current settings
2. Continue monitoring
3. Small tweaks to improve edge

**For Losing Strategies (<45% win rate):**
1. Reduce allocation by 50%
2. Tighten entry requirements significantly
3. Consider pausing if <40% after 50+ trades

---

## 💡 Best Practices for Unsupervised Operation

### ✅ DO:
- Check system health every 1-3 days
- Review performance weekly
- Keep database backups
- Monitor for errors in logs
- Trust the risk management system
- Let strategies run long enough to collect data (50+ trades minimum)

### ❌ DON'T:
- Constantly adjust parameters (let data accumulate)
- Panic on temporary drawdowns (<10%)
- Disable risk limits "just to see"
- Add too many wallets too quickly
- Chase losses by increasing position sizes
- Disable strategies with <20 trades

---

## 📈 Growth Strategy

### Month 1: Stability & Data
- Goal: Break-even, collect 100+ trades
- Focus: System stability, no crashes
- Action: Minimal tuning, trust the process

### Month 2-3: Optimization
- Goal: +5% to +15%, refine strategies
- Focus: Identify winning patterns
- Action: Disable losers, boost winners

### Month 4-6: Scaling
- Goal: +15% to +30%, consistent profits
- Focus: Add capital, scale winners
- Action: Increase allocations on proven strategies

### Month 6+: Automation
- Goal: Self-optimizing system
- Focus: Advanced analytics, pattern recognition
- Action: Build predictive models, reduce manual intervention

---

## 🎯 Success Metrics

Track these monthly:

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Total Trades | 100+ | 300+ | 600+ |
| Win Rate | 45%+ | 50%+ | 55%+ |
| Sharpe Ratio | 0.5+ | 1.0+ | 1.5+ |
| Max Drawdown | <15% | <12% | <10% |
| Profitable Strategies | 3+ | 4+ | 5+ |
| System Uptime | 95%+ | 98%+ | 99%+ |

---

## 📞 Quick Reference

```bash
# Start system
pm2 start ecosystem.config.js

# Check status
curl http://localhost:3000/api/health

# Daily check (5 min)
curl http://localhost:3000/api/dashboard | jq '.performance'

# Weekly review (15 min)
curl http://localhost:3000/api/wallets/activity | jq '.summary'

# Emergency stop
pm2 stop moneymachine

# View logs
pm2 logs moneymachine --lines 100

# Backup database
cp data/trading.db data/backup-$(date +%Y%m%d).db
```

---

## 🏁 Ready to Go!

Your system is now configured for **multi-week unsupervised operation** with:

✅ Balanced thresholds (not too aggressive, not too restrictive)  
✅ Active risk management (auto-pause on losses)  
✅ Conservative position sizing (protect capital)  
✅ Quality discovery (only add proven wallets)  
✅ Emergency safeguards (hard limits on losses)

**Start the system, check in every few days, and let it run!**

The risk management system will protect your capital while you're away. After 2-4 weeks, you'll have enough data to optimize based on real performance.

---

**Last Updated**: October 5, 2025  
**Configuration**: BALANCED PRODUCTION MODE  
**Status**: ✅ READY FOR UNSUPERVISED OPERATION

Good luck! 🚀

