import arg from 'arg'
import endent from 'endent'
import * as Glob from 'fast-glob'
import kleur, { bold, dim } from 'kleur'
import { isEmpty } from 'lodash'
import * as Path from 'path'
import { bema } from '../'
import { InternalBema } from '../declaration/bema'
import { filterExpressionGuide } from '../declaration/config'
import * as BemaExecution from '../execution/run'
import { d, fatal } from '../utils'
import { renderIndentedList } from '../utils/terminal'

export default async function run(): Promise<void> {
  const internalBema = bema as InternalBema

  const args = arg({
    // group filtering
    '--groups': String,
    '--group': '--groups',
    '-g': '--groups',

    '--skip-groups': String,
    '--skipGroups': '--skip-groups',
    '--skip-group': '--skip-groups',
    '--skipGroup': '--skip-groups',
    '--sg': '--skip-groups',

    // parameter filtering
    '--parameters': [String],
    '--parameter': '--parameters',
    '-p': '--parameters',

    '--skip-parameters': [String],
    '--skip-parameter': '--skip-parameters',
    '--sp': '--skip-parameters',

    // other
    '--name': String,
    '-n': '--name',

    '--force-exit': Boolean,
    '--forceExit': '--force-exit',
    '-f': '--force-exit',

    '--help': Boolean,
    '-h': '--help',

    '--files': [String],

    '--out-dir': String,
    '--outDir': '--out-dir',
    '-o': '--out-dir',

    '--out-file-name': String,
    '--outFileName': '--out-file-name',

    '--output-csvs': Boolean,
    '--outputCSVs': '--output-csvs',
    '--outputCsvs': '--output-csvs',
    '--output-csv': '--output-csvs',
    '--outputCSV': '--output-csvs',
    '--outputCsv': '--output-csvs',

    '--quick': Boolean,
    '-q': '--quick',

    '--strict': Boolean,
  })

  const defualtFilesPattern = ['benchmarks/**/*.bench.ts', 'benchmarks/**/_*.ts']

  const helpMessage = endent`
    ${bold('ALL COMMANDS')}

    ${renderIndentedList(['bench (default)', 'report'])}

    ${dim('ABOUT THIS COMMAND')}
      
    ${bold('USAGE')}

        ${dim('$')} ${bold('yarn bema bench')} [OPTIONS]

    ${bold('OPTIONS')}

        ${kleur.dim(`FILTERING`)}

        --groups                            string          Only run groups whose name matching the given regular expression. Patterns are executed case insensitive.
        -g                                                  By default: all groups are run
                                                            

        --skip-groups                       string          Only run groups whose name does NOT match the given regular expression. Patterns are executed case insensitive.
        --sg                                                By default: no groups are skipped

        --parameter                         [string]        Only run benchmarks with any parameters matching this filter. Multiple accepted using AND semantic.
        --parameters                                        Refer to filter expression guide below for format details.
        -p

        --skip-parameter                    [string]        Skip any benchmarks with any parameters matching this filter. Multiple accepted using AND semantic.
        --skip-parameters                                   Refer to filter expression guide below for format details.
        --sp

        ${kleur.dim(`OUTPUT`)}

        --out-dir                           string          Path to directory to write reports to. If not absolute then relative to current working directory.
         -o                                                 By default they will be output into <project path>/results/<run name>/.

        --out-file-name                     string          File name to use for the report data that Bema outputs.
         -o                                                 By default "report". 


        --output-csvs                       boolean         Should a CSV file for each benchmark group x matrix group be emitted?
        --output-csv                                        By default false.

        ${kleur.dim(`OTHER`)}

        --name                                              A meaningful name for this benchmark run.
         -n                                                 By default will be a Unix timestamp.

        --help                                              Shows this help message.
         -h


        --files                             [string]        Glob pattern for finding benchmark modules to run. If not absolute then relative to current working directory.
                                                            Multiple accepted using AND semantic.
                                                            You can use any pattern supportd by https://github.com/mrmlnc/fast-glob.
                                                            By default: ${defualtFilesPattern}

        --force-exit                        boolean         After benchmarks have run wait 2 seconds and if the process has not exited yet, force exit.
        -f 

        --quick                             boolean         Run benchmarks quickly. This disables use of Benchmark.js internally. All cases are executed such that
        -q                                                  their \`.run\` method is only run _once_ with no warmup period before hand. Naturally this will lead to
                                                            statistically insignificant results. Only use when you are not looking for accurate results such as when
                                                            developing your cases.
                                                            By default: false

        --strict                            boolean         Upgrades lint errors from warnings to errors. Lint errors exit with code 3.
    
    ${kleur.bold(`FILTER EXPRESSION FORMAT`)}

    ${filterExpressionGuide}
  `

  if (args['--help']) {
    fatal(2, helpMessage)
  }

  const benchmarkModulePaths = Glob.sync(args['--files'] ?? defualtFilesPattern, {
    caseSensitiveMatch: false,
    ignore: ['**/node_modules'],
  })

  if (isEmpty(benchmarkModulePaths)) {
    if (args['--files']) {
      fatal(endent`
      ${kleur.red(`No groups found for given file pattern: "${kleur.yellow(args['--files'].join(', '))}"`)}
    `)
    } else {
      fatal(endent`
      ${kleur.red(
        `No groups found for the default file pattern: "${kleur.yellow(defualtFilesPattern.join(', '))}"`
      )}
    `)
    }
  }

  d('discovered %d modules', benchmarkModulePaths.length)

  benchmarkModulePaths.forEach((relativePath) => {
    d(`Discovered benchmark module ${relativePath}`)
    const absoluteImportPath = Path.join(process.cwd(), relativePath)
    // Requiring the modules will run their side-effects
    require(absoluteImportPath)
  })

  await BemaExecution.run(
    internalBema.settings({
      name: args['--name'],
      strictMode: args['--strict'],
      quick: args['--quick'],
      outDir: args['--out-dir'],
      outputCSVs: args['--output-csvs'],
      outfileName: args['--out-file-name'],
      onlyGroups: args['--groups'],
      skipGroups: args['--skip-groups'],
      onlyParameters: args['--parameters'] ?? [],
      skipParameters: args['--skip-parameters'] ?? [],
    })
  )

  const forceExit = args['--force-exit'] ? 2 : null
  if (forceExit !== null) {
    d('beginning force exit countdown from %d second(s)', forceExit)
    setTimeout(() => {
      console.error(kleur.yellow('Force exit countdown done. Force exiting now!'))
      process.exit(0)
    }, forceExit * 1000).unref()
  }
}
