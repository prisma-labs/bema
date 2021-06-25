import React, { FC } from 'react'
import { VictoryBar, VictoryChart, VictoryGroup } from 'victory'
import { CaseResultSimplifiedWithGroupStats } from '../../types'

export type GroupSeries = {
  groupName: string
  matrixName: string
  groupRuns: {
    name: string
    caseResults: CaseResultSimplifiedWithGroupStats[]
  }[]
  caseResultsAcrossGroupRuns: Record<
    string,
    {
      caseName: string
      meanTimes: number[]
    }
  >
}

type Props = { series: GroupSeries }

export const GroupOverTime: FC<Props> = ({ series }) => {
  return (
    <div>
      <h1>{series.groupName}</h1>
      <h2>{series.matrixName}</h2>
      <VictoryChart>
        <VictoryGroup offset={15}>
          {series.groupRuns.map((groupRun, i) => {
            return (
              <VictoryBar
                key={`group-run-${i}`}
                labels={groupRun.caseResults.map(() => groupRun.name)}
                data={groupRun.caseResults.map((caseResult) => {
                  return {
                    x: Object.values(caseResult.report.parametersFromNotMatrix).join(' '),
                    y: caseResult.report.stats.mean,
                  }
                })}
              />
            )
          })}
        </VictoryGroup>
      </VictoryChart>
    </div>
  )
}
