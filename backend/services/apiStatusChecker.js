const axios = require('axios');
const { Connection } = require('@solana/web3.js');
const { ethers } = require('ethers');
const config = require('../../config/config');
const priceOracle = require('./priceOracle');
const logger = require('../utils/logger');

/**
 * API Status Checker
 * Tests connectivity and status of all external APIs
 * 
 * Services Monitored:
 * 1. Blockchain Explorers (Etherscan, Solscan)
 * 2. RPC Providers (Public + Premium)
 * 3. Price Oracles (CoinGecko, CMC, DexScreener, Jupiter)
 * 4. Premium Services (Helius, QuickNode, Alchemy)
 */
class APIStatusChecker {
  constructor() {
    this.cache = {};
    this.cacheTimeout = 60000; // 1 minute cache
    this.lastCheck = 0;
  }

  /**
   * Get comprehensive API status
   */
  async getAllStatus() {
    const now = Date.now();
    
    // Return cached result if recent
    if (this.cache.all && (now - this.lastCheck) < this.cacheTimeout) {
      return this.cache.all;
    }

    // Clean old cache before setting new (prevent memory leak)
    if (now - this.lastCheck > this.cacheTimeout) {
      this.cache = {}; // Clear old cache
    }

    const results = {
      blockchainExplorers: await this.checkBlockchainExplorers(),
      rpcProviders: await this.checkRPCProviders(),
      priceOracles: await this.checkPriceOracles(),
      premiumServices: await this.checkPremiumServices(),
      recommendations: this.getRecommendations(),
      timestamp: new Date().toISOString()
    };

    this.cache.all = results;
    this.lastCheck = now;
    return results;
  }

  /**
   * Check blockchain explorers (transaction data sources)
   */
  async checkBlockchainExplorers() {
    const explorers = {};

    // Etherscan (EVM chains: Ethereum, Base, Arbitrum)
    explorers.etherscan = await this.checkEtherscan();

    // Solscan (Solana)
    explorers.solscan = await this.checkSolscan();

    // BaseScan (Legacy - now uses Etherscan)
    explorers.basescan = {
      name: 'BaseScan',
      status: explorers.etherscan.connected ? 'connected' : 'not_configured',
      hasApiKey: !!config.apiKeys.basescan,
      note: 'Legacy - Etherscan API now supports Base',
      critical: false
    };

    // Arbiscan (Legacy - now uses Etherscan)
    explorers.arbiscan = {
      name: 'ArbiScan',
      status: explorers.etherscan.connected ? 'connected' : 'not_configured',
      hasApiKey: !!config.apiKeys.arbiscan,
      note: 'Legacy - Etherscan API now supports Arbitrum',
      critical: false
    };

    return explorers;
  }

  /**
   * Check Etherscan API
   */
  async checkEtherscan() {
    const hasKey = !!config.apiKeys.etherscan;
    
    logger.info('Checking Etherscan API', { 
      hasKey, 
      keyPrefix: config.apiKeys.etherscan ? config.apiKeys.etherscan.substring(0, 10) + '...' : 'none'
    });

    if (!hasKey) {
      logger.warn('Etherscan API key not found in config');
      return {
        name: 'Etherscan',
        status: 'not_configured',
        hasApiKey: false,
        connected: false,
        chains: ['ethereum', 'base', 'arbitrum'],
        critical: true,
        note: 'Required for EVM transaction tracking',
        debug: 'ETHERSCAN_API_KEY not set in environment'
      };
    }

    try {
      // Test API key with Ethereum mainnet - V2 endpoint
      logger.debug('Testing Etherscan V2 API key...');
      const response = await axios.get('https://api.etherscan.io/v2/api', {
        params: {
          chainid: 1,  // Ethereum mainnet
          module: 'account',
          action: 'balance',
          address: '0x0000000000000000000000000000000000000000',
          tag: 'latest',
          apikey: config.apiKeys.etherscan
        },
        timeout: 10000
      });

      const connected = response.data.status === '1' || response.data.status === 1;
      
      if (!connected) {
        logger.error('Etherscan API returned invalid response', { 
          status: response.data.status, 
          message: response.data.message,
          result: response.data.result,
          fullResponse: response.data
        });
      } else {
        logger.info('Etherscan API key validated successfully');
      }

      return {
        name: 'Etherscan',
        status: connected ? 'connected' : 'error',
        hasApiKey: true,
        connected,
        chains: ['ethereum', 'base', 'arbitrum'],
        critical: true,
        rateLimit: '5 calls/second (with key)',
        message: connected ? 'API key valid' : `API error: ${response.data.message || 'Unknown'}`,
        debug: connected ? undefined : `Status: ${response.data.status}, Message: ${response.data.message}, Result: ${response.data.result}`
      };
    } catch (error) {
      logger.error('Etherscan API check failed', { 
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        name: 'Etherscan',
        status: 'error',
        hasApiKey: true,
        connected: false,
        chains: ['ethereum', 'base', 'arbitrum'],
        critical: true,
        error: error.message,
        debug: `HTTP ${error.response?.status || 'timeout'}: ${error.response?.data?.message || error.message}`
      };
    }
  }

  /**
   * Check Solscan API (Solana explorer)
   */
  async checkSolscan() {
    const hasKey = !!config.apiKeys.solscan;
    
    logger.info('Checking Solscan API', { 
      hasKey,
      keyPrefix: config.apiKeys.solscan ? config.apiKeys.solscan.substring(0, 15) + '...' : 'none'
    });

    if (!hasKey) {
      logger.warn('Solscan API key not found in config');
      return {
        name: 'Solscan',
        status: 'not_configured',
        hasApiKey: false,
        connected: false,
        chain: 'solana',
        critical: false,
        note: 'Optional - Currently using public Solana RPC for transaction data',
        recommendation: 'Add SOLSCAN_API_KEY for better Solana data',
        debug: 'SOLSCAN_API_KEY not set in environment'
      };
    }

    try {
      // Test API key - Solscan V2 API endpoint
      logger.debug('Testing Solscan API key...');
      const response = await axios.get('https://pro-api.solscan.io/v2.0/account/balance_change', {
        params: {
          address: 'So11111111111111111111111111111111111111112', // Wrapped SOL
          limit: 1
        },
        headers: {
          'token': config.apiKeys.solscan
        },
        timeout: 10000
      });

      logger.info('Solscan API key validated successfully');
      return {
        name: 'Solscan',
        status: 'connected',
        hasApiKey: true,
        connected: true,
        chain: 'solana',
        critical: false,
        rateLimit: '10 calls/second (with key)',
        tier: 'Pro'
      };
    } catch (error) {
      logger.error('Solscan API check failed', { 
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      if (error.response?.status === 401) {
        const upgradeMessage = error.response?.data?.error_message || 'Unauthorized';
        return {
          name: 'Solscan',
          status: 'warning',
          hasApiKey: true,
          connected: false,
          chain: 'solana',
          error: 'API key needs upgrade',
          debug: `HTTP 401: ${upgradeMessage}. Your API key works but has limited access. System will use public Solana RPC instead.`,
          note: 'Not critical - Using free Solana RPC as fallback'
        };
      }

      return {
        name: 'Solscan',
        status: 'error',
        hasApiKey: true,
        connected: false,
        chain: 'solana',
        error: error.message,
        debug: `HTTP ${error.response?.status || 'timeout'}: ${error.response?.data?.error_message || error.message}`,
        note: 'Using free Solana RPC as fallback'
      };
    }
  }

  /**
   * Check RPC providers (blockchain node access)
   */
  async checkRPCProviders() {
    const providers = {};

    // Public RPCs (free, rate-limited)
    providers.publicRPCs = {
      ethereum: await this.checkRPC(config.rpc.ethereum[0], 'ethereum'),
      solana: await this.checkRPC(config.rpc.solana[0], 'solana'),
      base: await this.checkRPC(config.rpc.base[0], 'base'),
      arbitrum: await this.checkRPC(config.rpc.arbitrum[0], 'arbitrum')
    };

    return providers;
  }

  /**
   * Check individual RPC endpoint
   */
  async checkRPC(endpoint, chain) {
    try {
      if (chain === 'solana') {
        const connection = new Connection(endpoint, 'confirmed');
        await connection.getSlot();
        return {
          endpoint,
          status: 'connected',
          type: 'public',
          latency: 'unknown'
        };
      } else {
        // EVM chains
        const provider = new ethers.JsonRpcProvider(endpoint);
        const startTime = Date.now();
        await provider.getBlockNumber();
        const latency = Date.now() - startTime;

        return {
          endpoint,
          status: 'connected',
          type: 'public',
          latency: `${latency}ms`
        };
      }
    } catch (error) {
      return {
        endpoint,
        status: 'error',
        type: 'public',
        error: error.message
      };
    }
  }

  /**
   * Check price oracle APIs
   */
  async checkPriceOracles() {
    const oracles = {};

    // CoinGecko
    oracles.coingecko = await this.checkCoinGecko();

    // CoinMarketCap
    oracles.coinmarketcap = await this.checkCoinMarketCap();

    // DexScreener
    oracles.dexscreener = await this.checkDexScreener();

    // Jupiter (Solana)
    oracles.jupiter = await this.checkJupiter();

    return oracles;
  }

  /**
   * Check CoinGecko API
   */
  async checkCoinGecko() {
    const hasKey = !!config.apiKeys.coingecko;
    
    logger.info('Checking CoinGecko API', { 
      hasKey,
      keyPrefix: config.apiKeys.coingecko ? config.apiKeys.coingecko.substring(0, 10) + '...' : 'none'
    });

    try {
      const url = hasKey
        ? 'https://pro-api.coingecko.com/api/v3/ping'
        : 'https://api.coingecko.com/api/v3/ping';

      const params = hasKey ? { x_cg_pro_api_key: config.apiKeys.coingecko } : {};

      logger.debug(`Testing CoinGecko API (${hasKey ? 'Pro' : 'Free'})...`);
      const response = await axios.get(url, {
        params,
        timeout: 10000
      });

      logger.info('CoinGecko API validated successfully', { tier: hasKey ? 'Pro' : 'Free' });
      return {
        name: 'CoinGecko',
        status: 'connected',
        hasApiKey: hasKey,
        connected: true,
        tier: hasKey ? 'Pro' : 'Free',
        rateLimit: hasKey ? '500 calls/minute' : '10-30 calls/minute',
        critical: false,
        note: 'Provides price data for major tokens'
      };
    } catch (error) {
      logger.error('CoinGecko API check failed', { 
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        tier: hasKey ? 'Pro' : 'Free'
      });
      
      // If Pro API fails, fall back to free tier
      if (hasKey && error.response?.status === 400) {
        return {
          name: 'CoinGecko',
          status: 'warning',
          hasApiKey: hasKey,
          connected: false,
          error: 'Pro API key invalid, using free tier',
          tier: 'Free (fallback)',
          debug: `Pro API failed with 400: ${error.response?.data?.error || error.message}. System will use free tier instead.`,
          note: 'Not critical - DexScreener is primary price source'
        };
      }
      
      return {
        name: 'CoinGecko',
        status: 'error',
        hasApiKey: hasKey,
        connected: false,
        error: error.message,
        debug: `${hasKey ? 'Pro API' : 'Free API'} - HTTP ${error.response?.status || 'timeout'}: ${error.message}`,
        note: 'Not critical - DexScreener is primary price source'
      };
    }
  }

  /**
   * Check CoinMarketCap API
   */
  async checkCoinMarketCap() {
    const hasKey = !!config.apiKeys.coinmarketcap;

    if (!hasKey) {
      return {
        name: 'CoinMarketCap',
        status: 'not_configured',
        hasApiKey: false,
        connected: false,
        critical: false,
        note: 'Optional fallback price source',
        recommendation: 'Add COINMARKETCAP_API_KEY for additional price data'
      };
    }

    try {
      const response = await axios.get('https://pro-api.coinmarketcap.com/v1/key/info', {
        headers: {
          'X-CMC_PRO_API_KEY': config.apiKeys.coinmarketcap
        },
        timeout: 5000
      });

      return {
        name: 'CoinMarketCap',
        status: 'connected',
        hasApiKey: true,
        connected: true,
        plan: response.data.data?.plan?.credit_limit_daily || 'Unknown',
        rateLimit: `${response.data.data?.plan?.rate_limit_minute || 30} calls/minute`,
        critical: false
      };
    } catch (error) {
      return {
        name: 'CoinMarketCap',
        status: 'error',
        hasApiKey: true,
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Check DexScreener API
   */
  async checkDexScreener() {
    try {
      // Test with a known token (WETH)
      const response = await axios.get(
        'https://api.dexscreener.com/latest/dex/tokens/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        { timeout: 5000 }
      );

      return {
        name: 'DexScreener',
        status: 'connected',
        hasApiKey: false,
        connected: true,
        chains: ['ethereum', 'solana', 'base', 'arbitrum', 'all-dex'],
        critical: true,
        rateLimit: '300 calls/minute (free)',
        note: 'Primary DEX price source for all chains - NO API KEY NEEDED'
      };
    } catch (error) {
      return {
        name: 'DexScreener',
        status: 'error',
        connected: false,
        critical: true,
        error: error.message
      };
    }
  }

  /**
   * Check Jupiter API (Solana DEX aggregator)
   */
  async checkJupiter() {
    try {
      const response = await axios.get('https://price.jup.ag/v4/price', {
        params: {
          ids: 'So11111111111111111111111111111111111111112' // Wrapped SOL
        },
        timeout: 5000
      });

      return {
        name: 'Jupiter',
        status: 'connected',
        hasApiKey: false,
        connected: true,
        chain: 'solana',
        critical: false,
        rateLimit: 'Unlimited (free)',
        note: 'Solana DEX price aggregator - NO API KEY NEEDED'
      };
    } catch (error) {
      return {
        name: 'Jupiter',
        status: 'error',
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Check premium/optional services
   */
  async checkPremiumServices() {
    const services = {};

    // Helius (Premium Solana RPC)
    services.helius = this.checkHelius();

    // QuickNode (Multi-chain premium RPC)
    services.quicknode = this.checkQuickNode();

    // Alchemy (Multi-chain premium RPC)
    services.alchemy = this.checkAlchemy();

    return services;
  }

  /**
   * Check Helius (Premium Solana RPC)
   */
  checkHelius() {
    const hasKey = !!config.apiKeys.helius;

    return {
      name: 'Helius',
      status: hasKey ? 'configured' : 'not_configured',
      hasApiKey: hasKey,
      chain: 'solana',
      tier: hasKey ? 'Premium' : 'Not configured',
      critical: false,
      benefits: [
        'Enhanced Solana transaction data',
        'Webhooks for real-time updates',
        'Higher rate limits (100k+ requests/month)',
        'Better uptime than public RPCs'
      ],
      pricing: 'Free tier: 100k requests/month',
      signup: 'https://helius.xyz',
      recommendation: hasKey ? null : 'Highly recommended for Solana trading'
    };
  }

  /**
   * Check QuickNode (Multi-chain premium RPC)
   */
  checkQuickNode() {
    const hasKey = !!config.apiKeys.quicknode;

    return {
      name: 'QuickNode',
      status: hasKey ? 'configured' : 'not_configured',
      hasApiKey: hasKey,
      chains: ['ethereum', 'solana', 'base', 'arbitrum', 'polygon', 'bsc'],
      tier: hasKey ? 'Premium' : 'Not configured',
      critical: false,
      benefits: [
        'Multi-chain support (single provider)',
        'Trace API support (advanced transaction analysis)',
        'Archive node access',
        'Guaranteed uptime SLA'
      ],
      pricing: 'Free tier available',
      signup: 'https://quicknode.com',
      recommendation: hasKey ? null : 'Good for multi-chain consistency'
    };
  }

  /**
   * Check Alchemy (Multi-chain premium RPC)
   */
  checkAlchemy() {
    const hasKey = !!config.apiKeys.alchemy;

    return {
      name: 'Alchemy',
      status: hasKey ? 'configured' : 'not_configured',
      hasApiKey: hasKey,
      chains: ['ethereum', 'polygon', 'arbitrum', 'optimism'],
      tier: hasKey ? 'Premium' : 'Not configured',
      critical: false,
      benefits: [
        '300M compute units/month free',
        'Enhanced APIs (NFTs, token balances)',
        'Notify API for webhooks',
        'Best-in-class EVM support'
      ],
      pricing: 'Free tier: 300M compute units/month',
      signup: 'https://alchemy.com',
      recommendation: hasKey ? null : 'Recommended for Ethereum/L2 chains'
    };
  }

  /**
   * Get recommendations based on current configuration
   */
  getRecommendations() {
    const recommendations = [];

    // Critical missing services
    if (!config.apiKeys.etherscan) {
      recommendations.push({
        priority: 'CRITICAL',
        service: 'Etherscan API',
        reason: 'Required for Ethereum, Base, and Arbitrum transaction tracking',
        action: 'Sign up at https://etherscan.io/apis and add ETHERSCAN_API_KEY to .env',
        impact: 'Without this, EVM chain tracking will fail or use slow public endpoints'
      });
    }

    // High priority recommendations
    if (!config.apiKeys.helius) {
      recommendations.push({
        priority: 'HIGH',
        service: 'Helius API',
        reason: 'Much better Solana performance than public RPCs',
        action: 'Sign up at https://helius.xyz and add HELIUS_API_KEY to .env',
        impact: '10-100x faster Solana transaction tracking, better reliability'
      });
    }

    // Medium priority recommendations
    if (!config.apiKeys.solscan) {
      recommendations.push({
        priority: 'MEDIUM',
        service: 'Solscan API',
        reason: 'Better Solana transaction history and token data',
        action: 'Sign up at https://solscan.io and add SOLSCAN_API_KEY to .env',
        impact: 'More detailed Solana wallet analysis'
      });
    }

    if (!config.apiKeys.coingecko) {
      recommendations.push({
        priority: 'MEDIUM',
        service: 'CoinGecko Pro API',
        reason: 'Higher rate limits for price data (500 calls/min vs 10-30)',
        action: 'Upgrade at https://coingecko.com/api and add COINGECKO_API_KEY to .env',
        impact: 'Faster price fetching, less rate limiting'
      });
    }

    // Optional but valuable
    if (!config.apiKeys.alchemy) {
      recommendations.push({
        priority: 'LOW',
        service: 'Alchemy API',
        reason: 'Best-in-class EVM RPC provider with 300M free compute units',
        action: 'Sign up at https://alchemy.com and add ALCHEMY_API_KEY to .env',
        impact: 'More reliable Ethereum/Base/Arbitrum tracking'
      });
    }

    if (!config.apiKeys.quicknode) {
      recommendations.push({
        priority: 'LOW',
        service: 'QuickNode',
        reason: 'Single provider for all chains with advanced features',
        action: 'Sign up at https://quicknode.com and add QUICKNODE_API_KEY to .env',
        impact: 'Simplified multi-chain setup, trace API access'
      });
    }

    return recommendations;
  }

  /**
   * Get quick status summary
   */
  async getStatusSummary() {
    const all = await this.getAllStatus();

    const summary = {
      critical: {
        total: 0,
        connected: 0,
        missing: []
      },
      optional: {
        total: 0,
        connected: 0,
        missing: []
      },
      recommendations: all.recommendations
    };

    // Count critical services
    const criticalServices = [
      all.blockchainExplorers.etherscan,
      all.priceOracles.dexscreener
    ];

    criticalServices.forEach(service => {
      if (service.critical) {
        summary.critical.total++;
        if (service.connected) {
          summary.critical.connected++;
        } else {
          summary.critical.missing.push(service.name);
        }
      }
    });

    // Count optional services
    const optionalServices = [
      ...Object.values(all.blockchainExplorers).filter(s => !s.critical),
      ...Object.values(all.priceOracles).filter(s => !s.critical),
      ...Object.values(all.premiumServices)
    ];

    optionalServices.forEach(service => {
      summary.optional.total++;
      if (service.connected || service.status === 'configured') {
        summary.optional.connected++;
      } else {
        summary.optional.missing.push(service.name);
      }
    });

    return summary;
  }
}

module.exports = new APIStatusChecker();

