const config = require('../../config/config');

/**
 * Memecoin Strategy
 * High risk/reward approach for volatile memecoins
 * 
 * Strategy Rules:
 * - Need 2+ wallets buying same token within 1 hour
 * - Small position sizes ($100 max)
 * - Wide stop loss (50%)
 * - Tiered take profits (2x, 10x, 100x)
 * - Max hold time 72 hours
 * - Let winners run, cut losers fast
 */
class MemeStrategy {
  constructor(db) {
    this.db = db;
    this.config = config.strategies.memecoin;
    this.name = 'memecoin';
    this.recentBuys = new Map(); // Track recent buys by token
  }

  /**
   * Evaluate if we should copy a transaction
   */
  async evaluateTrade(transaction, wallet) {
    if (transaction.action !== 'buy') {
      return { shouldCopy: false, reason: 'Not a buy transaction' };
    }

    // Check wallet performance (lower threshold for memecoin wallets)
    if (wallet.win_rate < this.config.minWinRate) {
      return { shouldCopy: false, reason: 'Wallet win rate too low' };
    }

    // Check for coordinated buying (multiple wallets buying same token)
    const buySignals = await this.checkCoordinatedBuying(transaction);
    if (buySignals < this.config.copyThreshold) {
      // Track this buy for future coordination checks
      this.trackBuy(transaction);
      return { 
        shouldCopy: false, 
        reason: `Need ${this.config.copyThreshold} wallets, only ${buySignals} detected` 
      };
    }

    // Check capacity
    const openTrades = await this.db.getOpenTrades(this.name);
    if (openTrades.length >= this.config.maxConcurrentTrades) {
      return { shouldCopy: false, reason: 'Max concurrent trades reached' };
    }

    // Check available capital
    const availableCapital = await this.getAvailableCapital();
    if (availableCapital < this.config.maxPerTrade) {
      return { shouldCopy: false, reason: 'Insufficient capital' };
    }

    // All checks passed - enter with small position
    return {
      shouldCopy: true,
      positionSize: this.config.maxPerTrade,
      reason: `${buySignals} wallets buying - coordinated signal`,
      confidence: 'high'
    };
  }

  /**
   * Check for coordinated buying across tracked wallets
   */
  async checkCoordinatedBuying(transaction) {
    const timeWindow = this.config.copyTimeWindow * 1000; // Convert to ms
    const now = new Date(transaction.timestamp).getTime();
    
    // Query recent buys of same token
    const recentBuys = await this.db.query(`
      SELECT COUNT(DISTINCT wallet_address) as count
      FROM transactions
      WHERE 
        token_address = ?
        AND action = 'buy'
        AND timestamp >= datetime('now', '-${this.config.copyTimeWindow} seconds')
    `, [transaction.token_address]);

    return recentBuys[0]?.count || 0;
  }

  /**
   * Track a buy for coordination detection
   */
  trackBuy(transaction) {
    const key = transaction.token_address;
    
    if (!this.recentBuys.has(key)) {
      this.recentBuys.set(key, []);
    }
    
    this.recentBuys.get(key).push({
      wallet: transaction.wallet_address,
      timestamp: new Date(transaction.timestamp).getTime()
    });

    // Clean old entries
    this.cleanOldBuys();
  }

  /**
   * Clean old buy tracking data
   */
  cleanOldBuys() {
    const cutoff = Date.now() - (this.config.copyTimeWindow * 1000);
    
    for (const [token, buys] of this.recentBuys.entries()) {
      const filtered = buys.filter(b => b.timestamp >= cutoff);
      
      if (filtered.length === 0) {
        this.recentBuys.delete(token);
      } else {
        this.recentBuys.set(token, filtered);
      }
    }
  }

  /**
   * Get exit strategy with tiered take profits
   */
  getExitStrategy(trade, currentPrice) {
    const entryPrice = trade.entry_price;
    const priceMultiple = currentPrice / entryPrice;
    const priceChange = (currentPrice - entryPrice) / entryPrice;
    
    // Stop loss
    if (priceChange <= -this.config.stopLoss) {
      return {
        shouldExit: true,
        sellPercentage: 1.0, // Sell 100%
        reason: 'Stop loss triggered (-50%)',
        exitType: 'stop_loss'
      };
    }

    // Tiered take profits
    for (const tier of this.config.takeProfit) {
      if (priceMultiple >= tier.at) {
        // Check if we've already taken profit at this tier
        const notes = trade.notes || '';
        if (!notes.includes(`tier_${tier.at}`)) {
          return {
            shouldExit: true,
            sellPercentage: tier.sell,
            reason: `Take profit at ${tier.at}x`,
            exitType: 'take_profit_tier',
            note: `tier_${tier.at}`
          };
        }
      }
    }

    // Time-based exit
    const entryTime = new Date(trade.entry_time).getTime();
    const holdTime = (Date.now() - entryTime) / (1000 * 60 * 60); // Hours
    
    if (holdTime >= this.config.maxHoldTime) {
      // Exit if no movement after max hold time
      if (priceChange < 0.5) {
        return {
          shouldExit: true,
          sellPercentage: 1.0,
          reason: `Max hold time reached (${this.config.maxHoldTime}h) with no significant movement`,
          exitType: 'time_based'
        };
      }
    }

    return {
      shouldExit: false,
      reason: 'Hold and let winners run'
    };
  }

  /**
   * Calculate position size (always small for memecoins)
   */
  calculatePositionSize(transaction, wallet) {
    // Fixed small position size for memecoins
    // Don't scale up even for good wallets - memecoins are high risk
    return this.config.maxPerTrade;
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

    const wins = trades.filter(t => t.pnl > 0).length;
    const losses = trades.filter(t => t.pnl <= 0).length;
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const winRate = trades.length > 0 ? wins / trades.length : 0;

    // Calculate how many hit each tier
    const tier2x = trades.filter(t => t.pnl_percentage >= 100).length;
    const tier10x = trades.filter(t => t.pnl_percentage >= 900).length;
    const tier100x = trades.filter(t => t.pnl_percentage >= 9900).length;

    const avgWin = wins > 0 ? trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / wins : 0;
    const avgLoss = losses > 0 ? Math.abs(trades.filter(t => t.pnl <= 0).reduce((sum, t) => sum + t.pnl, 0) / losses) : 0;
    const biggestWin = trades.length > 0 ? Math.max(...trades.map(t => t.pnl)) : 0;

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
      biggestWin,
      profitFactor: avgLoss > 0 ? avgWin / avgLoss : avgWin,
      tier2xCount: tier2x,
      tier10xCount: tier10x,
      tier100xCount: tier100x,
      initialCapital: this.config.allocation,
      currentCapital,
      roi
    };
  }

  /**
   * Risk assessment
   */
  assessRisk(trade, wallet) {
    const risk = {
      level: 'high', // Memecoins are always high risk
      score: 60,
      factors: ['Memecoin inherently high volatility']
    };

    // Lower risk if multiple wallets buying
    const buyCount = this.recentBuys.get(trade.token_address)?.length || 0;
    if (buyCount >= 3) {
      risk.score -= 10;
      risk.factors.push(`${buyCount} wallets buying (strong signal)`);
    }

    // Check wallet track record with memecoins
    if (wallet.win_rate < 0.45) {
      risk.score += 15;
      risk.factors.push('Wallet has lower memecoin success rate');
    }

    if (risk.score >= 70) risk.level = 'very_high';
    else if (risk.score >= 50) risk.level = 'high';
    else risk.level = 'medium';

    return risk;
  }
}

module.exports = MemeStrategy;


