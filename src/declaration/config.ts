import endent from 'endent'
import kleur from 'kleur'
import * as Path from 'path'
import { processPattern } from '../utils'
import { UserError } from '../utils/errors'
import { absolutify } from '../utils/fs'

export type Input = {
  /**
   * A meaningful name for this benchmark run.
   *
   * By default will be a unix timestamp.
   */
  name?: string
  /**
   * Directory to output reports. Relative paths are relative to the current working directory.
   *
   * Pass `null` to disable.
   *
   * By default they will be output into `{project path}/results/{run timestamp}`.
   */
  outDir?: string | null
  /**
   * File name to use for the report data that Bema outputs.
   *
   * By default "report".
   */
  outfileName?: string | null
  /**
   * Should a CSV file for each benchmark group x matrix group be emitted?
   *
   * By default false.
   */
  outputCSVs?: boolean
  /**
   * Only run tests whose name matches the given regular expression. Patterns are executed case insensitive.
   *
   * By default all tests are run.
   */
  onlyGroups?: RegExp | string
  /**
   * Only run tests whose name does _NOT_ match the given regular expression. Patterns are executed case insensitive.
   *
   * By default no tests are skipped.
   */
  skipGroups?: RegExp | string
  /**
   * Only run cases whose tags match one of the given regular expressions. Patterns are executed case insensitive.
   *
   * By default all cases are run.
   */
  onlyParameters?: InputParameterFilter[]
  /**
   * Only run cases whose tags do _NOT_ match one of the given regular expressions. Patterns are executed case
   * insensitive.
   *
   * By default no cases are skipped.
   */
  skipParameters?: InputParameterFilter[]
  /**
   * The maximum time (millisconds) a benchmark is allowed to run before finishing.
   *
   * Note: this option is passed through to the Benchmark.js maxTime option:
   * https://benchmarkjs.com/docs#options_maxTime. Cycle delays aren't counted toward the maximum time.
   */
  maxTime?: number
  /**
   * Enable strict mode. It does the following:
   *
   * 1. Useless filters (filters that do not match anything) are upgraded from warnings to errors.
   */
  // strict: boolean
  /**
   * The logger to use to output feedback to the terminal.
   *
   * By defualt uses console.log
   */
  logger?: Logger
  /**
   * Run benchmarks quickly. This disables use of Benchmark.js internally. All cases are executed such that
   * their `.run` method is only run _once_ with no warmup period before hand. Naturally this will lead to
   * statistically insignificant results. Only use when you are not looking for accurate results such as when
   * developing your cases.
   *
   * @default false
   */
  quick?: boolean
  /** Upgrades lint errors from logged warnings to thrown errors. */
  strictMode?: boolean
}

type InputParameterFilter =
  | string
  | {
      name: RegExp
      value: RegExp
    }
  | { name: RegExp }
  | { value: RegExp }

/** Representation of the options after having been resolved. */
export type Config = {
  name: string
  outDir: null | string
  outFileName: string
  outputCSVs: boolean
  onlyGroups: null | RegExp
  skipGroups: null | RegExp
  maxTime?: number
  logger: Logger
  quick: boolean
  parametersFilter: {
    only: ConfigParameterFilter[]
    skip: ConfigParameterFilter[]
  }
}

export type ConfigParameterFilter = {
  name: RegExp | null
  value: RegExp | null
}

export type Logger = {
  info(...args: unknown[]): void
  error(...args: unknown[]): void
}

export function resolve(input: Input): Readonly<Config> {
  if (input.strictMode === true) {
    // @ts-expect-error dynamic global
    global.BEMA_STRICT_MODE = true
  } else if (input.strictMode === false) {
    // @ts-expect-error dynamic global
    global.BEMA_STRICT_MODE = false
  }

  let onlyGroups: RegExp | null = null
  if (input?.onlyGroups) {
    onlyGroups = processPattern(input.onlyGroups)
  }

  let skipGroups: RegExp | null = null
  if (input?.skipGroups) {
    skipGroups = processPattern(input.skipGroups)
  }

  const outFileName = input.outfileName ?? 'report'

  const onlyParameters = (input?.onlyParameters ?? []).map(resolveParameterFilter)

  const skipParameters = (input?.skipParameters ?? []).map(resolveParameterFilter)

  const name = input.name ?? (Date.now() / 1000).toString()

  const outDir =
    input.outDir === null
      ? null
      : input.outDir
      ? absolutify(input.outDir, process.cwd())
      : Path.join(process.cwd(), `results`, name)

  const maxTime = input.maxTime

  const logger = input.logger ?? {
    info: console.log,
    error: console.error,
  }

  const quick = input.quick ?? false

  const outputCSVs = input.outputCSVs ?? false

  return {
    name,
    quick,
    logger,
    maxTime,
    outDir,
    outFileName,
    outputCSVs,
    onlyGroups,
    skipGroups,
    parametersFilter: {
      skip: skipParameters,
      only: onlyParameters,
    },
  }
}

/** Helpers */

function resolveParameterFilter(pf: InputParameterFilter): ConfigParameterFilter {
  if (typeof pf === 'string') {
    return processFilter(pf)
  }

  return {
    name: 'name' in pf ? pf.name : null,
    value: 'value' in pf ? pf.value : null,
  }
}

export function hasParameterFilters(config: Config): boolean {
  return config.parametersFilter.only.length > 0 && config.parametersFilter.skip.length > 0
}

export function hasGroupFilters(config: Config): boolean {
  return config.onlyGroups !== null || config.skipGroups !== null
}

function processFilter(kv: string): ConfigParameterFilter {
  let invalid = false

  if (kv.split('').filter((c) => c === ':').length !== 1) {
    invalid = true
  }

  const raw = kv.split(/\s*:\s*/).map((s) => s.trim())

  if (raw.length > 2) invalid = true

  const namePattern = raw[0] === '' ? null : raw[0]
  const valuePattern = raw[1] === '' ? null : raw[1]

  if (invalid) {
    throw new UserError({
      message: endent`
        ${kleur.bold(kleur.red(`Invalid value given for parameter filter`))}

            ${kv}
        
        ${kleur.bold(kleur.green('Must follow format:'))}

        ${filterExpressionGuide}
      `,
    })
  }

  const name = namePattern ? processPattern(namePattern) : null
  const value = valuePattern ? processPattern(valuePattern) : null

  return {
    name,
    value,
  }
}

export const filterExpressionGuide = endent`
    [regex][space]:[space][regex]
     |||||                 |||||
     ^^^^^param name       ^^^^^param value

    ${kleur.dim(`Note: regex cannot have have ":" character`)}
    ${kleur.dim(`Note: regex is prefixed with ^ and suffixed with $`)}
    ${kleur.dim(`Note: regex is executed case insensitive`)}

${kleur.bold(kleur.green('Examples:'))}

    ${kleur.dim(`# Space around colon is optional`)}

    database:postgres
    database : postgres
    database  :    postgres

    ${kleur.dim(`# Case insensitive`)}

    database:postgres
    dataBase:postgreSQL  ${kleur.dim(`<-- Same as above`)}
    DATABASE:postgreSQL  ${kleur.dim(`<-- Same as above`)}

    ${kleur.dim(`# No key or value is shorthand for match all (.*)`)}

    .*:postgres
    :postgres            ${kleur.dim(`<-- Shorthand for above`)}
    database:.*
    database:            ${kleur.dim(`<-- Shorthand for above`)}
`
