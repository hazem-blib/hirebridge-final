import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, AfterViewInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { finalize, take, timeout } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { CandidateService } from '../../../core/services/candidate.service';
import { CvUploadComponent } from '../cv-upload/cv-upload.component';
import { WorkType } from '../../../shared/enums/work-type.enum';
import { ExperienceLevel } from '../../../shared/enums/experience-level.enum';
import { DEPARTMENTS } from '../../../shared/constants/departments.constant';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, CvUploadComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit, AfterViewInit {
  profileForm: FormGroup;
  loading = false;
  loadingProfile = false;
  savingProfile = false;
  error: string | null = null;
  successMessage = '';
  user: any;

  skills: string[] = [];
  skillInput = '';

  readonly workTypes = Object.values(WorkType);
  readonly experienceLevels = Object.values(ExperienceLevel);
  readonly departments = DEPARTMENTS;

  constructor(
    private fb: FormBuilder,
    private candidate: CandidateService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    this.profileForm = this.fb.group({
      specialization: [''],
      experienceLevel: [''],
      minSalary: [''],
      maxSalary: [''],
      workType: ['']
    });
  }

  ngOnInit(): void {
    this.user = this.auth.getUserFromToken();
    this.loadProfile();
  }

  ngAfterViewInit(): void {
    this.route.fragment.subscribe(fragment => {
      if (fragment) {
        setTimeout(() => {
          const element = document.getElementById(fragment);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 500);
      }
    });
  }

  addSkill(event: any) {
    event.preventDefault();
    const value = this.skillInput.trim();
    if (value && !this.skills.includes(value)) {
      this.skills.push(value);
    }
    this.skillInput = '';
  }

  removeSkill(index: number) {
    this.skills.splice(index, 1);
  }

  loadProfile(force = false, keepSuccessMessage = false): void {
    this.loading = true;
    this.loadingProfile = true;
    this.error = null;
    if (!keepSuccessMessage) {
      this.successMessage = '';
    }

    this.candidate.getCandidateProfile(force)
      .pipe(
        // Removing take(1) to allow multiple emissions (fallback then real data)
        timeout(8000),
        finalize(() => {
          this.loading = false;
          this.loadingProfile = false;
        })
      )
      .subscribe({
        next: (res: any) => {
          const user = this.extractResponseUser(res);
          const candidateProfile = user?.candidateProfile || res?.candidateProfile || null;

          if (user) {
            this.user = {
              ...this.user,
              name: this.extractUserName(user),
              email: user?.email || this.user?.email,
              candidateProfile: candidateProfile
            };
          }

          // Handle expectedSalary if it's an object or a number
          const salary = candidateProfile?.expectedSalary;
          const minSalary = salary?.min || '';
          const maxSalary = salary?.max || '';

          this.skills = candidateProfile?.skills || [];

          this.profileForm.patchValue({
            specialization: candidateProfile?.specialization || '',
            experienceLevel: candidateProfile?.experienceLevel || '',
            minSalary: minSalary,
            maxSalary: maxSalary,
            workType: candidateProfile?.workType || ''
          });
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.error = this.buildApiErrorMessage(err, 'load');
          this.cdr.detectChanges();
        }
      });
  }

  submit(): void {
    if (this.savingProfile) {
      return;
    }

    this.loading = true;
    this.savingProfile = true;
    this.error = null;
    this.successMessage = '';

    const form = this.profileForm.getRawValue();
    const body = {
      candidateProfile: {
        specialization: form.specialization || '',
        experienceLevel: form.experienceLevel || '',
        expectedSalary: {
          min: form.minSalary ? Number(form.minSalary) : 0,
          max: form.maxSalary ? Number(form.maxSalary) : 0
        },
        workType: form.workType || '',
        skills: this.skills
      }
    };

    this.candidate.updateCandidateProfile(body)
      .pipe(
        take(1),
        timeout(10000),
        finalize(() => {
          setTimeout(() => {
            this.loading = false;
            this.savingProfile = false;
            this.cdr.detectChanges();
          });
        })
      )
      .subscribe({
        next: (res: any) => {
          this.successMessage = 'Profile updated successfully.';
          const user = res?.user || res?.data?.user || res?.data || res;
          if (user) {
            const candidateProfile = user.candidateProfile;
            if (candidateProfile) {
              const salary = candidateProfile.expectedSalary;
              this.skills = candidateProfile.skills || [];
              this.profileForm.patchValue({
                specialization: candidateProfile.specialization || '',
                experienceLevel: candidateProfile.experienceLevel || '',
                minSalary: salary?.min || 0,
                maxSalary: salary?.max || 0,
                workType: candidateProfile.workType || ''
              });
            }
          }
          
          setTimeout(() => {
            this.successMessage = '';
            this.cdr.detectChanges();
          }, 3000);

          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.error = this.buildApiErrorMessage(err, 'save');
          this.cdr.detectChanges();
        }
      });
  }

  private buildApiErrorMessage(err: any, action: 'load' | 'save'): string {
    if (err?.name === 'TimeoutError') {
      return action === 'load'
        ? 'Loading profile took too long. Please try again.'
        : 'Saving profile took too long. Please try again.';
    }

    const httpError = err as HttpErrorResponse;
    const actionLabel = action === 'load' ? 'load' : 'save';

    if (httpError.status === 401) {
      return this.auth.getToken()
        ? `API returned 401 Unauthorized while trying to ${actionLabel} your profile. Your token may be expired. Please log in again.`
        : `API returned 401 Unauthorized while trying to ${actionLabel} your profile. No auth token was found, so please log in first.`;
    }

    if (httpError.status === 403) {
      return `API returned 403 Forbidden while trying to ${actionLabel} your profile. Your account may not have permission for this action.`;
    }

    if (httpError.status === 0) {
      return `Could not reach the API while trying to ${actionLabel} your profile. Check that the backend is running on http://localhost:3004 and that CORS is enabled.`;
    }

    if (httpError?.error?.error) {
      return `${httpError.error.message}: ${httpError.error.error}`;
    }
    return httpError?.error?.message || `Failed to ${actionLabel} profile. Please try again.`;
  }

  private extractResponseUser(res: any): any {
    return res?.data?.user || res?.data || res?.user || res?.userDetails || res;
  }

  private extractUserName(user: any): string {
    return (
      user?.name ||
      user?.firstName ||
      user?.fullName ||
      user?.username ||
      user?.email?.split('@')[0] ||
      this.user?.name ||
      'User'
    );
  }

  formatEnum(val: string): string {
    if (!val) return '';
    return val.replace(/([A-Z])/g, ' $1').trim();
  }
}
