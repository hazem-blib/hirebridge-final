import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AdminService, AdminJob } from '../../services/admin.service';

@Component({
  selector: 'app-admin-jobs-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './jobs.component.html',
  styleUrl: './jobs.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminJobsComponent {
  private readonly router = inject(Router);
  private readonly adminService = inject(AdminService);

  readonly jobs = toSignal(this.adminService.getJobs());
  readonly candidates = toSignal(this.adminService.getCandidates(), { initialValue: [] });
  readonly isLoading = computed(() => this.jobs() === undefined);
  
  readonly openJobs = computed(() => {
    return (this.jobs() || [])
      .filter(j => j.status === 'Open' || j.status === 'In Review')
      .sort((a, b) => {
        const aDate = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
        const bDate = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
        return bDate - aDate;
      });
  });

  readonly closedJobs = computed(() => {
    return (this.jobs() || [])
      .filter(j => j.status === 'Closed')
      .sort((a, b) => {
        const aDate = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
        const bDate = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
        return bDate - aDate;
      });
  });

  readonly openJobsCount = computed(() => this.openJobs().length);
  readonly reviewJobsCount = computed(() => (this.jobs() || []).filter(job => job.status === 'In Review').length);

  openDetails(job: AdminJob): void {
    this.router.navigate(['/admin/jobs', job.id]);
  }

  openShortlist(job: AdminJob): void {
    this.router.navigate(['/admin/candidates'], { queryParams: { jobId: job.id } });
  }

  constructor() { }
}
