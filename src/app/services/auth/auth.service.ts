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
}
