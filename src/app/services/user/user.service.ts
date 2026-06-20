import { Injectable } from '@angular/core';
import { defer, Observable, from } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { StorageService } from '../storage/storage.service';
import { User } from '../../models/models';

/**
 * Thin wrapper that exposes register/login as Observables so the existing
 * components don't have to change their subscription patterns.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(
    private auth: AuthService,
    private storage: StorageService
  ) {}

  registeruser(payload: {
    userName: string;
    userEmail: string;
    phone: string;
    userPassword: string;
  }): Observable<{ message: string; user: Omit<User, 'userPassword'> }> {
    return from(
      this.auth.register(payload).then((user) => {
        const { userPassword, ...safe } = user;
        return {
          message: 'Registration successful. Please log in.',
          user: safe,
        };
      })
    );
  }

  loginUser(payload: {
    userName: string;
    userPassword: string;
  }): Observable<{ token: string; message: string }> {
    return from(
      this.auth
        .login(payload.userName, payload.userPassword)
        .then((token) => ({ token, message: 'Login successful' }))
    );
  }

  /** Admin-only: list every user (without password). */
  getAllUsers(): Observable<Omit<User, 'userPassword'>[]> {
    return defer(() =>
      Promise.resolve(
        this.storage.getUsers().map(({ userPassword, ...rest }) => rest)
      )
    );
  }
}
