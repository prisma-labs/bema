import bytes from 'bytes'
import decompress from 'decompress'
import download from 'download'
import * as fs from 'fs-jetpack'
import got from 'got'
import parseGitConfig from 'parse-git-config'
import parseGitHubURL from 'parse-github-url'
import * as Path from 'path'
import slugify from 'slugify'
import { Octokit } from '@octokit/rest'
import { d } from '../utils'
import { absolutify } from './fs'

type Artifact = {
  id: number
  node_id: string
  name: string
  size_in_bytes: number
  url: string
  archive_download_url: string
  expired: boolean
  created_at: string
  expires_at: string
  updated_at: string
}

type EventRepoAddressData = {
  org: string
  repo: string
}

export async function downloadGitHubArtifact(params: {
  outDir?: string
  org: string
  repo: string
  token: string
  artifactId?: number
  on?: (
    event:
      | ({ name: 'find_artifacts_start' } & EventRepoAddressData)
      | ({ name: 'find_artifacts_done'; artifacts: Artifact[]; totalCount: number } & EventRepoAddressData)
      | ({ name: 'download_artifact_start'; artifact: Artifact } & EventRepoAddressData)
      | ({ name: 'download_artifact_done'; artifact: Artifact } & EventRepoAddressData)
      | ({ name: 'decompressing_artifact_start'; artifact: Artifact; path: string } & EventRepoAddressData)
      | ({ name: 'decompressing_artifact_done'; artifact: Artifact; path: string } & EventRepoAddressData)
  ) => void
}): Promise<void> {
  const githubRepoAddress = {
    org: params.org,
    repo: params.repo,
  }

  const gh = new Octokit({
    auth: params.token,
  })

  params.on?.({
    name: 'find_artifacts_start',
    ...githubRepoAddress,
  })

  const response = await gh.request('GET /repos/{owner}/{repo}/actions/artifacts', {
    owner: params.org,
    repo: params.repo,
  })
  const data = response.data

  d(`found ${data.total_count} artifacts`)
  params.on?.({
    name: 'find_artifacts_done',
    artifacts: data.artifacts,
    totalCount: data.total_count,
    ...githubRepoAddress,
  })

  if (data.total_count === 0) {
    throw new Error(`There are no artifacts on this repo`)
  }

  const artifactPointer =
    params.artifactId === undefined
      ? data.artifacts[0]
      : data.artifacts.find((artifact) => artifact.id === params.artifactId)

  if (!artifactPointer) {
    throw new Error(`Could not find an artifact matching the given artifactId: ${String(params.artifactId)}`)
  }

  d(
    `downloading latest artifact called "${artifactPointer.name}" with ID #${artifactPointer.id} (${bytes(
      artifactPointer.size_in_bytes,
      {
        unit: 'mb',
      }
    )})`
  )

  d(`fetching ${artifactPointer.archive_download_url}`)

  const artifactDownloadURlResponse = await got(artifactPointer.archive_download_url, {
    followRedirect: false,
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${params.token}`,
    },
  })

  if (!artifactDownloadURlResponse.headers.location) {
    throw new Error(
      `Missing "location" header in response to request to ${artifactPointer.archive_download_url}`
    )
  }

  const artifactDownloadUrl = artifactDownloadURlResponse.headers.location
  d(`found temporary download link for artifact:\n${artifactDownloadUrl}`)

  const downloadDir = fs.tmpDir()
  const downloadFileName = artifactPointer.name ? `${artifactPointer.name}.zip` : 'data.zip'
  const downloadFilePath = downloadDir.path(downloadFileName)

  d(`will download artifact to: ${downloadFilePath}`)
  params.on?.({
    name: 'download_artifact_start',
    artifact: artifactPointer,
    ...githubRepoAddress,
  })

  const downloading = download(artifactDownloadUrl, downloadDir.cwd(), {
    filename: downloadFileName,
  }) as Promise<unknown>

  await downloading

  d(`downloaded artifact to: ${downloadFilePath}`)
  params.on?.({
    name: 'download_artifact_done',
    artifact: artifactPointer,
    ...githubRepoAddress,
  })

  const outDir = absolutify(params.outDir ?? process.cwd(), process.cwd())
  const decompressFilePath = Path.join(
    outDir,
    `${artifactPointer.id}-${slugify(downloadFileName.replace(/.zip$/, ''), { lower: true })}`
  )

  params.on?.({
    name: 'decompressing_artifact_start',
    artifact: artifactPointer,
    path: decompressFilePath,
    ...githubRepoAddress,
  })
  await decompress(downloadFilePath, decompressFilePath, {
    // https://github.com/kevva/decompress/issues/68#issuecomment-767740992
    map: (file) => {
      if (file.type === 'file' && file.path.endsWith('/')) {
        file.type = 'directory'
      }
      return file
    },
  })

  d(`decompressed artifact to: ${decompressFilePath}`)
  params.on?.({
    name: 'decompressing_artifact_done',
    artifact: artifactPointer,
    path: decompressFilePath,
    ...githubRepoAddress,
  })
}

type GithubRepoAddress = {
  repo: string
  org: string
}

/**
 * Extract the github repo name and owner from the git config. If anything goes
 * wrong during extraction a specific error about it will be thrown.
 */
export async function parseGithubRepoInfoFromGitConfig(): Promise<GithubRepoAddress> {
  // Inspiration from how `$ hub pr show` works
  // https://github.com/github/hub/blob/a5fbf29be61a36b86c7f0ff9e9fd21090304c01f/commands/pr.go#L327

  const gitConfig = await parseGitConfig()
  if (gitConfig === null) {
    throw new Error('Could not parse your git config')
  }

  const gitOrigin = gitConfig['remote "origin"'] as undefined | Record<string, string>
  if (gitOrigin === undefined) {
    throw new Error('Could not find a configured origin in your git config')
  }

  const gitOriginURL = gitOrigin['url']
  if (gitOriginURL === undefined) {
    throw new Error('Could not find a URL in your remote origin config in your git config')
  }

  const githubRepoURL = parseGitHubURL(gitOriginURL)
  if (githubRepoURL === null) {
    throw new Error('Could not parse the URL in your remote origin config in your git config')
  }
  if (githubRepoURL.owner === null) {
    throw new Error(
      'Could not parse out the GitHub owner from the URL in your remote origin config in your git config'
    )
  }
  if (githubRepoURL.name === null) {
    throw new Error(
      'Could not parse out the GitHub repo name from the URL in your remote origin config in your git config'
    )
  }

  return {
    repo: githubRepoURL.name,
    org: githubRepoURL.owner,
  }
}
