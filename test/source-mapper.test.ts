import assert from 'node:assert'
import {
  afterEach,
  before,
  beforeEach,
  suite,
  test,
  mock
} from 'node:test'

import NyplSourceMapper from '../src/source-mapper'
import retryUtils from '../src/retry'

const SOURCE_MAPPING_URL = 'https://raw.githubusercontent.com/NYPL/nypl-core/master/mappings/recap-discovery/nypl-source-mapping.json'

const SOURCE_MAPPING_RESPONSE = {
  'sierra-nypl': {
    organization: 'nyplOrg:0001',
    bibPrefix: 'b',
    holdingPrefix: 'h',
    itemPrefix: 'i'
  },
  'recap-pul': { organization: 'nyplOrg:0003', bibPrefix: 'pb', itemPrefix: 'pi' },
  'recap-cul': { organization: 'nyplOrg:0002', bibPrefix: 'cb', itemPrefix: 'ci' },
  'recap-hl': { organization: 'nyplOrg:0004', bibPrefix: 'hb', itemPrefix: 'hi' }
}

let fetchRequestsCount = 0

/**
 *  Stub global fetch to resolve with the standard nypl-source-mapping.json
 *  response.
 * **/
const stubNyplSourceMapper = () => {
  fetchRequestsCount = 0
  mock.method(global, 'fetch', async (url: string) => {
    fetchRequestsCount += 1
    return {
      ok: true,
      status: 200,
      json: async () => SOURCE_MAPPING_RESPONSE
    }
  })
}

const interceptedNyplSourceMapperRequestsCount = () => fetchRequestsCount

suite('NyplSourceMapper', () => {
  before(() => NyplSourceMapper.__resetInstance())

  afterEach(() => {
    mock.reset()
  })

  suite('instance', () => {
    beforeEach(stubNyplSourceMapper)
    afterEach(() => NyplSourceMapper.__resetInstance())

    test('should fetch data from nypl core', async () => {
      await NyplSourceMapper.loadInstance()
      const mapping = NyplSourceMapper.instance()
      assert.strictEqual(mapping?.nyplSourceMap['sierra-nypl'].organization, 'nyplOrg:0001')
    })

    test('should return pre-fetched data if initialized', async () => {
      // We expect no fetches made yet:
      assert.strictEqual(interceptedNyplSourceMapperRequestsCount(), 0)
      await NyplSourceMapper.loadInstance()
      const mapping = NyplSourceMapper.instance()
      assert.strictEqual(mapping?.nyplSourceMap['sierra-nypl'].organization, 'nyplOrg:0001')
      // We expect one initial fetch made on the source mapper file
      assert.strictEqual(interceptedNyplSourceMapperRequestsCount(), 1)

      // Trigger another instance creation, which will break if another `fetch`
      // call is made, since instance() never re-fetches:
      NyplSourceMapper.instance()
      assert.strictEqual(mapping?.nyplSourceMap['sierra-nypl'].organization, 'nyplOrg:0001')

      // We expect no additional fetches made on the source mapper file:
      assert.strictEqual(interceptedNyplSourceMapperRequestsCount(), 1)
    })

    test('should reuse existing fetch if one is already active', async () => {
      await NyplSourceMapper.loadInstance()
      // Trigger multiple instance creations simultaneously to assert the mock
      // is only used once:
      const [mapping1, mapping2] = [
        NyplSourceMapper.instance(),
        NyplSourceMapper.instance()
      ]
      assert.strictEqual(mapping1?.nyplSourceMap['sierra-nypl'].organization, 'nyplOrg:0001')
      assert.strictEqual(mapping2?.nyplSourceMap['sierra-nypl'].organization, 'nyplOrg:0001')
    })
  })

  suite('splitIdentifier', () => {
    let sourceMapperInstance: NyplSourceMapper

    beforeEach(async () => {
      stubNyplSourceMapper()
      await NyplSourceMapper.loadInstance()
      sourceMapperInstance = NyplSourceMapper.instance() as NyplSourceMapper
    })
    afterEach(() => NyplSourceMapper.__resetInstance())

    test('should reject unrecognized identifier', () => {
      const split = sourceMapperInstance.splitIdentifier('fladeedle')
      assert.strictEqual(typeof split, 'object')
      assert.strictEqual(split.type, undefined)
      assert.strictEqual(split.nyplSource, undefined)
      assert.strictEqual(split.id, undefined)
    })

    test('should split sierra-nypl bib identifier', () => {
      const split = sourceMapperInstance.splitIdentifier('b12082323')
      assert.strictEqual(split.type, 'bib')
      assert.strictEqual(split.nyplSource, 'sierra-nypl')
      assert.strictEqual(split.id, '12082323')
    })

    test('should split sierra-nypl item identifier', () => {
      const split = sourceMapperInstance.splitIdentifier('i123')
      assert.strictEqual(split.type, 'item')
      assert.strictEqual(split.nyplSource, 'sierra-nypl')
      assert.strictEqual(split.id, '123')
    })

    test('should split recap-pul bib identifier', () => {
      const split = sourceMapperInstance.splitIdentifier('pb123')
      assert.strictEqual(split.type, 'bib')
      assert.strictEqual(split.nyplSource, 'recap-pul')
      assert.strictEqual(split.id, '123')
    })

    test('should split recap-pul item identifier', () => {
      const split = sourceMapperInstance.splitIdentifier('pi123')
      assert.strictEqual(split.type, 'item')
      assert.strictEqual(split.nyplSource, 'recap-pul')
      assert.strictEqual(split.id, '123')
    })

    test('should split recap-cul bib identifier', () => {
      const split = sourceMapperInstance.splitIdentifier('cb123')
      assert.strictEqual(split.type, 'bib')
      assert.strictEqual(split.nyplSource, 'recap-cul')
      assert.strictEqual(split.id, '123')
    })

    test('should split recap-cul item identifier', () => {
      const split = sourceMapperInstance.splitIdentifier('ci123')
      assert.strictEqual(split.type, 'item')
      assert.strictEqual(split.nyplSource, 'recap-cul')
      assert.strictEqual(split.id, '123')
    })

    test('should split recap-hl bib identifier', () => {
      const split = sourceMapperInstance.splitIdentifier('hb123')
      assert.strictEqual(split.type, 'bib')
      assert.strictEqual(split.nyplSource, 'recap-hl')
      assert.strictEqual(split.id, '123')
    })

    test('should split recap-hl item identifier', () => {
      const split = sourceMapperInstance.splitIdentifier('hi123')
      assert.strictEqual(split.type, 'item')
      assert.strictEqual(split.nyplSource, 'recap-hl')
      assert.strictEqual(split.id, '123')
    })

    test('should allow extra character prefixes on partner bib ids', () => {
      const split = sourceMapperInstance.splitIdentifier('cbin1234')
      assert.strictEqual(split.type, 'bib')
      assert.strictEqual(split.nyplSource, 'recap-cul')
      assert.strictEqual(split.id, 'in1234')
    })

    test('should allow extra character prefixes on partner item ids', () => {
      const split = sourceMapperInstance.splitIdentifier('cifoo1234')
      assert.strictEqual(split.type, 'item')
      assert.strictEqual(split.nyplSource, 'recap-cul')
      assert.strictEqual(split.id, 'foo1234')
    })
  })

  suite('prefix', () => {
    let sourceMapperInstance: NyplSourceMapper

    before(async () => {
      stubNyplSourceMapper()
      await NyplSourceMapper.loadInstance()
      sourceMapperInstance = NyplSourceMapper.instance() as NyplSourceMapper
    })

    test('should get correct prefix for sierra-nypl', () => {
      const prefix = sourceMapperInstance.prefix('sierra-nypl')
      assert.strictEqual(prefix, 'b')
    })

    test('should get correct prefix for recap-hl', () => {
      const prefix = sourceMapperInstance.prefix('recap-hl')
      assert.strictEqual(prefix, 'hb')
    })

    test('should get correct prefix for recap-pul', () => {
      const prefix = sourceMapperInstance.prefix('recap-pul')
      assert.strictEqual(prefix, 'pb')
    })

    test('should get correct prefix for recap-cul', () => {
      const prefix = sourceMapperInstance.prefix('recap-cul')
      assert.strictEqual(prefix, 'cb')
    })
  })

  suite('nyplSourceMapping error conditions', () => {
    before(() => {
      mock.method(retryUtils, 'delay', async () => {})
    })

    beforeEach(() => NyplSourceMapper.__resetInstance())

    test('should fail if mapping json returns a non-2xx', async () => {
      mock.method(global, 'fetch', async () => ({
        ok: false,
        status: 503,
        json: async () => ({})
      }))

      await assert.rejects(
        () => NyplSourceMapper.loadInstance(),
        { message: 'Exhausted 3 retries: got status 503' }
      )
    })

    test('should fail if mapping json returns a 200 but is malformed', async () => {
      mock.method(global, 'fetch', async () => ({
        ok: true,
        status: 200,
        json: async () => ({ oh: 'no' })
      }))

      await assert.rejects(
        () => NyplSourceMapper.loadInstance(),
        { message: `Error parsing data at ${SOURCE_MAPPING_URL}` }
      )
    })
  })
})
