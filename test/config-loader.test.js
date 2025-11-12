const assert = require('node:assert')
const {
  afterEach,
  suite,
  test,
  mock
} = require('node:test')

const fs = require('fs')

const configLoader = require('../lib/config')
const kms = require('../lib/kms')
const { setEnv } = require('./test-helper')

suite('config', () => {
  afterEach(() => {
    mock.reset()
    configLoader._reset()
  })

  suite('_readAndParseConfig', () => {
    test('loadConfig requires valid config', () => {
      mock.method(fs, 'readFileSync', () => {
        throw new Error('...')
      })

      assert.throws(() => configLoader._readAndParseConfig(), { message: 'Error loading config: No envName given' })
    })

    test('throws error for yaml parse error', () => {
      mock.method(fs, 'readFileSync', () => 'some: additional: garbage')

      assert.throws(() => configLoader._readAndParseConfig('some-env'), { message: 'Error parsing config at ./config/some-env.yaml' })
    })

    test('ignores top-level keys', () => {
      mock.method(fs, 'readFileSync', () => 'some: garbage')

      const parsed = configLoader._readAndParseConfig('some-env')
      assert.deepStrictEqual(parsed, {})
    })

    test('loadConfig requires valid config', () => {
      mock.method(fs, 'readFileSync', () => 'ENCRYPTED_VARIABLES: bar')

      assert.throws(() => configLoader._readAndParseConfig('some-env'), { message: 'ENCRYPTED_VARIABLES must define an object' })
    })
  })

  suite('loadConfig', () => {
    test('throws error if env name not given/found', async () => {
      assert.throws(() => configLoader.loadConfig(), { message: 'loadConfig requires an environment name (or ENVIRONMENT=...)' })
    })

    test('accepts process.env.ENVIRONMENT when no envName given', async () => {
      mock.method(configLoader, '_readAndParseConfig', () => {
        return { plaintext: { k1: 'v1' } }
      })

      await new Promise((resolve, reject) => {
        // Temporarily set ENVIRONMENT to some value:
        setEnv({ ENVIRONMENT: 'some-env' }, async () => {
          const config = await configLoader.loadConfig()

          assert.deepStrictEqual(config, { k1: 'v1' })
          resolve()
        })
      })
    })

    test('loads plaintext vars', async () => {
      mock.method(configLoader, '_readAndParseConfig', () => {
        return {
          plaintext: {
            k1: 'v1',
            k2: 'v2'
          }
        }
      })

      const config = await configLoader.loadConfig('some-env')
      assert.deepStrictEqual(config, { k1: 'v1', k2: 'v2' })
    })

    test('loads encrypted vars', async () => {
      mock.method(kms, '_decryptString', (key) => Promise.resolve(`${key} decrypted`))
      mock.method(configLoader, '_readAndParseConfig', () => {
        return {
          encrypted: {
            k1: 'v1',
            k2: 'v2'
          }
        }
      })

      const config = await configLoader.loadConfig('some-env')
      assert.deepStrictEqual(config, { k1: 'v1 decrypted', k2: 'v2 decrypted' })
    })

    test('loads mix of plaintext, encrypted vars', async () => {
      mock.method(kms, '_decryptString', (key) => Promise.resolve(`${key} decrypted`))
      mock.method(configLoader, '_readAndParseConfig', () => {
        return {
          plaintext: { k1: 'v1' },
          encrypted: { k2: 'v2' }
        }
      })

      const config = await configLoader.loadConfig('some-env')
      assert.deepStrictEqual(config, { k1: 'v1', k2: 'v2 decrypted' })
    })
  })

  suite('getConfig', () => {
    test('throws error if called before loadConfig has completed', async () => {
      mock.method(configLoader, '_readAndParseConfig', () => {
        return {
          encrypted: {
            k1: 'v1'
          }
        }
      })
      // Emulate a kms call taking non-zero time:
      mock.method(kms, '_decryptString', (key) => new Promise((resolve) => setTimeout(() => resolve('v1 decrypted')), 1))

      // Assert getConfig raises error if called before loadConfig has been called:
      assert.throws(() => configLoader.getConfig())

      configLoader.loadConfig('env..')

      // Calling getConfig immediately after calling loadConfig will fail
      // because the config hasn't yet resolved:
      assert.throws(() => configLoader.getConfig(), { message: 'Attempted to read config before initialized' })

      // However, getConfig will succeed if we wait for the above call to
      // resolve:
      await new Promise((resolve) => setTimeout(resolve, 1))
      const { k1 } = configLoader.getConfig()
      assert.deepStrictEqual(k1, 'v1 decrypted')
    })
  })
})
