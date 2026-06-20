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

/**
 * Boot order: warm encrypted storage cache, then validate any persisted token.
 * Both are awaited before the router activates routes so guards see a stable
 * isLoggedIn() answer immediately.
 */
function initSecurity(storage: StorageService, auth: AuthService) {
  return async () => {
    await storage.init();
    await auth.init();
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
      deps: [StorageService, AuthService],
      useFactory: initSecurity,
    },
  ],
};
