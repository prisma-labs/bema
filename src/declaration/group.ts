import { validateContextData } from '../execution/validate'
import {
  AfterCaseCallback,
  AfterGroupCallback,
  BaseContext,
  BaseParameters,
  BeforeCaseContext,
  ContextProviderHooks,
  ParameterChangeCallback,
  ParameterName,
  Provider,
  ProviderReturnType,
  RegisteredParameterChangeCallback,
} from '../types'
import { KeyNameToObjectWithKey, MaybePromise, OptionalKeys, StringKeyOfOrString } from '../utils'
import { InternalBema } from './bema'
import { CaseFollowingCreate, createCase, InternalCase } from './case'
import { matrixProviders, ProviderDeclaration, singleProvider } from './helpers'

export type Group<C extends BaseContext = BaseContext, P extends BaseParameters = BaseParameters> = {
  matrix<C2 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>
  ): Group<C2, P>
  matrix<C2 extends BaseContext, C3 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>,
    provider2: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C3>
  ): Group<C2 | C3, P>
  matrix<C2 extends BaseContext, C3 extends BaseContext, C4 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>,
    provider2: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C3>,
    provider3: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C4>
  ): Group<C2 | C3 | C4, P>
  matrix<C2 extends BaseContext, C3 extends BaseContext, C4 extends BaseContext, C5 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>,
    provider2: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C3>,
    provider3: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C4>,
    provider4: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C5>
  ): Group<C2 | C3 | C4 | C5, P>
  // prettier-ignore
  matrix<C2 extends BaseContext, C3 extends BaseContext, C4 extends BaseContext, C5 extends BaseContext, C6 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>,
    provider2: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C3>,
    provider3: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C4>,
    provider4: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C5>,
    provider5: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C6>
 ): Group<C2 | C3 | C4 | C5 | C6, P>

  /**
   * Declare a case.
   *
   * @param parameterValues  Values for one or more of the declared parameters. These take precedence over
   *                         parameter values from any providers being used.
   */
  case(
    ...args: Record<string, never> extends P ? [] : [] | [parameterValues: OptionalKeys<P>]
  ): CaseFollowingCreate<C, P>

  // beforeEach(...):Group //todo

  // beforeAll(...):Group //todo

  afterEach(callback: AfterCaseCallback<C, P>): Group<C, P>

  afterAll(callback: AfterGroupCallback<C, P>): Group<C, P>

  parameter<N extends string>(name: N): Group<C, P & KeyNameToObjectWithKey<N, string>>

  onParameterChange<ParameterName extends StringKeyOfOrString<P>>(
    // ParameterName could be any one defined anywhere in the bema tree. So autocomplete here
    // is only nice-to-have, for parameters upstream. We still need to support any string so
    // user can match on parameters that are from downstream. Not fixable without typegen :(
    //
    // Hack to allow any string without losing intellisense: https://github.com/microsoft/TypeScript/issues/29729#issuecomment-661959682
    // eslint-disable-next-line
    parameterName: ParameterName | (string & {}),
    callback: ParameterChangeCallback<ParameterName>
  ): Group<C, P>

  useData<T extends BaseContext>(data: T): Group<C & T, P>

  use<C2 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>
  ): Group<ProviderReturnType<C2, C>, P>
}

export type InternalGroup = Group & {
  $: {
    state: State
  }
}

export function create(params: { name: string; bema: InternalBema }): Group {
  return createInternal(createState(params))
}

/** Create a new group. Groups can hold multiple cases and other groups. */
export function createInternal(state: State): InternalGroup {
  const self: InternalGroup = {
    $: {
      state,
    },
    matrix(...providers: Provider[]) {
      self.$.state.providerStack.push(matrixProviders(providers))
      return self
    },
    // @ts-expect-error internal
    useData(data) {
      validateContextData({ data, invalid: `data passed to useData()` })
      return self.use((ctx) => ({ ...ctx, ...data }))
    },
    // @ts-expect-error internal
    use(provider) {
      self.$.state.providerStack.push(singleProvider(provider))
      return self
    },
    // @ts-expect-error internal
    parameter(name) {
      self.$.state.parameterDefinitions.push(name)
      return self
    },
    onParameterChange(parameterName, callback) {
      self.$.state.parameterChangeCallbacks.push({
        parameterName,
        // @ts-expect-error internal
        callback: callback,
      })
      return self
    },
    case(parameters = {}) {
      const c = createCase({ group: self, parameters })
      // @ts-expect-error internal
      self.$.state.cases.push(c)
      return c
    },
    afterEach(callback) {
      self.$.state.afterEachCallbacks.push(callback)
      return self
    },
    afterAll(callback) {
      self.$.state.afterCallbacks.push(callback)
      return self
    },
  }

  return self
}

type State = {
  name: string
  bema: InternalBema
  cases: InternalCase[]
  providerStack: ProviderDeclaration[]
  afterCallbacks: AfterGroupCallback[]
  afterEachCallbacks: AfterCaseCallback[]
  parameterDefinitions: ParameterName[]
  parameterChangeCallbacks: RegisteredParameterChangeCallback[]
}

function createState({ name, bema }: { name: string; bema: InternalBema }): State {
  return {
    name,
    bema,
    parameterChangeCallbacks: [],
    afterCallbacks: [],
    providerStack: [],
    afterEachCallbacks: [],
    parameterDefinitions: [],
    cases: [],
  }
}
