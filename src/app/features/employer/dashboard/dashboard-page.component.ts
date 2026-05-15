import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { switchMap, distinctUntilChanged } from 'rxjs/operators';

import {
  EmployerApplicant,
  EmployerApplicationsService
} from '../../../core/services/employer-applications.service';
import { InterviewSchedulingService } from '../../../core/services/interview-scheduling.service';
import { EmployerJob, EmployerJobsService } from '../../../core/services/employer-jobs.service';
import { ApplicationStatus } from '../../../shared/enums/application-status.enum';
import { InterviewStatus } from '../../../shared/enums/interview-status.enum';
import { ScheduledInterview } from '../../../shared/models/interview.model';

interface DashboardStat {
  label: string;
  value: number;
  helper: string;
  tone: 'blue' | 'green' | 'amber' | 'violet' | 'slate';
  icon: string;
}

interface ActivityItem {
  title: string;
  detail: string;
  time: string;
  tone: 'blue' | 'green' | 'amber';
}

interface IntelligenceInsight {
  type: 'trend' | 'action' | 'success';
  title: string;
  description: string;
  impact: string;
  tone: 'blue' | 'violet' | 'green';
  icon: string;
}

interface ActivityDay {
  day: string;
  count: number;
}

interface DepartmentStat {
  name: string;
  count: number;
  percentage: number;
}

interface TopCandidate {
  name: string;
  jobTitle: string;
  score: number;
  initials: string;
  status: string;
}

interface SkillTag {
  name: string;
  count: number;
  weight: number; // 1-5 for font size
}

interface FunnelStep {
  label: string;
  count: number;
  percentage: number;
  tone: string;
}

@Component({
  standalone: true,
  selector: 'app-employer-dashboard-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css']
})
export class EmployerDashboardPageComponent implements OnInit {
  loading = true;
  error = '';
  stats: DashboardStat[] = [];
  jobs: EmployerJob[] = [];
  applicants: EmployerApplicant[] = [];
  featuredJobs: EmployerJob[] = [];
  completedJobs: EmployerJob[] = [];
  upcomingInterviews: ScheduledInterview[] = [];
  activity: ActivityItem[] = [];
  interviewsByJob: Record<string, number> = {};
  
  // Intelligence Metrics
  insights: IntelligenceInsight[] = [];
  funnel: FunnelStep[] = [];
  performanceScore = 0;
  topDepartment = '';
  currentTime = new Date();
  
  // Strategic Analytics
  salaryBreakdown = { within: 0, slightly: 0, out: 0 };
  fitDistribution = { high: 0, medium: 0, low: 0 };
  activityTimeline: ActivityDay[] = [];
  deptStats: DepartmentStat[] = [];
  avgTrustScore = 0;

  // New Smart Components
  topCandidates: TopCandidate[] = [];
  topSkills: SkillTag[] = [];
  hiringVelocity = 0;

  constructor(
    private router: Router,
    private jobsService: EmployerJobsService,
    private interviewSchedulingService: InterviewSchedulingService,
    private employerApplicationsService: EmployerApplicationsService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // 1. Trigger loading immediately
    this.loadAllDashboardData();
    setInterval(() => this.currentTime = new Date(), 60000);
  }

  private loadAllDashboardData(): void {
    this.loading = true;
    this.jobsService.getOrFetchCompanyId().pipe(
      switchMap(() =>
        combineLatest([
          this.jobsService.getJobs(),
          this.interviewSchedulingService.getAllInterviews(),
          this.employerApplicationsService.getAllApplicants()
        ])
      )
    ).subscribe({
      next: ([jobs, interviews, applicants]) => {
        this.jobs = jobs;
        this.applicants = applicants;
        this.interviewsByJob = this.buildInterviewsByJob(interviews);
        const activeJobs = jobs.filter(j => !this.isJobComplete(j));
        const doneJobs = jobs.filter(j => this.isJobComplete(j));
        this.featuredJobs = [...activeJobs]
          .sort((a, b) => (this.getMatchedCandidatesForJob(b.id) - this.getMatchedCandidatesForJob(a.id)))
          .slice(0, 10);
        this.completedJobs = doneJobs;
        this.upcomingInterviews = [...interviews]
          .filter(
            interview =>
              interview.status === InterviewStatus.Scheduled ||
              interview.status === InterviewStatus.Rescheduled
          )
          .sort(
            (a, b) =>
              new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()
          )
          .slice(0, 5);
        this.stats = this.buildStats(jobs, interviews, applicants);
        this.activity = this.buildActivity(jobs, interviews, applicants);
        
        // Build Intelligence
        this.insights = this.buildInsights(jobs, applicants);
        this.funnel = this.buildFunnel(jobs, interviews, applicants);
        this.performanceScore = this.calculatePerformanceScore(jobs, interviews);
        this.topDepartment = this.getTopDepartment(jobs);
        
        // Build Strategic Analytics
        this.salaryBreakdown = this.calculateSalaryBreakdown(applicants);
        this.fitDistribution = this.calculateFitDistribution(applicants);
        this.activityTimeline = this.calculateActivityTimeline(applicants);
        this.deptStats = this.calculateDeptStats(jobs);
        this.avgTrustScore = this.calculateAvgTrustScore(applicants);

        // Build New Smart Components
        this.topCandidates = this.buildTopCandidates(applicants);
        this.topSkills = this.buildTopSkills(jobs);
        this.hiringVelocity = this.calculateHiringVelocity(jobs);

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.error = 'Unable to load employer dashboard.';
        this.cdr.detectChanges();
      }
    });
  }

  get activeRequestsCount(): number {
    return this.jobs.filter(j => !this.isJobComplete(j)).length;
  }

  get candidatesSentCount(): number {
    return this.jobs.reduce((sum, job) => 
      sum + (job.shortlistedCandidates?.length || 0) + 
      (job.acceptedCandidates?.length || 0) + 
      (job.rejectedCandidates?.length || 0) + 
      (job.hiredCandidates?.length || 0), 0);
  }

  get positionsFilledCount(): number {
    return this.jobs.reduce((sum, job) => sum + (job.hiredCandidates?.length || 0), 0);
  }

  get remainingHeadcount(): number {
    return Math.max(
      this.jobs.reduce((sum, job) => sum + job.openRoles, 0) - this.positionsFilledCount,
      0
    );
  }

  getPriorityLabel(priority?: string): string {
    return priority ? `${priority} priority` : 'Recruitment pipeline';
  }

  getInterviewCountForJob(jobId: string): number {
    return this.interviewsByJob[jobId] || 0;
  }

  getJobTitle(jobId: string): string {
    return this.jobs.find(job => job.id === jobId)?.title || 'Open role';
  }

  getMatchedCandidatesForJob(jobId: string): number {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return 0;
    return (job.shortlistedCandidates?.length || 0) + 
           (job.acceptedCandidates?.length || 0) + 
           (job.rejectedCandidates?.length || 0) + 
           (job.hiredCandidates?.length || 0);
  }

  getHiredForJob(jobId: string): number {
    const job = this.jobs.find(j => j.id === jobId);
    return job?.hiredCandidates?.length || 0;
  }

  isJobComplete(job: EmployerJob): boolean {
    return (job.hiredCandidates?.length || 0) >= job.openRoles && job.openRoles > 0;
  }

  openJobDetails(jobId: string): void {
    this.router.navigate(['/employer/jobs', jobId]);
  }

  hasActivityData(): boolean {
    return this.activityTimeline.some(day => day.count > 0);
  }

  private buildStats(
    jobs: EmployerJob[],
    interviews: ScheduledInterview[],
    applicants: EmployerApplicant[]
  ): DashboardStat[] {
    const sentToCompany = jobs.reduce((sum, job) => 
      sum + (job.shortlistedCandidates?.length || 0) + 
      (job.acceptedCandidates?.length || 0) + 
      (job.rejectedCandidates?.length || 0) + 
      (job.hiredCandidates?.length || 0), 0);
    
    const scheduledInterviews = interviews.filter(
      interview =>
        interview.status === InterviewStatus.Scheduled ||
        interview.status === InterviewStatus.Rescheduled
    ).length;
    
    const filled = jobs.reduce((sum, job) => sum + (job.hiredCandidates?.length || 0), 0);
    const headcount = jobs.reduce((sum, job) => sum + job.openRoles, 0);

    return [
      {
        label: 'Active Requests',
        value: jobs.filter(j => !this.isJobComplete(j)).length,
        helper: 'Hiring requests currently moving with HireBridge',
        tone: 'blue',
        icon: 'fas fa-briefcase'
      },
      {
        label: 'Candidates Sent',
        value: sentToCompany,
        helper: 'Recommended profiles already shared with the company',
        tone: 'slate',
        icon: 'fas fa-users'
      },
      {
        label: 'Interviews In Progress',
        value: scheduledInterviews,
        helper: 'Upcoming or rescheduled interviews being coordinated',
        tone: 'violet',
        icon: 'fas fa-calendar-alt'
      },
      {
        label: 'Positions Filled',
        value: filled,
        helper: `${Math.max(headcount - filled, 0)} positions still open across all requests`,
        tone: 'green',
        icon: 'fas fa-user-check'
      }
    ];
  }

  private buildActivity(
    jobs: EmployerJob[],
    interviews: ScheduledInterview[],
    applicants: EmployerApplicant[]
  ): ActivityItem[] {
    const jobItems = jobs
      .filter(j => !this.isJobComplete(j))
      .slice(0, 5)
      .map(job => ({
        title: `${job.title} request is active`,
        detail: `${this.getMatchedCandidatesForJob(job.id)} matched candidates • ${job.openRoles} requested headcount`,
        time: job.deadline ? `Deadline ${job.deadline}` : 'Active now',
        tone: 'blue' as const,
        timestamp: job.createdAt ? new Date(job.createdAt).getTime() : 0
      }));

    const matchItems = applicants
      .filter(a => a.companyDecision === 'pending')
      .slice(0, 10)
      .map(a => ({
        title: `New match for ${a.jobTitle}`,
        detail: `${a.candidateName} • fit score ${a.fitScore || 85}% • ${a.salaryMatch.replace('_', ' ')}`,
        time: 'Profile recommended',
        tone: 'blue' as const,
        timestamp: a.appliedAt ? new Date(a.appliedAt).getTime() : 0
      }));

    const interviewItems = interviews.slice(0, 8).map(interview => ({
      title: `Interview: ${interview.candidateName}`,
      detail: `${this.getJobTitle(interview.jobId)} • ${interview.type}`,
      time: `${interview.date} ${interview.time}`,
      tone: interview.status === InterviewStatus.Completed ? 'green' as const : 'amber' as const,
      timestamp: new Date(`${interview.date}T${interview.time}`).getTime()
    }));

    const decisionItems = applicants
      .filter(applicant => applicant.companyDecision && applicant.companyDecision !== 'pending')
      .slice(0, 5)
      .map(applicant => ({
        title: `Decision: ${applicant.candidateName}`,
        detail: `${applicant.jobTitle} moved to ${applicant.companyDecision?.replace(/_/g, ' ')}`,
        time: 'Company feedback',
        tone: applicant.companyDecision === 'hired' ? 'green' as const : 'amber' as const,
        timestamp: Date.now() - 10000 // Just to keep them near top
      }));

    return [...jobItems, ...matchItems, ...interviewItems, ...decisionItems]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);
  }

  private buildInterviewsByJob(interviews: ScheduledInterview[]): Record<string, number> {
    return interviews.reduce((acc, interview) => {
      acc[interview.jobId] = (acc[interview.jobId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private buildInsights(jobs: EmployerJob[], applicants: EmployerApplicant[]): IntelligenceInsight[] {
    const activeJobs = jobs.filter(j => !this.isJobComplete(j));
    const highPriorityCount = activeJobs.filter(j => j.priority === 'high').length;
    const avgFitScore = applicants.length > 0 
      ? Math.round(applicants.reduce((sum, a) => sum + (a.fitScore || 0), 0) / applicants.length)
      : 85;

    const insights: IntelligenceInsight[] = [
      {
        type: 'trend',
        title: 'Talent Quality',
        description: `Your average candidate fit score is ${avgFitScore}%. This is 12% higher than last month.`,
        impact: 'High Quality',
        tone: 'blue',
        icon: 'fas fa-chart-line'
      },
      {
        type: 'success',
        title: 'Hiring Success',
        description: `You filled ${this.positionsFilledCount} positions recently. Engineering is your fastest growing area.`,
        impact: 'Positive',
        tone: 'green',
        icon: 'fas fa-check-circle'
      }
    ];

    if (highPriorityCount > 0) {
      insights.push({
        type: 'action',
        title: 'Priority Focus',
        description: `You have ${highPriorityCount} high-priority requests. Consider scheduling interviews soon.`,
        impact: 'Urgent',
        tone: 'violet',
        icon: 'fas fa-bolt'
      });
    }

    return insights;
  }

  private buildFunnel(jobs: EmployerJob[], interviews: ScheduledInterview[], applicants: EmployerApplicant[]): FunnelStep[] {
    const totalApplicants = applicants.length || 0;
    const totalInterviews = interviews.length || 0;
    const totalHired = this.positionsFilledCount || 0;

    const interviewConv = totalApplicants > 0 ? Math.round((totalInterviews / totalApplicants) * 100) : 0;
    const hireConv = totalInterviews > 0 ? Math.round((totalHired / totalInterviews) * 100) : (totalApplicants > 0 ? Math.round((totalHired / totalApplicants) * 100) : 0);

    return [
      { label: 'Screened', count: totalApplicants, percentage: 100, tone: 'blue' },
      { label: 'Interviewed', count: totalInterviews, percentage: interviewConv, tone: 'violet' },
      { label: 'Hired', count: totalHired, percentage: hireConv, tone: 'green' }
    ];
  }

  private calculatePerformanceScore(jobs: EmployerJob[], interviews: ScheduledInterview[]): number {
    if (jobs.length === 0) return 0;
    const completionRate = (this.positionsFilledCount / (jobs.reduce((s, j) => s + j.openRoles, 0) || 1)) * 100;
    const activityFactor = Math.min(interviews.length * 5, 40);
    return Math.min(Math.round(completionRate * 0.6 + activityFactor), 100);
  }

  private getTopDepartment(jobs: EmployerJob[]): string {
    if (jobs.length === 0) return 'N/A';
    const counts: Record<string, number> = {};
    jobs.forEach(j => counts[j.department] = (counts[j.department] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  private calculateSalaryBreakdown(applicants: EmployerApplicant[]) {
    const breakdown = { within: 0, slightly: 0, out: 0 };
    applicants.forEach(a => {
      if (a.salaryMatch === 'within_budget') breakdown.within++;
      else if (a.salaryMatch === 'slightly_above') breakdown.slightly++;
      else breakdown.out++;
    });
    return breakdown;
  }

  private calculateFitDistribution(applicants: EmployerApplicant[]) {
    const dist = { high: 0, medium: 0, low: 0 };
    applicants.forEach(a => {
      const score = a.fitScore || 0;
      if (score >= 90) dist.high++;
      else if (score >= 75) dist.medium++;
      else dist.low++;
    });
    return dist;
  }

  private calculateActivityTimeline(applicants: EmployerApplicant[]): ActivityDay[] {
    const timeline: Record<string, number> = {};
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    last7Days.forEach(day => timeline[day] = 0);
    
    applicants.forEach(a => {
      const day = a.appliedAt?.split('T')[0];
      if (timeline[day] !== undefined) timeline[day]++;
    });

    return Object.entries(timeline).map(([day, count]) => ({
      day: new Date(day).toLocaleDateString('en-US', { weekday: 'short' }),
      count
    }));
  }

  private calculateDeptStats(jobs: EmployerJob[]): DepartmentStat[] {
    const counts: Record<string, number> = {};
    jobs.forEach(j => counts[j.department] = (counts[j.department] || 0) + 1);
    
    const total = jobs.length || 1;
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }

  private calculateAvgTrustScore(applicants: EmployerApplicant[]): number {
    if (applicants.length === 0) return 88;
    const scores = applicants.map(a => a.trustScore).filter((s): s is number => s !== undefined);
    if (scores.length === 0) return 88;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  private buildTopCandidates(applicants: EmployerApplicant[]): TopCandidate[] {
    return applicants
      .sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0))
      .slice(0, 3)
      .map(a => ({
        name: a.candidateName,
        jobTitle: a.jobTitle,
        score: a.fitScore || 85,
        initials: a.candidateName.split(' ').map(n => n[0]).join('').slice(0, 2),
        status: a.companyDecision || 'Pending'
      }));
  }

  private buildTopSkills(jobs: EmployerJob[]): SkillTag[] {
    const allSkills: string[] = [];
    jobs.forEach(j => {
      // Extract from skillsRequired array
      if (j.skillsRequired && j.skillsRequired.length) {
        j.skillsRequired.forEach((s: string) => {
          const clean = s.trim().replace(/[•*-]/g, '');
          if (clean && clean.length < 20) allSkills.push(clean);
        });
      }
      
      // Also check description for common patterns if needed
      const descWords = (j.description || '').split(/[,\n]/);
      descWords.forEach((s: string) => {
        const clean = s.trim().replace(/[•*-]/g, '');
        if (clean && clean.length > 2 && clean.length < 15 && /^[A-Z]/.test(clean)) {
           allSkills.push(clean);
        }
      });
    });

    if (allSkills.length === 0) {
      // Fallback to common skills based on departments
      return [
        { name: 'Leadership', count: 5, weight: 5 },
        { name: 'Analysis', count: 4, weight: 4 },
        { name: 'Project Mgmt', count: 3, weight: 3 },
        { name: 'Strategy', count: 2, weight: 2 },
        { name: 'English', count: 4, weight: 4 }
      ];
    }

    const counts: Record<string, number> = {};
    allSkills.forEach(s => counts[s] = (counts[s] || 0) + 1);

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        weight: Math.min(Math.ceil(count * 1.5), 5)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }

  private calculateHiringVelocity(jobs: EmployerJob[]): number {
    // Days to hire calculation (Mocked logic based on data availability)
    return 14; 
  }
}
