const config = require('../../config/config');

/**
 * Volume Breakout Strategy
 * Detects unusual buying activity and volume spikes
 * 
 * Strategy Rules:
 * - Track volume per token over time
 * - Enter when volume is 3x normal
 * - Require multiple buyers (not single whale)
 * - Exit on take profit or volume decline
 */
class VolumeBreakoutStrategy {
  constructor(db) {
    this.db = db;
    this.config = config.strategies.volumeBreakout;
    this.name = 'volumeBreakout';
    this.volumeTracker = new Map(); // Track recent volume per token
  }

  /**
   * Evaluate if we should enter based on volume breakout
   */
  async evaluateTrade(transaction, wallet) {
    if (transaction.action !== 'buy') {
      return { shouldCopy: false, reason: 'Not a buy transaction' };
    }

    // Check if token has unusual volume
    const volumeData = await this.getTokenVolumeData(
      transaction.token_address,
      transaction.chain
    );

    if (!volumeData.isBreakout) {
      return { 
        shouldCopy: false, 
        reason: `Normal volume (${volumeData.buyerCount} buyers, ${volumeData.volumeMultiple.toFixed(1)}x)` 
      };
    }

    // Check minimum buyer count (avoid single whale pumps)
    if (volumeData.buyerCount < this.config.minBuyerCount) {
      return { 
        shouldCopy: false, 
        reason: `Not enough buyers (${volumeData.buyerCount} < ${this.config.minBuyerCount})` 
      };
    }

    // Check capacity
    const openTrades = await this.db.getOpenTrades(this.name);
    if (openTrades.length >= this.config.maxConcurrentTrades) {
      return { shouldCopy: false, reason: 'Max concurrent trades reached' };
    }

    // Check available capital
    const availableCapital = await this.getAvailableCapital();
    if (availableCapital < this.config.maxPerTrade * 0.5) {
      return { shouldCopy: false, reason: 'Insufficient capital' };
    }

    // Check if we already have a position in this token
    const existingPosition = openTrades.find(t => 
      t.token_address === transaction.token_address && 
      t.chain === transaction.chain
    );
    
    if (existingPosition) {
      return { shouldCopy: false, reason: 'Already have position in this token' };
    }

    // Position size based on volume strength
    let positionSize = this.config.maxPerTrade;
    
    // If volume is in $ terms (has prices), scale appropriately
    if (volumeData.recentVolume > 10000) {
      if (volumeData.volumeMultiple >= 5) {
        positionSize *= 1.2; // Increase size for strong breakouts
      }
    } else {
      // Low volume or no price data - use minimum size
      positionSize = Math.min(100, this.config.maxPerTrade);
    }
    
    positionSize = Math.min(positionSize, availableCapital);

    return {
      shouldCopy: true,
      positionSize,
      reason: `Volume breakout: ${volumeData.volumeMultiple.toFixed(1)}x normal, ${volumeData.buyerCount} buyers in ${this.config.timeWindow/3600}h`,
      confidence: volumeData.volumeMultiple >= 5 ? 'high' : 'medium'
    };
  }

  /**
   * Get token volume data and detect breakouts
   */
  async getTokenVolumeData(tokenAddress, chain) {
    try {
      const timeWindowSeconds = this.config.timeWindow;
      
      // Get recent transactions for this token
      const recentTxs = await this.db.query(`
        SELECT 
          wallet_address,
          action,
          total_value_usd,
          timestamp
        FROM transactions
        WHERE 
          token_address = ?
          AND chain = ?
          AND timestamp >= datetime('now', '-' || ? || ' seconds')
        ORDER BY timestamp DESC
      `, [tokenAddress, chain, timeWindowSeconds]);

      // Get historical average (last 7 days, excluding recent window)
      const historicalTxs = await this.db.query(`
        SELECT COUNT(*) as count, SUM(total_value_usd) as volume
        FROM transactions
        WHERE 
          token_address = ?
          AND chain = ?
          AND action = 'buy'
          AND timestamp >= datetime('now', '-7 days')
          AND timestamp < datetime('now', '-' || ? || ' seconds')
      `, [tokenAddress, chain, timeWindowSeconds]);

      // Calculate metrics
      const recentBuys = recentTxs.filter(tx => tx.action === 'buy');
      const recentVolume = recentBuys.reduce((sum, tx) => sum + (tx.total_value_usd || 0), 0);
      const buyerCount = new Set(recentBuys.map(tx => tx.wallet_address)).size;
      
      const historicalVolume = historicalTxs[0]?.volume || 0;
      const historicalCount = historicalTxs[0]?.count || 0;
      
      // Calculate average volume per time window
      const historicalAvgPerWindow = historicalVolume / (7 * 24 * 3600 / timeWindowSeconds);
      
      // Calculate volume multiple
      const volumeMultiple = historicalAvgPerWindow > 0 
        ? recentVolume / historicalAvgPerWindow 
        : recentVolume > 1000 ? 5 : 1; // If no history, require significant volume

      const isBreakout = volumeMultiple >= this.config.volumeMultiplier;

      return {
        isBreakout,
        volumeMultiple,
        buyerCount,
        recentVolume,
        historicalAvgPerWindow
      };
    } catch (error) {
      console.error('Error calculating volume data:', error.message);
      return {
        isBreakout: false,
        volumeMultiple: 0,
        buyerCount: 0,
        recentVolume: 0,
        historicalAvgPerWindow: 0
      };
    }
  }

  /**
   * Get exit strategy (SYNCHRONOUS - volume check removed for reliability)
   */
  getExitStrategy(trade, currentPrice) {
    const entryPrice = trade.entry_price;
    const priceChange = (currentPrice - entryPrice) / entryPrice;
    
    // Stop loss
    if (priceChange <= -this.config.stopLoss) {
      return {
        shouldExit: true,
        sellPercentage: 1.0,
        reason: `Stop loss at ${(priceChange * 100).toFixed(1)}%`,
        exitType: 'stop_loss'
      };
    }

    // Take profit
    if (priceChange >= this.config.takeProfit) {
      return {
        shouldExit: true,
        sellPercentage: 1.0,
        reason: `Take profit at ${(priceChange * 100).toFixed(1)}%`,
        exitType: 'take_profit'
      };
    }

    // Time-based exit: close after 48 hours if not hitting targets
    const entryTime = new Date(trade.entry_time).getTime();
    const holdTime = (Date.now() - entryTime) / (1000 * 60 * 60); // hours
    
    if (holdTime >= 48 && priceChange < 0.30) {
      return {
        shouldExit: true,
        sellPercentage: 1.0,
        reason: 'Closing after 48h without strong movement',
        exitType: 'time_based'
      };
    }

    return {
      shouldExit: false,
      reason: 'Holding for breakout continuation'
    };
  }

  /**
   * Check if volume has declined significantly
   */
  async checkVolumeDecline(trade) {
    try {
      const volumeData = await this.getTokenVolumeData(trade.token_address, trade.chain);
      return volumeData.volumeMultiple < 1.5; // Less than 1.5x normal
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available capital
   */
  async getAvailableCapital() {
    const openTrades = await this.db.getOpenTrades(this.name);
    const usedCapital = openTrades.reduce((sum, trade) => sum + trade.entry_value_usd, 0);
    return Math.max(0, this.config.allocation - usedCapital);
  }

  /**
   * Get strategy performance
   */
  async getPerformance() {
    const trades = await this.db.query(
      'SELECT * FROM paper_trades WHERE strategy_used = ? AND status = \'closed\'',
      [this.name]
    );

    const wins = trades.filter(t => (t.pnl || 0) > 0).length;
    const losses = trades.filter(t => (t.pnl || 0) <= 0).length;
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winRate = trades.length > 0 ? wins / trades.length : 0;

    const avgWin = wins > 0 ? trades.filter(t => (t.pnl || 0) > 0).reduce((sum, t) => sum + (t.pnl || 0), 0) / wins : 0;
    const avgLoss = losses > 0 ? Math.abs(trades.filter(t => (t.pnl || 0) <= 0).reduce((sum, t) => sum + (t.pnl || 0), 0) / losses) : 0;

    const currentCapital = this.config.allocation + totalPnl;
    const roi = (totalPnl / this.config.allocation) * 100;

    return {
      strategy: this.name,
      totalTrades: trades.length,
      wins,
      losses,
      winRate,
      totalPnl,
      avgWin,
      avgLoss,
      profitFactor: avgLoss > 0 ? avgWin / avgLoss : avgWin,
      initialCapital: this.config.allocation,
      currentCapital,
      roi
    };
  }
}

module.exports = VolumeBreakoutStrategy;

