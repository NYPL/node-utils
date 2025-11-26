# NodeUtils

This module contains common Node utilities for NYPL components.

## Usage

```
npm i --save @nypl/node-utils
```

### Config

To load and decrypt config:

`loadConfig(envName) {Promise<object>}`
 - `envName {string}` - Indicates what file to read config from (i.e. `./config/{envName}.yaml`)

As a convenience, after initialization (via above) you may use this function to retrieve select config syncronously:

`getConfig() {object}` - Get previously retrieved config syncronously.

```
const { config } = require('@nypl/node-utils')
// or import { config } from '@nypl/node-utils'

const init = async () => {
  // Destructure the variables you want from the initial loadConfig call:
  const { LOG_LEVEL } = await config.loadConfig()

  // Subsequent loadConfig calls use cached config:
  const { OTHER_VAR } = await config.loadConfig()
  ...

  // As a convenience, getConfig provides sync access to all config after initial load:
  const { CLIENT_ID: id, CLIENT_SECRET: secret } = config.getConfig()
  const client = SomeClient({ id, secret })
}
```

Config files must be structured like this:

```
PLAINTEXT_VARIABLES:
    one: ...
    two: ...
ENCRYPTED_VARIABLES:
    three: ...
```

#### Troubleshooting

If you encounter `KmsError: CredentialsProviderError during decrypt command`, you may need to indicate the AWS profile to use by setting, for example, `AWS_PROFILE=nypl-digital-dev`.

### Logger

To print log entries:

`logger.(error|warning|info|debug)(message, obj?)` - Print entry to log
 - `message {string}` - The message to print
 - `obj {object}` - An optional plainobject with properties to include in the log entry

The logger comes pre-initialized, but you may want to re-initialize it if some env vars changed:

`logger.initialize(config?)`
 - `config {object}` - Optional plainobject defining `json {bool}` and/or `level {string}`

To simply change the log level:

`logger.setLevel(level)` - Convenience for setting log level directly
 - `level {string}` - Set level to 'error', 'warn', 'info', 'debug'

```
const { logger, config } = require('@nypl/node-utils')
// or import { logger, config } from '@nypl/node-utils'

const init = () => {
  await config.loadConfig()
  logger.initialize()

  logger.info('Something happened', { id: '...' })
}
```
