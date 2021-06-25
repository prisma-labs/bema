import { create } from '../src'
import { InternalBema } from '../src/declaration/bema'
import * as Run from '../src/execution/run'

declare global {
  export const run: typeof Run.run
  export const bema: InternalBema
  export const f1: jest.Mock
  export const f2: jest.Mock
  export const f3: jest.Mock
  export const f4: jest.Mock
}

beforeEach(() => {
  const g = global as any
  g.run = Run.run
  g.f1 = jest.fn()
  g.f2 = jest.fn()
  g.f3 = jest.fn()
  g.f4 = jest.fn()
  g.bema = create().settings({
    quick: true,
    outDir: null,
    logger: {
      info() {},
      error() {},
    },
  })
})
