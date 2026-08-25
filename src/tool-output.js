/**
 * Strip values that DSH tool output rejects (notably `undefined`) so the payload
 * survives lossless JSON validation.
 * @param {unknown} value
 * @returns {unknown}
 */
export function toLosslessToolOutput(value) {
  if (value === undefined) return undefined
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new Error('tool output contains a non-lossless number')
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map(item => toLosslessToolOutput(item))
  }
  if (typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {}
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue
      out[key] = toLosslessToolOutput(item)
    }
    return out
  }
  throw new Error('tool output contains a non-lossless value')
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLosslessToolOutput(value) {
  try {
    toLosslessToolOutput(value)
    return true
  } catch {
    return false
  }
}
