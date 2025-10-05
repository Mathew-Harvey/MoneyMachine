require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const morgan = require('morgan');
const config = require('../config/config');
const db = require('./database');
const logger = require('./utils/logger');
const apiStatusChecker = require('./services/apiStatusChecker');

// Import middleware
const { 
  apiLimiter, 
  strictLimiter, 
  discoveryLimiter,
  authenticateApiKey,
  securityHeaders,
  corsOptions,
  sanitizeInput,
  requestLogger,
  errorHandler
} = require('./middleware/security');

const {
  walletAddressValidation,
  strategyValidation,
  tradeStatusValidation,
  paginationValidation,
  walletStatusUpdateValidation,
  daysValidation,
  promotedValidation
} = require('./middleware/validation');

// Import modules
const UniversalTracker = require('./trackers/universalTracker');
const WalletDiscovery = require('./discovery/walletDiscovery');
const PaperTradingEngine = require('./trading/paperTradingEngine');
const PerformanceTracker = require('./analysis/performanceTracker');
const { initEtherscan } = require('./utils/etherscanV2');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeInput);

// Request logging
app.use(requestLogger);

// HTTP request logging (morgan) - only in development
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Global instances
let universalTracker;
let walletDiscovery;
let paperTradingEngine;
let performanceTracker;
let isInitialized = false;

// Validate required environment variables
function validateEnvironment() {
  const required = ['NODE_ENV'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.warn('Missing recommended environment variables', { missing });
  }

  // Warn if running in production without API keys
  if (process.env.NODE_ENV === 'production' && !process.env.COINGECKO_API_KEY) {
    logger.warn('Running in production without price API keys - price data may be limited');
  }

  // Log configuration
  logger.info('Environment configuration', {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: config.server.port,
    mockMode: config.mockMode.enabled,
    discoveryEnabled: config.discovery.enabled,
    etherscanApiKey: !!config.apiKeys.etherscan,
    coingeckoApiKey: !!process.env.COINGECKO_API_KEY
  });

  // Initialize Etherscan V2 helper
  if (config.apiKeys.etherscan) {
    initEtherscan(config.apiKeys.etherscan);
    logger.info('Etherscan V2 initialized - single API key for all EVM chains', {
      chains: ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon']
    });
  } else {
    logger.warn('No Etherscan API key - blockchain data will be limited');
  }
}

// Initialize all systems
async function initializeSystems() {
  try {
    logger.info('Initializing MoneyMaker...');
    
    // Validate environment
    validateEnvironment();
    
    // Initialize database
    await db.init();
    logger.info('Database initialized');
    
    // Initialize tracking systems
    universalTracker = new UniversalTracker(db);
    await universalTracker.init();
    logger.info('Universal tracker initialized');
    
    // Initialize wallet discovery
    walletDiscovery = new WalletDiscovery(db);
    logger.info('Wallet discovery initialized');
    
    // Initialize paper trading engine
    paperTradingEngine = new PaperTradingEngine(db);
    await paperTradingEngine.init();
    logger.info('Paper trading engine initialized');
    
    // Initialize performance tracker
    performanceTracker = new PerformanceTracker(db);
    logger.info('Performance tracker initialized');
    
    isInitialized = true;
    logger.info('All systems initialized successfully!');
    
    // Start background jobs
    startBackgroundJobs();
    
  } catch (error) {
    logger.error('Failed to initialize systems', { 
      error: error.message, 
      stack: error.stack 
    });
    process.exit(1);
  }
}

// Start background cron jobs
function startBackgroundJobs() {
  logger.info('Starting background jobs');
  
  // PRODUCTION OPTIMIZED: 1-minute tracking with smart batching
  const trackingInterval = process.env.TRACKING_INTERVAL || 1;  // Changed to 1 minute
  const discoveryInterval = process.env.DISCOVERY_INTERVAL || 6;
  const performanceInterval = process.env.PERFORMANCE_UPDATE_INTERVAL || 15;
  const positionInterval = process.env.POSITION_MANAGEMENT_INTERVAL || 2;  // Faster position checks
  
  // Mutex locks to prevent overlapping jobs
  let trackingRunning = false;
  let discoveryRunning = false;
  let performanceRunning = false;
  let positionManagementRunning = false;
  
  // Track wallets
  cron.schedule(`*/${trackingInterval} * * * *`, async () => {
    if (trackingRunning) {
      logger.warn('CRON: Wallet tracking already running, skipping this cycle');
      return;
    }
    
    if (isInitialized && universalTracker && paperTradingEngine) {
      trackingRunning = true;
      try {
        logger.info('CRON: Running wallet tracking');
        await db.setSystemState('last_tracking_cycle', new Date().toISOString());
        
        const transactions = await universalTracker.trackAllWallets();
        
        // Process transactions through paper trading engine
        if (transactions && transactions.length > 0) {
          logger.info(`CRON: Processing ${transactions.length} transactions for trading`);
          const tradesExecuted = await paperTradingEngine.processTransactions(transactions);
          if (tradesExecuted > 0) {
            logger.info(`CRON: Executed ${tradesExecuted} paper trades`);
            await db.setSystemState('last_trade_execution', new Date().toISOString());
          }
        }
      } catch (error) {
        logger.error('CRON: Wallet tracking failed', { error: error.message });
      } finally {
        trackingRunning = false;
      }
    }
  });
  
  // Discover new wallets
  if (config.discovery.enabled) {
    cron.schedule(`0 */${discoveryInterval} * * *`, async () => {
      if (discoveryRunning) {
        logger.warn('CRON: Wallet discovery already running, skipping this cycle');
        return;
      }
      
      if (isInitialized && walletDiscovery) {
        discoveryRunning = true;
        try {
          logger.info('CRON: Running wallet discovery');
          await walletDiscovery.discoverNewWallets();
        } catch (error) {
          logger.error('CRON: Wallet discovery failed', { error: error.message });
        } finally {
          discoveryRunning = false;
        }
      }
    });
  }
  
  // Update performance metrics
  cron.schedule(`*/${performanceInterval} * * * *`, async () => {
    if (performanceRunning) {
      logger.warn('CRON: Performance update already running, skipping this cycle');
      return;
    }
    
    if (isInitialized && performanceTracker) {
      performanceRunning = true;
      try {
        logger.debug('CRON: Updating performance metrics');
        await performanceTracker.updateAllMetrics();
      } catch (error) {
        logger.error('CRON: Performance update failed', { error: error.message });
      } finally {
        performanceRunning = false;
      }
    }
  });
  
  // Manage open positions
  cron.schedule(`*/${positionInterval} * * * *`, async () => {
    if (positionManagementRunning) {
      logger.warn('CRON: Position management already running, skipping this cycle');
      return;
    }
    
    if (isInitialized && paperTradingEngine) {
      positionManagementRunning = true;
      try {
        await db.setSystemState('last_position_check', new Date().toISOString());
        await paperTradingEngine.managePositions();
      } catch (error) {
        logger.error('CRON: Position management failed', { error: error.message });
      } finally {
        positionManagementRunning = false;
      }
    }
  });
  
  logger.info('Background jobs started with mutex locks', {
    tracking: `Every ${trackingInterval} minutes`,
    discovery: `Every ${discoveryInterval} hours`,
    performance: `Every ${performanceInterval} minutes`,
    positions: `Every ${positionInterval} minutes`
  });
}

// ============ API ROUTES ============

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Health check (no rate limit)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    initialized: isInitialized,
    mockMode: config.mockMode.enabled,
    timestamp: new Date().toISOString()
  });
});

// Get overall dashboard data
app.get('/api/dashboard', async (req, res) => {
  try {
    const performance = await db.getOverallPerformance();
    const topWallets = await db.getTopPerformingWallets(5);
    const recentTrades = await db.getRecentTransactions(10);
    const allOpenTrades = await db.getOpenTrades();
    const discoveredWallets = await db.getDiscoveredWallets(false);
    
    // Calculate strategy breakdown - ALL STRATEGIES (including open trades)
    const strategyBreakdown = {};
    const strategies = ['copyTrade', 'volumeBreakout', 'smartMoney', 'arbitrage', 'memecoin', 'earlyGem', 'discovery'];
    
    for (const strategy of strategies) {
      // Get ALL trades (open and closed)
      const allTrades = await db.query(
        'SELECT * FROM paper_trades WHERE strategy_used = ?',
        [strategy]
      );
      
      const closedTrades = allTrades.filter(t => t.status === 'closed');
      const strategyOpenTrades = allTrades.filter(t => t.status === 'open');
      
      // Calculate realized P&L from closed trades
      const realizedPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const wins = closedTrades.filter(t => t.pnl > 0).length;
      
      strategyBreakdown[strategy] = {
        trades: allTrades.length,  // Total trades (open + closed)
        openTrades: strategyOpenTrades.length,
        closedTrades: closedTrades.length,
        wins,
        losses: closedTrades.length - wins,
        pnl: realizedPnl,
        winRate: closedTrades.length > 0 ? wins / closedTrades.length : 0
      };
    }
    
    res.json({
      performance,
      topWallets,
      recentTrades,
      openTrades: allOpenTrades,
      discoveredWallets: discoveredWallets.slice(0, 5),
      strategyBreakdown
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all wallets
app.get('/api/wallets', strategyValidation, paginationValidation, async (req, res) => {
  try {
    const { strategy, status } = req.query;
    const wallets = await db.getWallets(strategy, status || 'active');
    logger.debug('Wallets retrieved', { count: wallets.length, strategy });
    res.json(wallets);
  } catch (error) {
    logger.error('Error fetching wallets', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get wallet details
app.get('/api/wallets/:address', walletAddressValidation, async (req, res) => {
  try {
    const wallet = await db.get(
      'SELECT * FROM wallets WHERE address = ?',
      [req.params.address]
    );
    
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    
    const transactions = await db.getWalletTransactions(req.params.address, 50);
    const trades = await db.query(
      'SELECT * FROM paper_trades WHERE source_wallet = ? ORDER BY entry_time DESC LIMIT 20',
      [req.params.address]
    );
    
    res.json({
      wallet,
      transactions,
      trades
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all paper trades
app.get('/api/trades', tradeStatusValidation, strategyValidation, paginationValidation, async (req, res) => {
  try {
    const { status, strategy, limit } = req.query;
    
    let sql = 'SELECT * FROM paper_trades WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (strategy) {
      sql += ' AND strategy_used = ?';
      params.push(strategy);
    }
    
    sql += ' ORDER BY entry_time DESC';
    
    if (limit) {
      sql += ' LIMIT ?';
      params.push(Math.min(parseInt(limit) || 100, 1000));
    } else {
      sql += ' LIMIT 100';
    }
    
    const trades = await db.query(sql, params);
    logger.debug('Trades retrieved', { count: trades.length, status, strategy });
    res.json(trades);
  } catch (error) {
    logger.error('Error fetching trades', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get discovered wallets
app.get('/api/discovered', promotedValidation, async (req, res) => {
  try {
    const promoted = req.query.promoted === 'true';
    const wallets = await db.getDiscoveredWallets(promoted);
    logger.debug('Discovered wallets retrieved', { count: wallets.length, promoted });
    res.json(wallets);
  } catch (error) {
    logger.error('Error fetching discovered wallets', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Manual discovery trigger - NEW
app.post('/api/discover', async (req, res) => {
  try {
    if (!isInitialized || !walletDiscovery) {
      return res.status(503).json({ error: 'System not initialized' });
    }
    
    logger.info('Manual discovery triggered');
    const discoveredWallets = await walletDiscovery.discoverNewWallets();
    
    res.json({
      success: true,
      walletsDiscovered: discoveredWallets.length,
      wallets: discoveredWallets,
      message: `Discovery complete: Found ${discoveredWallets.length} new wallets`
    });
  } catch (error) {
    logger.error('Manual discovery failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Wallet activity analysis - NEW
app.get('/api/wallets/activity', async (req, res) => {
  try {
    // Get all active wallets
    const wallets = await db.getWallets(null, 'active');
    
    // Get activity stats for each wallet
    const activityStats = await Promise.all(
      wallets.map(async (wallet) => {
        const transactions = await db.getWalletTransactions(wallet.address, 100);
        const trades = await db.query(
          'SELECT * FROM paper_trades WHERE source_wallet = ?',
          [wallet.address]
        );
        
        // Calculate recent activity (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentTxs = transactions.filter(tx => 
          new Date(tx.timestamp) > oneDayAgo
        );
        
        // Calculate average transaction value
        const avgTxValue = transactions.length > 0
          ? transactions.reduce((sum, tx) => sum + (tx.total_value_usd || 0), 0) / transactions.length
          : 0;
        
        return {
          address: wallet.address,
          chain: wallet.chain,
          strategy: wallet.strategy,
          status: wallet.status,
          winRate: wallet.win_rate,
          totalPnl: wallet.total_pnl,
          totalTransactions: transactions.length,
          recentTransactions24h: recentTxs.length,
          tradesGenerated: trades.length,
          avgTransactionValue: avgTxValue,
          lastActive: transactions.length > 0 
            ? transactions[0].timestamp 
            : wallet.created_at
        };
      })
    );
    
    // Sort by most active (recent transactions)
    activityStats.sort((a, b) => b.recentTransactions24h - a.recentTransactions24h);
    
    // Calculate summary stats
    const summary = {
      totalWallets: wallets.length,
      activeToday: activityStats.filter(w => w.recentTransactions24h > 0).length,
      totalTransactions24h: activityStats.reduce((sum, w) => sum + w.recentTransactions24h, 0),
      totalTradesGenerated: activityStats.reduce((sum, w) => sum + w.tradesGenerated, 0),
      avgTransactionsPerWallet: activityStats.reduce((sum, w) => sum + w.totalTransactions, 0) / wallets.length
    };
    
    res.json({
      summary,
      wallets: activityStats
    });
  } catch (error) {
    logger.error('Error fetching wallet activity', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// API Connections Status - COMPREHENSIVE (NEW)
app.get('/api/connections/status', async (req, res) => {
  try {
    logger.info('Checking API connections status');
    const status = await apiStatusChecker.getAllStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error checking API connections', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// API Connections Summary - Quick overview (NEW)
app.get('/api/connections/summary', async (req, res) => {
  try {
    const summary = await apiStatusChecker.getStatusSummary();
    res.json(summary);
  } catch (error) {
    logger.error('Error getting API connections summary', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get strategy performance
app.get('/api/strategy/:strategy', strategyValidation, daysValidation, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const performance = await db.getStrategyPerformance(req.params.strategy, days);
    res.json(performance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger wallet tracking (rate limited, auth required)
app.post('/api/track', strictLimiter, authenticateApiKey, async (req, res) => {
  try {
    if (!isInitialized) {
      return res.status(503).json({ error: 'System not initialized' });
    }
    
    logger.info('Manual wallet tracking triggered', { ip: req.ip });
    const transactions = await universalTracker.trackAllWallets();
    
    let tradesExecuted = 0;
    if (transactions && transactions.length > 0) {
      tradesExecuted = await paperTradingEngine.processTransactions(transactions);
    }
    
    res.json({ 
      success: true, 
      message: 'Tracking completed',
      transactionsFound: transactions ? transactions.length : 0,
      tradesExecuted 
    });
  } catch (error) {
    logger.error('Manual tracking failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger wallet discovery (rate limited, auth required)
app.post('/api/discover', discoveryLimiter, authenticateApiKey, async (req, res) => {
  try {
    if (!isInitialized) {
      return res.status(503).json({ error: 'System not initialized' });
    }
    
    logger.info('Manual wallet discovery triggered', { ip: req.ip });
    const results = await walletDiscovery.discoverNewWallets();
    res.json({ success: true, discovered: results.length });
  } catch (error) {
    logger.error('Manual discovery failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Promote a discovered wallet to main tracking (auth required)
app.post('/api/discovered/:address/promote', authenticateApiKey, walletAddressValidation, async (req, res) => {
  try {
    const wallet = await db.get(
      'SELECT * FROM discovered_wallets WHERE address = ?',
      [req.params.address]
    );
    
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    
    // Add to main wallets
    await db.addWallet({
      address: wallet.address,
      chain: wallet.chain,
      strategy_type: 'discovery',
      win_rate: wallet.estimated_win_rate,
      status: 'active',
      notes: `Promoted from discovery on ${new Date().toISOString()}`
    });
    
    // Mark as promoted
    await db.promoteDiscoveredWallet(wallet.address);
    
    res.json({ success: true, message: 'Wallet promoted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pause/resume wallet (auth required)
app.post('/api/wallets/:address/status', authenticateApiKey, walletStatusUpdateValidation, async (req, res) => {
  try {
    const { status, reason } = req.body;
    
    await db.run(
      'UPDATE wallets SET status = ?, notes = ? WHERE address = ?',
      [status, reason || '', req.params.address]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get system stats
app.get('/api/stats', async (req, res) => {
  try {
    const totalWallets = await db.query('SELECT COUNT(*) as count FROM wallets WHERE status = \'active\'');
    const totalTrades = await db.query('SELECT COUNT(*) as count FROM paper_trades');
    const openTrades = await db.query('SELECT COUNT(*) as count FROM paper_trades WHERE status = \'open\'');
    const discoveredWallets = await db.query('SELECT COUNT(*) as count FROM discovered_wallets WHERE promoted = 0');
    
    const performance = await db.getOverallPerformance();
    
    res.json({
      wallets: {
        active: totalWallets[0].count,
        discovered: discoveredWallets[0].count
      },
      trades: {
        total: totalTrades[0].count,
        open: openTrades[0].count,
        closed: totalTrades[0].count - openTrades[0].count
      },
      performance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get system health status (for monitoring)
app.get('/api/system/status', async (req, res) => {
  try {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    // Get component status
    const components = {
      database: {
        status: db.db ? 'operational' : 'offline',
        lastActivity: new Date().toISOString()
      },
      universalTracker: {
        status: universalTracker ? 'operational' : 'offline',
        isTracking: universalTracker?.isTracking || false,
        lastActivity: await db.getSystemState('last_tracking_cycle') || 'Never'
      },
      paperTradingEngine: {
        status: paperTradingEngine ? 'operational' : 'offline',
        processedCount: paperTradingEngine?.lastProcessedTx?.size || 0,
        lastActivity: await db.getSystemState('last_trade_execution') || 'Never'
      },
      walletDiscovery: {
        status: walletDiscovery ? 'operational' : 'offline',
        lastRun: await db.getSystemState('last_discovery_run') || 'Never',
        dailyCount: parseInt(await db.getSystemState('discovery_count_today') || '0')
      }
    };
    
    // Get recent activity
    const recentTransactions = await db.query(
      'SELECT COUNT(*) as count FROM transactions WHERE timestamp >= datetime(\'now\', \'-1 hour\')'
    );
    
    const recentTrades = await db.query(
      'SELECT COUNT(*) as count FROM paper_trades WHERE entry_time >= datetime(\'now\', \'-1 hour\')'
    );
    
    // API status
    const apiStatus = {
      etherscan: !!config.apiKeys.etherscan,
      coingecko: !!process.env.COINGECKO_API_KEY,
      mockMode: config.mockMode.enabled
    };
    
    // Get background job status
    const jobs = {
      tracking: {
        interval: process.env.TRACKING_INTERVAL || 10,
        unit: 'minutes',
        lastRun: await db.getSystemState('last_tracking_cycle') || 'Never'
      },
      discovery: {
        interval: process.env.DISCOVERY_INTERVAL || 6,
        unit: 'hours',
        lastRun: await db.getSystemState('last_discovery_run') || 'Never'
      },
      positionManagement: {
        interval: process.env.POSITION_MANAGEMENT_INTERVAL || 5,
        unit: 'minutes',
        lastRun: await db.getSystemState('last_position_check') || 'Never'
      }
    };
    
    res.json({
      status: 'operational',
      uptime: Math.floor(uptime),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        limit: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      components,
      recentActivity: {
        transactionsLastHour: recentTransactions[0].count,
        tradesLastHour: recentTrades[0].count
      },
      apiStatus,
      jobs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting system status', { error: error.message });
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    // Cleanup paper trading engine intervals
    if (paperTradingEngine && typeof paperTradingEngine.shutdown === 'function') {
      paperTradingEngine.shutdown();
      logger.info('Paper trading engine shut down');
    }
    
    // Close database connection
    await db.close();
    logger.info('Database connection closed');
    
    // Note: Cron jobs will be killed with process exit
    
    // Exit process
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { 
    error: error.message, 
    stack: error.stack 
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason, 
    promise 
  });
});

// Start server
const PORT = config.server.port;
const HOST = config.server.host;

initializeSystems().then(() => {
  app.listen(PORT, HOST, () => {
    const startupMessage = `
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   💰 MoneyMaker is RUNNING                                ║
║                                                            ║
║   📊 Dashboard: http://${HOST}:${PORT}                   ║
║   🔌 API: http://${HOST}:${PORT}/api                     ║
║                                                            ║
║   💵 Starting Capital: $10,000                            ║
║   📈 Tracking: 30 wallets across 3 strategies             ║
║   🔍 Auto-discovery: ${config.discovery.enabled ? 'ENABLED' : 'DISABLED'}                           ║
║   ⚙️  Mock Mode: ${config.mockMode.enabled ? 'ENABLED' : 'DISABLED'}                              ║
║   🔒 API Auth: ${process.env.API_KEY ? 'ENABLED' : 'DISABLED'}                              ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝`;

    console.log(startupMessage);
    
    logger.info('Server started', {
      port: PORT,
      host: HOST,
      mockMode: config.mockMode.enabled,
      discoveryEnabled: config.discovery.enabled,
      authEnabled: !!process.env.API_KEY
    });
  });
}).catch((error) => {
  logger.error('Failed to start server', { 
    error: error.message, 
    stack: error.stack 
  });
  process.exit(1);
});

module.exports = app;

