import {
  AfterBemaCallback,
  AfterCaseCallback,
  AfterGroupCallback,
  BaseParameters,
  BeforeCaseCallback,
  BeforeCaseContext,
  ContextProviderHooks,
  ParameterName,
  Provider,
  RegisteredParameterChangeCallback,
  RunCallback,
} from '../types'
import { d } from '../utils'
import { ExpandedBema } from './expand'

export type PrimedBema = {
  groups: PrimedGroup[]
  afterCallbacks: AfterBemaCallback[]
}

export type PrimedGroup = {
  name: string
  afterCallbacks: AfterGroupCallback[]
  parameterChangeCallbacks: RegisteredParameterChangeCallback[]
  cases: PrimedCase[]
}

export type PrimedCase = {
  name: string
  matrixChain: BaseParameters[]
  providerStack: Provider[]
  parameterDefinitions: ParameterName[]
  parameters: BaseParameters
  parametersFromMatrix: BaseParameters
  parametersFromNotMatrix: BaseParameters
  beforeCallbacks: BeforeCaseCallback[]
  runCallback: null | RunCallback
  afterCallbacks: AfterCaseCallback[]
}

export function prime(bema: ExpandedBema): PrimedBema {
  d('starting priming')

  const primedGroups = bema.groups.map<PrimedGroup>((group) => {
    const cases: PrimedCase[] = []
    for (const globalPs of bema.providerStacks) {
      for (const groupPs of group.providerStacks) {
        for (const c of group.cases) {
          for (const casePs of c.providerStacks) {
            const matrixChain = [...globalPs.matrixChain, ...groupPs.matrixChain, ...casePs.matrixChain]
            const providerStack = [...globalPs.providers, ...groupPs.providers, ...casePs.providers]
            const parameters = providerStack.reduce(
              (parameters, p) => ({ ...parameters, ...p.parameters }),
              c.parameters
            )

            const parametersFromMatrix: Record<string, string> = Object.fromEntries(
              matrixChain.flatMap(Object.entries)
            )

            const parametersFromNotMatrix: Record<string, string> = Object.fromEntries(
              Object.entries(parameters).filter(([parameterName]) => {
                return parametersFromMatrix[parameterName] === undefined
              })
            )

            const name =
              Object.entries(parameters)
                .map((entry) => `${entry[0]}:${entry[1]}`)
                .join(' + ') || '<Anonymous>'
            cases.push({
              matrixChain,
              name,
              parameterDefinitions: [...bema.parameterDefinitions, ...group.parameterDefinitions],
              providerStack,
              parameters,
              parametersFromMatrix,
              parametersFromNotMatrix,
              beforeCallbacks: [...c.beforeCallbacks].reverse(), // todo beforeEach callbacks for group & bema
              runCallback: c.runCallback,
              afterCallbacks: [
                ...bema.afterEachCallbacks,
                ...group.afterEachCallbacks,
                ...c.afterCallbacks,
              ].reverse(),
            })
          }
        }
      }
    }

    return {
      name: group.name,
      afterCallbacks: group.afterCallbacks,
      parameterChangeCallbacks: [...bema.parameterChangeCallbacks, ...group.parameterChangeCallbacks],
      cases,
    }
  })

  const primedBema: PrimedBema = {
    afterCallbacks: bema.afterCallbacks,
    groups: primedGroups,
  }

  d('done priming')
  return primedBema
}

export function countCases(bema: PrimedBema): number {
  return bema.groups.reduce((n, g) => n + g.cases.length, 0)
}

export async function compileContext(c: PrimedCase): Promise<BeforeCaseContext> {
  const providerHooks: ContextProviderHooks = {
    before(callback) {
      c.beforeCallbacks.unshift(callback)
    },
    after(callback) {
      c.afterCallbacks.unshift(callback)
    },
  }

  let context: BeforeCaseContext = {
    $info: {
      parameters: c.parameters,
    },
  }

  for (const provider of c.providerStack) {
    const newContext = await provider(context, providerHooks)
    context =
      newContext !== undefined
        ? {
            ...newContext,
            // guarantee $info not overwritten
            $info: {
              parameters: c.parameters,
            },
          }
        : context
  }

  return context
}
