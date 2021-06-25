import { Provider } from '../types'

export type ProviderDeclaration = MatrixProvidersDeclaration | SingleProviderDeclaration

export type MatrixProvidersDeclaration = {
  kind: 'matrix'
  providers: Provider[]
}

export type SingleProviderDeclaration = {
  kind: 'single'
  provider: Provider
}

export function matrixProviders(providers: Provider[]): MatrixProvidersDeclaration {
  return {
    kind: 'matrix',
    providers,
  }
}

export function singleProvider(provider: Provider): SingleProviderDeclaration {
  return {
    kind: 'single',
    provider,
  }
}
