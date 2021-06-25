import './__setup'

test('bema-level useData provides data to the context', async () => {
  bema.useData({ a: 1 })
  const ga = bema.group('a')
  ga.case().run(f1)
  await run(bema)
  expect(f1.mock.calls).toMatchSnapshot()
})

test('group-level useData provides data to the context', async () => {
  const ga = bema.group('a').useData({ a: 1 })
  ga.case().run(f1)
  await run(bema)
  expect(f1.mock.calls).toMatchSnapshot()
})
