import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { AuthService } from './auth.service';

const IDLE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes of inactivity → logout
const ACTIVITY_EVENTS: Array<keyof DocumentEventMap> = [
  'mousedown',
  'keydown',
  'touchstart',
  'visibilitychange',
];

/**
 * Watches user activity and signs them out after `IDLE_LIMIT_MS` of
 * inactivity. The token TTL on the server still applies — this is an
 * extra layer that protects the screen if a user walks away.
 *
 * Boots from APP_INITIALIZER alongside auth. A no-op if no one is
 * logged in; arms itself as soon as a token appears.
 */
@Injectable({ providedIn: 'root' })
export class IdleTimeoutService implements OnDestroy {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listener = () => this.reset();
  private wired = false;

  constructor(private auth: AuthService, private zone: NgZone) {}

  /** Idempotent — safe to call from APP_INITIALIZER. */
  start(): void {
    if (this.wired) return;
    this.wired = true;
    this.zone.runOutsideAngular(() => {
      for (const ev of ACTIVITY_EVENTS) {
        document.addEventListener(ev, this.listener, { passive: true });
      }
    });
    this.reset();
  }

  ngOnDestroy(): void {
    for (const ev of ACTIVITY_EVENTS) {
      document.removeEventListener(ev, this.listener);
    }
    if (this.timer) clearTimeout(this.timer);
    this.wired = false;
  }

  private reset(): void {
    if (this.timer) clearTimeout(this.timer);
    if (!this.auth.isLoggedIn()) return;
    this.timer = setTimeout(() => {
      this.zone.run(() => {
        if (this.auth.isLoggedIn()) this.auth.removeJwtToken();
      });
    }, IDLE_LIMIT_MS);
  }
}
