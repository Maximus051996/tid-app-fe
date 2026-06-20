import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { interceptInterceptor } from './middlewares/intercept/intercept.interceptor';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideToastr } from 'ngx-toastr';
import { StorageService } from './services/storage/storage.service';
import { AuthService } from './services/auth/auth.service';
import { IdleTimeoutService } from './services/auth/idle-timeout.service';

/**
 * Boot order:
 *   1. (legacy) StorageService.init — now a no-op shim
 *   2. AuthService.init — re-validate any stored token against /auth/me
 *   3. IdleTimeoutService.start — arm idle auto-logout
 */
function initSecurity(
  storage: StorageService,
  auth: AuthService,
  idle: IdleTimeoutService
) {
  return async () => {
    await storage.init();
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
    provideHttpClient(withInterceptors([interceptInterceptor])),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [StorageService, AuthService, IdleTimeoutService],
      useFactory: initSecurity,
    },
  ],
};
