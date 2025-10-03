const axios = require('axios');
const { ethers } = require('ethers');
const logger = require('../utils/logger');
const config = require('../../config/config');

/**
 * Price Oracle Service
 * Fetches real-time token prices from multiple sources with fallbacks
 * 
 * Sources:
 * 1. CoinGecko API (free tier: 10-30 calls/min)
 * 2. CoinMarketCap API (free tier: 333 calls/day)
 * 3. DEX Price Oracles (Uniswap, Jupiter, etc.)
 * 4. Cached prices (to reduce API calls)
 */
class PriceOracle {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
    this.coinGeckoApiKey = process.env.COINGECKO_API_KEY;
    this.coinMarketCapApiKey = process.env.COINMARKETCAP_API_KEY;
    this.rateLimitDelay = 1200; // 1.2 seconds between requests
    this.lastRequestTime = 0;
  }

  /**
   * Get token price with fallback sources
   */
  async getPrice(tokenAddress, chain = 'ethereum') {
    try {
      // Check cache first
      const cached = this.getFromCache(tokenAddress, chain);
      if (cached) {
        return cached;
      }

      // In mock mode, generate realistic prices
      if (config.mockMode.enabled) {
        return this.getMockPrice(tokenAddress, chain);
      }

      // Try multiple sources in order
      let price = null;

      // 1. Try CoinGecko (most reliable for known tokens)
      if (!price && this.coinGeckoApiKey) {
        price = await this.getPriceFromCoinGecko(tokenAddress, chain);
      }

      // 2. Try CoinMarketCap
      if (!price && this.coinMarketCapApiKey) {
        price = await this.getPriceFromCoinMarketCap(tokenAddress);
      }

      // 3. Try DEX oracles (for new/unknown tokens)
      if (!price) {
        price = await this.getPriceFromDex(tokenAddress, chain);
      }

      // 4. Fallback to mock if all else fails
      if (!price) {
        logger.warn('All price sources failed, using mock price', {
          tokenAddress,
          chain
        });
        price = this.getMockPrice(tokenAddress, chain);
      }

      // Cache the result
      if (price) {
        this.setCache(tokenAddress, chain, price);
      }

      return price;
    } catch (error) {
      logger.error('Error fetching price', {
        error: error.message,
        tokenAddress,
        chain
      });
      return this.getMockPrice(tokenAddress, chain);
    }
  }

  /**
   * Get price from CoinGecko
   */
  async getPriceFromCoinGecko(tokenAddress, chain) {
    try {
      await this.rateLimitWait();

      const platformId = this.getCoinGeckoPlatformId(chain);
      const url = this.coinGeckoApiKey
        ? `https://pro-api.coingecko.com/api/v3/simple/token_price/${platformId}`
        : `https://api.coingecko.com/api/v3/simple/token_price/${platformId}`;

      const params = {
        contract_addresses: tokenAddress.toLowerCase(),
        vs_currencies: 'usd',
        include_24hr_change: true,
        include_market_cap: true
      };

      if (this.coinGeckoApiKey) {
        params.x_cg_pro_api_key = this.coinGeckoApiKey;
      }

      const response = await axios.get(url, {
        params,
        timeout: 10000
      });

      const data = response.data[tokenAddress.toLowerCase()];
      if (data && data.usd) {
        logger.info('Price fetched from CoinGecko', {
          tokenAddress,
          price: data.usd
        });
        return {
          price: data.usd,
          source: 'coingecko',
          change24h: data.usd_24h_change,
          marketCap: data.usd_market_cap,
          timestamp: Date.now()
        };
      }

      return null;
    } catch (error) {
      if (error.response?.status === 429) {
        logger.warn('CoinGecko rate limit hit');
      } else {
        logger.debug('CoinGecko price fetch failed', {
          error: error.message
        });
      }
      return null;
    }
  }

  /**
   * Get price from CoinMarketCap
   */
  async getPriceFromCoinMarketCap(tokenAddress) {
    try {
      await this.rateLimitWait();

      const response = await axios.get(
        'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
        {
          params: {
            address: tokenAddress,
            convert: 'USD'
          },
          headers: {
            'X-CMC_PRO_API_KEY': this.coinMarketCapApiKey
          },
          timeout: 10000
        }
      );

      if (response.data.data) {
        const data = Object.values(response.data.data)[0];
        if (data && data.quote && data.quote.USD) {
          logger.info('Price fetched from CoinMarketCap', {
            tokenAddress,
            price: data.quote.USD.price
          });
          return {
            price: data.quote.USD.price,
            source: 'coinmarketcap',
            change24h: data.quote.USD.percent_change_24h,
            marketCap: data.quote.USD.market_cap,
            timestamp: Date.now()
          };
        }
      }

      return null;
    } catch (error) {
      logger.debug('CoinMarketCap price fetch failed', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get price from DEX (Uniswap for ETH, Jupiter for Solana)
   */
  async getPriceFromDex(tokenAddress, chain) {
    try {
      if (chain === 'ethereum' || chain === 'base' || chain === 'arbitrum') {
        return await this.getPriceFromUniswap(tokenAddress, chain);
      } else if (chain === 'solana') {
        return await this.getPriceFromJupiter(tokenAddress);
      }
      return null;
    } catch (error) {
      logger.debug('DEX price fetch failed', {
        error: error.message,
        chain
      });
      return null;
    }
  }

  /**
   * Get price from Uniswap V3
   */
  async getPriceFromUniswap(tokenAddress, chain) {
    try {
      // This would require implementing Uniswap V3 pool queries
      // Simplified version - in production, use Uniswap SDK or direct pool queries
      logger.debug('Uniswap price fetch not fully implemented', {
        tokenAddress,
        chain
      });
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get price from Jupiter (Solana)
   */
  async getPriceFromJupiter(tokenAddress) {
    try {
      const response = await axios.get(
        'https://price.jup.ag/v4/price',
        {
          params: {
            ids: tokenAddress
          },
          timeout: 10000
        }
      );

      if (response.data.data && response.data.data[tokenAddress]) {
        const price = response.data.data[tokenAddress].price;
        logger.info('Price fetched from Jupiter', {
          tokenAddress,
          price
        });
        return {
          price,
          source: 'jupiter',
          timestamp: Date.now()
        };
      }

      return null;
    } catch (error) {
      logger.debug('Jupiter price fetch failed', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get multiple prices in batch
   */
  async getPrices(tokens) {
    const prices = {};
    
    // Process in parallel with concurrency limit
    const limit = 5;
    for (let i = 0; i < tokens.length; i += limit) {
      const batch = tokens.slice(i, i + limit);
      const batchResults = await Promise.allSettled(
        batch.map(({ address, chain }) => this.getPrice(address, chain))
      );

      batchResults.forEach((result, index) => {
        const token = batch[index];
        if (result.status === 'fulfilled') {
          prices[token.address] = result.value;
        } else {
          prices[token.address] = this.getMockPrice(token.address, token.chain);
        }
      });

      // Rate limit between batches
      if (i + limit < tokens.length) {
        await this.sleep(this.rateLimitDelay);
      }
    }

    return prices;
  }

  /**
   * Get mock price for testing/fallback
   */
  getMockPrice(tokenAddress, chain) {
    // Generate consistent mock prices based on address hash
    const hash = tokenAddress.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);

    let basePrice;
    if (chain === 'solana') {
      basePrice = (hash % 1000) / 100000; // $0.00001 - $0.01
    } else if (chain === 'ethereum') {
      basePrice = (hash % 10000) / 100; // $0.01 - $100
    } else {
      basePrice = (hash % 1000) / 100; // $0.01 - $10
    }

    // Add some volatility
    const volatility = 0.05; // 5%
    const randomChange = (Math.random() - 0.5) * volatility;
    const price = basePrice * (1 + randomChange);

    return {
      price: Math.max(0.000001, price),
      source: 'mock',
      timestamp: Date.now()
    };
  }

  /**
   * Cache management
   */
  getFromCache(tokenAddress, chain) {
    const key = `${chain}:${tokenAddress.toLowerCase()}`;
    const cached = this.cache.get(key);

    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      logger.debug('Price from cache', { tokenAddress, chain });
      return cached;
    }

    return null;
  }

  setCache(tokenAddress, chain, priceData) {
    const key = `${chain}:${tokenAddress.toLowerCase()}`;
    this.cache.set(key, priceData);

    // Aggressive cache cleanup to prevent memory issues in production
    if (this.cache.size > 500) {  // Reduced from 1000
      const now = Date.now();
      let cleaned = 0;
      
      for (const [k, v] of this.cache.entries()) {
        // Remove entries older than cache timeout
        if (now - v.timestamp > this.cacheTimeout) {
          this.cache.delete(k);
          cleaned++;
        }
      }
      
      // If still too large, remove oldest 25%
      if (this.cache.size > 500) {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = entries.slice(0, Math.floor(entries.length * 0.25));
        toRemove.forEach(([k]) => this.cache.delete(k));
        cleaned += toRemove.length;
      }
      
      if (cleaned > 0) {
        logger.debug('Price cache cleaned', {
          removed: cleaned,
          remaining: this.cache.size
        });
      }
    }
  }

  /**
   * Rate limiting helper
   */
  async rateLimitWait() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      await this.sleep(this.rateLimitDelay - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get CoinGecko platform ID
   */
  getCoinGeckoPlatformId(chain) {
    const platforms = {
      ethereum: 'ethereum',
      solana: 'solana',
      base: 'base',
      arbitrum: 'arbitrum-one'
    };
    return platforms[chain] || 'ethereum';
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('Price cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
module.exports = new PriceOracle();

