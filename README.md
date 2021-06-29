# Bema

[![trunk](https://github.com/prisma-labs/bema/actions/workflows/trunk.yml/badge.svg)](https://github.com/prisma-labs/bema/actions/workflows/trunk.yml)

🐎 Delightful benchmarking for Node.js

### Installation

```
npm add bema
```

### About

Bema is a framework for writing benchamrks. It focused on your workflow of writing and maintain benchmarks over time. Under the hood it uses [Benchmark.js](https://benchmarkjs.com/) as its engine but layers many features on top. Conceptually you can roughly think of it to benchmarks what
[`jest`](https://jestjs.io/) is to tests. It was initially developed at [Prisma](https://www.prisma.io/)
for internal bencmarking needs and continues to be used today. Its features and roadmap are driven firstly
by Prisma's needs however community contributions are generally welcome too!

### Features

1. Define groups to organize your benchmarks
1. Fluent API maximally leveraging TypeScript for fantastic autocompletion and type safety
1. Easy matrix definition (on par with [GitHub Actions](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#jobsjob_idstrategymatrix))
1. Benchmark parameterization (global or group level)
1. Context system for easily sharing data (or anything else you want) across benchmarks
1. Provider system (think express middleware ish) for reusing logic across benchmarks
1. CLI
   1. A statistically insignificant quick mode to try out benchmarks while developing
   1. Select benchmarks to run
   1. Select benchmarks to skip
   1. Target benchmarks by parameter and/or group matches
   1. Pretty terminal reporting
   1. GitHub Actions integration
      1. Download artifacts
      1. Plug GitHub matrixes into filtered benchmark runs (not actually an integrated feature at all, just works really well)
   1. Report files merging (e.g. useful when you have many separte report files from a matrix of CI job runs)
1. Reports
   1. Full access to detailed sample statsna and overall stats provided by Benchmark.js
   1. Metadata (benchmark names, parameter values each had, group each was in, etc.)
   1. Information organized by matrixes if used
   1. Multiple formats
      1. JSON
      1. CSV
      1. Markdown
1. Integrated nextjs webapp for visualizing benchmarks _(work in progress)_
1. Able to run TypeScript without you having to do anything (e.g. imagine if `jest` had [`ts-jest`](https://kulshekhar.github.io/ts-jest/) builtin)
1. Hook onto parameter change events
1. Benchmark result sanity check system (verify benchmark runs are doing the work you expect them too)
   > Useful for complex benchmarks. For example imagine you are testing a set of ORMs with completely different APIs but you want to ensure the data they are querying against the database always returns the **exact same set of data** otherwise your benchmarks aren't actually comparing apples-to-apples. Bema helps you build confidence around this use-case by having an integrated sanity check step you can opt-into.

### Guide _(work in progress)_

The following gives a _taste_ of bema but there are many other features and more advanced topics that are not covered yet.

```ts
// benchmarks/simple.bench.ts

// Bema exports a singleton so you can get to work quickly.
import bema from 'bema'
import * as util from 'util'

// Save a reference to the created+configured group so that you can
// define multiple benchmarks later down in the module.
const simple = bema
  // Create groups of benchmarks. This allows you to share configuration across multiple benchmarks
  // and affects their default presentation in downstream reporting.
  .group('Simple')
  // Define custom parameters. Benchmarks are named by their accumulated parameters.
  .parameter('name')
  // Let's add two to show it off down below.
  .parameter('thing')
  // A middleware system. You get access to upstream context and can augment
  // however you want for downstream parts! Also, your additions here will be statically visible
  // downstream thanks to TypeScript!
  .use((ctx) => ({
    ...ctx,
    newThing: true,
  }))
  // Sugar over the middleware system to quickly attach data to the context.
  .useData({ text: 'foo' })

simple
  // Create a new benchmark
  .case({
    // The parameters we defined upstream at statically available for us here
    name: 'just-text',
    thing: 'bar',
  })
  // Add a provider only for this benchmark (doesn't affect the group)
  .use(foobar)
  // Your actual benchmark implementation. All code in here will be timed in a
  // statistically significant way (via Benchmark.js)
  .run((ctx) => {
    util.format(ctx.text)
  })

simple
  // Create another benchmark
  .case({
    name: 'interpolated-text',
    thing: 'qux',
  })
  .run(async (ctx) => {
    util.format(`!%s!`, ctx.text)
  })
```

```
npx bema
```

![CleanShot 2021-06-26 at 00 47 35@2x](https://user-images.githubusercontent.com/284476/123502198-82fb5280-d618-11eb-9807-53ebb8066de0.png)

### CLI

#### `bench`

![CleanShot 2021-06-26 at 00 59 10@2x](https://user-images.githubusercontent.com/284476/123502396-0f5a4500-d61a-11eb-81d7-9b25ee458af4.png)

![CleanShot 2021-06-26 at 00 59 17@2x](https://user-images.githubusercontent.com/284476/123502401-15502600-d61a-11eb-9475-630f6cf03cf5.png)

#### `ui`

![CleanShot 2021-06-26 at 00 59 49@2x](https://user-images.githubusercontent.com/284476/123502384-ed60c280-d619-11eb-963c-cb52e4127dc0.png)

#### `report`

![CleanShot 2021-06-26 at 00 58 15@2x](https://user-images.githubusercontent.com/284476/123502389-fe113880-d619-11eb-9c7a-5da20333cfc1.png)

### Reference Docs

[On Paka](https://paka.dev/npm/bema) _(work in progress)_
