import { flatten, groupBy, mapValues, maxBy, merge } from 'lodash'
import { CaseResult, GroupResult } from '../types'
import { PrimedCase, PrimedGroup } from './prime'

/**
 * Get the fastest result.
 *
 * @throws If an empty array is given.
 */
export function getFastest(results: CaseResult[]): CaseResult {
  const fastest = maxBy(results, (result) => result.report.stats.hz)
  if (!fastest) {
    throw new Error(`Cannot get fastest for zero results`)
  }
  return fastest
}

/**
 * Split cases by matrix and augment stats with group-related info.
 */
export function createGroupResult({
  casesSelected,
  caseResults,
  group,
}: {
  casesSelected: PrimedCase[]
  group: PrimedGroup
  caseResults: CaseResult[]
}): GroupResult {
  const caseResultsSplitByMatrix = groupBy(caseResults, (result) =>
    result.report.matrix
      .flatMap<[string, unknown]>(Object.entries)
      .map(([k, v]) => `${k}:${String(v)}`, '')
      .join(' + ')
  )

  const caseResultsSplitByMatrixAndEnhanced = mapValues(caseResultsSplitByMatrix, (matrixCaseResults) => {
    const matrixFastest = getFastest(matrixCaseResults)
    return matrixCaseResults
      .map((matrixCaseResult) => {
        return merge({}, matrixCaseResult, {
          report: {
            stats: {
              percentSlower:
                matrixFastest === matrixCaseResult
                  ? 0
                  : (matrixFastest.report.stats.hz / matrixCaseResult.report.stats.hz) * 100,
            },
          },
        })
      })
      .sort((r1, r2) => {
        return r1.report.stats.hz > r2.report.stats.hz ? -1 : 1
      })
  })

  // const matrixCount = Object.keys(caseResultsSplitByMatrixAndEnhanced).length
  const byMatrix = caseResultsSplitByMatrixAndEnhanced
  const all = flatten(Object.values(caseResultsSplitByMatrixAndEnhanced))

  return {
    time: {
      started: 0,
      finished: 0,
      elapsed: 0,
    },
    name: group.name,
    cases: group.cases,
    casesSelected,
    caseResults: {
      byMatrix,
      all,
    },
  }
}
