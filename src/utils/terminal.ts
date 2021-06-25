import { repeat } from 'lodash'
import stripAnsi from 'strip-ansi'

export function underline(text: string): string {
  return text + '\n' + repeat('-', stripAnsi(text).trim().length)
}

export function indent(text: string): string {
  return indentBy(INDENT_SIZE, text)
}

export function indentBy(size: number, text: string): string {
  return text
    .split('\n')
    .map((l) => `${repeat(' ', size)}${l}`)
    .join('\n')
}

export function renderIndentedList(xs: string[]): string {
  return indentBy(4, renderList(xs))
}

export function renderList(xs: string[]): string {
  return xs.map((x) => `${ARROW_POINTING_RIGHT} ${x}`).join('\n')
}

export const SPACE = ' '

export const X = '✖'

export const CHECK = '✔'

export const ARROW_POINTING_RIGHT = '→'

export const INDENT = '    '

export const INDENT_SIZE = 4
