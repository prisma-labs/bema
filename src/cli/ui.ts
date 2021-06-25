import arg from 'arg'
import endent from 'endent'
import execa from 'execa'
import glob from 'fast-glob'
import { bold, dim, yellow } from 'kleur'
import * as Path from 'path'
import { d, fatal } from '../utils'
import { absolutify } from '../utils/fs'

async function run(): Promise<void> {
  const args = arg({
    '--help': Boolean,
    '-h': '--help',

    '--results-dir': String,
    '--resultsDir': '--results-dir',
    '-d': '--results-dir',
  })

  // prettier-ignore
  const helpMessage = endent`
    This command will open a web UI to visualize your bema results.

    ${bold('USAGE')}

        ${dim('$')} ${bold('yarn bema report')} [OPTIONS]

    ${bold('OPTIONS')}

        --results-dir                       string          Path to recursively search for bema ${yellow(`report.json`)} files.
         -d                                                 By default looks under <CWD>/results
                                                            Note: If path not absolute then considered relative to current working directory.

        ${dim(`OTHER`)}

        --help -h                                           Shows this help message.
  `

  if (args['--help']) {
    fatal(2, helpMessage)
  }

  const baseDir = absolutify(args['--results-dir'] ?? './results', process.cwd())
  const reportPaths = await glob(Path.join(baseDir, '/**/report.json'))

  const nextAppDir = Path.join(__dirname, '../ui')
  const binArgs = ['dev', nextAppDir]
  const bin = 'next'
  d(`running ${bin} ${binArgs.join(' ')}`)

  const running = execa(bin, binArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      BEMA_REPORT_PATHS: JSON.stringify(reportPaths),
    },
  })
  running.stdout?.pipe(process.stdout)
  running.stderr?.pipe(process.stderr)
  await running
}

export default run
