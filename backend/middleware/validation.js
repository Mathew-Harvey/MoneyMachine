const { param, query, body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Validation middleware for API endpoints
 */

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', { 
      errors: errors.array(), 
      path: req.path 
    });
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

// Wallet address validation
const walletAddressValidation = [
  param('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required')
    .custom((value) => {
      // Ethereum/EVM address format
      if (value.startsWith('0x') && value.length === 42) {
        return /^0x[a-fA-F0-9]{40}$/.test(value);
      }
      // Solana address format (base58, 32-44 chars)
      if (!value.startsWith('0x') && value.length >= 32 && value.length <= 44) {
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
      }
      return false;
    })
    .withMessage('Invalid wallet address format'),
  handleValidationErrors
];

// Strategy type validation
const strategyValidation = [
  query('strategy')
    .optional()
    .isIn(['copyTrade', 'volumeBreakout', 'smartMoney', 'arbitrage', 'memecoin', 'earlyGem', 'discovery', 'adaptive'])
    .withMessage('Invalid strategy type'),
  handleValidationErrors
];

// Trade status validation
const tradeStatusValidation = [
  query('status')
    .optional()
    .isIn(['open', 'closed'])
    .withMessage('Status must be either "open" or "closed"'),
  handleValidationErrors
];

// Pagination validation
const paginationValidation = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a positive integer'),
  handleValidationErrors
];

// Wallet status update validation
const walletStatusUpdateValidation = [
  param('address').exists(),
  body('status')
    .isIn(['active', 'paused', 'archived'])
    .withMessage('Status must be active, paused, or archived'),
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be a string under 500 characters'),
  handleValidationErrors
];

// Days parameter validation
const daysValidation = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365'),
  handleValidationErrors
];

// Manual trade validation
const manualTradeValidation = [
  body('tokenAddress')
    .trim()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid token address'),
  body('tokenSymbol')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Token symbol must be between 1-20 characters'),
  body('chain')
    .isIn(['ethereum', 'solana', 'base', 'arbitrum'])
    .withMessage('Invalid chain'),
  body('strategy')
    .optional()
    .isIn(['arbitrage', 'memecoin', 'earlyGem', 'discovery', 'manual'])
    .withMessage('Invalid strategy'),
  body('entryPrice')
    .isFloat({ min: 0 })
    .withMessage('Entry price must be a positive number'),
  body('positionSize')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('Position size must be between 0.01 and 10000'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be under 500 characters'),
  handleValidationErrors
];

// Promoted wallet validation
const promotedValidation = [
  query('promoted')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Promoted must be true or false'),
  handleValidationErrors
];

// Export all validations
module.exports = {
  walletAddressValidation,
  strategyValidation,
  tradeStatusValidation,
  paginationValidation,
  walletStatusUpdateValidation,
  daysValidation,
  manualTradeValidation,
  promotedValidation,
  handleValidationErrors
};

