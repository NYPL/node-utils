import * as assert from 'node:assert'
import {
  afterEach,
  beforeEach,
  suite,
  test,
  mock
} from 'node:test'
import { factory } from '../src/config'

import { setEnv } from './test-helper'

suite('config', async () => {
  afterEach(() => {
    mock.reset()
  })

  suite('_readAndParseConfig', () => {
    let config = factory()

    test('loadConfig requires valid config', () => {
      config = factory({ fileReader: () => { throw new Error() } })

      assert.throws(() => config._readAndParseConfig(''), { message: 'Error loading config: No envName given' })
    })

    test('throws error for yaml parse error', () => {
      config = factory({ fileReader: () => 'some: additional: garbage' })

      assert.throws(() => config._readAndParseConfig('some-env'), { message: 'Error parsing config at ./config/some-env.yaml' })
    })

    test('ignores top-level keys', () => {
      config = factory({ fileReader: () => 'some: garbage' })

      const parsed = config._readAndParseConfig('some-env')
      assert.deepStrictEqual(parsed, {})
    })

    test('loadConfig requires valid config', () => {
      config = factory({ fileReader: () => 'ENCRYPTED_VARIABLES: bar' })

      assert.throws(() => config._readAndParseConfig('some-env'), { message: 'ENCRYPTED_VARIABLES must define an object' })
    })
  })

  suite('loadConfig', () => {
    let config = factory()

    beforeEach(() => {
      config = factory()
    })

    test('throws error if env name not given/found', async () => {
      assert.throws(() => config.loadConfig(''), { message: 'loadConfig requires an environment name (or ENVIRONMENT=...)' })
    })

    test('accepts process.env.ENVIRONMENT when no envName given', async () => {
      mock.method(config, '_readAndParseConfig', () => {
        return { plaintext: { k1: 'v1' } }
      })

      await new Promise((resolve, reject) => {
        // Temporarily set ENVIRONMENT to some value:
        setEnv({ ENVIRONMENT: 'some-env' }, async () => {
          const c = await config.loadConfig('some env')

          assert.deepStrictEqual(c, { k1: 'v1' })
          resolve(null)
        })
      })
    })

    test('loads plaintext vars', async () => {
      mock.method(config, '_readAndParseConfig', (envName: string) => {
        return {
          plaintext: {
            k1: 'v1',
            k2: 'v2'
          }
        }
      })

      const c = await config.loadConfig('some-env')
      assert.deepStrictEqual(c, { k1: 'v1', k2: 'v2' })
    })

    test('loads encrypted vars', async () => {
      config = factory({
        kmsDecrypter: (value) => Promise.resolve({ k1: 'v1 decrypted', k2: 'v2 decrypted' })
      })
      mock.method(config, '_readAndParseConfig', () => {
        return {
          encrypted: {
            k1: 'v1',
            k2: 'v2'
          }
        }
      })

      const c = await config.loadConfig('some-env')
      assert.deepStrictEqual(c, { k1: 'v1 decrypted', k2: 'v2 decrypted' })
    })

    test('loads mix of plaintext, encrypted vars', async () => {
      config = factory({
        kmsDecrypter: (value) => Promise.resolve({ k2: 'v2 decrypted' })
      })
      mock.method(config, '_readAndParseConfig', () => {
        return {
          plaintext: { k1: 'v1' },
          encrypted: { k2: 'v2' }
        }
      })

      const c = await config.loadConfig('some-env')
      assert.deepStrictEqual(c, { k1: 'v1', k2: 'v2 decrypted' })
    })
  })

  suite('loadConfigFromObject', () => {
    let config = factory()

    beforeEach(() => {
      config = factory()
    })

    test('loads plaintext vars only', async () => {
      const obj = {
        PLAINTEXT_VARIABLES: {
          a: '1',
          b: '2'
        }
      }

      const result = await config.loadConfigFromObject(obj)

      assert.deepStrictEqual(result, { a: '1', b: '2' })
      assert.deepStrictEqual(config.getConfig(), { a: '1', b: '2' })
    })

    test('loads encrypted vars only', async () => {
      config = factory({
        kmsDecrypter: () =>
          Promise.resolve({ secret: 'foo decrypted' })
      })

      const obj = {
        ENCRYPTED_VARIABLES: {
          secret: 'foo'
        }
      }

      const result = await config.loadConfigFromObject(obj)

      assert.deepStrictEqual(result, { secret: 'foo decrypted' })
      assert.deepStrictEqual(config.getConfig(), { secret: 'foo decrypted' })
    })

    test('loads mix of plaintext, encrypted vars', async () => {
      config = factory({
        kmsDecrypter: () =>
          Promise.resolve({ e: 'foo decrypted' })
      })

      const obj = {
        PLAINTEXT_VARIABLES: {
          p: 'plain'
        },
        ENCRYPTED_VARIABLES: {
          e: 'foo'
        }
      }

      const result = await config.loadConfigFromObject(obj)

      assert.deepStrictEqual(result, {
        p: 'plain',
        e: 'foo decrypted'
      })

      assert.deepStrictEqual(config.getConfig(), {
        p: 'plain',
        e: 'foo decrypted'
      })
    })

    test('works with empty object', async () => {
      const obj = {}

      const result = await config.loadConfigFromObject(obj)

      assert.deepStrictEqual(result, {})
      assert.deepStrictEqual(config.getConfig(), {})
    })
  })
})
