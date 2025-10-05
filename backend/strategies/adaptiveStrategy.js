const config = require('../../config/config');
const CopyTradeStrategy = require('./copyTradeStrategy');
const VolumeBreakoutStrategy = require('./volumeBreakoutStrategy');
const SmartMoneyStrategy = require('./smartMoneyStrategy');
const ArbitrageStrategy = require('./arbitrageStrategy');
const MemeStrategy = require('./memeStrategy');
const EarlyGemStrategy = require('./earlyGemStrategy');

/**
 * Adaptive Strategy
 * Dynamically adjusts approach based on:
 * - Market conditions
 * - Wallet recent performance
 * - Strategy performance
 * - Risk appetite
 * 
 * Adapts position sizing and strategy selection
 */
class AdaptiveStrategy {
  constructor(db) {
    this.db = db;
    this.name = 'adaptive';
    
    // Initialize ALL sub-strategies
    this.copyTradeStrategy = new CopyTradeStrategy(db);
    this.volumeBreakoutStrategy = new VolumeBreakoutStrategy(db);
    this.smartMoneyStrategy = new SmartMoneyStrategy(db);
    this.arbitrageStrategy = new ArbitrageStrategy(db);
    this.memeStrategy = new MemeStrategy(db);
    this.earlyGemStrategy = new EarlyGemStrategy(db);
  }

  /**
   * Evaluate trade with adaptive logic
   */
  async evaluateTrade(transaction, wallet) {
    // Determine best strategy for this trade
    const recommendedStrategy = await this.selectStrategy(transaction, wallet);
    
    if (!recommendedStrategy) {
      return { shouldCopy: false, reason: 'No suitable strategy found' };
    }

    // Get evaluation from selected strategy
    const strategyEval = await recommendedStrategy.strategy.evaluateTrade(transaction, wallet);
    
    if (!strategyEval.shouldCopy) {
      return strategyEval;
    }

    // Adapt position size based on current performance
    const adaptedSize = await this.adaptPositionSize(
      strategyEval.positionSize,
      recommendedStrategy.strategyName,
      wallet
    );

    return {
      ...strategyEval,
      positionSize: adaptedSize,
      adaptedFrom: strategyEval.positionSize,
      strategyUsed: recommendedStrategy.strategyName,
      reason: `Adaptive: ${strategyEval.reason}`
    };
  }

  /**
   * Select best strategy for a trade
   */
  async selectStrategy(transaction, wallet) {
    const candidates = [];

    // Get recent performance of ALL strategies
    const copyPerf = await this.copyTradeStrategy.getPerformance();
    const volumePerf = await this.volumeBreakoutStrategy.getPerformance();
    const smartPerf = await this.smartMoneyStrategy.getPerformance();
    const arbPerf = await this.arbitrageStrategy.getPerformance();
    const memePerf = await this.memeStrategy.getPerformance();
    const gemPerf = await this.earlyGemStrategy.getPerformance();

    // Score each strategy for this trade
    const strategies = [
      {
        name: 'copyTrade',
        strategy: this.copyTradeStrategy,
        performance: copyPerf,
        suitability: this.calculateSuitability(transaction, wallet, 'copyTrade')
      },
      {
        name: 'volumeBreakout',
        strategy: this.volumeBreakoutStrategy,
        performance: volumePerf,
        suitability: this.calculateSuitability(transaction, wallet, 'volumeBreakout')
      },
      {
        name: 'smartMoney',
        strategy: this.smartMoneyStrategy,
        performance: smartPerf,
        suitability: this.calculateSuitability(transaction, wallet, 'smartMoney')
      },
      {
        name: 'arbitrage',
        strategy: this.arbitrageStrategy,
        performance: arbPerf,
        suitability: this.calculateSuitability(transaction, wallet, 'arbitrage')
      },
      {
        name: 'memecoin',
        strategy: this.memeStrategy,
        performance: memePerf,
        suitability: this.calculateSuitability(transaction, wallet, 'memecoin')
      },
      {
        name: 'earlyGem',
        strategy: this.earlyGemStrategy,
        performance: gemPerf,
        suitability: this.calculateSuitability(transaction, wallet, 'earlyGem')
      }
    ];

    // Weight by recent performance and suitability
    for (const strat of strategies) {
      const perfScore = this.calculatePerformanceScore(strat.performance);
      const combinedScore = (strat.suitability * 0.6) + (perfScore * 0.4);
      
      candidates.push({
        strategyName: strat.name,
        strategy: strat.strategy,
        score: combinedScore
      });
    }

    // Select highest scoring strategy
    candidates.sort((a, b) => b.score - a.score);
    
    return candidates[0].score > 30 ? candidates[0] : null;
  }

  /**
   * Calculate how suitable a strategy is for this trade
   */
  calculateSuitability(transaction, wallet, strategyType) {
    let score = 50; // Base score

    // Match wallet strategy type
    if (wallet.strategy_type === strategyType) {
      score += 30;
    }

    // CopyTrade suitability - always applicable
    if (strategyType === 'copyTrade') {
      if (wallet.win_rate >= 0.55 && transaction.total_value_usd >= 100) {
        score += 25;
      }
    }

    // VolumeBreakout suitability
    if (strategyType === 'volumeBreakout') {
      if (transaction.total_value_usd >= 500) {
        score += 20;
      }
    }

    // SmartMoney suitability
    if (strategyType === 'smartMoney') {
      if (transaction.total_value_usd >= 5000) {
        score += 30; // High score for whale trades
      }
    }

    // Arbitrage suitability
    if (strategyType === 'arbitrage') {
      if (wallet.win_rate >= 0.55 && transaction.total_value_usd >= 500) {
        score += 20;
      }
      if (transaction.chain === 'ethereum') {
        score += 10;
      }
    }

    // Memecoin suitability
    if (strategyType === 'memecoin') {
      if (transaction.chain === 'solana') {
        score += 20;
      }
      // Check for memecoin indicators
      const symbol = transaction.token_symbol?.toUpperCase() || '';
      if (symbol.includes('BONK') || symbol.includes('WIF') || symbol.length <= 4) {
        score += 15;
      }
    }

    // Early gem suitability
    if (strategyType === 'earlyGem') {
      if (wallet.win_rate >= 0.60) {
        score += 25;
      }
      if (transaction.chain === 'base' || transaction.chain === 'arbitrum') {
        score += 15;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Calculate performance score for a strategy
   */
  calculatePerformanceScore(performance) {
    let score = 0;

    // Win rate contribution (0-40 points)
    score += performance.winRate * 40;

    // ROI contribution (0-30 points)
    const roiScore = Math.min(30, (performance.roi / 100) * 30);
    score += roiScore;

    // Profit factor contribution (0-30 points)
    if (performance.profitFactor > 0) {
      score += Math.min(30, (performance.profitFactor / 3) * 30);
    }

    return score;
  }

  /**
   * Adapt position size based on performance
   */
  async adaptPositionSize(baseSize, strategyName, wallet) {
    // Get recent strategy performance
    let strategyPerf;
    const strategyMap = {
      'copyTrade': this.copyTradeStrategy,
      'volumeBreakout': this.volumeBreakoutStrategy,
      'smartMoney': this.smartMoneyStrategy,
      'arbitrage': this.arbitrageStrategy,
      'memecoin': this.memeStrategy,
      'earlyGem': this.earlyGemStrategy
    };
    
    const strategy = strategyMap[strategyName] || this.copyTradeStrategy;
    strategyPerf = await strategy.getPerformance();

    let multiplier = 1.0;

    // Increase size if strategy is performing well
    if (strategyPerf.roi > 20 && strategyPerf.winRate > 0.60) {
      multiplier = 1.3;
    } else if (strategyPerf.roi > 10 && strategyPerf.winRate > 0.55) {
      multiplier = 1.15;
    } else if (strategyPerf.roi < -10 || strategyPerf.winRate < 0.40) {
      multiplier = 0.7; // Reduce size if underperforming
    }

    // Further adjust based on wallet's recent performance
    if (wallet.win_rate >= 0.70) {
      multiplier *= 1.1;
    } else if (wallet.win_rate < 0.50) {
      multiplier *= 0.8;
    }

    // Check overall portfolio performance
    const overallPerf = await this.db.getOverallPerformance();
    if (overallPerf.roi < -15) {
      multiplier *= 0.5; // Reduce size significantly if portfolio is down
    }

    return baseSize * multiplier;
  }

  /**
   * Get exit strategy (delegates to appropriate strategy)
   */
  async getExitStrategy(trade, currentPrice) {
    // Determine which strategy to use based on trade
    const strategyMap = {
      'copyTrade': this.copyTradeStrategy,
      'volumeBreakout': this.volumeBreakoutStrategy,
      'smartMoney': this.smartMoneyStrategy,
      'arbitrage': this.arbitrageStrategy,
      'memecoin': this.memeStrategy,
      'earlyGem': this.earlyGemStrategy
    };
    
    const strategy = strategyMap[trade.strategy_used] || this.copyTradeStrategy;
    return strategy.getExitStrategy(trade, currentPrice);
  }

  /**
   * Rebalance allocations based on performance
   */
  async rebalanceAllocations() {
    const strategies = {
      arbitrage: await this.arbitrageStrategy.getPerformance(),
      memecoin: await this.memeStrategy.getPerformance(),
      earlyGem: await this.earlyGemStrategy.getPerformance()
    };

    // Calculate new allocations based on ROI
    const totalCapital = 10000; // Starting capital
    const performances = Object.values(strategies);
    
    // Calculate average ROI
    const avgROI = performances.reduce((sum, p) => sum + p.roi, 0) / performances.length;

    // Shift allocation to outperformers
    const newAllocations = {};
    
    for (const [name, perf] of Object.entries(strategies)) {
      let allocation = config.strategies[name].allocation;
      
      // Increase allocation if outperforming
      if (perf.roi > avgROI + 10) {
        allocation *= 1.2;
      } else if (perf.roi < avgROI - 10) {
        allocation *= 0.8;
      }
      
      newAllocations[name] = allocation;
    }

    return newAllocations;
  }

  /**
   * Get overall adaptive strategy performance
   */
  async getPerformance() {
    const strategies = {
      copyTrade: await this.copyTradeStrategy.getPerformance(),
      volumeBreakout: await this.volumeBreakoutStrategy.getPerformance(),
      smartMoney: await this.smartMoneyStrategy.getPerformance(),
      arbitrage: await this.arbitrageStrategy.getPerformance(),
      memecoin: await this.memeStrategy.getPerformance(),
      earlyGem: await this.earlyGemStrategy.getPerformance()
    };

    const overall = await this.db.getOverallPerformance();

    return {
      strategy: 'adaptive',
      overall,
      strategies,
      rebalanceRecommendations: await this.rebalanceAllocations()
    };
  }
}

module.exports = AdaptiveStrategy;


