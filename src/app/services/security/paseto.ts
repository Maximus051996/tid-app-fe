/**
 * PASETO v3.local — symmetric authenticated encryption for tokens.
 *
 * Spec: https://github.com/paseto-standard/paseto-spec
 *
 * Construction (paraphrased):
 *   header  = "v3.local."
 *   nonce   = 32 random bytes
 *   tmp     = HKDF-SHA-384(key, salt="", info="paseto-encryption-key" || nonce, len=48)
 *   Ek      = tmp[0..32]                    // AES-256 encryption key
 *   n2      = tmp[32..48]                   // AES-CTR initial counter
 *   Ak      = HKDF-SHA-384(key, salt="", info="paseto-auth-key-for-aead" || nonce, len=48)
 *   ct      = AES-256-CTR(Ek, n2, plaintext)
 *   preauth = PAE([header, nonce, ct, footer, implicit])
 *   tag     = HMAC-SHA-384(Ak, preauth)
 *   token   = header || base64url(nonce || ct || tag) [|| "." || base64url(footer)]
 *
 * Verification rejects any token whose HMAC tag doesn't match — *before* decryption.
 * Tag comparison is constant-time (`timingSafeEqual`) to avoid leaking match-position.
 */

import {
  aes256Ctr,
  concat,
  fromBase64Url,
  fromUtf8,
  hkdfSha384,
  hmacSha384,
  pae,
  randomBytes,
  timingSafeEqual,
  toBase64Url,
  utf8,
} from './crypto-utils';

const HEADER = 'v3.local.';
const HEADER_BYTES = utf8(HEADER);
const NONCE_LEN = 32;
const TAG_LEN = 48;
const KEY_LEN = 32;

export interface PasetoOptions {
  /** Optional non-secret footer (carried in the token itself). */
  footer?: Uint8Array | string;
  /** Optional implicit assertion (NOT carried — must match on decrypt). */
  implicit?: Uint8Array | string;
}

function asBytes(v: Uint8Array | string | undefined | null): Uint8Array {
  if (!v) return new Uint8Array(0);
  return typeof v === 'string' ? utf8(v) : v;
}

export async function pasetoEncrypt(
  payload: object,
  key: Uint8Array,
  options: PasetoOptions = {}
): Promise<string> {
  if (key.length !== KEY_LEN) {
    throw new Error('PASETO v3.local requires a 32-byte symmetric key.');
  }
  const m = utf8(JSON.stringify(payload));
  const n = randomBytes(NONCE_LEN);
  const f = asBytes(options.footer);
  const i = asBytes(options.implicit);
  const empty = new Uint8Array(0);

  const tmp = await hkdfSha384(
    key,
    empty,
    concat(utf8('paseto-encryption-key'), n),
    48
  );
  const Ek = tmp.slice(0, 32);
  const n2 = tmp.slice(32, 48);
  const Ak = await hkdfSha384(
    key,
    empty,
    concat(utf8('paseto-auth-key-for-aead'), n),
    48
  );

  const c = await aes256Ctr(Ek, n2, m);
  const preAuth = pae([HEADER_BYTES, n, c, f, i]);
  const t = await hmacSha384(Ak, preAuth);

  const body = concat(n, c, t);
  let token = HEADER + toBase64Url(body);
  if (f.length > 0) token += '.' + toBase64Url(f);
  return token;
}

export async function pasetoDecrypt<T = unknown>(
  token: string,
  key: Uint8Array,
  options: PasetoOptions = {}
): Promise<T> {
  if (key.length !== KEY_LEN) {
    throw new Error('PASETO v3.local requires a 32-byte symmetric key.');
  }
  if (typeof token !== 'string' || !token.startsWith(HEADER)) {
    throw new Error('Invalid PASETO header.');
  }

  const remainder = token.slice(HEADER.length);
  const dotIdx = remainder.indexOf('.');
  let bodyStr: string;
  let f: Uint8Array;

  if (dotIdx >= 0) {
    bodyStr = remainder.slice(0, dotIdx);
    f = fromBase64Url(remainder.slice(dotIdx + 1));
  } else {
    bodyStr = remainder;
    f = new Uint8Array(0);
  }

  // If caller declared an expected footer, enforce it in constant time.
  if (options.footer !== undefined) {
    const expected = asBytes(options.footer);
    if (
      expected.length !== f.length ||
      !timingSafeEqual(expected, f)
    ) {
      throw new Error('PASETO footer mismatch.');
    }
  }

  const body = fromBase64Url(bodyStr);
  if (body.length < NONCE_LEN + TAG_LEN) {
    throw new Error('PASETO body too short.');
  }

  const n = body.slice(0, NONCE_LEN);
  const c = body.slice(NONCE_LEN, body.length - TAG_LEN);
  const tag = body.slice(body.length - TAG_LEN);

  const i = asBytes(options.implicit);
  const empty = new Uint8Array(0);

  const Ak = await hkdfSha384(
    key,
    empty,
    concat(utf8('paseto-auth-key-for-aead'), n),
    48
  );
  const preAuth = pae([HEADER_BYTES, n, c, f, i]);
  const computedTag = await hmacSha384(Ak, preAuth);

  // Verify *before* decryption — this is the whole point of authenticated encryption.
  if (!timingSafeEqual(tag, computedTag)) {
    throw new Error('PASETO authentication failed.');
  }

  const tmp = await hkdfSha384(
    key,
    empty,
    concat(utf8('paseto-encryption-key'), n),
    48
  );
  const Ek = tmp.slice(0, 32);
  const n2 = tmp.slice(32, 48);

  const m = await aes256Ctr(Ek, n2, c);
  return JSON.parse(fromUtf8(m)) as T;
}
