import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap, shareReplay, combineLatest, of, catchError } from 'rxjs';

export interface AdminJob {
  id: string;
  title: string;
  company: string;
  companyIndustry: string;
  location: string;
  status: 'Open' | 'Closed' | 'In Review';
  requestedAt: string;
  workType: 'Remote' | 'Hybrid' | 'Onsite' | 'FullTime' | 'PartTime' | 'Contract';
  budget: number;
  openRoles: number;
  minExperience: string;
  skills: string[];
  shortlistedCandidates: any[];
  acceptedCandidates: any[];
  rejectedCandidates: any[];
  hiredCandidates: any[];
}

export interface AdminCompany {
  id: string;
  name: string;
  industry: string;
  openRoles: number;
  newestJobAt: string;
}

export interface AdminCandidate {
  id: string;
  name: string;
  role: string;
  experience: string;
  status: 'Screening' | 'Interviewing' | 'Shortlisted' | 'Accepted' | 'Rejected' | 'Hired';
  expectedSalary: number;
  fitScore: number;
  cvSummary: string;
  cvUrl?: string;
  createdAt: string;
}

export interface AdminInterview {
  id: string;
  jobId: string;
  candidateId: string;
  candidateName: string;
  companyName: string;
  role: string;
  date: string;
  status: 'Scheduled' | 'Completed' | 'Pending' | 'Hired' | 'Rejected' | 'Rescheduled' | 'Cancelled';
  candidateStatus?: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `http://${window.location.hostname}:3004`;

  private jobsCache$: Observable<AdminJob[]> | null = null;
  private jobsCacheTime = 0;

  clearCache(): void {
    this.jobsCache$ = null;
    this.jobsCacheTime = 0;
  }

  getJobs(): Observable<AdminJob[]> {
    const now = Date.now();
    // Cache for 10 seconds to combine concurrent requests
    if (this.jobsCache$ && (now - this.jobsCacheTime < 10000)) {
      return this.jobsCache$;
    }
    
    this.jobsCacheTime = now;
    this.jobsCache$ = this.http.get<any>(`${this.baseUrl}/system/get-all-jobs`).pipe(
      map(response => {
        const jobs = response.jobs || [];
        return jobs.map((job: any) => this.mapApiJobToAdminJob(job));
      }),
      shareReplay(1)
    );
    
    return this.jobsCache$;
  }

  getJobById(jobId: string): Observable<AdminJob | null> {
    return this.getJobs().pipe(
      map(jobs => jobs.find(j => j.id === jobId) || null)
    );
  }

  getMatchingCandidates(jobId: string): Observable<AdminCandidate[]> {
    return combineLatest([
      this.http.get<any>(`${this.baseUrl}/system/get-matching-candidates/${jobId}`),
      this.getJobById(jobId),
      this.http.get<any>(`${this.baseUrl}/system/get-all-interviews`).pipe(catchError(() => of({ interviews: [] })))
    ]).pipe(
      map(([response, job, interviewsResponse]) => {
        const candidates = response.candidates || [];
        const interviews = interviewsResponse.interviews || [];
        
        return candidates.map((c: any) => {
          const cand = this.mapApiUserToAdminCandidate(c);
          
          // Cross-reference with interviews for this specific job
          const candidateInterview = interviews.find((i: any) => 
            String(i.job?._id || i.job) === String(jobId) && 
            String(i.candidate?._id || i.candidate) === String(cand.id)
          );

          if (candidateInterview && candidateInterview.candidateStatus === 'rejected') {
            cand.status = 'Rejected';
          } else if (candidateInterview) {
            cand.status = 'Interviewing';
          }

          if (job) {
            cand.fitScore = this.calculateFitScore(cand, job);
          }
          return cand;
        });
      })
    );
  }

  public calculateFitScore(candidate: AdminCandidate, job: AdminJob): number {
    let score = 95; // Base high score for being "matched" by the system

    const normalize = (val: any) => {
      if (!val) return 0;
      let str = String(val).toLowerCase();
      let num = parseFloat(str.replace(/[^0-9.]/g, ''));
      if (isNaN(num)) return 0;
      if (str.includes('k')) return num * 1000;
      return (num > 0 && num < 5000) ? num * 1000 : num;
    };

    const normExpected = normalize(candidate.expectedSalary);
    const normBudget = normalize(job.budget);

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

    // 2. Experience Alignment
    const jobExp = parseInt(job.minExperience) || 0;
    const candExp = parseInt(candidate.experience) || 0;
    
    if (candExp < jobExp) {
      score -= Math.min(30, (jobExp - candExp) * 10);
    }

    // 3. Skill Alignment
    if (job.skills && job.skills.length > 0) {
      const skills = job.skills.map(s => s.toLowerCase());
      const candRole = candidate.role.toLowerCase();
      const candSummary = (candidate.cvSummary || '').toLowerCase();
      
      const matchedCount = skills.filter(s => 
        candRole.includes(s) || candSummary.includes(s)
      ).length;
      
      const ratio = matchedCount / skills.length;
      if (ratio < 0.3) score -= 15;
      else if (ratio > 0.7) score += 5;
    }

    return Math.max(5, Math.min(100, score));
  }

  getCandidates(): Observable<AdminCandidate[]> {
    // combine jobs and interviews to get real statuses
    return this.getJobs().pipe(
      switchMap(jobs => {
        const candidateMap = new Map<string, AdminCandidate>();
        
        jobs.forEach(job => {
          const processSet = (list: any[], status: AdminCandidate['status']) => {
            list.forEach((sc: any) => {
              const c = sc.candidate || sc; // Handle potential nested candidate
              if (!c || !c._id) return;
              
              const id = c._id;
              if (!candidateMap.has(id)) {
                candidateMap.set(id, this.mapApiUserToAdminCandidate(c));
              }
              
              const cand = candidateMap.get(id)!;
              // Hierarchy: Hired > Accepted > Rejected > Shortlisted
              if (status === 'Hired') cand.status = 'Hired';
              else if (status === 'Accepted' && cand.status !== 'Hired') cand.status = 'Accepted';
              else if (status === 'Rejected' && !['Hired', 'Accepted'].includes(cand.status)) cand.status = 'Rejected';
              else if (status === 'Shortlisted' && !['Hired', 'Accepted', 'Rejected'].includes(cand.status)) cand.status = 'Shortlisted';
            });
          };

          processSet(job.shortlistedCandidates, 'Shortlisted');
          processSet(job.acceptedCandidates, 'Accepted');
          processSet(job.rejectedCandidates, 'Rejected');
          processSet(job.hiredCandidates, 'Hired');
        });

        // Cross-reference with interviews for "Interviewing" status
        return this.getInterviews().pipe(
          map(interviews => {
            interviews.forEach(int => {
              const cand = candidateMap.get(int.candidateId);
              if (cand && cand.status === 'Shortlisted') {
                cand.status = 'Interviewing';
              }
            });
            return Array.from(candidateMap.values());
          })
        );
      })
    );
  }

  sendCandidate(jobId: string, candidateId: string): Observable<any> {
    this.clearCache();
    return this.http.post(`${this.baseUrl}/system/add-candidate-shortlist/${jobId}`, { candidateId }, this.getAuthOptions());
  }

  revokeCandidate(jobId: string, candidateId: string): Observable<any> {
    this.clearCache();
    return this.http.post(`${this.baseUrl}/system/remove-can-from-shortlist/${jobId}`, { candidateId }, this.getAuthOptions());
  }

  acceptCandidate(jobId: string, candidateId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/job/accept-candidate-from-shortlisting/${jobId}/${candidateId}`, {}, this.getAuthOptions());
  }

  rejectCandidate(jobId: string, candidateId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/job/reject-candidate-from-shortlisting/${jobId}/${candidateId}`, {}, this.getAuthOptions());
  }

  private getAuthOptions() {
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || '';
    return {
      headers: {
        auth: token
      }
    };
  }

  getInterviews(): Observable<AdminInterview[]> {
    return this.getJobs().pipe(
      switchMap((jobs: AdminJob[]) => {
        const jobMap = new Map<string, AdminJob>(jobs.map(j => [j.id, j]));
        return this.http.get<any>(`${this.baseUrl}/system/get-all-interviews`).pipe(
          map(response => {
            const interviews = response.interviews || [];
            return interviews.map((i: any) => {
              const jobId = i.job?._id || i.job;
              const candidateId = i.candidate?._id || i.candidate;
              const resolvedJob = jobMap.get(jobId);
              
              let status: AdminInterview['status'] = this.mapInterviewStatus(i.status);
              
              // Detect actual hiring outcome from job lists
              if (resolvedJob) {
                const isHired = resolvedJob.hiredCandidates?.some((hc: any) => 
                  String(hc.candidate?._id || hc.candidate) === String(candidateId)
                );
                const isRejected = resolvedJob.rejectedCandidates?.some((rc: any) => 
                  String(rc.candidate?._id || rc.candidate) === String(candidateId)
                );
                
                if (isHired) status = 'Hired';
                else if (isRejected) status = 'Rejected';
              }

              return {
                id: i._id || i.id,
                jobId: jobId,
                candidateId: candidateId,
                candidateName: i.candidate ? `${i.candidate.firstName || ''} ${i.candidate.lastName || ''}`.trim() : 'Candidate',
                companyName: resolvedJob?.company || i.company?.name || 'Hiring Client',
                role: resolvedJob?.title || i.job?.title || 'Job Role',
                date: i.scheduledAt || i.createdAt || new Date().toISOString(),
                status: status,
                candidateStatus: i.candidateStatus
              };
            });
          })
        );
      })
    );
  }

  getCompanies(): Observable<AdminCompany[]> {
    return this.getJobs().pipe(
      map(jobs => {
        const companyMap = new Map<string, AdminCompany>();
        jobs.forEach(job => {
          const name = job.company;
          if (!companyMap.has(name)) {
            companyMap.set(name, {
              id: name,
              name: name,
              industry: job.companyIndustry || 'Technology',
              openRoles: 0,
              newestJobAt: job.requestedAt
            });
          }
          const c = companyMap.get(name)!;
          c.openRoles += job.openRoles;
          if (new Date(job.requestedAt) > new Date(c.newestJobAt)) {
            c.newestJobAt = job.requestedAt;
          }
        });
        return Array.from(companyMap.values());
      })
    );
  }

  private mapApiJobToAdminJob(job: any): AdminJob {
    const salary = Number(job.salary || job.budget?.max || job.budget || 0);
    return {
      id: job._id || job.id,
      title: job.title,
      company: job.company?.name || 'Unknown Company',
      companyIndustry: job.company?.industry || job.company?.sector || job.industry || 'Technology',
      location: job.location || job.company?.location || 'Cairo, Egypt',
      status: this.mapStatus(job.status),
      requestedAt: job.createdAt || new Date().toISOString(),
      workType: this.mapWorkType(job.workType || job.type || job.employmentType),
      budget: salary,
      openRoles: job.headcount || job.openRoles || 1,
      minExperience: job.minExperience?.toString() || '0',
      skills: job.skillsRequired || [],
      shortlistedCandidates: job.shortlistedCandidates || job.shortlisted || [],
      acceptedCandidates: job.acceptedCandidates || job.accepted || [],
      rejectedCandidates: job.rejectedCandidates || job.rejected || [],
      hiredCandidates: job.hiredCandidates || job.hired || []
    };
  }

  private mapApiUserToAdminCandidate(user: any): AdminCandidate {
    return {
      id: user._id || user.id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      role: user.candidateProfile?.specialization || 'Candidate',
      experience: user.candidateProfile?.experienceLevel || 'Mid',
      status: 'Screening',
      expectedSalary: user.candidateProfile?.expectedSalary?.max || 0,
      fitScore: user.candidateProfile?.fraudCheck?.score || 85,
      cvSummary: user.candidateProfile?.fraudCheck?.reason || 'No summary available',
      cvUrl: user.candidateProfile?.cvUrl,
      createdAt: user.createdAt || new Date().toISOString()
    };
  }

  private mapApiInterviewToAdminInterview(interview: any): AdminInterview {
    const job = interview.job || {};
    const company = interview.company || job.company || {};
    return {
      id: interview._id || interview.id,
      jobId: job._id || job.id || interview.job,
      candidateId: interview.candidate?._id || interview.candidate,
      candidateName: interview.candidate ? `${interview.candidate.firstName || ''} ${interview.candidate.lastName || ''}`.trim() : 'Unknown Candidate',
      companyName: company.name || 'Hiring Client',
      role: job.title || 'Specialized Role',
      date: interview.scheduledAt || interview.createdAt || new Date().toISOString(),
      status: this.mapInterviewStatus(interview.status),
      candidateStatus: interview.candidateStatus,
      createdAt: interview.createdAt || interview.scheduledAt || new Date().toISOString()
    };
  }

  private mapStatus(status: string): 'Open' | 'Closed' | 'In Review' {
    const s = status?.toLowerCase();
    if (s === 'active') return 'Open';
    if (s === 'filled' || s === 'cancelled') return 'Closed';
    return 'In Review';
  }

  private mapWorkType(workType: string): 'Remote' | 'Hybrid' | 'Onsite' | 'FullTime' | 'PartTime' | 'Contract' {
    if (!workType) return 'Onsite';
    const w = workType.toLowerCase();
    if (w.includes('remote')) return 'Remote';
    if (w.includes('hybrid')) return 'Hybrid';
    if (w.includes('part')) return 'PartTime';
    if (w.includes('full')) return 'FullTime';
    if (w.includes('contract')) return 'Contract';
    return 'Onsite';
  }

  private mapInterviewStatus(status: string): 'Scheduled' | 'Completed' | 'Pending' | 'Rescheduled' | 'Cancelled' {
    const s = status?.toLowerCase();
    if (s === 'scheduled') return 'Scheduled';
    if (s === 'completed') return 'Completed';
    if (s === 'rescheduled') return 'Rescheduled';
    if (s === 'cancelled') return 'Cancelled';
    return 'Pending';
  }
}
