import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';

import { CompanyService } from '../../../core/services/company.service';

@Component({
  standalone: true,
  selector: 'app-company-verify-email',
  imports: [CommonModule, FormsModule],
  templateUrl: './company-verify-email.html',
  styleUrl: './company-verify-email.css'
})
export class CompanyVerifyEmailComponent implements OnInit, OnDestroy {
  email = '';
  otp: string[] = ['', '', '', '', ''];

  loading = false;
  errorMessage = '';
  successMessage = '';
  verified = false;
  countdown = 60;
  private timerSub!: Subscription;

  constructor(
    private router: Router,
    private company: CompanyService,
    private cdr: ChangeDetectorRef
  ) {}

  toggleDarkMode(): void {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    sessionStorage.setItem('theme', isDark ? 'dark' : 'light');
  }

  isDark(): boolean {
    return document.body.classList.contains('dark');
  }

  ngOnInit(): void {
    this.email = sessionStorage.getItem('companyEmail') || '';

    if (!this.email) {
      this.router.navigate(['/company-setup'], { replaceUrl: true });
      return;
    }

    this.startTimer();

    setTimeout(() => {
      const firstInput = document.querySelector('.otp-container input') as HTMLElement | null;
      firstInput?.focus();
    }, 100);
  }

  startTimer(): void {
    if (this.timerSub) {
      this.timerSub.unsubscribe();
    }

    this.countdown = 60;
    this.cdr.detectChanges();

    this.timerSub = interval(1000).subscribe(() => {
      if (this.countdown > 0) {
        this.countdown--;
        this.cdr.detectChanges();
      } else {
        this.timerSub.unsubscribe();
      }
    });
  }

  resendOtp(): void {
    if (this.countdown > 0 || this.loading) return;

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    this.company.resendCompanyOtp(this.email).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = 'A new code has been sent to your company email.';
        this.startTimer();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Failed to resend code. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  clearError(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();
  }

  handleInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/[^0-9]/g, '');

    input.value = value;
    this.otp[index] = value;

    if (value && index < 4) {
      (input.nextElementSibling as HTMLElement | null)?.focus();
    }

    if (this.otp.join('').length === 5 && !this.loading) {
      this.verify();
    }
    this.cdr.detectChanges();
  }

  handleKeyDown(event: KeyboardEvent, index: number): void {
    const input = event.target as HTMLInputElement;

    if (event.key === 'Backspace') {
      if (this.otp[index]) {
        this.otp[index] = '';
        input.value = '';
        return;
      }

      if (index > 0) {
        (input.previousElementSibling as HTMLElement | null)?.focus();
      }
    }
    this.cdr.detectChanges();
  }

  verify(): void {
    if (this.loading) {
      return;
    }

    const code = this.otp.join('');

    if (!this.email) {
      this.errorMessage = 'Email is required';
      return;
    }

    if (code.length !== 5) {
      this.errorMessage = 'Enter full OTP';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    // ⏳ Artificial delay to show "Verifying..." state
    setTimeout(() => {
      this.company.verifyCompanyOtp(this.email, code).subscribe({
        next: () => {
          this.loading = false;
          this.verified = true;
          sessionStorage.removeItem('companyEmail');
          sessionStorage.setItem('role', 'employer');
          this.successMessage = 'Company verified successfully! Preparing your dashboard...';
          this.cdr.detectChanges();

          setTimeout(() => {
            this.router.navigate(['/employer/dashboard'], { replaceUrl: true });
          }, 1200);
        },
        error: (err: any) => {
          this.loading = false;
          this.errorMessage =
            err?.error?.message === 'OTP not found'
              ? 'Invalid or expired OTP. Please check the code and try again.'
              : err?.error?.message || 'Something went wrong.';
          this.cdr.detectChanges();
        }
      });
    }, 800);
  }

  ngOnDestroy(): void {
    this.timerSub?.unsubscribe();
  }
}
