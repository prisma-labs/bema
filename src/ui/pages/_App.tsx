import { NextComponentType } from 'next'

type AppInput = {
  Component: NextComponentType
  // eslint-disable-next-line
  pageProps: any
}

export default function App({ Component, pageProps }: AppInput): JSX.Element {
  return <Component {...pageProps} />
}
