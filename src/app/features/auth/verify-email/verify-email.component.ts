import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-verify-email',
  imports: [CommonModule, FormsModule],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.css'
})
export class VerifyEmailComponent implements OnInit, OnDestroy {

  email: string = '';
  otp: string[] = ['', '', '', '', ''];

  loading = false;
  errorMessage = '';
  successMessage = '';
  verified = false;

  countdown = 60;
  private timerSub!: Subscription;

  constructor(
    private router: Router,
    private auth: AuthService,
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

  ngOnInit() {
    this.email = sessionStorage.getItem('signupEmail') || '';

    if (!this.email) {
      this.router.navigate(['/signup'], { replaceUrl: true });
      return;
    }

    this.startTimer();

    setTimeout(() => {
      const firstInput = document.querySelector('.otp-container input') as HTMLElement;
      firstInput?.focus();
    }, 100);
  }

  // ⏱ TIMER
  startTimer() {
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

  resendOtp() {
    if (this.countdown > 0 || this.loading) return;

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    this.auth.resendOtp(this.email).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = 'A new code has been sent to your email.';
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

  clearError() {
    if (this.errorMessage || this.successMessage) {
      this.errorMessage = '';
      this.successMessage = '';
      this.cdr.detectChanges();
    }
  }

  // 🔢 INPUT
  handleInput(event: any, index: number) {
    const input = event.target;
    let value = input.value.replace(/[^0-9]/g, '');

    input.value = value;
    this.otp[index] = value;

    if (value && index < 4) {
      input.nextElementSibling?.focus();
    }

    if (this.otp.join('').length === 5 && !this.loading) {
      this.verify();
    }
    this.cdr.detectChanges();
  }

  // ⬅️ BACKSPACE
  handleKeyDown(event: any, index: number) {
    if (event.key === 'Backspace') {
      if (this.otp[index]) {
        this.otp[index] = '';
        event.target.value = '';
        return;
      }

      if (index > 0) {
        event.target.previousElementSibling?.focus();
      }
    }
    this.cdr.detectChanges();
  }

  // ✅ VERIFY
  verify() {
    if (this.loading) return;

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
      this.auth.verifyOtp(this.email, code).subscribe({
        next: (res: any) => {
          this.loading = false;

          const token = res?.token || res?.accessToken;

          if (!token) {
            this.errorMessage = 'Authentication failed ❌';
            this.cdr.detectChanges();
            return;
          }

          this.auth.saveToken(token);
          sessionStorage.setItem('token', token);
          sessionStorage.setItem('allowChooseRole', 'true');
          sessionStorage.removeItem('signupEmail');

          this.verified = true;
          this.successMessage = 'Verified successfully! Preparing your workspace...';
          this.cdr.detectChanges();

          setTimeout(() => {
            this.router.navigate(['/choose-role'], { replaceUrl: true });
          }, 1200);
        },

        error: (err: any) => {
          this.loading = false;
          this.errorMessage =
            err?.error?.message === 'OTP not found'
              ? 'Invalid or expired OTP. Please check the code and try again.'
              : err?.error?.message || 'Verification failed. Please try again.';
          this.cdr.detectChanges();
        }
      });
    }, 800);
  }

  ngOnDestroy(): void {
    if (this.timerSub) this.timerSub.unsubscribe();
  }
}
