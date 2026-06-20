import { Injectable } from '@angular/core';

/**
 * Per-identifier login throttle with exponential backoff.
 *
 * Tracks failed attempts in memory + localStorage so a casual
 * page-refresh attack still hits the same lockout. (A truly determined
 * attacker can clear localStorage to reset — that's an unavoidable
 * frontend-only limitation.)
 */
const KEY = 'tid.lt.v1';

interface Bucket {
  fails: number;
  /** Epoch ms when the next attempt is allowed. */
  blockedUntil: number;
}

type Buckets = Record<string, Bucket>;

@Injectable({ providedIn: 'root' })
export class LoginThrottleService {
  private read(): Buckets {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Buckets) : {};
    } catch {
      return {};
    }
  }

  private write(b: Buckets): void {
    localStorage.setItem(KEY, JSON.stringify(b));
  }

  private id(identifier: string): string {
    return identifier.trim().toLowerCase();
  }

  /** Returns ms until the next attempt is allowed, or 0 if not blocked. */
  remainingLockoutMs(identifier: string): number {
    const b = this.read()[this.id(identifier)];
    if (!b) return 0;
    const remaining = b.blockedUntil - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /** Computes lockout window for `n` total failed attempts. */
  private lockoutForFails(n: number): number {
    if (n < 3) return 0;
    if (n === 3) return 10_000;       // 10s
    if (n === 4) return 30_000;       // 30s
    if (n === 5) return 60_000;       // 1m
    if (n === 6) return 2 * 60_000;   // 2m
    if (n === 7) return 5 * 60_000;   // 5m
    return 15 * 60_000;               // 15m cap
  }

  recordFailure(identifier: string): { fails: number; lockoutMs: number } {
    const all = this.read();
    const k = this.id(identifier);
    const b = all[k] ?? { fails: 0, blockedUntil: 0 };
    b.fails += 1;
    const lockout = this.lockoutForFails(b.fails);
    b.blockedUntil = lockout > 0 ? Date.now() + lockout : 0;
    all[k] = b;
    this.write(all);
    return { fails: b.fails, lockoutMs: lockout };
  }

  recordSuccess(identifier: string): void {
    const all = this.read();
    const k = this.id(identifier);
    if (all[k]) {
      delete all[k];
      this.write(all);
    }
  }
}
