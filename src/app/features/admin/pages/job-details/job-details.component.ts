import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { AdminCandidate, AdminJob, AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-job-details-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './job-details.component.html',
  styleUrl: './job-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminJobDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminService = inject(AdminService);

  readonly job = toSignal(
    this.route.paramMap.pipe(
      map(params => params.get('id') || ''),
      switchMap(id => this.adminService.getJobById(id))
    )
  );

  readonly sentCandidates = computed(() => {
    const job = this.job();
    if (!job) return [];
    
    // Combine all lists to show total profiles shared by admin
    const allLists = [
      ...(job.shortlistedCandidates || []),
      ...(job.acceptedCandidates || []),
      ...(job.rejectedCandidates || []),
      ...(job.hiredCandidates || [])
    ];

    // Remove duplicates if any (by candidate ID)
    const uniqueCandidates = new Map<string, any>();
    allLists.forEach(item => {
      const id = String(item.candidate?._id || item.candidate || '');
      if (id && !uniqueCandidates.has(id)) {
        uniqueCandidates.set(id, item);
      }
    });

    return Array.from(uniqueCandidates.values()).map((item: any) => {
      const c = item.candidate && typeof item.candidate === 'object' ? item.candidate : { _id: item.candidate };
      const profile = c.candidateProfile || {};
      
      const name = c.firstName ? `${c.firstName} ${c.lastName || ''}`.trim() : (c.email || 'Candidate');

      const candidate: AdminCandidate = {
        id: c._id || item.candidate,
        name: name,
        role: profile.specialization || 'Specialized Role',
        experience: profile.experienceLevel || 'Mid',
        status: 'Screening',
        expectedSalary: profile.expectedSalary?.max || 0,
        fitScore: 85, // Placeholder, will be recalculated
        cvSummary: profile.fraudCheck?.reason || '',
        createdAt: c.createdAt || job.requestedAt || new Date().toISOString()
      };

      return {
        ...candidate,
        fitScore: this.adminService.calculateFitScore(candidate, job),
        sentAt: item.sentAt || item.acceptedAt || item.rejectedAt || item.hiredAt || job.requestedAt
      };
    });
  });
  readonly progress = computed(() => {
    const currentJob = this.job();
    if (!currentJob || !currentJob.openRoles) {
      return 0;
    }

    return Math.min(100, Math.round((this.sentCandidates().length / currentJob.openRoles) * 100));
  });

  searchMatchingCandidates(): void {
    const currentJob = this.job();
    if (!currentJob) return;
    this.router.navigate(['/admin/candidates'], { queryParams: { jobId: currentJob.id } });
  }

  openInterviews(): void {
    this.router.navigate(['/admin/interviews']);
  }
}
