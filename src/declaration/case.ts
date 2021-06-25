/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  AfterCaseCallback,
  BaseContext,
  BaseParameters,
  BeforeCaseCallback,
  BeforeCaseContext,
  ContextProviderHooks,
  Provider,
  ProviderReturnType,
  RunCallback,
} from '../types'
import { MaybePromise } from '../utils'
import { InternalGroup } from './group'
import { matrixProviders, ProviderDeclaration, singleProvider } from './helpers'

/*

NOTE

As of TS 4.1 it is not possible to have type parameter that are  passed through to
another generic be inferred by return type inference within that generic on the
outer level where the type parameter originally came from.

In other words we cannot do this:

matrix<C2 extends BaseContext>(
  provider1: Provider<C, P, C2>
): CaseFollowingCreate<C2, P>


But instead must do this:

matrix<C2 extends BaseContext>(
  provider1: (context: C, on: ContextProviderHooks) => MaybePromise<void | C2>
): CaseFollowingCreate<C2, P>

In order to achieve that C2 is inferred by the return type of func passed to `provider1` param.

This TS limitation affects:

1) .matrix
2) .use

*/

/**
 * The methods available after creating a new case.
 *
 * Note some methods are only available later. For example after hook is chainable only on the run method.
 */
export type CaseFollowingCreate<
  C extends BaseContext = BaseContext,
  P extends BaseParameters = BaseParameters
> = {
  matrix<C2 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>
  ): CaseFollowingCreate<C2, P>
  matrix<C2 extends BaseContext, C3 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>,
    provider2: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C3>
  ): CaseFollowingCreate<C2 | C3, P>
  matrix<C2 extends BaseContext, C3 extends BaseContext, C4 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>,
    provider2: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C3>,
    provider3: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C4>
  ): CaseFollowingCreate<C2 | C3 | C4, P>
  matrix<C2 extends BaseContext, C3 extends BaseContext, C4 extends BaseContext, C5 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>,
    provider2: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C3>,
    provider3: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C4>,
    provider4: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C5>
  ): CaseFollowingCreate<C2 | C3 | C4 | C5, P>
  // prettier-ignore
  matrix<C2 extends BaseContext, C3 extends BaseContext, C4 extends BaseContext, C5 extends BaseContext, C6 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>,
    provider2: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C3>,
    provider3: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C4>,
    provider4: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C5>,
    provider5: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C6>
  ): CaseFollowingCreate<C2 | C3 | C4 | C5 | C6, P>

  use<C2 extends BaseContext>(
    provider: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>
  ): CaseFollowingCreate<ProviderReturnType<C2, C>, P>

  before<C2 extends BaseContext>(
    callback: BeforeCaseCallback<C, P>
  ): CaseFollowingBefore<ProviderReturnType<C2, C>, P>

  run<ReturnedValue>(runner: RunCallback<C, P, ReturnedValue>): CaseFollowingtRun<C, P, ReturnedValue>
}

type CaseFollowingBefore<C extends BaseContext = BaseContext, P extends BaseParameters = BaseParameters> = {
  run: CaseFollowingCreate<C, P>['run']
}

type CaseFollowingtRun<
  C extends BaseContext = BaseContext,
  P extends BaseParameters = BaseParameters,
  ReturnedValue = unknown
> = {
  after(callback: AfterCaseCallback<C, P, ReturnedValue>): void
}

export function createCase(params: {
  group: InternalGroup
  parameters: BaseParameters
}): CaseFollowingCreate {
  return createCaseInternal(createState(params))
}

export type InternalCase = CaseFollowingCreate &
  CaseFollowingBefore &
  CaseFollowingtRun & {
    $: {
      state: State
    }
  }

export function createCaseInternal(state: State): InternalCase {
  const self: InternalCase = {
    $: {
      state,
    },
    matrix(...providers: Provider[]) {
      self.$.state.providerStack.push(matrixProviders(providers))
      return self
    },
    use(provider) {
      self.$.state.providerStack.push(singleProvider(provider))
      return self as any
    },
    before(callback) {
      self.$.state.beforeCallbacks.push(callback)
      return self as any
    },
    run(callback: RunCallback) {
      self.$.state.runCallback = callback
      return self as any
    },
    after(callback) {
      self.$.state.afterCallbacks.push(callback)
    },
  }

  return self
}

type State = {
  group: InternalGroup
  parameters: BaseParameters
  providerStack: ProviderDeclaration[]
  beforeCallbacks: BeforeCaseCallback[]
  runCallback: null | RunCallback
  afterCallbacks: AfterCaseCallback[]
}

function createState({ group, parameters }: { group: InternalGroup; parameters: BaseParameters }): State {
  return {
    group,
    parameters,
    runCallback: null,
    providerStack: [],
    beforeCallbacks: [],
    afterCallbacks: [],
  }
}
