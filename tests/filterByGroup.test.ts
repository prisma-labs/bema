import './__setup'

test('does not run a group when it is filtered out', async () => {
  const b1 = bema.parameter('name').settings({ skipGroups: /b/ })
  const ga = b1.group('a')
  ga.case({ name: '1' }).run(f1)
  const gb = b1.group('b')
  gb.case({ name: '2' }).run(f1)
  gb.case({ name: '3' }).run(f1)
  const result = await run(bema)
  expect(f1.mock.calls.length).toEqual(1)
  expect(f1.mock.calls[0][0].$info.parameters.name).toEqual('1')
  // expect(result.cases.length).toEqual(1)
  // expect(result.parameters).toMatchSnapshot()
  // expect(stripKeys(['elapsedTime', 'endTime', 'startTime'], result.stats)).toMatchSnapshot()
})
