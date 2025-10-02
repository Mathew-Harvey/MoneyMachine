const config = require('../../config/config');
const WalletScoring = require('./walletScoring');
const ClusterAnalysis = require('./clusterAnalysis');

/**
 * Wallet Discovery System
 * Automatically discovers new profitable wallets
 * 
 * Discovery Strategy:
 * 1. Find tokens that pumped >5x in last 7 days
 * 2. Identify wallets that bought early (bottom 20% of price range)
 * 3. Analyze wallet history for consistent profitability
 * 4. Score and rank discovered wallets
 * 5. Add top performers to discovery pool
 */
class WalletDiscovery {
  constructor(db) {
    this.db = db;
    this.scorer = new WalletScoring(db);
    this.clusterAnalysis = new ClusterAnalysis(db);
    this.mockMode = config.mockMode.enabled;
  }

  /**
   * Main discovery function - finds new profitable wallets
   */
  async discoverNewWallets() {
    console.log('\n🔍 Starting wallet discovery...');
    
    try {
      // Check daily limit
      const today = new Date().toISOString().split('T')[0];
      const lastRun = await this.db.getSystemState('last_discovery_run');
      const countToday = await this.db.getSystemState('discovery_count_today');
      
      let discoveryCount = 0;
      if (lastRun && lastRun.startsWith(today)) {
        discoveryCount = parseInt(countToday) || 0;
      }
      
      if (discoveryCount >= config.discovery.dailyLimit) {
        console.log(`  ℹ️  Daily discovery limit reached (${config.discovery.dailyLimit})`);
        return [];
      }
      
      const remaining = config.discovery.dailyLimit - discoveryCount;
      console.log(`  📊 Discovering up to ${remaining} new wallets...`);
      
      // Step 1: Find pumping tokens
      const pumpingTokens = await this.findPumpingTokens();
      console.log(`  ✓ Found ${pumpingTokens.length} pumping tokens`);
      
      // Step 2: Find early buyers
      const earlyBuyers = await this.findEarlyBuyers(pumpingTokens);
      console.log(`  ✓ Found ${earlyBuyers.length} early buyer wallets`);
      
      // Step 3: Analyze wallet history
      const analyzedWallets = await this.analyzeWallets(earlyBuyers);
      console.log(`  ✓ Analyzed ${analyzedWallets.length} wallets`);
      
      // Step 4: Score and rank wallets
      const scoredWallets = await this.scorer.scoreWallets(analyzedWallets);
      console.log(`  ✓ Scored ${scoredWallets.length} wallets`);
      
      // Step 5: Select top performers
      const topWallets = scoredWallets
        .filter(w => w.score >= config.discovery.minWinRate * 100)
        .slice(0, remaining);
      
      // Step 6: Save to discovered_wallets table
      for (const wallet of topWallets) {
        await this.db.addDiscoveredWallet({
          address: wallet.address,
          chain: wallet.chain,
          profitability_score: wallet.score,
          estimated_win_rate: wallet.winRate,
          discovery_method: wallet.discoveryMethod || 'token_pump_analysis',
          notes: `Found via ${wallet.token || 'multiple tokens'}`
        });
      }
      
      // Update discovery count
      await this.db.setSystemState('last_discovery_run', new Date().toISOString());
      await this.db.setSystemState('discovery_count_today', (discoveryCount + topWallets.length).toString());
      
      console.log(`✓ Discovery complete: Added ${topWallets.length} new wallets\n`);
      
      return topWallets;
    } catch (error) {
      console.error('❌ Discovery error:', error.message);
      return [];
    }
  }

  /**
   * Find tokens that have pumped significantly
   */
  async findPumpingTokens() {
    if (this.mockMode) {
      return this.generateMockPumpingTokens();
    }

    try {
      // Query tokens from database that have significant price movement
      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - config.discovery.pumpTimeframe);
      
      const tokens = await this.db.query(`
        SELECT 
          address,
          chain,
          symbol,
          current_price_usd,
          max_price_usd,
          initial_liquidity_usd,
          (max_price_usd / NULLIF(current_price_usd, 0)) as pump_multiple
        FROM tokens
        WHERE 
          first_seen >= ?
          AND max_price_usd > 0
          AND current_price_usd > 0
          AND (max_price_usd / current_price_usd) >= ?
        ORDER BY pump_multiple DESC
        LIMIT 50
      `, [lookbackDate.toISOString(), config.discovery.pumpThreshold]);
      
      return tokens;
    } catch (error) {
      console.error('Error finding pumping tokens:', error.message);
      return this.generateMockPumpingTokens();
    }
  }

  /**
   * Find wallets that bought tokens early
   */
  async findEarlyBuyers(tokens) {
    if (this.mockMode) {
      return this.generateMockEarlyBuyers();
    }

    const earlyBuyers = new Set();
    
    for (const token of tokens) {
      try {
        // Find all transactions for this token
        const transactions = await this.db.query(`
          SELECT 
            wallet_address,
            chain,
            MIN(price_usd) as entry_price,
            MAX(price_usd) as peak_price,
            timestamp
          FROM transactions
          WHERE 
            token_address = ?
            AND action = 'buy'
            AND chain = ?
          GROUP BY wallet_address
        `, [token.address, token.chain]);
        
        // Filter for wallets that bought in bottom 20% of price range
        for (const tx of transactions) {
          const priceRange = token.max_price_usd - (token.current_price_usd * 0.1); // Approximate initial price
          const entryPoint = (tx.entry_price) / token.max_price_usd;
          
          if (entryPoint <= config.discovery.earlyBuyThreshold) {
            earlyBuyers.add(JSON.stringify({
              address: tx.wallet_address,
              chain: tx.chain,
              token: token.symbol,
              entryPoint: entryPoint
            }));
          }
        }
      } catch (error) {
        console.error(`Error analyzing token ${token.symbol}:`, error.message);
      }
    }
    
    return Array.from(earlyBuyers).map(w => JSON.parse(w));
  }

  /**
   * Analyze wallet trading history
   */
  async analyzeWallets(wallets) {
    const analyzed = [];
    
    console.log(`  🔬 Analyzing ${wallets.length} candidate wallets...`);
    
    for (const wallet of wallets) {
      try {
        // Check if wallet is already tracked or discovered
        const existing = await this.db.get(
          'SELECT address FROM wallets WHERE address = ?',
          [wallet.address]
        );
        
        if (existing) {
          console.log(`    ⏭️  ${wallet.address.substring(0, 10)}... already tracked`);
          continue;
        }
        
        const existingDiscovered = await this.db.get(
          'SELECT address FROM discovered_wallets WHERE address = ?',
          [wallet.address]
        );
        
        if (existingDiscovered) {
          console.log(`    ⏭️  ${wallet.address.substring(0, 10)}... already discovered`);
          continue;
        }
        
        // Get wallet transaction history
        const transactions = await this.db.getWalletTransactions(wallet.address, 100);
        
        console.log(`    📊 ${wallet.address.substring(0, 10)}... has ${transactions.length} transactions`);
        
        if (transactions.length < config.discovery.minTradeCount) {
          console.log(`    ❌ Not enough history (need ${config.discovery.minTradeCount})`);
          continue;
        }
        
        // Calculate basic metrics
        const metrics = this.calculateWalletMetrics(transactions);
        
        console.log(`    📈 Win rate: ${(metrics.winRate * 100).toFixed(1)}%, Profit: $${metrics.totalProfit.toFixed(2)}`);
        
        // Check if meets minimum criteria
        if (metrics.winRate >= config.discovery.minWinRate) {
          if (metrics.totalProfit >= config.discovery.minProfitability) {
            console.log(`    ✅ QUALIFIED! Adding to analyzed list`);
            analyzed.push({
              ...wallet,
              ...metrics,
              transactions: transactions.length
            });
          } else {
            console.log(`    ❌ Profit too low (need $${config.discovery.minProfitability})`);
          }
        } else {
          console.log(`    ❌ Win rate too low (need ${(config.discovery.minWinRate * 100).toFixed(0)}%)`);
        }
      } catch (error) {
        console.error(`    ❌ Error analyzing wallet ${wallet.address}:`, error.message);
      }
    }
    
    return analyzed;
  }

  /**
   * Calculate wallet performance metrics
   */
  calculateWalletMetrics(transactions) {
    // Group transactions by token to match buys with sells
    const positions = {};
    
    for (const tx of transactions) {
      if (!positions[tx.token_address]) {
        positions[tx.token_address] = { buys: [], sells: [] };
      }
      
      if (tx.action === 'buy') {
        positions[tx.token_address].buys.push(tx);
      } else if (tx.action === 'sell') {
        positions[tx.token_address].sells.push(tx);
      }
    }
    
    let wins = 0;
    let losses = 0;
    let totalProfit = 0;
    let totalTrades = 0;
    
    // Calculate P&L for each position
    for (const [token, pos] of Object.entries(positions)) {
      if (pos.buys.length > 0 && pos.sells.length > 0) {
        // Match buys with sells to calculate profit
        const minPairs = Math.min(pos.buys.length, pos.sells.length);
        
        for (let i = 0; i < minPairs; i++) {
          const buy = pos.buys[i];
          const sell = pos.sells[i];
          
          // Calculate profit based on total_value_usd
          const buyValue = buy.total_value_usd || (buy.amount * buy.price_usd);
          const sellValue = sell.total_value_usd || (sell.amount * sell.price_usd);
          
          const profit = sellValue - buyValue;
          totalProfit += profit;
          totalTrades++;
          
          if (profit > 0) wins++;
          else losses++;
        }
      }
    }
    
    const winRate = totalTrades > 0 ? wins / totalTrades : 0;
    
    // Calculate additional metrics
    const avgTradeSize = transactions.length > 0 
      ? transactions.reduce((sum, tx) => sum + (tx.total_value_usd || 0), 0) / transactions.length 
      : 0;
    
    const biggestWin = Math.max(...transactions.filter(tx => tx.action === 'sell')
      .map(tx => tx.total_value_usd || 0), 0);
    
    const biggestLoss = Math.min(...transactions.filter(tx => tx.action === 'sell')
      .map(tx => -(tx.total_value_usd || 0)), 0);
    
    return {
      winRate,
      totalProfit,
      totalTrades,
      wins,
      losses,
      avgTradeSize,
      biggestWin,
      biggestLoss
    };
  }

  /**
   * Generate mock pumping tokens for testing
   */
  generateMockPumpingTokens() {
    const tokens = [];
    const chains = ['ethereum', 'solana', 'base', 'arbitrum'];
    const symbols = ['PUMP', 'MOON', 'GEM', 'ALPHA', 'CHAD', 'DEGEN'];
    
    for (let i = 0; i < 10; i++) {
      tokens.push({
        address: '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        chain: chains[Math.floor(Math.random() * chains.length)],
        symbol: symbols[Math.floor(Math.random() * symbols.length)] + i,
        current_price_usd: Math.random() * 0.01,
        max_price_usd: Math.random() * 0.1,
        pump_multiple: 5 + Math.random() * 20
      });
    }
    
    return tokens;
  }

  /**
   * Generate mock early buyers for testing
   * In mock mode, we'll "discover" variations of existing wallets with good metrics
   */
  async generateMockEarlyBuyers() {
    const buyers = [];
    
    // In mock mode, generate some wallet candidates based on existing patterns
    // but with new addresses (simulating discovery of similar successful wallets)
    const chains = ['ethereum', 'solana', 'base', 'arbitrum'];
    
    // Generate fewer but more "realistic" candidates
    for (let i = 0; i < 5; i++) {
      const chain = chains[Math.floor(Math.random() * chains.length)];
      const address = chain === 'solana'
        ? Array(44).fill(0).map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
            Math.floor(Math.random() * 62)
          ]).join('')
        : '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      
      // Create mock transaction history for this wallet
      await this.createMockWalletHistory(address, chain);
      
      buyers.push({
        address,
        chain,
        token: 'DISCOVERED' + i,
        entryPoint: Math.random() * 0.2,
        discoveryMethod: 'mock_simulation'
      });
    }
    
    return buyers;
  }

  /**
   * Create mock transaction history for a discovered wallet
   * Ensures wallet meets minimum profitability requirements
   */
  async createMockWalletHistory(address, chain) {
    // Generate 25-35 mock transactions for this wallet (above minimum)
    const txCount = 25 + Math.floor(Math.random() * 11);
    const winRate = 0.65 + Math.random() * 0.15; // 65-80% win rate
    
    let totalProfit = 0;
    const targetProfit = config.discovery.minProfitability * (1 + Math.random()); // $5k-10k
    
    for (let i = 0; i < txCount; i++) {
      const tokenAddress = '0x' + Array(40).fill(0).map(() => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      
      const isWin = Math.random() < winRate;
      
      // Calculate trade size to reach target profit
      const baseTradeSize = 500 + Math.random() * 1500; // $500-$2000 per trade
      const buyValue = baseTradeSize;
      
      // For wins, aim for 20-100% profit, for losses 10-30% loss
      const profitMultiplier = isWin 
        ? (1.2 + Math.random() * 0.8)  // 20-100% gain
        : (0.7 + Math.random() * 0.2); // 10-30% loss
      
      const sellValue = buyValue * profitMultiplier;
      const tradeProfit = sellValue - buyValue;
      totalProfit += tradeProfit;
      
      // Create buy transaction
      await this.db.addTransaction({
        wallet_address: address,
        chain,
        tx_hash: '0x' + Array(64).fill(0).map(() => 
          Math.floor(Math.random() * 16).toString(16)
        ).join(''),
        token_address: tokenAddress,
        token_symbol: 'DISC' + i,
        action: 'buy',
        amount: 1000,
        price_usd: buyValue / 1000,
        total_value_usd: buyValue,
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        block_number: 1000000 + Math.floor(Math.random() * 100000)
      });
      
      // Create corresponding sell transaction
      await this.db.addTransaction({
        wallet_address: address,
        chain,
        tx_hash: '0x' + Array(64).fill(0).map(() => 
          Math.floor(Math.random() * 16).toString(16)
        ).join(''),
        token_address: tokenAddress,
        token_symbol: 'DISC' + i,
        action: 'sell',
        amount: 1000,
        price_usd: sellValue / 1000,
        total_value_usd: sellValue,
        timestamp: new Date(Date.now() - Math.random() * 25 * 24 * 60 * 60 * 1000).toISOString(),
        block_number: 1000000 + Math.floor(Math.random() * 100000)
      });
    }
    
    console.log(`    💰 Created wallet with ${txCount} trades, ${(winRate * 100).toFixed(0)}% WR, $${totalProfit.toFixed(0)} profit`);
  }
}

module.exports = WalletDiscovery;


