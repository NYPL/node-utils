const yaml = require('yaml')
const assert = require('node:assert')
const fs = require('fs')

const { decrypt } = require('./kms')

class LoadConfigError extends Error {}

/**
 * @typedef {Object} ReadConfig
 * @property {Object} plaintext - Hash of plaintext vars
 * @property {Object} encrypted - Hash of encrypted vars
 * **/

/**
 *  Given an envName, loads config/{envName}.yaml and returns ReadConfig hash
 *
 *  @return {ReadConfig}
 * **/
const _readAndParseConfig = (envName) => {
  if (!envName) {
    throw new LoadConfigError('Error loading config: No envName given')
  }

  const path = `./config/${envName}.yaml`
  let raw
  try {
    raw = fs.readFileSync(path, 'utf8')
  } catch (e) {
    throw new LoadConfigError(`Error loading config at ${path}`, { cause: e })
  }

  let parsed
  try {
    parsed = yaml.parse(raw)
  } catch (e) {
    throw new LoadConfigError(`Error parsing config at ${path}`, { cause: e })
  }

  const config = {}
  ;['PLAINTEXT_VARIABLES', 'ENCRYPTED_VARIABLES'].forEach((key) => {
    if (parsed[key]) {
      assert(typeof parsed[key] === 'object', `${key} must define an object`)

      const name = key.split('_')[0].toLowerCase()
      config[name] = parsed[key]
    }
  })

  return config
}

let _configPromise
let _config

/**
 *  Load named config, decrypting as necessary
 *
 *  @return {Promise<object>} An object with all decrypted config
 * **/
const loadConfig = (envName = process.env.ENVIRONMENT || 'production') => {
  if (_configPromise) {
    return _configPromise
  }

  const { plaintext, encrypted } = module.exports._readAndParseConfig(envName)

  const config = plaintext || {}

  // Load encrypted variables:
  if (encrypted) {
    _configPromise = decrypt(encrypted)
      .then((decryptedConfig) => ({ ...config, ...decryptedConfig }))
  } else {
    _configPromise = Promise.resolve(config)
  }

  _configPromise = _configPromise.then((c) => {
    _config = c
    return c
  })

  return _configPromise
}

/**
 *  Retrieve config syncronously.
 *
 *  @return {object} config
 *  @throw {LoadConfigError} if config not fully loaded yet.
 * **/
const getConfig = () => {
  if (!_config) {
    throw new LoadConfigError('Attempted to read config before initialized')
  }

  return _config
}

/**
 *  For testing: need a way to reset fetch state:
 * **/
const _reset = () => {
  _configPromise = _config = undefined
}

module.exports = {
  loadConfig,
  getConfig,
  LoadConfigError,
  _readAndParseConfig,
  _reset
}
