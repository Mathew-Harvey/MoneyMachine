const config = require('../../config/config');

/**
 * Smart Money Strategy
 * Follow whales and high-value traders
 * 
 * Strategy Rules:
 * - Only copy large trades ($5k+)
 * - Track wallet balance (whales with $100k+)
 * - Assume large traders have better information
 * - Tighter stop loss, moderate take profit
 */
class SmartMoneyStrategy {
  constructor(db) {
    this.db = db;
    this.config = config.strategies.smartMoney;
    this.name = 'smartMoney';
    this.walletBalanceCache = new Map();
  }

  /**
   * Evaluate if we should copy a whale trade
   */
  async evaluateTrade(transaction, wallet) {
    if (transaction.action !== 'buy') {
      return { shouldCopy: false, reason: 'Not a buy transaction' };
    }

    // Check if this is a large trade (whale-sized)
    // Skip this strategy if we don't have price data (can't verify it's a whale trade)
    if (!transaction.total_value_usd || transaction.total_value_usd === 0) {
      return {
        shouldCopy: false,
        reason: 'No price data - cannot verify whale trade size'
      };
    }
    
    if (transaction.total_value_usd < this.config.minTradeSize) {
      return { 
        shouldCopy: false, 
        reason: `Trade too small ($${transaction.total_value_usd.toFixed(0)} < $${this.config.minTradeSize})` 
      };
    }

    // Check wallet balance (is this actually a whale?)
    const walletBalance = await this.getWalletBalance(wallet);
    if (walletBalance < this.config.minWalletBalance) {
      return { 
        shouldCopy: false, 
        reason: `Wallet balance too low ($${walletBalance.toFixed(0)} < $${this.config.minWalletBalance})` 
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

    // Position sizing: larger trades get more capital
    let positionSize = this.config.maxPerTrade;
    if (transaction.total_value_usd >= 50000) {
      positionSize *= 1.3; // 30% more for very large trades
    } else if (transaction.total_value_usd >= 20000) {
      positionSize *= 1.15; // 15% more for large trades
    }
    positionSize = Math.min(positionSize, availableCapital);

    // Confidence based on trade size relative to wallet
    const tradeToBalanceRatio = transaction.total_value_usd / walletBalance;
    let confidence = 'medium';
    if (tradeToBalanceRatio >= 0.10) confidence = 'high'; // Whale is confident (10%+ of portfolio)
    else if (tradeToBalanceRatio < 0.02) confidence = 'low'; // Small position for them

    return {
      shouldCopy: true,
      positionSize,
      reason: `Whale trade: $${transaction.total_value_usd.toFixed(0)} (${(tradeToBalanceRatio * 100).toFixed(1)}% of $${walletBalance.toFixed(0)} portfolio)`,
      confidence
    };
  }

  /**
   * Get wallet balance (with caching)
   */
  async getWalletBalance(wallet) {
    // Check cache first (5 minute expiry)
    const cached = this.walletBalanceCache.get(wallet.address);
    if (cached && Date.now() - cached.timestamp < 300000) {
      return cached.balance;
    }

    try {
      // Calculate balance from recent transactions
      const recentTxs = await this.db.query(`
        SELECT total_value_usd, action
        FROM transactions
        WHERE 
          wallet_address = ?
          AND timestamp >= datetime('now', '-30 days')
        ORDER BY timestamp DESC
        LIMIT 100
      `, [wallet.address]);

      // Estimate balance from transaction volume
      // This is approximate - in production you'd query blockchain directly
      const totalVolume = recentTxs.reduce((sum, tx) => sum + (tx.total_value_usd || 0), 0);
      const avgTradeSize = recentTxs.length > 0 ? totalVolume / recentTxs.length : 0;
      
      // Estimate: assume they can do 20-50 trades of average size
      const estimatedBalance = avgTradeSize * 30;

      // Cache the result
      this.walletBalanceCache.set(wallet.address, {
        balance: estimatedBalance,
        timestamp: Date.now()
      });

      // Clean cache if it gets too large
      if (this.walletBalanceCache.size > 100) {
        const entries = Array.from(this.walletBalanceCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        entries.slice(0, 50).forEach(([key]) => this.walletBalanceCache.delete(key));
      }

      return estimatedBalance;
    } catch (error) {
      console.error('Error estimating wallet balance:', error.message);
      return this.config.minWalletBalance; // Return minimum to allow trade
    }
  }

  /**
   * Get exit strategy with trailing stop
   */
  getExitStrategy(trade, currentPrice) {
    const entryPrice = trade.entry_price;
    const priceChange = (currentPrice - entryPrice) / entryPrice;
    
    // Stop loss (tighter for smart money)
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

    // Trailing stop after 20% profit
    if (priceChange >= 0.20) {
      const peakPrice = trade.peak_price || currentPrice;
      const drawdownFromPeak = (currentPrice - peakPrice) / peakPrice;
      
      if (drawdownFromPeak <= -this.config.trailingStop) {
        return {
          shouldExit: true,
          sellPercentage: 1.0,
          reason: `Trailing stop from peak (${(drawdownFromPeak * 100).toFixed(1)}%)`,
          exitType: 'trailing_stop'
        };
      }
      
      // Update peak price
      if (currentPrice > peakPrice) {
        this.db.run(
          'UPDATE paper_trades SET peak_price = ? WHERE id = ?',
          [currentPrice, trade.id]
        ).catch(() => {});
      }
    }

    return {
      shouldExit: false,
      reason: 'Following smart money'
    };
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
    
    const biggestWin = trades.length > 0 ? Math.max(...trades.map(t => t.pnl || 0), 0) : 0;
    const biggestLoss = trades.length > 0 ? Math.min(...trades.map(t => t.pnl || 0), 0) : 0;

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
      biggestLoss,
      profitFactor: avgLoss > 0 ? avgWin / avgLoss : avgWin,
      initialCapital: this.config.allocation,
      currentCapital,
      roi
    };
  }
}

module.exports = SmartMoneyStrategy;

