// const invalidParameterNames = validateParameterValues(parameterValues)
// if (invalidParameterNames) {
//   const message = endent`
//     Invalid parameter values given. The following parameter types do not exist: ${invalidParameterNames.join(
//       ', '
//     )}. ${renderValidParameters()}
//   `
//   throw new UserError({ message })
// }

import kleur from 'kleur'
import { BaseContext } from '../types'
import { UserError } from '../utils/errors'

// if (!getRequiredParameters(self).includes(parameterName)) {
//   const message = `Cannot register event handler for given parameter name "${parameterName}". No such parameter exists. ${renderValidParameters()}`
//   throw new UserError({ message })
// }

export function validateContextData(params: { data: BaseContext; invalid: string }): void {
  if (Object.keys(params.data).includes('$info')) {
    const message = kleur.red(
      `Invalid ${params.invalid}. It included a top-level key called "$info" which is reserved.`
    )
    throw new UserError({ message })
  }
}

// function validateParameterValues(parameters: BaseParameters): null | string[] {
//   const names = Object.keys(parameters)
//   const diff = difference(names, getRequiredParameters(self))
//   if (diff.length) return diff
//   return null
// }

// function renderValidParameters(): string {
//   if (getRequiredParameters(self).length) {
//     return endent`
//     Valid parameters are:
//     ${renderIndentedList(getRequiredParameters(self))}
//   `
//   } else {
//     return endent`
//       There are no parameters types defined.
//     `
//   }
// }
