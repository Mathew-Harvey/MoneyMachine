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
    this.lastCheck = {};
    this.mockMode = config.mockMode.enabled;
  }

  async init() {
    if (this.mockMode) {
      console.log(`  ⚠️  ${this.chain} tracker running in MOCK MODE`);
      return;
    }

    // Try to connect to RPC
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
    
    console.log(`  ⚠️  All ${this.chain} RPCs failed, falling back to mock mode`);
    this.mockMode = true;
  }

  /**
   * Track multiple wallets
   */
  async trackWallets(wallets) {
    const transactions = [];

    for (const wallet of wallets) {
      try {
        const txs = await this.trackWallet(wallet);
        transactions.push(...txs);
        
        // Add delay between wallet checks to avoid rate limits
        if (wallets.indexOf(wallet) < wallets.length - 1) {
          await this.sleep(2000); // 2 second delay between wallets
        }
      } catch (error) {
        console.error(`  ❌ Error tracking ${wallet.address}:`, error.message);
      }
    }

    return transactions;
  }

  /**
   * Sleep utility to add delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Track a single wallet
   */
  async trackWallet(wallet) {
    if (this.mockMode) {
      return this.generateMockTransactions(wallet);
    }

    try {
      const lastBlock = this.lastCheck[wallet.address] || await this.getRecentBlock();
      const transactions = await this.getWalletTransactions(wallet.address, lastBlock);
      
      const processed = [];
      for (const tx of transactions) {
        const processedTx = await this.processTransaction(tx, wallet);
        if (processedTx) {
          await this.db.addTransaction(processedTx);
          processed.push(processedTx);
        }
      }

      this.lastCheck[wallet.address] = await this.provider.getBlockNumber();
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
      const isBuy = tx.to && tx.to.toLowerCase() === wallet.address.toLowerCase();
      
      return {
        wallet_address: wallet.address,
        chain: this.chain,
        tx_hash: tx.hash || tx.transactionHash,
        token_address: tx.contractAddress || tx.address,
        token_symbol: tx.tokenSymbol || 'UNKNOWN',
        action: isBuy ? 'buy' : 'sell',
        amount: parseFloat(tx.value || 0) / Math.pow(10, parseInt(tx.tokenDecimal || 18)),
        price_usd: 0,
        total_value_usd: 0,
        timestamp: new Date(parseInt(tx.timeStamp || Date.now() / 1000) * 1000).toISOString(),
        block_number: parseInt(tx.blockNumber || 0)
      };
    } catch (error) {
      console.error('Error processing transaction:', error.message);
      return null;
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
   * Get wallet data
   */
  async getWalletData(address) {
    if (this.mockMode) {
      return {
        balance: Math.random() * 10,
        transactions: []
      };
    }

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
   * Get recent block
   */
  async getRecentBlock() {
    if (this.mockMode) {
      return this.chain === 'base' ? 5000000 : 150000000;
    }
    
    const currentBlock = await this.provider.getBlockNumber();
    return currentBlock - 2000;
  }

  /**
   * Generate mock transactions
   */
  generateMockTransactions(wallet) {
    const count = Math.random() < 0.25 ? Math.floor(Math.random() * 3) : 0;
    const transactions = [];
    
    const newTokens = ['NEWCOIN', 'MOONCOIN', 'ALPHAGEM', 'EARLYBIRD', 'GEM'];

    for (let i = 0; i < count; i++) {
      const isBuy = Math.random() > 0.4; // More buys than sells for gem hunters
      
      transactions.push({
        wallet_address: wallet.address,
        chain: this.chain,
        tx_hash: '0x' + Array(64).fill(0).map(() => 
          Math.floor(Math.random() * 16).toString(16)
        ).join(''),
        token_address: '0x' + Array(40).fill(0).map(() => 
          Math.floor(Math.random() * 16).toString(16)
        ).join(''),
        token_symbol: newTokens[Math.floor(Math.random() * newTokens.length)],
        action: isBuy ? 'buy' : 'sell',
        amount: Math.random() * 50000,
        price_usd: Math.random() * 0.1,
        total_value_usd: Math.random() * 500,
        timestamp: new Date().toISOString(),
        block_number: (this.chain === 'base' ? 5000000 : 150000000) + Math.floor(Math.random() * 10000)
      });
    }

    return transactions;
  }
}

module.exports = BaseGemTracker;

