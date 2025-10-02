const config = require('../../config/config');

/**
 * Arbitrage Strategy
 * Conservative approach focused on consistent gains
 * 
 * Strategy Rules:
 * - Only copy trades above minimum threshold
 * - Tight stop loss (5%)
 * - Take profit at 20%
 * - Max 10 concurrent positions
 * - Trailing stop after 15% gain
 */
class ArbitrageStrategy {
  constructor(db) {
    this.db = db;
    this.config = config.strategies.arbitrage;
    this.name = 'arbitrage';
  }

  /**
   * Evaluate if we should copy a transaction
   */
  async evaluateTrade(transaction, wallet) {
    // Only interested in buy transactions
    if (transaction.action !== 'buy') {
      return { shouldCopy: false, reason: 'Not a buy transaction' };
    }

    // Check wallet is performing well
    if (wallet.win_rate < this.config.minWinRate) {
      return { shouldCopy: false, reason: 'Wallet win rate below threshold' };
    }

    // Check trade size threshold
    if (transaction.total_value_usd < this.config.copyThreshold) {
      return { shouldCopy: false, reason: 'Trade size below threshold' };
    }

    // Check if we have capacity for more positions
    const openTrades = await this.db.getOpenTrades(this.name);
    if (openTrades.length >= this.config.maxConcurrentTrades) {
      return { shouldCopy: false, reason: 'Max concurrent trades reached' };
    }

    // Check available capital
    const availableCapital = await this.getAvailableCapital();
    if (availableCapital < this.config.maxPerTrade) {
      return { shouldCopy: false, reason: 'Insufficient capital' };
    }

    // All checks passed
    return {
      shouldCopy: true,
      positionSize: Math.min(this.config.maxPerTrade, availableCapital * 0.1),
      reason: 'All criteria met'
    };
  }

  /**
   * Calculate position size
   */
  calculatePositionSize(transaction, wallet) {
    // Base position size
    let size = this.config.maxPerTrade;

    // Adjust based on wallet performance
    const performanceMultiplier = Math.min(wallet.win_rate / 0.6, 1.5);
    size *= performanceMultiplier;

    // Adjust based on trade confidence (transaction size)
    if (transaction.total_value_usd > 5000) {
      size *= 1.2; // Larger trades get more confidence
    }

    // Never exceed max per trade
    return Math.min(size, this.config.maxPerTrade);
  }

  /**
   * Get exit strategy for a position
   */
  getExitStrategy(trade, currentPrice) {
    const entryPrice = trade.entry_price;
    const priceChange = (currentPrice - entryPrice) / entryPrice;
    
    // Stop loss
    if (priceChange <= -this.config.stopLoss) {
      return {
        shouldExit: true,
        reason: 'Stop loss triggered',
        exitType: 'stop_loss'
      };
    }

    // Take profit
    if (priceChange >= this.config.takeProfit) {
      return {
        shouldExit: true,
        reason: 'Take profit target reached',
        exitType: 'take_profit'
      };
    }

    // Trailing stop (after 15% profit)
    if (priceChange >= 0.15) {
      const trailingStopPrice = entryPrice * (1 + priceChange - this.config.trailingStop);
      if (currentPrice < trailingStopPrice) {
        return {
          shouldExit: true,
          reason: 'Trailing stop triggered',
          exitType: 'trailing_stop'
        };
      }
    }

    // Check if source wallet has exited
    // This would require tracking the source wallet's current positions
    // Simplified here
    
    return {
      shouldExit: false,
      reason: 'Hold position'
    };
  }

  /**
   * Get available capital for this strategy
   */
  async getAvailableCapital() {
    // Calculate current capital usage
    const openTrades = await this.db.getOpenTrades(this.name);
    const usedCapital = openTrades.reduce((sum, trade) => sum + trade.entry_value_usd, 0);
    
    // Return remaining allocation
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
    const avgWin = wins > 0 ? trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / wins : 0;
    const avgLoss = losses > 0 ? Math.abs(trades.filter(t => t.pnl <= 0).reduce((sum, t) => sum + t.pnl, 0) / losses) : 0;

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

  /**
   * Risk assessment for new trade
   */
  assessRisk(trade, wallet) {
    const risk = {
      level: 'low',
      score: 0,
      factors: []
    };

    // Wallet performance risk
    if (wallet.win_rate < 0.65) {
      risk.score += 20;
      risk.factors.push('Wallet win rate below optimal');
    }

    // Position size risk
    const positionRatio = trade.entry_value_usd / this.config.allocation;
    if (positionRatio > 0.15) {
      risk.score += 15;
      risk.factors.push('Large position size');
    }

    // Token volatility risk (would need price history)
    // Simplified here
    
    // Concentration risk
    // Check if too many positions in similar assets
    
    if (risk.score < 20) risk.level = 'low';
    else if (risk.score < 40) risk.level = 'medium';
    else risk.level = 'high';

    return risk;
  }
}

module.exports = ArbitrageStrategy;


