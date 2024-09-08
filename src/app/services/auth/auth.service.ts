import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private router: Router, private spinner: NgxSpinnerService) {}

  getJwtToken(): string | null {
    return localStorage.getItem('token');
  }

  setJwtToken(token: any): any {
    localStorage.setItem('token', token);
  }

  removeJwtToken(): any {
    this.showSpinner();
    localStorage.removeItem('token');
    setTimeout(() => {
      this.router.navigate(['/register-login']);
      this.hideSpinner();
    }, 1000);
  }

  autologOut(): any {
    setTimeout(() => {
      this.removeJwtToken();
    }, 1800000);
  }

  showSpinner() {
    return this.spinner.show();
  }

  hideSpinner() {
    return this.spinner.hide();
  }

  parseJwt(token: string): any {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );

    return JSON.parse(jsonPayload);
  }

  getUserName(): string | null {
    const token = this.getJwtToken();

    if (!token) {
      return null; // If there's no token, return null
    }

    const decodedToken = this.parseJwt(token);

    return decodedToken?.userName || null;
  }
}
