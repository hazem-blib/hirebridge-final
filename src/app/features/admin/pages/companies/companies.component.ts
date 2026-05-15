import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AdminCompany, AdminJob, AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-companies-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './companies.component.html',
  styleUrl: './companies.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCompaniesComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly adminService = inject(AdminService);

  readonly rawCompanies = toSignal(this.adminService.getCompanies(), { initialValue: [] });
  readonly companies = computed(() => {
    return [...this.rawCompanies()].sort((a, b) => {
      const aDate = a.newestJobAt ? new Date(a.newestJobAt).getTime() : 0;
      const bDate = b.newestJobAt ? new Date(b.newestJobAt).getTime() : 0;
      return bDate - aDate;
    });
  });
  readonly jobs = toSignal(this.adminService.getJobs(), { initialValue: [] });
  readonly activeCompany = signal<AdminCompany | null>(null);

  readonly activeCompanyJobs = computed<AdminJob[]>(() => {
    const company = this.activeCompany();
    if (!company) {
      return [];
    }

    return this.jobs()
      .filter(job => job.company === company.name)
      .sort((a, b) => {
        if (a.status === 'Open' && b.status !== 'Open') return -1;
        if (a.status !== 'Open' && b.status === 'Open') return 1;
        return 0;
      });
  });

  readonly totalOpenRoles = computed(() =>
    this.companies().reduce((sum, company) => sum + company.openRoles, 0)
  );
  readonly uniqueIndustries = computed(() => new Set(this.companies().map(c => c.industry)).size);

  openCompanyJobs(company: AdminCompany): void {
    this.activeCompany.set(company);
    this.setModalOpen(true);
  }

  closeCompanyJobs(): void {
    this.activeCompany.set(null);
    this.setModalOpen(false);
  }

  viewJobDetails(jobId: string): void {
    this.closeCompanyJobs();
    this.router.navigate(['/admin/jobs', jobId]);
  }

  private setModalOpen(isOpen: boolean): void {
    document.body.classList.toggle('modal-open', isOpen);
  }

  ngOnDestroy(): void {
    this.setModalOpen(false);
  }
}
