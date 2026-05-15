import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { startWith, shareReplay, switchMap } from 'rxjs';

import { CompanyProfile, CompanyService } from '../../../core/services/company.service';
import { EmployerJobsService } from '../../../core/services/employer-jobs.service';

@Component({
  standalone: true,
  selector: 'app-employer-company-profile-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './company-profile-page.component.html',
  styleUrls: ['./company-profile-page.component.css']
})
export class EmployerCompanyProfilePageComponent implements OnInit {
  profile: CompanyProfile | null = null;
  saving = false;
  loading = true;
  message = '';

  constructor(
    private companyService: CompanyService, 
    private jobsService: EmployerJobsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const companyId = sessionStorage.getItem('companyId');
    
    // 1. Subscribe to profile changes immediately
    this.companyService.companyProfile$.subscribe({
      next: (profile) => {
        if (profile && (profile.name || profile.companyEmail)) {
          this.profile = { ...profile };
          this.loading = false;
          this.cdr.detectChanges();
        }
      }
    });

    // 2. Trigger loading
    this.loading = true;
    if (companyId) {
      this.companyService.loadCompanyProfile(companyId).subscribe({
        next: () => {
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.jobsService.getOrFetchCompanyId().subscribe({
        next: (id) => {
          this.companyService.loadCompanyProfile(id).subscribe({
            next: () => {
              this.loading = false;
              this.cdr.detectChanges();
            },
            error: () => {
              this.loading = false;
              this.cdr.detectChanges();
            }
          });
        },
        error: () => {
          this.loading = false;
          this.message = 'Authentication required.';
          this.cdr.detectChanges();
        }
      });
    }
  }

  save(): void {
    if (!this.profile || this.saving) return;
    
    this.saving = true;
    this.message = '';
    this.companyService.updateCompanyProfile(this.profile).subscribe({
      next: (updated) => {
        this.profile = { ...updated };
        this.saving = false;
        this.message = 'Company profile updated successfully.';
        this.cdr.detectChanges();
        // Clear message after 5 seconds
        setTimeout(() => this.message = '', 5000);
      },
      error: (err) => {
        this.saving = false;
        this.message = 'Failed to save profile.';
        this.cdr.detectChanges();
        // Clear message after 5 seconds
        setTimeout(() => this.message = '', 5000);
      }
    });
  }
}
