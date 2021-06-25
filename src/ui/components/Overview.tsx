import React, { FC } from 'react'
import { Report } from '../../types'
import { GroupOverTime, GroupSeries } from './GroupOverTime'

type Props = {
  reports: Report[]
}

export const Overview: FC<Props> = ({ reports }) => {
  const seriess = reportsToGroupSeriess(reports)
  return (
    <div>
      {seriess.map((series, i) => (
        <GroupOverTime key={`group-over-time-${i}`} series={series} />
      ))}
    </div>
  )
}

function reportsToGroupSeriess(reports: Report[]): GroupSeries[] {
  const index: Record<string, GroupSeries> = {}

  reports.forEach((report) => {
    report.groups.forEach((group) => [
      group.caseResultsByMatrix.forEach((caseResults) => {
        const caseResult = caseResults[0]

        if (!caseResult) {
          throw new Error(`No case results for group by matrix`)
        }

        const matrixName = Object.values(caseResult.report.parametersFromMatrix).join(' ')
        const benchmarkName = group.name + ' ' + matrixName
        const groupSeries = index[benchmarkName] ?? {
          groupName: group.name,
          matrixName: matrixName,
          groupRuns: [],
          caseResultsAcrossGroupRuns: {},
        }

        if (!index[benchmarkName]) {
          index[benchmarkName] = groupSeries
        }

        caseResults.forEach((caseResult) => {
          const caseName = Object.values(caseResult.report.parametersFromNotMatrix).join(' ')
          let caseResultAcrossGroupRuns = groupSeries.caseResultsAcrossGroupRuns[caseName]
          if (!caseResultAcrossGroupRuns) {
            caseResultAcrossGroupRuns = {
              caseName,
              meanTimes: [],
            }
            groupSeries.caseResultsAcrossGroupRuns[caseName] = caseResultAcrossGroupRuns
          }
          caseResultAcrossGroupRuns.meanTimes.push(caseResult.report.stats.mean)
        })

        groupSeries.groupRuns.push({
          name: report.name,
          caseResults,
        })
      }),
    ])
  })

  return Object.values(index)
}
