const assert = require('node:assert')
const {
  beforeEach,
  afterEach,
  suite,
  test,
  mock
} = require('node:test')
const { KMSClient } = require('@aws-sdk/client-kms')

const kms = require('../lib/kms')

suite('kms', () => {
  afterEach(() => {
    mock.reset()
  })

  suite('_decryptString', () => {
    test('raises KmsError if trouble decrypting', () => {
      mock.method(KMSClient.prototype, 'send', () => {
        throw new Error('oh no')
      })

      assert.rejects(() => kms._decryptString('abc'))
    })

    test('calls aws sdk', async () => {
      mock.method(KMSClient.prototype, 'send', () => Promise.resolve({ Plaintext: 'abc decrypted' }))

      const decrypted = await kms._decryptString('abc')
      assert.strictEqual(decrypted, 'abc decrypted')
    })
  })

  suite('decrypt', () => {
    beforeEach(() => {
      mock.method(KMSClient.prototype, 'send', () => Promise.resolve({ Plaintext: 'decrypted' }))
    })

    test('supports strings', async () => {
      const decrypted = await kms.decrypt('stuff')
      assert.strictEqual(decrypted, 'decrypted')
    })

    test('supports arrays', async () => {
      const decrypted = await kms.decrypt([
        'stuff',
        'more stuff'
      ])
      assert.deepStrictEqual(decrypted, ['decrypted', 'decrypted'])
    })

    test('supports objects', async () => {
      const decrypted = await kms.decrypt({
        k1: 'stuff',
        k2: 'more stuff'
      })
      assert.deepStrictEqual(decrypted, { k1: 'decrypted', k2: 'decrypted' })
    })
  })
})
