import { isArray, isPlainObject, mapValues } from 'lodash'

export function stripKey(keyName: string, obj: any) {
  let stripCount = 0
  const stripped = stripKeyDo(keyName, obj)

  if (!stripCount) {
    throw new Error(`Useless stripKey call detected, never found 1+ keys called "${keyName}"`)
  }

  return stripped

  function stripKeyDo(keyName: string, obj: any): any {
    return mapValues(obj, (v, k) => {
      if (k === keyName) {
        stripCount++
        return 'STRIPPED'
      }
      if (isArray(v)) {
        return v.map((v2) => stripKeyDo(keyName, v2))
      }
      if (isPlainObject(v)) {
        return stripKeyDo(keyName, v)
      }
      return v
    })
  }
}

export function stripKeys(keyNames: string[], obj: any) {
  return keyNames.reduce((o, keyName) => stripKey(keyName, o), obj)
}
