import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminLoginComponent {
  email = '';
  password = '';

  loading = false;
  errorMsg = '';
  touched: Record<string, boolean> = {};

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  isEmpty(value: string): boolean {
    return !value || value.trim() === '';
  }

  toggleDarkMode(): void {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    sessionStorage.setItem('theme', isDark ? 'dark' : 'light');
  }

  isDark(): boolean {
    return document.body.classList.contains('dark');
  }

  onBlur(field: string): void {
    this.touched[field] = true;
  }

  isValid(): boolean {
    return !this.isEmpty(this.email) && !this.isEmpty(this.password);
  }

  submit(): void {
    this.errorMsg = '';

    if (!this.isValid()) {
      this.touched = { email: true, password: true };
      return;
    }

    const email = this.email.trim();
    const password = this.password;

    if (!email || !password) {
      this.errorMsg = 'Email and password are required.';
      return;
    }

    this.loading = true;

    this.auth.loginSystemAdmin({ email, password }).subscribe({
      next: (res: any) => {
        const token = res?.token || res?.accessToken || res?.data?.token;

        if (!token) {
          this.loading = false;
          this.errorMsg = 'Authentication succeeded, but no access token was received.';
          this.cdr.markForCheck();
          return;
        }

        this.auth.saveToken(token);
        sessionStorage.setItem('token', token);

        const role =
          res?.admin?.role ||
          res?.user?.role ||
          res?.data?.admin?.role ||
          res?.data?.user?.role ||
          this.auth.getUserFromToken()?.role ||
          'admin';

        sessionStorage.setItem('role', role);

        this.loading = false;
        this.cdr.markForCheck();
        this.router.navigate(['/admin/dashboard'], { replaceUrl: true });
      },
      error: (err: any) => {
        this.loading = false;
        
        // Handle specific error codes if available
        const status = err?.status;
        const message = err?.error?.message?.toLowerCase() || '';

        if (status === 401 || message.includes('invalid') || message.includes('unauthorized')) {
          this.errorMsg = 'Incorrect email or password. Please try again.';
        } else if (status === 403) {
          this.errorMsg = 'You do not have administrative privileges for this workspace.';
        } else if (status === 404) {
          this.errorMsg = 'Admin account not found. Please check your email.';
        } else {
          this.errorMsg = err?.error?.message || 'Access denied. Please contact system support.';
        }

        this.cdr.markForCheck();
      }
    });
  }
}
