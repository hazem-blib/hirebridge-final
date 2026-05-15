import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-admin-sign-up',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-sign-up.component.html',
  styleUrls: ['./admin-sign-up.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminSignUpComponent {
  fullName = '';
  email = '';
  phone = '';
  password = '';
  confirmPassword = '';

  loading = false;
  errorMsg = '';
  touched: Record<string, boolean> = {};

  constructor(private readonly router: Router) {}

  isEmpty(value: string): boolean {
    return !value || value.trim() === '';
  }

  onBlur(field: string): void {
    this.touched[field] = true;
  }

  toggleDarkMode(): void {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    sessionStorage.setItem('theme', isDark ? 'dark' : 'light');
  }

  isDark(): boolean {
    return document.body.classList.contains('dark');
  }

  markAllTouched(): void {
    this.touched = {
      fullName: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true
    };
  }

  isValid(): boolean {
    return !(
      this.isEmpty(this.fullName) ||
      this.isEmpty(this.email) ||
      this.isEmpty(this.phone) ||
      this.isEmpty(this.password) ||
      this.isEmpty(this.confirmPassword) ||
      this.password.length < 6 ||
      this.password !== this.confirmPassword
    );
  }

  submit(): void {
    this.errorMsg = '';

    if (!this.isValid()) {
      this.markAllTouched();
      return;
    }

    this.loading = true;

    // Temporary fake admin signup flow until backend auth is wired.
    setTimeout(() => {
      this.loading = false;
      sessionStorage.setItem('pendingAdminEmail', this.email.trim());
      this.router.navigate(['/admin-login'], { replaceUrl: true });
    }, 500);
  }
}
