import BenchmarkJS from 'benchmark'
import { PrimedCase } from './execution/prime'
import { MaybePromise } from './utils'

/**
 * Summary data about a Bema run, all the groups, cases, etc..
 */
export type Report = {
  name: string
  time: TimeStats
  groups: GroupResultSimplified[]
}

export type ParameterName = string

export type BaseParameters = Record<ParameterName, string>

export type BaseContext = Record<string, unknown>

/** The context type in return postition. This forbids explicitly returning undefined. */
export type BaseContextReturnType<Returns extends BaseContext = BaseContext> = MaybePromise<void | Returns>

export type Provider<
  C extends BaseContext = BaseContext,
  P extends BaseParameters = BaseParameters,
  Returns extends BaseContext = BaseContext
> = {
  (context: BeforeCaseContext<C, P>, on: ContextProviderHooks<C, P>): BaseContextReturnType<Returns>
  parameters?: P
}

export type ContextProviderHooks<
  C extends BaseContext = BaseContext,
  P extends BaseParameters = BaseParameters
> = {
  /** Register a function to be run before the benchmark test is started. */
  before(callback: BeforeCaseCallback<C, P>): void
  /** Register a function to be run after the benchmark test has finished. */
  after(callback: AfterCaseCallback<C, P>): void
}

export type BeforeCaseCallback<
  C extends BaseContext = BaseContext,
  P extends BaseParameters = BaseParameters
> = (context: BeforeCaseContext<C, P>) => MaybePromise<void>

export type BeforeCaseContext<
  C extends BaseContext = BaseContext,
  P extends BaseParameters = BaseParameters
> = C & {
  $info: {
    parameters: P
  }
}

export type AfterCaseCallback<
  C extends BaseContext = BaseContext,
  P extends BaseParameters = BaseParameters,
  ReturnedValue = unknown
> = (context: AfterCaseContext<C, P, ReturnedValue>) => MaybePromise<void>

export type AfterCaseContext<
  C extends BaseContext = Record<string, never>,
  P extends BaseParameters = Record<string, never>,
  ReturnValue = unknown
> = C & {
  $info: CaseResult<P, ReturnValue>
}

export type CaseResult<P extends BaseParameters = BaseParameters, ReturnValue = unknown> = {
  /** Metadata about the case and stats about how it performed */
  report: CaseReport<P>
  /** The value returned by the last sample run. */
  returnValue?: ReturnValue
}

export type AfterGroupCallback<
  C extends BaseContext = BaseContext,
  P extends BaseParameters = BaseParameters
  // ReturnedValue = unknown
> = (context: AfterGroupContext<C, P>) => MaybePromise<void>

export type AfterGroupContext<
  C extends BaseContext = BaseContext,
  // TODO remove?
  _P extends BaseParameters = BaseParameters
> = C & {
  $info: GroupResult
}

export type CaseResultWithGroupStats = CaseResult & CaseReportGroupStats

type CaseReportGroupStats = {
  report: {
    stats: {
      /**
       * How much slower was this case than its peers in the group.
       *
       * Note that this value is scoped to the _matrix_ group it was run in.
       */
      percentSlower: number
    }
  }
}

export type CaseResultSimplifiedWithGroupStats = Omit<CaseResult, 'returnValue'> & CaseReportGroupStats

export type GroupResultSimplified = {
  /** Name of group. */
  name: string
  time: TimeStats
  caseResultsByMatrix: CaseResultSimplifiedWithGroupStats[][]
}

export type GroupResult = {
  /** Name of group. */
  name: string
  cases: PrimedCase[]
  casesSelected: PrimedCase[]
  caseResults: {
    byMatrix: Record<string, CaseResultWithGroupStats[]>
    all: CaseResultWithGroupStats[]
  }
  time: TimeStats
}

export type AfterBemaCallback<
  C extends BaseContext = BaseContext,
  P extends BaseParameters = BaseParameters
  // ReturnedValue = unknown
> = (context: AfterGroupContext<C, P>) => MaybePromise<void>

export type AfterBemaContext<
  C extends BaseContext = BaseContext,
  // TODO remove?
  _P extends BaseParameters = BaseParameters
> = C & {
  $info: BemaResult
}

export type BemaResult = {
  groupResults: GroupResult[]
}

export type ProviderReturnType<T, Passthrough> = T extends void
  ? Passthrough
  : Awaited<T> extends void
  ? Passthrough
  : T

export type CaseReport<P extends BaseParameters = BaseParameters> = {
  /**
   * Was the benchmark run in quick mode? If so this report is not statistically significant.
   */
  quickMode: boolean
  /** The name of the group that contained this benchmark. */
  group: string
  /** The name of this benchmark. */
  name: string
  /**
   * The matrix permutation under which this case was run.
   */
  matrix: BaseParameters[]
  /** The parameters this benchmark ran with */
  parameters: P
  parametersFromMatrix: BaseParameters
  parametersFromNotMatrix: BaseParameters
  /** That statistical results of how this benchmark performed. */
  stats: BenchmarkJS.Stats & {
    /** The arithmetic mean (aka. average) in milliseconds taken to run a sample. */
    mean: number
    /** On average how many times a bunchmark sample can run within one second. */
    hz: number
    /** The sample standard deviation in milliseconds */
    deviation: number
    /** The margin of error. */
    moe: number
    /** The relative margin of error (expressed as a percentage of the mean). */
    rme: number
    /** The standard error of the mean. */
    sem: number
    /** The sampled periods. */
    sample: number[]
    /** An object of timing data including cycle, elapsed, period, start, and stop. */
    times: BenchmarkJS.Times & {
      /** A timestamp of when the benchmark started (ms). */
      timeStamp: number
      /** The time taken to complete the benchmark (secs). */
      elapsed: number
      /** The time taken to execute the test once (secs). */
      period: number
      /** The time taken to complete the last cycle (secs). */
      cycle: number
    }
  }
}

export type ParameterChangeCallbackInfo = {
  activeCases: {
    parameters: Record<string, string>
  }[]
}

export type RegisteredParameterChangeCallback = {
  parameterName: string
  callback: ParameterChangeCallback
}

export type ParameterChangeCallback<ParameterName extends string = string> = (
  event: {
    name: ParameterName
    initial: boolean
    value: {
      before?: string
      after?: string
    }
  },
  info: ParameterChangeCallbackInfo
) => MaybePromise<void>

export type RunCallback<
  C extends BaseContext = BaseContext,
  P extends BaseParameters = BaseParameters,
  Returns = unknown
> = (context: BeforeCaseContext<C, P>) => MaybePromise<Returns>

export type TimeStats = {
  started: number
  finished: number
  /**
   * How long the entire section took to run in seconds.
   */
  elapsed: number
}

export type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T
