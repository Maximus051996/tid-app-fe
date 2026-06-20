import { Injectable } from '@angular/core';
import { fromBase64Url, randomBytes, toBase64Url } from './crypto-utils';

/**
 * Owns the device-local 32-byte symmetric key used by both PASETO tokens
 * and the encrypted storage layer.
 *
 * Honest threat model:
 *   The key sits in localStorage. Anyone with full device access (physical,
 *   another extension running in the same origin, a malicious bundle update)
 *   can read it. What this DOES protect against:
 *     - Casual inspection — no plaintext PII in localStorage.
 *     - Tampering — modifying ciphertext invalidates the auth tag.
 *     - Direct reuse — copying a token without the key gets you nothing
 *       on a different device.
 *   What it does NOT protect against:
 *     - Same-origin script execution (XSS, malicious extension).
 *     - A determined operator with devtools and a debugger.
 *
 * For real auth, move the secret to a server. That is the only fix.
 */
const KEY_NAME = 'tid.dk.v1';

@Injectable({ providedIn: 'root' })
export class SecretStoreService {
  private cached: Uint8Array | null = null;

  /** Get-or-create the device key as a 32-byte Uint8Array. */
  getDeviceKey(): Uint8Array {
    if (this.cached) return this.cached;

    const stored = localStorage.getItem(KEY_NAME);
    if (stored) {
      try {
        const bytes = fromBase64Url(stored);
        if (bytes.length === 32) {
          this.cached = bytes;
          return bytes;
        }
      } catch {
        // Fall through and regenerate.
      }
    }

    const fresh = randomBytes(32);
    localStorage.setItem(KEY_NAME, toBase64Url(fresh));
    this.cached = fresh;
    return fresh;
  }

  /** Used by full-reset flows (admin tooling, account wipe). */
  rotate(): Uint8Array {
    const fresh = randomBytes(32);
    localStorage.setItem(KEY_NAME, toBase64Url(fresh));
    this.cached = fresh;
    return fresh;
  }
}
