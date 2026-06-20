import {
  fromBase64Url,
  pbkdf2,
  randomBytes,
  timingSafeEqual,
  toBase64Url,
} from './crypto-utils';

/**
 * Password hashing helpers — PBKDF2-SHA-256.
 *
 * Encoded format: `pbkdf2$<iters>$<saltB64u>$<hashB64u>`
 * Storing parameters inside the hash lets us bump iteration count later
 * without breaking existing accounts (rehash on next successful login).
 */
const ITERATIONS = 200_000;
const SALT_LEN = 16;
const HASH_LEN = 32;
const PREFIX = 'pbkdf2';

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const hash = await pbkdf2(plain, salt, ITERATIONS, HASH_LEN);
  return `${PREFIX}$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(
  plain: string,
  encoded: string
): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 4 || parts[0] !== PREFIX) return false;
  const iters = parseInt(parts[1], 10);
  if (!Number.isFinite(iters) || iters < 10_000) return false;
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromBase64Url(parts[2]);
    expected = fromBase64Url(parts[3]);
  } catch {
    return false;
  }
  const candidate = await pbkdf2(plain, salt, iters, expected.length);
  return timingSafeEqual(candidate, expected);
}

/** Quick check: is this string already in encoded form, or is it legacy plaintext? */
export function isHashed(value: string): boolean {
  return value.startsWith(PREFIX + '$') && value.split('$').length === 4;
}
