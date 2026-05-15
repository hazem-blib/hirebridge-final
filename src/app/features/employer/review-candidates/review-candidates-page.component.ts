import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, combineLatest, switchMap } from 'rxjs';
import flatpickr from 'flatpickr';
import { CustomMonthDropdownDirective } from '../../../shared/directives/custom-month-dropdown.directive';
import { PremiumTimePickerComponent } from '../../../shared/components/premium-time-picker.component';

import {
  EmployerApplicant,
  EmployerApplicationsService
} from '../../../core/services/employer-applications.service';
import {
  InterviewSchedulingService,
  ScheduleInterviewPayload
} from '../../../core/services/interview-scheduling.service';
import { EmployerJob, EmployerJobsService } from '../../../core/services/employer-jobs.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  APPLICATION_STATUS_LABELS,
  ApplicationStatus
} from '../../../shared/enums/application-status.enum';
import { INTERVIEW_STATUS_LABELS, InterviewStatus } from '../../../shared/enums/interview-status.enum';
import { InterviewOutcome, InterviewType, ScheduledInterview } from '../../../shared/models/interview.model';

type ReviewTab = 'pending' | 'accepted' | 'rejected' | 'replacement' | 'hired';

@Component({
  standalone: true,
  selector: 'app-employer-review-candidates-page',
  imports: [CommonModule, FormsModule, RouterLink, CustomMonthDropdownDirective, PremiumTimePickerComponent],
  templateUrl: './review-candidates-page.component.html',
  styleUrls: ['./review-candidates-page.component.css'],
  host: {
    '(document:click)': 'onDocumentClick($event)'
  }
})
export class EmployerReviewCandidatesPageComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  actionError = '';
  actionSuccess = '';
  job: EmployerJob | null = null;
  applicants: EmployerApplicant[] = [];
  interviews: ScheduledInterview[] = [];
  processingApplicantId: string | null = null;
  viewMode: 'list' | 'management' = 'list';
  activeTab: ReviewTab = 'pending';
  selectedCandidateId = '';
  requestDetailsLink = '/employer/jobs';

  statusTabs: { label: string, value: ReviewTab }[] = [
    { label: 'Pending', value: 'pending' },
    { label: 'Accepted', value: 'accepted' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Replacement', value: 'replacement' },
    { label: 'Hired', value: 'hired' }
  ];

  getCandidateCount(tab: string): number {
    switch (tab) {
      case 'pending': return this.pendingApplicants.length;
      case 'accepted': return this.acceptedApplicants.length;
      case 'rejected': return this.rejectedApplicants.length;
      case 'replacement': return this.replacementApplicants.length;
      case 'hired': return this.hiredApplicants.length;
      default: return 0;
    }
  }

  getJobInterviewsCount(id: any): number {
    return this.getInterviewCount(id);
  }
  interviewModalApplicant: EmployerApplicant | null = null;
  interviewForm: ScheduleInterviewPayload = this.createDefaultInterviewForm();
  allJobs: EmployerJob[] = [];
  isRequestDrawerOpen = false;
  fpDate: any;
  fpTime: any;
  showTypeDropdown = false; // Custom dropdown state
  private pendingScheduleCandidateId: string | null = null;
  private requestedTab: ReviewTab | null = null;
  private readonly subscriptions = new Subscription();

  toggleTypeDropdown(event: Event): void {
    event.stopPropagation();
    this.showTypeDropdown = !this.showTypeDropdown;
  }

  selectType(type: InterviewType, event: Event): void {
    event.stopPropagation();
    this.interviewForm.type = type;
    this.showTypeDropdown = false;
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case 'Online': return 'fas fa-video';
      case 'Onsite': return 'fas fa-building';
      case 'Phone': return 'fas fa-phone';
      default: return 'fas fa-video';
    }
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private jobsService: EmployerJobsService,
    private employerApplicationsService: EmployerApplicationsService,
    private interviewSchedulingService: InterviewSchedulingService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private el: ElementRef
  ) { }

  private initFlatpickr(): void {
    setTimeout(() => {
      const dateInput = this.el.nativeElement.querySelector('#fp-date');
      const timeInput = this.el.nativeElement.querySelector('#fp-time');

      if (dateInput) {
        this.fpDate = flatpickr(dateInput, {
          dateFormat: 'Y-m-d',
          defaultDate: this.interviewForm.date,
          minDate: 'today',
          disableMobile: true,
          static: true,
          onChange: (selectedDates, dateStr) => {
            this.interviewForm.date = dateStr;
          }
        });
      }
    }, 50);
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.paramMap.subscribe(params => {
        const jobId = params.get('id');
        this.isRequestDrawerOpen = false;
        this.viewMode = jobId ? 'management' : 'list';

        this.loadData();
        if (jobId) {
          this.loadReviewPage(jobId);
        }
      })
    );

    this.subscriptions.add(
      this.route.queryParamMap.subscribe(queryParams => {
        const candidateId = queryParams.get('candidateId') || '';
        const tab = queryParams.get('tab');

        this.selectedCandidateId = candidateId;

        if (tab === 'pending' || tab === 'accepted' || tab === 'rejected' || tab === 'replacement' || tab === 'hired') {
          this.requestedTab = tab;
        } else {
          this.requestedTab = null;
        }

        const openSchedule = queryParams.get('schedule') === 'true';

        this.applyTabSelection();

        if (openSchedule && candidateId) {
          this.pendingScheduleCandidateId = candidateId;
          const applicant = this.applicants.find(a => a.id === candidateId);
          if (applicant) {
            this.scheduleInterview(applicant);
            this.pendingScheduleCandidateId = null;
          }
        }
      })
    );
  }

  // Close dropdown on outside click
  onDocumentClick(event: Event): void {
    this.showTypeDropdown = false;
  }

  private loadData(): void {
    this.loading = true;
    this.jobsService.getOrFetchCompanyId().pipe(
      switchMap(() => this.jobsService.getJobs())
    ).subscribe({
      next: jobs => {
        this.allJobs = [...jobs].sort((a, b) => {
          const aActive = a.status !== 'Filled';
          const bActive = b.status !== 'Filled';
          if (aActive && !bActive) return -1;
          if (!aActive && bActive) return 1;

          // Secondary sort: Newest first
          const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bDate - aDate;
        });
        // Only stop loading here if we are NOT going to load a specific review page
        if (this.viewMode === 'list') {
          this.loading = false;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        if (this.viewMode === 'list') {
          this.loading = false;
        }
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.setModalOpen(false);
  }

  isJobFilled(): boolean {
    if (!this.job) return false;

    // Check if status is explicitly Filled or Closed
    if (this.job.status === 'Filled' || this.job.status === 'Closed') return true;

    // Check if hired count exceeds open roles
    const hiredCount = this.job.hiredCandidates?.length || this.job.hiredCount || 0;
    const roles = this.job.openRoles || 1;
    return hiredCount >= roles;
  }

  get currentJob(): EmployerJob {
    return this.job as EmployerJob;
  }

  get visibleApplicants(): EmployerApplicant[] {
    return this.applicants.filter(applicant => applicant.shortlistStage !== 'recommended');
  }

  get pendingApplicants(): EmployerApplicant[] {
    return this.visibleApplicants.filter(applicant => !applicant.companyDecision || applicant.companyDecision === 'pending');
  }

  get acceptedApplicants(): EmployerApplicant[] {
    return this.visibleApplicants.filter(applicant => {
      const interview = this.getInterviewForApplicant(applicant.id);
      const isCandidateRejected = interview && interview.candidateStatus === 'rejected';
      return applicant.companyDecision === 'accepted_for_interview' && !isCandidateRejected;
    });
  }

  get rejectedApplicants(): EmployerApplicant[] {
    return this.visibleApplicants.filter(applicant => {
      const interview = this.getInterviewForApplicant(applicant.id);
      return applicant.companyDecision === 'rejected' || (interview && interview.candidateStatus === 'rejected');
    });
  }

  get replacementApplicants(): EmployerApplicant[] {
    return this.visibleApplicants.filter(applicant => applicant.companyDecision === 'request_replacement');
  }

  get hiredApplicants(): EmployerApplicant[] {
    return this.visibleApplicants.filter(applicant => applicant.companyDecision === 'hired');
  }

  get displayedApplicants(): EmployerApplicant[] {
    const map: Record<ReviewTab, EmployerApplicant[]> = {
      pending: this.pendingApplicants,
      accepted: this.acceptedApplicants,
      rejected: this.rejectedApplicants,
      replacement: this.replacementApplicants,
      hired: this.hiredApplicants
    };

    return map[this.activeTab];
  }

  get activeTabLabel(): string {
    const labels: Record<ReviewTab, string> = {
      pending: 'Pending Review',
      accepted: 'Accepted',
      rejected: 'Rejected',
      replacement: 'Replacement Requested',
      hired: 'Hired'
    };

    return labels[this.activeTab];
  }

  get reviewProgressPercent(): number {
    if (!this.visibleApplicants.length) return 0;
    const completed = this.visibleApplicants.filter(
      applicant => applicant.companyDecision && applicant.companyDecision !== 'pending'
    ).length;
    return Math.round((completed / this.visibleApplicants.length) * 100);
  }

  get averageFitScore(): number {
    if (!this.visibleApplicants.length) return 0;
    const total = this.visibleApplicants.reduce((sum, applicant) => sum + (applicant.fitScore || 0), 0);
    return Math.round(total / this.visibleApplicants.length);
  }

  get scheduledInterviewCount(): number {
    return this.interviews.filter(
      interview =>
        interview.status === InterviewStatus.Scheduled ||
        interview.status === InterviewStatus.Rescheduled
    ).length;
  }

  hasScheduledInterview(applicantId: string): boolean {
    return this.interviews.some(
      i => i.applicantId === applicantId &&
        (i.status === InterviewStatus.Scheduled || i.status === InterviewStatus.Rescheduled)
    );
  }

  getInterviewForApplicant(applicantId: string): ScheduledInterview | undefined {
    return this.interviews.find(i => i.applicantId === applicantId);
  }

  getStatusLabel(status: ApplicationStatus): string {
    return APPLICATION_STATUS_LABELS[status];
  }

  getInterviewStatusLabel(interview: ScheduledInterview): string {
    if (interview.candidateStatus === 'rejected') {
      return 'Cancelled (Candidate)';
    }
    return INTERVIEW_STATUS_LABELS[interview.status];
  }

  getCompanyDecisionLabel(applicant: EmployerApplicant): string {
    const interview = this.getInterviewForApplicant(applicant.id);
    if (interview && interview.candidateStatus === 'rejected') {
      return 'Rejected by Candidate';
    }

    const labels: Record<string, string> = {
      pending: 'Pending company review',
      accepted_for_interview: 'Accepted for interview',
      rejected: 'Rejected by company',
      request_replacement: 'Replacement requested',
      hired: 'Hired - probation active'
    };

    return labels[applicant.companyDecision || 'pending'] || 'Pending company review';
  }

  getSalaryMatchLabel(match: EmployerApplicant['salaryMatch']): string {
    const labels: Record<EmployerApplicant['salaryMatch'], string> = {
      within_budget: 'Within budget',
      slightly_above: 'Slightly above budget',
      out_of_budget: 'Out of budget'
    };

    return labels[match];
  }

  getProbationLabel(prediction?: EmployerApplicant['probationPrediction']): string {
    const labels = {
      low_risk: 'Low risk',
      watch: 'Watch closely',
      strong: 'Strong outlook'
    };

    return labels[prediction || 'watch'];
  }

  getFraudRiskLabel(risk?: EmployerApplicant['fraudRisk']): string {
    const labels = {
      low: 'Low risk',
      medium: 'Needs review',
      high: 'High risk'
    };

    return labels[risk || 'low'];
  }

  setActiveTab(tab: ReviewTab): void {
    this.activeTab = tab;
  }

  acceptCandidate(applicant: EmployerApplicant): void {
    this.runApplicantAction(
      applicant.id,
      () => this.employerApplicationsService.acceptCandidate(this.currentJob.id, applicant),
      `${applicant.candidateName} accepted for interview.`,
      'accepted'
    );
  }

  rejectCandidate(applicant: EmployerApplicant): void {
    this.runApplicantAction(
      applicant.id,
      () => this.employerApplicationsService.rejectCandidate(this.currentJob.id, applicant.id),
      `${applicant.candidateName} rejected.`,
      'rejected'
    );
  }

  requestReplacement(applicant: EmployerApplicant): void {
    this.runApplicantAction(
      applicant.id,
      () => this.employerApplicationsService.updateCompanyDecision(applicant.id, 'request_replacement'),
      `Replacement requested instead of ${applicant.candidateName}.`,
      'replacement'
    );
  }

  markHired(applicant: EmployerApplicant): void {
    if (this.isJobFilled()) {
      this.toastService.warning('Hiring limit reached for this request.');
      return;
    }
    this.runApplicantAction(
      applicant.id,
      () => this.employerApplicationsService.updateCompanyDecision(applicant.id, 'hired', this.currentJob.id),
      `${applicant.candidateName} marked as hired.`,
      'hired'
    );
  }

  scheduleInterview(applicant: EmployerApplicant): void {
    if (!this.job || this.processingApplicantId) return;

    this.interviewModalApplicant = applicant;
    this.interviewForm = this.createDefaultInterviewForm(applicant);
    this.actionError = '';
    this.actionSuccess = '';
    this.setModalOpen(true);
    this.cdr.detectChanges();
    this.initFlatpickr();
  }

  closeInterviewModal(): void {
    this.interviewModalApplicant = null;
    this.interviewForm = this.createDefaultInterviewForm();
    this.setModalOpen(false);
  }

  private setModalOpen(isOpen: boolean): void {
    document.body.classList.toggle('modal-open', isOpen);
  }

  submitInterviewSchedule(): void {
    if (!this.job || !this.interviewModalApplicant || this.processingApplicantId) return;

    const applicant = this.interviewModalApplicant;
    this.processingApplicantId = applicant.id;
    this.actionError = '';
    this.actionSuccess = '';

    const payload: ScheduleInterviewPayload = {
      ...this.interviewForm,
      applicantId: applicant.id,
      jobId: this.job.id,
      candidateName: applicant.candidateName
    };

    this.interviewSchedulingService.scheduleInterview(payload).subscribe({
      next: interview => {
        // Update local interviews list
        this.interviews = [interview, ...this.interviews.filter(item => item.id !== interview.id)];

        // Clear query params to prevent modal from re-opening on refresh/re-navigation
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { schedule: null, candidateId: null },
          queryParamsHandling: 'merge'
        });

        // Automatically mark the candidate as accepted for interview if they are still pending
        if (!applicant.companyDecision || applicant.companyDecision === 'pending') {
          this.employerApplicationsService.acceptCandidate(this.job!.id, applicant).subscribe({
            next: (updated) => {
              this.applicants = this.sortApplicants(
                this.applicants.map(item => (item.id === updated.id ? updated : item))
              );
              this.processingApplicantId = null;
              this.activeTab = 'accepted';
              this.toastService.success(`Interview scheduled and ${applicant.candidateName} moved to Accepted.`);
              this.closeInterviewModal();
              this.cdr.detectChanges();
            },
            error: () => {
              this.processingApplicantId = null;
              this.toastService.success(`Interview scheduled for ${applicant.candidateName}.`);
              this.closeInterviewModal();
              this.cdr.detectChanges();
            }
          });
        } else {
          this.processingApplicantId = null;
          this.toastService.success(`Interview scheduled for ${applicant.candidateName}.`);
          this.closeInterviewModal();
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.processingApplicantId = null;
        this.actionError = 'Unable to schedule interview.';
        this.toastService.error('Unable to schedule interview.');
        // Clear message after 5 seconds
        setTimeout(() => {
          this.actionError = '';
          this.cdr.detectChanges();
        }, 5000);
        this.cdr.detectChanges();
      }
    });
  }

  private runApplicantAction(
    applicantId: string,
    request: () => any,
    successMessage: string,
    nextTab?: ReviewTab
  ): void {
    if (this.processingApplicantId) return;

    this.processingApplicantId = applicantId;
    this.actionError = '';
    this.actionSuccess = '';

    request().subscribe({
      next: (updated: EmployerApplicant) => {
        this.applicants = this.sortApplicants(
          this.applicants.map(item => (item.id === updated.id ? updated : item))
        );
        this.processingApplicantId = null;
        this.actionSuccess = successMessage;
        this.toastService.success(successMessage);
        if (nextTab) this.activeTab = nextTab;
        // Clear message after 5 seconds
        setTimeout(() => this.actionSuccess = '', 5000);
      },
      error: (err: any) => {
        this.processingApplicantId = null;
        const errorMessage = err.error?.message || 'Unable to update company decision.';
        this.actionError = errorMessage;
        this.toastService.error(errorMessage);
        // Clear message after 8 seconds for better readability
        setTimeout(() => this.actionError = '', 8000);
      }
    });
  }

  private sortApplicants(applicants: EmployerApplicant[]): EmployerApplicant[] {
    return [...applicants].sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0));
  }

  private getNextInterviewDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    return date.toISOString().slice(0, 10);
  }

  toggleRequestDrawer(): void {
    this.isRequestDrawerOpen = !this.isRequestDrawerOpen;
  }

  resetView(): void {
    this.router.navigate(['/employer/review-candidates']);
  }

  switchJob(jobId: string): void {
    if (!jobId || jobId === this.job?.id) return;
    this.isRequestDrawerOpen = false;
    this.router.navigate(['/employer/jobs', jobId, 'review-candidates']);
  }

  getMatchedCandidatesForJob(id: any): number {
    const job = this.allJobs.find(j => String(j.id) === String(id)) as any;
    if (!job) return 0;
    return job.matchedCandidatesCount || job.applicantsCount ||
      ((job.shortlistedCandidates?.length || 0) + (job.acceptedCandidates?.length || 0));
  }

  getInterviewCount(id: any): number {
    return this.interviews.filter(i => String(i.jobId) === String(id)).length;
  }

  private loadReviewPage(jobId: string): void {
    this.loading = true;
    this.error = '';
    this.actionError = '';
    this.actionSuccess = '';

    // Ensure company ID is fetched first, then load all data for this job review
    this.subscriptions.add(
      this.jobsService.getOrFetchCompanyId().pipe(
        switchMap(() =>
          combineLatest<
            [EmployerJob, EmployerApplicant[], ScheduledInterview[]]
          >([
            this.jobsService.getJobById(jobId),
            this.employerApplicationsService.getApplicantsByJob(jobId),
            this.interviewSchedulingService.getInterviewsByJob(jobId)
          ])
        )
      ).subscribe({
        next: (data) => {
          const [job, applicants, interviews] = data;
          if (job) {
            this.job = job;
            this.requestDetailsLink = `/employer/jobs/${job.id}`;
            this.applicants = this.sortApplicants(applicants);
            this.interviews = [...interviews];
            this.applyTabSelection();

            // Handle pending schedule request from query params
            if (this.pendingScheduleCandidateId) {
              const applicant = this.applicants.find(a => a.id === this.pendingScheduleCandidateId);
              if (applicant) {
                this.scheduleInterview(applicant);
              }
              this.pendingScheduleCandidateId = null;
            }

            this.loading = false;
            this.error = '';

            // Auto-focus and scroll to specific candidate if ID is provided
            if (this.selectedCandidateId) {
              setTimeout(() => {
                const element = document.getElementById('applicant-' + this.selectedCandidateId);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  element.classList.add('premium-highlight-pulse');
                  setTimeout(() => element.classList.remove('premium-highlight-pulse'), 3000);
                }
              }, 600);
            }
            this.cdr.detectChanges();
          } else {
            // Only stop loading if we are sure the job is missing
            this.loading = false;
            this.error = 'Hiring request not found or you don\'t have permission to view this review center.';
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'Unable to load candidate review page.';
          this.cdr.detectChanges();
        }
      })
    );
  }

  trackInterviewModalBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeInterviewModal();
    }
  }

  getInterviewTypeLabel(interview: ScheduledInterview): string {
    const location = interview.type === 'Onsite' ? interview.location : interview.meetingLink;
    return location ? `${interview.type} • ${location}` : interview.type;
  }

  isSelectedApplicant(applicantId: string): boolean {
    return this.selectedCandidateId === applicantId;
  }

  getTabIcon(tab: string): string {
    switch (tab) {
      case 'pending': return 'fas fa-clock';
      case 'accepted': return 'fas fa-check-circle';
      case 'rejected': return 'fas fa-times-circle';
      case 'replacement': return 'fas fa-sync-alt';
      case 'hired': return 'fas fa-certificate';
      default: return 'fas fa-layer-group';
    }
  }

  getOutcomeLabel(outcome?: string): string {
    return outcome || 'Pending';
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

  private createDefaultInterviewForm(applicant?: EmployerApplicant): ScheduleInterviewPayload {
    return {
      applicantId: applicant?.id || '',
      jobId: this.job?.id || '',
      candidateName: applicant?.candidateName || '',
      date: this.getNextInterviewDate(),
      time: '11:00',
      type: 'Online',
      interviewerName: 'HireBridge Coordinator',
      location: '',
      meetingLink: 'https://meet.example.com/hirebridge-review',
      notes: applicant
        ? `Interview created after company approval for ${applicant.candidateName}.`
        : ''
    };
  }

  private applyTabSelection(): void {
    if (this.requestedTab) {
      this.activeTab = this.requestedTab;
      return;
    }

    if (!this.selectedCandidateId || !this.applicants.length) {
      this.activeTab = 'pending';
      return;
    }

    const selectedApplicant = this.applicants.find(applicant => applicant.id === this.selectedCandidateId);

    if (!selectedApplicant) {
      this.activeTab = 'pending';
      return;
    }

    const decision = selectedApplicant.companyDecision || 'pending';
    const map: Record<string, ReviewTab> = {
      pending: 'pending',
      accepted_for_interview: 'accepted',
      rejected: 'rejected',
      request_replacement: 'replacement',
      hired: 'hired'
    };

    this.activeTab = map[decision] || 'pending';
  }
}
