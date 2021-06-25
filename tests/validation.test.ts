import './__setup'
import { constant, noop } from 'lodash'
import { createProvider } from '../src'

test('throws error when no benchmarks defined', () => {
  expect(run(bema)).rejects.toMatchInlineSnapshot(`[UserError: [31mNo cases were defined.[39m]`)
})

test('throws error when a case is missing a runner', () => {
  bema.group('a').case()
  expect(run(bema)).rejects.toMatchInlineSnapshot(`[Error: No runner was defined for this benchmark case]`)
})

test.skip('throws an error when group filter does not match any groups', () => {
  bema.settings({ skipGroups: /z/ }).group('a').case().run(noop)
  expect(run(bema)).rejects.toMatchInlineSnapshot(
    `[LintError: [33mYour group filters did not match anything, this probably indicates an error on your part such as a typo.[39m]`
  )
})

test.skip('throws an error when one or more parameter filters have no effect', () => {
  const ga = bema
    .settings({ skipParameters: [{ value: /z/, name: /.*/ }] })
    .parameter('name')
    .group('a')
  ga.case({ name: 'a' }).run(noop)
  expect(run(bema)).rejects.toMatchInlineSnapshot(`
      [LintError: [33mYou have one or more parameter filters that did not exclude any cases. This probably indicates an error on your part such as a typo.
          → { name: null, value: /z/ }[39m]
    `)
})

test.skip('throws an error when a parameter is not argued by a provider/case', () => {
  const ga = bema.parameter('name').group('a')
  ga.case().run(noop)
  expect(run(bema)).rejects.toMatchInlineSnapshot(`
    [UserError: [1m[31m1 of your case(s) across 1 group(s) are missing required parameters.
    [39m[22m
    [4mSuite [1mroot[22m has 1 case(s) missing required parameters[24m

        Required parameters:
        → [1mname[22m [31m✖ 1 case(s) missing this[39m

        Cases missing one or more required parameters:
        → [1m<Anonymous>[22m is missing: [31mname[39m

    ]
  `)
})
test.skip('throws an error when param only-filter does not exclude any cases for param from matrix provider and case under group', () => {
  const p1 = createProvider({ parameters: { level1: 'pp1' }, provider: constant({ level1: 'cp1' }) })

  bema
    .settings({ onlyParameters: [{ value: /pp1/, name: /.*/ }] })
    .matrix(p1)
    .group('foo')
    .case()
    .run(f1)
  expect(run(bema)).rejects.toMatchInlineSnapshot(`
      [LintError: [33mYou have one or more parameter filters that did not exclude any cases. This probably indicates an error on your part such as a typo.
          → { name: null, value: /pp1/ }[39m]
    `)
})
