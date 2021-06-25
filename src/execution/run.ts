import * as fs from 'fs-jetpack'
import kleur from 'kleur'
import { EOL } from 'os'
import * as Path from 'path'
import { Bema, InternalBema } from '../declaration/bema'
import * as Config from '../declaration/config'
import { renderReportCSV, renderReportMarkdown } from '../render'
import { Report } from '../types'
import { d } from '../utils'
import { CHECK } from '../utils/terminal'
import { expand } from './expand'
import { prime } from './prime'
import { runBema } from './runBema'

export async function run(bema: Bema): Promise<Report> {
  const _bema = bema as InternalBema
  const expanded = expand(_bema)
  const primed = prime(expanded)
  const config = Config.resolve(_bema.$.state.configInput)
  const report = await runBema({ bema: primed, config })

  const { outDir, outFileName } = config

  if (outDir) {
    config.logger.info(EOL)

    d('writting report to disk...')

    const writingFiles = [
      fs.writeAsync(Path.join(outDir, `${outFileName}.json`), report),
      fs.writeAsync(Path.join(outDir, `${outFileName}.md`), renderReportMarkdown(report)),
    ]

    if (config.outputCSVs) {
      writingFiles.push(
        renderReportCSV(report).then(async (csvDatas) => {
          await Promise.all(
            csvDatas.map((csvData) =>
              fs.writeAsync(Path.join(outDir, `csvs/${csvData.name}.csv`), csvData.content)
            )
          )
        })
      )
    }

    await Promise.all(writingFiles)

    config.logger.info(
      kleur.dim(`${CHECK} Wrote benchmark report to directory: ${Path.relative(process.cwd(), outDir)}`)
    )
  }

  config.logger.info(EOL + kleur.bold(`${kleur.green(CHECK)} Bema finished in ${report.time.elapsed}s`))

  return report
}
