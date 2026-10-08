import { randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { isSafeStorageKey, MAX_STORAGE_KEY_LENGTH } from './schemas.js'

/**
 * Storage.
 *
 * V1 writes to the client's own disk, so object storage would be pure overhead —
 * but everything goes through this interface anyway. When he moves to a render
 * server, an S3 implementation drops in behind it and one env var changes.
 *
 * Keys are RELATIVE POSIX strings ("assets/ab/cd/<uuid>.jpg"), never absolute
 * paths, never Windows paths, never URLs. The adapter owns the root; callers
 * never learn where it is unless they ask for a resolved path explicitly.
 */

export interface StorageAdapter {
  put(key: string, data: Buffer | NodeJS.ReadableStream): Promise<string>
  get(key: string): Promise<NodeJS.ReadableStream>
  url(key: string, expiresIn?: number): Promise<string>
  exists(key: string): Promise<boolean>
  delete(key: string): Promise<void>
}

export class StorageKeyError extends Error {
  override readonly name = 'StorageKeyError'
}

export class StorageNotFoundError extends Error {
  override readonly name = 'StorageNotFoundError'
}

export function assertSafeStorageKey(key: string): void {
  if (!isSafeStorageKey(key)) {
    throw new StorageKeyError(
      `unsafe storage key: keys must be relative POSIX paths of segments matching [A-Za-z0-9][A-Za-z0-9._-]*, at most ${MAX_STORAGE_KEY_LENGTH} characters, with no "..", no backslashes and no leading slash`,
    )
  }
}

const EXTENSION_PATTERN = /^[a-z0-9]{2,4}$/

/**
 * Build a key from a UUID. User-supplied filenames never reach the filesystem —
 * that is the cheapest path-traversal defence there is, and it also sidesteps
 * every Windows reserved-name and unicode-normalisation trap.
 */
export function newStorageKey(prefix: string, extension: string): string {
  const normalisedExtension = extension.replace(/^\./, '').toLowerCase()
  if (!EXTENSION_PATTERN.test(normalisedExtension)) {
    throw new StorageKeyError(`unsafe file extension: "${extension}"`)
  }
  const key = `${prefix.replace(/\/+$/, '')}/${randomUUID()}.${normalisedExtension}`
  assertSafeStorageKey(key)
  return key
}

export type LocalStorageOptions = {
  rootDir: string
  /** Route prefix used by `url()`. `./storage` is never served statically. */
  urlPrefix?: string
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly root: string
  private readonly urlPrefix: string

  constructor(options: LocalStorageOptions) {
    this.root = path.resolve(options.rootDir)
    this.urlPrefix = (options.urlPrefix ?? '/api/storage').replace(/\/+$/, '')
  }

  /**
   * Key to absolute path.
   *
   * Two independent gates: the key grammar, then a resolved-prefix check. The
   * grammar alone would do, but a resolved path that escapes the root is the
   * failure that actually matters, so it is asserted directly rather than
   * inferred.
   */
  resolve(key: string): string {
    assertSafeStorageKey(key)
    const resolved = path.resolve(this.root, key)
    if (!resolved.startsWith(this.root + path.sep)) {
      throw new StorageKeyError(`storage key "${key}" resolves outside the storage root`)
    }
    return resolved
  }

  async put(key: string, data: Buffer | NodeJS.ReadableStream): Promise<string> {
    const target = this.resolve(key)
    await mkdir(path.dirname(target), { recursive: true })

    // Write to a temp file and rename: a crashed or killed render must never
    // leave a truncated file sitting at a content-addressed key.
    const temporary = `${target}.${randomUUID()}.part`
    try {
      const source = Buffer.isBuffer(data) ? Readable.from([data]) : Readable.from(data)
      await pipeline(source, createWriteStream(temporary, { mode: 0o600 }))
      await rename(temporary, target)
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined)
      throw error
    }
    return key
  }

  async get(key: string): Promise<NodeJS.ReadableStream> {
    const target = this.resolve(key)
    if (!(await this.exists(key))) {
      throw new StorageNotFoundError(`storage key not found: ${key}`)
    }
    return createReadStream(target)
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface is async for the S3 case
  async url(key: string, _expiresIn?: number): Promise<string> {
    assertSafeStorageKey(key)
    // Local storage has no signing and no expiry; the app password gates access.
    const encoded = key.split('/').map(encodeURIComponent).join('/')
    return `${this.urlPrefix}/${encoded}`
  }

  async exists(key: string): Promise<boolean> {
    const target = this.resolve(key)
    try {
      const info = await stat(target)
      return info.isFile()
    } catch {
      return false
    }
  }

  async delete(key: string): Promise<void> {
    const target = this.resolve(key)
    try {
      await unlink(target)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return
      throw error
    }
  }

  /** Bytes at a key, or null when it does not exist. Used by the retention prune job. */
  async size(key: string): Promise<number | null> {
    const target = this.resolve(key)
    try {
      const info = await stat(target)
      return info.isFile() ? info.size : null
    } catch {
      return null
    }
  }
}
