import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CandidateService } from '../../../core/services/candidate.service';
import { ToastService } from '../../../core/services/toast.service';

interface MatchedJob {
  id: string;
  companyLogo: string;
  companyName: string;
  jobTitle: string;
  location: string;
  workType: string;
  salaryRange: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  description?: string;
  status: 'Matched' | 'Under Review' | 'Interview Scheduled' | 'Hired' | 'Rejected';
  interviewId?: string;
  interviewCandidateStatus?: 'pending' | 'accepted' | 'rejected' | null;
  interviewDate?: string;
  interviewTime?: string;
}

@Component({
  selector: 'app-matched-opportunities',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './matched-opportunities.component.html',
  styleUrls: ['./matched-opportunities.component.css']
})
export class MatchedOpportunitiesComponent implements OnInit {

  matchedJobs: MatchedJob[] = [];
  isLoading = true;
  selectedJob: MatchedJob | null = null;

  pipelineSteps = ['Matched', 'Under Review', 'Interview', 'Decision'];

  constructor(
    private candidateService: CandidateService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.fetchOpportunities();
  }

  getCountByStatus(status: string): number {
    return this.matchedJobs.filter(j => j.status === status).length;
  }

  get averageFitScore(): number {
    if (!this.matchedJobs.length) return 0;
    const total = this.matchedJobs.reduce((sum, job) => sum + (job.matchScore || 0), 0);
    return Math.round(total / this.matchedJobs.length);
  }

  fetchOpportunities() {
    this.isLoading = true;
    this.candidateService.getMatchedOpportunities().subscribe({
      next: (res) => {
        this.matchedJobs = res.opportunities || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.toast.error('Failed to load opportunities');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(/\s+/g, '-');
  }

  viewJobDetails(job: MatchedJob) {
    this.selectedJob = job;
  }

  closeJobDetails() {
    this.selectedJob = null;
  }

  respondToInterview(job: MatchedJob, status: 'accepted' | 'rejected') {
    if (!job.interviewId) return;

    this.candidateService.respondToInterview(job.interviewId, status).subscribe({
      next: (res) => {
        this.toast.success(`Interview ${status === 'accepted' ? 'confirmed' : 'cancelled'} successfully`);
        job.interviewCandidateStatus = status;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.toast.error(err.error?.message || 'Failed to respond to interview');
      }
    });
  }
}
