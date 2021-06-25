import Benchmarkjs from 'benchmark'
import endent from 'endent'
import kleur, { underline } from 'kleur'
import { difference, differenceWith, isEmpty, sortBy } from 'lodash'
import { EOL } from 'os'
import { inspect } from 'util'
import VError from 'verror'
import * as Config from '../declaration/config'
import { renderCaseSummary, renderGroupResultForTerminal } from '../render'
import {
  AfterGroupContext,
  CaseReport,
  CaseResult,
  GroupResult,
  GroupResultSimplified,
  ParameterChangeCallbackInfo,
  ParameterName,
  Report,
} from '../types'
import { d, millisecondsToSeconds } from '../utils'
import { lintError, UserError } from '../utils/errors'
import { ARROW_POINTING_RIGHT, indent, INDENT, renderIndentedList } from '../utils/terminal'
import { applyParametersFilterAcrossCases, logUsageResults } from './filtering'
import { createGroupResult } from './helpers'
import { compileContext, countCases, PrimedBema, PrimedCase } from './prime'

export async function runBema({
  config,
  bema,
}: {
  config: Config.Config
  bema: PrimedBema
}): Promise<Report> {
  const bemaTimeStarted = Date.now()

  const report: Report = {
    name: config.name,
    time: {
      elapsed: 0,
      finished: 0,
      started: 0,
    },
    groups: [],
  }

  let parametersOfCurrentCase: Record<string, string> = {}

  const caseCount = countCases(bema)

  d('starting analysis and run of (%d) collected benchmarks', caseCount)

  if (caseCount === 0) {
    const message = kleur.red(`No cases were defined.`)
    throw new UserError({ message })
  }

  // todo frontload filter of benchmarks with no cases defined
  // todo warn when a benchmark is filtered out this way
  // todo handle case of all benchmarks filtered out this way and thus effectively no benchmarks defined (like initial check)

  /** Apply group filter if any */

  const groups = bema.groups

  let selectedGroups = groups

  // const config = Config.resolve(_bema.$.state.configInput)
  const logger = config.logger

  if (config.onlyGroups) {
    const { onlyGroups } = config
    selectedGroups = selectedGroups.filter((group) => onlyGroups.exec(group.name))
  }

  if (config.skipGroups) {
    const { skipGroups } = config
    selectedGroups = selectedGroups.filter((group) => !skipGroups.exec(group.name))
  }

  /** Give feedback about filtered groups */

  if (Config.hasGroupFilters(config)) {
    const excludedGroups = differenceWith(groups, selectedGroups, (g1, g2) => {
      return g1.name === g2.name
    })

    if (isEmpty(selectedGroups)) {
      const message = kleur.yellow(`All groups filtered out so nothing to do. Stopping benchmark run now.`)
      throw new UserError({ message })
    } else {
      d(`excluded ${excludedGroups.length} group(s): ${excludedGroups.map((group) => group.name).join(', ')}`)
      const message = endent`
          ${kleur.green(`Excluded ${excludedGroups.length} group(s) by group filters.`)}

          ${renderIndentedList(excludedGroups.map((s) => `${s.name}`))}
        `
      logger.info(message)
    }
  }

  /** Validate that cases did supply required parameters */

  const errorsIndex: Record<
    string,
    {
      benchmarkName: string
      requiredParameters: ParameterName[]
      badCases: {
        caseName: string
        missingKeys: string[]
      }[]
    }
  > = {}

  for (const g of selectedGroups) {
    for (const c of g.cases) {
      const keyDifference = difference(c.parameterDefinitions, Object.keys(c.parameters))
      if (!isEmpty(keyDifference)) {
        errorsIndex[g.name] = errorsIndex[g.name] ?? {
          benchmarkName: g.name,
          requiredParameters: c.parameterDefinitions,
          badCases: [],
        }
        // @ts-expect-error FIXME
        errorsIndex[g.name].badCases.push({
          caseName: c.name,
          missingKeys: keyDifference,
        })
      }
    }
  }

  const errors = Object.values(errorsIndex)
  if (!isEmpty(errors)) {
    let m = ''
    m += kleur.bold(
      kleur.red(
        `${errors.flatMap((be) => be.badCases).length} case(s) among ${
          errors.length
        } group(s) are missing required parameters.\n`
      )
    )
    m += '\n'
    m +=
      errors
        .map((be) => {
          let m = ''
          m +=
            underline(
              `Suite ${kleur.bold(be.benchmarkName)} has ${
                be.badCases.length
              } case(s) missing required parameters`
            ) + '\n'
          m += '\n'
          m += `${INDENT}Required parameters:\n`
          m +=
            be.requiredParameters
              .map((x) => {
                const errorCount = be.badCases.filter((bc) => bc.missingKeys.includes(x)).length
                if (errorCount > 0) {
                  return `${INDENT}${ARROW_POINTING_RIGHT} ${kleur.bold(x)} ${kleur.red(
                    `✖ ${errorCount} case(s) missing this`
                  )}`
                } else {
                  return `${INDENT}${ARROW_POINTING_RIGHT} ${kleur.bold(x)} ${kleur.green(`✔`)}`
                }
              })
              .join('\n') + '\n'
          m += '\n'
          m += `${INDENT}Cases missing one or more required parameters:\n`
          m += be.badCases
            .map((ce) => {
              let m = ''
              m +=
                `${INDENT}${ARROW_POINTING_RIGHT} ${kleur.bold(ce.caseName)} is missing: ` +
                ce.missingKeys.map((x) => `${kleur.red(x)}`).join(', ')
              return m
            })
            .join('\n')
          m += '\n'

          return m
        })
        .join('\n\n') + '\n'

    throw new UserError({ message: m })
  }

  /** Run selected benchmarks */

  let initial = true
  for (const group of selectedGroups) {
    const groupTimeStarted = Date.now()

    if (isEmpty(group.cases)) {
      lintError(config.logger, { message: endent`The group "${group.name}" has no cases defined, skipping.` })
      continue
    }

    const caseResults: CaseResult[] = []

    d('running group "%s"', group.name)
    logger.info(underline(kleur.bold(EOL + EOL + `Starting Group ${kleur.magenta(group.name)}`)) + EOL)
    logger.info(kleur.dim(`${group.cases.length} case(s)`))

    /** Apply parameter filters if any (aka. select cases) */

    if (Config.hasParameterFilters(config)) {
      d('applying parameter filters', config.parametersFilter)
    }

    const caseFilteringByParamsResult = applyParametersFilterAcrossCases(config.parametersFilter, group.cases)

    logUsageResults(config.logger, caseFilteringByParamsResult)

    if (isEmpty(caseFilteringByParamsResult.casesSelected)) {
      lintError(config.logger, {
        message: endent`
          ${kleur.red('All cases filtered out by parameter filters! This is probably not what you intended.')}

          ${kleur.dim(`Note: Multiple filters use AND semantic.`)}

          ${kleur.bold(`"Only" Filters:`)}
            
          ${
            isEmpty(config.parametersFilter.only)
              ? indent('NA')
              : renderIndentedList(
                  config.parametersFilter.only.map((f) => {
                    const parts: string[] = []
                    if (f.name) parts.push(`name: ${inspect(f.name)}`)
                    if (f.value) parts.push(`value: ${inspect(f.value)}`)
                    return parts.join('  ')
                  })
                )
          }

          ${kleur.bold(`"Skip" Filters:`)}

          ${
            isEmpty(config.parametersFilter.skip)
              ? indent('NA')
              : renderIndentedList(
                  config.parametersFilter.skip.map((f) => {
                    const parts: string[] = []
                    if (f.name) parts.push(`name: ${inspect(f.name)}`)
                    if (f.value) parts.push(`value: ${inspect(f.value)}`)
                    return parts.join('  ')
                  })
                )
          }

          ${kleur.bold(`The available parameter types are:`)}

          ${renderIndentedList(group.cases[0]?.parameterDefinitions ?? []) /* todo list out each case? */}

          ${kleur.bold(`The parameters of each case are:`)}

          ${renderIndentedList(
            group.cases.map((c) =>
              Object.entries(c.parameters)
                .map((ent) => `${ent[0]}:${ent[1]}`)
                .join(', ')
            )
          )}
        `,
      })
    } else if (Config.hasParameterFilters(config)) {
      const message =
        kleur.dim(
          `${caseFilteringByParamsResult.casesSkipped.length} case(s) excluded by parameter filters.`
        ) +
        EOL +
        renderIndentedList(caseFilteringByParamsResult.casesSkipped.map((c) => c.name)) +
        EOL
      logger.info(message)
    }

    /** Sort selected cases according to group parameter order */

    const paramDefs = group.cases[0]?.parameterDefinitions ?? []
    const casesSelectedSorted = isEmpty(paramDefs)
      ? caseFilteringByParamsResult.casesSelected
      : sortBy(
          caseFilteringByParamsResult.casesSelected,
          paramDefs.map((parameterName) => (c: PrimedCase) => c.parameters[parameterName])
        )

    /** Run selected cases */
    logger.info('')

    for (const c of casesSelectedSorted) {
      /** Handle parameter change callbacks */

      const callbackInfo: ParameterChangeCallbackInfo = {
        activeCases: casesSelectedSorted.map((c) => {
          return {
            parameters: c.parameters,
          }
        }),
      }

      const parametersOfPreviousCase = parametersOfCurrentCase
      parametersOfCurrentCase = c.parameters

      for (const [paramName, paramVal] of Object.entries(parametersOfCurrentCase)) {
        if (parametersOfPreviousCase[paramName] !== paramVal) {
          const event = {
            initial,
            name: paramName,
            value: {
              before: parametersOfPreviousCase[paramName],
              after: paramVal,
            },
          }

          for (const { callback, parameterName } of group.parameterChangeCallbacks) {
            if (parameterName === paramName) {
              d('running callback for parameterChange ("%s") event', paramName, event)
              try {
                await callback(event, callbackInfo)
              } catch (error) {
                throw new VError(
                  error,
                  `"onParameterChange" hook callback "${callback.name}" failed while running for parameter "${paramName}"`
                )
              }
            }
          }
        }
      }

      /** Run case runner (finally!) */

      d('running benchmark group case "%s"', c.name)

      const beforeCaseContext = await compileContext(c)

      for (const cb of c.beforeCallbacks) {
        try {
          await cb(beforeCaseContext)
        } catch (error) {
          throw new VError(
            error,
            `"Before case" hook callback "${cb.name}" failed while running before case "${c.name}"`
          )
        }
      }

      const { runCallback } = c
      if (!runCallback) {
        throw new Error('No runner was defined for this benchmark case')
      }

      let caseReport: CaseReport
      let returnValue: unknown

      try {
        if (config.quick) {
          d('running in quick mode')
          const start = Date.now()
          returnValue = await runCallback(beforeCaseContext)
          const elpased = Date.now() - start
          caseReport = {
            quickMode: true,
            group: group.name,
            name: c.name,
            matrix: c.matrixChain,
            parameters: c.parameters,
            parametersFromMatrix: c.parametersFromMatrix,
            parametersFromNotMatrix: c.parametersFromNotMatrix,
            stats: {
              moe: 0,
              rme: 0,
              sem: 0,
              variance: 0,
              deviation: 0,
              hz: 1000 / elpased,
              mean: elpased,
              sample: [elpased],
              times: {
                cycle: millisecondsToSeconds(elpased),
                elapsed: millisecondsToSeconds(elpased),
                period: millisecondsToSeconds(elpased),
                timeStamp: start,
              },
            },
          }
        } else {
          const benchmarkjs = new Benchmarkjs({
            defer: true,
            name: c.name,
            fn(deferred: Benchmarkjs.Deferred) {
              Promise.resolve(runCallback(beforeCaseContext))
                .then((result_) => {
                  returnValue = result_
                })
                .finally(() => {
                  deferred.resolve()
                })
            },
            ...(config.maxTime ? { maxTime: millisecondsToSeconds(config.maxTime) } : {}),
          })

          await new Promise((res, rej) => {
            benchmarkjs.on('error', rej)
            benchmarkjs.on('complete', res)
            benchmarkjs.run()
          })

          caseReport = {
            quickMode: false,
            group: group.name,
            name: c.name,
            matrix: c.matrixChain,
            parameters: parametersOfCurrentCase,
            parametersFromMatrix: c.parametersFromMatrix,
            parametersFromNotMatrix: c.parametersFromNotMatrix,
            stats: {
              ...benchmarkjs.stats,
              deviation: benchmarkjs.stats.deviation * 1000,
              hz: benchmarkjs.hz,
              mean: benchmarkjs.stats.mean * 1000,
              times: {
                ...benchmarkjs.times,
              },
            },
          }
        }
      } catch (error) {
        throw new VError(error, `The case "${c.name}" failed while running`)
      }

      d(
        'got benchmark run return:',
        inspect(returnValue, {
          maxArrayLength: 1,
          maxStringLength: 50,
        })
      )

      caseResults.push({
        report: caseReport,
        returnValue,
      })

      /** Run afterEach hooks */

      const afterEachCallbackContext = {
        ...beforeCaseContext,
        $info: {
          report: caseReport,
          returnValue,
        },
      }

      for (const cb of c.afterCallbacks) {
        try {
          await cb(afterEachCallbackContext)
        } catch (error) {
          throw new VError(
            error,
            `"After case" hook callback "${cb.name}" failed while running for case "${c.name}"`
          )
        }
      }

      d('done case')

      logger.info(renderCaseSummary(caseReport))
      initial = false
    }

    /** Run afterAll hooks */

    const groupResult: GroupResult = createGroupResult({
      casesSelected: casesSelectedSorted,
      group,
      caseResults,
    })

    const afterAllCallbackInput: AfterGroupContext = {
      $info: groupResult,
    }

    for (const cb of group.afterCallbacks) {
      try {
        await cb(afterAllCallbackInput)
      } catch (error) {
        throw new VError(
          error,
          `"After group" hook callback "${cb.name}" failed while running for group "${group.name}"`
        )
      }
    }

    const groupTimeFimished = Date.now()
    groupResult.time = {
      finished: groupTimeFimished,
      started: groupTimeStarted,
      elapsed: (groupTimeFimished - groupTimeStarted) / 1000,
    }

    const GroupResultSimplified: GroupResultSimplified = {
      time: groupResult.time,
      name: groupResult.name,
      caseResultsByMatrix: Object.values(groupResult.caseResults.byMatrix).map((caseResults) => {
        return caseResults.map(({ report }) => {
          return { report }
        })
      }),
    }

    const summaryTableText = renderGroupResultForTerminal(GroupResultSimplified)
    logger.info(EOL + summaryTableText)

    d('done group')
    report.groups.push(GroupResultSimplified)
  }

  const bemaTimeFinished = Date.now()
  report.time = {
    started: bemaTimeStarted,
    finished: bemaTimeFinished,
    elapsed: (bemaTimeFinished - bemaTimeStarted) / 1000,
  }

  d('done')
  return report
}
