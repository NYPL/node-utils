const { KMSClient, DecryptCommand } = require('@aws-sdk/client-kms')
const logger = require('./logger')

class KmsError extends Error {}

const kms = {}

/**
 *  Given an array of encrypted strings, resolves an array of decrypted strings
 *  in the same order
 * */
kms._decryptArray = (encrypted) => {
  return Promise.all(
    encrypted.map((encrypted) => kms._decryptString(encrypted))
  )
}

/**
 *  Given an object with encrypted values, returns an object with the same keys
 *  and decrypted values
 * */
kms._decryptObject = async (encrypted) => {
  const pairs = await Promise.all(
    Object.entries(encrypted)
      .map(([key, value]) => {
        return kms._decryptString(value).then((decrypted) => [key, decrypted])
      })
  )

  // Assemble decryped pairs into a hash:
  return pairs.reduce((h, [key, value]) => ({ ...h, [key]: value }), {})
}

/**
 *  Given an encrypted string, returns the decrypted string.
 * */
kms._decryptString = async (encrypted) => {
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
  } catch (e) {
    throw new KmsError(`${e.name} during decrypt command`, { cause: e })
  }
  if (!response?.Plaintext) {
    throw new KmsError('Invalid KMS response')
  }
  const decoded = Buffer.from(response.Plaintext, 'binary')
    .toString('utf8')
  return decoded
}

/**
 *  Given a string, string[], or object containing encrypted values, returns
 *  decrypted form
 *
 *  @param {(string|string[]|object)} encrypted
 * **/
kms.decrypt = (encrypted) => {
  if (Array.isArray(encrypted)) {
    return kms._decryptArray(encrypted)
  } else if (typeof encrypted === 'object') {
    return kms._decryptObject(encrypted)
  } else if (typeof encrypted === 'string') {
    return kms._decryptString(encrypted)
  } else {
    throw new KmsError(`decryptAll expected string|object|array; got ${typeof arrayOrHash}`)
  }
}

module.exports = kms
