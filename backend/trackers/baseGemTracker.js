const axios = require('axios');
const { ethers } = require('ethers');
const config = require('../../config/config');
const { getEtherscan } = require('../utils/etherscanV2');

/**
 * Base/Arbitrum Gem Tracker
 * Tracks wallets finding new token launches
 * Focuses on sub-24h tokens with high growth potential
 */
class BaseGemTracker {
  constructor(db, chain = 'base') {
    this.db = db;
    this.chain = chain;
    this.provider = null;
    this.rpcIndex = 0;
    this.lastCheck = new Map();
    this.maxCacheSize = 100;
  }

  async init() {
    // Connect to RPC - PRODUCTION MODE ONLY
    const rpcEndpoints = config.rpc[this.chain];
    for (const rpc of rpcEndpoints) {
      try {
        this.provider = new ethers.JsonRpcProvider(rpc);
        await this.provider.getBlockNumber();
        console.log(`  ✓ Connected to ${this.chain} RPC: ${rpc}`);
        return;
      } catch (error) {
        console.log(`  ⚠️  Failed to connect to ${rpc}, trying next...`);
      }
    }
    
    throw new Error(`Failed to connect to any ${this.chain} RPC. Check your internet connection and RPC endpoints.`);
  }

  /**
   * Track multiple wallets - 1-MINUTE OPTIMIZED
   */
  async trackWallets(wallets) {
    const transactions = [];

    // PARALLEL processing with Promise.allSettled for speed
    // Etherscan V2 allows 5 requests/second for all EVM chains
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
   * Track a single wallet - PRODUCTION ONLY
   */
  async trackWallet(wallet) {
    try{
      const lastBlock = this.lastCheck.get(wallet.address) || await this.getRecentBlock();
      const transactions = await this.getWalletTransactions(wallet.address, lastBlock);
      
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
      console.error(`Error tracking ${this.chain} wallet ${wallet.address}:`, error.message);
      return [];
    }
  }

  /**
   * Get wallet transactions
   */
  async getWalletTransactions(address, fromBlock) {
    // Use Etherscan V2 unified API (works for Base, Arbitrum, and all EVM chains)
    const etherscan = getEtherscan();
    if (etherscan) {
      const transactions = await etherscan.getTokenTransactions(address, this.chain, fromBlock);
      if (transactions && transactions.length > 0) {
        return transactions.slice(0, 20);
      }
    }

    // Fallback to RPC
    return this.getTransactionsViaRPC(address);
  }

  /**
   * Get transactions via RPC
   */
  async getTransactionsViaRPC(address) {
    // RPC fallback is unreliable with public endpoints
    // Return empty array and let system continue
    // Primary method should be Etherscan V2 API
    return [];
  }

  /**
   * Process transaction
   */
  async processTransaction(tx, wallet) {
    try {
      const priceOracle = require('../services/priceOracle');
      
      const isBuy = tx.to && tx.to.toLowerCase() === wallet.address.toLowerCase();
      const tokenAddress = tx.contractAddress || tx.address;
      const tokenSymbol = tx.tokenSymbol || 'UNKNOWN';
      const amount = parseFloat(tx.value || 0) / Math.pow(10, parseInt(tx.tokenDecimal || 18));
      
      // Fetch real price from oracle
      let price_usd = 0;
      let total_value_usd = 0;
      
      try {
        const priceData = await priceOracle.getPrice(tokenAddress, this.chain);
        if (priceData && priceData.price) {
          price_usd = priceData.price;
          total_value_usd = amount * price_usd;
          
          // Update token metadata for discovery
          await this.updateTokenMetadata(tokenAddress, tokenSymbol, priceData);
        }
      } catch (priceError) {
        console.error(`Error fetching ${this.chain} price:`, priceError.message);
      }
      
      return {
        wallet_address: wallet.address,
        chain: this.chain,
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
      const existingToken = await this.db.getToken(tokenAddress);
      
      const tokenData = {
        address: tokenAddress,
        chain: this.chain,
        symbol: tokenSymbol,
        name: tokenSymbol,
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
      console.error(`Error updating ${this.chain} token metadata:`, error.message);
    }
  }

  /**
   * Check if token is new (< 24 hours old)
   */
  async isNewToken(tokenAddress) {
    try {
      // Query token creation transaction
      // This is simplified - in production you'd check contract deployment time
      const token = await this.db.getToken(tokenAddress);
      
      if (token && token.creation_time) {
        const ageHours = (Date.now() - new Date(token.creation_time).getTime()) / (1000 * 60 * 60);
        return ageHours < 24;
      }
      
      return false; // Unknown age, assume not new
    } catch (error) {
      return false;
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
   * Get token price
   */
  async getTokenPrice(tokenAddress) {
    // In production, integrate with DEX price aggregators
    return Math.random() * 100;
  }

  /**
   * Get recent block - PRODUCTION ONLY
   */
  async getRecentBlock() {
    const currentBlock = await this.provider.getBlockNumber();
    
    // On first run for a wallet, look back further to get historical data
    const firstRun = this.lastCheck.size === 0;
    const blocksToLookBack = firstRun ? 100000 : 2000; // ~14 days vs ~8 hours
    
    return currentBlock - blocksToLookBack;
  }
}

module.exports = BaseGemTracker;

