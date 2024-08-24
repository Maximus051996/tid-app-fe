import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
@Component({
  selector: 'app-registerlogin',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './registerlogin.component.html',
  styleUrl: './registerlogin.component.scss',
})
export class RegisterloginComponent {
  loginregisterForm: FormGroup;

  constructor(private formBuilder: FormBuilder, private router: Router) {
    this.loginregisterForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]*$')]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  onSubmit() {
    // if (this.loginregisterForm.valid) {
    //   console.log('Form Submitted', this.loginregisterForm.value);
    // } else {
    //   this.loginregisterForm.markAllAsTouched();
    // }
    this.router.navigate(['taskinfo']);
  }

  get email() {
    return this.loginregisterForm.get('email');
  }

  get phone() {
    return this.loginregisterForm.get('phone');
  }

  get password() {
    return this.loginregisterForm.get('password');
  }
}
