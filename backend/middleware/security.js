const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const logger = require('../utils/logger');

/**
 * Security middleware for API protection
 */

// Rate limiting configuration
const createRateLimiter = (options = {}) => {
  const defaults = {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      res.status(429).json({
        error: 'Too many requests',
        message: 'You have exceeded the rate limit. Please try again later.',
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
      });
    }
  };

  return rateLimit({ ...defaults, ...options });
};

// Helper function to check if IP is local/private network
const isLocalNetwork = (ip) => {
  // Remove IPv6 prefix if present
  const cleanIp = ip.replace('::ffff:', '');
  
  // Localhost
  if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost') {
    return true;
  }
  
  // Private network ranges
  // 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12
  if (
    /^192\.168\./.test(cleanIp) ||
    /^10\./.test(cleanIp) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp)
  ) {
    return true;
  }
  
  return false;
};

// API rate limiter (general)
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  skip: (req) => {
    // Skip rate limiting for local network devices (development)
    return isLocalNetwork(req.ip);
  }
});

// Strict rate limiter for expensive operations
const strictLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many requests for this operation',
  skip: (req) => {
    // Skip rate limiting for local network devices
    return isLocalNetwork(req.ip);
  }
});

// Discover endpoint limiter
const discoveryLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Increased from 5 to allow more manual discovery runs
  message: 'Discovery can only be run 20 times per hour',
  skip: (req) => {
    // Skip rate limiting for local network devices
    return isLocalNetwork(req.ip);
  }
});

// API Key authentication middleware (optional)
const authenticateApiKey = (req, res, next) => {
  const apiKey = process.env.API_KEY;
  
  // If no API key is configured, skip authentication
  if (!apiKey) {
    return next();
  }

  const providedKey = req.header('X-API-Key') || req.query.apiKey;

  if (!providedKey) {
    logger.warn('API request without key', {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required'
    });
  }

  if (providedKey !== apiKey) {
    logger.warn('Invalid API key attempted', {
      ip: req.ip,
      path: req.path
    });
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key'
    });
  }

  next();
};

// Helmet security headers
// VERY relaxed for HTTP local network access
const securityHeaders = helmet({
  contentSecurityPolicy: false, // Disable CSP entirely for HTTP
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  hsts: false, // No HTTPS enforcement
  originAgentCluster: false // Disable origin-agent-cluster header
});

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',')
      : ['*'];

    // Always allow requests without origin (like direct browser access)
    if (allowedOrigins.includes('*') || !origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Allow local network IPs (192.168.x.x)
      if (origin && origin.match(/^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked origin', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Request sanitization
const sanitizeInput = (req, res, next) => {
  // Remove any potentially dangerous characters from query params
  Object.keys(req.query).forEach(key => {
    if (typeof req.query[key] === 'string') {
      req.query[key] = req.query[key].replace(/[<>]/g, '');
    }
  });

  // Remove dangerous characters from body
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].replace(/[<>]/g, '');
      }
    });
  }

  next();
};

// Request logging
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req, res, duration);
  });

  next();
};

// Error handler
const errorHandler = (err, req, res, next) => {
  logger.error('Express error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';

  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'An error occurred',
    ...(isDevelopment && { stack: err.stack })
  });
};

module.exports = {
  apiLimiter,
  strictLimiter,
  discoveryLimiter,
  authenticateApiKey,
  securityHeaders,
  corsOptions,
  sanitizeInput,
  requestLogger,
  errorHandler
};

