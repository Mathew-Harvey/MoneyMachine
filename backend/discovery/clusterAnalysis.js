const config = require('../../config/config');

/**
 * Cluster Analysis System
 * Groups similar wallets and detects coordinated trading
 * 
 * Clustering Methods:
 * - Token overlap: Wallets trading same tokens
 * - Timing correlation: Wallets buying/selling at similar times
 * - Strategy similarity: Similar trading patterns
 */
class ClusterAnalysis {
  constructor(db) {
    this.db = db;
  }

  /**
   * Analyze and create wallet clusters
   */
  async analyzeWallets(wallets) {
    if (!config.clustering.enabled) {
      return [];
    }

    console.log('🔬 Analyzing wallet clusters...');
    
    try {
      // Get trading history for all wallets
      const walletsWithHistory = await this.getWalletHistories(wallets);
      
      // Find clusters based on token overlap
      const tokenClusters = this.findTokenOverlapClusters(walletsWithHistory);
      
      // Find clusters based on timing
      const timingClusters = this.findTimingClusters(walletsWithHistory);
      
      // Merge and save clusters
      const allClusters = [...tokenClusters, ...timingClusters];
      const savedClusters = await this.saveClusters(allClusters);
      
      console.log(`✓ Found ${savedClusters.length} wallet clusters`);
      
      return savedClusters;
    } catch (error) {
      console.error('Cluster analysis error:', error.message);
      return [];
    }
  }

  /**
   * Get trading history for wallets
   */
  async getWalletHistories(wallets) {
    const histories = [];
    
    for (const wallet of wallets) {
      try {
        const transactions = await this.db.getWalletTransactions(wallet.address, 100);
        
        // Extract unique tokens traded
        const tokens = new Set(transactions.map(tx => tx.token_address));
        
        // Group by time periods
        const trades = transactions.map(tx => ({
          token: tx.token_address,
          timestamp: new Date(tx.timestamp).getTime(),
          action: tx.action
        }));
        
        histories.push({
          wallet: wallet.address,
          chain: wallet.chain,
          tokens: Array.from(tokens),
          trades,
          transactionCount: transactions.length
        });
      } catch (error) {
        console.error(`Error getting history for ${wallet.address}:`, error.message);
      }
    }
    
    return histories;
  }

  /**
   * Find clusters based on token overlap
   */
  findTokenOverlapClusters(walletsWithHistory) {
    const clusters = [];
    const processed = new Set();
    
    for (let i = 0; i < walletsWithHistory.length; i++) {
      if (processed.has(i)) continue;
      
      const wallet1 = walletsWithHistory[i];
      const cluster = {
        wallets: [wallet1.wallet],
        tokens: new Set(wallet1.tokens),
        type: 'token_overlap'
      };
      
      // Find similar wallets
      for (let j = i + 1; j < walletsWithHistory.length; j++) {
        if (processed.has(j)) continue;
        
        const wallet2 = walletsWithHistory[j];
        const similarity = this.calculateTokenSimilarity(wallet1.tokens, wallet2.tokens);
        
        if (similarity >= config.clustering.similarityThreshold) {
          cluster.wallets.push(wallet2.wallet);
          wallet2.tokens.forEach(t => cluster.tokens.add(t));
          processed.add(j);
        }
      }
      
      // Only save clusters with minimum size
      if (cluster.wallets.length >= config.clustering.minClusterSize) {
        clusters.push({
          ...cluster,
          tokens: Array.from(cluster.tokens)
        });
      }
      
      processed.add(i);
    }
    
    return clusters;
  }

  /**
   * Find clusters based on timing correlation
   */
  findTimingClusters(walletsWithHistory) {
    const clusters = [];
    const timeWindow = 3600000; // 1 hour in milliseconds
    
    // Group trades by token and time
    const tokenTrades = {};
    
    for (const wallet of walletsWithHistory) {
      for (const trade of wallet.trades) {
        if (!tokenTrades[trade.token]) {
          tokenTrades[trade.token] = [];
        }
        
        tokenTrades[trade.token].push({
          wallet: wallet.wallet,
          timestamp: trade.timestamp,
          action: trade.action
        });
      }
    }
    
    // Find coordinated trading
    for (const [token, trades] of Object.entries(tokenTrades)) {
      // Sort by timestamp
      trades.sort((a, b) => a.timestamp - b.timestamp);
      
      // Look for multiple wallets buying within time window
      for (let i = 0; i < trades.length; i++) {
        const coordinated = [trades[i]];
        
        for (let j = i + 1; j < trades.length; j++) {
          if (trades[j].timestamp - trades[i].timestamp > timeWindow) {
            break;
          }
          
          if (trades[j].action === trades[i].action) {
            coordinated.push(trades[j]);
          }
        }
        
        if (coordinated.length >= config.clustering.minClusterSize) {
          const wallets = [...new Set(coordinated.map(c => c.wallet))];
          
          clusters.push({
            wallets,
            tokens: [token],
            type: 'timing_correlation',
            timestamp: trades[i].timestamp,
            action: trades[i].action
          });
        }
      }
    }
    
    return clusters;
  }

  /**
   * Calculate token overlap similarity (Jaccard index)
   */
  calculateTokenSimilarity(tokens1, tokens2) {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    const intersection = new Set([...set1].filter(t => set2.has(t)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Save clusters to database
   */
  async saveClusters(clusters) {
    const saved = [];
    
    for (const cluster of clusters) {
      try {
        // Create cluster
        const description = cluster.type === 'token_overlap'
          ? `Wallets trading similar tokens: ${cluster.tokens.slice(0, 3).join(', ')}`
          : `Coordinated ${cluster.action} at ${new Date(cluster.timestamp).toISOString()}`;
        
        const result = await this.db.run(
          'INSERT INTO wallet_clusters (cluster_name, description) VALUES (?, ?)',
          [`Cluster_${cluster.type}_${Date.now()}`, description]
        );
        
        const clusterId = result.lastID;
        
        // Add wallet members
        for (const wallet of cluster.wallets) {
          await this.db.run(
            'INSERT OR IGNORE INTO wallet_cluster_members (wallet_address, cluster_id) VALUES (?, ?)',
            [wallet, clusterId]
          );
        }
        
        saved.push({
          id: clusterId,
          ...cluster
        });
      } catch (error) {
        console.error('Error saving cluster:', error.message);
      }
    }
    
    return saved;
  }

  /**
   * Get clusters for a wallet
   */
  async getWalletClusters(walletAddress) {
    try {
      const clusters = await this.db.query(`
        SELECT 
          wc.id,
          wc.cluster_name,
          wc.description,
          wc.created_at,
          COUNT(wcm.wallet_address) as member_count
        FROM wallet_clusters wc
        JOIN wallet_cluster_members wcm ON wc.id = wcm.cluster_id
        WHERE wc.id IN (
          SELECT cluster_id 
          FROM wallet_cluster_members 
          WHERE wallet_address = ?
        )
        GROUP BY wc.id
      `, [walletAddress]);
      
      return clusters;
    } catch (error) {
      console.error('Error getting wallet clusters:', error.message);
      return [];
    }
  }

  /**
   * Detect coordinated buying signals
   * Returns true if multiple wallets in a cluster are buying
   */
  async detectCoordinatedBuying(tokenAddress, chain) {
    try {
      // Get recent buy transactions for this token
      const recentBuys = await this.db.query(`
        SELECT DISTINCT wallet_address
        FROM transactions
        WHERE 
          token_address = ?
          AND chain = ?
          AND action = 'buy'
          AND timestamp >= datetime('now', '-1 hour')
      `, [tokenAddress, chain]);
      
      if (recentBuys.length < 2) {
        return false;
      }
      
      // Check if these wallets share any clusters
      for (let i = 0; i < recentBuys.length; i++) {
        for (let j = i + 1; j < recentBuys.length; j++) {
          const sharedClusters = await this.db.query(`
            SELECT cluster_id
            FROM wallet_cluster_members
            WHERE wallet_address IN (?, ?)
            GROUP BY cluster_id
            HAVING COUNT(DISTINCT wallet_address) = 2
          `, [recentBuys[i].wallet_address, recentBuys[j].wallet_address]);
          
          if (sharedClusters.length > 0) {
            return true; // Coordinated buying detected
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error detecting coordinated buying:', error.message);
      return false;
    }
  }
}

module.exports = ClusterAnalysis;


