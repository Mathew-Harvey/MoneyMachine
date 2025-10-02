const config = require('../../config/config');

/**
 * Risk Manager
 * Validates trades before execution
 * Enforces risk limits and position sizing rules
 * 
 * Risk Checks:
 * - Maximum position size
 * - Maximum drawdown
 * - Daily loss limits
 * - Correlation limits
 * - Emergency stop
 */
class RiskManager {
  constructor(db) {
    this.db = db;
    this.config = config.risk;
  }

  /**
   * Check if a trade should be approved
   */
  async checkTrade(transaction, wallet, evaluation) {
    const checks = [];

    // 1. Position size check
    const positionCheck = await this.checkPositionSize(evaluation.positionSize);
    checks.push(positionCheck);

    // 2. Maximum drawdown check
    const drawdownCheck = await this.checkMaxDrawdown();
    checks.push(drawdownCheck);

    // 3. Daily loss limit check
    const dailyLossCheck = await this.checkDailyLoss();
    checks.push(dailyLossCheck);

    // 4. Correlation check
    const correlationCheck = await this.checkCorrelation(transaction);
    checks.push(correlationCheck);

    // 5. Emergency stop check
    const emergencyCheck = this.checkEmergencyStop();
    checks.push(emergencyCheck);

    // 6. Available capital check
    const capitalCheck = await this.checkAvailableCapital(evaluation.positionSize);
    checks.push(capitalCheck);

    // All checks must pass
    const allPassed = checks.every(check => check.passed);
    const failedChecks = checks.filter(check => !check.passed);

    return {
      approved: allPassed,
      reason: allPassed 
        ? 'All risk checks passed'
        : failedChecks.map(c => c.reason).join('; '),
      checks
    };
  }

  /**
   * Check position size doesn't exceed maximum
   */
  async checkPositionSize(positionSize) {
    const totalCapital = parseFloat(await this.db.getSystemState('total_capital')) || 10000;
    const performance = await this.db.getOverallPerformance();
    const currentCapital = performance.currentCapital || totalCapital;
    
    const maxPosition = currentCapital * this.config.maxPositionSize;
    
    return {
      name: 'Position Size',
      passed: positionSize <= maxPosition,
      reason: positionSize > maxPosition 
        ? `Position size $${positionSize} exceeds maximum $${maxPosition.toFixed(2)}`
        : 'Position size within limits',
      value: positionSize,
      limit: maxPosition
    };
  }

  /**
   * Check if we're within maximum drawdown limit
   */
  async checkMaxDrawdown() {
    const performance = await this.db.getOverallPerformance();
    const drawdown = (performance.totalCapital - performance.currentCapital) / performance.totalCapital;
    
    return {
      name: 'Maximum Drawdown',
      passed: drawdown <= this.config.maxDrawdown,
      reason: drawdown > this.config.maxDrawdown
        ? `Drawdown ${(drawdown * 100).toFixed(1)}% exceeds maximum ${(this.config.maxDrawdown * 100)}%`
        : 'Drawdown within acceptable range',
      value: drawdown,
      limit: this.config.maxDrawdown
    };
  }

  /**
   * Check daily loss limit
   */
  async checkDailyLoss() {
    const today = new Date().toISOString().split('T')[0];
    
    const todayTrades = await this.db.query(`
      SELECT SUM(pnl) as daily_pnl
      FROM paper_trades
      WHERE DATE(entry_time) = ? AND status = 'closed'
    `, [today]);
    
    const dailyPnl = todayTrades[0]?.daily_pnl || 0;
    const totalCapital = parseFloat(await this.db.getSystemState('total_capital')) || 10000;
    const dailyLossRatio = Math.abs(Math.min(0, dailyPnl)) / totalCapital;
    
    return {
      name: 'Daily Loss Limit',
      passed: dailyLossRatio <= this.config.maxDailyLoss,
      reason: dailyLossRatio > this.config.maxDailyLoss
        ? `Daily loss ${(dailyLossRatio * 100).toFixed(1)}% exceeds limit ${(this.config.maxDailyLoss * 100)}%`
        : 'Daily loss within limits',
      value: dailyLossRatio,
      limit: this.config.maxDailyLoss
    };
  }

  /**
   * Check correlation/concentration risk
   */
  async checkCorrelation(transaction) {
    // Get current open positions
    const openTrades = await this.db.getOpenTrades();
    
    // Calculate exposure by chain
    const exposureByChain = {};
    const totalExposure = openTrades.reduce((sum, t) => {
      const chain = t.chain;
      exposureByChain[chain] = (exposureByChain[chain] || 0) + t.entry_value_usd;
      return sum + t.entry_value_usd;
    }, 0);
    
    // Calculate exposure to same token
    const sameTokenExposure = openTrades
      .filter(t => t.token_address === transaction.token_address)
      .reduce((sum, t) => sum + t.entry_value_usd, 0);
    
    const totalCapital = parseFloat(await this.db.getSystemState('total_capital')) || 10000;
    
    // Check if same token exposure is too high
    if (sameTokenExposure > 0) {
      const tokenConcentration = sameTokenExposure / totalCapital;
      if (tokenConcentration > this.config.correlationLimit) {
        return {
          name: 'Correlation/Concentration',
          passed: false,
          reason: `Already ${(tokenConcentration * 100).toFixed(1)}% exposed to ${transaction.token_symbol}`,
          value: tokenConcentration,
          limit: this.config.correlationLimit
        };
      }
    }
    
    // Check chain concentration
    const chainExposure = (exposureByChain[transaction.chain] || 0) / totalCapital;
    if (chainExposure > this.config.correlationLimit * 2) {
      return {
        name: 'Correlation/Concentration',
        passed: false,
        reason: `Chain exposure ${(chainExposure * 100).toFixed(1)}% too high`,
        value: chainExposure,
        limit: this.config.correlationLimit * 2
      };
    }
    
    return {
      name: 'Correlation/Concentration',
      passed: true,
      reason: 'Diversification maintained',
      value: Math.max(chainExposure, sameTokenExposure / totalCapital),
      limit: this.config.correlationLimit
    };
  }

  /**
   * Check emergency stop
   */
  checkEmergencyStop() {
    return {
      name: 'Emergency Stop',
      passed: !this.config.emergencyStop,
      reason: this.config.emergencyStop 
        ? 'Emergency stop is ACTIVE - all trading paused'
        : 'Emergency stop not active',
      value: this.config.emergencyStop,
      limit: false
    };
  }

  /**
   * Check available capital
   */
  async checkAvailableCapital(requestedSize) {
    const performance = await this.db.getOverallPerformance();
    const openTrades = await this.db.getOpenTrades();
    const usedCapital = openTrades.reduce((sum, t) => sum + t.entry_value_usd, 0);
    const availableCapital = performance.currentCapital - usedCapital;
    
    return {
      name: 'Available Capital',
      passed: requestedSize <= availableCapital,
      reason: requestedSize > availableCapital
        ? `Insufficient capital: $${availableCapital.toFixed(2)} available, $${requestedSize.toFixed(2)} requested`
        : 'Sufficient capital available',
      value: availableCapital,
      limit: requestedSize
    };
  }

  /**
   * Calculate portfolio risk metrics
   */
  async calculateRiskMetrics() {
    const trades = await this.db.query(
      'SELECT * FROM paper_trades WHERE status = \'closed\' ORDER BY entry_time'
    );
    
    if (trades.length === 0) {
      return {
        sharpeRatio: 0,
        maxDrawdown: 0,
        volatility: 0,
        beta: 1
      };
    }
    
    // Calculate returns
    const returns = trades.map(t => t.pnl_percentage / 100);
    
    // Calculate Sharpe Ratio (simplified, assuming 0% risk-free rate)
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    
    // Calculate maximum drawdown
    let peak = 10000;
    let maxDrawdown = 0;
    let runningCapital = 10000;
    
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
    
    return {
      sharpeRatio: sharpeRatio * Math.sqrt(252), // Annualized
      maxDrawdown,
      volatility: stdDev,
      avgReturn,
      totalReturn: (runningCapital - 10000) / 10000
    };
  }

  /**
   * Get current risk status
   */
  async getRiskStatus() {
    const metrics = await this.calculateRiskMetrics();
    const performance = await this.db.getOverallPerformance();
    const openTrades = await this.db.getOpenTrades();
    
    const usedCapital = openTrades.reduce((sum, t) => sum + t.entry_value_usd, 0);
    const capitalUtilization = usedCapital / performance.currentCapital;
    
    // Calculate risk level
    let riskLevel = 'low';
    let riskScore = 0;
    
    if (metrics.maxDrawdown > 0.20) riskScore += 30;
    if (capitalUtilization > 0.80) riskScore += 25;
    if (metrics.volatility > 0.30) riskScore += 20;
    if (performance.winRate < 0.50) riskScore += 25;
    
    if (riskScore >= 70) riskLevel = 'high';
    else if (riskScore >= 40) riskLevel = 'medium';
    
    return {
      level: riskLevel,
      score: riskScore,
      metrics,
      capitalUtilization,
      openPositions: openTrades.length,
      drawdown: (performance.totalCapital - performance.currentCapital) / performance.totalCapital,
      emergencyStop: this.config.emergencyStop
    };
  }

  /**
   * Set emergency stop
   */
  setEmergencyStop(active) {
    config.risk.emergencyStop = active;
    console.log(`🚨 Emergency stop ${active ? 'ACTIVATED' : 'DEACTIVATED'}`);
  }
}

module.exports = RiskManager;


