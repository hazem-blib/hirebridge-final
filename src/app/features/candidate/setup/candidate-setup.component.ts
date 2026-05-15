import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

// 🔥 بدل AuthService
import { CandidateService } from '../../../core/services/candidate.service';
import { WorkType } from '../../../shared/enums/work-type.enum';
import { ExperienceLevel } from '../../../shared/enums/experience-level.enum';
import { DEPARTMENTS } from '../../../shared/constants/departments.constant';

@Component({
  standalone: true,
  selector: 'app-candidate-setup',
  imports: [CommonModule, FormsModule],
  templateUrl: './candidate-setup.component.html',
  styleUrls: ['./candidate-setup.component.css']
})
export class CandidateSetupComponent {

  loading = false;
  success = false;
  submitted = false;
  errorMessage = '';

  // 🔥 skills system
  skills: string[] = [];
  skillInput = '';

  candidate = {
    specialization: DEPARTMENTS[0],
    experienceLevel: ExperienceLevel.Mid,
    minSalary: null,
    maxSalary: null,
    workType: WorkType.FullTime
  };
  
  readonly workTypes = Object.values(WorkType);
  readonly experienceLevels = Object.values(ExperienceLevel);
  readonly departments = DEPARTMENTS;
  
  openDropdown: string | null = null;

  toggleDropdown(name: string, event: Event): void {
    event.stopPropagation();
    this.openDropdown = this.openDropdown === name ? null : name;
  }

  selectOption(name: string, value: any): void {
    if (name === 'specialization') {
      this.candidate.specialization = value;
    } else if (name === 'experienceLevel') {
      this.candidate.experienceLevel = value;
    } else if (name === 'workType') {
      this.candidate.workType = value;
    }
    this.openDropdown = null;
  }

  @HostListener('window:click')
  closeDropdowns(): void {
    this.openDropdown = null;
  }

  constructor(
    private candidateService: CandidateService, // ✅ هنا التعديل
    private router: Router
  ) {}

  // ✅ validation helper
  isEmpty(value: any): boolean {
    return value === null || value === undefined || value.toString().trim() === '';
  }

  // 🔥 ADD SKILL
  addSkill(event: any) {
    event.preventDefault();

    const value = this.skillInput.trim();

    if (value && !this.skills.includes(value)) {
      this.skills.push(value);
    }

    this.skillInput = '';
  }

  // 🔥 REMOVE SKILL
  removeSkill(index: number) {
    this.skills.splice(index, 1);
  }

  // 🔥 VALIDATION
  isValid(): boolean {
    return !(
      this.isEmpty(this.candidate.specialization) ||
      this.isEmpty(this.candidate.experienceLevel) ||
      this.isEmpty(this.candidate.minSalary) ||
      this.isEmpty(this.candidate.maxSalary) ||
      this.isEmpty(this.candidate.workType) ||
      this.skills.length === 0
    );
  }

  // 🚀 SUBMIT
  submit() {

    this.submitted = true;
    this.errorMessage = '';

    if (!this.isValid()) {
      this.errorMessage = 'Please fill all fields ❌';
      return;
    }

    this.loading = true;

    const payload = {
      candidateProfile: {
        specialization: this.candidate.specialization,
        experienceLevel: this.candidate.experienceLevel,
        expectedSalary: {
          min: Number(this.candidate.minSalary),
          max: Number(this.candidate.maxSalary)
        },
        workType: this.candidate.workType,
        skills: this.skills,
        status: 'Available'
      }
    };

    // 🔥 هنا التعديل
    this.candidateService.updateCandidateProfile(payload).subscribe({

      next: () => {
        this.loading = false;
        this.success = true;

        sessionStorage.removeItem('allowChooseRole');

        setTimeout(() => {
          this.router.navigate(['/dashboard'], { replaceUrl: true });
        }, 200);
      },

      error: (err: any) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Something went wrong ❌';
      }
    });
  }

  formatEnum(val: string): string {
    if (!val) return '';
    // Insert space before capital letters (e.g. FullTime -> Full Time)
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
