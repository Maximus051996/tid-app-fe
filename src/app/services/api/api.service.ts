import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { SKIP_LOADER } from '../../middlewares/intercept/loader.interceptor';

/** Per-call options that apply to any verb. */
export interface ApiCallOptions {
  /**
   * If true, suppress the global loader for this request. Use for
   * background polling, silent refreshes, or anywhere a spinner flash
   * would be jarring.
   */
  silent?: boolean;
}

/**
 * Thin wrapper around HttpClient that:
 *   - prefixes every URL with the configured API base
 *   - normalizes error messages so component code can show one toast
 *   - lets callers opt out of the global loader on a per-request basis
 *
 * The JWT bearer token is attached by the interceptor at the HttpClient
 * layer, so callers here don't think about auth at all.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  get<T>(path: string, opts?: ApiCallOptions): Observable<T> {
    return this.http
      .get<T>(this.url(path), { context: this.ctx(opts) })
      .pipe(catchError(this.handle));
  }
  post<T>(path: string, body: unknown, opts?: ApiCallOptions): Observable<T> {
    return this.http
      .post<T>(this.url(path), body, { context: this.ctx(opts) })
      .pipe(catchError(this.handle));
  }
  put<T>(path: string, body: unknown, opts?: ApiCallOptions): Observable<T> {
    return this.http
      .put<T>(this.url(path), body, { context: this.ctx(opts) })
      .pipe(catchError(this.handle));
  }
  patch<T>(path: string, body: unknown, opts?: ApiCallOptions): Observable<T> {
    return this.http
      .patch<T>(this.url(path), body, { context: this.ctx(opts) })
      .pipe(catchError(this.handle));
  }
  delete<T>(path: string, opts?: ApiCallOptions): Observable<T> {
    return this.http
      .delete<T>(this.url(path), { context: this.ctx(opts) })
      .pipe(catchError(this.handle));
  }

  private ctx(opts?: ApiCallOptions): HttpContext {
    const ctx = new HttpContext();
    if (opts?.silent) ctx.set(SKIP_LOADER, true);
    return ctx;
  }

  private url(path: string): string {
    if (path.startsWith('http')) return path;
    return environment.apiBaseUrl.replace(/\/+$/, '') + (path.startsWith('/') ? path : '/' + path);
  }

  private handle = (err: HttpErrorResponse) => {
    const message =
      err.error?.error ??
      err.error?.message ??
      err.message ??
      'Network error — please try again.';
    return throwError(() => new Error(message));
  };
}
