const config = require('../../config/config');

/**
 * Copy Trade Strategy
 * Simple wallet mirroring - copy successful traders
 * 
 * Strategy Rules:
 * - Follow wallets with 55%+ win rate
 * - Copy 10% of their trade size
 * - Simple stop loss and take profit
 * - Most accessible strategy for consistent returns
 */
class CopyTradeStrategy {
  constructor(db) {
    this.db = db;
    this.config = config.strategies.copyTrade;
    this.name = 'copyTrade';
  }

  /**
   * Evaluate if we should copy a transaction
   */
  async evaluateTrade(transaction, wallet) {
    if (transaction.action !== 'buy') {
      return { shouldCopy: false, reason: 'Not a buy transaction' };
    }

    // Check trade size (allow if price data unavailable)
    if (transaction.total_value_usd && transaction.total_value_usd > 0) {
      if (transaction.total_value_usd < this.config.minTradeSize) {
        return { 
          shouldCopy: false, 
          reason: `Trade too small ($${transaction.total_value_usd.toFixed(2)} < $${this.config.minTradeSize})` 
        };
      }
    } else {
      // No price data - check if amount is significant
      if (!transaction.amount || transaction.amount < 100) {
        return {
          shouldCopy: false,
          reason: 'Trade amount too small (no price data available)'
        };
      }
    }

    // Check wallet performance (relaxed threshold)
    // Note: new wallets without history (win_rate = null) are allowed to trade
    if (wallet.win_rate !== null && wallet.win_rate !== undefined && wallet.win_rate < this.config.minWalletWinRate) {
      return { 
        shouldCopy: false, 
        reason: `Wallet win rate ${(wallet.win_rate * 100).toFixed(1)}% below ${(this.config.minWalletWinRate * 100)}%` 
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

    // Calculate position size as percentage of their trade
    let positionSize;
    if (transaction.total_value_usd && transaction.total_value_usd > 0) {
      // We have price data - copy percentage of their trade
      positionSize = Math.min(
        transaction.total_value_usd * this.config.copyPercentage,
        this.config.maxPerTrade,
        availableCapital
      );
    } else {
      // No price data - use conservative fixed size
      positionSize = Math.min(50, availableCapital); // $50 for unknown tokens
    }

    // Confidence based on wallet performance
    let confidence = 'medium';
    if (wallet.win_rate !== null && wallet.win_rate !== undefined) {
      if (wallet.win_rate >= 0.65) confidence = 'high';
      else if (wallet.win_rate < 0.55) confidence = 'low';
    } else {
      confidence = 'low'; // New wallets with no history = low confidence
    }

    const winRateDisplay = wallet.win_rate !== null && wallet.win_rate !== undefined 
      ? `${(wallet.win_rate * 100).toFixed(0)}% WR` 
      : 'New wallet';
    
    const tradeValueDisplay = transaction.total_value_usd && transaction.total_value_usd > 0
      ? `$${transaction.total_value_usd.toFixed(0)}`
      : `${transaction.amount?.toFixed(0) || 'unknown'} tokens`;
    
    return {
      shouldCopy: true,
      positionSize,
      reason: `Mirroring ${wallet.address.substring(0, 10)}... (${winRateDisplay}, copying ${(this.config.copyPercentage * 100)}% of ${tradeValueDisplay})`,
      confidence
    };
  }

  /**
   * Get exit strategy
   */
  getExitStrategy(trade, currentPrice) {
    const entryPrice = trade.entry_price;
    const priceChange = (currentPrice - entryPrice) / entryPrice;
    
    // Stop loss
    if (priceChange <= -this.config.stopLoss) {
      return {
        shouldExit: true,
        sellPercentage: 1.0,
        reason: `Stop loss triggered (${(priceChange * 100).toFixed(1)}%)`,
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

    // Trailing stop after 30% profit
    if (priceChange >= 0.30) {
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
      reason: 'Holding position'
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

module.exports = CopyTradeStrategy;

