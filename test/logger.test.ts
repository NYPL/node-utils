import assert from 'node:assert'
import {
  suite,
  test
} from 'node:test'

import { setEnv, captureStdout } from './test-helper'
import logger from '../src/logger'

suite('logger', () => {
  suite('info', () => {
    test('writes to stdout', () => {
      const lines = captureStdout(() => {
        logger.info('info level log')
      })
      assert.strictEqual(lines.length, 1)
      assert.strictEqual(lines[0], '\x1B[32minfo\x1B[39m: info level log\n')
    })

    test('includes extra information when provided', () => {
      const lines = captureStdout(() => {
        logger.info('info level log', { additional: 'details' })
      })

      assert.strictEqual(lines[0], '\x1B[32minfo\x1B[39m: info level log {"additional":"details"}\n')
    })

    test('includes extra information in json when provided', () => {
      logger.initialize({ json: true })

      const lines = captureStdout(() => {
        logger.info('info level log', { additional: 'details' })
      })

      assert.strictEqual(lines[0], '{"additional":"details","level":"info","message":"info level log"}\n')

      logger.initialize()
    })
  })

  suite('setLevel', () => {
    test('controls output', () => {
      ; ['error', 'info'].forEach((level) => {
        logger.setLevel(level)

        const lines = captureStdout(() => {
          logger.info('info level log')
        })

        // Only expect output if level is 'info'
        assert.strictEqual(lines.length, level === 'info' ? 1 : 0)
      })
    })
  })

  suite('initialize', () => {
    // Test a variety of env var scenarios:
    const logLine = 'info level log'

    test('explicitly enable json logging', () => {
      setEnv({ LOG_STYLE: 'json' }, () => {
        logger.initialize()

        const lines = captureStdout(() => {
          logger.info(logLine)
        })

        assert.deepStrictEqual(lines, [
          `{"level":"info","message":"${logLine}"}\n`
        ])
      })
    })

    test('implicitly enable json logging in lambdas', () => {
      setEnv({ LAMBDA_TASK_ROOT: '..' }, () => {
        logger.initialize()

        const lines = captureStdout(() => {
          logger.info(logLine)
        })

        assert.deepStrictEqual(lines, [
          `{"level":"info","message":"${logLine}"}\n`
        ])
      })
    })

    test('implicitly enable json logging in ecs', () => {
      setEnv({ AWS_EXECUTION_ENV: '..' }, () => {
        logger.initialize()

        const lines = captureStdout(() => {
          logger.info(logLine)
        })

        assert.deepStrictEqual(lines, [
          `{"level":"info","message":"${logLine}"}\n`
        ])
      })
    })
    test('default to plaintext if we appear to be local', () => {
      setEnv({}, () => {
        logger.initialize()

        const lines = captureStdout(() => {
          logger.info(logLine)
        })

        assert.deepStrictEqual(lines, [
          '\x1B[32minfo\x1B[39m: info level log\n'
        ])
      })
    })
  })
})
