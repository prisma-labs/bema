import { CustomError } from 'ts-custom-error'
import { Logger } from '../declaration/config'

export class UserError<C extends Record<string, unknown>> extends CustomError {
  public context: C
  constructor(input: { message: string; context?: C }) {
    super(input.message)
    // @ts-expect-error just a default
    this.context = input.context ?? {}
  }
}

export class LintError<C extends Record<string, unknown>> extends CustomError {
  public context: C
  constructor(input: { message: string; context?: C }) {
    super(input.message)
    // @ts-expect-error just a default
    this.context = input.context ?? {}
  }
}

export function lintError(
  logger: Logger,
  params: { message: string; context?: Record<string, unknown> }
): void {
  // @ts-expect-error dynamic global access
  if (global.BEMA_STRICT_MODE) {
    throw new LintError(params)
  } else {
    logger.error(params.message)
  }
}
