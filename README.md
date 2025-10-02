# 💰 MoneyMaker

**MoneyMaker** - A complete full-stack application that tracks 30 profitable wallets across multiple blockchain strategies, discovers new profitable wallets automatically, and simulates paper trading with $10,000 starting capital.

## 🚀 Features

### Core Functionality
- **Multi-Chain Tracking**: Monitor wallets across Ethereum, Solana, Base, and Arbitrum
- **30 Pre-Seeded Wallets**: Curated profitable wallets across 3 strategies
- **Auto Discovery**: Automatically finds 10 new profitable wallets per day
- **Paper Trading Engine**: Simulates trades with $10,000 capital
- **Adaptive Strategies**: Auto-adjusts which wallets to follow based on performance

### Wallet Categories

#### Stable/Arbitrage (Ethereum) - $4k allocation
- 10 wallets doing DEX arbitrage, MEV, and DeFi farming
- Target: 20-50% monthly returns with low volatility
- Conservative stop loss (5%), take profit at 20%

#### Memecoin Degen (Solana) - $3k allocation
- 10 wallets that caught BONK/WIF/POPCAT early
- Target: 10x+ wins with high risk/reward
- Tiered take profits: 50% at 2x, 30% at 10x, 20% at 100x

#### Early Gems (Base/Arbitrum) - $2k allocation
- 10 wallets finding sub-24h tokens before they pump
- Target: High hit rate on new launches
- Only follows wallets with >70% win rate

#### Discovery Reserve - $1k allocation
- For testing newly discovered wallets

### Advanced Features

- **Smart Copying Logic**: Different rules per strategy
- **Risk Management**: Position sizing, stop losses, correlation limits
- **Performance Tracking**: Real-time P&L, win rates, Sharpe ratios
- **Edge Detection**: Identifies when wallets lose their edge
- **Wallet Clustering**: Groups similar wallets, detects coordinated buying
- **Auto-Rebalancing**: Shifts allocation to best-performing strategies

## 📁 Project Structure

```
multi-chain-alpha-tracker/
├── backend/
│   ├── server.js                    # Express server
│   ├── database.js                  # SQLite database manager
│   │
│   ├── trackers/
│   │   ├── ethWhaleTracker.js       # Ethereum wallet tracker
│   │   ├── solMemeTracker.js        # Solana memecoin tracker
│   │   ├── baseGemTracker.js        # Base/Arbitrum gem tracker
│   │   └── universalTracker.js      # Coordinates all trackers
│   │
│   ├── discovery/
│   │   ├── walletDiscovery.js       # Finds new profitable wallets
│   │   ├── walletScoring.js         # Ranks wallets by performance
│   │   └── clusterAnalysis.js       # Groups similar strategies
│   │
│   ├── strategies/
│   │   ├── arbitrageStrategy.js     # Conservative gains strategy
│   │   ├── memeStrategy.js          # High risk/reward strategy
│   │   ├── earlyGemStrategy.js      # New token strategy
│   │   └── adaptiveStrategy.js      # Market-adaptive strategy
│   │
│   ├── trading/
│   │   ├── paperTradingEngine.js    # Simulates trading
│   │   ├── riskManager.js           # Position sizing & limits
│   │   └── exitStrategy.js          # Exit management
│   │
│   └── analysis/
│       ├── performanceTracker.js    # Track success rates
│       └── edgeDetector.js          # Detect edge loss
│
├── frontend/
│   ├── index.html                   # Main dashboard
│   ├── dashboard.js                 # Dashboard logic
│   ├── walletExplorer.js            # Wallet browsing
│   └── styles.css                   # Modern UI styles
│
├── config/
│   ├── config.js                    # Configuration & RPC endpoints
│   └── walletSeeds.js               # Initial 30 wallets
│
├── data/
│   └── tracker.db                   # SQLite database (created on init)
│
├── init.sql                         # Database schema
├── package.json                     # Dependencies
└── README.md                        # This file
```

## 🚀 Quick Links

- **📖 [Production Deployment Guide](PRODUCTION_GUIDE.md)** - Complete production setup
- **🔄 [Production Changes Summary](PRODUCTION_CHANGES.md)** - What's new in production
- **⚡ [Quick Start Guide](QUICKSTART.md)** - Get started in 3 minutes

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 16+ installed
- npm or yarn package manager
- API keys for production use (see [Production Guide](PRODUCTION_GUIDE.md))

### Step 1: Install Dependencies

```bash
npm install
```

This installs:
- `express` - Web server
- `cors` - CORS handling
- `sqlite3` - Database
- `axios` - HTTP requests
- `ethers` - Ethereum interaction
- `@solana/web3.js` - Solana interaction
- `node-cron` - Background jobs
- `dotenv` - Environment variables

### Step 2: Initialize Database

```bash
npm run init-db
```

This will:
1. Create the SQLite database at `data/tracker.db`
2. Set up all tables (wallets, transactions, trades, etc.)
3. Seed the 30 initial wallets across 3 strategies
4. Initialize system state

### Step 3: Start the Server

**⚠️ Important: Start with Mock Mode** to avoid rate limits:

```bash
MOCK_MODE=true npm start
```

The server will start on `http://localhost:3000`

**Note**: Public RPCs have strict rate limits. Mock mode generates realistic fake data without API calls. Perfect for testing! See [RATE_LIMITS.md](RATE_LIMITS.md) for details.

You should see:
```
🚀 Initializing Multi-Chain Alpha Tracker...
✓ Database connected
✓ Database schema initialized
✓ All systems initialized successfully!

╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Multi-Chain Alpha Tracker is RUNNING                 ║
║                                                            ║
║   📊 Dashboard: http://localhost:3000                     ║
║   🔌 API: http://localhost:3000/api                       ║
║                                                            ║
║   💰 Starting Capital: $10,000                            ║
║   📈 Tracking: 30 wallets across 3 strategies             ║
║   🔍 Auto-discovery: ENABLED                              ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

### Step 4: Access the Dashboard

Open your browser to:
```
http://localhost:3000
```

## 🎮 Usage Guide

### Dashboard Overview

The dashboard shows:
- **Performance Overview**: Total P&L, ROI, win rate
- **Strategy Breakdown**: Performance by strategy (pie chart)
- **Top Wallets**: Best performing wallets
- **Recent Transactions**: Latest wallet activity
- **Open Positions**: Currently active paper trades

### Tabs

#### 📊 Dashboard Tab
- Real-time portfolio performance
- Strategy comparison
- Top 5 performing wallets
- Recent transaction feed

#### 👛 Wallets Tab
- View all tracked wallets
- Filter by strategy or chain
- See individual wallet performance
- Pause/resume wallets

#### 💸 Trades Tab
- View all paper trades
- Filter by status (open/closed)
- See P&L for each trade
- Track entry/exit prices

#### 🔍 Discovered Tab
- See newly discovered wallets
- View profitability scores
- Promote wallets to main tracking
- Run manual discovery

### Background Jobs

The system runs automatic background jobs (optimized to avoid rate limits):

- **Every 10 minutes**: Track all active wallets (with 2s delays between wallets)
- **Every 6 hours**: Discover new profitable wallets
- **Every 15 minutes**: Update performance metrics
- **Every 5 minutes**: Manage open positions (check exits)

**Note**: Timing is conservative to work with free public RPCs. With your own API keys, you can increase frequency in `backend/server.js`.

## 🔧 Configuration

### RPC Endpoints

Edit `config/config.js` to customize RPC endpoints:

```javascript
rpc: {
  ethereum: [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    // Add your own RPCs here
  ],
  solana: [
    'https://api.mainnet-beta.solana.com',
    // Add Helius endpoint if you have API key
  ],
  // ... other chains
}
```

### API Keys (Optional but Recommended)

Add API keys to `.env` for better rate limits:

```bash
ETHERSCAN_API_KEY=your_key_here
SOLSCAN_API_KEY=your_key_here
BASESCAN_API_KEY=your_key_here
ARBISCAN_API_KEY=your_key_here
HELIUS_API_KEY=your_key_here
ALCHEMY_API_KEY=your_key_here
```

### Strategy Parameters

Customize strategy parameters in `config/config.js`:

```javascript
strategies: {
  arbitrage: {
    allocation: 4000,
    maxPerTrade: 500,
    stopLoss: 0.05,
    takeProfit: 0.20,
    // ... more params
  },
  // ... other strategies
}
```

### Discovery Settings

Adjust discovery parameters:

```javascript
discovery: {
  enabled: true,
  dailyLimit: 10,              // Max new wallets per day
  minWinRate: 0.60,            // Minimum 60% win rate
  pumpThreshold: 5,            // Must have 5x pumps
  // ... more params
}
```

## 📊 API Endpoints

### Dashboard
- `GET /api/dashboard` - Complete dashboard data
- `GET /api/stats` - System statistics

### Wallets
- `GET /api/wallets` - Get all wallets
- `GET /api/wallets/:address` - Get wallet details
- `POST /api/wallets/:address/status` - Update wallet status

### Trades
- `GET /api/trades` - Get all paper trades
- `GET /api/trades?status=open` - Filter by status
- `GET /api/trades?strategy=memecoin` - Filter by strategy

### Discovery
- `GET /api/discovered` - Get discovered wallets
- `POST /api/discover` - Manually trigger discovery
- `POST /api/discovered/:address/promote` - Promote wallet

### Manual Actions
- `POST /api/track` - Manually trigger wallet tracking
- `GET /api/strategy/:strategy` - Get strategy performance

## 🎯 Strategy Breakdown

### Arbitrage Strategy (Conservative)
```javascript
- Copy if profit opportunity >2%
- Stop loss: 5%
- Take profit: 20%
- Trailing stop: 10% after 15% gain
- Max 10 concurrent positions
```

### Memecoin Strategy (High Risk)
```javascript
- Copy if 2+ tracked wallets buy within 1 hour
- Stop loss: 50%
- Tiered exits:
  * Sell 50% at 2x
  * Sell 30% at 10x  
  * Sell 20% at 100x
- Max hold time: 72 hours
```

### Early Gem Strategy (Selective)
```javascript
- Copy if token <24h old AND wallet >70% win rate
- Stop loss: 30%
- Take profit: 3x (sell 70%, let 30% ride to 5x)
- Min liquidity: $50k
```

## 🔍 Wallet Discovery Algorithm

The system discovers new wallets by:

1. **Finding Pumping Tokens**
   - Scans for tokens that pumped >5x in last 7 days

2. **Identifying Early Buyers**
   - Finds wallets that bought in bottom 20% of price

3. **Analyzing History**
   - Checks wallet has >20 historical trades
   - Calculates win rate and profitability

4. **Scoring & Ranking**
   - Scores based on win rate (40%), profitability (30%), consistency (15%), risk management (15%)
   - Minimum score: 60/100

5. **Promotion**
   - Tracks discovered wallets separately
   - Promotes after 5 successful trades

## 📈 Performance Metrics

### Portfolio Level
- Total P&L
- ROI percentage
- Win rate
- Sharpe ratio
- Max drawdown
- Total trades

### Strategy Level
- Strategy-specific P&L
- Win/loss breakdown
- Capital utilization
- Profit factor

### Wallet Level
- Individual win rates
- Total P&L per wallet
- Biggest wins/losses
- Trade count
- Average position size

## 🛡️ Risk Management

### Position Sizing
- Max 15% of capital per position
- Strategy-based allocation
- Dynamic sizing based on wallet performance

### Stop Losses
- Arbitrage: 5%
- Memecoin: 50%
- Early Gem: 30%

### Portfolio Limits
- Max drawdown: 30% (pause trading)
- Max daily loss: 5%
- Correlation limit: 30% in similar assets

### Edge Detection
The system automatically:
- Detects win rate decline >15%
- Flags 10+ consecutive losses
- Pauses wallets performing <-15% over 14 days
- Monitors strategy drift

## 🧪 Mock Mode (Recommended)

**Mock mode is enabled by default** to avoid rate limits!

```bash
MOCK_MODE=true npm start   # Explicit enable (default)
MOCK_MODE=false npm start  # Disable (requires good RPCs)
```

Mock mode:
- ✅ Generates realistic fake transactions
- ✅ Simulates price movements
- ✅ Tests all features without API limits
- ✅ **No 429 rate limit errors**
- ✅ Perfect for learning the system

**Why Mock Mode?**
Public blockchain RPCs have strict rate limits (100-1000 requests/day). With 30 wallets across 4 chains, you'll quickly hit these limits. Mock mode lets you test everything without restrictions.

**See [RATE_LIMITS.md](RATE_LIMITS.md) for full details on rate limiting strategy.**

### 🎯 Production Mode

For production deployment with real price data:

```bash
# 1. Create environment file
cp env.example .env

# 2. Add your API keys to .env
#    COINGECKO_API_KEY=your_key
#    ETHERSCAN_API_KEY=your_key
#    (etc.)

# 3. Set production mode
#    NODE_ENV=production
#    MOCK_MODE=false

# 4. Start server
NODE_ENV=production npm start
```

**📖 Full production setup: [PRODUCTION_GUIDE.md](PRODUCTION_GUIDE.md)**

## 📱 Frontend Features

### Modern Dark Theme UI
- Beautiful gradient header
- Responsive design
- Real-time updates
- Toast notifications

### Interactive Tables
- Sortable columns
- Filterable data
- Copy addresses
- View on block explorers

### Strategy Cards
- Visual breakdown
- Color-coded P&L
- Win rate indicators
- Allocation display

## 🔐 Security & Production

This is a **paper trading system** - no real funds are at risk.

### ✅ Production-Ready Features (NEW!)

The system now includes comprehensive production features:

- ✅ **API Key Authentication** - Secure sensitive endpoints
- ✅ **Rate Limiting** - DDoS protection on all endpoints
- ✅ **Input Validation** - Protect against malicious inputs
- ✅ **Security Headers** - Helmet.js integration
- ✅ **Professional Logging** - Winston with daily rotation
- ✅ **Real Price Fetching** - CoinGecko, CoinMarketCap, DEX oracles
- ✅ **Error Handling** - Graceful recovery and detailed logging
- ✅ **Environment Config** - Full .env support
- ✅ **CORS Protection** - Configurable origins
- ✅ **Health Monitoring** - Built-in health checks

**📖 See [PRODUCTION_GUIDE.md](PRODUCTION_GUIDE.md) for complete setup instructions.**

## 🐛 Troubleshooting

### Database Issues
```bash
# Reset database
rm -rf data/
npm run init-db
```

### RPC Connection Failures
- Check internet connection
- Verify RPC endpoints are working
- Add backup RPCs in config
- Enable mock mode for testing

### No Transactions Showing
- System is likely in mock mode or RPCs aren't configured
- Check console for errors
- Verify wallets exist in database
- Wait for tracking cycle to run

## 📝 Real Wallet Addresses Included

The system includes **30 real wallet addresses** that demonstrated profitability in 2024:

- **Ethereum Arbitrage**: 10 wallets doing DEX arbitrage and MEV
- **Solana Memecoins**: 10 wallets that caught early memecoin pumps
- **Base/Arbitrum Gems**: 10 wallets finding new token launches

All addresses are real and can be viewed on their respective block explorers.

## 🚧 Future Enhancements

Potential improvements:
- [ ] WebSocket for real-time updates
- [ ] Price charts integration
- [ ] Telegram alerts
- [ ] Backtest historical strategies
- [ ] Multi-user support
- [ ] Export reports (PDF/CSV)
- [ ] Mobile app
- [ ] Live trading mode (with real funds)

## 📄 License

MIT License - Free to use and modify

## ⚠️ Disclaimer

This software is for educational and research purposes only. Not financial advice. Do your own research before making any investment decisions. Cryptocurrency trading carries substantial risk of loss.

## 🤝 Contributing

Contributions welcome! Feel free to:
- Add new strategies
- Improve discovery algorithms
- Add new chains
- Enhance UI/UX
- Fix bugs

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the code comments
3. Open an issue on GitHub

---

**Built with ❤️ for crypto alpha hunters**

Happy tracking! 🚀💎
