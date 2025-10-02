# 🚀 Quick Start Guide

Get up and running in 3 minutes!

## Step 1: Install Dependencies (30 seconds)

```bash
npm install
```

## Step 2: Initialize Database (10 seconds)

```bash
npm run init-db
```

This creates the SQLite database and seeds 30 profitable wallets.

## Step 3: Start the Server (5 seconds)

**Recommended: Start with Mock Mode** to avoid rate limits:

```bash
MOCK_MODE=true npm start
```

Or for real API calls (may hit rate limits with free RPCs):

```bash
npm start
```

## Step 4: Open Dashboard (5 seconds)

Open your browser to: **http://localhost:3000**

---

## 🎉 You're Done!

The system is now:
- ✅ Tracking 30 wallets across Ethereum, Solana, Base, and Arbitrum
- ✅ Running paper trading with $10,000 capital
- ✅ Discovering new profitable wallets automatically
- ✅ Updating performance metrics in real-time

## 📊 What You'll See

### Dashboard Tab
- Total P&L and ROI
- Strategy performance breakdown
- Top performing wallets
- Recent transactions

### Wallets Tab
- All 30 tracked wallets
- Win rates and profitability
- Status (active/paused)

### Trades Tab
- All paper trades
- Open and closed positions
- Entry/exit prices and P&L

### Discovered Tab
- Newly found profitable wallets
- Promotion candidates

## 🎮 What Happens Next?

The system runs automatically (optimized to avoid rate limits):

| Every 10 minutes | Track wallet activity |
| Every 15 minutes | Update performance metrics |
| Every 6 hours | Discover new wallets |
| Every 5 minutes | Manage open positions |

**Note**: Timing is conservative to work with free public RPCs. With your own API keys, you can increase frequency.

## ⚙️ Optional Configuration

### Add API Keys (Better Rate Limits)

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your API keys:
```
ETHERSCAN_API_KEY=your_key_here
HELIUS_API_KEY=your_key_here
```

### Enable Mock Mode (Recommended for Testing)

**Mock mode is now enabled by default!** This avoids rate limits.

To explicitly enable/disable in `.env`:
```
MOCK_MODE=true   # No API calls, generates fake data
MOCK_MODE=false  # Real API calls (requires good RPCs)
```

Mock mode generates realistic fake data so you can test all features without hitting rate limits.

## 🔍 First Actions to Try

1. **Watch the Dashboard Update**
   - Wait 2 minutes for first tracking cycle
   - See transactions appear in real-time

2. **Run Manual Discovery**
   - Go to "Discovered" tab
   - Click "Run Discovery Now"
   - See newly found wallets

3. **Filter Wallets**
   - Go to "Wallets" tab
   - Filter by strategy (Arbitrage/Memecoin/Early Gem)
   - Filter by chain (Ethereum/Solana/Base/Arbitrum)

4. **View Trades**
   - Go to "Trades" tab
   - See paper trades as they happen
   - Watch P&L update live

## 🐛 Troubleshooting

### Port Already in Use?
```bash
PORT=3001 npm start
```

### Database Issues?
```bash
rm -rf data/
npm run init-db
```

### No Transactions Showing?
- The system may be in the first tracking cycle (wait 10 minutes)
- Mock mode should generate transactions every 30 seconds
- Check if you disabled mock mode without API keys

### Getting 429 Rate Limit Errors?
- **Solution**: Enable mock mode: `MOCK_MODE=true npm start`
- Or add your own RPC endpoints with API keys
- See [RATE_LIMITS.md](RATE_LIMITS.md) for details

## 📚 Need More Help?

- Read the full [README.md](README.md)
- Check the [API documentation](README.md#-api-endpoints)
- Review [configuration options](README.md#-configuration)

## 💡 Pro Tips

1. **Let it Run**: The longer the system runs, the more data it collects
2. **Watch Patterns**: Notice which strategies perform best
3. **Promote Winners**: Manually promote discovered wallets with high scores
4. **Monitor Edge**: Check the wallet heat map to see who's hot

---

**Enjoy tracking crypto alpha! 🚀💎**

Questions? Check the main README or review the code - it's heavily commented!

