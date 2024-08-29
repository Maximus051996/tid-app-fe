import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';

export const authGuardGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.getJwtToken()) {
    console.log('true');
    console.log(state.url);
    if (state.url === '/register-login') {
      router.navigate(['/taskinfo']);
    }
    return true;
  } else {
    router.navigate(['/register-login']);
    console.log('false');
    return false;
  }
};
