import './__setup'
import { noop } from 'lodash'
import { stripKeys } from './__helpers'

describe('afterAll', () => {
  test.todo('receives provider context from the group+ancestors but not other branches or downstrema')
  test('afterAll is called once after all cases in group have run', async () => {
    let ga = bema.parameter('name').group('a').afterAll(f1)
    ga.case({ name: '1' }).run(noop)
    ga.case({ name: '2' }).run(noop)
    ga.case({ name: '3' }).run(noop)
    await run(bema)
    expect(f1.mock.calls.length).toEqual(1)
    expect(f1.mock.calls[0].length).toEqual(1)
    expect(stripKeys(['stats', 'time'], f1.mock.calls[0][0])).toMatchSnapshot()
  })
})

describe('afterEach', () => {
  test('is called after each case', async () => {
    const ga = bema.group('a').afterEach(f1)
    ga.case().run(noop)
    ga.case().run(noop)
    ga.case().run(noop)
    await run(bema)
    expect(f1.mock.calls.length).toEqual(3)
  })
})
