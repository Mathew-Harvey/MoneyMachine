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
    this.lastCheck = {};
    this.mockMode = config.mockMode.enabled;
  }

  async init() {
    if (this.mockMode) {
      console.log('  ⚠️  Solana tracker running in MOCK MODE');
      return;
    }

    // Try to connect to Solana RPC
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
    
    console.log('  ⚠️  All Solana RPCs failed, falling back to mock mode');
    this.mockMode = true;
  }

  /**
   * Track multiple Solana wallets
   */
  async trackWallets(wallets) {
    const transactions = [];

    for (const wallet of wallets) {
      try {
        const txs = await this.trackWallet(wallet);
        transactions.push(...txs);
        
        // Add delay between wallet checks to avoid rate limits
        // Solana has stricter rate limits, so we use 5 seconds
        if (wallets.indexOf(wallet) < wallets.length - 1) {
          await this.sleep(5000); // 5 second delay between wallets
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
   * Track a single Solana wallet
   */
  async trackWallet(wallet) {
    if (this.mockMode) {
      return this.generateMockTransactions(wallet);
    }

    try {
      const publicKey = new PublicKey(wallet.address);
      
      // Get recent transactions (reduced from 20 to 10 to limit API calls)
      const signatures = await this.connection.getSignaturesForAddress(
        publicKey,
        { limit: 10 }
      );

      // Get last known signature for this wallet
      const lastSignature = this.lastCheck[wallet.address];
      
      // Filter new transactions
      let newSignatures = signatures;
      if (lastSignature) {
        const lastIndex = signatures.findIndex(s => s.signature === lastSignature);
        if (lastIndex > 0) {
          newSignatures = signatures.slice(0, lastIndex);
        }
      }

      // Process transactions
      const processed = [];
      for (const sig of newSignatures) {
        const tx = await this.getTransaction(sig.signature);
        if (tx) {
          const processedTx = await this.processTransaction(tx, wallet, sig);
          if (processedTx) {
            await this.db.addTransaction(processedTx);
            processed.push(processedTx);
          }
        }
        
        // Add small delay between transaction fetches to avoid rate limits
        if (newSignatures.indexOf(sig) < newSignatures.length - 1) {
          await this.sleep(1000); // 1 second delay between transaction fetches
        }
      }

      // Update last check
      if (signatures.length > 0) {
        this.lastCheck[wallet.address] = signatures[0].signature;
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
      
      return {
        wallet_address: wallet.address,
        chain: 'solana',
        tx_hash: signature.signature,
        token_address: change.mint,
        token_symbol: change.symbol || 'UNKNOWN',
        action: change.amount > 0 ? 'buy' : 'sell',
        amount: Math.abs(change.amount),
        price_usd: 0, // Would need price oracle
        total_value_usd: 0,
        timestamp: new Date(signature.blockTime * 1000).toISOString(),
        block_number: signature.slot
      };
    } catch (error) {
      console.error('Error processing Solana transaction:', error.message);
      return null;
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
   * Get wallet data
   */
  async getWalletData(address) {
    if (this.mockMode) {
      return {
        balance: Math.random() * 100,
        transactions: []
      };
    }

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

  /**
   * Generate mock transactions for testing
   */
  generateMockTransactions(wallet) {
    const count = Math.random() < 0.4 ? Math.floor(Math.random() * 4) : 0;
    const transactions = [];
    
    const memecoins = ['BONK', 'WIF', 'POPCAT', 'MYRO', 'SAMO', 'COPE'];

    for (let i = 0; i < count; i++) {
      const isBuy = Math.random() > 0.5;
      
      transactions.push({
        wallet_address: wallet.address,
        chain: 'solana',
        tx_hash: Array(64).fill(0).map(() => 
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
            Math.floor(Math.random() * 62)
          ]
        ).join(''),
        token_address: Array(44).fill(0).map(() => 
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
            Math.floor(Math.random() * 62)
          ]
        ).join(''),
        token_symbol: memecoins[Math.floor(Math.random() * memecoins.length)],
        action: isBuy ? 'buy' : 'sell',
        amount: Math.random() * 1000000,
        price_usd: Math.random() * 0.01,
        total_value_usd: Math.random() * 1000,
        timestamp: new Date().toISOString(),
        block_number: 200000000 + Math.floor(Math.random() * 10000)
      });
    }

    return transactions;
  }
}

module.exports = SolMemeTracker;

