import createDebug from 'debug'
import * as Path from 'path'
import { inspect } from 'util'

export const d = createDebug('bema')

export type MaybePromise<T> = T | Promise<T>

export type AdditionalPrismaStatsSamples = {
  prismaClientRaw: {
    engine: {
      timings: number[]
    }
  }
  prismaClient: {
    engine: {
      timings: number[]
    }
  }
}

export type AdditionalPrismaStats = {
  prismaClientRaw: {
    engine: {
      mean: number
      standardDeviation: number
    }
  }
  prismaClient: {
    engine: {
      mean: number
      standardDeviation: number
    }
  }
}

export function processPattern(pattern: string | RegExp): RegExp {
  return pattern instanceof RegExp ? pattern : new RegExp(`^${pattern}$`, 'i')
}

/** Exit with the given code and message. */
export function fatal(exitCode: number, message: string | Error): never
/** Exit with code 1 and the given message. */
export function fatal(message: string | Error): never
export function fatal(...args: [number, string | Error] | [string | Error]): never {
  let message
  let exitCode

  if (typeof args[0] === 'number') {
    exitCode = args[0]
    message = args[1]
  } else {
    exitCode = 1
    message = args[0]
  }

  console.error(message)
  process.exit(exitCode)
}

export function makeRelativePathExplicitlyRelative(path: string): string {
  if (Path.isAbsolute(path)) return path
  if (path.startsWith('./')) return path
  return `./${path}`
}

export function addExtensionIfNone(ext: string, path: string): string {
  if (/\.[^.]+$/.exec(path)) return path

  return path + '.' + ext.replace(/^\./, '')
}

//eslint-disable-next-line
export function arrayify<T = any>(
  x: T
  //eslint-disable-next-line
): Exclude<T, undefined> extends Array<any> ? Exclude<T, undefined> : Exclude<T, undefined>[] {
  // @ts-expect-error not sure
  if (Array.isArray(x)) return x
  // @ts-expect-error not sure
  if (x === undefined) return []
  // @ts-expect-error not sure
  return [x]
}

export type KeyNameToObjectWithKey<N extends string, T> = {
  [K in N as `${K}`]: T
}

export type OptionalKeys<T> = {
  [K in keyof T]?: T[K]
}

export function millisecondsToSeconds(n: number): number {
  return n / 1000
}

export function dump(...xs: unknown[]): void {
  console.log(...xs.map((x) => inspect(x, { depth: 20 })))
}

// TODO can this become Record<string, never>?
// eslint-disable-next-line
export type StringKeyOfOrString<T> = {} extends T ? string : Exclude<keyof T, number | symbol>

export function assertCasesHandled(x: never): void {
  throw new Error(`Unhandled casee: ${inspect(x)}`)
}
