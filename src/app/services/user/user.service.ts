import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ApiService } from '../api/api.service';
import { User } from '../../models/models';

/**
 * Observable wrappers around the auth + admin user endpoints. Components
 * already subscribe to these shapes; we keep them stable and let the
 * underlying calls hit the API.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private auth: AuthService, private api: ApiService) {}

  registeruser(payload: {
    userName: string;
    userEmail: string;
    phone: string;
    userPassword: string;
  }): Observable<{ message: string; user: Omit<User, 'userPassword'> }> {
    return from(
      this.auth.register(payload).then((user) => ({
        message: 'Registration successful. Please log in.',
        user: user as Omit<User, 'userPassword'>,
      }))
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

  /** Admin-only — full directory. */
  getAllUsers(): Observable<Omit<User, 'userPassword'>[]> {
    return this.api.get<Omit<User, 'userPassword'>[]>('/users');
  }

  /** Admin-only — toggle role. */
  setRole(id: string, role: 'admin' | 'user'): Observable<{ user: Omit<User, 'userPassword'> }> {
    return this.api.patch<{ user: Omit<User, 'userPassword'> }>(`/users/${id}/role`, { role });
  }

  /** Admin-only — wipe a user's data without deleting the account. */
  wipeUserData(
    id: string
  ): Observable<{ message: string; counts: Record<string, number> }> {
    return this.api.post<{ message: string; counts: Record<string, number> }>(
      `/users/${id}/wipe-data`,
      {}
    );
  }

  /** Admin-only — delete a user and cascade-remove their data. */
  removeUser(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/users/${id}`);
  }
}
