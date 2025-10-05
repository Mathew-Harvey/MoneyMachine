const axios = require('axios');
const { Connection, PublicKey } = require('@solana/web3.js');
const config = require('../../config/config');

/**
 * Solana Memecoin Tracker
 * Tracks degen wallets on Solana
 * Focuses on memecoin trading, fast entries/exits
 */
class SolMemeTracker {
  constructor(db) {
    this.db = db;
    this.connection = null;
    this.rpcIndex = 0;
    this.lastCheck = new Map();
    this.maxCacheSize = 100;
  }

  async init() {
    // Connect to Solana RPC - PRODUCTION MODE ONLY
    for (const rpc of config.rpc.solana) {
      try {
        this.connection = new Connection(rpc, 'confirmed');
        await this.connection.getSlot();
        console.log(`  ✓ Connected to Solana RPC: ${rpc}`);
        return;
      } catch (error) {
        console.log(`  ⚠️  Failed to connect to ${rpc}, trying next...`);
      }
    }
    
    throw new Error('Failed to connect to any Solana RPC. Check your internet connection and RPC endpoints.');
  }

  /**
   * Track multiple Solana wallets - 1-MINUTE OPTIMIZED
   */
  async trackWallets(wallets) {
    const transactions = [];

    // PARALLEL processing with controlled concurrency
    // Solana RPC allows ~10 req/sec, batch in groups of 3
    const batchSize = 3;
    for (let i = 0; i < wallets.length; i += batchSize) {
      const batch = wallets.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(wallet => this.trackWallet(wallet))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          transactions.push(...result.value);
        } else if (result.status === 'rejected') {
          console.error(`  ❌ Error tracking ${batch[index].address}:`, result.reason);
        }
      });

      // Small delay between batches
      if (i + batchSize < wallets.length) {
        await this.sleep(1000); // 1 second between batches
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
   * Track a single Solana wallet - PRODUCTION ONLY
   */
  async trackWallet(wallet) {
    try {
      const publicKey = new PublicKey(wallet.address);
      
      // Get recent transactions (reduced from 20 to 10 to limit API calls)
      const signatures = await this.connection.getSignaturesForAddress(
        publicKey,
        { limit: 10 }
      );

      // Get last known signature for this wallet
      const lastSignature = this.lastCheck.get(wallet.address);
      
      // Filter new transactions
      let newSignatures = signatures;
      if (lastSignature) {
        const lastIndex = signatures.findIndex(s => s.signature === lastSignature);
        if (lastIndex > 0) {
          newSignatures = signatures.slice(0, lastIndex);
        }
      }

      // Process transactions - PARALLEL for speed (Solana can handle it)
      const processed = [];
      
      // Fetch all transactions in parallel (Solana RPC is fast)
      const txResults = await Promise.allSettled(
        newSignatures.map(sig => this.getTransaction(sig.signature))
      );
      
      // Process sequentially to avoid database race conditions
      for (let i = 0; i < txResults.length; i++) {
        const result = txResults[i];
        if (result.status === 'fulfilled' && result.value) {
          const processedTx = await this.processTransaction(result.value, wallet, newSignatures[i]);
          if (processedTx) {
            await this.db.addTransaction(processedTx);
            processed.push(processedTx);
          }
        }
      }

      // Update last check with Map
      if (signatures.length > 0) {
        this.lastCheck.set(wallet.address, signatures[0].signature);
        
        // Cleanup old entries to prevent memory leak
        if (this.lastCheck.size > this.maxCacheSize) {
          const entries = Array.from(this.lastCheck.keys());
          const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
          toRemove.forEach(key => this.lastCheck.delete(key));
        }
      }

      return processed;
    } catch (error) {
      console.error(`Error tracking Solana wallet ${wallet.address}:`, error.message);
      return [];
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(signature) {
    try {
      const tx = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0
      });
      return tx;
    } catch (error) {
      console.error('Error fetching transaction:', error.message);
      return null;
    }
  }

  /**
   * Process Solana transaction
   */
  async processTransaction(tx, wallet, signature) {
    try {
      // Parse Solana transaction for token transfers
      // This is simplified - in production you'd parse instruction data
      
      const preBalances = tx.meta?.preTokenBalances || [];
      const postBalances = tx.meta?.postTokenBalances || [];
      
      // Find balance changes for this wallet
      const changes = this.calculateBalanceChanges(preBalances, postBalances, wallet.address);
      
      if (changes.length === 0) {
        return null; // No token transfers
      }

      // Take the first significant change
      const change = changes[0];
      const tokenAddress = change.mint;
      const tokenSymbol = change.symbol || 'UNKNOWN';
      const amount = Math.abs(change.amount);
      
      // Fetch real price from oracle
      const priceOracle = require('../services/priceOracle');
      let price_usd = 0;
      let total_value_usd = 0;
      
      try {
        const priceData = await priceOracle.getPrice(tokenAddress, 'solana');
        if (priceData && priceData.price) {
          price_usd = priceData.price;
          total_value_usd = amount * price_usd;
          
          // Update token metadata for discovery
          await this.updateTokenMetadata(tokenAddress, tokenSymbol, priceData);
        }
      } catch (priceError) {
        console.error('Error fetching Solana price:', priceError.message);
      }
      
      return {
        wallet_address: wallet.address,
        chain: 'solana',
        tx_hash: signature.signature,
        token_address: tokenAddress,
        token_symbol: tokenSymbol,
        action: change.amount > 0 ? 'buy' : 'sell',
        amount,
        price_usd,
        total_value_usd,
        timestamp: new Date(signature.blockTime * 1000).toISOString(),
        block_number: signature.slot
      };
    } catch (error) {
      console.error('Error processing Solana transaction:', error.message);
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
        chain: 'solana',
        symbol: tokenSymbol,
        name: tokenSymbol,
        decimals: 9, // Most Solana tokens use 9 decimals
        current_price_usd: priceData.price,
        max_price_usd: existingToken 
          ? Math.max(existingToken.max_price_usd || 0, priceData.price)
          : priceData.price,
        market_cap_usd: priceData.marketCap || 0,
        creation_time: existingToken?.creation_time || new Date().toISOString()
      };
      
      await this.db.addOrUpdateToken(tokenData);
    } catch (error) {
      console.error('Error updating Solana token metadata:', error.message);
    }
  }

  /**
   * Calculate balance changes from pre/post balances
   */
  calculateBalanceChanges(preBalances, postBalances, walletAddress) {
    const changes = [];
    
    // Compare pre and post balances
    for (const post of postBalances) {
      const pre = preBalances.find(p => 
        p.accountIndex === post.accountIndex && 
        p.mint === post.mint
      );
      
      if (pre) {
        const preAmount = parseFloat(pre.uiTokenAmount.uiAmountString);
        const postAmount = parseFloat(post.uiTokenAmount.uiAmountString);
        const diff = postAmount - preAmount;
        
        if (Math.abs(diff) > 0.0001) { // Ignore dust
          changes.push({
            mint: post.mint,
            amount: diff,
            symbol: null // Would need to fetch metadata
          });
        }
      }
    }
    
    return changes;
  }

  /**
   * Get wallet data - PRODUCTION ONLY
   */
  async getWalletData(address) {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      const signatures = await this.connection.getSignaturesForAddress(publicKey, { limit: 10 });
      
      return {
        balance: balance / 1e9, // Convert lamports to SOL
        transactions: signatures
      };
    } catch (error) {
      console.error('Error getting wallet data:', error.message);
      return { balance: 0, transactions: [] };
    }
  }

  /**
   * Get token price (simplified)
   */
  async getTokenPrice(tokenAddress) {
    // In production, integrate with Jupiter, Birdeye, or similar
    return Math.random() * 10;
  }
}

module.exports = SolMemeTracker;

