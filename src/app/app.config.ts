import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { interceptInterceptor } from './middlewares/intercept/intercept.interceptor';
import { loaderInterceptor } from './middlewares/intercept/loader.interceptor';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideToastr } from 'ngx-toastr';
import { AuthService } from './services/auth/auth.service';
import { IdleTimeoutService } from './services/auth/idle-timeout.service';

/**
 * Boot order:
 *   1. AuthService.init — re-validate any stored token against /auth/me
 *   2. IdleTimeoutService.start — arm idle auto-logout
 */
function initSecurity(auth: AuthService, idle: IdleTimeoutService) {
  return async () => {
    await auth.init();
    idle.start();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideToastr(),
    // Order matters: auth interceptor runs first to attach the bearer token,
    // then the loader interceptor wraps the request with show/hide.
    provideHttpClient(
      withInterceptors([interceptInterceptor, loaderInterceptor])
    ),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [AuthService, IdleTimeoutService],
      useFactory: initSecurity,
    },
  ],
};
