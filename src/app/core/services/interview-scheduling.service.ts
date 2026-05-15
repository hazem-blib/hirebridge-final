import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { InterviewStatus } from '../../shared/enums/interview-status.enum';
import { InterviewOutcome, InterviewType, ScheduledInterview } from '../../shared/models/interview.model';
import { EmployerApplicationsService } from './employer-applications.service';

export interface ScheduleInterviewPayload {
  applicantId: string;
  jobId: string;
  candidateName: string;
  date: string;
  time: string;
  type: InterviewType;
  interviewerName?: string;
  location?: string;
  meetingLink?: string;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InterviewSchedulingService {
  private readonly baseUrl = `http://${window.location.hostname}:3004`;
  private allInterviewsCache$: Observable<ScheduledInterview[]> | null = null;

  constructor(
    private http: HttpClient,
    private employerApplicationsService: EmployerApplicationsService
  ) { }

  getAllInterviews(): Observable<ScheduledInterview[]> {
    const companyId = sessionStorage.getItem('companyId');
    if (!companyId) {
      return of([]);
    }

    return this.http.get<any>(`${this.baseUrl}/interview/get-company-interviews/${companyId}`, this.getAuthOptions()).pipe(
      map(response => {
        const list = Array.isArray(response?.interviews) ? response.interviews : [];
        return list.map((item: any) => this.mapInterview(item));
      }),
      catchError(() => of([]))
    );
  }

  getInterviewsByJob(jobId: string): Observable<ScheduledInterview[]> {
    const companyId = sessionStorage.getItem('companyId');
    if (!companyId) {
      return of([]);
    }

    return this.http.get<any>(`${this.baseUrl}/interview/get-company-interviews/${companyId}`, this.getAuthOptions()).pipe(
      map(response => {
        const list = Array.isArray(response?.interviews) ? response.interviews : [];
        return list
          .filter((item: any) => String(item.job?._id || item.job) === String(jobId))
          .map((item: any) => this.mapInterview(item));
      }),
      catchError(() => of([]))
    );
  }

  scheduleInterview(payload: ScheduleInterviewPayload): Observable<ScheduledInterview> {
    const scheduledAt = new Date(`${payload.date}T${payload.time}:00`).toISOString();
    const type = payload.type.toLowerCase();
    const location = type === 'online' ? (payload.meetingLink || 'Online Meeting') : (payload.location || 'Company HQ');

    const backendPayload = {
      scheduledAt,
      type,
      location
    };

    return this.http.post<any>(
      `${this.baseUrl}/interview/schedule-inerview/${payload.jobId}/${payload.applicantId}`,
      backendPayload,
      this.getAuthOptions()
    ).pipe(
      map(response => {
        const interview = this.mapInterview(response.interview);
        interview.candidateName = payload.candidateName;
        return interview;
      })
    );
  }

  recordInterviewOutcome(
    interviewId: string,
    outcome: InterviewOutcome,
    notes?: string
  ): Observable<ScheduledInterview> {
    const payload = {
      outcome,
      notes: notes || 'No specific outcome notes provided.'
    };

    return this.http.post<any>(
      `${this.baseUrl}/interview/update-interview-outcome/${interviewId}`,
      payload,
      this.getAuthOptions()
    ).pipe(
      map(response => this.mapInterview(response.interview))
    );
  }

  cancelInterview(interviewId: string): Observable<any> {
    // Backend doesn't have a specific cancel endpoint in the screenshot,
    // so we might use update outcome with a 'cancelled' status if supported,
    // or just return success for now.
    return of({ success: true });
  }

  completeInterview(interviewId: string): Observable<any> {
    // Similar to cancel, usually completion happens via outcome recording.
    return of({ success: true });
  }

  confirmHire(jobId: string, applicantId: string, interviewId: string): Observable<any> {
    return this.employerApplicationsService.updateCompanyDecision(applicantId, 'hired', jobId);
  }

  private mapInterview(item: any): ScheduledInterview {
    const scheduledAt = new Date(item.scheduledAt);
    return {
      id: item._id || item.id,
      applicantId: item.candidate?._id || item.candidate,
      jobId: item.job?._id || item.job,
      candidateName: item.candidate?.firstName 
        ? `${item.candidate.firstName} ${item.candidate.lastName || ''}`.trim() 
        : 'Candidate',
      date: scheduledAt.toISOString().slice(0, 10),
      time: scheduledAt.toTimeString().slice(0, 5),
      type: item.type === 'online' ? 'Online' : 'Onsite',
      status: item.status === 'scheduled' ? InterviewStatus.Scheduled : 
              item.status === 'completed' ? InterviewStatus.Completed : InterviewStatus.Cancelled,
      location: item.type === 'onsite' ? item.location : undefined,
      meetingLink: item.type === 'online' ? item.location : undefined,
      outcome: item.outcome || 'pending',
      candidateStatus: item.candidateStatus || 'pending',
      notes: item.notes,
      source: 'api'
    };
  }

  private getAuthOptions() {
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || '';
    return {
      headers: {
        auth: token
      }
    };
  }
}
