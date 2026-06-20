import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { Role } from '../../models/models';
import { DataService } from '../../services/data/data.service';

/**
 * Default guard — requires the user to be logged in.
 * Redirects to the login screen otherwise.
 */
export const authGuardGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    if (state.url === '/register-login') {
      router.navigate(['/taskinfo']);
    }
    return true;
  }

  router.navigate(['/register-login']);
  return false;
};

/**
 * Role guard factory — restricts a route to a set of roles.
 * Usage: canActivate: [roleGuard(['admin'])]
 */
export const roleGuard = (allowed: Role[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const dataService = inject(DataService);
    const router = inject(Router);

    if (!authService.isLoggedIn()) {
      router.navigate(['/register-login']);
      return false;
    }
    const role = authService.getRole();
    if (role && allowed.includes(role)) {
      return true;
    }
    dataService.showerrorToaster(
      'You do not have permission to access this page.'
    );
    router.navigate(['/taskinfo']);
    return false;
  };
};
