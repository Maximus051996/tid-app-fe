import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, Subject } from 'rxjs';
import { AuthSession, Role, User } from '../../models/models';
import { LoaderService } from '../loader/loader.service';
import { ApiService } from '../api/api.service';

const TOKEN_KEY = 'tid.token.v3'; // bumped from v2 (PASETO local-only) to v3 (HS256 JWT from API)

interface LoginResponse {
  token: string;
  user: User;
  message: string;
}

interface MeResponse {
  user: User;
}

/**
 * Frontend auth bridge to the backend.
 *
 * The server issues a 30-min HS256 JWT on login. This service caches the
 * raw token + the decoded session in memory, persists the raw token in
 * localStorage so refreshes don't kick the user out, and exposes a
 * synchronous read API the rest of the app already depends on.
 *
 * The backend is the only thing that can mint or invalidate a token —
 * the client never tries to "verify" anything itself; it just trusts
 * what the server stamped.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private cachedToken: string | null = null;
  private cachedSession: AuthSession | null = null;
  private logoutTimer: ReturnType<typeof setTimeout> | null = null;
  private logoutNavTimer: ReturnType<typeof setTimeout> | null = null;

  /** Long-lived services subscribe so they can tear themselves down on logout. */
  private readonly loggedOutSubject = new Subject<void>();
  readonly loggedOut$ = this.loggedOutSubject.asObservable();

  constructor(
    private router: Router,
    private loader: LoaderService,
    private api: ApiService
  ) {}

  /** Awaited from APP_INITIALIZER. Re-validates a cached token against the server. */
  async init(): Promise<void> {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return;

    const decoded = this.decodeJwt(raw);
    if (!decoded) {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }

    // Cache before /me so the interceptor attaches the token.
    this.cachedToken = raw;
    this.cachedSession = decoded;

    try {
      // Confirm with the server that the token is still valid (account not deleted, etc.)
      const res = await firstValueFrom(this.api.get<MeResponse>('/auth/me'));
      // Refresh role/userName from the server in case admin changed them.
      this.cachedSession = {
        ...decoded,
        userId: res.user.id,
        userName: res.user.userName,
        role: res.user.role,
      };
      this.scheduleAutoLogout(decoded.expiresAt);
    } catch {
      // Either the token expired or the server rejected it — clear and continue.
      this.clearSession();
    }
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

  /** Components used to call this after login. The login() method now caches directly,
   *  so this only needs to schedule auto-logout. Kept for source compatibility. */
  setJwtToken(_token: string): void {
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
    }, 400);
  }

  /** Backwards-compat — auto-logout is handled internally now. */
  autologOut(): void {
    if (this.cachedSession) this.scheduleAutoLogout(this.cachedSession.expiresAt);
  }

  showSpinner() { return this.loader.show(); }
  hideSpinner() { return this.loader.hide(); }

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

  /** Hits POST /api/auth/register. Returns the new user (no auto-login). */
  async register(input: {
    userName?: string;
    userEmail: string;
    phone: string;
    userPassword: string;
  }): Promise<User> {
    const res = await firstValueFrom(
      this.api.post<{ user: User; message: string }>('/auth/register', input)
    );
    return res.user;
  }

  /** Hits POST /api/auth/login. Returns the issued token. */
  async login(identifier: string, password: string): Promise<string> {
    const res = await firstValueFrom(
      this.api.post<LoginResponse>('/auth/login', {
        userName: identifier,
        userPassword: password,
      })
    );

    const decoded = this.decodeJwt(res.token);
    if (!decoded) throw new Error('Server returned an unreadable token.');

    // Refresh user fields from the response payload (more authoritative than the JWT body).
    const session: AuthSession = {
      userId: res.user.id,
      userName: res.user.userName,
      role: res.user.role,
      issuedAt: decoded.issuedAt,
      expiresAt: decoded.expiresAt,
    };

    localStorage.setItem(TOKEN_KEY, res.token);
    this.cachedToken = res.token;
    this.cachedSession = session;
    this.scheduleAutoLogout(session.expiresAt);
    return res.token;
  }

  /** Change the current user's password. Server bumps tokenVersion → re-login required. */
  async changePassword(currentPassword: string, newPassword: string): Promise<string> {
    const res = await firstValueFrom(
      this.api.post<{ message: string }>('/auth/change-password', {
        currentPassword,
        newPassword,
      })
    );
    // Invalidate locally too — the server already revoked our token.
    this.removeJwtToken();
    return res.message;
  }

  /** Revoke every session this user has anywhere. */
  async logoutEverywhere(): Promise<string> {
    const res = await firstValueFrom(
      this.api.post<{ message: string }>('/auth/logout-everywhere', {})
    );
    this.removeJwtToken();
    return res.message;
  }

  // ---------- Internals ----------

  /** Lightweight, non-verifying decode so we know when to log the user out. */
  private decodeJwt(token: string): AuthSession | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(this.b64urlToString(parts[1]));
      const exp = typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
      const iat = typeof payload.iat === 'number' ? payload.iat * 1000 : Date.now();
      if (!exp || exp < Date.now()) return null;
      return {
        userId: String(payload.sub ?? ''),
        userName: String(payload.userName ?? ''),
        role: payload.role === 'admin' ? 'admin' : 'user',
        issuedAt: iat,
        expiresAt: exp,
      };
    } catch {
      return null;
    }
  }

  private b64urlToString(s: string): string {
    let str = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (str.length % 4)) % 4;
    str += '='.repeat(pad);
    return decodeURIComponent(
      atob(str)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  }

  /** Legacy alias kept so older parseJwt callsites compile. */
  parseJwt(token: string): AuthSession | null {
    return this.decodeJwt(token);
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
}
