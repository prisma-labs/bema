import './__setup'
import { noop } from 'lodash'
import { stripKeys } from './__helpers'

test('can define a case', async () => {
  bema.group('a').case().run(f1)
  await run(bema)
  expect(f1.mock.calls.length).toBeGreaterThan(0)
})

test('can define cases in groups', async () => {
  const bema2 = bema.parameter('name')
  const ga = bema2.group('a')
  ga.case({ name: '1' }).run(noop)
  ga.case({ name: '2' }).run(noop)
  const gb = bema2.group('b')
  gb.case({ name: '3' }).run(noop)
  gb.case({ name: '4' }).run(noop)
  const report = await run(bema)
  expect(stripKeys(['stats', 'time'], report.groups)).toMatchSnapshot()
})

test('afterEach is called after each case', async () => {
  let ga = bema.afterEach(f1).parameter('name').group('a')
  ga.case({ name: '1' }).run(noop)
  ga.case({ name: '2' }).run(noop)
  ga.case({ name: '3' }).run(noop)
  await run(bema)
  expect(f1.mock.calls.length).toEqual(3)
})
