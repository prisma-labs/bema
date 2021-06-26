import * as util from 'util'
import bema from '../../src'

const simple = bema
  .group('Simple')
  .parameter('name')
  .parameter('thing')
  .use((ctx) => ({
    ...ctx,
    newThing: true,
  }))
  .useData({ text: 'foo' })

simple.case({ name: 'just-text', thing: 'bar' }).run((ctx) => {
  util.format(ctx.text)
})

simple.case({ name: 'interpolated-text', thing: 'qux' }).run((ctx) => {
  util.format(`!%s!`, ctx.text)
})
