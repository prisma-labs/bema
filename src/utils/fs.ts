import * as Path from 'path'

/** If path is not absolute then make it so with the given base. */
export function absolutify(path: string, basePath: string): string {
  if (Path.isAbsolute(path)) return path
  return Path.join(basePath, path)
}
