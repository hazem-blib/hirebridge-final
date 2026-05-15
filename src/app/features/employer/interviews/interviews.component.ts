import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap, of, combineLatest } from 'rxjs';

import { InterviewSchedulingService } from '../../../core/services/interview-scheduling.service';
import { EmployerJobsService } from '../../../core/services/employer-jobs.service';
import { INTERVIEW_STATUS_LABELS, InterviewStatus } from '../../../shared/enums/interview-status.enum';
import { InterviewOutcome, ScheduledInterview } from '../../../shared/models/interview.model';
import { EmployerApplicationsService } from '../../../core/services/employer-applications.service';

@Component({
  selector: 'app-employer-interviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './interviews.component.html',
  styleUrls: ['./interviews.component.css']
})
export class EmployerInterviewsComponent implements OnInit {
  loading = false;
  error = '';
  successMessage = '';
  selectedInterview: ScheduledInterview | null = null;
  interviews: ScheduledInterview[] = [];
  searchTerm = '';
  statusFilter = 'all';
  jobTitles: Record<string, string> = {};

  // Per-job view properties
  jobId: string | null = null;
  currentJob: any = null;
  allJobs: any[] = [];
  isRequestDrawerOpen = false;
  viewMode: 'list' | 'management' = 'list';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private interviewSchedulingService: InterviewSchedulingService,
    private employerJobsService: EmployerJobsService,
    private employerApplicationsService: EmployerApplicationsService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.jobId = params['id'] || null;
      this.viewMode = this.jobId ? 'management' : 'list';
      this.isRequestDrawerOpen = false; // Close drawer on switch

      this.loadData();
      if (this.jobId) {
        this.loadJobDetails();
      }
    });
  }

  get currentJobInterviews(): ScheduledInterview[] {
    if (!this.jobId) return this.interviews;
    return this.interviews.filter(i => String(i.jobId) === String(this.jobId));
  }

  get sortedJobs(): any[] {
    return [...this.allJobs].sort((a, b) => {
      // Priority 1: Active jobs first
      const aIsClosed = a.status === 'Filled';
      const bIsClosed = b.status === 'Filled';
      if (aIsClosed !== bIsClosed) return aIsClosed ? 1 : -1;

      // Priority 2: Newest first
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });
  }

  get isRejected(): boolean {
    return this.selectedInterview?.outcome === 'failed' ||
      this.selectedInterview?.outcome === 'hold' ||
      this.selectedInterview?.candidateStatus === 'rejected';
  }

  get isHired(): boolean {
    return !!this.selectedInterview?.probationStarted;
  }

  canTakeDecision(interview: ScheduledInterview | null): boolean {
    if (!interview) return false;
    // If it's a legacy interview without candidateStatus, we allow it (for backward compatibility)
    if (!interview.candidateStatus) return true;
    return interview.candidateStatus === 'accepted';
  }


  isJobFilled(jobId: string | number | null): boolean {
    if (!jobId) return false;
    const job = this.allJobs.find(j => String(j.id) === String(jobId));
    if (!job) return false;

    // Priority check: Status field
    if (job.status === 'Filled' || job.status === 'Closed') return true;

    // Manual count check
    const hiredCount = job.hiredCandidates?.length || job.hiredCount || 0;
    const roles = job.openRoles || 1;
    return hiredCount >= roles;
  }

  get isCurrentJobFilled(): boolean {
    return this.isJobFilled(this.jobId);
  }

  get filteredInterviews(): ScheduledInterview[] {
    const search = this.searchTerm.trim().toLowerCase();
    const filter = this.statusFilter.toLowerCase();

    return [...this.interviews]
      .filter(interview => {
        const matchesJob = !this.jobId || String(interview.jobId) === String(this.jobId);
        const matchesStatus = filter === 'all' || interview.status === filter;
        const haystack = [
          interview.candidateName,
          this.getJobTitle(interview.jobId),
          interview.interviewerName,
          interview.type,
          interview.location,
          interview.notes
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const matchesSearch = !search || haystack.includes(search);
        return matchesJob && matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        const aDate = new Date(`${a.date}T${a.time}`).getTime();
        const bDate = new Date(`${b.date}T${b.time}`).getTime();
        return aDate - bDate;
      });
  }

  get upcomingCount(): number {
    return this.currentJobInterviews.filter(item => item.status === InterviewStatus.Scheduled).length;
  }

  get inProgressCount(): number {
    return this.currentJobInterviews.filter(item => item.status === InterviewStatus.Scheduled || item.status === InterviewStatus.Rescheduled).length;
  }

  get feedbackPendingCount(): number {
    return this.currentJobInterviews.filter(item => item.status === InterviewStatus.Completed && (item.outcome || 'pending') === 'pending').length;
  }

  get passedCount(): number {
    return this.currentJobInterviews.filter(item => item.outcome === 'passed').length;
  }

  get failedCount(): number {
    return this.currentJobInterviews.filter(item => item.outcome === 'failed').length;
  }

  animatedHealthPercent = 0;

  private updateHealthScore(): void {
    const list = this.currentJobInterviews;
    const resolved = list.filter(item => item.outcome === 'passed' || item.outcome === 'failed');
    if (!resolved.length) {
      this.animatedHealthPercent = 0;
      return;
    }
    const passed = resolved.filter(item => item.outcome === 'passed').length;
    const actual = Math.round((passed / resolved.length) * 100);

    // Update with a slight delay for animation effect
    setTimeout(() => {
      this.animatedHealthPercent = actual;
      this.cdr.detectChanges();
    }, 50);
  }

  get pipelineHealthPercent(): number {
    return this.animatedHealthPercent;
  }

  get decisionQueue(): ScheduledInterview[] {
    return this.currentJobInterviews
      .filter(item => item.status === InterviewStatus.Completed && item.outcome === 'passed' && !item.probationStarted)
      .slice(0, 5);
  }

  get successBoard(): ScheduledInterview[] {
    return this.currentJobInterviews
      .filter(item => !!item.probationStarted)
      .slice(0, 3);
  }

  get interviewerLoad(): Array<{ name: string; count: number }> {
    const load = this.currentJobInterviews.reduce((acc, interview) => {
      const key = (interview.interviewerName || 'Unassigned').trim();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(load)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }

  getStatusLabel(interview: ScheduledInterview): string {
    if (interview.candidateStatus === 'rejected') {
      return 'Cancelled (Candidate)';
    }
    return INTERVIEW_STATUS_LABELS[interview.status];
  }

  getStatusBadgeClass(interview: ScheduledInterview): string {
    if (interview.candidateStatus === 'rejected') {
      return 'status-badge cancelled';
    }
    const classes: Record<InterviewStatus, string> = {
      [InterviewStatus.Scheduled]: 'status-badge scheduled',
      [InterviewStatus.Rescheduled]: 'status-badge rescheduled',
      [InterviewStatus.Completed]: 'status-badge completed',
      [InterviewStatus.Cancelled]: 'status-badge cancelled'
    };

    return classes[interview.status];
  }

  getMatchedCandidatesForJob(id: any): number {
    const job = this.allJobs.find(j => String(j.id) === String(id));
    if (!job) return 0;
    return job.matchedCandidatesCount || job.applicantsCount ||
      ((job.shortlistedCandidates?.length || 0) + (job.acceptedCandidates?.length || 0));
  }

  getInterviewCount(id: any): number {
    return this.interviews.filter(i => String(i.jobId) === String(id)).length;
  }

  getOutcomeLabel(interview: ScheduledInterview): string {
    if (interview.candidateStatus === 'rejected') return 'Cancelled';
    if (interview.probationStarted) return 'Hired';
    if (!this.canTakeDecision(interview)) return 'Pending Approval';

    const value = interview.outcome || 'pending';
    const labels: Record<InterviewOutcome, string> = {
      pending: 'Pending decision',
      passed: 'Passed',
      failed: 'Failed',
      hold: 'On hold'
    };

    return labels[value];
  }

  getOutcomeBadgeClass(interview: ScheduledInterview): string {
    if (interview.candidateStatus === 'rejected') return 'status-badge cancelled';
    if (interview.probationStarted) return 'status-badge completed hired';
    if (!this.canTakeDecision(interview)) return 'status-badge rescheduled';

    const value = interview.outcome || 'pending';
    const classes: Record<InterviewOutcome, string> = {
      pending: 'status-badge rescheduled',
      passed: 'status-badge completed',
      failed: 'status-badge cancelled',
      hold: 'status-badge rescheduled'
    };

    return classes[value];
  }

  markCompleted(interviewId: string): void {
    this.successMessage = '';
    this.error = '';

    const previous = this.interviews.find(item => item.id === interviewId);
    if (previous) {
      this.updateInterviewInList({ ...previous, status: InterviewStatus.Completed });
    }

    this.interviewSchedulingService.completeInterview(interviewId).subscribe({
      next: updated => {
        this.updateInterviewInList(updated);
        this.successMessage = 'Interview marked as completed.';
      },
      error: () => {
        if (previous) {
          this.updateInterviewInList(previous);
        }
        this.error = 'Unable to update interview.';
      }
    });
  }

  cancelInterview(interviewId: string): void {
    this.successMessage = '';
    this.error = '';

    const previous = this.interviews.find(item => item.id === interviewId);
    if (previous) {
      this.updateInterviewInList({ ...previous, status: InterviewStatus.Cancelled });
    }

    this.interviewSchedulingService.cancelInterview(interviewId).subscribe({
      next: updated => {
        this.updateInterviewInList(updated);
        this.successMessage = 'Interview cancelled.';
      },
      error: () => {
        if (previous) {
          this.updateInterviewInList(previous);
        }
        this.error = 'Unable to cancel interview.';
      }
    });
  }

  confirmHire(interview: ScheduledInterview): void {
    this.successMessage = '';
    this.error = '';

    if (!interview.jobId || !interview.applicantId) {
      this.error = 'Unable to identify hiring request for this candidate.';
      return;
    }

    if (interview.probationStarted) {
      this.successMessage = `${interview.candidateName} is already hired.`;
      return;
    }

    this.interviewSchedulingService.confirmHire(interview.jobId, interview.applicantId, interview.id).subscribe({
      next: () => {
        // Update local status for immediate feedback
        const updated = { ...interview, probationStarted: true };
        this.updateInterviewInList(updated);

        this.successMessage = `Final Hire confirmed for ${interview.candidateName}. Candidate moved to Hired status.`;

        // Update job stats and potentially mark as filled
        if (interview.jobId) {
          this.employerJobsService.recordHiring(interview.jobId);
        }

        this.cdr.detectChanges();

        this.closeInterviewDetails();
        this.openCandidateInReview(updated, 'hired');
      },
      error: (err) => {
        console.error('Hiring error:', err);
        // Check if backend already processed this
        const errorMsg = String(err.error?.message || '').toLowerCase();
        if (err.status === 400 && errorMsg.includes('already hired')) {
          const updated = { ...interview, probationStarted: true };
          this.updateInterviewInList(updated);
          this.successMessage = `${interview.candidateName} is already hired.`;
        } else {
          this.error = 'Unable to finalize hire. Please check candidate status.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  setInterviewOutcome(interview: ScheduledInterview, outcome: InterviewOutcome): void {
    this.successMessage = '';
    this.error = '';

    const previous = { ...interview };
    const optimistic: ScheduledInterview = {
      ...interview,
      status: InterviewStatus.Completed,
      outcome,
      outcomeRecordedAt: new Date().toISOString()
    };

    this.updateInterviewInList(optimistic);

    this.interviewSchedulingService.recordInterviewOutcome(interview.id, outcome).subscribe({
      next: updated => {
        this.updateInterviewInList(updated);

        if (outcome === 'passed') {
          this.successMessage = `${updated.candidateName} passed the interview. They are now qualified for hire.`;
          return;
        }

        if (outcome === 'failed') {
          // Sync with Job rejection
          if (interview.jobId && interview.applicantId) {
            this.employerApplicationsService.rejectCandidate(interview.jobId, interview.applicantId).subscribe({
              next: () => {
                this.closeInterviewDetails();
                this.openCandidateInReview(updated, 'rejected');
              },
              error: (err) => {
                console.error('Failed to sync rejection:', err);
                this.closeInterviewDetails();
                this.openCandidateInReview(updated, 'rejected');
              }
            });
          } else {
            this.closeInterviewDetails();
            this.openCandidateInReview(updated, 'rejected');
          }
          return;
        }

        if (outcome === 'hold') {
          this.successMessage = `${updated.candidateName} placed on hold.`;
          return;
        }

        this.successMessage = `${updated.candidateName} marked as pending decision.`;
      },
      error: () => {
        this.updateInterviewInList(previous);
        this.error = 'Unable to record interview outcome.';
      }
    });
  }

  getJobTitle(jobId: string): string {
    return this.jobTitles[jobId] || 'Job opportunity';
  }

  getJobLink(jobId: string): string {
    return `/employer/jobs/${jobId}`;
  }

  getInitials(name: string): string {
    const parts = (name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (!parts.length) {
      return 'NA';
    }

    return parts.map(part => part.charAt(0).toUpperCase()).join('');
  }

  openJobDetails(jobId: string): void {
    if (!jobId) {
      this.successMessage = '';
      this.error = 'No linked hiring request was found for this interview.';
      return;
    }

    this.router.navigate(['/employer/jobs', jobId]);
  }

  openInterviewDetails(interview: ScheduledInterview): void {
    this.selectedInterview = interview;
    this.setModalOpen(true);
  }

  openCandidateInReview(interview: Partial<ScheduledInterview>, tab?: string): void {
    if (!interview.jobId || !interview.applicantId) {
      this.successMessage = '';
      this.error = 'Unable to open candidate review for this interview.';
      return;
    }

    const queryParams: any = {
      candidateId: interview.applicantId
    };

    if (tab) {
      queryParams.tab = tab;
    } else if (interview.outcome === 'failed') {
      queryParams.tab = 'rejected';
    } else if (interview.outcome === 'passed') {
      queryParams.tab = 'accepted';
    } else if (interview.probationStarted) {
      queryParams.tab = 'hired';
    }

    this.setModalOpen(false);
    this.router.navigate([`/employer/jobs/${interview.jobId}/review-candidates`], {
      queryParams
    });
  }

  toggleRequestDrawer(): void {
    this.isRequestDrawerOpen = !this.isRequestDrawerOpen;
  }

  closeInterviewDetails(): void {
    this.selectedInterview = null;
    this.setModalOpen(false);
  }

  trackInterviewDetailsBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeInterviewDetails();
    }
  }

  private setModalOpen(isOpen: boolean): void {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }

  private loadData(): void {
    this.loading = true;
    this.error = '';

    // Wait for ID if needed, then fetch
    this.employerJobsService.getOrFetchCompanyId().pipe(
      switchMap(() => combineLatest({
        interviews: this.interviewSchedulingService.getAllInterviews(),
        jobs: this.employerJobsService.getJobs()
      }))
    ).subscribe({
      next: ({ interviews, jobs }) => {
        this.interviews = [...interviews];
        this.allJobs = jobs;
        this.loadJobTitles();

        // If we are in global list mode, but only have 1 job, maybe auto-select? 
        // No, let's let the user choose.

        this.loading = false;
        this.updateHealthScore();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.error = 'Unable to load interviews.';
        this.cdr.detectChanges();
      }
    });
  }

  private loadJobTitles(): void {
    this.employerJobsService.getJobs().subscribe({
      next: jobs => {
        this.jobTitles = jobs.reduce((acc, job) => {
          acc[job.id] = job.title;
          return acc;
        }, {} as Record<string, string>);

        // Sync probation status from job's hired list
        this.interviews = this.interviews.map(interview => {
          const job = jobs.find(j => j.id === interview.jobId);
          const isHired = job?.hiredCandidates?.some(hc => {
            const hcId = hc.candidate?._id || hc.candidate || '';
            return String(hcId) === String(interview.applicantId);
          });
          return isHired ? { ...interview, probationStarted: true } : interview;
        });

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private updateInterviewInList(updated: ScheduledInterview): void {
    this.interviews = this.interviews.map(item => item.id === updated.id ? updated : item);
    this.updateHealthScore();

    // Live sync with popup if open
    if (this.selectedInterview && this.selectedInterview.id === updated.id) {
      this.selectedInterview = { ...updated };
    }
  }

  selectJob(id: string): void {
    this.isRequestDrawerOpen = false;
    this.router.navigate(['/employer/jobs', id, 'interviews']);
  }

  resetView(): void {
    this.isRequestDrawerOpen = false;
    this.router.navigate(['/employer/interviews']);
  }

  private loadJobDetails(): void {
    if (!this.jobId) return;
    this.employerJobsService.getJobById(this.jobId).subscribe({
      next: job => {
        this.currentJob = job;
        this.cdr.detectChanges();
      }
    });
  }
}
