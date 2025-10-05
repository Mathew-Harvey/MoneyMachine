// Configuration for Multi-Chain Alpha Tracker

module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 3005,
    host: process.env.HOST || '0.0.0.0'  // Bind to all interfaces to allow mobile access
  },

  // Database configuration
  database: {
    path: './data/tracker.db'
  },

  // RPC Endpoints with fallbacks
  rpc: {
    ethereum: [
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
      'https://ethereum.publicnode.com',
      'https://eth.drpc.org'
    ],
    solana: [
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://rpc.ankr.com/solana'
    ],
    base: [
      'https://mainnet.base.org',
      'https://base.llamarpc.com',
      'https://base.drpc.org',
      'https://1rpc.io/base'
    ],
    arbitrum: [
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum.llamarpc.com',
      'https://rpc.ankr.com/arbitrum'
    ]
  },

  // API Keys (optional - add your own for better rate limits)
  apiKeys: {
    // Blockchain Explorers
    etherscan: process.env.ETHERSCAN_API_KEY || '',     // Unified API for all EVM chains
    solscan: process.env.SOLSCAN_API_KEY || '',         // Solana explorer
    basescan: process.env.BASESCAN_API_KEY || '',       // Legacy (use etherscan instead)
    arbiscan: process.env.ARBISCAN_API_KEY || '',       // Legacy (use etherscan instead)
    
    // RPC Providers
    helius: process.env.HELIUS_API_KEY || '',           // Solana RPC
    alchemy: process.env.ALCHEMY_API_KEY || '',         // Multi-chain RPC
    quicknode: process.env.QUICKNODE_API_KEY || '',     // Multi-chain RPC
    
    // Price Oracles
    coingecko: process.env.COINGECKO_API_KEY || '',     // Token price data
    coinmarketcap: process.env.COINMARKETCAP_API_KEY || '', // Token price data
    
    // Authentication & Security
    apiKey: process.env.API_KEY || '',                  // Dashboard API auth
    jwtSecret: process.env.JWT_SECRET || 'change-this-in-production'
  },

  // Strategy parameters - BALANCED PRODUCTION MODE (Unsupervised operation)
  strategies: {
    // Simple copy trading - mirror successful wallets
    copyTrade: {
      allocation: 2500,
      maxPerTrade: 200, // Reduced from 250 for safety
      minTradeSize: 50, // Balanced: not too low, not too high
      minWalletWinRate: 0.50, // Require 50%+ win rate (proven track record)
      copyPercentage: 0.08, // Reduced from 0.1 to 8% for conservative sizing
      stopLoss: 0.12, // Tighter: 12% (was 15%)
      takeProfit: 0.40, // Earlier exit: 40% (was 50%)
      maxConcurrentTrades: 15, // Reduced from 20 for risk control
      trailingStop: 0.12
    },
    
    // Volume breakout - detect unusual buying activity
    volumeBreakout: {
      allocation: 2000,
      maxPerTrade: 150, // Reduced from 200
      volumeMultiplier: 2.5, // Balanced: 2.5x volume (was 2x test, 3x original)
      minBuyerCount: 3, // Back to 3 buyers for quality
      timeWindow: 7200, // 2 hours
      stopLoss: 0.15, // Tighter: 15% (was 20%)
      takeProfit: 0.60, // More conservative: 60% (was 75%)
      maxConcurrentTrades: 10 // Reduced from 15
    },
    
    // Smart money - follow whales and high-value traders
    smartMoney: {
      allocation: 2000,
      maxPerTrade: 250, // Reduced from 300
      minTradeSize: 2000, // Balanced: $2k (was $1k test, $5k original)
      minWalletBalance: 75000, // Balanced: $75k (was $50k test, $100k original)
      stopLoss: 0.10, // Keep tight
      takeProfit: 0.35, // Earlier exit: 35% (was 40%)
      maxConcurrentTrades: 8, // Reduced from 10
      trailingStop: 0.10
    },
    
    // Arbitrage - BALANCED thresholds for production
    arbitrage: {
      allocation: 1500,
      maxPerTrade: 200, // Reduced from 300
      copyThreshold: 250, // Balanced: $250 (was $100 test, $500 original)
      stopLoss: 0.08, // Keep tight for arb
      takeProfit: 0.20, // Quick exits: 20% (was 25%)
      maxConcurrentTrades: 8, // Reduced from 10
      minWinRate: 0.50, // Require 50%+ (was 40% test, 55% original)
      trailingStop: 0.08
    },
    
    // Memecoin - CONSERVATIVE (highest risk strategy)
    memecoin: {
      allocation: 1000, // REDUCED from 1500 (riskiest strategy)
      maxPerTrade: 100, // Reduced from 150
      copyThreshold: 2, // Require 2 coordinated buys (was 1)
      copyTimeWindow: 3600, // Reduced to 1 hour (was 2 hours)
      stopLoss: 0.40, // Tighter: 40% (was 50%)
      takeProfit: [
        { at: 2, sell: 0.6 },   // Take more profit earlier
        { at: 5, sell: 0.3 },   // Added middle tier
        { at: 10, sell: 0.1 }   // Keep less for moonshots
      ],
      maxHoldTime: 48, // Reduced from 72 hours
      maxConcurrentTrades: 12, // Reduced from 20
      minWinRate: 0.35 // Require 35%+ (was 25%)
    },
    
    // Early gem - CONSERVATIVE requirements
    earlyGem: {
      allocation: 500,
      maxPerTrade: 75, // Reduced from 100
      tokenAgeLimit: 120, // Reduced from 168 to 5 days (fresher focus)
      stopLoss: 0.25, // Tighter: 25% (was 30%)
      takeProfit: 2.5, // More realistic: 2.5x (was 3x)
      onlyFollowWalletsWithWinRate: 0.50, // Require 50%+ (was 40%)
      maxConcurrentTrades: 6, // Reduced from 10
      minLiquidity: 20000 // Balanced: $20k (was $10k test, $25k original)
    }
  },

  // Wallet discovery parameters - BALANCED for production
  discovery: {
    enabled: process.env.DISCOVERY_ENABLED !== 'false',
    runInterval: 21600000, // run every 6 hours
    dailyLimit: parseInt(process.env.DISCOVERY_DAILY_LIMIT) || 15, // Conservative: 15/day (was 25)
    minTradeCount: 15, // Require more history: 15 trades (was 10)
    minWinRate: 0.55, // Higher standard: 55% (was 52%)
    lookbackDays: 30,
    minProfitability: 3000, // Higher bar: $3k (was $2k)
    pumpThreshold: 2.5, // Balanced: 2.5x (was 2x)
    pumpTimeframe: 10, // Reduced to 10 days (was 14)
    earlyBuyThreshold: 0.25 // More selective: bottom 25% (was 30%)
  },

  // Risk management - ACTIVE PROTECTION for unsupervised operation
  risk: {
    maxDrawdown: 0.20, // TIGHTER: pause trading if down 20% (was 30%)
    maxDailyLoss: 0.03, // TIGHTER: pause if lose 3% in one day (was 5%)
    maxWeeklyLoss: 0.08, // NEW: pause if lose 8% in one week
    maxPositionSize: 0.12, // TIGHTER: no position larger than 12% (was 15%)
    correlationLimit: 0.25, // TIGHTER: max 25% in correlated assets (was 30%)
    maxOpenPositions: 40, // NEW: hard cap on total open positions
    emergencyStop: false // manual kill switch
  },

  // Performance tracking - AGGRESSIVE for unsupervised operation
  performance: {
    updateInterval: 60000, // update metrics every minute
    edgeDetectionPeriod: 14, // days to analyze for edge detection
    performanceThreshold: -0.12, // TIGHTER: pause wallet if down 12% (was 15%)
    promotionThreshold: 8, // More conservative: 8 successful trades (was 5)
    demotionThreshold: 5, // FASTER: 5 consecutive losses to demote (was 10)
    autoPauseEnabled: true, // NEW: automatically pause underperforming strategies
    autoPauseThreshold: -0.15 // Pause strategy if down 15%
  },

  // Cluster analysis
  clustering: {
    enabled: true,
    minClusterSize: 3,
    similarityThreshold: 0.70, // 70% overlap in tokens traded
    updateInterval: 86400000 // daily
  },

  // Logging and alerts
  logging: {
    level: 'info', // debug, info, warn, error
    logFile: './logs/tracker.log',
    alertThreshold: 1000 // alert when trades over $1000 detected
  },

  // Production mode - using real APIs only
  mockMode: {
    enabled: false, // DISABLED for production
    generateTransactions: false,
    transactionInterval: 30000
  },

  // Chain-specific settings
  chains: {
    ethereum: {
      gasLimit: 500000,
      maxGasPrice: 100, // gwei
      confirmations: 3,
      explorerUrl: 'https://etherscan.io'
    },
    solana: {
      commitment: 'confirmed',
      explorerUrl: 'https://solscan.io'
    },
    base: {
      gasLimit: 300000,
      maxGasPrice: 50,
      confirmations: 2,
      explorerUrl: 'https://basescan.org'
    },
    arbitrum: {
      gasLimit: 500000,
      maxGasPrice: 5,
      confirmations: 2,
      explorerUrl: 'https://arbiscan.io'
    }
  }
};

