const axios = require('axios');
const logger = require('./logger');

/**
 * Etherscan V2 API Helper
 * Single API key for all EVM chains (Ethereum, Base, Arbitrum, Optimism, etc.)
 * 
 * Chain IDs:
 * - Ethereum: 1
 * - Base: 8453
 * - Arbitrum: 42161
 * - Optimism: 10
 * - Polygon: 137
 */

const CHAIN_IDS = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137
};

class EtherscanV2Helper {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.etherscan.io/v2/api';
    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.minRequestInterval = 200; // 5 requests per second max
  }

  /**
   * Rate limiting helper
   */
  async rateLimitWait() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Get wallet token transactions across any EVM chain
   */
  async getTokenTransactions(address, chain, startBlock = 0) {
    if (!this.apiKey) {
      logger.warn('No Etherscan API key configured');
      return null;
    }

    const chainId = CHAIN_IDS[chain];
    if (!chainId) {
      logger.warn(`Unsupported chain: ${chain}`);
      return null;
    }

    try {
      await this.rateLimitWait();

      const response = await axios.get(this.baseUrl, {
        params: {
          chainid: chainId,
          module: 'account',
          action: 'tokentx',
          address: address,
          startblock: startBlock,
          sort: 'desc',
          apikey: this.apiKey
        },
        timeout: 10000
      });

      if (response.data.status === '1' && response.data.result) {
        logger.debug('Etherscan V2: Fetched transactions', {
          chain,
          chainId,
          address: address.substring(0, 10) + '...',
          count: response.data.result.length
        });
        return response.data.result;
      }

      if (response.data.status === '0' && response.data.message === 'No transactions found') {
        logger.debug('Etherscan V2: No transactions', { chain, address: address.substring(0, 10) + '...' });
        return [];
      }

      logger.warn('Etherscan V2: Unexpected response', {
        chain,
        status: response.data.status,
        message: response.data.message
      });
      return null;

    } catch (error) {
      if (error.response?.status === 429) {
        logger.warn('Etherscan V2: Rate limit hit', { chain });
      } else {
        logger.error('Etherscan V2: API error', {
          chain,
          error: error.message
        });
      }
      return null;
    }
  }

  /**
   * Get normal transactions (ETH transfers)
   */
  async getNormalTransactions(address, chain, startBlock = 0) {
    if (!this.apiKey) {
      return null;
    }

    const chainId = CHAIN_IDS[chain];
    if (!chainId) {
      return null;
    }

    try {
      await this.rateLimitWait();

      const response = await axios.get(this.baseUrl, {
        params: {
          chainid: chainId,
          module: 'account',
          action: 'txlist',
          address: address,
          startblock: startBlock,
          sort: 'desc',
          apikey: this.apiKey
        },
        timeout: 10000
      });

      if (response.data.status === '1' && response.data.result) {
        return response.data.result;
      }

      return [];

    } catch (error) {
      logger.error('Etherscan V2: Failed to fetch normal transactions', {
        chain,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(address, chain) {
    if (!this.apiKey) {
      return null;
    }

    const chainId = CHAIN_IDS[chain];
    if (!chainId) {
      return null;
    }

    try {
      await this.rateLimitWait();

      const response = await axios.get(this.baseUrl, {
        params: {
          chainid: chainId,
          module: 'account',
          action: 'balance',
          address: address,
          tag: 'latest',
          apikey: this.apiKey
        },
        timeout: 10000
      });

      if (response.data.status === '1') {
        return response.data.result;
      }

      return null;

    } catch (error) {
      logger.error('Etherscan V2: Failed to fetch balance', {
        chain,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Verify contract (cross-chain)
   */
  async verifyContract(contractAddress, chain, sourceCode, constructorArguments) {
    if (!this.apiKey) {
      return null;
    }

    const chainId = CHAIN_IDS[chain];
    if (!chainId) {
      return null;
    }

    try {
      const response = await axios.post(this.baseUrl, {
        chainid: chainId,
        module: 'contract',
        action: 'verifysourcecode',
        contractaddress: contractAddress,
        sourceCode: sourceCode,
        constructorArguements: constructorArguments,
        apikey: this.apiKey
      });

      return response.data;

    } catch (error) {
      logger.error('Etherscan V2: Contract verification failed', {
        chain,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get supported chains
   */
  getSupportedChains() {
    return Object.keys(CHAIN_IDS);
  }

  /**
   * Get chain ID
   */
  getChainId(chain) {
    return CHAIN_IDS[chain];
  }
}

// Export singleton instance
let etherscanHelper = null;

function initEtherscan(apiKey) {
  if (!etherscanHelper || (apiKey && etherscanHelper.apiKey !== apiKey)) {
    etherscanHelper = new EtherscanV2Helper(apiKey);
    logger.info('Etherscan V2 helper initialized', {
      hasApiKey: !!apiKey,
      supportedChains: etherscanHelper.getSupportedChains()
    });
  }
  return etherscanHelper;
}

module.exports = {
  initEtherscan,
  getEtherscan: () => etherscanHelper,
  CHAIN_IDS
};

