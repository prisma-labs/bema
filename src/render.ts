import columnify from 'columnify'
import endent from 'endent'
import * as csv from 'fast-csv'
import kleur from 'kleur'
import markdownTable from 'markdown-table'
import { EOL } from 'os'
import slugify from 'slugify'
import { CaseReport, CaseResultSimplifiedWithGroupStats, GroupResultSimplified, Report } from './types'

export async function renderReportCSV(
  report: Report
): Promise<{ groupName: string; matrixName: string; content: string; name: string }[]> {
  return Promise.all(
    report.groups
      .flatMap((group) => {
        return Object.values(group.caseResultsByMatrix).map((caseResults) => ({
          groupName: group.name,
          caseResults,
        }))
      })
      .map(({ groupName, caseResults }) => {
        // @ts-expect-error FIXME
        const matrixName = caseResults[0].report.matrix
          .flatMap(Object.entries)
          .map((ent) => {
            return ent.map((s) => slugify(s, { lower: true })).join('=')
          })
          .join('+')
        return csv.writeToString(caseResults.map(getTabularData), { headers: true }).then((content) => ({
          groupName,
          matrixName,
          name: [slugify(groupName, { lower: true }), matrixName].filter((s) => s).join('--'),
          content,
        }))
      })
  )
}

export function renderReportMarkdown(report: Report): string {
  const title = `# Benchmark Report: ${report.name}`
  const groups = report.groups
    .map(
      (group) => endent`
              ## ${group.name}

              ${renderGroupResultForMarkdown(group)}
            `
    )
    .join(`${EOL + EOL}<br/>${EOL + EOL}`)

  return endent`
      ${title}

      ${groups}
    `
}

export function renderGroupResultForMarkdown(groupResult: GroupResultSimplified): string {
  return groupResult.caseResultsByMatrix
    .map((matrixCaseResults) => {
      // @ts-expect-error FIXME
      const matrixName = Object.values(matrixCaseResults[0].report.parametersFromMatrix).join(' ')
      const tabularData = matrixCaseResults.map(getTabularData)
      const table = markdownTable([Object.keys(tabularData[0] ?? {}), ...tabularData.map(Object.values)])
      const title = `MATRIX: ${matrixName.toUpperCase()}`
      return endent`
        ### ${title}

        ${table}
      `
    })
    .join(EOL + EOL)
}

export function renderGroupResultForTerminal(groupResult: GroupResultSimplified): string {
  return groupResult.caseResultsByMatrix
    .map((matrixCaseResults) => {
      // @ts-expect-error FIXME
      const matrixName = Object.values(matrixCaseResults[0].report.parametersFromMatrix).join(' ')
      const table = columnify(matrixCaseResults.map(getTabularData), { columnSplitter: '   ' })
      const title = kleur.bold(`MATRIX: ${matrixName.toUpperCase()}`)
      return `${title}${EOL}${table}`
    })
    .join(EOL + EOL)
}

export function getTabularData(
  caseResult: CaseResultSimplifiedWithGroupStats
): Record<string, string | number> {
  return {
    case: Object.values(caseResult.report.parametersFromNotMatrix).join(' '),
    'ops/s': renderHz(caseResult.report.stats.hz),
    '% slower than fastest': renderPercentSlowerThanFastest(caseResult.report.stats.percentSlower),
    'mean op duration (ms)': caseResult.report.stats.mean.toFixed(2),
    'standard deviation of mean op (ms)': caseResult.report.stats.deviation.toFixed(2),
    '% relative margin of error': `±${caseResult.report.stats.rme.toFixed(2)}%`,
    samples: caseResult.report.stats.sample.length,
  }
}

function renderPercentSlowerThanFastest(n: number): string {
  return n === 0 ? 'N/A' : `${n.toFixed(0)}%`
}

function renderHz(n: number) {
  return n > 50 ? Number(n.toFixed(0)) : Number(n.toFixed(2))
}

export function renderCaseSummary(report: CaseReport): string {
  const name = report.name
  const hz = renderHz(report.stats.hz)
  const rme = report.stats.rme.toFixed(2)
  const quick = report.quickMode ? ` (Quick Mode)` : ``
  const elapsed = report.stats.times.elapsed.toFixed(0)

  return endent`
    ${name} x ${kleur.green(hz)} ops/sec ±${rme}% ${kleur.dim(`${elapsed}s`)}${kleur.red(quick)}
  `
}
