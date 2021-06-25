import * as FS from 'fs-jetpack'
import { FC } from 'react'
import { Report } from '../../types'
import { Overview } from '../components/Overview'

type Props = {
  reports: Report[]
}

export async function getServerSideProps(): Promise<{ props: Props }> {
  const reportPathsEnVarData = process.env.BEMA_REPORT_PATHS

  if (!reportPathsEnVarData) {
    throw new Error(`Missing process.env.BEMA_REPORT_PATHS`)
  }

  const reportPaths = JSON.parse(reportPathsEnVarData) as string[]
  const reports = await Promise.all(reportPaths.map((path) => FS.readAsync(path, 'json')))

  return {
    props: {
      reports,
    },
  }
}

const Page: FC<Props> = ({ reports }) => {
  return <Overview reports={reports} />
}

export default Page
