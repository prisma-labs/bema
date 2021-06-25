import arg from 'arg'
import bytes from 'bytes'
import endent from 'endent'
import * as Glob from 'fast-glob'
import * as fs from 'fs-jetpack'
import kleur, { bold, dim } from 'kleur'
import { isEmpty } from 'lodash'
import * as Path from 'path'
import { Report } from '../types'
import { assertCasesHandled, fatal } from '../utils'
import { absolutify } from '../utils/fs'
import { downloadGitHubArtifact, parseGithubRepoInfoFromGitConfig } from '../utils/github'
import { renderIndentedList } from '../utils/terminal'

const githubActionFlagFormatHelp = endent`
  <org>/<repo>/<artifact_id>|latest
  <org>/<repo>                                    <- defaults to latest artifact
  <artifact_id>|latest                            <- defaults to current project org/repo

  Examples:

  prisma/prisma-client-js-benchmarks/latest       <- latest artifact     specific org/repo
  prisma/prisma-client-js-benchmarks              <- latest artifact     specific org/repo (same as above, except latest implied)
  prisma/prisma-client-js-benchmarks/812654940    <- specific artifact   specific org/repo
  latest                                          <- latest artifact     implied org/repo from local .git/config
  812654940                                       <- specific artifact   implied org/repo from local .git/config
`

export default async function run(): Promise<void> {
  const args = arg({
    '--help': Boolean,
    '-h': '--help',

    '--dir': String,
    '-d': '--dir',

    '--github-action': String,
    '--gha': '--github-action',
    '-g': '--github-action',
  })

  const helpMessage = endent`
    ${bold('ALL COMMANDS')}

    ${renderIndentedList(['bench (default)', 'report'])}

    ${dim('ABOUT THIS COMMAND')}

    This command will merge Bema group results that have been fragmented
    into multiple files into one final "report.json" file.

    If the directory contains just other directories than this command
    recurses into them until finding a directories with .json files which
    are assumed to be Bema Group Result files.

    ${bold('USAGE')}

        ${dim('$')} ${bold('yarn bema report')} [OPTIONS]

    ${bold('OPTIONS')}

        --dir                               string          Path to directory where group results were stored. 
         -d                                                 Note: If path not absolute then considered relative to current working directory.

        --github-action                     string          Path to a GitHub repository artifact where group results were stored.
        --gha                                               Format:  (refer to guide below)
         -a

        ${kleur.dim(`OTHER`)}

        --help -h                                           Shows this help message.

        ${kleur.dim(`FORMAT FOR --github-action`)}

        ${githubActionFlagFormatHelp}
  `

  if (args['--help']) {
    fatal(2, helpMessage)
  }

  if (args['--dir'] && args['--github-action']) {
    fatal(1, `The follow flags are mututally exclusive. Pick one: --dir, --github-action.`)
  }

  let dir: string
  if (args['--github-action'] !== undefined) {
    dir = await getResultsFromGitHubAction(args['--github-action'])
  } else if (args['--dir']) {
    dir = absolutify(Path.join(args['--dir']), process.cwd())
  } else {
    fatal(1, `one of the following flags is required: --dir flag, --github-action`)
  }

  await mergeGroupResultsForAllNestedDirectories(dir)
}

async function mergeGroupResultsForAllNestedDirectories(dir: string) {
  const contents = (await fs.listAsync(dir)) ?? []

  if (!contents.some((item) => Path.extname(item) === '.json')) {
    await Promise.all(contents.map((item) => mergeGroupResultsForAllNestedDirectories(Path.join(dir, item))))
    return
  }

  const dirBase = Path.dirname(dir)
  const pattern = Path.join(dir, `*.json`)
  const outPath = Path.join(dir, 'report.json')

  // console.log(`Using as base directory: ${dirBase}`)
  // console.log(`Searching for fragmented reports: %s`, Path.relative(dirBase, pattern))

  // clear old report if present
  await fs.removeAsync(outPath)

  const reportPaths = Glob.sync(pattern, {
    caseSensitiveMatch: false,
    ignore: ['**/node_modules'],
  })

  if (isEmpty(reportPaths)) {
    fatal(1, `Directory has no json reports.`)
  }

  console.log(
    `Found fragmented reports:\n${renderIndentedList(
      reportPaths.map((path) => Path.relative(dirBase, path))
    )}`
  )

  const report = await Promise.all(reportPaths.map((path) => fs.readAsync(path, 'json'))).then(mergeReports)

  await fs.writeAsync(outPath, report)

  console.log(`Wrote report to ${Path.relative(dirBase, outPath)}`)
}

/* Helpers */

function mergeReports(reports: Report[]): Report {
  return {
    // @ts-expect-error TODO
    name: reports[0].name,
    // @ts-expect-error TODO
    time: reports[0].time,
    groups: reports.flatMap((report) => report.groups),
  }
}

async function getResultsFromGitHubAction(target: string): Promise<string> {
  const token = process.env.GITHUB_TOKEN

  const parsedFlag = parseFlag(target)

  if (!token) {
    throw new Error(
      `You must have envar GITHUB_TOKEN set when using the --github-action flag.\n\nhttps://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token`
    )
  }

  let org: string, repo: string

  if ('org' in parsedFlag) {
    org = parsedFlag.org
    repo = parsedFlag.repo
  } else {
    const ghRepoFromGitConfig = await parseGithubRepoInfoFromGitConfig()
    org = ghRepoFromGitConfig.org
    repo = ghRepoFromGitConfig.repo
  }

  const outDir = Path.join(process.cwd(), 'github-artifacts')
  const artifactId = 'artifactId' in parsedFlag ? parsedFlag.artifactId : undefined

  await downloadGitHubArtifact({
    token,
    org,
    repo,
    artifactId,
    outDir,
    on(event) {
      switch (event.name) {
        case 'find_artifacts_start':
          console.log(`finding artifacts for ${event.org}/${event.repo}`)
          break
        case 'find_artifacts_done':
          console.log(`found ${event.totalCount} artifact(s)`)
          break
        case 'download_artifact_start':
          console.log(
            `downloading artifact "${event.artifact.name}" (size: ${bytes(event.artifact.size_in_bytes, {
              unit: 'mb',
              decimalPlaces: 0,
            })}, id: ${event.artifact.id}, created at: ${event.artifact.created_at})`
          )
          break
        case 'download_artifact_done':
          console.log(`done`)
          break
        case 'decompressing_artifact_start':
          console.log(`decompressing artifact`)
          break
        case 'decompressing_artifact_done':
          console.log(`done`)
          break
        default:
          assertCasesHandled(event)
          break
      }
    },
  })

  return outDir

  function parseFlag(githubActionFlag: string):
    | {} // eslint-disable-line
    | { org: string; repo: string; artifactId: number }
    | { org: string; repo: string }
    | { artifactId: number } {
    const parts = githubActionFlag.split('/')
    if (parts.length > 3) {
      fatal(1, `Invalid format for flag --github-action\n\nFormat Guide:\n${githubActionFlagFormatHelp}`)
    }

    if (parts.length === 3) {
      return {
        org: parts[0],
        repo: parts[1],
        ...(parts[2] === 'latest' ? {} : { artifactId: Number(parts[2]) }),
      }
    }
    if (parts.length === 2) {
      return { org: parts[0], repo: parts[1] }
    }
    if (parts.length === 1) {
      if (parts[0] === 'latest') return {}
      return { artifactId: Number(parts[0]) }
    }

    return {}
  }
}
