/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { merge } from 'lodash'
import { validateContextData } from '../execution/validate'
import {
  AfterBemaCallback,
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
import { KeyNameToObjectWithKey, MaybePromise, StringKeyOfOrString } from '../utils'
import * as Config from './config'
import * as Group from './group'
import { matrixProviders, ProviderDeclaration, singleProvider } from './helpers'

type State = {
  configInput: Config.Input
  providerStack: ProviderDeclaration[]
  afterCallbacks: AfterBemaCallback[]
  afterEachCallbacks: AfterCaseCallback[]
  parameterDefinitions: ParameterName[]
  groups: Group.InternalGroup[]
  parameterChangeCallbacks: RegisteredParameterChangeCallback[]
}

export type Bema<C extends BaseContext = BaseContext, P extends BaseParameters = BaseParameters> = {
  matrix<C2 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>
  ): Bema<C2, P>
  matrix<C2 extends BaseContext, C3 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>,
    provider2: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C3>
  ): Bema<C2 | C3, P>
  matrix<C2 extends BaseContext, C3 extends BaseContext, C4 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>,
    provider2: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C3>,
    provider3: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C4>
  ): Bema<C2 | C3 | C4, P>
  matrix<C2 extends BaseContext, C3 extends BaseContext, C4 extends BaseContext, C5 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>,
    provider2: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C3>,
    provider3: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C4>,
    provider4: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C5>
  ): Bema<C2 | C3 | C4 | C5, P>
  // prettier-ignore
  matrix<C2 extends BaseContext, C3 extends BaseContext, C4 extends BaseContext, C5 extends BaseContext, C6 extends BaseContext>(
    provider1: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>,
    provider2: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C3>,
    provider3: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C4>,
    provider4: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C5>,
    provider5: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C6>
 ): Bema<C2 | C3 | C4 | C5 | C6, P>

  // beforeEach(...):Group //todo

  // beforeAll(...):Group //todo

  afterEach(callback: AfterCaseCallback<C, P>): Bema<C, P>

  // todo enforce that group name matches: /[A-Za-z0-9_-/
  group(name: string): Group.Group<C, P>

  afterAll(callback: AfterGroupCallback<C, P>): Bema<C, P>

  parameter<N extends string>(name: N): Bema<C, P & KeyNameToObjectWithKey<N, string>>

  onParameterChange<ParameterName extends StringKeyOfOrString<P>>(
    // ParameterName could be any one defined anywhere in the bema tree. So autocomplete here
    // is only nice-to-have, for parameters upstream. We still need to support any string so
    // user can match on parameters that are from downstream. Not fixable without typegen :(
    //
    // Hack to allow any string without losing intellisense: https://github.com/microsoft/TypeScript/issues/29729#issuecomment-661959682
    parameterName: ParameterName | (string & {}),
    callback: ParameterChangeCallback<ParameterName>
  ): Bema<C, P>

  useData<T extends BaseContext>(data: T): Bema<C & T, P>

  use<C2 extends BaseContext>(
    provider: (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>) => MaybePromise<void | C2>
  ): Bema<ProviderReturnType<C2, C>, P>

  settings(input: Config.Input): Bema<C, P>
}

export type InternalBema<
  C extends BaseContext = BaseContext,
  P extends BaseParameters = BaseParameters
> = Bema<C, P> & {
  $: {
    state: State
  }
}

export function create(): Bema {
  const state = createState()
  const internalBema = createInternal(state)
  return internalBema
}

export function createInternal(state: State): InternalBema {
  const self: InternalBema = {
    matrix(...providers: Provider[]) {
      state.providerStack.push(matrixProviders(providers))
      return self
    },
    useData(data) {
      validateContextData({ data, invalid: `data passed to useData()` })
      return self.use((ctx) => ({ ...ctx, ...data })) as any
    },
    use(provider) {
      state.providerStack.push(singleProvider(provider))
      return self as any
    },
    parameter(name) {
      state.parameterDefinitions.push(name)
      return self as any
    },
    onParameterChange(parameterName, callback) {
      state.parameterChangeCallbacks.push({
        parameterName,
        callback: callback as any,
      })
      return self
    },
    group(name) {
      const newGroup = Group.create({ name, bema: self })
      state.groups.push(newGroup as any)
      return newGroup
    },

    afterEach(callback) {
      state.afterEachCallbacks.push(callback)
      return self
    },
    afterAll(callback) {
      state.afterCallbacks.push(callback)
      return self
    },
    settings(newConfigInput) {
      merge(state.configInput, newConfigInput)
      return self
    },
    $: {
      state: state,
    },
  }

  return self
}

export function createState(): State {
  return {
    configInput: {},
    groups: [],
    afterCallbacks: [],
    parameterChangeCallbacks: [],
    providerStack: [],
    afterEachCallbacks: [],
    parameterDefinitions: [],
  }
}
