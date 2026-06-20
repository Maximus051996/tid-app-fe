import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Thin wrapper around HttpClient that:
 *   - prefixes every URL with the configured API base
 *   - normalizes error messages so component code can show one toast
 *
 * The JWT bearer token is attached by the apiTokenInterceptor at the
 * HttpClient layer, so callers here don't think about auth at all.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  get<T>(path: string): Observable<T> {
    return this.http.get<T>(this.url(path)).pipe(catchError(this.handle));
  }
  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.url(path), body).pipe(catchError(this.handle));
  }
  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(this.url(path), body).pipe(catchError(this.handle));
  }
  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(this.url(path), body).pipe(catchError(this.handle));
  }
  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path)).pipe(catchError(this.handle));
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
