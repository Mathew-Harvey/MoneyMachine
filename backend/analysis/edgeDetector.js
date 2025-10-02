const config = require('../../config/config');

/**
 * Edge Detector
 * Identifies when wallets lose their trading edge
 * Monitors performance degradation and recommends actions
 * 
 * Detection Methods:
 * - Win rate decline
 * - Consecutive losses
 * - Performance vs baseline
 * - Strategy drift
 */
class EdgeDetector {
  constructor(db) {
    this.db = db;
    this.detectionPeriod = config.performance.edgeDetectionPeriod; // days
    this.performanceThreshold = config.performance.performanceThreshold;
  }

  /**
   * Analyze all wallets for edge loss
   */
  async analyzeAllWallets() {
    console.log('🔍 Running edge detection analysis...');
    
    const wallets = await this.db.getWallets();
    const results = [];
    
    for (const wallet of wallets) {
      try {
        const analysis = await this.analyzeWallet(wallet);
        
        if (analysis.hasLostEdge) {
          results.push(analysis);
          
          // Auto-pause if severe
          if (analysis.severity === 'severe') {
            await this.db.pauseWallet(wallet.address, analysis.reason);
            console.log(`  ⚠️  Auto-paused ${wallet.address}: ${analysis.reason}`);
          }
        }
      } catch (error) {
        console.error(`Error analyzing wallet ${wallet.address}:`, error.message);
      }
    }
    
    if (results.length > 0) {
      console.log(`⚠️  Found ${results.length} wallets with edge loss`);
    } else {
      console.log('✓ All wallets performing within parameters');
    }
    
    return results;
  }

  /**
   * Analyze a single wallet for edge loss
   */
  async analyzeWallet(wallet) {
    const analysis = {
      wallet: wallet.address,
      chain: wallet.chain,
      strategy: wallet.strategy_type,
      hasLostEdge: false,
      severity: 'none',
      signals: [],
      reason: '',
      recommendation: ''
    };
    
    // Get recent trades
    const recentTrades = await this.getRecentTrades(wallet.address, this.detectionPeriod);
    
    if (recentTrades.length < 5) {
      return analysis; // Not enough data
    }
    
    // Signal 1: Win rate decline
    const winRateSignal = this.checkWinRateDecline(wallet, recentTrades);
    if (winRateSignal.detected) {
      analysis.signals.push(winRateSignal);
    }
    
    // Signal 2: Consecutive losses
    const consecutiveLossSignal = this.checkConsecutiveLosses(recentTrades);
    if (consecutiveLossSignal.detected) {
      analysis.signals.push(consecutiveLossSignal);
    }
    
    // Signal 3: Performance vs baseline
    const baselineSignal = this.checkBaselinePerformance(wallet, recentTrades);
    if (baselineSignal.detected) {
      analysis.signals.push(baselineSignal);
    }
    
    // Signal 4: Profit decline
    const profitSignal = this.checkProfitDecline(recentTrades);
    if (profitSignal.detected) {
      analysis.signals.push(profitSignal);
    }
    
    // Signal 5: Strategy drift
    const driftSignal = await this.checkStrategyDrift(wallet, recentTrades);
    if (driftSignal.detected) {
      analysis.signals.push(driftSignal);
    }
    
    // Determine if edge is lost
    if (analysis.signals.length >= 2) {
      analysis.hasLostEdge = true;
      
      // Determine severity
      const severeSignals = analysis.signals.filter(s => s.severity === 'severe').length;
      if (severeSignals >= 2 || analysis.signals.length >= 4) {
        analysis.severity = 'severe';
      } else if (analysis.signals.length >= 3) {
        analysis.severity = 'moderate';
      } else {
        analysis.severity = 'mild';
      }
      
      // Generate reason and recommendation
      analysis.reason = this.generateReason(analysis.signals);
      analysis.recommendation = this.generateRecommendation(analysis);
    }
    
    return analysis;
  }

  /**
   * Get recent trades for a wallet
   */
  async getRecentTrades(walletAddress, days) {
    return this.db.query(`
      SELECT * FROM paper_trades
      WHERE 
        source_wallet = ?
        AND status = 'closed'
        AND entry_time >= DATE('now', '-${days} days')
      ORDER BY entry_time DESC
    `, [walletAddress]);
  }

  /**
   * Check for win rate decline
   */
  checkWinRateDecline(wallet, recentTrades) {
    const recentWinRate = recentTrades.filter(t => t.pnl > 0).length / recentTrades.length;
    const historicalWinRate = wallet.win_rate;
    
    const decline = historicalWinRate - recentWinRate;
    
    if (decline >= 0.20) {
      return {
        detected: true,
        type: 'win_rate_decline',
        severity: 'severe',
        message: `Win rate dropped ${(decline * 100).toFixed(1)}% (${(historicalWinRate * 100).toFixed(1)}% → ${(recentWinRate * 100).toFixed(1)}%)`,
        data: { historical: historicalWinRate, recent: recentWinRate, decline }
      };
    } else if (decline >= 0.15) {
      return {
        detected: true,
        type: 'win_rate_decline',
        severity: 'moderate',
        message: `Win rate declining: ${(decline * 100).toFixed(1)}% drop`,
        data: { historical: historicalWinRate, recent: recentWinRate, decline }
      };
    }
    
    return { detected: false };
  }

  /**
   * Check for consecutive losses
   */
  checkConsecutiveLosses(recentTrades) {
    let consecutiveLosses = 0;
    let maxConsecutiveLosses = 0;
    
    // Trades are ordered by entry_time DESC, so reverse to check chronologically
    const chronological = [...recentTrades].reverse();
    
    for (const trade of chronological) {
      if (trade.pnl <= 0) {
        consecutiveLosses++;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses);
      } else {
        consecutiveLosses = 0;
      }
    }
    
    if (maxConsecutiveLosses >= config.performance.demotionThreshold) {
      return {
        detected: true,
        type: 'consecutive_losses',
        severity: 'severe',
        message: `${maxConsecutiveLosses} consecutive losses detected`,
        data: { consecutiveLosses: maxConsecutiveLosses }
      };
    } else if (maxConsecutiveLosses >= 7) {
      return {
        detected: true,
        type: 'consecutive_losses',
        severity: 'moderate',
        message: `${maxConsecutiveLosses} consecutive losses`,
        data: { consecutiveLosses: maxConsecutiveLosses }
      };
    }
    
    return { detected: false };
  }

  /**
   * Check performance vs baseline
   */
  checkBaselinePerformance(wallet, recentTrades) {
    const recentPnl = recentTrades.reduce((sum, t) => sum + t.pnl, 0);
    const avgTradeValue = recentTrades.reduce((sum, t) => sum + t.entry_value_usd, 0) / recentTrades.length;
    const expectedTrades = recentTrades.length;
    const expectedPnl = avgTradeValue * wallet.win_rate * 0.2 * expectedTrades; // Rough estimate
    
    const performanceRatio = expectedPnl > 0 ? recentPnl / expectedPnl : 0;
    
    if (performanceRatio < this.performanceThreshold) {
      return {
        detected: true,
        type: 'baseline_underperformance',
        severity: performanceRatio < -1 ? 'severe' : 'moderate',
        message: `Performing ${((1 - performanceRatio) * 100).toFixed(0)}% below baseline`,
        data: { expected: expectedPnl, actual: recentPnl, ratio: performanceRatio }
      };
    }
    
    return { detected: false };
  }

  /**
   * Check for profit decline trend
   */
  checkProfitDecline(recentTrades) {
    if (recentTrades.length < 10) {
      return { detected: false };
    }
    
    // Split into two halves
    const midpoint = Math.floor(recentTrades.length / 2);
    const firstHalf = recentTrades.slice(midpoint);
    const secondHalf = recentTrades.slice(0, midpoint);
    
    const firstHalfPnl = firstHalf.reduce((sum, t) => sum + t.pnl, 0);
    const secondHalfPnl = secondHalf.reduce((sum, t) => sum + t.pnl, 0);
    
    const decline = firstHalfPnl - secondHalfPnl;
    
    if (secondHalfPnl < 0 && decline > 200) {
      return {
        detected: true,
        type: 'profit_decline',
        severity: 'moderate',
        message: `Profit declining: $${decline.toFixed(2)} worse in recent trades`,
        data: { early: firstHalfPnl, recent: secondHalfPnl, decline }
      };
    }
    
    return { detected: false };
  }

  /**
   * Check for strategy drift (wallet changing behavior)
   */
  async checkStrategyDrift(wallet, recentTrades) {
    // Compare recent trading patterns to historical
    // Simplified: check if trade sizes are very different
    
    const recentAvgSize = recentTrades.reduce((sum, t) => sum + t.entry_value_usd, 0) / recentTrades.length;
    const historicalAvgSize = wallet.avg_trade_size;
    
    if (historicalAvgSize > 0) {
      const sizeDrift = Math.abs(recentAvgSize - historicalAvgSize) / historicalAvgSize;
      
      if (sizeDrift > 0.5) {
        return {
          detected: true,
          type: 'strategy_drift',
          severity: 'mild',
          message: `Trading pattern changed: ${(sizeDrift * 100).toFixed(0)}% different position sizes`,
          data: { historical: historicalAvgSize, recent: recentAvgSize, drift: sizeDrift }
        };
      }
    }
    
    return { detected: false };
  }

  /**
   * Generate human-readable reason
   */
  generateReason(signals) {
    const reasons = signals.map(s => s.message);
    return reasons.join('; ');
  }

  /**
   * Generate recommendation based on analysis
   */
  generateRecommendation(analysis) {
    if (analysis.severity === 'severe') {
      return `PAUSE IMMEDIATELY - ${analysis.signals.length} critical issues detected. Wait for wallet to demonstrate recovery.`;
    } else if (analysis.severity === 'moderate') {
      return `Reduce allocation by 50% and monitor closely for next 7 days. Resume if performance improves.`;
    } else {
      return `Monitor closely. Consider reducing position sizes until performance stabilizes.`;
    }
  }

  /**
   * Get edge score (0-100, higher is better)
   */
  calculateEdgeScore(wallet, recentTrades) {
    let score = 100;
    
    if (recentTrades.length < 5) {
      return 50; // Neutral score for insufficient data
    }
    
    const recentWinRate = recentTrades.filter(t => t.pnl > 0).length / recentTrades.length;
    const recentPnl = recentTrades.reduce((sum, t) => sum + t.pnl, 0);
    
    // Win rate contribution
    if (recentWinRate < 0.40) score -= 30;
    else if (recentWinRate < 0.50) score -= 20;
    else if (recentWinRate < 0.55) score -= 10;
    
    // Profitability contribution
    if (recentPnl < -200) score -= 25;
    else if (recentPnl < -100) score -= 15;
    else if (recentPnl < 0) score -= 10;
    
    // Decline vs historical
    const winRateDecline = wallet.win_rate - recentWinRate;
    if (winRateDecline > 0.20) score -= 25;
    else if (winRateDecline > 0.15) score -= 15;
    
    // Consecutive losses
    let consecutiveLosses = 0;
    for (const trade of [...recentTrades].reverse()) {
      if (trade.pnl <= 0) consecutiveLosses++;
      else break;
    }
    
    if (consecutiveLosses >= 5) score -= 20;
    else if (consecutiveLosses >= 3) score -= 10;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get edge report for all wallets
   */
  async getEdgeReport() {
    const wallets = await this.db.getWallets();
    const report = [];
    
    for (const wallet of wallets) {
      const recentTrades = await this.getRecentTrades(wallet.address, this.detectionPeriod);
      const edgeScore = this.calculateEdgeScore(wallet, recentTrades);
      const analysis = await this.analyzeWallet(wallet);
      
      report.push({
        address: wallet.address,
        chain: wallet.chain,
        strategy: wallet.strategy_type,
        edgeScore,
        hasLostEdge: analysis.hasLostEdge,
        severity: analysis.severity,
        signals: analysis.signals.length,
        recommendation: analysis.recommendation
      });
    }
    
    // Sort by edge score (lowest first - most concerning)
    report.sort((a, b) => a.edgeScore - b.edgeScore);
    
    return report;
  }

  /**
   * Auto-remediation actions
   */
  async autoRemediate() {
    const walletsWithIssues = await this.analyzeAllWallets();
    const actions = [];
    
    for (const analysis of walletsWithIssues) {
      if (analysis.severity === 'severe') {
        // Auto-pause
        await this.db.pauseWallet(analysis.wallet, analysis.reason);
        actions.push({
          wallet: analysis.wallet,
          action: 'paused',
          reason: analysis.reason
        });
      }
    }
    
    return actions;
  }
}

module.exports = EdgeDetector;


