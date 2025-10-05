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

  // Strategy parameters - PRODUCTION OPTIMIZED
  strategies: {
    // Simple copy trading - mirror successful wallets
    copyTrade: {
      allocation: 2500,
      maxPerTrade: 250,
      minTradeSize: 100, // copy trades over $100
      minWalletWinRate: 0.55, // follow wallets with 55%+ win rate
      copyPercentage: 0.1, // copy 10% of their trade size
      stopLoss: 0.15, // 15%
      takeProfit: 0.50, // 50%
      maxConcurrentTrades: 20,
      trailingStop: 0.15
    },
    
    // Volume breakout - detect unusual buying activity
    volumeBreakout: {
      allocation: 2000,
      maxPerTrade: 200,
      volumeMultiplier: 3, // 3x normal volume
      minBuyerCount: 3, // at least 3 different buyers
      timeWindow: 7200, // 2 hours
      stopLoss: 0.20,
      takeProfit: 0.75,
      maxConcurrentTrades: 15
    },
    
    // Smart money - follow whales and high-value traders
    smartMoney: {
      allocation: 2000,
      maxPerTrade: 300,
      minTradeSize: 5000, // only copy large trades
      minWalletBalance: 100000, // whales with $100k+
      stopLoss: 0.10,
      takeProfit: 0.40,
      maxConcurrentTrades: 10,
      trailingStop: 0.12
    },
    
    // Arbitrage - RELAXED thresholds
    arbitrage: {
      allocation: 1500,
      maxPerTrade: 300,
      copyThreshold: 500, // REDUCED from 1000
      stopLoss: 0.08,
      takeProfit: 0.25,
      maxConcurrentTrades: 10,
      minWinRate: 0.55, // REDUCED from 0.60
      trailingStop: 0.10
    },
    
    // Memecoin - RELAXED coordination requirement
    memecoin: {
      allocation: 1500,
      maxPerTrade: 150,
      copyThreshold: 1, // REDUCED from 2 - copy even single buys
      copyTimeWindow: 7200, // INCREASED to 2 hours
      stopLoss: 0.50,
      takeProfit: [
        { at: 2, sell: 0.5 },
        { at: 10, sell: 0.3 },
        { at: 100, sell: 0.2 }
      ],
      maxHoldTime: 72,
      maxConcurrentTrades: 20,
      minWinRate: 0.35 // REDUCED from 0.40
    },
    
    // Early gem - RELAXED requirements
    earlyGem: {
      allocation: 500,
      maxPerTrade: 100,
      tokenAgeLimit: 72, // INCREASED from 24 hours
      stopLoss: 0.30,
      takeProfit: 3,
      onlyFollowWalletsWithWinRate: 0.60, // REDUCED from 0.70
      maxConcurrentTrades: 10,
      minLiquidity: 25000 // REDUCED from 50000
    }
  },

  // Wallet discovery parameters - AGGRESSIVE for production
  discovery: {
    enabled: process.env.DISCOVERY_ENABLED !== 'false',
    runInterval: 21600000, // run every 6 hours
    dailyLimit: parseInt(process.env.DISCOVERY_DAILY_LIMIT) || 25, // INCREASED for more discoveries
    minTradeCount: 10, // REDUCED - less history required
    minWinRate: 0.52, // REDUCED - 52% is still profitable
    lookbackDays: 30,
    minProfitability: 2000, // REDUCED to $2k
    pumpThreshold: 2, // REDUCED to 2x (catches more opportunities)
    pumpTimeframe: 14, // INCREASED to 14 days (longer window)
    earlyBuyThreshold: 0.30 // INCREASED to bottom 30%
  },

  // Risk management
  risk: {
    maxDrawdown: 0.30, // pause trading if down 30%
    maxDailyLoss: 0.05, // pause if lose 5% in one day
    maxPositionSize: 0.15, // no position larger than 15% of capital
    correlationLimit: 0.30, // max 30% in correlated assets
    emergencyStop: false // manual kill switch
  },

  // Performance tracking
  performance: {
    updateInterval: 60000, // update metrics every minute
    edgeDetectionPeriod: 14, // days to analyze for edge detection
    performanceThreshold: -0.15, // pause wallet if down 15% over period
    promotionThreshold: 5, // successful trades before promotion
    demotionThreshold: 10 // consecutive losses to demote wallet
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

