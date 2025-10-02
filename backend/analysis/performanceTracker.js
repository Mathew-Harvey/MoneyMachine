const config = require('../../config/config');

/**
 * Performance Tracker
 * Tracks and analyzes performance of:
 * - Individual wallets
 * - Strategies
 * - Overall portfolio
 * 
 * Updates metrics and identifies trends
 */
class PerformanceTracker {
  constructor(db) {
    this.db = db;
  }

  /**
   * Update all performance metrics
   */
  async updateAllMetrics() {
    try {
      // Update wallet performance
      await this.updateWalletPerformance();
      
      // Update strategy performance
      await this.updateStrategyPerformance();
      
      // Update overall metrics
      await this.updateOverallMetrics();
      
    } catch (error) {
      console.error('Error updating performance metrics:', error.message);
    }
  }

  /**
   * Update performance metrics for all tracked wallets
   */
  async updateWalletPerformance() {
    const wallets = await this.db.getWallets();
    
    for (const wallet of wallets) {
      try {
        const metrics = await this.calculateWalletMetrics(wallet.address);
        await this.db.updateWalletPerformance(wallet.address, metrics);
      } catch (error) {
        console.error(`Error updating wallet ${wallet.address}:`, error.message);
      }
    }
  }

  /**
   * Calculate comprehensive metrics for a wallet
   */
  async calculateWalletMetrics(walletAddress) {
    // Get all trades from this wallet
    const trades = await this.db.query(`
      SELECT * FROM paper_trades
      WHERE source_wallet = ? AND status = 'closed'
      ORDER BY entry_time
    `, [walletAddress]);
    
    if (trades.length === 0) {
      return {
        win_rate: 0,
        total_pnl: 0,
        total_trades: 0,
        successful_trades: 0,
        avg_trade_size: 0,
        biggest_win: 0,
        biggest_loss: 0
      };
    }
    
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl <= 0);
    
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const avgTradeSize = trades.reduce((sum, t) => sum + t.entry_value_usd, 0) / trades.length;
    const biggestWin = wins.length > 0 ? Math.max(...wins.map(t => t.pnl)) : 0;
    const biggestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.pnl)) : 0;
    
    return {
      win_rate: wins.length / trades.length,
      total_pnl: totalPnl,
      total_trades: trades.length,
      successful_trades: wins.length,
      avg_trade_size: avgTradeSize,
      biggest_win: biggestWin,
      biggest_loss: biggestLoss
    };
  }

  /**
   * Update strategy performance metrics
   */
  async updateStrategyPerformance() {
    const strategies = ['arbitrage', 'memecoin', 'earlyGem', 'discovery'];
    
    for (const strategy of strategies) {
      try {
        const metrics = await this.calculateStrategyMetrics(strategy);
        await this.db.recordStrategyPerformance(strategy, metrics);
      } catch (error) {
        console.error(`Error updating strategy ${strategy}:`, error.message);
      }
    }
  }

  /**
   * Calculate metrics for a strategy
   */
  async calculateStrategyMetrics(strategyType) {
    const trades = await this.db.query(`
      SELECT * FROM paper_trades
      WHERE strategy_used = ? AND status = 'closed'
      ORDER BY entry_time
    `, [strategyType]);
    
    const openTrades = await this.db.getOpenTrades(strategyType);
    
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl <= 0);
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    
    const strategyConfig = config.strategies[strategyType];
    const allocatedCapital = strategyConfig ? strategyConfig.allocation : 0;
    const currentCapital = allocatedCapital + totalPnl;
    const roi = allocatedCapital > 0 ? (totalPnl / allocatedCapital) * 100 : 0;
    
    // Calculate Sharpe ratio
    const returns = trades.map(t => t.pnl_percentage / 100);
    const sharpeRatio = this.calculateSharpeRatio(returns);
    
    // Calculate max drawdown
    const maxDrawdown = this.calculateMaxDrawdown(trades, allocatedCapital);
    
    return {
      trades_count: trades.length,
      wins: wins.length,
      losses: losses.length,
      total_pnl: totalPnl,
      allocated_capital: allocatedCapital,
      current_capital: currentCapital,
      roi_percentage: roi,
      sharpe_ratio: sharpeRatio,
      max_drawdown: maxDrawdown
    };
  }

  /**
   * Calculate Sharpe ratio
   */
  calculateSharpeRatio(returns) {
    if (returns.length < 2) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    // Annualized Sharpe (assuming ~252 trading days)
    return (avgReturn / stdDev) * Math.sqrt(252);
  }

  /**
   * Calculate maximum drawdown
   */
  calculateMaxDrawdown(trades, initialCapital) {
    let peak = initialCapital;
    let maxDrawdown = 0;
    let runningCapital = initialCapital;
    
    for (const trade of trades) {
      runningCapital += trade.pnl;
      
      if (runningCapital > peak) {
        peak = runningCapital;
      }
      
      const drawdown = (peak - runningCapital) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  /**
   * Update overall portfolio metrics
   */
  async updateOverallMetrics() {
    const performance = await this.db.getOverallPerformance();
    
    // Store current capital
    await this.db.setSystemState('current_capital', performance.currentCapital.toString());
    await this.db.setSystemState('total_pnl', performance.totalPnl.toString());
    await this.db.setSystemState('roi', performance.roi.toString());
  }

  /**
   * Get performance comparison between wallets
   */
  async compareWallets(address1, address2) {
    const metrics1 = await this.calculateWalletMetrics(address1);
    const metrics2 = await this.calculateWalletMetrics(address2);
    
    return {
      wallet1: { address: address1, ...metrics1 },
      wallet2: { address: address2, ...metrics2 },
      comparison: {
        winRate: metrics1.win_rate - metrics2.win_rate,
        totalPnl: metrics1.total_pnl - metrics2.total_pnl,
        avgTradeSize: metrics1.avg_trade_size - metrics2.avg_trade_size
      }
    };
  }

  /**
   * Get performance leaderboard
   */
  async getLeaderboard(metric = 'total_pnl', limit = 10) {
    const validMetrics = ['total_pnl', 'win_rate', 'total_trades', 'biggest_win'];
    
    if (!validMetrics.includes(metric)) {
      metric = 'total_pnl';
    }
    
    return this.db.query(`
      SELECT 
        address,
        chain,
        strategy_type,
        win_rate,
        total_pnl,
        total_trades,
        successful_trades,
        biggest_win
      FROM wallets
      WHERE status = 'active'
      ORDER BY ${metric} DESC
      LIMIT ?
    `, [limit]);
  }

  /**
   * Get performance trends over time
   */
  async getPerformanceTrends(days = 30) {
    const trends = await this.db.query(`
      SELECT 
        DATE(entry_time) as date,
        COUNT(*) as trades,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
        SUM(pnl) as daily_pnl,
        AVG(pnl) as avg_pnl
      FROM paper_trades
      WHERE 
        status = 'closed'
        AND entry_time >= DATE('now', '-${days} days')
      GROUP BY DATE(entry_time)
      ORDER BY date
    `);
    
    return trends;
  }

  /**
   * Get strategy comparison
   */
  async getStrategyComparison() {
    const strategies = ['arbitrage', 'memecoin', 'earlyGem'];
    const comparison = [];
    
    for (const strategy of strategies) {
      const metrics = await this.calculateStrategyMetrics(strategy);
      comparison.push({
        strategy,
        ...metrics
      });
    }
    
    // Sort by ROI
    comparison.sort((a, b) => b.roi_percentage - a.roi_percentage);
    
    return comparison;
  }

  /**
   * Get wallet heat map data (performance by wallet)
   */
  async getWalletHeatMap() {
    const wallets = await this.db.getWallets();
    const heatMap = [];
    
    for (const wallet of wallets) {
      // Calculate recent performance (last 7 days)
      const recentTrades = await this.db.query(`
        SELECT * FROM paper_trades
        WHERE 
          source_wallet = ?
          AND status = 'closed'
          AND entry_time >= DATE('now', '-7 days')
      `, [wallet.address]);
      
      const recentPnl = recentTrades.reduce((sum, t) => sum + t.pnl, 0);
      const recentWins = recentTrades.filter(t => t.pnl > 0).length;
      const recentWinRate = recentTrades.length > 0 ? recentWins / recentTrades.length : 0;
      
      // Determine heat status
      let heat = 'cold';
      if (recentWinRate >= 0.70 && recentPnl > 0) {
        heat = 'hot';
      } else if (recentWinRate >= 0.50 && recentPnl > 0) {
        heat = 'warm';
      } else if (recentWinRate < 0.30 || recentPnl < -100) {
        heat = 'cold';
      }
      
      heatMap.push({
        address: wallet.address,
        chain: wallet.chain,
        strategy: wallet.strategy_type,
        heat,
        recentPnl,
        recentWinRate,
        recentTrades: recentTrades.length,
        overallWinRate: wallet.win_rate
      });
    }
    
    // Sort by heat (hot first)
    const heatOrder = { hot: 3, warm: 2, neutral: 1, cold: 0 };
    heatMap.sort((a, b) => heatOrder[b.heat] - heatOrder[a.heat]);
    
    return heatMap;
  }

  /**
   * Get performance alerts (wallets to watch/pause)
   */
  async getPerformanceAlerts() {
    const alerts = [];
    const wallets = await this.db.getWallets();
    
    for (const wallet of wallets) {
      // Check for underperformance
      if (wallet.win_rate < 0.40 && wallet.total_trades >= 10) {
        alerts.push({
          type: 'warning',
          wallet: wallet.address,
          message: `Low win rate: ${(wallet.win_rate * 100).toFixed(1)}%`,
          recommendation: 'Consider pausing this wallet'
        });
      }
      
      // Check for significant losses
      if (wallet.total_pnl < -500) {
        alerts.push({
          type: 'danger',
          wallet: wallet.address,
          message: `Significant losses: $${wallet.total_pnl.toFixed(2)}`,
          recommendation: 'Pause immediately'
        });
      }
      
      // Check for excellent performance
      if (wallet.win_rate >= 0.75 && wallet.total_trades >= 5) {
        alerts.push({
          type: 'success',
          wallet: wallet.address,
          message: `Excellent performance: ${(wallet.win_rate * 100).toFixed(1)}% win rate`,
          recommendation: 'Consider increasing allocation'
        });
      }
    }
    
    return alerts;
  }

  /**
   * Get detailed performance report
   */
  async getDetailedReport() {
    const overall = await this.db.getOverallPerformance();
    const strategyComparison = await this.getStrategyComparison();
    const leaderboard = await this.getLeaderboard();
    const heatMap = await this.getWalletHeatMap();
    const trends = await this.getPerformanceTrends(30);
    const alerts = await this.getPerformanceAlerts();
    
    return {
      overall,
      strategyComparison,
      leaderboard,
      heatMap,
      trends,
      alerts,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = PerformanceTracker;


