const axios = require('axios');
const { ethers } = require('ethers');
const config = require('../../config/config');
const { getEtherscan } = require('../utils/etherscanV2');

/**
 * Ethereum Whale Tracker
 * Tracks arbitrage wallets on Ethereum
 * Focuses on DEX arbitrage, MEV, and DeFi farming strategies
 */
class EthWhaleTracker {
  constructor(db) {
    this.db = db;
    this.provider = null;
    this.rpcIndex = 0;
    this.lastCheck = new Map();
    this.maxCacheSize = 100;
  }

  async init() {
    // Connect to Ethereum RPC - PRODUCTION MODE ONLY
    for (const rpc of config.rpc.ethereum) {
      try {
        this.provider = new ethers.JsonRpcProvider(rpc);
        await this.provider.getBlockNumber();
        console.log(`  ✓ Connected to Ethereum RPC: ${rpc}`);
        return;
      } catch (error) {
        console.log(`  ⚠️  Failed to connect to ${rpc}, trying next...`);
      }
    }
    
    throw new Error('Failed to connect to any Ethereum RPC. Check your internet connection and RPC endpoints.');
  }

  /**
   * Track multiple Ethereum wallets - 1-MINUTE OPTIMIZED
   */
  async trackWallets(wallets) {
    const transactions = [];

    // PARALLEL processing with Promise.allSettled for speed
    // Etherscan V2 allows 5 requests/second
    const results = await Promise.allSettled(
      wallets.map(wallet => this.trackWallet(wallet))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        transactions.push(...result.value);
      } else if (result.status === 'rejected') {
        console.error(`  ❌ Error tracking ${wallets[index].address}:`, result.reason);
      }
    });

    return transactions;
  }

  /**
   * Sleep utility to add delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Track a single Ethereum wallet - PRODUCTION ONLY
   */
  async trackWallet(wallet) {
    try {
      // Get recent transactions using Etherscan API (free tier)
      const lastBlock = this.lastCheck.get(wallet.address) || await this.getRecentBlock();
      const transactions = await this.getWalletTransactions(wallet.address, lastBlock);
      
      // Process and store transactions
      const processed = [];
      for (const tx of transactions) {
        const processedTx = await this.processTransaction(tx, wallet);
        if (processedTx) {
          await this.db.addTransaction(processedTx);
          processed.push(processedTx);
        }
      }

      // Update last check with Map
      const currentBlock = await this.provider.getBlockNumber();
      this.lastCheck.set(wallet.address, currentBlock);
      
      // Cleanup old entries to prevent memory leak
      if (this.lastCheck.size > this.maxCacheSize) {
        const entries = Array.from(this.lastCheck.keys());
        const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
        toRemove.forEach(key => this.lastCheck.delete(key));
      }
      
      return processed;
    } catch (error) {
      console.error(`Error tracking wallet ${wallet.address}:`, error.message);
      return [];
    }
  }

  /**
   * Get wallet transactions from block explorer
   */
  async getWalletTransactions(address, fromBlock) {
    // Use Etherscan V2 unified API
    const etherscan = getEtherscan();
    if (etherscan) {
      const transactions = await etherscan.getTokenTransactions(address, 'ethereum', fromBlock);
      if (transactions && transactions.length > 0) {
        return transactions.slice(0, 20); // Last 20 transactions
      }
    }

    // Fallback to direct RPC queries (limited data)
    return this.getTransactionsViaRPC(address);
  }

  /**
   * Get transactions via RPC (fallback method)
   */
  async getTransactionsViaRPC(address) {
    // RPC fallback is unreliable with public endpoints
    // Return empty array and let system continue
    // Primary method should be Etherscan V2 API
    return [];
  }

  /**
   * Process a transaction and extract relevant data
   */
  async processTransaction(tx, wallet) {
    try {
      const priceOracle = require('../services/priceOracle');
      
      // Determine if it's a buy or sell
      const isBuy = tx.to && tx.to.toLowerCase() === wallet.address.toLowerCase();
      const tokenAddress = tx.contractAddress || tx.address;
      const tokenSymbol = tx.tokenSymbol || 'UNKNOWN';
      const amount = parseFloat(tx.value || 0) / Math.pow(10, parseInt(tx.tokenDecimal || 18));
      
      // Fetch real price from oracle
      let price_usd = 0;
      let total_value_usd = 0;
      
      try {
        const priceData = await priceOracle.getPrice(tokenAddress, 'ethereum');
        if (priceData && priceData.price) {
          price_usd = priceData.price;
          total_value_usd = amount * price_usd;
          
          // Update token metadata for discovery
          await this.updateTokenMetadata(tokenAddress, tokenSymbol, priceData);
        }
      } catch (priceError) {
        console.error('Error fetching price:', priceError.message);
      }
      
      return {
        wallet_address: wallet.address,
        chain: 'ethereum',
        tx_hash: tx.hash || tx.transactionHash,
        token_address: tokenAddress,
        token_symbol: tokenSymbol,
        action: isBuy ? 'buy' : 'sell',
        amount,
        price_usd,
        total_value_usd,
        timestamp: new Date(parseInt(tx.timeStamp || Date.now() / 1000) * 1000).toISOString(),
        block_number: parseInt(tx.blockNumber || 0)
      };
    } catch (error) {
      console.error('Error processing transaction:', error.message);
      return null;
    }
  }

  /**
   * Update token metadata in database for discovery
   */
  async updateTokenMetadata(tokenAddress, tokenSymbol, priceData) {
    try {
      // Get existing token data
      const existingToken = await this.db.getToken(tokenAddress);
      
      const tokenData = {
        address: tokenAddress,
        chain: 'ethereum',
        symbol: tokenSymbol,
        name: tokenSymbol, // Could fetch from contract
        decimals: 18,
        current_price_usd: priceData.price,
        max_price_usd: existingToken 
          ? Math.max(existingToken.max_price_usd || 0, priceData.price)
          : priceData.price,
        market_cap_usd: priceData.marketCap || 0,
        creation_time: existingToken?.creation_time || new Date().toISOString()
      };
      
      await this.db.addOrUpdateToken(tokenData);
    } catch (error) {
      // Don't fail transaction processing if token update fails
      console.error('Error updating token metadata:', error.message);
    }
  }

  /**
   * Get wallet data - PRODUCTION ONLY
   */
  async getWalletData(address) {
    const balance = await this.provider.getBalance(address);
    return {
      balance: ethers.formatEther(balance),
      transactions: await this.getWalletTransactions(address, 0)
    };
  }

  /**
   * Get token price (simplified)
   */
  async getTokenPrice(tokenAddress) {
    // In production, you'd integrate with CoinGecko, Uniswap price oracle, etc.
    return Math.random() * 1000; // Mock price
  }

  /**
   * Get recent block number
   */
  async getRecentBlock() {
    const currentBlock = await this.provider.getBlockNumber();
    
    // On first run for a wallet, look back further to get historical data
    const firstRun = this.lastCheck.size === 0;
    const blocksToLookBack = firstRun ? 50000 : 1000; // ~7 days vs ~4 hours
    
    return currentBlock - blocksToLookBack;
  }
}

module.exports = EthWhaleTracker;

