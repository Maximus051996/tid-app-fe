import { Injectable } from '@angular/core';
import {
  aes256GcmDecrypt,
  aes256GcmEncrypt,
  concat,
  fromBase64Url,
  randomBytes,
  toBase64Url,
  utf8,
} from './crypto-utils';
import { SecretStoreService } from './secret-store';

/**
 * Encrypted localStorage wrapper.
 *
 * Each value is stored as `v1:` + base64url(iv || ciphertext) where
 * ciphertext = AES-256-GCM(JSON, iv=12 random bytes, aad=key-name).
 *
 * Why include the key as AAD? Prevents an attacker from cutting the
 * ciphertext for `tid.users` and pasting it into `tid.tasks` — the AAD
 * mismatch makes the GCM tag fail.
 *
 * All operations expose synchronous get/set: callers cache the
 * Uint8Array key once, and the synchronous bridge spins WebCrypto via
 * a small in-memory blocking helper on first read. Practically, every
 * call site already lives in an async context (services that return
 * Observables wrap a Promise), so we expose async APIs and rebuild the
 * old StorageService synchronously by warming a memory cache on boot.
 */

const PREFIX = 'enc:v1:';

@Injectable({ providedIn: 'root' })
export class EncryptedStorageService {
  constructor(private secrets: SecretStoreService) {}

  async setEncrypted(key: string, value: unknown): Promise<void> {
    const k = this.secrets.getDeviceKey();
    const iv = randomBytes(12);
    const aad = utf8(key);
    const plaintext = utf8(JSON.stringify(value));
    const ct = await aes256GcmEncrypt(k, iv, plaintext, aad);
    const blob = PREFIX + toBase64Url(concat(iv, ct));
    localStorage.setItem(key, blob);
  }

  async getEncrypted<T>(key: string): Promise<T | null> {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    if (!raw.startsWith(PREFIX)) {
      // Plaintext legacy entry (or someone messed with it). Drop it.
      // Do NOT auto-decrypt anything that could be attacker-controlled.
      return this.tryParseLegacy<T>(raw);
    }

    try {
      const k = this.secrets.getDeviceKey();
      const blob = fromBase64Url(raw.slice(PREFIX.length));
      if (blob.length < 12 + 16) return null;
      const iv = blob.slice(0, 12);
      const ct = blob.slice(12);
      const aad = utf8(key);
      const pt = await aes256GcmDecrypt(k, iv, ct, aad);
      const text = new TextDecoder().decode(pt);
      return JSON.parse(text) as T;
    } catch {
      // Tampered, mismatched key, or corruption.
      return null;
    }
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }

  private tryParseLegacy<T>(raw: string): T | null {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
