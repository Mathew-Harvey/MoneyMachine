const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class Database {
  constructor() {
    this.db = null;
  }

  // Initialize database connection
  async init() {
    return new Promise((resolve, reject) => {
      // Ensure data directory exists
      const dataDir = path.dirname(config.database.path);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite3.Database(config.database.path, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('✓ Database connected');
          this.initSchema()
            .then(() => this.loadSeedWallets())
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }

  // Load seed wallets if database is empty
  async loadSeedWallets() {
    try {
      // Check if wallets already exist
      const existing = await this.query('SELECT COUNT(*) as count FROM wallets');
      if (existing[0].count > 0) {
        console.log(`✓ Database already has ${existing[0].count} wallets`);
        return;
      }

      console.log('📥 Loading seed wallets...');
      const walletSeeds = require('../config/walletSeeds');
      
      // Add arbitrage wallets
      for (const wallet of walletSeeds.arbitrage) {
        await this.addWallet({
          ...wallet,
          strategy_type: 'arbitrage',
          status: 'active'
        });
      }
      console.log(`✓ Added ${walletSeeds.arbitrage.length} arbitrage wallets`);
      
      // Add memecoin wallets
      for (const wallet of walletSeeds.memecoin) {
        await this.addWallet({
          ...wallet,
          strategy_type: 'memecoin',
          status: 'active'
        });
      }
      console.log(`✓ Added ${walletSeeds.memecoin.length} memecoin wallets`);
      
      // Add early gem wallets
      for (const wallet of walletSeeds.earlyGem) {
        await this.addWallet({
          ...wallet,
          strategy_type: 'earlyGem',
          status: 'active'
        });
      }
      console.log(`✓ Added ${walletSeeds.earlyGem.length} early gem wallets`);
      
      console.log('✅ Seed wallets loaded successfully!');
    } catch (error) {
      console.error('❌ Error loading seed wallets:', error.message);
      // Don't throw - allow system to continue even if seed loading fails
    }
  }

  // Initialize database schema
  async initSchema() {
    const schemaPath = path.join(__dirname, '..', 'init.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    return new Promise(async (resolve, reject) => {
      this.db.exec(schema, async (err) => {
        if (err) {
          console.error('Error initializing schema:', err);
          reject(err);
        } else {
          console.log('✓ Database schema initialized');
          
          // Run migrations for existing databases
          try {
            await this.runMigrations();
          } catch (migErr) {
            console.warn('Migration warning:', migErr.message);
          }
          
          resolve();
        }
      });
    });
  }

  // Run database migrations for schema updates
  async runMigrations() {
    try {
      // Note: peak_price column is now part of the base schema in init.sql
      // No migrations needed at this time
      console.log('✓ Database schema up to date');
    } catch (error) {
      console.warn('Migration warning:', error.message);
      // Don't fail startup on migration errors
    }
  }

  // Generic query method
  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Query error:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Generic run method for INSERT/UPDATE/DELETE
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Run error:', err);
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  // Get single row
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error('Get error:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // === WALLET OPERATIONS ===

  async addWallet(wallet) {
    const sql = `INSERT OR REPLACE INTO wallets 
      (address, chain, strategy_type, win_rate, total_pnl, status, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`;
    return this.run(sql, [
      wallet.address,
      wallet.chain,
      wallet.strategy_type,
      wallet.win_rate || 0,
      wallet.total_pnl || 0,
      wallet.status || 'active',
      wallet.notes || ''
    ]);
  }

  async getWallets(strategyType = null, status = 'active') {
    let sql = 'SELECT * FROM wallets WHERE status = ?';
    const params = [status];
    
    if (strategyType) {
      sql += ' AND strategy_type = ?';
      params.push(strategyType);
    }
    
    sql += ' ORDER BY total_pnl DESC';
    return this.query(sql, params);
  }

  async updateWalletPerformance(address, performance) {
    const sql = `UPDATE wallets SET 
      win_rate = ?,
      total_pnl = ?,
      total_trades = ?,
      successful_trades = ?,
      avg_trade_size = ?,
      biggest_win = ?,
      biggest_loss = ?,
      last_checked = CURRENT_TIMESTAMP
      WHERE address = ?`;
    
    return this.run(sql, [
      performance.win_rate,
      performance.total_pnl,
      performance.total_trades,
      performance.successful_trades,
      performance.avg_trade_size,
      performance.biggest_win,
      performance.biggest_loss,
      address
    ]);
  }

  async pauseWallet(address, reason) {
    return this.run(
      'UPDATE wallets SET status = ?, notes = ? WHERE address = ?',
      ['paused', reason, address]
    );
  }

  // === TRANSACTION OPERATIONS ===

  async addTransaction(tx) {
    // Validate required fields to prevent invalid data
    if (!tx.wallet_address || !tx.tx_hash || !tx.token_address) {
      logger.warn('Attempted to add transaction with missing required fields', {
        wallet_address: tx.wallet_address,
        tx_hash: tx.tx_hash,
        token_address: tx.token_address
      });
      return { lastID: 0, changes: 0 };
    }
    
    // Use INSERT OR IGNORE to prevent duplicates (UNIQUE constraint will catch them)
    const sql = `INSERT OR IGNORE INTO transactions 
      (wallet_address, chain, tx_hash, token_address, token_symbol, action, 
       amount, price_usd, total_value_usd, timestamp, block_number) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    try {
      return await this.run(sql, [
        tx.wallet_address,
        tx.chain,
        tx.tx_hash,
        tx.token_address,
        tx.token_symbol || 'UNKNOWN',
        tx.action,
        tx.amount || 0,
        tx.price_usd || 0,
        tx.total_value_usd || 0,
        tx.timestamp || new Date().toISOString(),
        tx.block_number || 0
      ]);
    } catch (error) {
      logger.error('Failed to add transaction', {
        error: error.message,
        tx_hash: tx.tx_hash
      });
      return { lastID: 0, changes: 0 };
    }
  }

  async getWalletTransactions(walletAddress, limit = 100) {
    return this.query(
      'SELECT * FROM transactions WHERE wallet_address = ? ORDER BY timestamp DESC LIMIT ?',
      [walletAddress, limit]
    );
  }

  async getRecentTransactions(limit = 50) {
    return this.query(
      'SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
  }

  // === PAPER TRADING OPERATIONS ===

  async openPaperTrade(trade) {
    const sql = `INSERT INTO paper_trades 
      (token_address, token_symbol, chain, strategy_used, source_wallet, 
       entry_price, amount, entry_value_usd, status, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`;
    
    return this.run(sql, [
      trade.token_address,
      trade.token_symbol,
      trade.chain,
      trade.strategy_used,
      trade.source_wallet,
      trade.entry_price,
      trade.amount,
      trade.entry_value_usd,
      trade.notes || ''
    ]);
  }

  async closePaperTrade(tradeId, exitPrice, exitReason) {
    // Get the trade first to calculate P&L
    const trade = await this.get('SELECT * FROM paper_trades WHERE id = ?', [tradeId]);
    
    if (!trade) {
      throw new Error('Trade not found');
    }
    
    // Validate exit price
    if (!exitPrice || exitPrice <= 0) {
      logger.error('Invalid exit price for trade', {
        tradeId,
        exitPrice,
        token: trade.token_symbol
      });
      throw new Error('Invalid exit price');
    }
    
    // Validate trade has required fields
    if (!trade.amount || !trade.entry_price || !trade.entry_value_usd) {
      logger.error('Trade missing required fields', {
        tradeId,
        amount: trade.amount,
        entry_price: trade.entry_price,
        entry_value_usd: trade.entry_value_usd
      });
      throw new Error('Trade data incomplete');
    }

    const exitValueUsd = trade.amount * exitPrice;
    const pnl = exitValueUsd - trade.entry_value_usd;
    const pnlPercentage = ((exitPrice - trade.entry_price) / trade.entry_price) * 100;

    const sql = `UPDATE paper_trades SET 
      exit_price = ?,
      exit_value_usd = ?,
      pnl = ?,
      pnl_percentage = ?,
      status = 'closed',
      exit_time = CURRENT_TIMESTAMP,
      exit_reason = ?
      WHERE id = ?`;
    
    return this.run(sql, [exitPrice, exitValueUsd, pnl, pnlPercentage, exitReason, tradeId]);
  }

  async getOpenTrades(strategyType = null) {
    let sql = 'SELECT * FROM paper_trades WHERE status = \'open\'';
    const params = [];
    
    if (strategyType) {
      sql += ' AND strategy_used = ?';
      params.push(strategyType);
    }
    
    sql += ' ORDER BY entry_time DESC';
    return this.query(sql, params);
  }

  async getAllTrades(limit = 100) {
    return this.query(
      'SELECT * FROM paper_trades ORDER BY entry_time DESC LIMIT ?',
      [limit]
    );
  }

  // === DISCOVERED WALLETS OPERATIONS ===

  async addDiscoveredWallet(wallet) {
    const sql = `INSERT OR REPLACE INTO discovered_wallets 
      (address, chain, profitability_score, estimated_win_rate, 
       discovery_method, notes) 
      VALUES (?, ?, ?, ?, ?, ?)`;
    
    return this.run(sql, [
      wallet.address,
      wallet.chain,
      wallet.profitability_score,
      wallet.estimated_win_rate,
      wallet.discovery_method,
      wallet.notes || ''
    ]);
  }

  async getDiscoveredWallets(promoted = false) {
    return this.query(
      'SELECT * FROM discovered_wallets WHERE promoted = ? ORDER BY profitability_score DESC',
      [promoted ? 1 : 0]
    );
  }

  async promoteDiscoveredWallet(address) {
    return this.run(
      'UPDATE discovered_wallets SET promoted = 1, promoted_date = CURRENT_TIMESTAMP WHERE address = ?',
      [address]
    );
  }

  async updateDiscoveredWalletStats(address, stats) {
    const sql = `UPDATE discovered_wallets SET 
      tracked_trades = ?,
      successful_tracked_trades = ?,
      estimated_win_rate = ?
      WHERE address = ?`;
    
    return this.run(sql, [
      stats.tracked_trades,
      stats.successful_tracked_trades,
      stats.estimated_win_rate,
      address
    ]);
  }

  // === TOKEN OPERATIONS ===

  async addOrUpdateToken(token) {
    // Use UPDATE with MAX() to handle race conditions properly
    // First try to update existing token
    const updateSql = `UPDATE tokens 
      SET current_price_usd = ?,
          max_price_usd = MAX(COALESCE(max_price_usd, 0), ?),
          market_cap_usd = ?,
          last_updated = CURRENT_TIMESTAMP
      WHERE address = ? AND chain = ?`;
    
    const updateResult = await this.run(updateSql, [
      token.current_price_usd,
      token.current_price_usd,  // Will be compared with existing max
      token.market_cap_usd,
      token.address,
      token.chain
    ]);
    
    // If no rows updated, insert new token
    if (updateResult.changes === 0) {
      const insertSql = `INSERT OR IGNORE INTO tokens 
        (address, chain, symbol, name, decimals, creation_time, 
         initial_liquidity_usd, current_price_usd, max_price_usd, 
         market_cap_usd, last_updated) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
      
      return this.run(insertSql, [
        token.address,
        token.chain,
        token.symbol,
        token.name,
        token.decimals || 18,
        token.creation_time,
        token.initial_liquidity_usd,
        token.current_price_usd,
        token.current_price_usd,  // max_price starts at current
        token.market_cap_usd
      ]);
    }
    
    return updateResult;
  }

  async getToken(address) {
    return this.get('SELECT * FROM tokens WHERE address = ?', [address]);
  }

  // === STRATEGY PERFORMANCE OPERATIONS ===

  async recordStrategyPerformance(strategy, metrics) {
    const sql = `INSERT OR REPLACE INTO strategy_performance 
      (strategy_type, date, trades_count, wins, losses, total_pnl, 
       allocated_capital, current_capital, roi_percentage, sharpe_ratio, max_drawdown) 
      VALUES (?, DATE('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    return this.run(sql, [
      strategy,
      metrics.trades_count,
      metrics.wins,
      metrics.losses,
      metrics.total_pnl,
      metrics.allocated_capital,
      metrics.current_capital,
      metrics.roi_percentage,
      metrics.sharpe_ratio,
      metrics.max_drawdown
    ]);
  }

  async getStrategyPerformance(strategyType, days = 30) {
    return this.query(
      `SELECT * FROM strategy_performance 
       WHERE strategy_type = ? AND date >= DATE('now', '-${days} days')
       ORDER BY date DESC`,
      [strategyType]
    );
  }

  // === SYSTEM STATE OPERATIONS ===

  async getSystemState(key) {
    const row = await this.get('SELECT value FROM system_state WHERE key = ?', [key]);
    return row ? row.value : null;
  }

  async setSystemState(key, value) {
    return this.run(
      'INSERT OR REPLACE INTO system_state (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [key, value]
    );
  }

  // === ANALYTICS OPERATIONS ===

  async getOverallPerformance() {
    const trades = await this.query('SELECT * FROM paper_trades WHERE status = \'closed\'');
    const openTrades = await this.query('SELECT * FROM paper_trades WHERE status = \'open\'');
    
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const wins = trades.filter(t => t.pnl > 0).length;
    const losses = trades.filter(t => t.pnl <= 0).length;
    const winRate = trades.length > 0 ? wins / trades.length : 0;

    const totalCapital = parseFloat(await this.getSystemState('total_capital')) || 10000;
    const currentCapital = totalCapital + totalPnl;
    const roi = ((currentCapital - totalCapital) / totalCapital) * 100;

    return {
      totalTrades: trades.length,
      openTrades: openTrades.length,
      wins,
      losses,
      winRate,
      totalPnl,
      totalCapital,
      currentCapital,
      roi
    };
  }

  async getTopPerformingWallets(limit = 5) {
    return this.query(
      'SELECT * FROM wallets WHERE status = \'active\' ORDER BY total_pnl DESC LIMIT ?',
      [limit]
    );
  }

  // Close database connection
  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else {
            console.log('✓ Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

// Export singleton instance
const db = new Database();

// If running as main script, initialize database
if (require.main === module) {
  const walletSeeds = require('../config/walletSeeds');
  
  db.init()
    .then(async () => {
      console.log('\n✓ Initializing seed wallets...');
      
      // Add arbitrage wallets
      for (const wallet of walletSeeds.arbitrage) {
        await db.addWallet({
          ...wallet,
          strategy_type: 'arbitrage',
          status: 'active'
        });
      }
      console.log(`✓ Added ${walletSeeds.arbitrage.length} arbitrage wallets`);
      
      // Add memecoin wallets
      for (const wallet of walletSeeds.memecoin) {
        await db.addWallet({
          ...wallet,
          strategy_type: 'memecoin',
          status: 'active'
        });
      }
      console.log(`✓ Added ${walletSeeds.memecoin.length} memecoin wallets`);
      
      // Add early gem wallets
      for (const wallet of walletSeeds.earlyGem) {
        await db.addWallet({
          ...wallet,
          strategy_type: 'earlyGem',
          status: 'active'
        });
      }
      console.log(`✓ Added ${walletSeeds.earlyGem.length} early gem wallets`);
      
      console.log('\n✓ Database initialization complete!\n');
      
      await db.close();
      process.exit(0);
    })
    .catch(err => {
      console.error('Database initialization failed:', err);
      process.exit(1);
    });
}

module.exports = db;


