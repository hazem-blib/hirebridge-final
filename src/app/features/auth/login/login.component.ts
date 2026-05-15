import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnDestroy {
  private _email = '';
  get email() { return this._email; }
  set email(v: string) {
    this._email = v;
    if (this.errorMsg) {
      this.errorMsg = '';
      this.cdr.markForCheck();
    }
  }

  private _password = '';
  get password() { return this._password; }
  set password(v: string) {
    this._password = v;
    if (this.errorMsg) {
      this.errorMsg = '';
      this.cdr.markForCheck();
    }
  }

  loading = false;
  errorMsg = '';
  touched: Record<string, boolean> = {};
  private brandMarkTapCount = 0;
  private brandMarkTapTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    public cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    if (this.brandMarkTapTimer) {
      clearTimeout(this.brandMarkTapTimer);
      this.brandMarkTapTimer = null;
    }
  }

  onBrandMarkClick(): void {
    this.brandMarkTapCount += 1;

    if (this.brandMarkTapTimer) {
      clearTimeout(this.brandMarkTapTimer);
    }

    this.brandMarkTapTimer = setTimeout(() => {
      this.brandMarkTapCount = 0;
      this.brandMarkTapTimer = null;
    }, 1000);

    if (this.brandMarkTapCount === 3) {
      this.brandMarkTapCount = 0;
      if (this.brandMarkTapTimer) {
        clearTimeout(this.brandMarkTapTimer);
        this.brandMarkTapTimer = null;
      }
      this.router.navigate(['/admin-login']);
    }
  }

  toggleDarkMode(): void {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    sessionStorage.setItem('theme', isDark ? 'dark' : 'light');
  }

  isDark(): boolean {
    return document.body.classList.contains('dark');
  }

  clearError() {
    if (this.errorMsg) {
      this.errorMsg = '';
      this.cdr.markForCheck();
    }
  }

  isEmpty(value: string): boolean {
    return !value || value.trim() === '';
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
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.auth.login({
      email: this.email,
      password: this.password
    }).subscribe({

      next: (res: any) => {
        // ✅ TOKEN
        const token = res?.token || res?.accessToken || res?.data?.token;

        if (!token) {
          this.loading = false;
          this.errorMsg = 'No token received from server.';
          this.cdr.markForCheck();
          return;
        }

        this.auth.saveToken(token);
        sessionStorage.setItem('token', token);

        const role =
          res?.user?.role ||
          res?.data?.user?.role ||
          this.auth.getUserFromToken()?.role ||
          'candidate';
        sessionStorage.setItem('role', role);

        if (role === 'employer') {
          this.auth.fetchAndStoreCompanyId().subscribe({
            next: () => {
              this.loading = false;
              this.cdr.markForCheck();
              this.router.navigate(['/employer/dashboard'], { replaceUrl: true });
            },
            error: () => {
              this.loading = false;
              this.cdr.markForCheck();
              this.router.navigate(['/employer/dashboard'], { replaceUrl: true });
            }
          });
        } else {
          this.loading = false;
          this.cdr.markForCheck();
          this.router.navigate(['/dashboard'], { replaceUrl: true });
        }
      },

      error: (err: any) => {
        this.loading = false;
        const serverMsg = err?.error?.message || '';
        
        // If server returns a generic internal error or 500, show a friendly auth error instead
        if (serverMsg.toLowerCase().includes('internal server error') || err.status === 500) {
          this.errorMsg = 'User not found or password is incorrect. Please check your credentials.';
        } else {
          this.errorMsg = serverMsg || 'Invalid email or password. Please try again.';
        }
        
        this.cdr.markForCheck();
      }
    });
  }
}
