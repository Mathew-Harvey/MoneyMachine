// Configuration for Multi-Chain Alpha Tracker

module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
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

  // Strategy parameters
  strategies: {
    arbitrage: {
      allocation: 4000,
      maxPerTrade: 500,
      copyThreshold: 1000, // min trade size to copy (in USD)
      stopLoss: 0.05, // 5%
      takeProfit: 0.20, // 20%
      maxConcurrentTrades: 10,
      minWinRate: 0.60,
      trailingStop: 0.10 // 10% trailing stop after hitting 15% profit
    },
    memecoin: {
      allocation: 3000,
      maxPerTrade: 100,
      copyThreshold: 2, // need 2 wallets buying same token within timeframe
      copyTimeWindow: 3600, // 1 hour in seconds
      stopLoss: 0.50, // 50%
      takeProfit: [
        { at: 2, sell: 0.5 },   // sell 50% at 2x
        { at: 10, sell: 0.3 },  // sell 30% at 10x
        { at: 100, sell: 0.2 }  // sell rest at 100x
      ],
      maxHoldTime: 72, // hours
      maxConcurrentTrades: 15,
      minWinRate: 0.40
    },
    earlyGem: {
      allocation: 2000,
      maxPerTrade: 200,
      tokenAgeLimit: 24, // hours
      stopLoss: 0.30, // 30%
      takeProfit: 3, // 3x
      onlyFollowWalletsWithWinRate: 0.7,
      maxConcurrentTrades: 10,
      minLiquidity: 50000 // minimum liquidity in USD
    },
    discovery: {
      allocation: 1000,
      maxPerTrade: 50,
      testTrades: 5, // number of trades to observe before promotion
      stopLoss: 0.40,
      takeProfit: 2,
      maxConcurrentTrades: 5
    }
  },

  // Wallet discovery parameters
  discovery: {
    enabled: process.env.DISCOVERY_ENABLED !== 'false',
    runInterval: 21600000, // run every 6 hours (in milliseconds) - reduced to avoid rate limits
    dailyLimit: parseInt(process.env.DISCOVERY_DAILY_LIMIT) || 15, // max new wallets to discover per day (INCREASED for scaling)
    minTradeCount: 15, // minimum historical trades to analyze (lowered to find more candidates)
    minWinRate: 0.55, // minimum win rate to be considered (55% is still profitable)
    lookbackDays: 30, // analyze last 30 days
    minProfitability: 3000, // minimum profit in USD over lookback period (lowered to $3k)
    pumpThreshold: 3, // tokens must have pumped >3x to be analyzed (lowered from 5x)
    pumpTimeframe: 7, // days
    earlyBuyThreshold: 0.25 // wallet must have bought in bottom 25% of price range (slightly more lenient)
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

  // Mock mode for testing (RECOMMENDED to start with this enabled)
  // Public RPCs have strict rate limits - enable mock mode to test without API calls
  mockMode: {
    enabled: process.env.MOCK_MODE === 'true' || !process.env.MOCK_MODE, // Default to true if not set
    generateTransactions: true,
    transactionInterval: 30000 // generate mock tx every 30 seconds
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

