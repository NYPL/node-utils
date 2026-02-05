import yaml from 'yaml'
import assert from 'node:assert'
import { readFileSync } from 'fs'

import { decrypt } from './kms'

class LoadConfigError extends Error { }

interface FlatHash {
  [key: string]: string
}

interface ReadConfig {
  encrypted?: FlatHash
  plaintext?: FlatHash
}

type FileReader = {
  (path: string): string
}

type KmsDecrypter = {
  (values: FlatHash): Promise<FlatHash>
}

interface ConfigDependencies {
  fileReader: FileReader
  kmsDecrypter: KmsDecrypter
}

interface ConfigFactoryParams {
  fileReader?: FileReader
  kmsDecrypter?: KmsDecrypter
}

class Config {
  _configPromise: Promise<FlatHash> | undefined
  _config: FlatHash | undefined

  fileReader: FileReader
  kmsDecrypter: KmsDecrypter

  constructor(dependencies: ConfigDependencies) {
    this.fileReader = dependencies.fileReader
    this.kmsDecrypter = dependencies.kmsDecrypter
  }

  /**
   *  Given an envName, loads config/{envName}.yaml and returns flat hash
   *
   *  @return {FlatHash}
   * **/
  _readAndParseConfig(envName: string): ReadConfig {
    if (!envName) {
      throw new LoadConfigError('Error loading config: No envName given')
    }

    const path = `./config/${envName}.yaml`
    let raw
    try {
      raw = this.fileReader(path)
    } catch (e) {
      throw new LoadConfigError(`Error loading config at ${path}`, { cause: e })
    }

    let parsed
    try {
      parsed = yaml.parse(raw)
    } catch (e) {
      throw new LoadConfigError(`Error parsing config at ${path}`, { cause: e })
    }

    const config: FlatHash = {}
      ;['PLAINTEXT_VARIABLES', 'ENCRYPTED_VARIABLES'].forEach((key) => {
        if (parsed[key]) {
          assert(typeof parsed[key] === 'object', `${key} must define an object`)

          const name = key.split('_')[0].toLowerCase()
          config[name] = parsed[key]
        }
      })

    return config
  }

  /**
   *  Load config from an object instead of reading YAML.
   *
   *  @param configObj - same structure as YAML:
   *      {
   *        PLAINTEXT_VARIABLES: { ... },
   *        ENCRYPTED_VARIABLES: { ... }
   *      }
   * @return {Promise<object>} An object with all decrypted config
   */
  loadConfigFromObject(configObj?: {
    PLAINTEXT_VARIABLES?: FlatHash
    ENCRYPTED_VARIABLES?: FlatHash
  }): Promise<FlatHash> {
    if (this._configPromise) {
      return this._configPromise
    }

    if (!configObj) {
      throw new Error("requires config object")
    }

    const plaintext = configObj.PLAINTEXT_VARIABLES || {}
    const encrypted = configObj.ENCRYPTED_VARIABLES

    if (plaintext && typeof plaintext !== 'object') {
      throw new Error('PLAINTEXT_VARIABLES must define an object')
    }

    if (encrypted && typeof encrypted !== 'object') {
      throw new Error('ENCRYPTED_VARIABLES must define an object')
    }

    if (encrypted) {
      this._configPromise = this.kmsDecrypter(encrypted)
        .then((decrypted) => ({ ...plaintext, ...decrypted }))
    } else {
      this._configPromise = Promise.resolve(plaintext)
    }

    this._configPromise = (this._configPromise as Promise<FlatHash>).then((c) => {
      this._config = c
      return c
    })

    return this._configPromise
  }



  /**
   *  Load named config, decrypting as necessary
   *
   *  @return {Promise<object>} An object with all decrypted config
   * **/
  loadConfig(envName = process.env.ENVIRONMENT): Promise<FlatHash> {
    if (!envName) {
      throw new LoadConfigError('loadConfig requires an environment name (or ENVIRONMENT=...)')
    }

    if (this._configPromise) {
      return this._configPromise
    }

    const { plaintext, encrypted } = this._readAndParseConfig(envName)

    const values = plaintext || {}

    // Load encrypted variables:
    if (encrypted) {
      this._configPromise = this.kmsDecrypter(encrypted)
        .then((decryptedConfig: FlatHash) => ({ ...values, ...decryptedConfig }))

    } else {
      this._configPromise = Promise.resolve(values)
    }

    this._configPromise = (this._configPromise as Promise<FlatHash>).then((c) => {
      this._config = c
      return c
    })

    return this._configPromise
  }

  /**
   *  Retrieve config syncronously.
   *
   *  @return {object} config
   *  @throw {LoadConfigError} if config not fully loaded yet.
   * **/
  getConfig() {
    if (!this._config) {
      throw new LoadConfigError('Attempted to read config before initialized')
    }

    return this._config
  }
}

/**
 *  Support optional dependency injection for the following functionality:
 */
const defaultDependencies = {
  fileReader: (path: string) => readFileSync(path, 'utf8'),
  kmsDecrypter: (values: FlatHash) => decrypt(values) as Promise<FlatHash>
}

export const factory = (dependencies = {} as ConfigFactoryParams): Config => {
  dependencies.fileReader = dependencies.fileReader || defaultDependencies.fileReader
  dependencies.kmsDecrypter = dependencies.kmsDecrypter || defaultDependencies.kmsDecrypter

  return new Config(dependencies as ConfigDependencies)
}

export default factory()
