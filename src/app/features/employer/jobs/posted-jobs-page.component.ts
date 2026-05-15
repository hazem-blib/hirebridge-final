import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { switchMap, distinctUntilChanged, take, timeout, finalize } from 'rxjs/operators';

import {
  EmployerApplicant,
  EmployerApplicationsService
} from '../../../core/services/employer-applications.service';
import { InterviewSchedulingService } from '../../../core/services/interview-scheduling.service';
import { EmployerJob, EmployerJobsService } from '../../../core/services/employer-jobs.service';
import { ToastService } from '../../../core/services/toast.service';
import { InterviewStatus } from '../../../shared/enums/interview-status.enum';
import { WorkType } from '../../../shared/enums/work-type.enum';
import { ScheduledInterview } from '../../../shared/models/interview.model';

@Component({
  standalone: true,
  selector: 'app-employer-posted-jobs-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './posted-jobs-page.component.html',
  styleUrls: ['./posted-jobs-page.component.css']
})
export class EmployerPostedJobsPageComponent implements OnInit, OnDestroy {
  private readonly baseUrl = `http://${window.location.hostname}:3004`;
  loading = false;
  error = '';
  jobs: EmployerJob[] = [];
  applicants: EmployerApplicant[] = [];
  interviewCounts: Record<string, number> = {};
  upcomingInterviewCounts: Record<string, number> = {};
  selectedJob: EmployerJob | null = null;
  selectedJobApplicants: EmployerApplicant[] = [];
  selectedJobInterviews: ScheduledInterview[] = [];
  detailsLoading = false;
  detailsError = '';
  candidatePreviewJob: EmployerJob | null = null;
  candidatePreviewApplicants: EmployerApplicant[] = [];
  candidatePreviewLoading = false;
  candidatePreviewError = '';
  candidatePreviewIndex = 0;
  candidateActionLoading = false;
  private swipeStartX = 0;
  private swipeStartY = 0;

  constructor(
    private http: HttpClient,
    private router: Router,
    private jobsService: EmployerJobsService,
    private interviewSchedulingService: InterviewSchedulingService,
    private employerApplicationsService: EmployerApplicationsService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadJobs();
  }

  ngOnDestroy(): void {
    this.setModalOpen(false);
  }

  get activeJobs(): EmployerJob[] {
    return this.jobs
      .filter(j => j.status !== 'Filled')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  get completedJobs(): EmployerJob[] {
    return this.jobs
      .filter(j => j.status === 'Filled')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  get totalInterviews(): number {
    return Object.values(this.interviewCounts).reduce((sum, count) => sum + count, 0);
  }

  get upcomingInterviews(): number {
    return Object.values(this.upcomingInterviewCounts).reduce((sum, count) => sum + count, 0);
  }

  get totalBudget(): number {
    return this.jobs.reduce((sum, job) => sum + job.salary, 0);
  }

  get totalHeadcount(): number {
    return this.jobs.reduce((sum, job) => sum + job.openRoles, 0);
  }

  loadJobs(): void {
    this.loading = true;
    this.error = '';

    this.jobsService
      .getOrFetchCompanyId()
      .pipe(
        switchMap(() =>
          combineLatest([
            this.jobsService.getCompanyJobs(),
            this.interviewSchedulingService.getAllInterviews(),
            this.employerApplicationsService.getAllApplicants()
          ])
        )
      )
      .subscribe({
        next: ([jobs, interviews, applicants]) => {
          this.loading = false;
          if (jobs && jobs.length > 0) {
            this.jobs = this.normalizeJobsResponse(jobs);
          }
          if (applicants) {
            this.applicants = applicants;
          }
          if (interviews) {
            this.interviewCounts = interviews.reduce((acc: Record<string, number>, interview: ScheduledInterview) => {
              acc[interview.jobId] = (acc[interview.jobId] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            this.upcomingInterviewCounts = interviews
              .filter(
                (interview: ScheduledInterview) =>
                  interview.status === InterviewStatus.Scheduled ||
                  interview.status === InterviewStatus.Rescheduled
              )
              .reduce((acc: Record<string, number>, interview: ScheduledInterview) => {
                acc[interview.jobId] = (acc[interview.jobId] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
          }
          this.cdr.detectChanges();
        },
        error: err => {
          this.loading = false;
          const message = String((err as { message?: string })?.message || '');

          if (message.toLowerCase().includes('unauthorized')) {
            this.error = 'Unauthorized';
          } else {
            this.error = 'Unable to load jobs.';
          }
          this.cdr.detectChanges();
        }
      });
  }

  deleteJob(job: EmployerJob): void {
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || '';

    if (!token) {
      this.toastService.error('Unauthorized');
      return;
    }

    this.http.delete(
      `${this.baseUrl}/job/delete-job/${job.id}`,
      {
        headers: {
          auth: token
        }
      }
    ).subscribe({
      next: () => {
        this.toastService.info(`Deleted "${job.title}".`);
        this.loadJobs();
      },
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
          this.toastService.error('Unauthorized');
          return;
        }

        this.toastService.error('Unable to delete job.');
      }
    });
  }

  beginSwipe(event: TouchEvent): void {
    if (!event.touches.length) return;

    this.swipeStartX = event.touches[0].clientX;
    this.swipeStartY = event.touches[0].clientY;
  }

  endJobSwipe(event: TouchEvent, job: EmployerJob): void {
    if (!event.changedTouches.length || window.innerWidth > 768) return;

    const dx = event.changedTouches[0].clientX - this.swipeStartX;
    const dy = event.changedTouches[0].clientY - this.swipeStartY;

    if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.4) {
      return;
    }

    if (dx > 0) {
      this.openJobDetails(job.id);
      return;
    }

    this.deleteJob(job);
  }

  getInterviewCount(jobId: string): number {
    return this.interviewCounts[jobId] || 0;
  }

  getUpcomingInterviewCount(jobId: string): number {
    return this.upcomingInterviewCounts[jobId] || 0;
  }

  getMatchedCount(jobId: string): number {
    return this.applicants.filter(applicant => applicant.jobId === jobId).length;
  }

  getPendingCount(jobId: string): number {
    return this.applicants.filter(
      applicant =>
        applicant.jobId === jobId &&
        (!applicant.companyDecision || applicant.companyDecision === 'pending')
    ).length;
  }

  getShortlistedCount(jobId: string): number {
    return this.applicants.filter(
      applicant => applicant.jobId === jobId && applicant.shortlistStage !== 'recommended'
    ).length;
  }

  getAcceptedForInterviewCount(jobId: string): number {
    return this.applicants.filter(
      applicant =>
        applicant.jobId === jobId &&
        (applicant.companyDecision === 'accepted_for_interview' || applicant.companyDecision === 'hired')
    ).length;
  }

  getExperienceLabel(level?: string): string {
    const val = level?.toLowerCase() || 'mid';
    if (val === 'junior') return 'JUNIOR';
    if (val === 'mid') return 'MID';
    if (val === 'senior') return 'SENIOR';
    if (val === 'lead') return 'LEAD';
    if (val === 'expert') return 'EXPERT';
    return val.toUpperCase();
  }

  getHiredCount(job: any): number {
    if (typeof job === 'string') {
      const found = this.jobs.find(j => j.id === job);
      return found ? found.hiredCount : 0;
    }
    return job.hiredCount || 0;
  }

  getRemainingCount(job: EmployerJob): number {
    return Math.max(job.openRoles - job.hiredCount, 0);
  }

  getDeptTone(dept: string): string {
    const d = (dept || '').toLowerCase();
    if (d.includes('eng') || d.includes('data') || d.includes('cyber') || d.includes('qa') || d.includes('quality')) return 'blue';
    if (d.includes('mark') || d.includes('sale') || d.includes('prod') || d.includes('customer')) return 'purple';
    if (d.includes('design')) return 'pink';
    if (d.includes('human') || d.includes('admin') || d.includes('recruit')) return 'green';
    if (d.includes('fin') || d.includes('oper') || d.includes('leg') || d.includes('management')) return 'amber';
    return 'slate';
  }

  getEmploymentTypeLabel(type: string | undefined): string {
    const normalized = String(type || '').trim().toLowerCase();
    if (normalized.includes('part')) return 'Part Time';
    if (normalized.includes('full')) return 'Full Time';
    if (normalized.includes('contract')) return 'Contract';
    if (normalized.includes('remote')) return 'Remote';
    if (normalized.includes('hybrid')) return 'Hybrid';
    if (normalized.includes('on')) return 'Onsite';
    return 'Full Time';
  }

  openJobDetails(jobId: string): void {
    this.setModalOpen(true);
    this.detailsLoading = true;
    this.detailsError = '';
    this.selectedJob = this.jobs.find(job => job.id === jobId) || null;
    this.selectedJobApplicants = [];
    this.selectedJobInterviews = [];
    
    // Force UI to show backdrop immediately
    this.cdr.detectChanges();

    combineLatest([
      this.jobsService.getJobById(jobId),
      this.interviewSchedulingService.getInterviewsByJob(jobId),
      this.employerApplicationsService.getApplicantsByJob(jobId)
    ]).subscribe({
      next: ([job, interviews, applicants]) => {
        if (job) {
          this.selectedJob = job;
          this.selectedJobInterviews = this.sortInterviews(interviews);
          this.selectedJobApplicants = this.sortApplicants(applicants);
        }
        this.detailsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.detailsLoading = false;
        this.detailsError = 'Unable to load request details.';
        this.cdr.detectChanges();
      }
    });
  }

  openReviewCandidates(jobId: string): void {
    const currentJob = this.jobs.find(job => job.id === jobId) || null;
    if (!currentJob) return;

    this.setModalOpen(true);

    // 1. Set the job immediately
    this.candidatePreviewJob = currentJob;
    this.candidatePreviewIndex = 0;
    this.candidatePreviewError = '';
    this.candidateActionLoading = false;

    // 2. Optimistic Data: Try to use existing applicants to show modal INSTANTLY
    const existingPending = this.applicants.filter(a =>
      a.jobId === jobId && (!a.companyDecision || a.companyDecision === 'pending')
    );

    if (existingPending.length > 0) {
      this.candidatePreviewApplicants = this.sortApplicants(existingPending);
      this.candidatePreviewLoading = false;
    } else {
      this.candidatePreviewLoading = true;
    }
    
    this.cdr.detectChanges(); // Force modal to show up immediately

    // 3. Background Refresh: Always get fresh data from server
    this.employerApplicationsService.getApplicantsByJob(jobId)
      .pipe(
        take(1),
        timeout(15000),
        finalize(() => {
          this.candidatePreviewLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (freshApplicants: EmployerApplicant[]) => {
          // Sync global state
          this.applicants = [
            ...this.applicants.filter(a => a.jobId !== jobId),
            ...freshApplicants
          ];

          const pending = freshApplicants.filter(a =>
            (!a.companyDecision || a.companyDecision === 'pending')
          );

          this.candidatePreviewApplicants = this.sortApplicants(pending);
          this.cdr.detectChanges();

          if (this.candidatePreviewApplicants.length === 0 && !this.candidatePreviewLoading) {
            this.toastService.info('All candidates for this job have been reviewed!');
            this.closeCandidatePreview();
          }
        },
        error: (err) => {
          if (!this.candidatePreviewApplicants.length) {
            this.toastService.error('Unable to load candidates.');
            this.closeCandidatePreview();
          }
        }
      });
  }

  closeJobDetails(): void {
    this.selectedJob = null;
    this.selectedJobApplicants = [];
    this.selectedJobInterviews = [];
    this.detailsLoading = false;
    this.detailsError = '';
    this.setModalOpen(false);
  }

  get selectedSentCandidatesCount(): number {
    return this.selectedJobApplicants.filter(applicant => applicant.shortlistStage !== 'recommended').length;
  }

  get selectedHiredCandidatesCount(): number {
    return this.selectedJob?.hiredCount || 0;
  }

  get selectedUpcomingInterviewsCount(): number {
    return this.selectedJobInterviews.filter(
      interview =>
        interview.status === InterviewStatus.Scheduled ||
        interview.status === InterviewStatus.Rescheduled
    ).length;
  }

  get selectedAverageFitScore(): number {
    if (!this.selectedJobApplicants.length) return 0;
    const total = this.selectedJobApplicants.reduce((sum, applicant) => sum + (applicant.fitScore || 0), 0);
    return Math.round(total / this.selectedJobApplicants.length);
  }

  get selectedRemainingHeadcount(): number {
    if (!this.selectedJob) return 0;
    return Math.max(this.selectedJob.openRoles - this.selectedHiredCandidatesCount, 0);
  }

  get selectedProgressPercent(): number {
    if (!this.selectedJob?.openRoles) return 0;
    return Math.min(100, Math.round((this.selectedHiredCandidatesCount / this.selectedJob.openRoles) * 100));
  }

  getCompanyDecisionLabel(applicant: EmployerApplicant): string {
    const labels: Record<string, string> = {
      pending: 'Pending company feedback',
      accepted_for_interview: 'Accepted for interview',
      rejected: 'Rejected by company',
      request_replacement: 'Replacement requested',
      hired: 'Hired'
    };

    return labels[applicant.companyDecision || 'pending'] || 'Pending company feedback';
  }

  getSalaryMatchLabel(match: EmployerApplicant['salaryMatch']): string {
    const labels: Record<EmployerApplicant['salaryMatch'], string> = {
      within_budget: 'Within budget',
      slightly_above: 'Slightly above budget',
      out_of_budget: 'Out of budget'
    };

    return labels[match];
  }

  getInterviewStatusLabel(status: InterviewStatus): string {
    return status.replace(/_/g, ' ');
  }

  trackModalBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeJobDetails();
    }
  }

  trackCandidatePreviewBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeCandidatePreview();
    }
  }

  closeCandidatePreview(): void {
    this.candidatePreviewJob = null;
    this.candidatePreviewApplicants = [];
    this.candidatePreviewLoading = false;
    this.candidatePreviewError = '';
    this.candidatePreviewIndex = 0;
    this.candidateActionLoading = false;
    this.setModalOpen(false);
  }

  private setModalOpen(isOpen: boolean): void {
    document.body.classList.toggle('modal-open', isOpen);
  }

  get previewedCandidate(): EmployerApplicant | null {
    return this.candidatePreviewApplicants[this.candidatePreviewIndex] || null;
  }

  get hasNextPreviewCandidate(): boolean {
    return this.candidatePreviewIndex < this.candidatePreviewApplicants.length - 1;
  }

  get hasPreviousPreviewCandidate(): boolean {
    return this.candidatePreviewIndex > 0;
  }

  showPreviousCandidate(): void {
    if (this.hasPreviousPreviewCandidate) {
      this.candidatePreviewIndex -= 1;
      this.cdr.detectChanges();
    }
  }

  showNextCandidate(): void {
    if (this.hasNextPreviewCandidate) {
      this.candidatePreviewIndex += 1;
      this.cdr.detectChanges();
    }
  }

  acceptPreviewCandidate(): void {
    this.submitPreviewDecision('accepted_for_interview', 'accepted');
  }

  rejectPreviewCandidate(): void {
    this.submitPreviewDecision('rejected', 'rejected');
  }

  openFullReviewFromPreview(): void {
    if (!this.candidatePreviewJob) return;

    const candidateId = this.previewedCandidate?.id;
    this.router.navigate(['/employer/jobs', this.candidatePreviewJob.id, 'review-candidates'], {
      queryParams: {
        candidateId: candidateId || null
      }
    });
    this.closeCandidatePreview();
  }

  private sortApplicants(applicants: EmployerApplicant[]): EmployerApplicant[] {
    return [...applicants].sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0));
  }

  private sortInterviews(interviews: ScheduledInterview[]): ScheduledInterview[] {
    return [...interviews].sort(
      (a, b) =>
        new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()
    );
  }

  private submitPreviewDecision(
    decision: NonNullable<EmployerApplicant['companyDecision']>,
    tab: 'accepted' | 'rejected'
  ): void {
    const candidate = this.previewedCandidate;
    const jobId = this.candidatePreviewJob?.id;

    if (!candidate || !jobId || this.candidateActionLoading) return;

    this.candidateActionLoading = true;
    this.candidatePreviewError = '';

    // Optimistic Logic for Acceptance: Navigate immediately to save time
    if (decision === 'accepted_for_interview') {
      this.toastService.info(`Scheduling interview for ${candidate.candidateName}...`);

      // Fire and forget (almost) - the next page will fetch its own state
      this.employerApplicationsService.updateCompanyDecision(candidate.id, 'accepted_for_interview', jobId)
        .subscribe({
          error: () => this.toastService.error('Error updating decision in background.')
        });

      this.router.navigate(['/employer/jobs', jobId, 'review-candidates'], {
        queryParams: { candidateId: candidate.id, tab: 'accepted', schedule: 'true' }
      });
      this.closeCandidatePreview();
      return;
    }

    // Standard Flow for Rejection (Optimistic UI update)
    this.employerApplicationsService.rejectCandidate(jobId, candidate.id).subscribe({
      next: () => {
        this.toastService.success(`${candidate.candidateName} rejected.`);

        // Remove from local preview list immediately
        this.candidatePreviewApplicants = this.candidatePreviewApplicants.filter(a => a.id !== candidate.id);
        this.candidateActionLoading = false;

        if (this.candidatePreviewApplicants.length > 0) {
          if (this.candidatePreviewIndex >= this.candidatePreviewApplicants.length) {
            this.candidatePreviewIndex = Math.max(0, this.candidatePreviewApplicants.length - 1);
          }
        } else {
          this.toastService.info('All candidates reviewed!');
          this.closeCandidatePreview();
        }

        // Sync background state silently
        this.employerApplicationsService.getApplicantsByJob(jobId).subscribe(updated => {
          this.applicants = [...this.applicants.filter(a => a.jobId !== jobId), ...updated];
        });
      },
      error: () => {
        this.candidateActionLoading = false;
        this.toastService.error('Unable to update candidate decision.');
        this.cdr.detectChanges();
      }
    });
  }

  private normalizeJobsResponse(response: unknown): EmployerJob[] {
    const list = this.extractJobsList(response);
    return list.map(item => this.mapApiJobToEmployerJob(item));
  }

  private extractJobsList(response: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(response)) {
      return response as Array<Record<string, unknown>>;
    }

    if (response && typeof response === 'object') {
      const asRecord = response as Record<string, unknown>;

      if (Array.isArray(asRecord['jobs'])) {
        return asRecord['jobs'] as Array<Record<string, unknown>>;
      }

      if (Array.isArray(asRecord['data'])) {
        return asRecord['data'] as Array<Record<string, unknown>>;
      }
    }

    return [];
  }

  private mapApiJobToEmployerJob(item: Record<string, unknown>): EmployerJob {
    const workTypeRaw = this.asString(item['workType']) || this.asString(item['type']) || 'FullTime';
    const budget = this.asRecord(item['budget']);
    const minBudget = Number(budget?.['min'] || 0);
    const maxBudget = Number(budget?.['max'] || 0);
    const salary = Number(item['salary'] || maxBudget || minBudget || 0);
    const id = this.asString(item['_id']) || this.asString(item['id']) || `job-${Date.now()}-${Math.random()}`;

    return {
      id,
      title: this.asString(item['title']) || 'Untitled role',
      department: this.asString(item['department']) || this.asString(item['category']) || 'General',
      description: this.asString(item['description']) || '',
      salary,
      type: this.mapApiWorkTypeToEnum(workTypeRaw),
      category: this.asString(item['category']) || this.asString(item['department']) || 'General',
      skillsRequired: Array.isArray(item['skillsRequired']) ? (item['skillsRequired'] as string[]) : [],
      experienceLevel: this.mapApiExperienceLevel(this.asString(item['experienceLevel'])),
      minExperience: this.asString(item['minExperience']) || '0',
      location: this.asString(item['location']) || this.resolveLocationFromWorkType(workTypeRaw),
      deadline: this.asString(item['deadline']) || this.defaultDeadline(),
      priority: this.mapPriority(this.asString(item['priority'])),
      createdAt: this.asString(item['createdAt']) || new Date().toISOString(),
      applicantsCount: item['applicantsCount'] !== undefined ? Number(item['applicantsCount']) : Number((item['shortlistedCandidates'] as any[])?.length || (item['shortlisted'] as any[])?.length || 0),
      hiredCount: item['hiredCount'] !== undefined ? Number(item['hiredCount']) : Number((item['hiredCandidates'] as any[])?.length || (item['hired'] as any[])?.length || 0),
      openRoles: Number(item['headcount'] || item['openRoles'] || 1),
      status: this.mapApiStatus(this.asString(item['status'])),
      shortlistedCandidates: Array.isArray(item['shortlistedCandidates']) ? item['shortlistedCandidates'] : (Array.isArray(item['shortlisted']) ? item['shortlisted'] : []),
      acceptedCandidates: Array.isArray(item['acceptedCandidates']) ? item['acceptedCandidates'] : (Array.isArray(item['accepted']) ? item['accepted'] : []),
      rejectedCandidates: Array.isArray(item['rejectedCandidates']) ? item['rejectedCandidates'] : (Array.isArray(item['rejected']) ? item['rejected'] : []),
      hiredCandidates: Array.isArray(item['hiredCandidates']) ? item['hiredCandidates'] : (Array.isArray(item['hired']) ? item['hired'] : []),
      source: 'api'
    };
  }

  private mapApiStatus(status: string): EmployerJob['status'] {
    const s = status?.toLowerCase();
    if (s === 'active' || s === 'open') return 'Open';
    if (s === 'filled') return 'Filled';
    if (s === 'cancelled') return 'Cancelled';
    return 'Draft';
  }

  private mapApiWorkTypeToEnum(workType: string): WorkType {
    const normalized = String(workType || '').trim().toLowerCase();
    if (normalized.includes('remote')) return WorkType.Remote;
    if (normalized.includes('hybrid')) return WorkType.Hybrid;
    if (normalized.includes('part')) return WorkType.PartTime;
    if (normalized.includes('on')) return WorkType.Onsite;
    return WorkType.FullTime;
  }

  private mapApiExperienceLevel(level: string): EmployerJob['experienceLevel'] {
    const normalized = String(level || '').trim().toLowerCase();
    if (normalized.includes('jun')) return 'junior';
    if (normalized.includes('mid')) return 'mid';
    if (normalized.includes('sen')) return 'senior';
    if (normalized.includes('lead')) return 'lead';
    if (normalized.includes('exp')) return 'expert';
    return 'mid';
  }

  private mapPriority(priority: string): EmployerJob['priority'] {
    const normalized = String(priority || '').trim().toLowerCase();
    if (normalized === 'low' || normalized === 'high') return normalized;
    return 'medium';
  }

  private resolveLocationFromWorkType(workType: string): string {
    const normalized = String(workType || '').trim().toLowerCase();
    if (normalized.includes('remote')) return 'Remote';
    return 'Cairo, Egypt';
  }

  private defaultDeadline(): string {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().slice(0, 10);
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }
}
