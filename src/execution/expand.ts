import debug from 'debug'
import { isEmpty } from 'lodash'
import { inspect } from 'util'
import { InternalBema } from '../declaration/bema'
import { InternalCase } from '../declaration/case'
import { InternalGroup } from '../declaration/group'
import { ProviderDeclaration } from '../declaration/helpers'
import {
  AfterBemaCallback,
  AfterCaseCallback,
  AfterGroupCallback,
  BaseParameters,
  BeforeCaseCallback,
  ParameterName,
  Provider,
  RegisteredParameterChangeCallback,
  RunCallback,
} from '../types'
import { assertCasesHandled, d } from '../utils'

type ExpandedProviderStack = {
  matrixChain: BaseParameters[]
  providers: Provider[]
}

export type ExpandedBema = {
  providerStacks: ExpandedProviderStack[]
  afterCallbacks: AfterBemaCallback[]
  afterEachCallbacks: AfterCaseCallback[]
  parameterDefinitions: ParameterName[]
  groups: ExpandedGroup[]
  parameterChangeCallbacks: RegisteredParameterChangeCallback[]
}

export type ExpandedGroup = {
  bema: ExpandedBema
  name: string
  providerStacks: ExpandedProviderStack[]
  afterCallbacks: AfterGroupCallback[]
  afterEachCallbacks: AfterCaseCallback[]
  parameterDefinitions: ParameterName[]
  parameterChangeCallbacks: RegisteredParameterChangeCallback[]
  cases: ExpandedCase[]
}

export type ExpandedCase = {
  group: ExpandedGroup
  providerStacks: ExpandedProviderStack[]
  parameters: BaseParameters
  beforeCallbacks: BeforeCaseCallback[]
  runCallback: null | RunCallback
  afterCallbacks: AfterCaseCallback[]
}

const myd = debug('bema:expansion')

export function expand(bema: InternalBema): ExpandedBema {
  d('starting')

  const { afterCallbacks, afterEachCallbacks, parameterChangeCallbacks, parameterDefinitions } = bema.$.state

  const expandedBema: ExpandedBema = {
    afterCallbacks,
    afterEachCallbacks,
    parameterChangeCallbacks,
    parameterDefinitions,
    providerStacks: expandDeclaredMatrixProviders(bema.$.state.providerStack, [], []),
    groups: [],
  }

  expandedBema.groups = bema.$.state.groups.map((group) => expandGroup(expandedBema, group))

  d('done')

  return expandedBema
}

function expandGroup(bema: ExpandedBema, group: InternalGroup): ExpandedGroup {
  const { afterCallbacks, afterEachCallbacks, name, parameterChangeCallbacks, parameterDefinitions } =
    group.$.state

  const expandedGroup: ExpandedGroup = {
    bema,
    afterCallbacks,
    afterEachCallbacks,
    name,
    parameterChangeCallbacks,
    providerStacks: expandDeclaredMatrixProviders(group.$.state.providerStack, [], []),
    parameterDefinitions,
    cases: [],
  }

  expandedGroup.cases = group.$.state.cases.map((c) => expandCase(expandedGroup, c))

  d(
    'cases of group "%s" expanded from %d to %d',
    name,
    group.$.state.cases.length,
    expandedGroup.cases.length
  )

  return expandedGroup
}

function expandCase(group: ExpandedGroup, c: InternalCase): ExpandedCase {
  const { afterCallbacks, beforeCallbacks, parameters, runCallback } = c.$.state

  const expandedCase: ExpandedCase = {
    afterCallbacks,
    beforeCallbacks,
    group,
    parameters,
    runCallback,
    providerStacks: expandDeclaredMatrixProviders(c.$.state.providerStack, [], []),
  }

  return expandedCase
}

function expandDeclaredMatrixProviders(
  declaredStack: ProviderDeclaration[],
  currentStack: Provider[],
  currentMatrixChain: BaseParameters[]
): ExpandedProviderStack[] {
  myd('expanding declared stack %s with current stack %s', inspect(declaredStack), inspect(currentStack))

  const expandedStacks: ExpandedProviderStack[] = []
  const _currentStack = [...currentStack]
  const _currentMatrixChain = [...currentMatrixChain]

  let i = -1
  for (const declared of declaredStack) {
    i++

    if (declared.kind === 'single') {
      _currentStack.push(declared.provider)
      continue
    }

    if (declared.kind === 'matrix') {
      myd('expanding matrix of size %d', declared.providers.length)

      const nestedExpandedStacks = declared.providers.flatMap((p) => {
        return expandDeclaredMatrixProviders(
          declaredStack.slice(i + 1),
          [p, ..._currentStack],
          [p.parameters ?? {}, ..._currentMatrixChain]
        )
      })

      expandedStacks.push(...nestedExpandedStacks)

      // When a matrix is hit it forks. We want to stop moving "horizontally" and instead
      // move once "vertically" down, continuing the processing _for each matrix member_
      break
    }

    assertCasesHandled(declared)
  }

  const resultStacks = isEmpty(expandedStacks)
    ? [
        {
          matrixChain: _currentMatrixChain,
          providers: _currentStack,
        },
      ]
    : expandedStacks

  d('finished with resulting stacks: %s', inspect(resultStacks))

  return resultStacks
}
