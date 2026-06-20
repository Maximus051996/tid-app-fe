/**
 * Low-level cryptographic primitives wrapping the browser's WebCrypto API.
 *
 * Everything here is async because WebCrypto is async. All inputs / outputs
 * use Uint8Array for binary data and base64url for textual transport.
 *
 * Threat model note: in a frontend-only app, every key these functions
 * consume is ultimately readable by someone with full device access.
 * These utilities provide *defense in depth*, not a guarantee of secrecy.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export function utf8(s: string): Uint8Array {
  return enc.encode(s);
}

export function fromUtf8(b: Uint8Array): string {
  return dec.decode(b);
}

export function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** Constant-time byte comparison — protects HMAC verify from timing attacks. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Encode bytes as URL-safe base64 (no padding) — used by PASETO. */
export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): Uint8Array {
  let str = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (str.length % 4)) % 4;
  str += '='.repeat(pad);
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 64-bit little-endian length prefix (PAE component). */
export function le64(n: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, BigInt(n), true);
  return new Uint8Array(buf);
}

/**
 * Pre-Authentication Encoding from the PASETO spec.
 * PAE(arr) = LE64(arr.length) + foreach(p): LE64(p.length) + p
 */
export function pae(pieces: Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = [le64(pieces.length)];
  for (const p of pieces) {
    parts.push(le64(p.length));
    parts.push(p);
  }
  return concat(...parts);
}

/** RFC 5869 HKDF-SHA-384 — used for deriving PASETO v3.local subkeys. */
export async function hkdfSha384(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  bytes: number
): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    ikm,
    'HKDF',
    false,
    ['deriveBits']
  );
  const out = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-384', salt, info },
    baseKey,
    bytes * 8
  );
  return new Uint8Array(out);
}

/** HMAC-SHA-384 (48-byte tag). */
export async function hmacSha384(
  key: Uint8Array,
  data: Uint8Array
): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-384' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', k, data);
  return new Uint8Array(sig);
}

/** AES-256-CTR — symmetric op (encrypt and decrypt are identical). */
export async function aes256Ctr(
  key: Uint8Array,
  counter: Uint8Array,
  data: Uint8Array
): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CTR' },
    false,
    ['encrypt', 'decrypt']
  );
  const out = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter, length: 64 },
    k,
    data
  );
  return new Uint8Array(out);
}

/** AES-256-GCM AEAD — confidentiality + integrity in a single primitive. */
export async function aes256GcmEncrypt(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
  aad?: Uint8Array
): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const params: AesGcmParams = { name: 'AES-GCM', iv };
  if (aad) params.additionalData = aad;
  const out = await crypto.subtle.encrypt(params, k, data);
  return new Uint8Array(out);
}

export async function aes256GcmDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  data: Uint8Array,
  aad?: Uint8Array
): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const params: AesGcmParams = { name: 'AES-GCM', iv };
  if (aad) params.additionalData = aad;
  const out = await crypto.subtle.decrypt(params, k, data);
  return new Uint8Array(out);
}

/** PBKDF2-SHA-256 — used for password hashing and key derivation. */
export async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
  bytes: number
): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    utf8(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const out = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    bytes * 8
  );
  return new Uint8Array(out);
}
