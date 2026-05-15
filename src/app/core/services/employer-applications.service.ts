import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, timeout, switchMap } from 'rxjs/operators';

import { ApplicationStatus } from '../../shared/enums/application-status.enum';
import { EmployerJobsService } from './employer-jobs.service';

export interface EmployerApplicant {
  id: string;
  jobId: string;
  jobTitle: string;
  department: string;
  candidateName: string;
  email: string;
  status: ApplicationStatus;
  appliedAt: string;
  experienceYears?: number;
  fitScore?: number;
  salaryExpectation?: number;
  notes?: string;
  workType?: string;
  salaryMatch: 'within_budget' | 'slightly_above' | 'out_of_budget';
  source?: 'local' | 'mock' | 'api';
  shortlistStage?: 'recommended' | 'sent_to_company' | 'interviewing' | 'offer' | 'hired';
  companyDecision?: 'pending' | 'accepted_for_interview' | 'rejected' | 'request_replacement' | 'hired';
  probationStatus?: 'not_started' | 'active' | 'completed';
  trustScore?: number;
  fraudRisk?: 'low' | 'medium' | 'high';
  probationPrediction?: 'low_risk' | 'watch' | 'strong';
}

@Injectable({
  providedIn: 'root'
})
export class EmployerApplicationsService {
  private readonly baseUrl = `http://${window.location.hostname}:3004`;

  constructor(
    private http: HttpClient,
    private employerJobsService: EmployerJobsService
  ) { }

  getApplicantsByJob(jobId: string): Observable<EmployerApplicant[]> {
    return this.employerJobsService.getJobById(jobId).pipe(
      switchMap((job: any) => {
        return this.http.get<any>(`${this.baseUrl}/job/get-shortListed-candidates-Of-specific-job/${jobId}`, this.getAuthOptions()).pipe(
          timeout(4000),
          map(response => {
            const shortlisted = this.extractArray(response?.shortlisted);
            const accepted = this.extractArray(response?.accepted);
            const rejected = this.extractArray(response?.rejected);
            const hired = this.extractArray(response?.hired);

            const all: EmployerApplicant[] = [];

            shortlisted.forEach((item, index) => {
              const app = this.mapApplicant(item, String(jobId), index, job);
              app.companyDecision = 'pending';
              app.status = ApplicationStatus.Shortlisted;
              all.push(app);
            });

            accepted.forEach((item, index) => {
              const app = this.mapApplicant(item, String(jobId), index + 100, job);
              app.companyDecision = 'accepted_for_interview';
              app.status = ApplicationStatus.Accepted;
              app.shortlistStage = 'interviewing';
              all.push(app);
            });

            rejected.forEach((item, index) => {
              const app = this.mapApplicant(item, String(jobId), index + 200, job);
              app.companyDecision = 'rejected';
              app.status = ApplicationStatus.Rejected;
              all.push(app);
            });

            hired.forEach((item, index) => {
              const app = this.mapApplicant(item, String(jobId), index + 300, job);
              app.companyDecision = 'hired';
              app.status = ApplicationStatus.Hired;
              app.shortlistStage = 'hired';
              app.probationStatus = 'active';
              all.push(app);
            });

            return all;
          })
        );
      })
    );
  }

  getAllApplicants(): Observable<EmployerApplicant[]> {
    return this.employerJobsService.getCompanyJobs().pipe(
      timeout(5000),
      map(jobsResponse => {
        const jobs = this.extractJobsList(jobsResponse);
        const allShortlisted: EmployerApplicant[] = [];

        jobs.forEach((job: any) => {
          const jobId = job._id || job.id;
          if (!jobId) return;

          const shortlist = job.shortlistedCandidates || [];
          const accepted = job.acceptedCandidates || [];
          const rejected = job.rejectedCandidates || [];
          const hired = job.hiredCandidates || [];

          shortlist.forEach((item: any, index: number) => {
            const app = this.mapApplicant(item, String(jobId), index);
            app.companyDecision = 'pending';
            allShortlisted.push(app);
          });

          accepted.forEach((item: any, index: number) => {
            const app = this.mapApplicant(item, String(jobId), index + 1000);
            app.companyDecision = 'accepted_for_interview';
            allShortlisted.push(app);
          });

          rejected.forEach((item: any, index: number) => {
            const app = this.mapApplicant(item, String(jobId), index + 2000);
            app.companyDecision = 'rejected';
            allShortlisted.push(app);
          });

          hired.forEach((item: any, index: number) => {
            const app = this.mapApplicant(item, String(jobId), index + 3000);
            app.companyDecision = 'hired';
            allShortlisted.push(app);
          });
        });

        return allShortlisted;
      }),
      catchError(() => of([]))
    );
  }

  acceptCandidate(jobId: string, applicant: EmployerApplicant): Observable<EmployerApplicant> {
    return this.http.post<any>(`${this.baseUrl}/job/accept-candidate-from-shortlisting/${jobId}/${applicant.id}`, {}, this.getAuthOptions()).pipe(
      timeout(5000),
      map(() => {
        applicant.companyDecision = 'accepted_for_interview';
        applicant.status = ApplicationStatus.Accepted;
        applicant.shortlistStage = 'interviewing';
        return { ...applicant };
      })
    );
  }

  rejectCandidate(jobId: string, candidateId: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/job/reject-candidate-from-shortlisting/${jobId}/${candidateId}`, {}, this.getAuthOptions()).pipe(
      timeout(5000),
      map(response => {
        const raw = response.job?.rejectedCandidates?.find((c: any) => String(c.candidate?._id || c.candidate) === candidateId) || {};
        const mapped = this.mapApplicant(raw, jobId, 0);
        mapped.companyDecision = 'rejected';
        mapped.status = ApplicationStatus.Rejected;
        return mapped;
      })
    );
  }

  updateCompanyDecision(applicantId: string, decision: string, jobId?: string): Observable<any> {
    if (decision === 'hired' && jobId) {
      return this.http.post<any>(`${this.baseUrl}/job/hire-candidate-from-shortlisting/${jobId}/${applicantId}`, {}, this.getAuthOptions()).pipe(
        timeout(5000),
        map(response => {
          const raw = response.job?.hiredCandidates?.find((c: any) => String(c.candidate?._id || c.candidate) === applicantId) || {};
          const mapped = this.mapApplicant(raw, jobId, 0);
          mapped.companyDecision = 'hired';
          mapped.status = ApplicationStatus.Hired;
          mapped.shortlistStage = 'hired';
          return mapped;
        })
      );
    }

    if (decision === 'accepted_for_interview' && jobId) {
      return this.http.post<any>(`${this.baseUrl}/job/accept-candidate-from-shortlisting/${jobId}/${applicantId}`, {}, this.getAuthOptions()).pipe(
        timeout(5000),
        map(() => ({ id: applicantId, companyDecision: 'accepted_for_interview' }))
      );
    }

    return of({ success: true }).pipe(timeout(1000));
  }

  private extractJobsList(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.jobs)) return response.jobs;
    if (Array.isArray(response?.data)) return response.data;
    return [];
  }

  private getAuthOptions() {
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || '';
    return {
      headers: {
        auth: token
      }
    };
  }

  private extractArray(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.candidatesOfThisJob)) return response.candidatesOfThisJob;
    if (Array.isArray(response?.applicants)) return response.applicants;
    return [];
  }

  private mapApplicant(item: any, jobId: string, index: number, jobContext?: any): EmployerApplicant {
    const user = item.candidate || {};
    const profile = user.candidateProfile || {};
    const candidateId = user._id || user.id || (typeof item.candidate === 'string' ? item.candidate : '');

    const expectedSalary = Number(profile.expectedSalary?.max || item?.salaryExpectation || 0);
    const budget = Number(jobContext?.salary || item?.budget || expectedSalary || 0);
    const candidateName = user.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : (candidateId ? `Candidate ${candidateId.slice(-4)}` : `Candidate ${index + 1}`);

    const fitScore = item.matchScore || (jobContext ? this.calculateFitScore(user, jobContext) : 85);

    return {
      id: candidateId,
      jobId: String(jobId),
      jobTitle: item?.jobTitle || item?.title || jobContext?.title || 'Open Role',
      department: item?.department || item?.category || jobContext?.department || 'General',
      candidateName,
      email: user.email || '',
      status: ApplicationStatus.Shortlisted,
      appliedAt: item?.sentAt || item?.appliedAt || new Date().toISOString(),
      experienceYears: profile.experienceLevel || 0,
      fitScore: fitScore,
      salaryExpectation: expectedSalary,
      notes: profile.notes || 'No notes available.',
      workType: profile.workType || 'Remote',
      salaryMatch: expectedSalary <= budget ? 'within_budget' : (expectedSalary <= budget * 1.2 ? 'slightly_above' : 'out_of_budget'),
      source: 'api',
      shortlistStage: 'sent_to_company',
      companyDecision: 'pending',
      probationStatus: 'not_started'
    };
  }

  private calculateFitScore(candidateUser: any, job: any): number {
    let score = 95; // Base high score for being matched
    const profile = candidateUser.candidateProfile || {};

    const normalize = (val: any) => {
      if (typeof val === 'string') {
        val = val.toLowerCase();
        if (val.includes('k')) return parseFloat(val) * 1000;
        return parseFloat(val) || 0;
      }
      const num = Number(val);
      return (num > 0 && num < 1000) ? num * 1000 : num;
    };

    const normExpected = normalize(profile.expectedSalary?.max || profile.expectedSalary || 0);
    const normBudget = normalize(Number(job.salary || 0));

    // 1. Budget alignment
    if (normBudget > 0 && normExpected > 0) {
      if (normExpected > normBudget) {
        const ratio = (normExpected - normBudget) / normBudget;
        if (ratio > 0.5) score -= 40;
        else if (ratio > 0.2) score -= 20;
        else score -= 10;
      } else {
        score += 5;
      }
    }

    // 2. Experience alignment
    const jobExp = parseInt(job.minExperience) || 0;
    const candExp = parseInt(profile.experienceLevel) || 0;
    if (candExp < jobExp) {
      score -= Math.min(30, (jobExp - candExp) * 10);
    }

    // 3. Skill Alignment
    if (job.skillsRequired && job.skillsRequired.length > 0) {
      const skills = (job.skillsRequired as string[]).map(s => s.toLowerCase());
      const candRole = (profile.specialization || profile.role || '').toLowerCase();
      const candSummary = (profile.cvSummary || profile.fraudCheck?.reason || '').toLowerCase();

      const matchedCount = skills.filter(s =>
        candRole.includes(s) || candSummary.includes(s)
      ).length;

      const ratio = matchedCount / skills.length;
      if (ratio < 0.3) score -= 15;
      else if (ratio > 0.7) score += 5;
    }

    return Math.max(5, Math.min(100, score));
  }

  updateStatus(applicantId: string, status: ApplicationStatus): Observable<any> {
    return of({ success: true });
  }

  updateFromCandidateDecision(applicantId: string, status: ApplicationStatus): void {
    // Linked to candidate side action
  }

  addMockApplicant(jobId: string): any {
    return {};
  }
}
