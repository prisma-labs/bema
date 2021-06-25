import './__setup'
import { noop } from 'lodash'

describe.skip('validation', () => {
  test('throws an error when registering for an unknown parameter', async () => {
    expect(() =>
      bema
        .parameter('a')
        .parameter('b')
        .onParameterChange('foobar' as never, noop)
    ).toThrowErrorMatchingInlineSnapshot(`
      "Cannot register event handler for given parameter name \\"foobar\\". No such parameter exists. Valid parameters are:
          → a
          → b"
    `)
  })
})

test('is called on first case as parameter gains value for first time and it receives an "event" parameter containing info about the event.', async () => {
  let ga = bema.parameter('c').onParameterChange('c', f1).group('a')
  ga.case({ c: '1' }).run(noop)
  await run(bema)
  expect(f1.mock.calls.length).toEqual(1)
  expect(f1.mock.calls[0][0]).toMatchInlineSnapshot(`
      Object {
        "initial": true,
        "name": "c",
        "value": Object {
          "after": "1",
          "before": undefined,
        },
      }
    `)
})

test('is called when parameter value changes between two cases and it receives an "event" parameter containing info about the event.', async () => {
  let ga = bema.parameter('c').onParameterChange('c', f1).group('a')
  ga.case({ c: '1' }).run(noop)
  ga.case({ c: '2' }).run(noop)
  await run(bema)
  expect(f1.mock.calls.length).toEqual(2)
  expect(f1.mock.calls[1][0]).toMatchInlineSnapshot(`
      Object {
        "initial": false,
        "name": "c",
        "value": Object {
          "after": "2",
          "before": "1",
        },
      }
    `)
})

test('also receives an "info" parameter that includes all the active cases with their parameter values', async () => {
  let ga = bema.parameter('a').parameter('b').onParameterChange('a', f1).group('a')
  ga.case({ a: '1', b: '3' }).run(noop)
  ga.case({ a: '1', b: '2' }).run(noop)
  await run(bema)
  expect(f1.mock.calls.length).toEqual(1)
  expect(f1.mock.calls[0][1]).toMatchInlineSnapshot(`
    Object {
      "activeCases": Array [
        Object {
          "parameters": Object {
            "a": "1",
            "b": "2",
          },
        },
        Object {
          "parameters": Object {
            "a": "1",
            "b": "3",
          },
        },
      ],
    }
  `)
})
