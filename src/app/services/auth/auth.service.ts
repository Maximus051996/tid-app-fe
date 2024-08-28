import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor() {}

  getJwtToken(): string | null {
    return localStorage.getItem('token');
  }
}
