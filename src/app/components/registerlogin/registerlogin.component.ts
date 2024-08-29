import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../services/user/user.service';
import { NgxSpinnerModule } from 'ngx-spinner';
import { AuthService } from '../../services/auth/auth.service';
@Component({
  selector: 'app-registerlogin',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, NgxSpinnerModule],
  templateUrl: './registerlogin.component.html',
  styleUrl: './registerlogin.component.scss',
})
export class RegisterloginComponent {
  message: any;
  registerForm: FormGroup;
  isLogin: boolean = true;
  isregister: boolean = false;
  loginForm: FormGroup;
  isMessage: boolean = false;
  isLoader: boolean = false;
  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private userService: UserService,
    private authService: AuthService
  ) {
    this.registerForm = this.formBuilder.group({
      userEmail: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]*$')]],
      registeruserPassword: [
        '',
        [Validators.required, Validators.minLength(6)],
      ],
    });
    this.loginForm = this.formBuilder.group({
      userName: ['', [Validators.required]],
      loginuserPassword: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  signUp() {
    this.isregister = true;
    this.isLogin = false;
    if (this.registerForm.valid) {
      this.authService.showSpinner();
      this;
      let registerDetails = {
        userName: this.registerForm.value.userEmail.split('@')[0],
        userEmail: this.registerForm.value.userEmail,
        phone: this.registerForm.value.phone,
        userPassword: this.registerForm.value.registeruserPassword,
      };
      const responseObservable = this.userService.registeruser(registerDetails);
      responseObservable.subscribe((res: any) => {
        this.isMessage = true;
        this.message = res.message;
        setTimeout(() => {
          this.isregister = false;
          this.isLogin = true;
          this.registerForm.reset();
          this.isMessage = false;
          this.authService.hideSpinner();
        }, 2000);
      });
    }
  }

  signIn() {
    this.isregister = false;
    this.isLogin = true;
    if (this.loginForm.valid) {
      this.authService.showSpinner();
      let loginDetails = {
        userName: this.loginForm.value.userName,
        userPassword: this.loginForm.value.loginuserPassword,
      };
      const responseObservable = this.userService.loginUser(loginDetails);
      responseObservable.subscribe(
        (res: any) => {
          this.authService.setJwtToken(res.token);
          this.isMessage = true;
          this.message = 'Login Successful';
          setTimeout(() => {
            this.loginForm.reset();
            this.isMessage = false;
            this.authService.hideSpinner();
            this.router.navigate(['taskinfo']);
          }, 2000);
          this.authService.autologOut();
        },
        (err) => {
          this.isMessage = true;
          this.message = err.message;
          setTimeout(() => {
            this.loginForm.reset();
            this.isMessage = false;
            this.authService.hideSpinner();
          }, 2000);
        }
      );
    }
  }

  get userEmail() {
    return this.registerForm.get('userEmail');
  }

  get phone() {
    return this.registerForm.get('phone');
  }

  get registeruserPassword() {
    return this.registerForm.get('registeruserPassword');
  }

  get userName() {
    return this.loginForm.get('userName');
  }

  get loginuserPassword() {
    return this.loginForm.get('loginuserPassword');
  }
}
