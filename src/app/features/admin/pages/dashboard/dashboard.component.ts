import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { AdminService, AdminJob, AdminCandidate, AdminInterview } from '../../services/admin.service';

interface DashboardStat {
  label: string;
  value: number;
  helper: string;
  tone: 'blue' | 'green' | 'amber' | 'violet' | 'slate';
  icon?: string;
}

interface ActivityItem {
  title: string;
  detail: string;
  time: string;
  tone: 'blue' | 'green' | 'amber';
}

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardComponent {
  private readonly router = inject(Router);
  private readonly adminService = inject(AdminService);
  public readonly Math = Math;

  private readonly data$ = forkJoin({
    jobs: this.adminService.getJobs(),
    candidates: this.adminService.getCandidates(),
    interviews: this.adminService.getInterviews()
  });

  private readonly dashboardData = toSignal(this.data$);

  readonly isLoading = computed(() => this.dashboardData() === undefined);
  readonly jobs = computed(() => this.dashboardData()?.jobs || []);
  readonly candidates = computed(() => this.dashboardData()?.candidates || []);
  readonly interviews = computed(() => this.dashboardData()?.interviews || []);
  readonly error = signal('');
  readonly totalOpenJobs = computed(() => this.jobs().filter(j => j.status === 'Open').length);

  readonly featuredJobs = computed(() =>
    [...this.jobs()]
      .filter(job => job.status === 'Open' || job.status === 'In Review')
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
      .slice(0, 4)
  );

  readonly upcomingInterviews = computed(() =>
    [...this.interviews()]
      .filter(interview => interview.status === 'Scheduled' || interview.status === 'Pending')
      .slice(0, 5)
  );

  readonly completedJobs = computed(() =>
    this.jobs().filter(job => job.status === 'Closed')
  );

  readonly topTalent = computed(() => {
    const all = this.candidates();
    const filtered = all.filter(c => c.status === 'Shortlisted' || c.status === 'Interviewing');
    const displayList = filtered.length > 0 ? filtered : all.slice(0, 3);
    
    return displayList.map(c => ({
      name: c.name,
      role: c.role,
      score: Math.floor(Math.random() * 10) + 90,
      initials: c.name.split(' ').map(n => n[0]).join('').toUpperCase()
    }));
  });

  readonly topSkills = computed(() => {
    const allSkills = this.jobs().flatMap(j => j.skills || []);
    const counts = allSkills.reduce((acc, skill) => {
      acc[skill] = (acc[skill] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const colors: ('blue' | 'violet' | 'amber' | 'green')[] = ['blue', 'violet', 'amber', 'green'];
    
    return Object.entries(counts)
      .map(([name, count], index) => ({
        name,
        count,
        trend: Math.random() > 0.5 ? '+12%' : '+8%', // Mock trend for now
        color: colors[index % colors.length]
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  readonly topCompanies = computed(() => {
    const companies = this.jobs().reduce((acc, job) => {
      if (!acc[job.company]) {
        acc[job.company] = { name: job.company, activeJobs: 0, closedJobs: 0 };
      }
      if (job.status === 'Closed') acc[job.company].closedJobs++;
      else acc[job.company].activeJobs++;
      return acc;
    }, {} as Record<string, { name: string, activeJobs: number, closedJobs: number }>);

    return Object.values(companies)
      .map(co => ({
        ...co,
        fillRate: Math.round((co.closedJobs / (co.activeJobs + co.closedJobs || 1)) * 100) || 0
      }))
      .sort((a, b) => b.activeJobs - a.activeJobs)
      .slice(0, 4);
  });

  readonly hiringVelocity = computed(() => {
    const completed = this.jobs().filter(j => j.status === 'Closed');
    if (completed.length === 0) return 12.4; // Industry baseline
    
    // Calculate average days since requestedAt for closed jobs
    const now = new Date().getTime();
    const avg = completed.reduce((sum, job) => {
      const start = new Date(job.requestedAt).getTime();
      return sum + (now - start) / (1000 * 60 * 60 * 24);
    }, 0) / completed.length;
    
    return Math.round(avg * 10) / 10;
  });

  readonly candidateFunnel = computed(() => {
    const cand = this.candidates();
    return [
      { label: 'Screening', count: cand.filter(c => c.status === 'Screening').length, color: 'slate' },
      { label: 'Interviewing', count: cand.filter(c => c.status === 'Interviewing').length, color: 'blue' },
      { label: 'Shortlisted', count: cand.filter(c => c.status === 'Shortlisted').length, color: 'violet' },
      { label: 'Hired', count: cand.filter(c => c.status === 'Hired').length, color: 'green' }
    ];
  });

  readonly industryTrends = computed(() => {
    const industries = this.jobs().reduce((acc, job) => {
      acc[job.companyIndustry] = (acc[job.companyIndustry] || 0) + job.openRoles;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(industries)
      .map(([name, roles]) => ({ name, roles }))
      .sort((a, b) => b.roles - a.roles)
      .slice(0, 3);
  });

  readonly totalActiveBudget = computed(() => 
    this.jobs()
      .filter(j => j.status !== 'Closed')
      .reduce((sum, j) => sum + (j.budget || 0), 0)
  );



  readonly activity = computed(() => this.buildActivity(this.jobs(), this.interviews(), this.candidates()));

  readonly stats = computed(() => [
    {
      label: 'Pipeline Worth',
      value: (this.totalActiveBudget() / 1000).toFixed(1) + 'k',
      numericValue: Math.min((this.totalActiveBudget() / 50000) * 100, 100), // Scale relative to 50k
      helper: 'Total estimated budget for all active hiring requests',
      tone: 'violet' as const,
      icon: 'fas fa-dollar-sign'
    },
    {
      label: 'Active Requests',
      value: this.jobs().filter(j => j.status !== 'Closed').length.toString(),
      numericValue: (this.jobs().filter(j => j.status !== 'Closed').length / 20) * 100,
      helper: 'Hiring requests currently active in the admin pipeline',
      tone: 'blue' as const,
      icon: 'fas fa-briefcase'
    },
    {
      label: 'Total Talent',
      value: this.candidates().length.toString(),
      numericValue: (this.candidates().length / 50) * 100,
      helper: 'Total candidates registered across the entire platform',
      tone: 'amber' as const,
      icon: 'fas fa-users'
    },
    {
      label: 'Success Rate',
      value: (this.positionsFilledCount / (this.jobs().length || 1) * 100).toFixed(0) + '%',
      numericValue: (this.positionsFilledCount / (this.jobs().length || 1) * 100),
      helper: 'Percentage of filled positions relative to total requests',
      tone: 'green' as const,
      icon: 'fas fa-check-circle'
    }
  ]);

  get candidatesSentCount(): number {
    return this.jobs().reduce(
      (total, job) => total + (job.shortlistedCandidates?.length || 0),
      0
    );
  }

  get positionsFilledCount(): number {
    return this.jobs().reduce(
      (total, job) => total + (job.hiredCandidates?.length || 0),
      0
    );
  }

  get remainingHeadcount(): number {
    const totalRequested = this.jobs().reduce((sum, job) => sum + job.openRoles, 0);
    return Math.max(totalRequested - this.positionsFilledCount, 0);
  }

  getPriorityLabel(status: AdminJob['status']): string {
    if (status === 'In Review') return 'in review';
    return status.toLowerCase();
  }

  getPriorityClass(status: AdminJob['status']): string {
    if (status === 'Open') return 'high';
    if (status === 'In Review') return 'medium';
    return 'low';
  }

  getInterviewCountForJob(jobId: string): number {
    return this.interviews().filter(i => i.jobId === jobId).length;
  }

  getJobTitle(jobId: string): string {
    return this.jobs().find(job => job.id === jobId)?.title || 'Open role';
  }

  getMatchedCandidatesForJob(jobId: string): number {
    return 0; // Matching is async and done on the candidates page
  }

  getFulfillmentPercentage(jobId: string): number {
    const job = this.jobs().find(j => j.id === jobId);
    if (!job || !job.openRoles) return 0;
    const hired = job.shortlistedCandidates?.length || 0;
    return Math.round((hired / job.openRoles) * 100);
  }

  getFulfillmentRatio(jobId: string): number {
    const job = this.jobs().find(j => j.id === jobId);
    if (!job || !job.openRoles) return 0;
    const hired = job.shortlistedCandidates?.length || 0;
    return hired / job.openRoles;
  }

  openJobDetails(jobId: string): void {
    this.router.navigate(['/admin/jobs', jobId]);
  }

  openJobs(): void {
    this.router.navigate(['/admin/jobs']);
  }

  openCandidates(): void {
    this.router.navigate(['/admin/candidates']);
  }

  openInterviews(): void {
    this.router.navigate(['/admin/interviews']);
  }

  private buildActivity(
    jobs: AdminJob[],
    interviews: AdminInterview[],
    candidates: AdminCandidate[]
  ): ActivityItem[] {
    const jobItems = jobs
      .filter(j => j.status === 'Open')
      .slice(0, 2)
      .map(job => ({
        title: `${job.title} request is active`,
        detail: `${job.shortlistedCandidates?.length || 0} candidates sent • ${job.openRoles} requested roles`,
        time: `Requested ${new Date(job.requestedAt).toLocaleDateString()}`,
        tone: 'blue' as const
      }));

    const interviewItems = interviews
      .filter(i => i.status !== 'Cancelled')
      .slice(0, 2)
      .map(interview => ({
        title: `${interview.candidateName} interview for ${this.getJobTitle(interview.jobId)}`,
        detail: `${interview.status}: ${interview.companyName}`,
        time: new Date(interview.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        tone: interview.status === 'Hired' ? ('green' as const) : ('amber' as const)
      }));

    const hiringItems = interviews
      .filter(i => i.status === 'Hired')
      .slice(0, 1)
      .map(i => ({
        title: `Position Filled: ${this.getJobTitle(i.jobId)}`,
        detail: `${i.candidateName} joined ${i.companyName}`,
        time: `Completed on ${new Date(i.date).toLocaleDateString()}`,
        tone: 'green' as const
      }));

    return [...jobItems, ...interviewItems, ...hiringItems]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 6);
  }
}
