const config = require('../../config/config');

/**
 * Early Gem Strategy
 * Focus on new token launches (<24h old)
 * 
 * Strategy Rules:
 * - Only copy wallets with >70% win rate
 * - Token must be < 24 hours old
 * - Minimum liquidity requirement
 * - Medium stop loss (30%)
 * - Take profit at 3x
 * - Max 10 concurrent positions
 */
class EarlyGemStrategy {
  constructor(db) {
    this.db = db;
    this.config = config.strategies.earlyGem;
    this.name = 'earlyGem';
  }

  /**
   * Evaluate if we should copy a transaction
   */
  async evaluateTrade(transaction, wallet) {
    if (transaction.action !== 'buy') {
      return { shouldCopy: false, reason: 'Not a buy transaction' };
    }

    // Strict wallet performance requirement
    if (wallet.win_rate < this.config.onlyFollowWalletsWithWinRate) {
      return { 
        shouldCopy: false, 
        reason: `Wallet win rate ${(wallet.win_rate * 100).toFixed(1)}% below required ${(this.config.onlyFollowWalletsWithWinRate * 100)}%` 
      };
    }

    // Check token age
    const tokenAge = await this.getTokenAge(transaction.token_address, transaction.chain);
    if (tokenAge === null || tokenAge > this.config.tokenAgeLimit) {
      return { 
        shouldCopy: false, 
        reason: `Token too old (${tokenAge}h) or age unknown` 
      };
    }

    // Check liquidity
    const liquidity = await this.getTokenLiquidity(transaction.token_address, transaction.chain);
    if (liquidity !== null && liquidity < this.config.minLiquidity) {
      return { 
        shouldCopy: false, 
        reason: `Insufficient liquidity ($${liquidity})` 
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

    // Check for rug pull indicators
    const rugRisk = await this.assessRugPullRisk(transaction.token_address, transaction.chain);
    if (rugRisk.level === 'high') {
      return { 
        shouldCopy: false, 
        reason: `High rug risk: ${rugRisk.factors.join(', ')}` 
      };
    }

    return {
      shouldCopy: true,
      positionSize: this.calculatePositionSize(transaction, wallet),
      reason: `Elite wallet (${(wallet.win_rate * 100).toFixed(1)}% WR) entering fresh token (${tokenAge}h old)`,
      confidence: wallet.win_rate >= 0.75 ? 'high' : 'medium'
    };
  }

  /**
   * Get token age in hours
   */
  async getTokenAge(tokenAddress, chain) {
    try {
      const token = await this.db.getToken(tokenAddress);
      
      if (!token || !token.creation_time) {
        // Try to fetch from first transaction
        const firstTx = await this.db.query(
          'SELECT MIN(timestamp) as first_seen FROM transactions WHERE token_address = ? AND chain = ?',
          [tokenAddress, chain]
        );
        
        if (firstTx[0]?.first_seen) {
          const age = (Date.now() - new Date(firstTx[0].first_seen).getTime()) / (1000 * 60 * 60);
          return age;
        }
        
        return null; // Unknown age
      }
      
      const ageMs = Date.now() - new Date(token.creation_time).getTime();
      return ageMs / (1000 * 60 * 60); // Convert to hours
    } catch (error) {
      console.error('Error getting token age:', error.message);
      return null;
    }
  }

  /**
   * Get token liquidity
   */
  async getTokenLiquidity(tokenAddress, chain) {
    try {
      const token = await this.db.getToken(tokenAddress);
      return token?.initial_liquidity_usd || null;
    } catch (error) {
      console.error('Error getting token liquidity:', error.message);
      return null;
    }
  }

  /**
   * Assess rug pull risk
   */
  async assessRugPullRisk(tokenAddress, chain) {
    const risk = {
      level: 'low',
      score: 0,
      factors: []
    };

    // Check number of holders (would need chain query)
    // Simplified here
    
    // Check liquidity lock (would need contract query)
    // Simplified here
    
    // Check contract verification
    // Simplified here
    
    // Check if many wallets are exiting
    const recentSells = await this.db.query(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE 
        token_address = ?
        AND chain = ?
        AND action = 'sell'
        AND timestamp >= datetime('now', '-1 hour')
    `, [tokenAddress, chain]);

    const sellCount = recentSells[0]?.count || 0;
    if (sellCount > 10) {
      risk.score += 30;
      risk.factors.push('High sell pressure');
    }

    if (risk.score >= 50) risk.level = 'high';
    else if (risk.score >= 25) risk.level = 'medium';
    else risk.level = 'low';

    return risk;
  }

  /**
   * Calculate position size
   */
  calculatePositionSize(transaction, wallet) {
    let size = this.config.maxPerTrade;

    // Scale up for elite wallets
    if (wallet.win_rate >= 0.80) {
      size *= 1.3;
    } else if (wallet.win_rate >= 0.75) {
      size *= 1.15;
    }

    return Math.min(size, this.config.maxPerTrade * 1.5);
  }

  /**
   * Get exit strategy
   */
  getExitStrategy(trade, currentPrice) {
    const entryPrice = trade.entry_price;
    const priceMultiple = currentPrice / entryPrice;
    const priceChange = (currentPrice - entryPrice) / entryPrice;
    
    // Stop loss
    if (priceChange <= -this.config.stopLoss) {
      return {
        shouldExit: true,
        sellPercentage: 1.0,
        reason: 'Stop loss triggered (-30%)',
        exitType: 'stop_loss'
      };
    }

    // Take profit at 3x
    if (priceMultiple >= this.config.takeProfit) {
      // Sell 70%, let 30% ride
      return {
        shouldExit: true,
        sellPercentage: 0.7,
        reason: 'Take profit at 3x (selling 70%)',
        exitType: 'take_profit'
      };
    }

    // If we're at 5x+, sell remaining 30%
    if (priceMultiple >= 5 && trade.notes && trade.notes.includes('partial_exit')) {
      return {
        shouldExit: true,
        sellPercentage: 1.0,
        reason: 'Final exit at 5x+',
        exitType: 'take_profit_final'
      };
    }

    // Check if token is dumping after initial pump
    const entryTime = new Date(trade.entry_time).getTime();
    const holdTime = (Date.now() - entryTime) / (1000 * 60 * 60);
    
    if (holdTime > 48 && priceChange < 0.5) {
      return {
        shouldExit: true,
        sellPercentage: 1.0,
        reason: 'No significant movement after 48h',
        exitType: 'time_based'
      };
    }

    return {
      shouldExit: false,
      reason: 'Hold position'
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

    const hit3x = trades.filter(t => (t.pnl_percentage || 0) >= 200).length;
    const hit5x = trades.filter(t => (t.pnl_percentage || 0) >= 400).length;

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
      hit3xCount: hit3x,
      hit5xCount: hit5x,
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
      level: 'medium',
      score: 40,
      factors: ['New token - limited price history']
    };

    // Elite wallet reduces risk
    if (wallet.win_rate >= 0.80) {
      risk.score -= 15;
      risk.factors.push('Elite wallet (80%+ win rate)');
    }

    // Very new tokens are riskier
    // Would check token age here

    if (risk.score >= 60) risk.level = 'high';
    else if (risk.score >= 40) risk.level = 'medium';
    else risk.level = 'low';

    return risk;
  }
}

module.exports = EarlyGemStrategy;


