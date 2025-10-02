const config = require('../../config/config');
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
    this.lastProcessedTx = {};
  }

  async init() {
    console.log('💰 Initializing Paper Trading Engine...');
    
    // Initialize all strategies
    this.strategies.arbitrage = new ArbitrageStrategy(this.db);
    this.strategies.memecoin = new MemeStrategy(this.db);
    this.strategies.earlyGem = new EarlyGemStrategy(this.db);
    this.strategies.adaptive = new AdaptiveStrategy(this.db);
    
    console.log('✓ Paper Trading Engine ready');
  }

  /**
   * Process new transactions and execute trades
   */
  async processTransactions(transactions) {
    let tradesExecuted = 0;
    
    for (const tx of transactions) {
      // Skip if already processed
      const txKey = `${tx.wallet_address}_${tx.tx_hash}`;
      if (this.lastProcessedTx[txKey]) {
        continue;
      }
      
      try {
        // Get wallet info
        const wallet = await this.db.get(
          'SELECT * FROM wallets WHERE address = ?',
          [tx.wallet_address]
        );
        
        if (!wallet || wallet.status !== 'active') {
          continue;
        }
        
        // Get appropriate strategy
        const strategy = this.strategies[wallet.strategy_type] || this.strategies.adaptive;
        
        // Evaluate if we should copy this trade
        const evaluation = await strategy.evaluateTrade(tx, wallet);
        
        if (evaluation.shouldCopy) {
          // Check risk management
          const riskCheck = await this.riskManager.checkTrade(tx, wallet, evaluation);
          
          if (riskCheck.approved) {
            // Execute paper trade
            const trade = await this.executeTrade(tx, wallet, evaluation);
            
            if (trade) {
              tradesExecuted++;
              console.log(`  ✓ Paper trade executed: ${tx.token_symbol} via ${wallet.strategy_type} strategy`);
            }
          } else {
            console.log(`  ⚠️  Trade blocked by risk manager: ${riskCheck.reason}`);
          }
        }
        
        this.lastProcessedTx[txKey] = true;
      } catch (error) {
        console.error(`Error processing transaction:`, error.message);
      }
    }
    
    return tradesExecuted;
  }

  /**
   * Execute a paper trade
   */
  async executeTrade(transaction, wallet, evaluation) {
    try {
      const trade = {
        token_address: transaction.token_address,
        token_symbol: transaction.token_symbol,
        chain: transaction.chain,
        strategy_used: wallet.strategy_type,
        source_wallet: wallet.address,
        entry_price: transaction.price_usd || this.getMockPrice(transaction),
        amount: evaluation.positionSize / (transaction.price_usd || this.getMockPrice(transaction)),
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
          // Get current price (mock for now)
          const currentPrice = await this.getCurrentPrice(trade);
          
          // Check exit conditions
          const strategy = this.strategies[trade.strategy_used] || this.strategies.adaptive;
          const exitDecision = await strategy.getExitStrategy(trade, currentPrice);
          
          if (exitDecision.shouldExit) {
            await this.exitPosition(trade, currentPrice, exitDecision);
            exitsExecuted++;
          }
        } catch (error) {
          console.error(`Error managing position ${trade.id}:`, error.message);
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
        // This is a partial exit
        const exitValue = trade.entry_value_usd * exitDecision.sellPercentage;
        const remainingValue = trade.entry_value_usd * (1 - exitDecision.sellPercentage);
        
        // Log partial exit
        console.log(`  📉 Partial exit (${(exitDecision.sellPercentage * 100).toFixed(0)}%): ${trade.token_symbol} - ${exitDecision.reason}`);
        
        // Update trade notes to track partial exits
        const updatedNotes = (trade.notes || '') + ` | partial_exit_${exitDecision.sellPercentage}`;
        await this.db.run(
          'UPDATE paper_trades SET notes = ? WHERE id = ?',
          [updatedNotes, trade.id]
        );
        
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
   * Get current price for a token
   */
  async getCurrentPrice(trade) {
    try {
      // In mock mode, simulate price movement
      if (config.mockMode.enabled) {
        const timeElapsed = (Date.now() - new Date(trade.entry_time).getTime()) / 1000; // seconds
        const volatility = trade.strategy_used === 'memecoin' ? 0.3 : 0.1;
        
        // Random walk with drift
        const drift = trade.strategy_used === 'memecoin' ? 0.0001 : 0.00005;
        const randomChange = (Math.random() - 0.5) * volatility * Math.sqrt(timeElapsed / 3600);
        const driftChange = drift * timeElapsed;
        
        return trade.entry_price * (1 + randomChange + driftChange);
      }
      
      // Fetch real price from price oracle
      const priceData = await priceOracle.getPrice(trade.token_address, trade.chain);
      
      if (priceData && priceData.price) {
        logger.debug('Current price fetched', {
          token: trade.token_symbol,
          price: priceData.price,
          source: priceData.source
        });
        return priceData.price;
      }
      
      // Fallback to entry price if fetch fails
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
   * Get price for transaction entry
   */
  async getMockPrice(transaction) {
    try {
      // If real price is available in transaction, use it
      if (transaction.price_usd && transaction.price_usd > 0) {
        return transaction.price_usd;
      }

      // In mock mode, generate consistent price
      if (config.mockMode.enabled) {
        if (transaction.chain === 'solana') {
          return Math.random() * 0.01; // Memecoins typically low price
        } else if (transaction.chain === 'ethereum') {
          return Math.random() * 100; // DeFi tokens higher price
        } else {
          return Math.random() * 10; // Base/Arbitrum mid-range
        }
      }

      // Fetch real price from oracle
      const priceData = await priceOracle.getPrice(transaction.token_address, transaction.chain);
      
      if (priceData && priceData.price) {
        logger.debug('Entry price fetched', {
          token: transaction.token_symbol,
          price: priceData.price,
          source: priceData.source
        });
        return priceData.price;
      }

      // Fallback to reasonable default
      logger.warn('Could not fetch entry price, using default', {
        token: transaction.token_symbol,
        chain: transaction.chain
      });
      return transaction.chain === 'solana' ? 0.001 : 1;
    } catch (error) {
      logger.error('Error getting entry price', {
        error: error.message,
        token: transaction.token_symbol
      });
      return 1; // Safe default
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


