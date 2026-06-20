import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UserService } from '../../services/user/user.service';
import { NgxSpinnerModule } from 'ngx-spinner';
import { AuthService } from '../../services/auth/auth.service';
import { DataService } from '../../services/data/data.service';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';

@Component({
  selector: 'app-registerlogin',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, NgxSpinnerModule, BrandLogoComponent],
  templateUrl: './registerlogin.component.html',
  styleUrl: './registerlogin.component.scss',
})
export class RegisterloginComponent implements OnDestroy {
  registerForm: FormGroup;
  loginForm: FormGroup;
  /** true => show login, false => show register */
  isLogin = true;
  showLoginPwd = false;
  showRegisterPwd = false;

  /** Today's calendar tile values for the hero illustration. */
  readonly todayMonth = new Date()
    .toLocaleDateString('en-US', { month: 'short' })
    .toUpperCase();
  readonly todayDay = new Date().getDate();

  private readonly destroy$ = new Subject<void>();

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private userService: UserService,
    private authService: AuthService,
    private dataService: DataService
  ) {
    this.registerForm = this.formBuilder.group({
      userEmail: ['', [Validators.required, Validators.email]],
      phone: [
        '',
        [Validators.required, Validators.pattern('^[0-9]{10}$')],
      ],
      registeruserPassword: ['', [Validators.required, Validators.minLength(6)]],
    });
    this.loginForm = this.formBuilder.group({
      userName: ['', [Validators.required]],
      loginuserPassword: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  toggle(toLogin: boolean): void {
    this.isLogin = toLogin;
  }

  signUp(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.authService.showSpinner();
    const registerDetails = {
      userName: this.registerForm.value.userEmail.split('@')[0],
      userEmail: this.registerForm.value.userEmail,
      phone: this.registerForm.value.phone,
      userPassword: this.registerForm.value.registeruserPassword,
    };
    this.userService
      .registeruser(registerDetails)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.dataService.showSuccessToasterMsg(res.message);
          setTimeout(() => {
            this.isLogin = true;
            this.registerForm.reset();
            this.authService.hideSpinner();
          }, 1200);
        },
        error: (err: Error) => {
          this.dataService.showerrorToaster(err.message);
          this.authService.hideSpinner();
        },
      });
  }

  signIn(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.authService.showSpinner();
    const loginDetails = {
      userName: this.loginForm.value.userName,
      userPassword: this.loginForm.value.loginuserPassword,
    };
    this.userService
      .loginUser(loginDetails)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.authService.setJwtToken(res.token);
          this.dataService.showSuccessToasterMsg('Welcome back!');
          // Navigate immediately — the route's NavigationStart keeps the
          // loader up until the next page is mounted, so there's no flash.
          this.loginForm.reset();
          this.authService.hideSpinner();
          this.router.navigate(['/goals']);
        },
        error: (err: Error) => {
          this.dataService.showerrorToaster(err.message);
          this.authService.hideSpinner();
        },
      });
  }

  fillDemo(role: 'admin' | 'user'): void {
    if (role === 'admin') {
      this.loginForm.setValue({ userName: 'admin', loginuserPassword: 'Admin@123' });
    } else {
      this.loginForm.setValue({ userName: 'demo', loginuserPassword: 'Demo@123' });
    }
    this.isLogin = true;
  }

  get userEmail() { return this.registerForm.get('userEmail'); }
  get phone() { return this.registerForm.get('phone'); }
  get registeruserPassword() { return this.registerForm.get('registeruserPassword'); }
  get userName() { return this.loginForm.get('userName'); }
  get loginuserPassword() { return this.loginForm.get('loginuserPassword'); }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
