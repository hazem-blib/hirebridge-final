import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';

import { ApplicationsService, CandidateApplication } from '../../../core/services/applications.service';
import { CandidateService } from '../../../core/services/candidate.service';
import { APPLICATION_STATUS_LABELS, ApplicationStatus } from '../../../shared/enums/application-status.enum';
import { INTERVIEW_STATUS_LABELS } from '../../../shared/enums/interview-status.enum';
import { CvRequiredModalComponent } from '../../../shared/components/cv-required-modal/cv-required-modal.component';

@Component({
  standalone: true,
  selector: 'app-candidate-applications',
  imports: [CommonModule, FormsModule, CvRequiredModalComponent],
  templateUrl: './applications.component.html',
  styleUrls: ['./applications.component.css']
})
export class ApplicationsComponent implements OnInit {
  loading = false;
  error = '';
  actionMessage = '';
  applications: CandidateApplication[] = [];
  statusFilter = 'all';
  searchTerm = '';
  showCvModal = false;

  constructor(
    private applicationsService: ApplicationsService,
    private candidateService: CandidateService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadApplications();
  }

  get filteredApplications(): CandidateApplication[] {
    const filter = this.statusFilter.toLowerCase();
    const search = this.searchTerm.toLowerCase();

    return this.applications.filter(app => {
      const matchStatus = filter === 'all' || this.normalizeStatus(app.status) === filter;
      const terms = [
        app.jobTitle,
        app.companyName,
        app.status,
        app.interview?.type,
        app.interview?.interviewerName,
        app.interview?.location
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchSearch = !search || terms.includes(search);
      return matchStatus && matchSearch;
    });
  }

  countStatus(status: string): number {
    return this.applications.filter(app => this.normalizeStatus(app.status) === status).length;
  }

  private loadApplications() {
    this.loading = true;
    this.error = '';
    this.applicationsService.getApplications().subscribe({
      next: applications => {
        this.loading = false;
        this.applications = applications;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.error = 'Unable to load applications';
        this.cdr.detectChanges();
      }
    });
  }

  readonly statusLabels = APPLICATION_STATUS_LABELS;
  readonly interviewStatusLabels = INTERVIEW_STATUS_LABELS;

  normalizeStatus(value: any): string {
    const status = String(value || ApplicationStatus.Applied).trim().toLowerCase();
    if (status === ApplicationStatus.Hired) return ApplicationStatus.Hired;
    if (status === ApplicationStatus.Accepted) return ApplicationStatus.Accepted;
    if (status === ApplicationStatus.Rejected) return ApplicationStatus.Rejected;
    if (status === ApplicationStatus.InterviewScheduled) return ApplicationStatus.InterviewScheduled;
    if (status === ApplicationStatus.Shortlisted) return ApplicationStatus.Shortlisted;
    if (status === ApplicationStatus.UnderReview) return ApplicationStatus.UnderReview;
    return ApplicationStatus.Applied;
  }

  getStatusBadgeClass(value: any): string {
    const status = this.normalizeStatus(value);
    if (status === ApplicationStatus.Hired) return 'bg-success';
    if (status === ApplicationStatus.Accepted) return 'bg-success';
    if (status === ApplicationStatus.Rejected) return 'bg-danger';
    if (status === ApplicationStatus.InterviewScheduled) return 'bg-primary';
    if (status === ApplicationStatus.Shortlisted) return 'bg-info text-dark';
    return 'bg-warning text-dark';
  }

  getStatusLabel(value: any): string {
    return this.statusLabels[this.normalizeStatus(value) as ApplicationStatus] || 'Applied';
  }

  getInterviewStatusLabel(value: CandidateApplication): string | null {
    return value.interview ? this.interviewStatusLabels[value.interview.status] : null;
  }

  canDecide(app: CandidateApplication): boolean {
    const status = this.normalizeStatus(app.status);
    return (
      status !== ApplicationStatus.Accepted &&
      status !== ApplicationStatus.Hired &&
      status !== ApplicationStatus.Rejected
    );
  }

  accept(app: CandidateApplication): void {
    if (!this.canDecide(app)) {
      return;
    }

    this.actionMessage = '';
    this.error = '';

    // Pass true to forceRefresh and use take(1) to guarantee a single fresh emission
    this.candidateService.getCandidateProfile(true).pipe(take(1)).subscribe({
      next: (res: any) => {
        const user = res?.data?.user || res?.data || res?.user || res?.userDetails || res;
        const candidateProfile = user?.candidateProfile || res?.candidateProfile;

        let hasCv = false;
        if (candidateProfile) {
          const cvStr = candidateProfile.cv;
          const cvUrlStr = candidateProfile.cvUrl;
          
          if (typeof cvStr === 'string' && cvStr.trim() !== '' && cvStr !== 'null' && cvStr !== 'undefined') {
            hasCv = true;
          } else if (typeof cvUrlStr === 'string' && cvUrlStr.trim() !== '' && cvUrlStr !== 'null' && cvUrlStr !== 'undefined') {
            hasCv = true;
          } else if (candidateProfile.cvVerificationStatus === 'verified' || candidateProfile.isCvVerified === true) {
            hasCv = true;
          } else if (candidateProfile.fraudCheck && candidateProfile.fraudCheck.status === 'verified') {
            hasCv = true;
          }
        }

        if (!hasCv) {
          this.showCvModal = true;
          this.cdr.detectChanges();
          return;
        }

        // CV is verified, proceed with accept
        const previousStatus = app.status;
        app.status = ApplicationStatus.Accepted;

        this.applicationsService.acceptApplication(app.id).subscribe({
          next: () => {
            this.actionMessage = `Application for ${app.jobTitle} marked as accepted.`;
            this.cdr.detectChanges();
          },
          error: () => {
            app.status = previousStatus;
            this.error = 'Unable to update application status.';
            this.cdr.detectChanges();
          }
        });
      },
      error: () => {
        this.error = 'Failed to verify profile status. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  reject(app: CandidateApplication): void {
    if (!this.canDecide(app)) {
      return;
    }

    const previousStatus = app.status;
    app.status = ApplicationStatus.Rejected;
    this.actionMessage = '';
    this.error = '';

    this.applicationsService.rejectApplication(app.id).subscribe({
      next: () => {
        this.actionMessage = `Application for ${app.jobTitle} marked as rejected.`;
        this.cdr.detectChanges();
      },
      error: () => {
        app.status = previousStatus;
        this.error = 'Unable to update application status.';
        this.cdr.detectChanges();
      }
    });
  }
}
