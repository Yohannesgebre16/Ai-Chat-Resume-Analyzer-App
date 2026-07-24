/**
 * Auth utilities — JWT (HS256) via Node crypto + scrypt password hashing.
 * Zero external deps, server-only.
 */
import crypto from 'node:crypto'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  throw new Error('JWT_SECRET must be set and at least 16 chars')
}

const ACCESS_TOKEN_TTL = '7d' // access token lifetime (seconds-based exp below)

export interface JwtPayload {
  sub: string // user id
  email: string
  name: string
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return crypto.timingSafeEqual(aBuf, bBuf)
}

/** Sign a JWT (HS256). */
export function signJwt(payload: JwtPayload): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + 7 * 24 * 60 * 60 }
  const encHeader = base64url(JSON.stringify(header))
  const encBody = base64url(JSON.stringify(body))
  const data = `${encHeader}.${encBody}`
  const sig = base64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest())
  return `${data}.${sig}`
}

/** Verify a JWT (HS256). Returns the payload or throws. */
export function verifyJwt(token: string): JwtPayload {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Malformed token')
  const [encHeader, encBody, sig] = parts
  const expectedSig = base64url(
    crypto.createHmac('sha256', JWT_SECRET).update(`${encHeader}.${encBody}`).digest()
  )
  if (!timingSafeEqualStr(sig, expectedSig)) throw new Error('Invalid signature')

  let body: any
  try {
    body = JSON.parse(Buffer.from(encBody, 'base64url').toString('utf8'))
  } catch {
    throw new Error('Malformed payload')
  }
  if (typeof body.exp !== 'number' || body.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }
  return { sub: body.sub, email: body.email, name: body.name }
}

/** Hash a password using scrypt. Result format: `salt:hash` (both hex). */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

/** Compare a plaintext password against a stored `salt:hash`. */
export async function comparePassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const test = crypto.scryptSync(password, salt, 64).toString('hex')
  return timingSafeEqualStr(test, hash)
}

export const ACCESS_TTL = ACCESS_TOKEN_TTL
