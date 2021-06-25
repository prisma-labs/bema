import { BaseContext, BaseParameters, ContextProviderHooks } from './types'
import { MaybePromise } from './utils'

/**
 * Create a provider.
 *
 * Providers can be passed to the `.use` method.
 *
 * You can configure paramter values that any benchmark using your provider will get.
 *
 * About the provider:
 *
 * 1. Anything you return in your provider method will be shallowly merged into the context.
 *
 * 2. If your provider depends on some context (given by another provider) then type that in the `context`
 * provider parameter. Do not use the generics so that inference can do its job. There is a limitation of TS
 * thatforces this: https://github.com/microsoft/TypeScript/issues/26242#issuecomment-757571172
 *
 * 3. If you care about it you can use the `BeforeCaseContext` generic which gives you an accurate type for
 * context by adding types for the `$info` property. See example below.
 *
 * 4. If your provider needs to tap into the benchmark lifecycle then use the API in the second parameter
 * `on`.
 *
 * @example
 *
 *   // Simple
 *
 *   const foobar = createProvider({
 *     provider(context) {
 *       // All downstream providers, hooks, and benchmark will have access to this data:
 *       return {
 *         foo: 'bar',
 *       }
 *     },
 *   })
 *
 *   // Usage Examples
 *   // Place on root for all cases to have access
 *   bema.use(foobar)
 *   // Place on a specific group if only its cases need it
 *   bema.group('foo').use(foobar).case()
 *   // Place on a specific case if only needed there
 *   bema.case().use(foobar)
 *
 * @example
 *
 *   // Complex
 *
 *   const prisma = createProvider({
 *     // All cases using this provider will get this benchmark parameter arguments
 *     parameters: {
 *       orm: 'prisma',
 *     },
 *     // use BeforeCaseContext generic if you want access to the $info
 *     provider(context: BeforeCaseContext<DatabaseInfo>, on) {
 *       console.log('hey look at me: %j', context.$info.parameters)
 *
 *       const prisma: PrismaClient = new PrismaClient({
 *         datasources: {
 *           db: {
 *             url: context.databaseInfo.url,
 *           },
 *         },
 *       })
 *
 *       on.setup(async () => {
 *         await prisma.$connect()
 *       })
 *
 *       on.teardown(async () => {
 *         await prisma.$disconnect()
 *       })
 *
 *       return {
 *         db: prisma,
 *       }
 *     },
 *   })
 *
 */
export function createProvider<
  ContextRequired extends BaseContext,
  ContextContributed extends BaseContext
>(config: {
  /**
   * The parameter values that any benchmark using (or inheriting use of) this provider will get.
   *
   * @example
   *
   *   const qux = createProvider({
   *     parameters: {
   *       foo: 'bar',
   *     },
   *     //...
   *   })
   *
   *   const bench = benchmarker.parameter('foo')
   *
   *   bench.case().use(qux) // has value "bar" for parameter "foo"
   *
   */
  parameters?: BaseParameters
  /**
   * The provider implementation.
   *
   * @param context  The context passed down from any providers higher up.
   * @param on       API to hook into lifecycle events.
   * @returns A plain object that will be shallowly merged with context.
   */
  provider: (
    context: ContextRequired,
    on: ContextProviderHooks<ContextRequired>
    // on: ContextProviderHooks<ContextRequired & ContextContributed> // <-- Though its technically a more accurate typing doing this breaks return type inference.
  ) => MaybePromise<ContextContributed>
}): <Context extends ContextRequired>(
  context: Context,
  on: ContextProviderHooks
) => MaybePromise<Context & ContextContributed> {
  async function provider(ctx: Record<string, unknown>, on: unknown) {
    // @ts-expect-error investigate why ctx must be unknown
    const ctxContributed: Record<string, unknown> = await config.provider(ctx, on)

    const ctxNew = {
      ...ctx,
      ...ctxContributed,
    }

    return ctxNew
  }

  provider.parameters = config.parameters

  // @ts-expect-error investigate why ctx must be unknown
  return provider
}
