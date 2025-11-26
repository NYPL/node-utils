import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms'

class KmsError extends Error {}

const kms = {}

/**
 *  Given an array of encrypted strings, resolves an array of decrypted strings
 *  in the same order
 * */
export const _decryptArray = (encrypted: string[]): Promise<string[]> => {
  return Promise.all(
    encrypted.map((encrypted) => _decryptString(encrypted))
  )
}

/**
 *  Given an object with encrypted values, returns an object with the same keys
 *  and decrypted values
 * */
export const _decryptObject = async (encrypted: object) => {
  const pairs = await Promise.all(
    Object.entries(encrypted)
      .map(([key, value]) => {
        return _decryptString(value).then((decrypted) => [key, decrypted])
      })
  )

  // Assemble decryped pairs into a hash:
  return pairs.reduce((h, [key, value]) => ({ ...h, [key]: value }), {})
}

/**
 *  Given an encrypted string, returns the decrypted string.
 * */
export const _decryptString = async (encrypted: string) => {
  let client
  let response
  const config = {
    region: process.env.AWS_REGION || 'us-east-1'
  }
  try {
    client = new KMSClient(config)
  } catch (e) {
    throw new KmsError('Error instantiating KMS client', { cause: e })
  }
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(encrypted, 'base64')
  })
  try {
    response = await client.send(command)
  } catch (e: any) {
    const isCredentialsError = e.name === 'CredentialsProviderError'
    const message = isCredentialsError
      ? `${e.name} error: Try setting AWS_PROFILE=...`
      : `${e.name} during decrypt command`
    throw new KmsError(message, { cause: e })
  }
  if (!response?.Plaintext) {
    throw new KmsError('Invalid KMS response')
  }
  const decoded = Buffer.from(response.Plaintext as any, 'binary')
    .toString('utf8')
  return decoded
}

/**
 *  Given a string, string[], or object containing encrypted values, returns
 *  decrypted form
 *
 *  @param {(string|string[]|object)} encrypted
 * **/
export const decrypt = (encrypted: (string|string[]|object)) => {
  if (Array.isArray(encrypted)) {
    return _decryptArray(encrypted)
  } else if (typeof encrypted === 'object') {
    return _decryptObject(encrypted)
  } else if (typeof encrypted === 'string') {
    return _decryptString(encrypted)
  } else {
    throw new KmsError(`decryptAll expected string|object|array; got ${typeof encrypted}`)
  }
}
