import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Attach the bearer token on every request to our API origin and handle
 * 401s by clearing the session and bouncing the user back to the login.
 *
 * We deliberately do NOT add the token to third-party requests (CDN
 * fonts, etc.) — only to URLs that hit our API base.
 */
export const interceptInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isApiCall = req.url.startsWith(environment.apiBaseUrl);
  const token = authService.getJwtToken();

  const headers: Record<string, string> = {};
  if (isApiCall && token) headers['Authorization'] = `Bearer ${token}`;

  const cloned = Object.keys(headers).length ? req.clone({ setHeaders: headers }) : req;

  return next(cloned).pipe(
    catchError((err: HttpErrorResponse) => {
      // Server says our token is no good — clear it and send the user home.
      if (isApiCall && err.status === 401) {
        authService.removeJwtToken();
        router.navigate(['/register-login']);
      }
      return throwError(() => err);
    })
  );
};
