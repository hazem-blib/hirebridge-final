import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import {
  EmployerJobsService,
  EmployerCreateJobApiPayload
} from '../../../core/services/employer-jobs.service';
import { ToastService } from '../../../core/services/toast.service';
import { WorkType } from '../../../shared/enums/work-type.enum';
import { ExperienceLevel } from '../../../shared/enums/experience-level.enum';
import { DEPARTMENTS } from '../../../shared/constants/departments.constant';

@Component({
  standalone: true,
  selector: 'app-employer-create-job-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './create-job-page.component.html',
  styleUrls: ['./create-job-page.component.css']
})
export class EmployerCreateJobPageComponent {
  saving = false;
  error = '';
  skillInput = '';
  form: any = {
    title: '',
    category: DEPARTMENTS[0],
    description: '',
    skillsRequired: [],
    experienceLevel: ExperienceLevel.Mid,
    minExperience: null,
    budget: {
      min: null,
      max: null
    },
    workType: WorkType.Remote,
    headcount: null
  };
  
  readonly workTypes = Object.values(WorkType);
  readonly experienceLevels = Object.values(ExperienceLevel);
  readonly departments = DEPARTMENTS;

  openDropdown: string | null = null;

  toggleDropdown(name: string, event: Event): void {
    event.stopPropagation();
    this.openDropdown = this.openDropdown === name ? null : name;
  }

  selectOption(name: keyof EmployerCreateJobApiPayload | 'workType' | 'experienceLevel', value: any): void {
    if (name === 'category') {
      this.form.category = value;
    } else if (name === 'workType') {
      this.form.workType = value;
    } else if (name === 'experienceLevel') {
      this.form.experienceLevel = value;
      this.error = '';
    }
    this.openDropdown = null;
  }

  @HostListener('window:click')
  closeDropdowns(): void {
    this.openDropdown = null;
  }

  constructor(
    private jobsService: EmployerJobsService,
    private router: Router,
    private toastService: ToastService
  ) { }

  addSkill(): void {
    const value = this.skillInput.trim();

    if (!value) {
      return;
    }

    if (!this.form.skillsRequired.includes(value)) {
      this.form.skillsRequired = [...this.form.skillsRequired, value];
    }

    this.skillInput = '';
  }

  removeSkill(skill: string): void {
    this.form.skillsRequired = this.form.skillsRequired.filter((item: string) => item !== skill);
  }

  submit(): void {
    this.error = '';

    if (!this.form.title.trim() || !this.form.category.trim() || !this.form.description.trim()) {
      this.error = 'Please complete the job title, category, and description.';
      this.scrollToError();
      return;
    }

    const minExperience = Number(this.form.minExperience);
    if (!Number.isFinite(minExperience) || minExperience < 0) {
      this.error = 'Please provide the minimum years of experience.';
      this.scrollToError();
      return;
    }

    const minBudget = Number(this.form.budget.min);
    const maxBudget = Number(this.form.budget.max);

    if (!Number.isFinite(minBudget) || minBudget <= 0) {
      this.error = 'Budget minimum must be greater than 0.';
      this.scrollToError();
      return;
    }

    if (!Number.isFinite(maxBudget) || maxBudget < minBudget) {
      this.error = 'Budget maximum must be greater than or equal to minimum.';
      this.scrollToError();
      return;
    }

    if (!this.form.skillsRequired.length) {
      this.error = 'Add at least one required skill.';
      this.scrollToError();
      return;
    }

    const payload: EmployerCreateJobApiPayload = {
      title: this.form.title.trim(),
      category: this.form.category.trim(),
      description: this.form.description.trim(),
      skillsRequired: this.form.skillsRequired,
      experienceLevel: this.form.experienceLevel,
      minExperience,
      budget: {
        min: minBudget,
        max: maxBudget
      },
      workType: this.form.workType,
      headcount: Number(this.form.headcount)
    };

    this.saving = true;

    this.jobsService.createJobForCurrentCompany(payload).subscribe({
      next: job => {
        this.saving = false;
        this.toastService.success('Hiring request created successfully.');
        this.router.navigate(['/employer/jobs']);
      },
      error: (err: unknown) => {
        this.saving = false;

        if (err instanceof HttpErrorResponse) {
          if (err.status === 401 || err.status === 403) {
            this.error = 'Unauthorized';
            return;
          }

          if (err.status === 404) {
            this.error = 'Company not found';
            return;
          }
        }

        const message = String((err as { message?: string })?.message || '').toLowerCase();

        if (message.includes('company not found')) {
          this.error = 'Company not found';
          return;
        }

        if (message.includes('unauthorized')) {
          this.error = 'Unauthorized';
          return;
        }

        this.error = 'Unable to create hiring request right now.';
        this.scrollToError();
      }
    });
  }

  private scrollToError(): void {
    setTimeout(() => {
      const errorEl = document.querySelector('.executive-error-alert');
      if (errorEl) {
        errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  }

  formatEnum(val: string): string {
    if (!val) return '';
    return val.replace(/([A-Z])/g, ' $1').trim();
  }

  getDepartmentIcon(dept: string): string {
    const icons: Record<string, string> = {
      'Engineering': 'fas fa-code',
      'Product Management': 'fas fa-tasks',
      'Design': 'fas fa-pen-nib',
      'Marketing': 'fas fa-bullhorn',
      'Sales': 'fas fa-dollar-sign',
      'Customer Success': 'fas fa-headset',
      'Human Resources': 'fas fa-users-cog',
      'Finance': 'fas fa-calculator',
      'Legal': 'fas fa-balance-scale',
      'Operations': 'fas fa-cogs'
    };
    return icons[dept] || 'fas fa-layer-group';
  }

  getWorkTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'Remote': 'fas fa-wifi',
      'Onsite': 'fas fa-building',
      'Hybrid': 'fas fa-laptop-house',
      'FullTime': 'fas fa-clock',
      'PartTime': 'fas fa-hourglass-half',
      'Contract': 'fas fa-file-contract',
      'Freelance': 'fas fa-project-diagram'
    };
    return icons[type] || 'fas fa-briefcase';
  }

  getExperienceIcon(level: string): string {
    const icons: Record<string, string> = {
      'Junior': 'fas fa-seedling',
      'Mid': 'fas fa-signal',
      'Senior': 'fas fa-crown',
      'Lead': 'fas fa-star',
      'Executive': 'fas fa-gem'
    };
    return icons[level] || 'fas fa-chart-line';
  }
}
