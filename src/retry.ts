import { setTimeout } from 'node:timers/promises'

export const delay = (ms: number) => setTimeout(ms)

/**
 * Retry an async call on error. Returns an async function that retries the
 * given call the given amount of times. Resolves when any call succeeds. Errors
 * when retries exhausted.
 *
 * Usage:
 *   doSomethingAsync()
 *     .catch(retry(doSomethingAsync, 3))
 **/
export const retry = (call: Function, retries = 3) => {
  return async (error?: Error) => {
    let lastError = error
    for (let i = 0; i < retries; i++) {
      const retryLabel = `Retry ${i + 1} of ${retries}`
      try {
        const res = await call()
        console.log(`${retryLabel}: Succeeded!`)
        return res
      } catch (e: any) {
        lastError = e
        console.warn('Encountered error. Will retry:', e)
        const howLong = Math.pow(3, i + 1)
        console.log(`${retryLabel}: Waiting ${howLong}s`)
        await retryUtils.delay(howLong * 1000)
      }
    }
    console.error('Encountered error. Exhausted retries.', lastError)
    // Failed after 3 retries? Fail hard:
    const errorMessage = lastError?.message || lastError || 'Unknown error'
    throw new Error(`Exhausted ${retries} retries: ${errorMessage}`)
  }
}

// Exposed as an object so consumers/tests can mock individual members
// (e.g. `mock.method(retryUtils, 'delay', ...)`) while `retry` still calls
// through the mockable reference.
const retryUtils = { retry, delay }

export default retryUtils
