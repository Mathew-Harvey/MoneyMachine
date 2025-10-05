const config = require('../../config/config');
const CopyTradeStrategy = require('../strategies/copyTradeStrategy');
const VolumeBreakoutStrategy = require('../strategies/volumeBreakoutStrategy');
const SmartMoneyStrategy = require('../strategies/smartMoneyStrategy');
const ArbitrageStrategy = require('../strategies/arbitrageStrategy');
const MemeStrategy = require('../strategies/memeStrategy');
const EarlyGemStrategy = require('../strategies/earlyGemStrategy');
const AdaptiveStrategy = require('../strategies/adaptiveStrategy');
const RiskManager = require('./riskManager');
const ExitStrategy = require('./exitStrategy');
const priceOracle = require('../services/priceOracle');
const logger = require('../utils/logger');

/**
 * Paper Trading Engine
 * Simulates trading based on tracked wallet activity
 * 
 * Flow:
 * 1. Monitor transactions from tracked wallets
 * 2. Evaluate if we should copy the trade (strategy-specific)
 * 3. Execute paper trade with appropriate position sizing
 * 4. Manage open positions (exits, stop losses, take profits)
 * 5. Track performance and adjust
 */
class PaperTradingEngine {
  constructor(db) {
    this.db = db;
    this.strategies = {};
    this.riskManager = new RiskManager(db);
    this.exitStrategy = new ExitStrategy(db);
    this.lastProcessedTx = new Map();  // Changed to Map for better memory management
    this.maxCacheSize = 10000;  // Prevent memory leak
    this.cleanupInterval = null;  // Store interval ID for cleanup
  }

  async init() {
    console.log('💰 Initializing Paper Trading Engine...');
    
    // Initialize NEW production strategies (highest priority)
    this.strategies.copyTrade = new CopyTradeStrategy(this.db);
    this.strategies.volumeBreakout = new VolumeBreakoutStrategy(this.db);
    this.strategies.smartMoney = new SmartMoneyStrategy(this.db);
    
    // Initialize existing strategies (with relaxed thresholds)
    this.strategies.arbitrage = new ArbitrageStrategy(this.db);
    this.strategies.memecoin = new MemeStrategy(this.db);
    this.strategies.earlyGem = new EarlyGemStrategy(this.db);
    this.strategies.adaptive = new AdaptiveStrategy(this.db);
    
    // Setup periodic cache cleanup to prevent memory leaks
    this.startCacheCleanup();
    
    console.log('✓ Paper Trading Engine ready with 7 strategies');
  }

  /**
   * Prevent memory leak by cleaning old processed transactions
   */
  startCacheCleanup() {
    this.cleanupInterval = setInterval(() => {
      if (this.lastProcessedTx.size > this.maxCacheSize) {
        // Remove oldest half of entries to free memory
        const entries = Array.from(this.lastProcessedTx.keys());
        const toRemove = entries.slice(0, Math.floor(entries.length / 2));
        toRemove.forEach(key => this.lastProcessedTx.delete(key));
        
        logger.info('Cleaned processed transaction cache', {
          removed: toRemove.length,
          remaining: this.lastProcessedTx.size
        });
      }
    }, 3600000); // Check every hour
  }

  /**
   * Cleanup on shutdown to prevent resource leaks
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Paper trading engine cleanup interval cleared');
    }
  }

  /**
   * Process new transactions and execute trades
   */
  async processTransactions(transactions) {
    let tradesExecuted = 0;
    const rejectionReasons = {};
    
    console.log(`\n🔄 Processing ${transactions.length} transactions...`);
    
    for (const tx of transactions) {
      // Skip if already processed
      const txKey = `${tx.wallet_address}_${tx.tx_hash}`;
      if (this.lastProcessedTx.has(txKey)) {
        continue;
      }
      
      try {
        // Get wallet info
        const wallet = await this.db.get(
          'SELECT * FROM wallets WHERE address = ?',
          [tx.wallet_address]
        );
        
        if (!wallet || wallet.status !== 'active') {
          rejectionReasons['Wallet not active'] = (rejectionReasons['Wallet not active'] || 0) + 1;
          continue;
        }
        
        // Try ALL strategies to find the BEST match (not just first)
        let bestEvaluation = null;
        let bestStrategyName = null;
        let bestScore = 0;
        
        // Check ALL strategies and pick the most suitable one
        const strategyEvaluations = {
          // High specificity strategies (check first)
          smartMoney: await this.strategies.smartMoney?.evaluateTrade(tx, wallet),
          volumeBreakout: await this.strategies.volumeBreakout?.evaluateTrade(tx, wallet),
          
          // Chain/type specific strategies
          memecoin: await this.strategies.memecoin?.evaluateTrade(tx, wallet),
          arbitrage: await this.strategies.arbitrage?.evaluateTrade(tx, wallet),
          earlyGem: await this.strategies.earlyGem?.evaluateTrade(tx, wallet),
          
          // Catch-all strategy (lowest priority)
          copyTrade: await this.strategies.copyTrade?.evaluateTrade(tx, wallet)
        };
        
        // Score each strategy that wants to copy
        for (const [strategyName, evaluation] of Object.entries(strategyEvaluations)) {
          if (!evaluation || !evaluation.shouldCopy) {
            // Track rejection
            if (evaluation && evaluation.reason) {
              const key = `${strategyName}: ${evaluation.reason}`;
              rejectionReasons[key] = (rejectionReasons[key] || 0) + 1;
            }
            continue;
          }
          
          // Calculate strategy score (higher = more specific/appropriate)
          let score = evaluation.positionSize || 100; // Use position size as base score
          
          // Boost specific strategies over generic ones
          if (strategyName === 'smartMoney' && tx.total_value_usd >= 5000) score *= 2;
          if (strategyName === 'volumeBreakout') score *= 1.5;
          if (strategyName === 'memecoin' && tx.chain === 'solana') score *= 1.3;
          if (strategyName === 'copyTrade') score *= 0.8; // Slight penalty for catch-all
          
          if (score > bestScore) {
            bestScore = score;
            bestEvaluation = evaluation;
            bestStrategyName = strategyName;
          }
        }
        
        if (bestEvaluation) {
          // Check risk management
          const riskCheck = await this.riskManager.checkTrade(tx, wallet, bestEvaluation);
          
          if (riskCheck.approved) {
            // Execute paper trade with matched strategy name
            const trade = await this.executeTrade(tx, wallet, bestEvaluation, bestStrategyName);
            
            if (trade) {
              tradesExecuted++;
              console.log(`  ✅ TRADE EXECUTED: ${tx.token_symbol} via ${bestStrategyName} - ${bestEvaluation.reason}`);
              logger.info('Trade executed', {
                token: tx.token_symbol,
                strategy: bestStrategyName,
                size: bestEvaluation.positionSize,
                wallet: tx.wallet_address.substring(0, 10)
              });
            }
          } else {
            rejectionReasons[`Risk Manager: ${riskCheck.reason}`] = (rejectionReasons[`Risk Manager: ${riskCheck.reason}`] || 0) + 1;
            console.log(`  ⚠️  Trade blocked by risk: ${riskCheck.reason}`);
          }
        }
        
        this.lastProcessedTx.set(txKey, Date.now());
      } catch (error) {
        console.error(`Error processing transaction:`, error.message);
        logger.error('Transaction processing error', { error: error.message });
      }
    }
    
    // Log summary
    console.log(`\n📊 Processing Summary:`);
    console.log(`  ✅ Trades Executed: ${tradesExecuted}`);
    console.log(`  ❌ Trades Rejected: ${transactions.length - tradesExecuted}`);
    
    if (Object.keys(rejectionReasons).length > 0) {
      console.log(`\n  Top Rejection Reasons:`);
      const sorted = Object.entries(rejectionReasons)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      sorted.forEach(([reason, count]) => {
        console.log(`    • ${reason}: ${count}x`);
      });
    }
    
    return tradesExecuted;
  }

  /**
   * Execute a paper trade
   */
  async executeTrade(transaction, wallet, evaluation, strategyName) {
    try {
      const trade = {
        token_address: transaction.token_address,
        token_symbol: transaction.token_symbol,
        chain: transaction.chain,
        strategy_used: strategyName || wallet.strategy_type,  // Use matched strategy or wallet default
        source_wallet: wallet.address,
        entry_price: transaction.price_usd || await this.getMockPrice(transaction),
        amount: evaluation.positionSize / (transaction.price_usd || await this.getMockPrice(transaction)),
        entry_value_usd: evaluation.positionSize,
        notes: `Copied from ${wallet.address.substring(0, 10)}... | ${evaluation.reason}`
      };
      
      // Record in database
      const result = await this.db.openPaperTrade(trade);
      
      // Log alert for high-conviction trades
      if (evaluation.confidence === 'high' || evaluation.positionSize > 200) {
        console.log(`\n🚨 HIGH CONVICTION TRADE:`);
        console.log(`   Token: ${trade.token_symbol}`);
        console.log(`   Chain: ${trade.chain}`);
        console.log(`   Strategy: ${trade.strategy_used}`);
        console.log(`   Size: $${trade.entry_value_usd.toFixed(2)}`);
        console.log(`   Reason: ${evaluation.reason}\n`);
      }
      
      return { ...trade, id: result.lastID };
    } catch (error) {
      console.error('Error executing trade:', error.message);
      return null;
    }
  }

  /**
   * Manage open positions (check exits, update prices)
   */
  async managePositions() {
    try {
      const openTrades = await this.db.getOpenTrades();
      
      if (openTrades.length === 0) {
        return;
      }
      
      let exitsExecuted = 0;
      
      for (const trade of openTrades) {
        try {
          // Get current price
          const currentPrice = await this.getCurrentPrice(trade);
          
          // Check exit conditions
          const strategy = this.strategies[trade.strategy_used] || this.strategies.copyTrade;
          
          // Handle both sync and async getExitStrategy (some are sync, some async)
          const exitDecision = strategy.getExitStrategy(trade, currentPrice);
          const resolvedExitDecision = exitDecision instanceof Promise 
            ? await exitDecision 
            : exitDecision;
          
          if (resolvedExitDecision && resolvedExitDecision.shouldExit) {
            await this.exitPosition(trade, currentPrice, resolvedExitDecision);
            exitsExecuted++;
          }
        } catch (error) {
          console.error(`Error managing position ${trade.id}:`, error.message);
          logger.error('Position management error', {
            tradeId: trade.id,
            token: trade.token_symbol,
            error: error.message
          });
        }
      }
      
      if (exitsExecuted > 0) {
        console.log(`  💸 Exited ${exitsExecuted} positions`);
      }
    } catch (error) {
      console.error('Error managing positions:', error.message);
    }
  }

  /**
   * Exit a position
   */
  async exitPosition(trade, currentPrice, exitDecision) {
    try {
      // Handle partial exits for memecoin strategy
      if (exitDecision.sellPercentage && exitDecision.sellPercentage < 1.0) {
        // This is a partial exit - IMPORTANT: Update the amount!
        const soldAmount = trade.amount * exitDecision.sellPercentage;
        const remainingAmount = trade.amount * (1 - exitDecision.sellPercentage);
        const soldValue = soldAmount * currentPrice;
        const pnl = (currentPrice - trade.entry_price) * soldAmount;
        
        // Log partial exit
        console.log(`  📉 Partial exit (${(exitDecision.sellPercentage * 100).toFixed(0)}%): ${trade.token_symbol} - ${exitDecision.reason} | P&L: $${pnl.toFixed(2)}`);
        
        // Update trade: reduce amount and update notes
        const updatedNotes = (trade.notes || '') + ` | ${exitDecision.note || `partial_exit_${exitDecision.sellPercentage}`}`;
        await this.db.run(
          'UPDATE paper_trades SET amount = ?, notes = ? WHERE id = ?',
          [remainingAmount, updatedNotes, trade.id]
        );
        
        // Log the realized P&L for tracking (optional: create separate partial_exit_history table)
        logger.info('Partial exit executed', {
          token: trade.token_symbol,
          soldPercentage: exitDecision.sellPercentage,
          pnl: pnl,
          remainingAmount: remainingAmount
        });
        
        return;
      }
      
      // Full exit
      await this.db.closePaperTrade(trade.id, currentPrice, exitDecision.reason);
      
      const pnl = (currentPrice - trade.entry_price) * trade.amount;
      const pnlPct = ((currentPrice - trade.entry_price) / trade.entry_price) * 100;
      
      const emoji = pnl > 0 ? '✅' : '❌';
      console.log(`  ${emoji} Exit: ${trade.token_symbol} | P&L: $${pnl.toFixed(2)} (${pnlPct.toFixed(1)}%) | ${exitDecision.reason}`);
    } catch (error) {
      console.error('Error exiting position:', error.message);
    }
  }

  /**
   * Get current price for a token (PRODUCTION - NO MOCK MODE)
   */
  async getCurrentPrice(trade) {
    try {
      // Fetch real price from price oracle
      const priceData = await priceOracle.getPrice(trade.token_address, trade.chain);
      
      if (priceData && priceData.price) {
        return priceData.price;
      }
      
      // Fallback: use entry price if can't fetch current
      logger.warn('Failed to fetch current price, using entry price', {
        token: trade.token_symbol,
        chain: trade.chain
      });
      return trade.entry_price;
    } catch (error) {
      logger.error('Error getting current price', {
        error: error.message,
        token: trade.token_symbol
      });
      return trade.entry_price;
    }
  }

  /**
   * Get price for transaction entry (PRODUCTION)
   */
  async getMockPrice(transaction) {
    try {
      // If real price is available in transaction, use it
      if (transaction.price_usd && transaction.price_usd > 0) {
        return transaction.price_usd;
      }

      // Fetch real price from oracle
      const priceData = await priceOracle.getPrice(transaction.token_address, transaction.chain);
      
      if (priceData && priceData.price) {
        return priceData.price;
      }

      // If no price available but we have total_value_usd, back-calculate
      if (transaction.total_value_usd && transaction.total_value_usd > 0 && 
          transaction.amount && transaction.amount > 0) {
        const derivedPrice = transaction.total_value_usd / transaction.amount;
        if (derivedPrice > 0 && derivedPrice < Number.MAX_SAFE_INTEGER) {
          logger.info('Using derived price from transaction value', {
            token: transaction.token_symbol,
            price: derivedPrice
          });
          return derivedPrice;
        }
      }

      // Final fallback: Use small default to avoid division by zero
      logger.warn('No price data available, using minimal default', {
        token: transaction.token_symbol,
        chain: transaction.chain
      });
      
      // Return minimal but realistic defaults
      if (transaction.chain === 'solana') return 0.0001;
      if (transaction.chain === 'ethereum') return 0.01;
      return 0.001; // Base/Arbitrum
    } catch (error) {
      logger.error('Error getting entry price', {
        error: error.message,
        token: transaction.token_symbol
      });
      return 0.001; // Safe minimal default
    }
  }

  /**
   * Get engine statistics
   */
  async getStats() {
    const openTrades = await this.db.getOpenTrades();
    const allTrades = await this.db.getAllTrades(1000);
    const performance = await this.db.getOverallPerformance();
    
    const openValue = openTrades.reduce((sum, t) => sum + t.entry_value_usd, 0);
    
    return {
      openPositions: openTrades.length,
      totalTrades: allTrades.length,
      openValue,
      performance
    };
  }

  /**
   * Manual trade execution (for testing)
   */
  async executeManualTrade(params) {
    const trade = {
      token_address: params.tokenAddress,
      token_symbol: params.tokenSymbol,
      chain: params.chain,
      strategy_used: params.strategy || 'manual',
      source_wallet: 'manual',
      entry_price: params.entryPrice,
      amount: params.positionSize / params.entryPrice,
      entry_value_usd: params.positionSize,
      notes: params.notes || 'Manual trade'
    };
    
    return this.db.openPaperTrade(trade);
  }
}

module.exports = PaperTradingEngine;


