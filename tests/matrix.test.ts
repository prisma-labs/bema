import './__setup'
import { constant } from 'lodash'
import { createProvider } from '../src'

test('expands all cases below, each case receiving context and parameters given by the providers', async () => {
  const p1 = createProvider({ parameters: { level1: 'pp1' }, provider: constant({ level1: 'cp1' }) })
  const p2 = createProvider({ parameters: { level1: 'pp2' }, provider: constant({ level1: 'cp2' }) })
  let ga = bema.parameter('level1').parameter('c').matrix(p1, p2).group('a')
  ga.case({ c: '1' }).run(f1)
  await run(bema)
  expect(f1.mock.calls.length).toEqual(2)
  expect(f1.mock.calls[0][0]).toMatchObject({ level1: 'cp1' })
  expect(f1.mock.calls[1][0]).toMatchObject({ level1: 'cp2' })
  expect(f1.mock.calls[0][0]?.$info.parameters).toMatchObject({ level1: 'pp1', c: '1' })
  expect(f1.mock.calls[1][0]?.$info.parameters).toMatchObject({ level1: 'pp2', c: '1' })
})

test('nested matrixes expand one another and then all cases below, each case receiving parameters given by the providers', async () => {
  const p1 = createProvider({ parameters: { level1: 'pp1' }, provider: constant({ level1: 'cp1' }) })
  const p2 = createProvider({ parameters: { level1: 'pp2' }, provider: constant({ level1: 'cp2' }) })
  const p3 = createProvider({ parameters: { level2: 'pp3' }, provider: constant({ level2: 'cp3' }) })
  const p4 = createProvider({ parameters: { level2: 'pp4' }, provider: constant({ level2: 'cp4' }) })
  let ga = bema
    .parameter('level1')
    .parameter('level2')
    .parameter('c')
    .matrix(p1, p2)
    .matrix(p3, p4)
    .group('a')
  ga.case({ c: '1' }).run(f1)
  await run(bema)
  expect(f1.mock.calls.length).toEqual(4)
  expect(f1.mock.calls[0][0]).toMatchObject({ level1: 'cp1', level2: 'cp3' })
  expect(f1.mock.calls[1][0]).toMatchObject({ level1: 'cp1', level2: 'cp4' })
  expect(f1.mock.calls[2][0]).toMatchObject({ level1: 'cp2', level2: 'cp3' })
  expect(f1.mock.calls[3][0]).toMatchObject({ level1: 'cp2', level2: 'cp4' })
  expect(f1.mock.calls[0][0]?.$info.parameters).toMatchObject({ level1: 'pp1', level2: 'pp3', c: '1' })
  expect(f1.mock.calls[1][0]?.$info.parameters).toMatchObject({ level1: 'pp1', level2: 'pp4', c: '1' })
  expect(f1.mock.calls[2][0]?.$info.parameters).toMatchObject({ level1: 'pp2', level2: 'pp3', c: '1' })
  expect(f1.mock.calls[3][0]?.$info.parameters).toMatchObject({ level1: 'pp2', level2: 'pp4', c: '1' })
})

describe('context', () => {
  test('case can get context from provider from matrix', async () => {
    const p1 = createProvider({ parameters: { level1: 'pp1' }, provider: constant({ level1: 'cp1' }) })
    let ga = bema.parameter('level1').parameter('c').matrix(p1).group('a')
    ga.case({ c: '1' }).run(f1)
    await run(bema)
    expect(f1.mock.calls[0]).toMatchSnapshot()
  })
  test('case in group can get context from provider from matrix', async () => {
    const p1 = createProvider({ parameters: { level1: 'pp1' }, provider: constant({ level1: 'cp1' }) })
    let b = bema.parameter('level1').parameter('c').matrix(p1)
    b.group('foo').case({ c: '1' }).run(f1)
    await run(b)
    expect(f1.mock.calls[0]).toMatchSnapshot()
  })
})
