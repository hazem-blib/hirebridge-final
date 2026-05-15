import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

import { ChangeDetectorRef } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-signup',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sign-up.component.html',
  styleUrl: './sign-up.component.css'
})
export class SignupComponent {

  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  phone = '';

  loading = false;
  success = false;
  errorMsg = '';

  touched: any = {};

  constructor(
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  isEmpty(value: string) {
    return !value || value.trim() === '';
  }

  onBlur(field: string) {
    this.touched[field] = true;
  }

  toggleDarkMode(): void {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    sessionStorage.setItem('theme', isDark ? 'dark' : 'light');
    this.cdr.detectChanges();
  }

  clearError() {
    if (this.errorMsg) {
      this.errorMsg = '';
      this.cdr.detectChanges();
    }
  }

  isDark(): boolean {
    return document.body.classList.contains('dark');
  }

  markAllTouched() {
    this.touched = {
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
      phone: true
    };
  }

  isValid(): boolean {
    return !(
      this.isEmpty(this.name) ||
      this.isEmpty(this.email) ||
      this.isEmpty(this.password) ||
      this.isEmpty(this.confirmPassword) ||
      this.isEmpty(this.phone) ||
      this.password.length < 6 ||
      this.password !== this.confirmPassword
    );
  }

  submit() {

    this.errorMsg = '';

    if (!this.isValid()) {
      this.markAllTouched();
      return;
    }

    const fullName = this.name.trim().split(' ');

    const data = {
      email: this.email,
      password: this.password,
      firstName: fullName[0],
      LastName: fullName.slice(1).join(' ') || '',
      PhoneNumber: this.phone
    };

    this.loading = true;

    this.auth.register(data).subscribe({

      next: (res: any) => {
        this.loading = false;
        this.success = true;

        // 🔥 خزّن الإيميل بس
        sessionStorage.setItem('signupEmail', this.email);
        this.cdr.detectChanges();

        setTimeout(() => {
          this.router.navigate(['/verify-email']);
        }, 400);
      },

      error: (err: any) => {
        this.loading = false;
        
        if (err.status === 409) {
          this.errorMsg = 'This email is already registered. Please try logging in instead.';
        } else {
          this.errorMsg = err?.error?.message || 'Registration failed. Please check your details.';
        }
        
        this.cdr.detectChanges();
      }
    });
  }

  onlyNumbers(event: KeyboardEvent) {
    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', '+', ' '];
    const isNumber = /[0-9]/.test(event.key);
    
    if (!isNumber && !allowedKeys.includes(event.key)) {
      event.preventDefault();
    }
  }
}
