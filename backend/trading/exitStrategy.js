const config = require('../../config/config');

/**
 * Exit Strategy Manager
 * Determines when to exit positions
 * Tracks source wallet exits
 * 
 * Exit Triggers:
 * - Stop loss hit
 * - Take profit target reached
 * - Source wallet exits
 * - Time-based exits
 * - Trend reversal detection
 */
class ExitStrategy {
  constructor(db) {
    this.db = db;
    this.walletExits = new Map(); // Track when source wallets exit
  }

  /**
   * Track wallet exit transactions
   */
  async trackWalletExits(transactions) {
    for (const tx of transactions) {
      if (tx.action === 'sell') {
        const key = `${tx.wallet_address}_${tx.token_address}`;
        
        if (!this.walletExits.has(key)) {
          this.walletExits.set(key, []);
        }
        
        this.walletExits.get(key).push({
          timestamp: new Date(tx.timestamp).getTime(),
          amount: tx.amount,
          price: tx.price_usd
        });
      }
    }
  }

  /**
   * Check if source wallet has exited
   */
  hasSourceWalletExited(trade) {
    const key = `${trade.source_wallet}_${trade.token_address}`;
    const exits = this.walletExits.get(key) || [];
    
    // Check if any exit happened after our entry
    const entryTime = new Date(trade.entry_time).getTime();
    const recentExits = exits.filter(e => e.timestamp > entryTime);
    
    return recentExits.length > 0;
  }

  /**
   * Determine exit strategy for a position
   * This is the master exit logic that combines all strategies
   */
  async determineExit(trade, currentPrice) {
    const entryPrice = trade.entry_price;
    const priceChange = (currentPrice - entryPrice) / entryPrice;
    const holdTime = (Date.now() - new Date(trade.entry_time).getTime()) / (1000 * 60 * 60); // hours
    
    // Priority 1: Source wallet exit (follow the alpha)
    if (this.hasSourceWalletExited(trade)) {
      return {
        shouldExit: true,
        reason: 'Source wallet has exited position',
        exitType: 'wallet_exit',
        priority: 'high'
      };
    }
    
    // Priority 2: Strategy-specific exit logic
    const strategyExit = await this.getStrategyExit(trade, currentPrice);
    if (strategyExit.shouldExit) {
      return strategyExit;
    }
    
    // Priority 3: Time-based deterioration
    const timeExit = this.checkTimeBased(trade, currentPrice, holdTime, priceChange);
    if (timeExit.shouldExit) {
      return timeExit;
    }
    
    // Priority 4: Trend reversal
    const trendExit = await this.checkTrendReversal(trade, currentPrice);
    if (trendExit.shouldExit) {
      return trendExit;
    }
    
    return {
      shouldExit: false,
      reason: 'Hold position',
      currentPnL: priceChange,
      holdTime
    };
  }

  /**
   * Get strategy-specific exit logic
   */
  async getStrategyExit(trade, currentPrice) {
    const strategy = trade.strategy_used;
    const entryPrice = trade.entry_price;
    const priceChange = (currentPrice - entryPrice) / entryPrice;
    
    // Get strategy config
    const strategyConfig = config.strategies[strategy];
    if (!strategyConfig) {
      return { shouldExit: false };
    }
    
    // Stop loss
    const stopLoss = strategyConfig.stopLoss;
    if (priceChange <= -stopLoss) {
      return {
        shouldExit: true,
        sellPercentage: 1.0,
        reason: `Stop loss triggered (${(stopLoss * 100).toFixed(0)}%)`,
        exitType: 'stop_loss',
        priority: 'high'
      };
    }
    
    // Take profit (varies by strategy)
    if (strategy === 'memecoin') {
      return this.handleMemecoinExit(trade, currentPrice, priceChange);
    } else if (strategy === 'earlyGem') {
      return this.handleEarlyGemExit(trade, currentPrice, priceChange);
    } else {
      return this.handleArbitrageExit(trade, currentPrice, priceChange, strategyConfig);
    }
  }

  /**
   * Handle memecoin tiered exits
   */
  handleMemecoinExit(trade, currentPrice, priceChange) {
    const priceMultiple = currentPrice / trade.entry_price;
    const tiers = config.strategies.memecoin.takeProfit;
    
    for (const tier of tiers) {
      if (priceMultiple >= tier.at) {
        const tierNote = `tier_${tier.at}`;
        if (!trade.notes || !trade.notes.includes(tierNote)) {
          return {
            shouldExit: true,
            sellPercentage: tier.sell,
            reason: `Take profit at ${tier.at}x (selling ${(tier.sell * 100).toFixed(0)}%)`,
            exitType: 'take_profit_tier',
            priority: 'medium',
            note: tierNote
          };
        }
      }
    }
    
    return { shouldExit: false };
  }

  /**
   * Handle early gem exits
   */
  handleEarlyGemExit(trade, currentPrice, priceChange) {
    const priceMultiple = currentPrice / trade.entry_price;
    
    // Take profit at 3x (sell 70%)
    if (priceMultiple >= 3 && (!trade.notes || !trade.notes.includes('partial_exit'))) {
      return {
        shouldExit: true,
        sellPercentage: 0.7,
        reason: 'Take profit at 3x (selling 70%)',
        exitType: 'take_profit_partial',
        priority: 'medium',
        note: 'partial_exit'
      };
    }
    
    // Final exit at 5x
    if (priceMultiple >= 5 && trade.notes && trade.notes.includes('partial_exit')) {
      return {
        shouldExit: true,
        sellPercentage: 1.0,
        reason: 'Final exit at 5x+',
        exitType: 'take_profit_final',
        priority: 'medium'
      };
    }
    
    return { shouldExit: false };
  }

  /**
   * Handle arbitrage exits
   */
  handleArbitrageExit(trade, currentPrice, priceChange, config) {
    // Take profit
    if (priceChange >= config.takeProfit) {
      return {
        shouldExit: true,
        sellPercentage: 1.0,
        reason: `Take profit at ${(config.takeProfit * 100).toFixed(0)}%`,
        exitType: 'take_profit',
        priority: 'medium'
      };
    }
    
    // Trailing stop (after 15% profit)
    if (priceChange >= 0.15 && config.trailingStop) {
      const trailingStopPrice = trade.entry_price * (1 + priceChange - config.trailingStop);
      if (currentPrice < trailingStopPrice) {
        return {
          shouldExit: true,
          sellPercentage: 1.0,
          reason: 'Trailing stop triggered',
          exitType: 'trailing_stop',
          priority: 'high'
        };
      }
    }
    
    return { shouldExit: false };
  }

  /**
   * Check time-based exits
   */
  checkTimeBased(trade, currentPrice, holdTime, priceChange) {
    const strategy = trade.strategy_used;
    
    // Memecoin max hold time
    if (strategy === 'memecoin') {
      const maxHold = config.strategies.memecoin.maxHoldTime;
      if (holdTime >= maxHold && priceChange < 0.5) {
        return {
          shouldExit: true,
          sellPercentage: 1.0,
          reason: `Max hold time ${maxHold}h reached with no movement`,
          exitType: 'time_based',
          priority: 'medium'
        };
      }
    }
    
    // Early gem time limit
    if (strategy === 'earlyGem') {
      if (holdTime >= 48 && priceChange < 0.5) {
        return {
          shouldExit: true,
          sellPercentage: 1.0,
          reason: 'No significant movement after 48h',
          exitType: 'time_based',
          priority: 'low'
        };
      }
    }
    
    // General stagnation check (7 days with minimal movement)
    if (holdTime >= 168 && Math.abs(priceChange) < 0.10) {
      return {
        shouldExit: true,
        sellPercentage: 1.0,
        reason: 'Position stagnant for 7 days',
        exitType: 'time_based',
        priority: 'low'
      };
    }
    
    return { shouldExit: false };
  }

  /**
   * Check for trend reversal
   */
  async checkTrendReversal(trade, currentPrice) {
    // Get recent price history for this token
    // Simplified: check if many tracked wallets are selling
    
    const recentSells = await this.db.query(`
      SELECT COUNT(*) as sell_count
      FROM transactions
      WHERE 
        token_address = ?
        AND action = 'sell'
        AND timestamp >= datetime('now', '-1 hour')
    `, [trade.token_address]);
    
    const sellCount = recentSells[0]?.sell_count || 0;
    
    // If many wallets are selling, consider exiting
    if (sellCount >= 5) {
      return {
        shouldExit: true,
        sellPercentage: 1.0,
        reason: 'Heavy selling detected from tracked wallets',
        exitType: 'trend_reversal',
        priority: 'high'
      };
    }
    
    return { shouldExit: false };
  }

  /**
   * Calculate optimal exit price
   */
  calculateOptimalExit(trade, currentPrice, marketConditions) {
    const entryPrice = trade.entry_price;
    const strategy = trade.strategy_used;
    
    // Get strategy config
    const strategyConfig = config.strategies[strategy];
    
    if (!strategyConfig) {
      return currentPrice;
    }
    
    // For limit orders, add small buffer
    const buffer = 0.001; // 0.1%
    return currentPrice * (1 - buffer);
  }

  /**
   * Get exit statistics
   */
  async getExitStats() {
    const exits = await this.db.query(`
      SELECT 
        exit_reason,
        COUNT(*) as count,
        AVG(pnl) as avg_pnl,
        SUM(pnl) as total_pnl
      FROM paper_trades
      WHERE status = 'closed' AND exit_reason IS NOT NULL
      GROUP BY exit_reason
      ORDER BY count DESC
    `);
    
    return exits;
  }

  /**
   * Clear old exit tracking data
   */
  clearOldData() {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    
    for (const [key, exits] of this.walletExits.entries()) {
      const filtered = exits.filter(e => e.timestamp >= cutoff);
      
      if (filtered.length === 0) {
        this.walletExits.delete(key);
      } else {
        this.walletExits.set(key, filtered);
      }
    }
  }
}

module.exports = ExitStrategy;


