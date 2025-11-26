import * as assert from 'node:assert'
import {
  afterEach,
  beforeEach,
  suite,
  test,
  mock
} from 'node:test'

import * as fs from 'fs'

import * as kms from '../src/kms'
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
})
