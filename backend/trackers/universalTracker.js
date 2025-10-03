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
   */
  async trackAllWallets() {
    if (this.isTracking) {
      console.log('⏭️  Tracking already in progress, skipping...');
      return;
    }

    this.isTracking = true;
    console.log('\n📡 Starting wallet tracking cycle...');
    
    try {
      const startTime = Date.now();
      let totalTransactions = 0;

      // Get all active wallets
      const wallets = await this.db.getWallets(null, 'active');
      console.log(`  📊 Tracking ${wallets.length} active wallets`);

      // Group wallets by chain
      const walletsByChain = this.groupWalletsByChain(wallets);

      // Track each chain sequentially to avoid overwhelming RPCs
      const allTransactions = [];
      for (const [chain, chainWallets] of Object.entries(walletsByChain)) {
        if (this.trackers[chain] && chainWallets.length > 0) {
          console.log(`  🔍 Checking ${chainWallets.length} ${chain} wallets...`);
          const transactions = await this.trackers[chain].trackWallets(chainWallets);
          console.log(`  ✓ Found ${transactions.length} new transactions on ${chain}`);
          allTransactions.push(...transactions);
          
          // Add delay between chains (increased to 5 seconds for better rate limit handling)
          await this.sleep(5000); // 5 second delay between chains
        }
      }
      
      totalTransactions = allTransactions.length;

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✓ Tracking cycle complete: ${totalTransactions} transactions found in ${duration}s\n`);

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

