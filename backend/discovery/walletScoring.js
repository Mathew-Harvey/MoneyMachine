const config = require('../../config/config');

/**
 * Wallet Scoring System
 * Ranks wallets by profitability and consistency
 * 
 * Scoring Factors:
 * - Win rate (40%)
 * - Total profitability (30%)
 * - Trade consistency (15%)
 * - Risk management (15%)
 */
class WalletScoring {
  constructor(db) {
    this.db = db;
  }

  /**
   * Score multiple wallets
   */
  async scoreWallets(wallets) {
    const scored = [];
    
    for (const wallet of wallets) {
      try {
        const score = await this.scoreWallet(wallet);
        scored.push({
          ...wallet,
          score: score.totalScore,
          breakdown: score.breakdown
        });
      } catch (error) {
        console.error(`Error scoring wallet ${wallet.address}:`, error.message);
      }
    }
    
    // Sort by score descending
    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Score a single wallet
   */
  async scoreWallet(wallet) {
    const breakdown = {
      winRate: 0,
      profitability: 0,
      consistency: 0,
      riskManagement: 0
    };
    
    // 1. Win Rate Score (0-40 points)
    breakdown.winRate = this.calculateWinRateScore(wallet);
    
    // 2. Profitability Score (0-30 points)
    breakdown.profitability = this.calculateProfitabilityScore(wallet);
    
    // 3. Consistency Score (0-15 points)
    breakdown.consistency = this.calculateConsistencyScore(wallet);
    
    // 4. Risk Management Score (0-15 points)
    breakdown.riskManagement = this.calculateRiskScore(wallet);
    
    const totalScore = 
      breakdown.winRate +
      breakdown.profitability +
      breakdown.consistency +
      breakdown.riskManagement;
    
    return {
      totalScore,
      breakdown
    };
  }

  /**
   * Calculate win rate score (0-40 points)
   */
  calculateWinRateScore(wallet) {
    const winRate = wallet.winRate || 0;
    
    // Perfect score at 80%+ win rate
    if (winRate >= 0.8) return 40;
    
    // Linear scaling from 50% (0 points) to 80% (40 points)
    if (winRate >= 0.5) {
      return ((winRate - 0.5) / 0.3) * 40;
    }
    
    return 0; // Below 50% gets no points
  }

  /**
   * Calculate profitability score (0-30 points)
   */
  calculateProfitabilityScore(wallet) {
    const profit = wallet.totalProfit || 0;
    const minProfit = config.discovery.minProfitability;
    
    // No points if below minimum
    if (profit < minProfit) return 0;
    
    // Scale up to 30 points based on profit
    // Perfect score at 10x minimum profitability
    const ratio = profit / minProfit;
    if (ratio >= 10) return 30;
    
    return (ratio / 10) * 30;
  }

  /**
   * Calculate consistency score (0-15 points)
   */
  calculateConsistencyScore(wallet) {
    if (!wallet.wins || !wallet.losses) return 0;
    
    const totalTrades = wallet.totalTrades || wallet.wins + wallet.losses;
    
    // More trades = more reliable data
    let tradeCountScore = 0;
    if (totalTrades >= 50) tradeCountScore = 7;
    else if (totalTrades >= 30) tradeCountScore = 5;
    else if (totalTrades >= 20) tradeCountScore = 3;
    
    // Consistent winning (no long losing streaks)
    // This is approximated by win distribution
    const expectedWins = totalTrades * (wallet.winRate || 0.5);
    const winVariance = Math.abs(wallet.wins - expectedWins);
    const consistencyRatio = 1 - (winVariance / totalTrades);
    const distributionScore = Math.max(0, consistencyRatio * 8);
    
    return tradeCountScore + distributionScore;
  }

  /**
   * Calculate risk management score (0-15 points)
   */
  calculateRiskScore(wallet) {
    let score = 0;
    
    // 1. Position sizing (5 points)
    // Wallet should have controlled position sizes
    const avgTradeSize = wallet.avgTradeSize || 0;
    if (avgTradeSize > 0 && avgTradeSize < 10000) {
      score += 5; // Reasonable trade sizes
    } else if (avgTradeSize < 50000) {
      score += 3; // Somewhat large but manageable
    }
    
    // 2. Loss management (5 points)
    // Biggest loss shouldn't be catastrophic compared to avg win
    const biggestLoss = Math.abs(wallet.biggestLoss || 0);
    const biggestWin = wallet.biggestWin || 1;
    
    const lossRatio = biggestLoss / biggestWin;
    if (lossRatio < 0.5) {
      score += 5; // Cuts losses quickly
    } else if (lossRatio < 1.0) {
      score += 3; // Decent loss control
    } else if (lossRatio < 2.0) {
      score += 1; // Some loss control
    }
    
    // 3. Trade frequency (5 points)
    // Not overtrading or undertrading
    const tradesPerDay = (wallet.totalTrades || 0) / 30; // Approximate
    if (tradesPerDay >= 1 && tradesPerDay <= 5) {
      score += 5; // Good frequency
    } else if (tradesPerDay >= 0.5 && tradesPerDay <= 10) {
      score += 3; // Acceptable frequency
    }
    
    return score;
  }

  /**
   * Get scoring explanation
   */
  explainScore(score) {
    const rating = this.getScoreRating(score.totalScore);
    
    return {
      rating,
      totalScore: score.totalScore,
      maxScore: 100,
      breakdown: {
        winRate: {
          score: score.breakdown.winRate,
          max: 40,
          description: 'Percentage of profitable trades'
        },
        profitability: {
          score: score.breakdown.profitability,
          max: 30,
          description: 'Total profit generated'
        },
        consistency: {
          score: score.breakdown.consistency,
          max: 15,
          description: 'Trade consistency and volume'
        },
        riskManagement: {
          score: score.breakdown.riskManagement,
          max: 15,
          description: 'Position sizing and loss control'
        }
      }
    };
  }

  /**
   * Get qualitative rating from score
   */
  getScoreRating(score) {
    if (score >= 80) return 'Excellent';
    if (score >= 70) return 'Very Good';
    if (score >= 60) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Poor';
  }

  /**
   * Compare two wallets
   */
  compareWallets(wallet1, wallet2) {
    const score1 = this.scoreWallet(wallet1);
    const score2 = this.scoreWallet(wallet2);
    
    return {
      winner: score1.totalScore > score2.totalScore ? wallet1.address : wallet2.address,
      scoreDifference: Math.abs(score1.totalScore - score2.totalScore),
      wallet1Score: score1,
      wallet2Score: score2
    };
  }
}

module.exports = WalletScoring;


