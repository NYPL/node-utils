import logger from './logger'
import retryUtils from './retry'

interface NyplSourceEntry {
  organization: string
  bibPrefix: string
  itemPrefix: string
  holdingPrefix?: string
}

type NyplSourceMapping = {
  [nyplSource: string]: NyplSourceEntry
}

interface SplitIdentifier {
  nyplSource?: string
  type?: 'bib' | 'item' | 'holding'
  id?: string
}

class NyplSourceMapper {
  nyplSourceMap: NyplSourceMapping

  static _instance: NyplSourceMapper | null = null

  constructor (mapping: NyplSourceMapping, logger = null) {
    this.nyplSourceMap = mapping
  }

  /**
   * Load singleton NyplSourceMapper instance with nypl core data
   */
  static loadInstance = async () => {
    logger.info('Loading nypl source mapping')
    NyplSourceMapper._instance = await createInstance()
  }

  static instance = () => NyplSourceMapper._instance

  // only for testing
  static __resetInstance = () => {
    NyplSourceMapper._instance = null
  }

  /**
   *  Given a discovery identifier (aka "uri"),
   *  e.g. "b12082323", "i123456", "pb98766", "ci2342343"
   *
   *  Returns a hash with:
   *   - `nyplSource`: System/institution identifier. One of sierra-nypl,
   *                   recap-pul, recap-cul, recap-hl
   *   - `type`: Record type. One of bib, item, holding
   *   - `id`: The non-prefixed identifier, e.g. "12082323"
   */
  splitIdentifier (prefixedIdentifier: string): SplitIdentifier {
    if (!/^[a-z]+/.test(prefixedIdentifier)) return {}

    const nyplSourceMapping = this.nyplSourceMap
    const prefixMatch = prefixedIdentifier.match(/^[a-z]{1,2}/)
    if (!prefixMatch) return {}
    const prefix = prefixMatch[0]
    const mapping = Object.keys(nyplSourceMapping)
      .map((nyplSource) => Object.assign({}, { nyplSource }, nyplSourceMapping[nyplSource]))
      .find((properties) => {
        return [properties.bibPrefix, properties.itemPrefix, properties.holdingPrefix].includes(prefix)
      })
    // Because this method tends to be called with destructuring, return {}
    // if prefixedIdentifier is not recognized
    if (!mapping) return {}

    const type = mapping.bibPrefix === prefix
      ? 'bib'
      : mapping.holdingPrefix === prefix
        ? 'holding'
        : 'item'

    return {
      nyplSource: mapping.nyplSource,
      type,
      id: prefixedIdentifier.replace(prefix, '')
    }
  }

  /**
   *  Given an nypl source (such as sierra-nypl or recap-pul) returns the
   *  matching prefix
   */
  prefix (source: string, type: 'bib' | 'item' | 'holding' = 'bib'): string {
    const nyplSourceMapping = this.nyplSourceMap
    if (!nyplSourceMapping[source]) return ''
    return nyplSourceMapping[source][`${type}Prefix` as keyof NyplSourceEntry] as string
  }
}

/**
 * Create a NyplSourceMapper instance
 */
const createInstance = async (): Promise<NyplSourceMapper> => {
  const sourceMappingUrl = `https://raw.githubusercontent.com/NYPL/nypl-core/${process.env.NYPL_CORE_VERSION || 'master'}/mappings/recap-discovery/nypl-source-mapping.json`

  const resp = await retryUtils.retry(
    async () => {
      const res = await fetch(sourceMappingUrl)
      if (res?.ok) return res
      throw new Error(`got status ${res?.status}`)
    }
  )()

  // Parse JSON:
  const data = await resp.json()
    .catch((e: Error) => {
      throw new Error(`Error parsing ${sourceMappingUrl}: ${e}`)
    })

  // Check for invalid data structure:
  if (!data || !data['sierra-nypl']) {
    throw new Error(`Error parsing data at ${sourceMappingUrl}`)
  }

  return new NyplSourceMapper(data)
}

export default NyplSourceMapper
export type { NyplSourceMapping, NyplSourceEntry, NyplSource, SplitIdentifier }
