import './__setup'
import { constant, noop } from 'lodash'
import { stripKey } from './__helpers'

describe('validation', () => {
  test.skip('If receives unknown parameters then an error is thrown', () => {
    const b = bema as any
    b.case({ name: '1' }).run(noop)
    expect(run(b)).rejects.toMatchInlineSnapshot(
      `"Invalid parameter values given. The following parameter types do not exist: name. There are no parameters types defined."`
    )
  })
})

test('before is called once before the case. It receives contextual data.', async () => {
  const ga = bema.group('a')
  ga.case().run(constant(1)).after(f1)
  ga.case().run(constant(2)).after(f1)
  ga.case().run(constant(3)).after(f1)
  await run(bema)
  expect(f1.mock.calls.length).toEqual(3)
  expect(stripKey('stats', f1.mock.calls)).toMatchSnapshot()
})

test('after is called once after the case. It receives info about return value and result report.', async () => {
  const ga = bema.group('a')
  ga.case().run(constant(1)).after(f1)
  ga.case().run(constant(2)).after(f1)
  ga.case().run(constant(3)).after(f1)
  await run(bema)
  expect(f1.mock.calls.length).toEqual(3)
  expect(stripKey('stats', f1.mock.calls)).toMatchSnapshot()
})
