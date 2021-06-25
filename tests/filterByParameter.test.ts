import './__setup'

describe('parameter only filters on value', () => {
  test('only-parameter filters skips a case with no matching parameters', async () => {
    bema
      .settings({ onlyParameters: [':2'] })
      .parameter('p1')
      .group('a')
      .case({ p1: '1' })
      .run(f1)
    await run(bema)
    expect(f1.mock.calls.length).toEqual(0)
  })

  test('multiple only-parameter filters skips a case with one matching among multiple parameters', async () => {
    bema
      .settings({ onlyParameters: [':2', ':1'] })
      .parameter('p1')
      .group('a')
      .case({ p1: '1' })
      .run(f1)
    await run(bema)
    expect(f1.mock.calls.length).toEqual(0)
  })
  test('multiple only-parameter filters keeps a case with multiple matching among multiple parameters', async () => {
    bema
      .settings({ onlyParameters: [':1', ':2'] })
      .parameter('p1')
      .parameter('p2')
      .group('a')
      .case({ p1: '1', p2: '2' })
      .run(f1)
    await run(bema)
    expect(f1.mock.calls.length).toEqual(1)
  })
})

describe('parameter skip filters on value', () => {
  test('skip-parameter filter does not skip a case with no matching parameter', async () => {
    bema
      .settings({ skipParameters: [':2'] })
      .parameter('p1')
      .group('a')
      .case({ p1: '1' })
      .run(f1)
    await run(bema)
    expect(f1.mock.calls.length).toEqual(1)
  })
  test('skip-parameter filter skips a case with a matching parameter', async () => {
    bema
      .settings({ skipParameters: [':1'] })
      .parameter('p1')
      .group('a')
      .case({ p1: '1' })
      .run(f1)
    await run(bema)
    expect(f1.mock.calls.length).toEqual(0)
  })
  test('multiple skip-parameter filters skips a case with one matching among multiple parameters', async () => {
    bema
      .settings({ skipParameters: [':1', { value: /3/ }] })
      .parameter('p1')
      .parameter('p2')
      .group('a')
      .case({ p1: '1', p2: '2' })
      .run(f1)
    await run(bema)
    expect(f1.mock.calls.length).toEqual(0)
  })
  test('multiple skip-parameter filters skips a case with multiple matching among multiple parameters', async () => {
    bema
      .settings({ skipParameters: [':1', ':2'] })
      .parameter('p1')
      .parameter('p2')
      .group('a')
      .case({ p1: '1', p2: '2' })
      .run(f1)
    await run(bema)
    expect(f1.mock.calls.length).toEqual(0)
  })
})

describe('combined skip & only parameter filters', () => {
  test('only-parameter + skip-parameter filters skips a case with no matching only and matching skip parameters', async () => {
    bema
      .settings({ onlyParameters: [{ value: /3/ }], skipParameters: [':1'] })
      .parameter('p1')
      .group('a')
      .case({ p1: '1' })
      .run(f1)
    await run(bema)
    expect(f1.mock.calls.length).toEqual(0)
  })
  test('only-parameter + skip-parameter filters skips a case with no matching only and no matching skip parameters', async () => {
    bema
      .settings({ onlyParameters: [{ value: /3/ }], skipParameters: [{ value: /3/ }] })
      .parameter('p1')
      .parameter('p2')
      .group('a')
      .case({ p1: '1', p2: '2' })
      .run(f1)
    await run(bema)
    expect(f1.mock.calls.length).toEqual(0)
  })
  test('only-parameter + skip-parameter filters skips a case with matching only and matching skip parameters', async () => {
    bema
      .settings({ onlyParameters: [':1'], skipParameters: [':1'] })
      .parameter('p1')
      .group('a')
      .case({ p1: '1' })
      .run(f1)
    await run(bema)
    expect(f1.mock.calls.length).toEqual(0)
  })
  test('only-parameter + skip-parameter filters keeps a case with matching only and no matching skip parameters', async () => {
    bema
      .settings({ onlyParameters: [':1'], skipParameters: [':2'] })
      .parameter('p1')
      .group('a')
      .case({ p1: '1' })
      .run(f1)
    await run(bema)
    expect(f1.mock.calls.length).toEqual(1)
  })
})

test('throws an error if all tests are filtered out', () => {
  const b = bema.settings({ skipParameters: [':1'], strictMode: true }).parameter('p1')
  b.group('a').case({ p1: '1' })
  expect(run(bema)).rejects.toMatchSnapshot()
})
