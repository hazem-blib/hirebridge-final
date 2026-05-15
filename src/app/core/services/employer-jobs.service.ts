import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, filter, map, shareReplay, startWith, switchMap, take, tap, timeout } from 'rxjs/operators';
import { delay } from 'rxjs/operators';

import { WorkType } from '../../shared/enums/work-type.enum';

export interface EmployerJob {
  id: string;
  title: string;
  department: string;
  description: string;
  salary: number;
  type: WorkType;
  category: string;
  skillsRequired: string[];
  experienceLevel: EmployerJobPayload['experienceLevel'];
  minExperience: string;
  location: string;
  deadline: string;
  priority: EmployerJobPayload['priority'];
  createdAt: string;
  applicantsCount: number;
  hiredCount: number;
  openRoles: number;
  status: 'Open' | 'Filled' | 'Cancelled' | 'Draft';
  shortlistedCandidates?: any[];
  acceptedCandidates?: any[];
  rejectedCandidates?: any[];
  hiredCandidates?: any[];
  source?: 'local' | 'api';
}

export interface EmployerJobPayload {
  title: string;
  department: string;
  description: string;
  openRoles: number;
  budget: number;
  deadline: string;
  location: string;
  employmentType: 'full-time' | 'part-time' | 'remote' | 'hybrid';
  experienceLevel: 'junior' | 'mid' | 'senior' | 'lead' | 'expert';
  skills: string[];
  priority: 'low' | 'medium' | 'high';
}

export interface EmployerJobLegacyPayload {
  title: string;
  category: string;
  description: string;
  budget: {
    min: number;
    max?: number;
  };
  workType: string;
  experienceLevel: string;
  minExperience?: string;
  skillsRequired: string[];
}

export interface EmployerCreateJobApiPayload {
  title: string;
  category: string;
  description: string;
  skillsRequired: string[];
  experienceLevel: 'Junior' | 'Mid' | 'Senior' | 'Lead' | 'Expert';
  minExperience: number;
  headcount: number;
  budget: {
    min: number;
    max: number;
  };
  workType: 'Remote' | 'Onsite' | 'Hybrid' | 'PartTime' | 'FullTime' | 'Contract';
}

@Injectable({
  providedIn: 'root'
})
export class EmployerJobsService {
  private readonly baseUrl = `http://${window.location.hostname}:3004`;
  private readonly jobsSubject = new BehaviorSubject<EmployerJob[]>([]); // Start with empty, load from API
  private companyIdCache$: Observable<string> | null = null;

  constructor(private http: HttpClient) { }

  getJobs(): Observable<EmployerJob[]> {
    return this.getCompanyJobs();
  }

  getCompanyJobs(): Observable<EmployerJob[]> {
    return this.getOrFetchCompanyId().pipe(
      switchMap(companyId => this.fetchJobsByCompany(companyId)),
      catchError(() => of(this.jobsSubject.value)) // Return cached jobs immediately on error
    );
  }

  getJobById(jobId: string): Observable<EmployerJob> {
    const job = this.jobsSubject.value.find(item => item.id === jobId);

    if (job) {
      return of(job);
    }

    return this.getCompanyJobs().pipe(
      map(jobs => jobs.find(item => item.id === jobId) || null),
      filter((found): found is EmployerJob => found !== null),
      take(1),
      timeout(10000),
      catchError(err => {
        console.error('Job fetch error:', err);
        return throwError(() => new Error('Hiring request not found or session expired.'));
      })
    );
  }

  getOrFetchCompanyId(forceRefresh = false): Observable<string> {
    // If forceRefresh is false and we have a cached observable, use it
    if (!forceRefresh && this.companyIdCache$) {
      return this.companyIdCache$;
    }

    const companyId = this.extractObjectId(sessionStorage.getItem('companyId'));

    if (!forceRefresh && companyId) {
      // Cache the observable that returns the stored company ID
      this.companyIdCache$ = of(companyId).pipe(shareReplay(1));
      return this.companyIdCache$;
    }

    // If forceRefresh, clear the cache
    if (forceRefresh) {
      this.companyIdCache$ = null;
    }

    const authToken = String(sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || '').trim();

    if (!authToken) {
      return throwError(() => new Error('Unauthorized'));
    }

    // Create and cache the fetch observable
    this.companyIdCache$ = this.fetchCompanyIdFromApi(authToken)
      .pipe(
        timeout(5000),
        map(resolvedId => {
          sessionStorage.setItem('companyId', resolvedId);
          return resolvedId;
        }),
        catchError(error => {
          // Clear cache on error so next attempt will retry
          this.companyIdCache$ = null;

          if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
            return throwError(() => new Error('Unauthorized'));
          }

          return throwError(() => new Error((error as { message?: string })?.message || 'Company ID missing'));
        }),
        shareReplay(1) // Cache the result so multiple subscribers get the same value
      );

    return this.companyIdCache$;
  }

  createJobForCurrentCompany(payload: EmployerCreateJobApiPayload): Observable<EmployerJob> {
    return this.getOrFetchCompanyId(false).pipe(
      map(companyId => this.extractObjectId(companyId)),
      map(companyId => {
        if (!companyId) {
          throw new Error('Company ID missing');
        }

        return companyId;
      }),
      switchMap(companyId => this.createJob(companyId, payload)),
      catchError(error => {
        const message = String((error as { message?: string })?.message || '').toLowerCase();

        if (!message.includes('company not found')) {
          const localJob = this.createLocalJobFromApiPayload(payload);
          this.prependJob(localJob);
          return of(localJob);
        }

        return this.getOrFetchCompanyId(true).pipe(
          switchMap(freshCompanyId => this.createJob(freshCompanyId, payload)),
          catchError(() => {
            const localJob = this.createLocalJobFromApiPayload(payload);
            this.prependJob(localJob);
            return of(localJob);
          })
        );
      })
    );
  }

  createJob(
    companyId: string,
    payload: EmployerCreateJobApiPayload
  ): Observable<EmployerJob> {
    const normalizedCompanyId = this.extractObjectId(companyId);

    if (!normalizedCompanyId) {
      return throwError(() => new Error('Company ID is required.'));
    }

    const authToken = String(sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || '').trim();
    const headers = authToken ? new HttpHeaders({ auth: authToken }) : undefined;

    return this.http
      .post<unknown>(
        `${this.baseUrl}/job/createJob/${normalizedCompanyId}`,
        payload,
        headers ? { headers } : undefined
      )
      .pipe(
        map(response => this.mapApiResponseToJob(response, payload)),
        tap(job => this.prependJob(job)),
        catchError(error => this.handleCreateJobError(error))
      );
  }

  updateJob(
    jobId: string,
    payload: EmployerJobPayload | EmployerJobLegacyPayload
  ): Observable<EmployerJob> {
    const normalized = this.normalizePayload(payload);
    const currentJob = this.jobsSubject.value.find(job => job.id === jobId);

    if (!currentJob) {
      return throwError(() => new Error('Job not found.'));
    }

    const updatedJob: EmployerJob = {
      ...currentJob,
      title: normalized.title,
      department: normalized.department,
      category: normalized.department,
      description: normalized.description,
      skillsRequired: normalized.skills,
      experienceLevel: normalized.experienceLevel,
      minExperience: this.resolveMinExperience(normalized.experienceLevel),
      salary: normalized.budget,
      type: this.mapEmploymentTypeToWorkType(normalized.employmentType),
      location: normalized.location,
      deadline: normalized.deadline,
      priority: normalized.priority,
      openRoles: normalized.openRoles,
      source: 'local'
    };

    const jobs = this.jobsSubject.value.map(job => (job.id === jobId ? updatedJob : job));

    this.jobsSubject.next(jobs);
    return of(updatedJob).pipe(delay(180));
  }

  incrementApplicantsCount(jobId: string): void {
    this.jobsSubject.next(
      this.jobsSubject.value.map(job =>
        job.id === jobId
          ? { ...job, applicantsCount: (job.applicantsCount || 0) + 1 }
          : job
      )
    );
  }

  recordHiring(jobId: string): void {
    this.jobsSubject.next(
      this.jobsSubject.value.map(job => {
        if (job.id === jobId) {
          const newHiredCount = (job.hiredCount || 0) + 1;
          const isFilled = newHiredCount >= (job.openRoles || 1);
          return { 
            ...job, 
            hiredCount: newHiredCount,
            status: (isFilled ? 'Filled' : job.status) as EmployerJob['status']
          };
        }
        return job;
      })
    );
  }

  deleteJob(jobId: string): Observable<void> {
    const job = this.jobsSubject.value.find(item => item.id === jobId);

    if (!job) {
      return throwError(() => new Error('Job not found.'));
    }

    this.jobsSubject.next(this.jobsSubject.value.filter(item => item.id !== jobId));
    return of(void 0).pipe(delay(120));
  }

  seedJobs(jobs: EmployerJob[]): void {
    this.jobsSubject.next(jobs);
  }

  clearJobs(): void {
    this.jobsSubject.next([]);
  }

  reset(): void {
    this.companyIdCache$ = null;
    this.jobsSubject.next([]);
  }

  private createLocalJob(payload: EmployerJobPayload): EmployerJob {
    return {
      id: `job-${Date.now()}`,
      title: payload.title,
      department: payload.department,
      description: payload.description,
      salary: payload.budget,
      type: this.mapEmploymentTypeToWorkType(payload.employmentType),
      category: payload.department,
      skillsRequired: payload.skills,
      experienceLevel: payload.experienceLevel,
      minExperience: this.resolveMinExperience(payload.experienceLevel),
      location: payload.location,
      deadline: payload.deadline,
      priority: payload.priority,
      createdAt: new Date().toISOString(),
      applicantsCount: 0,
      hiredCount: 0,
      openRoles: payload.openRoles,
      status: 'Open',
      source: 'local'
    };
  }

  private createLocalJobFromApiPayload(payload: EmployerCreateJobApiPayload): EmployerJob {
    return {
      id: `JOB-${Math.floor(Math.random() * 9000) + 1000}`,
      title: payload.title,
      department: payload.category,
      description: payload.description,
      salary: Number(payload.budget.max || payload.budget.min || 0),
      type: this.mapApiWorkTypeToEnum(payload.workType),
      category: payload.category,
      skillsRequired: payload.skillsRequired,
      experienceLevel: this.mapApiExperienceLevel(payload.experienceLevel),
      minExperience: String(payload.minExperience || 0),
      location: this.resolveLocationFromWorkType(payload.workType),
      deadline: this.getDefaultDeadline(),
      priority: 'medium',
      createdAt: new Date().toISOString(),
      applicantsCount: 0,
      hiredCount: 0,
      openRoles: 1,
      status: 'Open',
      source: 'local'
    };
  }

  private normalizePayload(
    payload: EmployerJobPayload | EmployerJobLegacyPayload
  ): EmployerJobPayload {
    if ('department' in payload) {
      return payload;
    }

    return {
      title: payload.title,
      department: payload.category,
      description: payload.description,
      openRoles: 1,
      budget: Number(payload.budget.min || 0),
      deadline: this.getDefaultDeadline(),
      location: this.resolveLocation(payload.workType),
      employmentType: this.mapLegacyWorkType(payload.workType),
      experienceLevel: this.mapLegacyExperienceLevel(payload.experienceLevel),
      skills: payload.skillsRequired,
      priority: 'medium'
    };
  }

  private mapEmploymentTypeToWorkType(
    type: EmployerJobPayload['employmentType']
  ): WorkType {
    const map: Record<EmployerJobPayload['employmentType'], WorkType> = {
      'full-time': WorkType.FullTime,
      'part-time': WorkType.PartTime,
      remote: WorkType.Remote,
      hybrid: WorkType.Hybrid
    };

    return map[type];
  }

  private mapLegacyWorkType(workType: string): EmployerJobPayload['employmentType'] {
    const normalized = String(workType || '').trim().toLowerCase();
    if (normalized.includes('part')) return 'part-time';
    if (normalized.includes('remote')) return 'remote';
    if (normalized.includes('hybrid')) return 'hybrid';
    return 'full-time';
  }

  private mapLegacyExperienceLevel(
    level: string
  ): EmployerJobPayload['experienceLevel'] {
    const normalized = String(level || '').trim().toLowerCase();
    if (normalized.includes('jun')) return 'junior';
    if (normalized.includes('mid')) return 'mid';
    if (normalized.includes('sen')) return 'senior';
    if (normalized.includes('lead')) return 'lead';
    if (normalized.includes('exp')) return 'expert';
    return 'mid';
  }

  private resolveLocation(workType: string): string {
    const normalized = String(workType || '').toLowerCase();
    if (normalized.includes('remote')) return 'Remote';
    if (normalized.includes('hybrid')) return 'Cairo, Egypt';
    return 'Cairo, Egypt';
  }

  private resolveMinExperience(level: EmployerJobPayload['experienceLevel']): string {
    if (level === 'junior') return '1+';
    if (level === 'senior') return '5+';
    if (level === 'lead') return '8+';
    if (level === 'expert') return '10+';
    return '3+';
  }

  private getDefaultDeadline(): string {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().slice(0, 10);
  }

  private prependJob(job: EmployerJob): void {
    this.jobsSubject.next([job, ...this.jobsSubject.value.filter(item => item.id !== job.id)]);
  }

  private fetchJobsByCompany(companyId: string, retried = false): Observable<EmployerJob[]> {
    const authToken = String(sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || '').trim();
    const options = authToken ? { headers: new HttpHeaders({ auth: authToken }) } : undefined;
    const normalizedCompanyId = this.extractObjectId(companyId);

    if (!normalizedCompanyId) {
      return of(this.jobsSubject.value);
    }

    const endpoints = [
      `${this.baseUrl}/company/getSpecificCompanyJobs/${normalizedCompanyId}`,
      `${this.baseUrl}/job/getSpecificCompanyJobs/${normalizedCompanyId}`
    ];

    return this.fetchJobsByCompanyFromEndpoints(endpoints, options)
      .pipe(
        tap(jobs => {
          if (jobs.length) {
            this.jobsSubject.next(jobs);
          }
        }),
        catchError(error => {
          const isAuthOrNotFound = error instanceof HttpErrorResponse &&
            (error.status === 404 || error.status === 403 || error.status === 401);

          if (isAuthOrNotFound && !retried) {
            sessionStorage.removeItem('companyId');
            this.companyIdCache$ = null;

            return this.getOrFetchCompanyId(true).pipe(
              switchMap(freshCompanyId => this.fetchJobsByCompany(freshCompanyId, true)),
              catchError(() => of(this.jobsSubject.value))
            );
          }

          return of(this.jobsSubject.value);
        })
      );
  }

  private fetchCompanyIdFromApi(authToken: string): Observable<string> {
    // Only use the correct endpoint as requested
    const endpoint = `${this.baseUrl}/job/get-company-to-store-id`;

    return this.http.get<unknown>(endpoint, {
      headers: new HttpHeaders({ auth: authToken })
    }).pipe(
      map(response => {
        const resolvedId = this.extractCompanyIdFromResponse(response);

        if (!resolvedId) {
          throw new Error('Company ID missing');
        }

        return resolvedId;
      }),
      catchError(() => {
        // Fallback to token if API fails
        const tokenCompanyId = this.extractCompanyIdFromToken(authToken);
        if (tokenCompanyId) return of(tokenCompanyId);
        return throwError(() => new Error('Company ID missing'));
      })
    );
  }

  private fetchJobsByCompanyFromEndpoints(
    endpoints: string[],
    options?: { headers: HttpHeaders },
    index = 0
  ): Observable<EmployerJob[]> {
    if (index >= endpoints.length) {
      return throwError(() => new Error('Jobs endpoint not found'));
    }

    return this.http.get<unknown>(endpoints[index], options).pipe(
      map(response => this.normalizeJobsResponse(response)),
      catchError((error) => {
        if (index + 1 >= endpoints.length) {
          return throwError(() => error);
        }
        return this.fetchJobsByCompanyFromEndpoints(endpoints, options, index + 1);
      })
    );
  }

  private normalizeJobsResponse(response: unknown): EmployerJob[] {
    const list = this.extractJobsList(response);

    if (!list.length) {
      return this.jobsSubject.value;
    }

    return list.map(item => this.mapApiJobToEmployerJob(item));
  }

  private extractJobsList(response: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(response)) {
      return response as Array<Record<string, unknown>>;
    }

    const root = this.asRecord(response);

    if (Array.isArray(root?.['jobs'])) {
      return root?.['jobs'] as Array<Record<string, unknown>>;
    }

    if (Array.isArray(root?.['data'])) {
      return root?.['data'] as Array<Record<string, unknown>>;
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
      deadline: this.asString(item['deadline']) || this.getDefaultDeadline(),
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

  private mapApiResponseToJob(
    response: unknown,
    payload: EmployerCreateJobApiPayload
  ): EmployerJob {
    const responseRecord = this.asRecord(response);
    const candidate =
      this.asRecord(responseRecord?.['job']) ||
      this.asRecord(responseRecord?.['data']) ||
      this.asRecord(responseRecord?.['newJob']) ||
      responseRecord;

    const id =
      this.asString(candidate?.['_id']) ||
      this.asString(candidate?.['id']) ||
      `job-${Date.now()}`;

    const title = this.asString(candidate?.['title']) || payload.title;
    const category = this.asString(candidate?.['category']) || payload.category;
    const description = this.asString(candidate?.['description']) || payload.description;
    const minBudget = Number(payload.budget.min || 0);
    const maxBudget = Number(payload.budget.max || payload.budget.min || 0);
    const resolvedSalary =
      Number(candidate?.['salary']) ||
      Number(candidate?.['budget']) ||
      maxBudget ||
      minBudget;
    const rawWorkType =
      this.asString(candidate?.['workType']) ||
      this.asString(candidate?.['employmentType']) ||
      payload.workType;

    return {
      id,
      title,
      department: category,
      description,
      salary: resolvedSalary,
      type: this.mapApiWorkTypeToEnum(rawWorkType),
      category,
      skillsRequired: Array.isArray(candidate?.['skillsRequired'])
        ? (candidate?.['skillsRequired'] as string[])
        : payload.skillsRequired,
      experienceLevel: this.mapApiExperienceLevel(
        this.asString(candidate?.['experienceLevel']) || payload.experienceLevel
      ),
      minExperience:
        this.asString(candidate?.['minExperience']) || String(payload.minExperience),
      location: this.resolveLocationFromWorkType(rawWorkType),
      deadline: this.getDefaultDeadline(),
      priority: 'medium',
      createdAt: this.asString(candidate?.['createdAt']) || new Date().toISOString(),
      applicantsCount: Number(candidate?.['applicantsCount'] || (candidate?.['shortlistedCandidates'] as any[])?.length || (candidate?.['shortlisted'] as any[])?.length || 0),
      hiredCount: Number((candidate?.['hiredCandidates'] as any[])?.length || (candidate?.['hired'] as any[])?.length || (candidate?.['acceptedCandidates'] as any[])?.length || (candidate?.['accepted'] as any[])?.length || 0),
      openRoles: Number(candidate?.['headcount'] || candidate?.['openRoles'] || 1),
      status: this.mapApiStatus(this.asString(candidate?.['status'])),
      shortlistedCandidates: Array.isArray(candidate?.['shortlistedCandidates']) ? candidate?.['shortlistedCandidates'] : (Array.isArray(candidate?.['shortlisted']) ? candidate?.['shortlisted'] : []),
      acceptedCandidates: Array.isArray(candidate?.['acceptedCandidates']) ? candidate?.['acceptedCandidates'] : (Array.isArray(candidate?.['accepted']) ? candidate?.['accepted'] : []),
      rejectedCandidates: Array.isArray(candidate?.['rejectedCandidates']) ? candidate?.['rejectedCandidates'] : (Array.isArray(candidate?.['rejected']) ? candidate?.['rejected'] : []),
      hiredCandidates: Array.isArray(candidate?.['hiredCandidates']) ? candidate?.['hiredCandidates'] : (Array.isArray(candidate?.['hired']) ? candidate?.['hired'] : []),
      source: 'api'
    };
  }

  private mapApiWorkTypeToEnum(workType: string): WorkType {
    const normalized = String(workType || '').trim().toLowerCase();
    if (normalized.includes('remote')) return WorkType.Remote;
    if (normalized.includes('hybrid')) return WorkType.Hybrid;
    if (normalized.includes('part')) return WorkType.PartTime;
    if (normalized.includes('on')) return WorkType.Onsite;
    return WorkType.FullTime;
  }

  private mapApiExperienceLevel(
    level: string
  ): EmployerJobPayload['experienceLevel'] {
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

  private mapApiStatus(status: string): EmployerJob['status'] {
    const s = status?.toLowerCase();
    if (s === 'active' || s === 'open') return 'Open';
    if (s === 'filled') return 'Filled';
    if (s === 'cancelled') return 'Cancelled';
    return 'Draft';
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

  private extractObjectId(value: unknown): string {
    const normalized = String(value || '').trim();
    return /^[a-fA-F0-9]{24}$/.test(normalized) ? normalized : '';
  }

  private extractCompanyIdFromResponse(response: unknown): string {
    const rawId = this.extractObjectId(response);

    if (rawId) {
      return rawId;
    }

    const root = this.asRecord(response);
    const data = this.asRecord(root?.['data']);
    const company = this.asRecord(root?.['company']) || this.asRecord(data?.['company']);

    return (
      this.extractObjectId(root?.['_id']) ||
      this.extractObjectId(root?.['id']) ||
      this.extractObjectId(root?.['companyId']) ||
      this.extractObjectId(data?.['companyId']) ||
      this.extractObjectId(company?.['_id']) ||
      this.extractObjectId(company?.['id'])
    );
  }

  private extractCompanyIdFromToken(token: string): string {
    try {
      const payload = JSON.parse(atob(token.split('.')[1] || '')) as Record<string, unknown>;

      return this.extractCompanyIdFromResponse(payload);
    } catch {
      return '';
    }
  }

  private handleCreateJobError(error: unknown): Observable<never> {
    if (!(error instanceof HttpErrorResponse)) {
      return throwError(() => new Error('Unable to create hiring request right now.'));
    }

    const messageFromBody =
      this.asString(this.asRecord(error.error)?.['message']) ||
      this.asString(error.error);

    if (error.status === 404 || messageFromBody.toLowerCase().includes('company not found')) {
      return throwError(() => new Error('Company not found'));
    }

    if (
      error.status === 401 ||
      error.status === 403 ||
      messageFromBody.toLowerCase().includes('unauthorized')
    ) {
      return throwError(() => new Error('Unauthorized'));
    }

    return throwError(() => new Error(messageFromBody || 'Unable to create hiring request right now.'));
  }
}
