const config = require('../../config/config');
const EthWhaleTracker = require('./ethWhaleTracker');
const SolMemeTracker = require('./solMemeTracker');
const BaseGemTracker = require('./baseGemTracker');

/**
 * Universal Tracker - Coordinates tracking across all chains
 * Manages chain-specific trackers and aggregates results
 */
class UniversalTracker {
  constructor(db) {
    this.db = db;
    this.trackers = {};
    this.isTracking = false;
  }

  async init() {
    console.log('🔧 Initializing Universal Tracker...');
    
    // Initialize chain-specific trackers
    this.trackers.ethereum = new EthWhaleTracker(this.db);
    this.trackers.solana = new SolMemeTracker(this.db);
    this.trackers.base = new BaseGemTracker(this.db);
    this.trackers.arbitrum = new BaseGemTracker(this.db, 'arbitrum'); // Reuse Base tracker for Arbitrum
    
    // Initialize each tracker
    for (const [chain, tracker] of Object.entries(this.trackers)) {
      await tracker.init();
      console.log(`  ✓ ${chain} tracker ready`);
    }
    
    console.log('✓ Universal Tracker initialized');
  }

  /**
   * Track all active wallets across all chains
   * OPTIMIZED FOR 1-MINUTE CYCLES: Smart batching to avoid rate limits
   */
  async trackAllWallets() {
    if (this.isTracking) {
      console.log('⏭️  Tracking already in progress, skipping...');
      return [];  // Return empty array instead of undefined
    }

    this.isTracking = true;
    console.log('\n📡 Starting wallet tracking cycle (1-min optimized)...');
    
    try {
      const startTime = Date.now();
      let totalTransactions = 0;

      // Get all active wallets
      const wallets = await this.db.getWallets(null, 'active');
      
      // SMART BATCHING: Only track subset per cycle to stay under rate limits
      // 1-minute cycles = 60 cycles/hour
      // With 30 wallets, track 6 wallets per cycle = all wallets covered every 5 minutes
      const walletsPerCycle = Math.min(6, Math.ceil(wallets.length / 5));
      const cycleNumber = Math.floor(Date.now() / 60000) % Math.ceil(wallets.length / walletsPerCycle);
      const startIdx = cycleNumber * walletsPerCycle;
      const batchWallets = wallets.slice(startIdx, startIdx + walletsPerCycle);
      
      console.log(`  📊 Tracking ${batchWallets.length}/${wallets.length} wallets (batch ${cycleNumber + 1}/${Math.ceil(wallets.length / walletsPerCycle)})`);

      // Group this batch by chain
      const walletsByChain = this.groupWalletsByChain(batchWallets);

      // Track each chain with MINIMAL delays (1-min cycles need speed)
      const allTransactions = [];
      const chainEntries = Object.entries(walletsByChain);
      
      for (let i = 0; i < chainEntries.length; i++) {
        const [chain, chainWallets] = chainEntries[i];
        
        if (this.trackers[chain] && chainWallets.length > 0) {
          console.log(`  🔍 Checking ${chainWallets.length} ${chain} wallets...`);
          const transactions = await this.trackers[chain].trackWallets(chainWallets);
          console.log(`  ✓ Found ${transactions.length} new transactions on ${chain}`);
          allTransactions.push(...transactions);
          
          // Only delay if more chains remain
          if (i < chainEntries.length - 1) {
            await this.sleep(2000);
          }
        }
      }
      
      totalTransactions = allTransactions.length;

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const walletList = batchWallets.length > 0 
        ? batchWallets.map(w => w.address.substring(0,8)).join(', ')
        : 'none';
      console.log(`✓ Cycle complete: ${totalTransactions} transactions in ${duration}s (${walletList})\n`);

      return allTransactions;
    } catch (error) {
      console.error('❌ Error during tracking cycle:', error.message);
      throw error;
    } finally {
      this.isTracking = false;
    }
  }

  /**
   * Track a single wallet
   */
  async trackWallet(address, chain) {
    const tracker = this.trackers[chain];
    if (!tracker) {
      throw new Error(`No tracker available for chain: ${chain}`);
    }

    const wallet = await this.db.get(
      'SELECT * FROM wallets WHERE address = ? AND chain = ?',
      [address, chain]
    );

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    return tracker.trackWallets([wallet]);
  }

  /**
   * Get real-time data for a wallet
   */
  async getWalletData(address, chain) {
    const tracker = this.trackers[chain];
    if (!tracker) {
      throw new Error(`No tracker available for chain: ${chain}`);
    }

    return tracker.getWalletData(address);
  }

  /**
   * Get current price for a token
   */
  async getTokenPrice(tokenAddress, chain) {
    const tracker = this.trackers[chain];
    if (!tracker) {
      throw new Error(`No tracker available for chain: ${chain}`);
    }

    return tracker.getTokenPrice(tokenAddress);
  }

  /**
   * Group wallets by their blockchain
   */
  groupWalletsByChain(wallets) {
    const grouped = {};
    
    for (const wallet of wallets) {
      if (!grouped[wallet.chain]) {
        grouped[wallet.chain] = [];
      }
      grouped[wallet.chain].push(wallet);
    }
    
    return grouped;
  }

  /**
   * Sleep utility to add delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get tracker status for all chains
   */
  getStatus() {
    const status = {
      isTracking: this.isTracking,
      chains: {}
    };

    for (const [chain, tracker] of Object.entries(this.trackers)) {
      status.chains[chain] = {
        initialized: tracker.initialized || true,
        lastCheck: tracker.lastCheck || null
      };
    }

    return status;
  }
}

module.exports = UniversalTracker;

