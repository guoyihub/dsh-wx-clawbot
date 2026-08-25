import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Document, parseDocument } from 'yaml'

const REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
/** Matches {@link @deepseek-ai/dsh-credentials-local} `DOCUMENT_VERSION`. */
export const DOCUMENT_VERSION = 1

export function defaultDshHome(env = process.env) {
  return resolve(env.DSH_HOME || join(homedir(), '.dsh'))
}

export function credentialsPath(dshHome = defaultDshHome()) {
  return join(dshHome, '.credentials.yaml')
}

function validateRef(ref) {
  if (!REF_PATTERN.test(ref)) throw new Error(`invalid credential reference: ${ref}`)
}

async function readDocument(filename) {
  let source
  try {
    source = await readFile(filename, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  const document = source === undefined ? new Document({}) : parseDocument(source, { uniqueKeys: true })
  if (document.errors.length > 0) {
    throw new Error(`credentials file is invalid: ${filename}`)
  }
  const value = document.toJS() ?? {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`credentials file must contain a YAML mapping: ${filename}`)
  }
  return document
}

/**
 * Normalize the on-disk layout to `version: 1` with string refs under `refs:`.
 * Migrates pre-release flat keys in place and removes stale top-level copies.
 * @param {import('yaml').Document} document
 */
export function ensureVersionedLayout(document) {
  const root = document.toJS() ?? {}
  const keys = Object.keys(root)
  if (keys.length === 0) {
    document.setIn(['version'], DOCUMENT_VERSION)
    return document
  }
  if (!('version' in root)) {
    document.setIn(['version'], DOCUMENT_VERSION)
    for (const key of keys) {
      const value = root[key]
      if (typeof value !== 'string' || value.length === 0) continue
      validateRef(key)
      document.setIn(['refs', key], value)
      document.deleteIn([key])
    }
    return document
  }
  if (root.version !== DOCUMENT_VERSION) {
    throw new Error(`credentials file declares version ${JSON.stringify(root.version)}; this plugin writes version ${DOCUMENT_VERSION}`)
  }
  document.setIn(['version'], DOCUMENT_VERSION)
  for (const key of keys) {
    if (key === 'version' || key === 'refs' || key === 'records') continue
    const value = root[key]
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`credentials file has unknown top-level key "${key}"`)
    }
    validateRef(key)
    document.setIn(['refs', key], value)
    document.deleteIn([key])
  }
  return document
}

async function commit(filename, document) {
  await mkdir(dirname(filename), { recursive: true, mode: 0o700 })
  const temporary = `${filename}.${randomUUID()}.tmp`
  await writeFile(temporary, document.toString(), { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, filename)
}

export async function setCredential(ref, value, options = {}) {
  validateRef(ref)
  if (typeof value !== 'string' || !value.trim()) throw new Error('credential value is empty')
  if (process.env[ref]) {
    throw new Error(`${ref} is set in the process environment; remove it before pairing so the new token is not shadowed`)
  }
  const filename = options.filename ?? credentialsPath(options.dshHome)
  const document = ensureVersionedLayout(await readDocument(filename))
  document.setIn(['refs', ref], value.trim())
  document.deleteIn([ref])
  await commit(filename, document)
  return filename
}

export async function unsetCredential(ref, options = {}) {
  validateRef(ref)
  if (process.env[ref]) {
    throw new Error(`${ref} is set in the process environment and cannot be removed by this command`)
  }
  const filename = options.filename ?? credentialsPath(options.dshHome)
  const document = ensureVersionedLayout(await readDocument(filename))
  document.deleteIn(['refs', ref])
  document.deleteIn([ref])
  await commit(filename, document)
  return filename
}

export async function hasCredential(ref, options = {}) {
  validateRef(ref)
  if (process.env[ref]) return true
  return Boolean(await readCredentialValue(ref, options))
}

/**
 * Read a credential value from the process environment or the versioned file layout.
 * @param {string} ref
 * @param {object} [options]
 * @returns {Promise<string | undefined>}
 */
export async function readCredentialValue(ref, options = {}) {
  validateRef(ref)
  const fromEnv = process.env[ref]
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  const filename = options.filename ?? credentialsPath(options.dshHome)
  try {
    const document = await readDocument(filename)
    const root = document.toJS() ?? {}
    const value = root.refs?.[ref] ?? root[ref]
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
}
