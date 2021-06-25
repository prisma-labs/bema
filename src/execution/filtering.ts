import endent from 'endent'
import kleur from 'kleur'
import { isEmpty, partition } from 'lodash'
import { Config, ConfigParameterFilter, Logger } from '../declaration/config'
import { renderIndentedList } from '../utils/terminal'
import { PrimedCase } from './prime'

export type ParameterFilteringApplicationResult = ReturnType<typeof applyParametersFilterAcrossCases>

export function applyParametersFilterAcrossCases(
  parametersFilter: Config['parametersFilter'],
  cs: PrimedCase[]
): {
  usageStats: {
    only: {
      didExclude: Map<ConfigParameterFilter, Set<PrimedCase>>
      didNotExclude: Set<ConfigParameterFilter>
    }
    skip: {
      didExclude: Map<ConfigParameterFilter, Set<PrimedCase>>
      didNotExclude: Set<ConfigParameterFilter>
    }
  }
  casesSelected: PrimedCase[]
  casesSkipped: PrimedCase[]
} {
  const usageStats: {
    only: {
      didExclude: Map<ConfigParameterFilter, Set<PrimedCase>>
      didNotExclude: Set<ConfigParameterFilter>
    }
    skip: {
      didExclude: Map<ConfigParameterFilter, Set<PrimedCase>>
      didNotExclude: Set<ConfigParameterFilter>
    }
  } = {
    only: {
      didExclude: new Map(),
      didNotExclude: new Set(parametersFilter.only),
    },
    skip: {
      didExclude: new Map(),
      didNotExclude: new Set(parametersFilter.skip),
    },
  }

  const [casesSelected, casesSkipped] = partition(cs, (c) => {
    const result = applyParametersFilter(parametersFilter, c)

    result.usageStats.only.didExclude.forEach((pf) => {
      usageStats.only.didNotExclude.delete(pf)
      usageStats.only.didExclude.set(pf, (usageStats.only.didExclude.get(pf) ?? new Set()).add(c))
    })

    result.usageStats.only.didNotExclude.forEach((pf) => {
      // Once a filter has been used it is forever considered used
      if (!usageStats.only.didExclude.get(pf)) {
        usageStats.only.didNotExclude.add(pf)
      }
    })

    result.usageStats.skip.didExclude.forEach((pf) => {
      usageStats.skip.didNotExclude.delete(pf)
      usageStats.skip.didExclude.set(pf, (usageStats.skip.didExclude.get(pf) ?? new Set()).add(c))
    })

    result.usageStats.skip.didNotExclude.forEach((pf) => {
      // Once a filter has been used it is forever considered used
      if (!usageStats.skip.didExclude.get(pf)) {
        usageStats.skip.didNotExclude.add(pf)
      }
    })

    return result.pass
  })

  return {
    usageStats,
    casesSelected,
    casesSkipped,
  }
}

/**
 * Does the given case pass the given parameters filter?
 *
 * Returns object with pass status and runtime metadata. `pass` property is `true` if the case passes the
 * filter, otherwise `false`.
 */
export function applyParametersFilter(
  parametersFilter: Config['parametersFilter'],
  c: PrimedCase
): {
  usageStats: {
    only: {
      didExclude: ConfigParameterFilter[]
      didNotExclude: ConfigParameterFilter[]
    }
    skip: {
      didExclude: ConfigParameterFilter[]
      didNotExclude: ConfigParameterFilter[]
    }
  }
  pass: boolean
} {
  const usageStats: {
    only: {
      didExclude: ConfigParameterFilter[]
      didNotExclude: ConfigParameterFilter[]
    }
    skip: {
      didExclude: ConfigParameterFilter[]
      didNotExclude: ConfigParameterFilter[]
    }
  } = {
    only: {
      didExclude: [],
      didNotExclude: [],
    },
    skip: {
      didExclude: [],
      didNotExclude: [],
    },
  }

  if (!isEmpty(parametersFilter.only)) {
    // If _any_ paramter passes _any_ only-filter then INCLUDE
    const [filtersThatDidNotExclude, filtersThatDidExclude] = partition(parametersFilter.only, (only) => {
      return execFilter(only, c)
    })
    usageStats.only.didExclude.push(...filtersThatDidExclude)
    usageStats.only.didNotExclude.push(...filtersThatDidNotExclude)
  }

  if (!isEmpty(parametersFilter.skip)) {
    // If _any_ paramter is matched by _any_ skip-filter then EXCLUDE
    const [filtersThatDidExclude, filtersThatDidNotExclude] = partition(parametersFilter.skip, (skip) => {
      return execFilter(skip, c)
    })
    usageStats.skip.didExclude.push(...filtersThatDidExclude)
    usageStats.skip.didNotExclude.push(...filtersThatDidNotExclude)
  }

  const pass = isEmpty(usageStats.only.didExclude) && isEmpty(usageStats.skip.didExclude)

  return {
    usageStats,
    pass,
  }
}

function execFilter(parameterFilter: ConfigParameterFilter, c: PrimedCase) {
  return Object.entries(c.parameters).find(([name, value]) => {
    const namePass = parameterFilter.name === null ? true : parameterFilter.name.test(name)
    const valuePass = parameterFilter.value === null ? true : parameterFilter.value.test(value)
    return namePass && valuePass
  })
}

export function logUsageResults(logger: Logger, result: ParameterFilteringApplicationResult): void {
  // if (result.usageStats.only.didExclude.size > 0) {
  //   const cases = [...result.usageStats.only.didExclude.values()].reduce(
  //     (cases, casesExcludedByThisFilter) => {
  //       casesExcludedByThisFilter.forEach((c) => cases.add(c))
  //       return cases
  //     },
  //     new Set()
  //   )
  //   logger.info(kleur.dim(`${cases.size} case(s) excluded by only-filters`))
  // }

  // if (result.usageStats.skip.didExclude.size > 0) {
  //   const cases = [...result.usageStats.skip.didExclude.values()].reduce(
  //     (cases, casesExcludedByThisFilter) => {
  //       casesExcludedByThisFilter.forEach((c) => cases.add(c))
  //       return cases
  //     },
  //     new Set()
  //   )
  //   logger.info(kleur.dim(`${cases.size} case(s) excluded by skip-filters`))
  // }

  if (result.usageStats.only.didNotExclude.size > 0) {
    logger.info(renderUsageError('only', result))
  }

  if (result.usageStats.skip.didNotExclude.size > 0) {
    logger.info(renderUsageError('skip', result))
  }
}

export function renderUsageError(kind: 'only' | 'skip', result: ParameterFilteringApplicationResult): string {
  const message = endent`
    ${kleur.red(
      `The following ${kind}-by-parameter filter(s) had no effect. Maybe you made a typo in the filter(s)?`
    )}
    ${renderIndentedList(
      [...result.usageStats[kind].didNotExclude].map(
        (filter) => `${String(filter.name)} : ${String(filter.value)}`
      )
    )}
  `
  return message
}
