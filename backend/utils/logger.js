const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0 && meta.stack) {
      msg += `\n${meta.stack}`;
    } else if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'moneymaker' },
  transports: [
    // Write all logs to daily rotating file
    new DailyRotateFile({
      filename: path.join(logsDir, 'tracker-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info'
    }),
    // Write all errors to separate file
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error'
    })
  ],
  // Handle exceptions
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log') 
    })
  ],
  // Handle rejections
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log') 
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
} else {
  // In production, only log errors and above to console
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'error'
  }));
}

// Create convenience methods with context
const createContextLogger = (context) => {
  return {
    debug: (message, meta = {}) => logger.debug(message, { context, ...meta }),
    info: (message, meta = {}) => logger.info(message, { context, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { context, ...meta }),
    error: (message, meta = {}) => logger.error(message, { context, ...meta })
  };
};

// Export both raw logger and context creator
module.exports = logger;
module.exports.createLogger = createContextLogger;

// Performance tracking
module.exports.trackPerformance = (operation) => {
  const start = Date.now();
  return () => {
    const duration = Date.now() - start;
    logger.info(`Performance: ${operation} took ${duration}ms`, { 
      operation, 
      duration 
    });
  };
};

// HTTP request logging
module.exports.logRequest = (req, res, duration) => {
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    statusCode: res.statusCode,
    duration: `${duration}ms`
  });
};

// Trading activity logging
module.exports.logTrade = (action, details) => {
  logger.info(`Trade: ${action}`, {
    action,
    ...details,
    category: 'trading'
  });
};

// Wallet tracking logging
module.exports.logWalletActivity = (wallet, details) => {
  logger.info('Wallet Activity', {
    wallet: wallet.substring(0, 10) + '...',
    ...details,
    category: 'tracking'
  });
};

// Discovery logging
module.exports.logDiscovery = (details) => {
  logger.info('Wallet Discovery', {
    ...details,
    category: 'discovery'
  });
};

// Risk management logging
module.exports.logRisk = (level, message, details) => {
  const logLevel = level === 'high' ? 'warn' : 'info';
  logger[logLevel](`Risk ${level}: ${message}`, {
    ...details,
    category: 'risk'
  });
};

// Performance metrics logging
module.exports.logMetrics = (metrics) => {
  logger.info('Performance Metrics', {
    ...metrics,
    category: 'metrics'
  });
};

// System health logging
module.exports.logHealth = (component, status, details) => {
  const logLevel = status === 'healthy' ? 'info' : 'warn';
  logger[logLevel](`Health Check: ${component} - ${status}`, {
    component,
    status,
    ...details,
    category: 'health'
  });
};

