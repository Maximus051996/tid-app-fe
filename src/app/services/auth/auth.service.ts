import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthSession, Role, User } from '../../models/models';
import { StorageService } from '../storage/storage.service';
import { LoaderService } from '../loader/loader.service';
import { pasetoDecrypt, pasetoEncrypt } from '../security/paseto';
import { SecretStoreService } from '../security/secret-store';
import { hashPassword, verifyPassword } from '../security/password';
import { LoginThrottleService } from '../security/login-throttle';
import { pbkdf2 } from '../security/crypto-utils';

const TOKEN_KEY = 'tid.token.v2';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const TOKEN_FOOTER = 'tid';
const TOKEN_IMPLICIT = 'tid.app.v1';

/**
 * Frontend-only auth: registration, login, logout, role/ownership checks.
 *
 * Tokens are PASETO v3.local — symmetric authenticated encryption. The
 * device key lives in localStorage (see SecretStoreService) so anyone with
 * full device access can still mint tokens; what we DO get is:
 *   - tamper detection (modifying ciphertext invalidates the auth tag)
 *   - confidentiality at rest (no plaintext claims in localStorage)
 *   - cross-device portability blocked (a token copied without the key is useless)
 *
 * Passwords are PBKDF2-SHA-256 (200k iterations, per-user salt). Login
 * attempts are throttled with exponential backoff per identifier.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private logoutTimer: ReturnType<typeof setTimeout> | null = null;
  private logoutNavTimer: ReturnType<typeof setTimeout> | null = null;

  /** Cached session decrypted on demand to avoid awaiting on every call. */
  private cachedSession: AuthSession | null = null;
  private cachedToken: string | null = null;

  /** Emits whenever the user logs out. Long-lived services subscribe to clean themselves up. */
  private readonly loggedOutSubject = new Subject<void>();
  readonly loggedOut$ = this.loggedOutSubject.asObservable();

  constructor(
    private router: Router,
    private storage: StorageService,
    private loader: LoaderService,
    private secrets: SecretStoreService,
    private throttle: LoginThrottleService
  ) {}

  /** Awaited from APP_INITIALIZER so the rest of the app can call sync session helpers. */
  async init(): Promise<void> {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return;
    const session = await this.tryDecryptToken(raw);
    if (!session || session.expiresAt < Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    this.cachedToken = raw;
    this.cachedSession = session;
    this.scheduleAutoLogout(session.expiresAt);
  }

  // ---------- Token helpers ----------

  getJwtToken(): string | null {
    if (!this.cachedToken || !this.cachedSession) return null;
    if (this.cachedSession.expiresAt < Date.now()) {
      this.clearSession();
      return null;
    }
    return this.cachedToken;
  }

  /** Backwards-compat: components call this after login. We've already cached, so this is a no-op. */
  setJwtToken(_token: string): void {
    // Token already persisted by login(). Re-running scheduleAutoLogout is safe.
    if (this.cachedSession) this.scheduleAutoLogout(this.cachedSession.expiresAt);
  }

  removeJwtToken(): void {
    this.showSpinner();
    this.clearSession();
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = null;
    }
    this.loggedOutSubject.next();

    if (this.logoutNavTimer) clearTimeout(this.logoutNavTimer);
    this.logoutNavTimer = setTimeout(() => {
      this.router.navigate(['/register-login']);
      this.hideSpinner();
      this.loader.forceHide();
      this.logoutNavTimer = null;
    }, 600);
  }

  /** Kept for backward compatibility — auto-logout is now handled internally. */
  autologOut(): void {
    if (this.cachedSession) this.scheduleAutoLogout(this.cachedSession.expiresAt);
  }

  private clearSession(): void {
    this.cachedSession = null;
    this.cachedToken = null;
    localStorage.removeItem(TOKEN_KEY);
  }

  private scheduleAutoLogout(expiresAt: number): void {
    const remaining = expiresAt - Date.now();
    if (this.logoutTimer) clearTimeout(this.logoutTimer);
    if (remaining <= 0) {
      this.removeJwtToken();
      return;
    }
    this.logoutTimer = setTimeout(() => this.removeJwtToken(), remaining);
  }

  showSpinner() {
    return this.loader.show();
  }
  hideSpinner() {
    return this.loader.hide();
  }

  // ---------- Session info ----------

  getSession(): AuthSession | null {
    if (!this.cachedSession) return null;
    if (this.cachedSession.expiresAt < Date.now()) {
      this.clearSession();
      return null;
    }
    return this.cachedSession;
  }

  getUserId(): string | null {
    return this.getSession()?.userId ?? null;
  }

  getUserName(): string | null {
    return this.getSession()?.userName ?? null;
  }

  getRole(): Role | null {
    return this.getSession()?.role ?? null;
  }

  isAdmin(): boolean {
    return this.getRole() === 'admin';
  }

  isLoggedIn(): boolean {
    return this.getJwtToken() !== null;
  }

  // ---------- Auth actions ----------

  /** Register a new user. Throws if userName or email already exists. */
  async register(input: {
    userName: string;
    userEmail: string;
    phone: string;
    userPassword: string;
  }): Promise<User> {
    const users = this.storage.getUsers();
    const userName = input.userName.trim().toLowerCase();
    const userEmail = input.userEmail.trim().toLowerCase();

    if (users.some((u) => u.userName.toLowerCase() === userName)) {
      throw new Error('Username already exists');
    }
    if (users.some((u) => u.userEmail.toLowerCase() === userEmail)) {
      throw new Error('Email is already registered');
    }
    if (!this.isPasswordStrong(input.userPassword)) {
      throw new Error(
        'Password must be at least 8 characters with letters and numbers.'
      );
    }

    const newUser: User = {
      id: 'u-' + Date.now().toString(36),
      userName,
      userEmail,
      phone: input.phone.trim(),
      userPassword: await hashPassword(input.userPassword),
      role: 'user',
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    this.storage.saveUsers(users);
    return newUser;
  }

  /** Login by username (or email) + password. Returns the issued PASETO token. */
  async login(identifier: string, password: string): Promise<string> {
    const id = identifier.trim().toLowerCase();

    const remaining = this.throttle.remainingLockoutMs(id);
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      throw new Error(
        `Too many failed attempts. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`
      );
    }

    const users = this.storage.getUsers();
    const user = users.find(
      (u) => u.userName.toLowerCase() === id || u.userEmail.toLowerCase() === id
    );
    if (!user) {
      // Run a real PBKDF2 of similar cost to keep response timing flat
      // regardless of whether the username exists.
      await pbkdf2(password, new Uint8Array(16), 200_000, 32);
      this.throttle.recordFailure(id);
      throw new Error('Invalid username or password.');
    }

    const ok = await verifyPassword(password, user.userPassword);
    if (!ok) {
      this.throttle.recordFailure(id);
      throw new Error('Invalid username or password.');
    }

    this.throttle.recordSuccess(id);

    const session: AuthSession = {
      userId: user.id,
      userName: user.userName,
      role: user.role,
      issuedAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    };

    const token = await pasetoEncrypt(session, this.secrets.getDeviceKey(), {
      footer: TOKEN_FOOTER,
      implicit: TOKEN_IMPLICIT,
    });
    localStorage.setItem(TOKEN_KEY, token);
    this.cachedToken = token;
    this.cachedSession = session;
    this.scheduleAutoLogout(session.expiresAt);
    return token;
  }

  // ---------- PASETO helpers ----------

  /** Used by interceptors / boot init. Returns null on tamper or expiry. */
  async parseToken(token: string): Promise<AuthSession | null> {
    return this.tryDecryptToken(token);
  }

  /** Legacy alias kept so the older `parseJwt` callsites compile. */
  parseJwt(_token: string): AuthSession | null {
    return this.cachedSession;
  }

  private async tryDecryptToken(token: string): Promise<AuthSession | null> {
    try {
      return await pasetoDecrypt<AuthSession>(token, this.secrets.getDeviceKey(), {
        footer: TOKEN_FOOTER,
        implicit: TOKEN_IMPLICIT,
      });
    } catch {
      return null;
    }
  }

  private isPasswordStrong(p: string): boolean {
    if (p.length < 8) return false;
    return /[A-Za-z]/.test(p) && /\d/.test(p);
  }
}
