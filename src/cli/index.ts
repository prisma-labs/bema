#!/usr/bin/env node

import { d, fatal } from '../utils'
import { LintError, UserError } from '../utils/errors'

d('cli starting')

process.on('unhandledRejection', (e: Error) => {
  fatal(e)
})

main().catch((e: Error) => {
  if (e instanceof LintError) {
    console.error(e.message)
    process.exit(3)
  }

  if (e instanceof UserError) {
    console.error(e.message)
    process.exit(2)
  }

  console.error(e)
  process.exit(1)
})

async function main(): Promise<void> {
  // eslint-disable-next-line
  const command = (
    process.argv[2] === 'report'
      ? require('./report')
      : process.argv[2] === 'ui'
      ? require('./ui')
      : process.argv[2] === 'bench'
      ? require('./bench')
      : // default command
        require('./bench')
  ).default as () => Promise<void>

  await command()
}
