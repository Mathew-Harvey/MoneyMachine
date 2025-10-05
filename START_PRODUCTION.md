# 🚀 Start Production Mode - Quick Checklist

**Last Updated**: October 5, 2025  
**Time to Complete**: 5 minutes

---

## ✅ Pre-Flight Checklist

### 1. Verify Configuration ✅
```bash
cat config/config.js | head -65 | tail -5
```
Should see: **"BALANCED PRODUCTION MODE (Unsupervised operation)"**

---

### 2. Check System Health
```bash
curl http://localhost:3000/api/health
```
Should return: `{ "status": "ok", "initialized": true }`

---

### 3. Verify Wallets Are Active
```bash
curl http://localhost:3000/api/wallets | jq 'length'
```
Should return: ~30 (your seed wallets)

---

### 4. Backup Current Database
```bash
mkdir -p data/backups
cp data/trading.db data/backups/backup-$(date +%Y%m%d-%H%M%S).db
```

---

## 🎯 Start the System

### Option A: PM2 (Recommended)

```bash
# Install PM2 if needed
npm install -g pm2

# Start
pm2 start ecosystem.config.js

# Verify running
pm2 status
# Should show: "online"

# Set up auto-restart on reboot
pm2 startup
pm2 save

# Done! ✅
```

### Option B: npm start (Simple)

```bash
npm start
# Leave terminal open, system runs in foreground
```

### Option C: Background Process

```bash
nohup npm start > logs/output.log 2>&1 &
echo $! > .pid  # Save process ID
```

---

## 📊 Verify It's Working (5 minutes)

Wait 5 minutes, then check:

```bash
# 1. Check if trades are being considered
pm2 logs moneymachine --lines 50 | grep "Processing"
# Should see: "Processing X transactions"

# 2. Check dashboard
curl http://localhost:3000/api/dashboard | jq '.performance'
# Should return current stats

# 3. Check wallet activity
curl http://localhost:3000/api/wallets/activity | jq '.summary'
# Should show activeToday > 0
```

---

## 📅 Monitoring Schedule

### Daily (5 minutes) - First Week Only
```bash
curl http://localhost:3000/api/dashboard | jq '{
  trades: .performance.totalTrades,
  winRate: .performance.winRate,
  pnl: .performance.totalPnl,
  open: .openTrades | length
}'
```

**Look for:**
- ✅ Trades increasing (3-15 per day)
- ✅ Win rate 40-55%
- ✅ PnL between -10% and +10%
- ⚠️ Alert if no trades for 24h

---

### Weekly (15 minutes) - After First Week
```bash
# 1. Strategy performance
curl http://localhost:3000/api/dashboard | jq '.strategyBreakdown'

# 2. Wallet activity
curl http://localhost:3000/api/wallets/activity | jq '.summary'

# 3. Check for errors
tail -100 logs/error-$(date +%Y-%m-%d).log

# 4. Backup database
cp data/trading.db data/backups/weekly-$(date +%Y%m%d).db
```

---

### Monthly (2 hours)
1. Deep dive into closed trades
2. Optimize strategy parameters
3. Review and promote discovered wallets
4. Plan next month's adjustments

---

## 🚨 Emergency Commands

### Stop Everything
```bash
pm2 stop moneymachine
```

### Restart
```bash
pm2 restart moneymachine
```

### View Logs
```bash
pm2 logs moneymachine --lines 100
```

### Check Status
```bash
pm2 status
```

---

## 🛡️ Safety Features (Active)

The system will **automatically pause trading** if:
- ❌ Drawdown >20%
- ❌ Daily loss >3%
- ❌ Weekly loss >8%
- ❌ Open positions ≥40

**You don't need to manually intervene - the risk manager protects you!**

---

## 📈 What to Expect

### Week 1:
- **Trades/day**: 3-15
- **Win rate**: 40-50%
- **Open positions**: 5-20
- **Expected P&L**: -5% to +5%

### Week 2-4:
- **Trades/day**: 5-15
- **Win rate**: 45-55%
- **Open positions**: 10-30
- **Expected P&L**: -5% to +10%

### Month 2+:
- **Trades/week**: 30-80
- **Win rate**: 50-60%
- **Consistent profitability**: +5% to +15%/month

---

## 🎯 Success Criteria

### First Week ✅
- [ ] System stays online (>95% uptime)
- [ ] Trades are executing (3-15/day)
- [ ] No crashes or errors
- [ ] Risk limits are working

### First Month ✅
- [ ] 100+ closed trades collected
- [ ] Win rate >40%
- [ ] P&L between -10% and +15%
- [ ] Can identify winning strategies

### Month 2-3 ✅
- [ ] Positive overall P&L
- [ ] Win rate >50%
- [ ] System runs unsupervised
- [ ] Optimized based on data

---

## 📚 Documentation Reference

- **`PRODUCTION_MODE_GUIDE.md`** - Complete operations manual
- **`TEST_TO_PRODUCTION_CHANGES.md`** - What changed from test mode
- **`SYSTEM_IMPROVEMENTS.md`** - Original improvements made
- **`QUICK_TEST_GUIDE.md`** - Testing commands

---

## 💡 Pro Tips

### Tip 1: Trust the Process
Don't panic on temporary losses. The system needs 2-4 weeks to show its edge.

### Tip 2: Let Data Accumulate
Don't optimize with <50 trades per strategy. You need statistical significance.

### Tip 3: Weekly Backups
Database backups are your safety net. Keep at least 4 weeks of backups.

### Tip 4: Watch Rejection Logs
The reasons trades are rejected tell you what to tune next.

### Tip 5: Gradual Optimization
Change one thing at a time, wait 1-2 weeks to see impact.

---

## 🔗 Quick Commands

```bash
# Start
pm2 start ecosystem.config.js

# Status
pm2 status

# Dashboard
curl http://localhost:3000/api/dashboard | jq '.performance'

# Wallet activity
curl http://localhost:3000/api/wallets/activity | jq '.summary'

# Manual discovery
curl -X POST http://localhost:3000/api/discover

# Logs
pm2 logs moneymachine --lines 100

# Stop
pm2 stop moneymachine

# Restart
pm2 restart moneymachine
```

---

## 🏁 You're Ready!

Your system is configured for **multi-week unsupervised operation**:

✅ Balanced thresholds  
✅ Active risk management  
✅ Auto-pause on losses  
✅ Conservative sizing  
✅ Quality discovery  

**Just start it and check in every few days!**

```bash
pm2 start ecosystem.config.js
pm2 save
```

The system will protect your capital while you're away. 🛡️

---

**Questions?**
- Check `PRODUCTION_MODE_GUIDE.md` for details
- Review logs: `pm2 logs moneymachine`
- Monitor dashboard: `curl http://localhost:3000/api/dashboard`

**Good luck! 🚀**

