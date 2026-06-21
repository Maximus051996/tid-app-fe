import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoaderService } from '../../services/loader/loader.service';
import { environment } from '../../../environments/environment';

/**
 * Per-request opt-out for the global loader. Set this on an HttpContext
 * (via `ApiService.{get,post,...}({ silent: true })`) for background polling
 * or other "quiet" calls that should not flash the spinner.
 */
export const SKIP_LOADER = new HttpContextToken<boolean>(() => false);

/**
 * Show the global loader while any HTTP request to our API is in flight.
 * Uses the LoaderService counter so concurrent requests stack cleanly —
 * the spinner only hides once every in-flight call has finished.
 *
 * Skipped automatically for non-API URLs (CDN, fonts) and for any request
 * that opts out via the `SKIP_LOADER` HttpContext token.
 */
export const loaderInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiCall = req.url.startsWith(environment.apiBaseUrl);
  const skip = req.context.get(SKIP_LOADER);
  if (!isApiCall || skip) return next(req);

  const loader = inject(LoaderService);
  loader.show();
  return next(req).pipe(finalize(() => loader.hide()));
};
