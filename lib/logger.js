const winston = require('winston')

/**
 *  Get default config based on env vars:
 * */
const defaultConfig = () => {
  return {
    json: (
      process.env.LOG_STYLE === 'json' ||
      typeof process.env.AWS_EXECUTION_ENV === 'string' ||
      typeof process.env.LAMBDA_TASK_ROOT === 'string'
    ),
    level: process.env.LOG_LEVEL || 'info'
  }
}

// Initialize config based on env vars at runtime:
let _config = defaultConfig()

// Createe logger instance:
const logger = winston.createLogger({
  level: _config.level
})

/**
 *  (Re-)initialize based on env vars:
 * */
logger.initialize = (config = {}) => {
  _config = { ...defaultConfig(), ...config }

  logger.setFormat(_config)
  logger.setLevel(_config.level)
}

/**
 *  Reset format based on config
 * */
logger.setFormat = (config) => {
  if (logger.transports.length) {
    logger.remove(logger.transports[0])
  }

  // In deployed code, let's do JSON logging to enable CW JSON queries
  const format = config.json
    ? winston.format.json()
    // Locally, let's do colorized plaintext logging:
    : winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )

  logger.add(new winston.transports.Console({ format }))
}

/**
 *  Set log-level
 *
 *  @param {string} level - One of error, warn, info, debug
 */
logger.setLevel = (level) => {
  logger.level = level
}

// Initialize logger based on env vars at runtime:
logger.initialize()

module.exports = logger
